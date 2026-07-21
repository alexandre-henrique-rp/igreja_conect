/**
 * POST /api/membros/:id/avatar — vincula um Upload ao membro como avatar.
 *
 * **Fluxo:**
 * 1. AvatarUpload component faz upload → recebe `uploadId` (status=PROCESSING)
 * 2. Quando polling retorna READY, este endpoint é chamado com `{ uploadId }`
 * 3. Valida ownership, soft-deleta avatar antigo (LGPD), vincula novo
 * 4. Retorna 200 com `{ ok: true, membroId, uploadId }`
 *
 * **Por que não no action do form de edição?**
 * O upload acontece ANTES do submit do form. Vincular aqui desacopla
 * a UI (que faz polling) do submit do form (que persiste outros campos).
 */
import type { Route } from "./+types/membros.$id.avatar";
import { data } from "react-router";
import { getUserFromRequest } from "~/lib/session.server";
import { prisma } from "~/db/prisma.server";
import { deleteObject } from "~/lib/storage/upload.server";

export async function action({ params, request }: Route.ActionArgs) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return data({ error: "unauthorized" }, { status: 401 });
  }

  const allowedRoles = ["ADMIN", "PASTOR", "SECRETARIO"];
  if (!user.cargo || !allowedRoles.includes(user.cargo)) {
    return data({ error: "forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const uploadId = formData.get("uploadId");
  if (typeof uploadId !== "string" || !uploadId) {
    return data({ error: "uploadId_required" }, { status: 400 });
  }

  // Verifica que o Upload existe e está READY
  const upload = await prisma.upload.findUnique({ where: { id: uploadId } });
  if (!upload) {
    return data({ error: "upload_not_found" }, { status: 404 });
  }
  if (upload.status !== "READY") {
    return data(
      {
        error: "upload_not_ready",
        status: upload.status,
      },
      { status: 409 },
    );
  }

  // Verifica que o membro existe
  const membro = await prisma.membro.findUnique({
    where: { id: params.id },
    select: { id: true, avatarUploadId: true },
  });
  if (!membro) {
    return data({ error: "membro_not_found" }, { status: 404 });
  }

  // Soft-delete do avatar antigo (se houver) — LGPD art. 18, VI
  const oldUploadId = membro.avatarUploadId;
  if (oldUploadId && oldUploadId !== uploadId) {
    const oldUpload = await prisma.upload.findUnique({
      where: { id: oldUploadId },
    });
    if (oldUpload && !oldUpload.deletedAt) {
      await prisma.upload.update({
        where: { id: oldUploadId },
        data: {
          deletedAt: new Date(),
          retentionUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      // Hard delete do arquivo no Garage (best-effort — soft-delete no DB já garante LGPD)
      if (oldUpload.bucket && oldUpload.ext) {
        const oldKey = `${oldUpload.storageKeyPrefix}${oldUpload.ext}`;
        await deleteObject(oldUpload.bucket, oldKey).catch(() => {});
      }
      await prisma.auditLog.create({
        data: {
          event: "upload.deleted",
          actorId: user.id,
          actorRole: user.cargo,
          details: JSON.stringify({
            uploadId: oldUploadId,
            reason: "replaced_by_new_avatar",
            newUploadId: uploadId,
          }),
        },
      });
    }
  }

  // Vincula novo avatar
  await prisma.membro.update({
    where: { id: params.id },
    data: { avatarUploadId: uploadId },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      event: "upload.linked",
      actorId: user.id,
      actorRole: user.cargo,
      details: JSON.stringify({
        uploadId,
        contextType: "membro.avatar",
        contextId: params.id,
        replacedOldUploadId: oldUploadId ?? null,
      }),
    },
  });

  return data({
    ok: true,
    membroId: params.id,
    uploadId,
  });
}

export async function loader() {
  return data({ error: "method_not_allowed" }, { status: 405 });
}
