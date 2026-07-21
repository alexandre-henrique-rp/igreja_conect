/**
 * DELETE /api/uploads/:id — soft delete (LGPD art. 18, VI).
 *
 * **Padrão (training/object-storage-standard.md §6.3):**
 * 1. Soft delete: marca `deletedAt` no DB
 * 2. Mover pra quarentena (30d) — TODO
 * 3. Após 30d, hard delete via lifecycle policy
 * 4. Audit log
 *
 * Por enquanto: só soft delete + audit log. Hard delete é tarefa do
 * worker de cleanup (cron-like).
 */
import type { Route } from "./+types/uploads.$id.delete";
import { data } from "react-router";
import { getUserFromRequest } from "~/lib/session.server";
import { prisma } from "~/db/prisma.server";

export async function action({ params, request }: Route.ActionArgs) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return data({ error: "unauthorized" }, { status: 401 });
  }

  const upload = await prisma.upload.findUnique({ where: { id: params.id } });
  if (!upload) {
    return data({ error: "not_found" }, { status: 404 });
  }

  // RBAC: dono OU ADMIN
  const isOwner = upload.userId === user.id;
  const isAdmin = user.cargo === "ADMIN";
  if (!isOwner && !isAdmin) {
    return data({ error: "forbidden" }, { status: 403 });
  }

  // Já deletado?
  if (upload.deletedAt) {
    return data({ uploadId: upload.id, status: "already_deleted" });
  }

  // Soft delete
  await prisma.upload.update({
    where: { id: params.id },
    data: {
      deletedAt: new Date(),
      // retentionUntil = 30 dias após soft delete (LGPD janela de arrependimento)
      retentionUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      event: "upload.deleted",
      actorId: user.id,
      actorRole: user.cargo,
      details: JSON.stringify({
        uploadId: upload.id,
        isOwner,
        retentionDays: 30,
      }),
    },
  });

  // Se o membro está usando este avatar, desvincular
  if (upload.contextType === "membro.avatar") {
    await prisma.membro.updateMany({
      where: { avatarUploadId: upload.id },
      data: { avatarUploadId: null },
    });
  }

  return data({
    uploadId: upload.id,
    status: "deleted",
    deletedAt: new Date().toISOString(),
    retentionUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
}

export async function loader() {
  return data({ error: "method_not_allowed" }, { status: 405 });
}
