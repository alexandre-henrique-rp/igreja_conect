/**
 * POST /api/lancamentos/:id/anexo — vincula um Upload a um lançamento como
 * comprovante (NF, recibo, cupom). **1:1** — vincular novo apaga o antigo.
 *
 * **Fluxo:**
 * 1. ComprovanteUpload component faz upload → recebe `uploadId` (PROCESSING)
 * 2. Quando polling retorna READY, este endpoint é chamado com `{ uploadId }`
 * 3. Valida ownership RBAC, soft-deleta comprovante antigo (LGPD), vincula novo
 * 4. Retorna 200 com `{ ok, lancamentoId, uploadId }`
 */
import type { Route } from "./+types/lancamentos.$id.anexo";
import { data } from "react-router";
import { getUserFromRequest } from "~/lib/session.server";
import { prisma } from "~/db/prisma.server";
import { deleteObject } from "~/lib/storage/upload.server";

export async function action({ params, request }: Route.ActionArgs) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return data({ error: "unauthorized" }, { status: 401 });
  }

  // RBAC: mesmo do Lancamento (ADMIN, PASTOR, FINANCEIRO, SECRETARIO)
  const allowedRoles = ["ADMIN", "PASTOR", "FINANCEIRO", "SECRETARIO"];
  if (!user.cargo || !allowedRoles.includes(user.cargo)) {
    return data({ error: "forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const uploadId = formData.get("uploadId");
  if (typeof uploadId !== "string" || !uploadId) {
    return data({ error: "uploadId_required" }, { status: 400 });
  }

  // Upload existe e está READY?
  const upload = await prisma.upload.findUnique({ where: { id: uploadId } });
  if (!upload) {
    return data({ error: "upload_not_found" }, { status: 404 });
  }
  if (upload.status !== "READY") {
    return data({ error: "upload_not_ready", status: upload.status }, { status: 409 });
  }

  // Lançamento existe?
  const lancamento = await prisma.lancamento.findUnique({
    where: { id: params.id },
    select: { id: true, attachmentUploadId: true },
  });
  if (!lancamento) {
    return data({ error: "lancamento_not_found" }, { status: 404 });
  }

  // Soft-delete do anexo antigo (se houver)
  const oldUploadId = lancamento.attachmentUploadId;
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
            reason: "replaced_by_new_comprovante",
            newUploadId: uploadId,
            contextType: "lancamento.comprovante",
          }),
        },
      });
    }
  }

  // Vincula novo anexo
  await prisma.lancamento.update({
    where: { id: params.id },
    data: { attachmentUploadId: uploadId },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      event: "upload.linked",
      actorId: user.id,
      actorRole: user.cargo,
      details: JSON.stringify({
        uploadId,
        contextType: "lancamento.comprovante",
        contextId: params.id,
        replacedOldUploadId: oldUploadId ?? null,
      }),
    },
  });

  return data({
    ok: true,
    lancamentoId: params.id,
    uploadId,
  });
}

export async function loader() {
  return data({ error: "method_not_allowed" }, { status: 405 });
}
