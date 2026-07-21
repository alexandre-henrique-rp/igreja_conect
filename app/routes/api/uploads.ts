/**
 * POST /api/uploads — endpoint de upload (multipart/form-data).
 *
 * **Padrão (training/object-storage-standard.md §3):**
 * - Recebe multipart (file + kind + contextId + contextType + isPublic + metadata)
 * - Validações cheap ANTES de processar (fail fast):
 *   1. Auth (user autenticado)
 *   2. Kind válido
 *   3. Size ≤ max[kind]
 *   4. Size > 0
 * - Salva no bucket **staging** via streaming (PutObject)
 * - Persiste metadata no DB (status=PROCESSING)
 * - Enfileira job `media.process` (worker processa async)
 * - Retorna **202 Accepted** com `jobId` (= uploadId)
 *
 * **Garage-specific:** PutObject direto (sem SSE/versioning).
 * Multipart upload (Upload lib) usado internamente pra arquivos >5MB.
 */
import type { Route } from "./+types/uploads";
import { data } from "react-router";
import { createHash } from "node:crypto";
import { getUserFromRequest } from "~/lib/session.server";
import { prisma } from "~/db/prisma.server";
import { STORAGE_CONFIG, type StorageKind } from "~/lib/storage/config.server";
import { uploadObject } from "~/lib/storage/upload.server";
import { enqueue, QUEUES } from "~/lib/storage/jobs.server";

const ALLOWED_KINDS: StorageKind[] = ["image", "video", "audio", "document"];

export async function action({ request }: Route.ActionArgs) {
  // API routes ficam FORA do middleware /app/**, então lemos a session direto.
  const user = await getUserFromRequest(request);
  if (!user) {
    return data({ error: "unauthorized" }, { status: 401 });
  }

  // RBAC: apenas ADMIN/PASTOR/SECRETARIO podem subir arquivos
  const allowedRoles = ["ADMIN", "PASTOR", "SECRETARIO"];
  if (!user.cargo || !allowedRoles.includes(user.cargo)) {
    return data({ error: "forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = formData.get("kind");
  const contextId = formData.get("contextId");
  const contextType = formData.get("contextType");
  const isPublicRaw = formData.get("isPublic");
  const metadataRaw = formData.get("metadata");

  // === Validações cheap (fail fast) ===
  if (!(file instanceof File)) {
    return data({ error: "file_required" }, { status: 400 });
  }

  if (typeof kind !== "string" || !ALLOWED_KINDS.includes(kind as StorageKind)) {
    return data({ error: "invalid_kind", allowed: ALLOWED_KINDS }, { status: 400 });
  }

  const fileSize = file.size;
  const maxSize = STORAGE_CONFIG.maxSize[kind as StorageKind];
  if (fileSize === 0) {
    return data({ error: "empty_file" }, { status: 400 });
  }
  if (fileSize > maxSize) {
    return data(
      {
        error: "file_too_large",
        sizeBytes: fileSize,
        maxBytes: maxSize,
      },
      { status: 413 },
    );
  }

  // Parse metadata opcional (JSON string)
  let metadata: Record<string, unknown> | null = null;
  if (typeof metadataRaw === "string" && metadataRaw.length > 0) {
    try {
      metadata = JSON.parse(metadataRaw);
    } catch {
      return data({ error: "invalid_metadata_json" }, { status: 400 });
    }
  }

  // === Ler buffer e calcular SHA-256 para dedup ===
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  // === Dedup: se já existe um upload READY com mesmo sha256+kind, reutiliza ===
  const existing = await prisma.upload.findFirst({
    where: {
      sha256,
      kind,
      status: "READY",
      deletedAt: null,
    },
  });
  if (existing) {
    await prisma.auditLog.create({
      data: {
        event: "upload.deduped",
        actorId: user.id,
        actorRole: user.cargo,
        details: JSON.stringify({
          uploadId: existing.id,
          originalFilename: file.name,
          contextId,
          contextType,
        }),
      },
    });
    return data(
      {
        uploadId: existing.id,
        status: "READY",
        deduped: true,
        statusUrl: `/api/uploads/${existing.id}`,
      },
      { status: 200 },
    );
  }

  // === Persistir metadata ANTES de subir ===
  const uploadId = crypto.randomUUID();
  const storageKeyPrefix = sha256;

  await prisma.upload.create({
    data: {
      id: uploadId,
      userId: user.id,
      kind,
      contextId: typeof contextId === "string" ? contextId : null,
      contextType: typeof contextType === "string" ? contextType : null,
      isPublic: isPublicRaw === "true" || isPublicRaw === "1",
      originalFilename: file.name,
      declaredMime: file.type || "application/octet-stream",
      sizeBytes: fileSize,
      sha256,
      bucket: STORAGE_CONFIG.buckets.staging,
      storageKeyPrefix,
      // isPii heuristic: avatars e documentos pessoais são PII
      isPii:
        (typeof contextType === "string" && contextType.includes("avatar")) ||
        kind === "document",
    },
  });

  // === Upload pro staging (streaming via PutObject — small files) ===
  const stagingKey = `${storageKeyPrefix}/original`;

  try {
    await uploadObject({
      bucket: STORAGE_CONFIG.buckets.staging,
      key: stagingKey,
      body: buffer,
      contentType: file.type || "application/octet-stream",
      metadata: {
        "upload-id": uploadId,
        "user-id": user.id,
        "kind": kind,
      },
    });
  } catch (err) {
    const errorDetails = {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      name: err instanceof Error ? err.name : undefined,
      bucket: STORAGE_CONFIG.buckets.staging,
      endpoint: STORAGE_CONFIG.endpoint,
      key: stagingKey,
    };
    console.error("[upload] staging_upload_failed:", errorDetails);
    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        status: "FAILED",
        rejectionReason: "staging_upload_failed",
        rejectionDetails: JSON.stringify(errorDetails),
        failedAt: new Date(),
      },
    });
    return data(
      {
        error: "staging_upload_failed",
        details:
          process.env.NODE_ENV === "production"
            ? undefined
            : errorDetails,
      },
      { status: 500 },
    );
  }

  // === Enqueue worker async ===
  await enqueue(QUEUES.MEDIA_PROCESS, {
    uploadId,
    stagingBucket: STORAGE_CONFIG.buckets.staging,
    stagingKey,
    kind,
    declaredMime: file.type || "application/octet-stream",
    sizeBytes: fileSize,
  });

  // === Audit log ===
  await prisma.auditLog.create({
    data: {
      event: "upload.requested",
      actorId: user.id,
      actorRole: user.cargo,
      details: JSON.stringify({
        uploadId,
        sizeBytes: fileSize,
        kind,
        contextId,
        contextType,
        metadata,
      }),
    },
  });

  // === Retornar 202 ===
  return data(
    {
      uploadId,
      status: "PROCESSING",
      statusUrl: `/api/uploads/${uploadId}`,
      // NÃO retorna URLs ainda — variants/ready não estão prontos
    },
    { status: 202 },
  );
}

/**
 * Loader bloqueado (uploads só via POST multipart).
 */
export async function loader() {
  return data({ error: "method_not_allowed" }, { status: 405 });
}
