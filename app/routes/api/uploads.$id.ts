/**
 * GET /api/uploads/:id — status + signed URLs (apenas quando READY).
 *
 * **Padrão (training/object-storage-standard.md §7.2):**
 * - PROCESSING → 202 com `{ status: "PROCESSING" }`
 * - REJECTED → 410 com `{ status, reason, details }`
 * - READY → 200 com URLs assinadas (preview lg/md/sm + download)
 * - FAILED → 500 com `{ status, lastError }`
 */
import type { Route } from "./+types/uploads.$id";
import { data } from "react-router";
import { getUserFromRequest } from "~/lib/session.server";
import { prisma } from "~/db/prisma.server";
import { getSignedDownloadUrl, getSignedPreviewUrl } from "~/lib/storage/signed-url.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return data({ error: "unauthorized" }, { status: 401 });
  }

  const upload = await prisma.upload.findUnique({
    where: { id: params.id },
  });

  if (!upload) {
    return data({ error: "not_found" }, { status: 404 });
  }

  // RBAC: dono pode ver; ADMIN/PASTOR/SECRETARIO podem ver qualquer
  const isOwner = upload.userId === user.id;
  const isPrivileged =
    user.cargo === "ADMIN" || user.cargo === "PASTOR" || user.cargo === "SECRETARIO";

  if (!isOwner && !isPrivileged) {
    return data({ error: "forbidden" }, { status: 403 });
  }

  // Soft-delete (LGPD): retorna 410 se foi deletado
  if (upload.deletedAt) {
    return data({ error: "deleted", deletedAt: upload.deletedAt }, { status: 410 });
  }

  // === Status não-terminal: retorna status sem URLs ===
  if (upload.status === "PROCESSING" || upload.status === "SCANNING" || upload.status === "TRANSCODING") {
    return data(
      {
        uploadId: upload.id,
        status: upload.status,
        statusUrl: `/api/uploads/${upload.id}`,
      },
      { status: 202 },
    );
  }

  // === Rejeitado: motivo + detalhes ===
  if (upload.status === "REJECTED") {
    return data(
      {
        uploadId: upload.id,
        status: "REJECTED",
        reason: upload.rejectionReason,
        details: upload.rejectionDetails ? JSON.parse(upload.rejectionDetails) : null,
      },
      { status: 410 },
    );
  }

  // === Falhou ===
  if (upload.status === "FAILED") {
    return data(
      {
        uploadId: upload.id,
        status: "FAILED",
        reason: upload.rejectionReason,
        details: upload.rejectionDetails ? JSON.parse(upload.rejectionDetails) : null,
      },
      { status: 500 },
    );
  }

  // === READY: retorna URLs assinadas ===
  if (upload.status === "READY") {
    const ext = upload.ext ?? "";
    const baseKey = `${upload.storageKeyPrefix}${ext}`;

    // Sempre gerar signed URL — com storage local não existe "URL pública"
    // (todos os arquivos passam por /api/files/:bucket/* com token HMAC).
    const preview = await getSignedPreviewUrl({ bucket: upload.bucket, key: baseKey });

    const download = await getSignedDownloadUrl({
      bucket: upload.bucket,
      key: baseKey,
      filename: upload.originalFilename,
    });

    // Variants (lg/md/sm para imagens/vídeos/áudios; null para documentos)
    const variantList = upload.variants ? JSON.parse(upload.variants) as string[] : [];
    const variantUrls: Record<string, string> = {};
    // Extensão do variant: vídeo sempre .mp4, áudio sempre .m4a, imagem = ext original
    const variantExt = upload.kind === "video" ? ".mp4" : upload.kind === "audio" ? ".m4a" : ext;
    for (const v of variantList) {
      const vKey = `${v}/${upload.storageKeyPrefix}${variantExt}`;
      variantUrls[v] = await getSignedPreviewUrl({ bucket: upload.bucket, key: vKey });
    }

    return data({
      uploadId: upload.id,
      status: "READY",
      kind: upload.kind,
      isPublic: upload.isPublic,
      metadata: {
        originalFilename: upload.originalFilename,
        sizeBytes: upload.sizeBytes,
        declaredMime: upload.declaredMime,
        detectedMime: upload.detectedMime,
        sha256: upload.sha256,
        createdAt: upload.createdAt,
        processedAt: upload.processedAt,
      },
      urls: {
        preview,
        download,
        variants: Object.keys(variantUrls).length > 0 ? variantUrls : undefined,
      },
      storageKey: baseKey,
      bucket: upload.bucket,
    });
  }

  // Status desconhecido — fallback seguro
  return data(
    {
      uploadId: upload.id,
      status: upload.status,
    },
    { status: 200 },
  );
}
