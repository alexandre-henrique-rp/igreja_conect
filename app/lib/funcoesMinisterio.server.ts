import { prisma } from "~/db/prisma.server";
import { assertCanManageMinisterios } from "./rbac.server";
import { ConflictError, NotFoundError } from "./errors";
import { logAction } from "./audit.server";
import type { SessionUser } from "./session.types";
import { CriarFuncaoSchema, AtribuirFuncaoSchema } from "./schemas/funcoes";

export async function listarFuncoes(ministerioId: string) {
  return prisma.funcaoMinisterio.findMany({
    where: { ministerioId },
    orderBy: { nome: "asc" },
  });
}

export async function criarFuncao(
  ministerioId: string,
  input: unknown,
  user: SessionUser,
) {
  assertCanManageMinisterios(user);
  const parsed = CriarFuncaoSchema.parse(input);

  try {
    const funcao = await prisma.funcaoMinisterio.create({
      data: {
        ministerioId,
        nome: parsed.nome,
        cor: parsed.cor ?? null,
      },
    });
    await logAction({
      membroId: user.id,
      event: "funcao_ministerio.create",
      actorId: user.id,
      actorRole: user.cargo,
      details: JSON.stringify({ ministerioId, funcaoId: funcao.id, nome: parsed.nome }),
    });
    return funcao;
  } catch (e) {
    const err = e as { code?: string };
    if (err?.code === "P2002") {
      throw new ConflictError("Já existe uma função com este nome neste ministério.");
    }
    throw e;
  }
}

export async function removerFuncao(id: string, user: SessionUser) {
  assertCanManageMinisterios(user);

  const funcao = await prisma.funcaoMinisterio.findUnique({
    where: { id },
    select: { id: true, ministerioId: true },
  });
  if (!funcao) {
    throw new NotFoundError("Função não encontrada.");
  }

  await prisma.funcaoMinisterio.delete({ where: { id } });
  await logAction({
    membroId: user.id,
    event: "funcao_ministerio.delete",
    actorId: user.id,
    actorRole: user.cargo,
    details: JSON.stringify({ funcaoId: id, ministerioId: funcao.ministerioId }),
  });
}

export async function atribuirFuncaoMembro(
  input: unknown,
  user: SessionUser,
) {
  assertCanManageMinisterios(user);
  const parsed = AtribuirFuncaoSchema.parse(input);

  const vinculo = await prisma.ministerioMembro.findUnique({
    where: { id: parsed.vinculoId },
    select: { id: true, ministerioId: true },
  });
  if (!vinculo) {
    throw new NotFoundError("Vínculo não encontrado.");
  }

  await prisma.ministerioMembro.update({
    where: { id: parsed.vinculoId },
    data: { funcaoId: parsed.funcaoId ?? null },
  });

  await logAction({
    membroId: user.id,
    event: "funcao_ministerio.atribuir",
    actorId: user.id,
    actorRole: user.cargo,
    details: JSON.stringify({ vinculoId: parsed.vinculoId, funcaoId: parsed.funcaoId }),
  });
}
