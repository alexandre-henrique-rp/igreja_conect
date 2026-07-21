/**
 * Fila assíncrona SQLite-based (sem Redis/BullMQ).
 *
 * **Por que SQLite em vez de Redis:**
 * - Projeto já tem SQLite; adicionar Redis = nova infra pra manter.
 * - Worker in-process + tabela `jobs` cobre 95% dos casos (perda de jobs
 *   em restart é aceitável para avatar/documentos não-críticos).
 * - Migração futura pra BullMQ é trivial se necessário.
 *
 * **Modelo:**
 * - `enqueue(queue, payload)` cria job com `status=PENDING`, `scheduledAt=now()`
 * - Worker polling pega jobs `PENDING AND scheduledAt <= now()` em ordem FIFO
 * - Marca `RUNNING` ao começar, `DONE` ao terminar, `FAILED` com retry
 * - `maxAttempts=3` por default; após exceder → `DEAD` (precisa intervenção manual)
 *
 * **Ciclo ESM quebrado via dynamic import:** `prisma` é carregado lazy dentro
 * de cada função (em vez de top-level) pra quebrar o ciclo com `prisma.server.ts`
 * (que é carregado por este módulo via startup.server.ts side-effect).
 * Sem isso, o ESM pega o módulo PARCIAL onde `prisma = undefined`.
 */
export const QUEUES = {
  MEDIA_PROCESS: "media.process",
  MEDIA_CLEANUP: "media.cleanup",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export interface EnqueueOpts {
  /** Quando rodar (default: now). Permite agendar pra futuro. */
  scheduledAt?: Date;
  /** Tentativas antes de marcar como DEAD (default: 3). */
  maxAttempts?: number;
}

export interface JobRecord {
  id: string;
  queue: string;
  payload: string;
  status: string;
  attempts: number;
  maxAttempts: number;
}

/** Lazy getter do prisma — quebra cycle com prisma.server.ts. */
async function getPrisma() {
  const { prisma } = await import("~/db/prisma.server");
  return prisma;
}

/**
 * Enfileira um job. `payload` é serializado como JSON string.
 *
 * @returns ID do job criado.
 */
export async function enqueue<T = unknown>(
  queue: QueueName | string,
  payload: T,
  opts: EnqueueOpts = {},
): Promise<string> {
  const prisma = await getPrisma();
  const job = await prisma.job.create({
    data: {
      queue,
      payload: JSON.stringify(payload),
      status: "PENDING",
      maxAttempts: opts.maxAttempts ?? 3,
      scheduledAt: opts.scheduledAt ?? new Date(),
    },
  });
  return job.id;
}

/**
 * Pega e marca como RUNNING o próximo job disponível de uma queue.
 *
 * Single-process worker por enquanto, claim atômico via UPDATE+RETURNING.
 */
export async function claimNextJob(queue: QueueName | string): Promise<JobRecord | null> {
  const prisma = await getPrisma();
  const jobs = await prisma.job.findMany({
    where: {
      queue,
      status: "PENDING",
      scheduledAt: { lte: new Date() },
    },
    orderBy: { scheduledAt: "asc" },
    take: 1,
  });

  if (jobs.length === 0) return null;
  const job = jobs[0]!;

  // Atomic claim: só marca se ainda for PENDING.
  const updated = await prisma.job.updateMany({
    where: { id: job.id, status: "PENDING" },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      attempts: { increment: 1 },
    },
  });

  if (updated.count === 0) {
    // Outro worker pegou. Tenta de novo.
    return claimNextJob(queue);
  }

  return {
    id: job.id,
    queue: job.queue,
    payload: job.payload,
    status: "RUNNING",
    attempts: job.attempts + 1,
    maxAttempts: job.maxAttempts,
  };
}

/**
 * Marca um job como DONE.
 */
export async function markJobDone(jobId: string): Promise<void> {
  const prisma = await getPrisma();
  await prisma.job.update({
    where: { id: jobId },
    data: { status: "DONE", completedAt: new Date() },
  });
}

/**
 * Marca um job como FAILED. Se attempts < maxAttempts, volta pra PENDING
 * com backoff (scheduledAt = now + 5s * 2^attempts). Senão → DEAD.
 */
export async function markJobFailed(jobId: string, error: string): Promise<void> {
  const prisma = await getPrisma();
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return;

  if (job.attempts >= job.maxAttempts) {
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "DEAD", lastError: error, completedAt: new Date() },
    });
    return;
  }

  const backoffMs = 5_000 * Math.pow(2, job.attempts);
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: "PENDING",
      lastError: error,
      scheduledAt: new Date(Date.now() + backoffMs),
    },
  });
}

/**
 * Parse do payload (helper para o worker).
 */
export function parseJobPayload<T = unknown>(job: JobRecord): T {
  return JSON.parse(job.payload) as T;
}
