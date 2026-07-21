/**
 * Worker assíncrono (in-process, polling SQLite).
 *
 * **Padrão (training/object-storage-standard.md §4.2):**
 * - Concurrency: 4 jobs paralelos (configurável)
 * - Timeout: 15min
 * - Retry: 3 tentativas com backoff exponencial (já em `jobs.server.ts`)
 *
 * **Startup:** chamar `startWorker()` uma vez no boot da app. Idempotente
 * (não inicia 2x se chamado 2x).
 *
 * **Em produção:** extrair pra processo separado (`node worker.js`).
 * Por enquanto, roda in-process no mesmo Node do RR7.
 *
 * **Ciclo ESM quebrado via dynamic import de prisma:** `prisma.server.ts` é
 * carregado via side-effect (startup.server.ts) e tem ciclo com este módulo
 * (este → jobs.server.ts → prisma.server.ts). Carregamos `prisma` lazy
 * dentro de `processJob` pra evitar undefined no claim atômico.
 */
import { claimNextJob, markJobDone, markJobFailed, parseJobPayload, QUEUES } from "./jobs.server";
import { deleteObject, uploadObject } from "./upload.server";
import { getTargetBucket, STORAGE_CONFIG, type StorageKind } from "./config.server";
import { detectMimeFromBuffer, isMimeAllowedForKind } from "./magic-bytes.server";
import { scanBuffer } from "./clamav.server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { createStorageClient } from "./client.server";
import { localGetObject } from "./local.server";
import { generateImageVariants } from "./image-variants.server";
import { generateVideoVariants } from "./video-variants.server";
import { generateAudioVariants } from "./audio-variants.server";

const POLL_INTERVAL_MS = 2_000;
const CONCURRENCY = 4;
const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100MB — acima disso, scan pula (ClamAV não aguenta em memória)

interface MediaProcessPayload {
  uploadId: string;
  stagingBucket: string;
  stagingKey: string;
  kind: StorageKind;
  declaredMime: string;
  sizeBytes: number;
}

let workerStarted = false;
let workerRunning = false;

/**
 * Inicia o worker loop (chamar 1x no boot da app).
 * Idempotente.
 */
export function startWorker(): void {
  if (workerStarted) return;
  workerStarted = true;
  console.log(
    `[storage] Worker started (concurrency=${CONCURRENCY}, poll=${POLL_INTERVAL_MS}ms)`,
  );
  void workerLoop();
}

async function workerLoop(): Promise<void> {
  const inFlight = new Set<Promise<void>>();
  while (workerRunning) {
    if (inFlight.size >= CONCURRENCY) {
      await Promise.race(inFlight);
      continue;
    }

    const job = await claimNextJob(QUEUES.MEDIA_PROCESS);
    if (!job) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    const task = processJob(job.id, parseJobPayload<MediaProcessPayload>(job))
      .finally(() => inFlight.delete(task));

    inFlight.add(task);
  }
}

/**
 * Para o worker loop. Útil em testes / shutdown gracioso.
 */
export function stopWorker(): void {
  workerStarted = false;
  workerRunning = false;
  console.log("[storage] Worker stopped");
}

/**
 * Habilita o loop (chamado pelo starter). Idempotente.
 */
export function _setWorkerRunning(running: boolean): void {
  workerRunning = running;
}

/**
 * Processa um job: download → magic bytes → scan → upload final → cleanup.
 *
 * Marca o Upload com status final (READY | REJECTED | FAILED).
 */
async function processJob(
  jobId: string,
  payload: MediaProcessPayload,
): Promise<void> {
  const { uploadId, stagingBucket, stagingKey, kind, declaredMime, sizeBytes } = payload;
  const prisma = await importPrisma();

  try {
    // 1) Buscar Upload do banco
    const upload = await prisma.upload.findUnique({ where: { id: uploadId } });
    if (!upload) {
      throw new Error(`Upload ${uploadId} não encontrado`);
    }

    await prisma.upload.update({
      where: { id: uploadId },
      data: { status: "SCANNING" },
    });

    // 2) Download do staging (em chunks, max 100MB pra scan em memória)
    const buffer = await downloadToBuffer(stagingBucket, stagingKey, sizeBytes);

    // 3) Magic bytes
    const detected = detectMimeFromBuffer(buffer);
    const detectedMime = detected.mime || declaredMime;
    const ext = detected.ext;

    if (!isMimeAllowedForKind(kind, detectedMime)) {
      await rejectUpload(prisma, uploadId, "mime_mismatch", {
        declared: declaredMime,
        detected: detectedMime,
      });
      await safeDeleteStaging(stagingBucket, stagingKey);
      await markJobDone(jobId);
      return;
    }

    // 4) ClamAV scan (best-effort)
    const scan = await scanBuffer(buffer);

    if (scan.infected) {
      await rejectUpload(prisma, uploadId, "virus_detected", {
        scanner: scan.scanner,
        threat: scan.threat,
      });
      // TODO: mover para bucket de quarentena
      // Por enquanto, só deletamos do staging
      await safeDeleteStaging(stagingBucket, stagingKey);
      await markJobDone(jobId);
      return;
    }

    // 5) Upload para bucket final (original na raiz)
    const finalBucket = getTargetBucket(kind);
    const finalKey = `${upload.storageKeyPrefix}${ext}`;

    const upResult = await uploadObject({
      bucket: finalBucket,
      key: finalKey,
      body: buffer,
      contentType: detectedMime,
      hashSha256: false,
      metadata: {
        "upload-id": uploadId,
        "user-id": upload.userId ?? "",
        "kind": upload.kind,
        "original-hash": upload.sha256 ?? "",
      },
    });

    // SHA-256 já calculado no endpoint de upload; usar do DB
    const sha256 = upload.sha256 ?? await import("node:crypto")
      .then((m) => m.createHash("sha256").update(buffer).digest("hex"));

    // 6) Gerar variants (lg/md/sm) para imagem, vídeo e áudio
    //    Documentos: sem variants — apenas o original
    let variantsList: string[] | null = null;
    if (kind === "image" && detectedMime.startsWith("image/")) {
      try {
        const variants = await generateImageVariants(buffer, detectedMime);
        variantsList = [];
        for (const v of variants) {
          const vKey = `${v.name}/${upload.storageKeyPrefix}${ext}`;
          await uploadObject({
            bucket: finalBucket,
            key: vKey,
            body: v.buffer,
            contentType: v.contentType,
            hashSha256: false,
            metadata: {
              "upload-id": uploadId,
              "variant": v.name,
              "width": String(v.width),
              "height": String(v.height),
            },
          });
          variantsList.push(v.name);
          console.log(`[storage] Variant ${v.name}: ${finalBucket}/${vKey} (${v.width}x${v.height})`);
        }
      } catch (variantErr) {
        console.warn(
          `[storage] Falha ao gerar variants de imagem para ${uploadId}:`,
          variantErr instanceof Error ? variantErr.message : variantErr,
        );
      }
    } else if (kind === "video" && detectedMime.startsWith("video/")) {
      try {
        const variants = await generateVideoVariants(buffer);
        variantsList = [];
        for (const v of variants) {
          const vExt = ".mp4";
          const vKey = `${v.name}/${upload.storageKeyPrefix}${vExt}`;
          await uploadObject({
            bucket: finalBucket,
            key: vKey,
            body: v.buffer,
            contentType: v.contentType,
            hashSha256: false,
            metadata: {
              "upload-id": uploadId,
              "variant": v.name,
            },
          });
          variantsList.push(v.name);
          console.log(`[storage] Variant ${v.name}: ${finalBucket}/${vKey}`);
        }
      } catch (variantErr) {
        console.warn(
          `[storage] Falha ao gerar variants de vídeo para ${uploadId}:`,
          variantErr instanceof Error ? variantErr.message : variantErr,
        );
      }
    } else if (kind === "audio" && detectedMime.startsWith("audio/")) {
      try {
        const variants = await generateAudioVariants(buffer);
        variantsList = [];
        for (const v of variants) {
          const vExt = ".m4a";
          const vKey = `${v.name}/${upload.storageKeyPrefix}${vExt}`;
          await uploadObject({
            bucket: finalBucket,
            key: vKey,
            body: v.buffer,
            contentType: v.contentType,
            hashSha256: false,
            metadata: {
              "upload-id": uploadId,
              "variant": v.name,
            },
          });
          variantsList.push(v.name);
          console.log(`[storage] Variant ${v.name}: ${finalBucket}/${vKey}`);
        }
      } catch (variantErr) {
        console.warn(
          `[storage] Falha ao gerar variants de áudio para ${uploadId}:`,
          variantErr instanceof Error ? variantErr.message : variantErr,
        );
      }
    }

    // 7) Marcar Upload como READY
    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        status: "READY",
        detectedMime,
        ext,
        bucket: finalBucket,
        sha256,
        processedAt: new Date(),
        variants: variantsList ? JSON.stringify(variantsList) : null,
      },
    });

    // 8) Cleanup do staging
    await safeDeleteStaging(stagingBucket, stagingKey);

    console.log(
      `[storage] Upload READY: ${uploadId} → ${finalBucket}/${finalKey} (etag=${upResult.etag}, sha256=${(sha256 ?? "").slice(0, 12)}…, variants=${variantsList?.join(",") ?? "none"})`,
    );
    await markJobDone(jobId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[storage] Job ${jobId} falhou: ${msg}`);

    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        status: "FAILED",
        rejectionReason: "processing_error",
        rejectionDetails: JSON.stringify({ error: msg }),
        failedAt: new Date(),
      },
    }).catch(() => {});

    await markJobFailed(jobId, msg);
  }
}

async function downloadToBuffer(
  bucket: string,
  key: string,
  sizeBytes: number,
): Promise<Buffer> {
  if (sizeBytes > MAX_FILE_BYTES) {
    throw new Error(
      `Arquivo ${sizeBytes} bytes excede limite do worker (${MAX_FILE_BYTES})`,
    );
  }

  if (STORAGE_CONFIG.provider === "local") {
    const obj = await localGetObject(bucket, key);
    if (!obj) throw new Error(`Objeto não encontrado: ${bucket}/${key}`);
    return obj.body;
  }

  const client = createStorageClient();
  const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!out.Body) throw new Error("Empty body");
  const chunks: Uint8Array[] = [];
  // @ts-expect-error — Body é um ReadableStream-like no Node runtime
  for await (const chunk of out.Body) {
    chunks.push(chunk as Uint8Array);
  }
  return Buffer.concat(chunks);
}

async function safeDeleteStaging(bucket: string, key: string): Promise<void> {
  try {
    await deleteObject(bucket, key);
  } catch (err) {
    console.warn(
      `[storage] Falha ao deletar staging ${bucket}/${key}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

async function rejectUpload(
  prisma: Awaited<ReturnType<typeof importPrisma>>,
  uploadId: string,
  reason: string,
  details: Record<string, unknown>,
): Promise<void> {
  await prisma.upload.update({
    where: { id: uploadId },
    data: {
      status: "REJECTED",
      rejectionReason: reason,
      rejectionDetails: JSON.stringify(details),
      failedAt: new Date(),
    },
  });
  console.warn(`[storage] Upload ${uploadId} REJECTED: ${reason}`, details);
}

/** Helper: dynamic import do prisma (tipo inferido). */
type ImportPrisma = typeof import("~/db/prisma.server").prisma;
async function importPrisma(): Promise<ImportPrisma> {
  const mod = await import("~/db/prisma.server");
  return mod.prisma;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
