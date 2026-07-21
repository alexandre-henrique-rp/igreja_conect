/**
 * Service de Ministérios — Igreja Conect (S03-T04).
 *
 * CRUD de ministérios + relação N:N com membros via `MinisterioMembro`.
 *
 * **RBAC (camada 3):** `canManageMinisterios(user)` cobre
 * ADMIN, PASTOR, SECRETARIO. `assertCanManageMinisterios` lança
 * Response(403) para os outros perfis.
 *
 * **RN-MEM-04 (análoga para ministérios):** `deleteMinisterio` recusa
 * se há membros vinculados (count > 0). O schema tem
 * `onDelete: Cascade` em `MinisterioMembro.membro`, então deletar
 * com dependentes seria silencioso — capturamos antes para mensagem
 * semântica.
 *
 * **Unique constraint:** `Ministerio.nome` é `@unique` (P2002 no
 * `createMinisterio`/`updateMinisterio` → `NomeDuplicadoError`).
 * `MinisterioMembro.@@unique([membroId, ministerioId])` é o
 * `addMembroToMinisterio` duplicata → `ConflictError`.
 *
 * @see docs/REGRAS_DE_NEGOCIO.md
 */
import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { prisma } from "~/db/prisma.server";
import { assertCanManageMinisterios, canManageMinisterios } from "./rbac.server";
import { ConflictError, NomeDuplicadoError, NotFoundError } from "./errors";
import { logAction } from "./audit.server";
import type { SessionUser } from "./session.types";
import {
  MinisterioCreateSchema,
  MinisterioUpdateSchema,
  VincularMembroSchema,
  type MinisterioCreateInput,
  type MinisterioUpdateInput,
  type VincularMembroInput,
} from "./schemas/ministerios";

/** Re-export do helper boolean para a UI (camada 1 RBAC). */
export { canManageMinisterios };

/** Subset seguro de Ministerio para o cliente. */
export type MinisterioSafe = {
  id: string;
  nome: string;
  descricao: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Tipo da listagem com contagem e primeiros membros. */
export type MinisterioListItem = MinisterioSafe & {
  membrosCount: number;
  primeiros5membros: Array<{ id: string; nome: string }>;
};

/** Tipo re-exportado para PrismaClient. */
export type { PrismaClient };

/**
 * Lista todos os ministérios com contagem e primeiros 5 membros.
 * Visível para qualquer usuário autenticado (leitura ampla).
 *
 * @description SELECT com `_count` e primeiros 5 membros via orderBy.
 * @param {SessionUser} _user - Usuário autenticado (informativo; leitura é ampla).
 * @returns {Promise<MinisterioListItem[]>} Lista de ministérios.
 * @example
 *   const ministerios = await listMinisterios(user);
 *   // [{ id, nome, membrosCount, primeiros5membros: [...] }]
 */
export async function listMinisterios(
  _user: SessionUser
): Promise<MinisterioListItem[]> {
  const rows = await prisma.ministerio.findMany({
    orderBy: { nome: "asc" },
    include: {
      _count: { select: { membros: true } },
      membros: {
        take: 5,
        orderBy: { membro: { nome: "asc" } },
        select: { membro: { select: { id: true, nome: true } } },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    nome: r.nome,
    descricao: r.descricao,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    membrosCount: r._count.membros,
    primeiros5membros: r.membros.map((mm) => mm.membro),
  }));
}

/**
 * Cria um novo ministério. ADMIN, PASTOR ou SECRETARIO.
 *
 * @description INSERT com captura de P2002 (nome duplicado).
 * @param {MinisterioCreateInput} input - Dados validados.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<MinisterioSafe>} Ministério criado.
 * @throws {Response} 403 se não é gestor.
 * @throws {NomeDuplicadoError} 409 se nome já existe.
 * @example
 *   const min = await createMinisterio({ nome: "Louvor" }, adminUser);
 */
export async function createMinisterio(
  input: MinisterioCreateInput,
  user: SessionUser
): Promise<MinisterioSafe> {
  assertCanManageMinisterios(user);
  const validated = MinisterioCreateSchema.parse(input);
  try {
    const created = await prisma.ministerio.create({
      data: { nome: validated.nome, descricao: validated.descricao ?? null },
    });
    return created;
  } catch (e) {
    // IMPORTANTE: `return await` no update — aqui já é await direto.
    // Mas use duck-typing no `code` para sobreviver a `vi.resetModules()`.
    const err = e as { code?: string };
    if (err?.code === "P2002") {
      throw new NomeDuplicadoError("Já existe um ministério com este nome.");
    }
    throw e;
  }
}

/**
 * Atualiza um ministério. ADMIN, PASTOR ou SECRETARIO.
 *
 * @description UPDATE parcial com captura de P2002.
 * @param {string} id - UUID do ministério.
 * @param {MinisterioUpdateInput} input - Campos a atualizar.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<MinisterioSafe>} Ministério atualizado.
 * @throws {Response} 403 / 404 / 409 conforme o caso.
 * @example
 *   const updated = await updateMinisterio(id, { nome: "Louvor 2.0" }, adminUser);
 */
export async function updateMinisterio(
  id: string,
  input: MinisterioUpdateInput,
  user: SessionUser
): Promise<MinisterioSafe> {
  assertCanManageMinisterios(user);
  const validated = MinisterioUpdateSchema.parse(input);

  // Verifica existência (mensagem semântica)
  const existing = await prisma.ministerio.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw new NotFoundError("Ministério não encontrado.");
  }

  const data: Prisma.MinisterioUpdateInput = {};
  if (validated.nome !== undefined) data.nome = validated.nome;
  if (validated.descricao !== undefined) data.descricao = validated.descricao;

  try {
    // IMPORTANTE: `return await` (não `return prisma.update(...)`) —
    // sem o await, a rejeição async escapa do try/catch.
    return await prisma.ministerio.update({ where: { id }, data });
  } catch (e) {
    // Duck-typing no `code` em vez de `instanceof Prisma.PrismaClientKnownRequestError`
    // para sobreviver a `vi.resetModules()` nos testes (a classe importada
    // pode divergir entre o módulo do service e a do test).
    const err = e as { code?: string };
    if (err?.code === "P2002") {
      throw new NomeDuplicadoError("Já existe um ministério com este nome.");
    }
    throw e;
  }
}

/**
 * Exclui um ministério. ADMIN, PASTOR ou SECRETARIO.
 * Se há membros vinculados, lança `ConflictError(409)`.
 *
 * @description DELETE com checagem de dependentes.
 * @param {string} id - UUID do ministério.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<void>}
 * @throws {Response} 403 / 404 / 409 conforme o caso.
 * @example
 *   await deleteMinisterio(id, adminUser);
 */
export async function deleteMinisterio(
  id: string,
  user: SessionUser
): Promise<void> {
  assertCanManageMinisterios(user);

  const existing = await prisma.ministerio.findUnique({
    where: { id },
    select: { id: true, _count: { select: { membros: true } } },
  });
  if (!existing) {
    throw new NotFoundError("Ministério não encontrado.");
  }
  if (existing._count.membros > 0) {
    throw new ConflictError(
      "Desvincule os membros do ministério antes de excluí-lo."
    );
  }

  await prisma.ministerio.delete({ where: { id } });
}

/**
 * Vincula um membro a um ministério. ADMIN, PASTOR ou SECRETARIO.
 *
 * @description INSERT em `ministerio_membros` com captura de P2002.
 * @param {string} ministerioId - UUID do ministério.
 * @param {string} membroId - UUID do membro.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<{ ministerioId: string; membroId: string }>}
 * @throws {Response} 403 / 409 conforme o caso.
 * @example
 *   await addMembroToMinisterio(minId, mId, adminUser);
 */
export async function addMembroToMinisterio(
  ministerioId: string,
  membroId: string,
  user: SessionUser
): Promise<{ ministerioId: string; membroId: string }> {
  assertCanManageMinisterios(user);
  // Valida o membroId (ministerioId vem do path)
  VincularMembroSchema.parse({ membroId });

  try {
    const created = await prisma.ministerioMembro.create({
      data: { ministerioId, membroId },
    });
    return { ministerioId: created.ministerioId, membroId: created.membroId };
  } catch (e) {
    // IMPORTANTE: `return await` (já é await direto).
    // Duck-typing no `code` (ver nota em updateMinisterio).
    const err = e as { code?: string };
    if (err?.code === "P2002") {
      throw new ConflictError("Membro já vinculado a este ministério.");
    }
    throw e;
  }
}

/**
 * Desvincula um membro de um ministério. ADMIN, PASTOR ou SECRETARIO.
 * No-op se não estava vinculado.
 *
 * @description DELETE com silenciosa tolerância a "não encontrado".
 * @param {string} ministerioId - UUID do ministério.
 * @param {string} membroId - UUID do membro.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<void>}
 * @throws {Response} 403 se não é gestor.
 * @example
 *   await removeMembroFromMinisterio(minId, mId, adminUser);
 */
export async function removeMembroFromMinisterio(
  ministerioId: string,
  membroId: string,
  user: SessionUser
): Promise<void> {
  assertCanManageMinisterios(user);
  // deleteMany não lança se nada bateu (idempotente).
  await prisma.ministerioMembro.deleteMany({
    where: { ministerioId, membroId },
  });
}

/**
 * Alterna a flag `lider` de um membro em um ministério (true ↔ false).
 *
 * @description UPDATE em `ministerio_membros.lider` + log de auditoria.
 * @param {string} ministerioId - UUID do ministério.
 * @param {string} membroId - UUID do membro.
 * @param {SessionUser} user - Usuário autenticado.
 * @throws {Response} 403 se não é gestor.
 * @throws {NotFoundError} 404 se o vínculo não existe.
 */
export async function toggleLiderMinisterio(
  ministerioId: string,
  membroId: string,
  user: SessionUser
): Promise<void> {
  assertCanManageMinisterios(user);

  const vinculo = await prisma.ministerioMembro.findUnique({
    where: { membroId_ministerioId: { membroId, ministerioId } },
  });
  if (!vinculo) {
    throw new NotFoundError("Membro não vinculado a este ministério.");
  }

  await prisma.ministerioMembro.update({
    where: { membroId_ministerioId: { membroId, ministerioId } },
    data: { lider: !vinculo.lider },
  });

  await logAction({
    membroId,
    event: "ministerio.toggle_lider",
    actorId: user.id,
    actorRole: user.cargo,
    details: JSON.stringify({
      ministerioId,
      novoValor: !vinculo.lider,
    }),
  });
}
