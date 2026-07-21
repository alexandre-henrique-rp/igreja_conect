import { createHash } from "node:crypto";
import { prisma } from "~/db/prisma.server";

/**
 * Logger seguro de auditoria (S00-T06).
 *
 * Aplica allowlist antes de imprimir no console (RAG `lgpd-igreja-conect` §2.5).
 * Proibido logar: email, telefone, senhaHash, valorCentavos, endereço.
 *
 * @example
 *   safeLog({ userId: membro.id, action: "login_attempt", result: "ok" });
 *   // console.log: {"audit":{"userId":"abc","action":"login_attempt","result":"ok"}}
 */
export const ALLOWED_FIELDS = new Set([
  "userId",
  "action",
  "resource",
  "result",
  "timestamp",
  "ip",
]);

/**
 * Filtra evento para apenas campos da allowlist e imprime como JSON.
 *
 * Mantido para compatibilidade — apenas console.log.
 * Para persistir no banco, use `logAction`.
 *
 * @param {Record<string, unknown>} event - Evento bruto de auditoria.
 * @example
 *   safeLog({ userId: "u1", email: "leaked@x.com", action: "view" });
 *   // → console.log: {"audit":{"userId":"u1","action":"view"}}
 */
export function safeLog(event: Record<string, unknown>): void {
  const filtered = Object.fromEntries(
    Object.entries(event).filter(([k]) => ALLOWED_FIELDS.has(k))
  );
  console.log(JSON.stringify({ audit: filtered }));
}

/**
 * Hasheia um IP com SHA-256 para conformidade LGPD (art. 46).
 * Retorna null se o IP for "unknown" ou vazio.
 */
function hashIP(ip: string | undefined | null): string | null {
  if (!ip || ip === "unknown") return null;
  return createHash("sha256").update(ip).digest("hex");
}

/**
 * Persiste um evento de auditoria no banco (tabela `audit_log`).
 *
 * O IP é hasheado com SHA-256 antes de ser armazenado (LGPD art. 46).
 * Também imprime no console via `safeLog` para compatibilidade.
 *
 * @param event - Dados do evento de auditoria.
 * @param event.membroId - UUID do membro alvo da ação (ex: membro sendo editado).
 * @param event.event - Nome do evento (ex: "login", "membro.create").
 * @param event.actorId - UUID de quem executou a ação.
 * @param event.actorRole - Cargo de quem executou.
 * @param event.details - String JSON com contexto adicional.
 * @param event.ip - IP bruto do request (será hasheado).
 * @param event.userAgent - User-Agent do request.
 */
export async function logAction(event: {
  membroId?: string | null;
  event: string;
  actorId?: string | null;
  actorRole?: string | null;
  details?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const ipHash = hashIP(event.ip);

  // Console log para compatibilidade (allowlist filtrada)
  safeLog({
    userId: event.actorId,
    action: event.event,
    ip: event.ip,
    timestamp: Date.now(),
  });

  // Persiste no banco (best-effort — não bloqueia a request se falhar)
  await prisma.auditLog
    .create({
      data: {
        membroId: event.membroId ?? null,
        event: event.event,
        actorId: event.actorId ?? null,
        actorRole: event.actorRole ?? null,
        details: event.details ?? null,
        ipHash,
        userAgent: event.userAgent ?? null,
      },
    })
    .catch((err) => {
      console.error("audit.server: falha ao persistir log", err);
    });
}

/**
 * Retorna os N logs de auditoria mais recentes de um membro.
 *
 * @param membroId - UUID do membro.
 * @param limit - Quantidade máxima (default 20).
 * @returns Array de logs ordenados do mais recente ao mais antigo.
 */
export async function getAuditLogsByMembro(
  membroId: string,
  limit = 20
): Promise<
  Array<{
    id: string;
    event: string;
    actorId: string | null;
    actorRole: string | null;
    details: string | null;
    ipHash: string | null;
    createdAt: Date;
  }>
> {
  return prisma.auditLog.findMany({
    where: { membroId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      event: true,
      actorId: true,
      actorRole: true,
      details: true,
      ipHash: true,
      createdAt: true,
    },
  });
}
