/**
 * Service de Cultos — Igreja Conect (S04-T03).
 *
 * **Operações de domínio (server-only):**
 *  - `listarCultos` — listagem com filtros e ordenação
 *  - `buscarCulto` — leitura individual
 *  - `criarCulto` — criação de novo culto
 *  - `editarCulto` — atualização parcial
 *  - `excluirCulto` — exclusão lógica via status CANCELADO
 *
 * **RBAC:**
 *  - ADMIN/PASTOR: CRUD completo
 *  - SECRETARIO/DISCIPULADOR/FINANCEIRO/LIDER_MINISTERIO: leitura apenas
 *  - Usuários sem cargo: bloqueados (cargo !== null)
 */
import { prisma } from "~/db/prisma.server";
import { NotFoundError, BusinessRuleError } from "./errors";
import type { SessionUser } from "./session.types";
import type { Culto, TipoCulto, StatusCulto } from "../../generated/prisma/client";

export type { Culto, TipoCulto, StatusCulto };

/** Input para criar culto. */
export type CriarCultoInput = {
  titulo: string;
  descricao?: string;
  tipo: TipoCulto;
  status?: StatusCulto;
  data: string;
  horario: string;
  local?: string;
  preletor?: string;
};

/** Input para editar culto (parcial). */
export type EditarCultoInput = Partial<CriarCultoInput>;

const CARGO_LEITURA = ["ADMIN", "PASTOR", "SECRETARIO", "FINANCEIRO", "LIDER_MINISTERIO"] as const;
const CARGO_ESCRITA = ["ADMIN", "PASTOR"] as const;

function assertPodeLer(user: SessionUser): void {
  if (!user.cargo || !(CARGO_LEITURA as readonly string[]).includes(user.cargo)) {
    throw new Response("Acesso restrito a usuários com cargo administrativo.", { status: 403 });
  }
}

function assertPodeEscrever(user: SessionUser): void {
  if (!user.cargo || !(CARGO_ESCRITA as readonly string[]).includes(user.cargo)) {
    throw new Response("Apenas ADMIN ou PASTOR podem gerenciar cultos.", { status: 403 });
  }
}

/**
 * Lista cultos com ordenação por data decrescente.
 *
 * @description SELECT em `cultos` com filtros opcionais por status e tipo.
 * @param {SessionUser} user - Usuário autenticado.
 * @param {{ status?: StatusCulto; tipo?: TipoCulto }} [filtros] - Filtros opcionais.
 * @returns {Promise<Culto[]>} Lista de cultos.
 * @throws {Response} 403 se usuário sem cargo administrativo.
 * @example
 *   const cultos = await listarCultos(user, { status: "AGENDADO" });
 */
export async function listarCultos(
  user: SessionUser,
  filtros?: { status?: StatusCulto; tipo?: TipoCulto }
): Promise<Culto[]> {
  assertPodeLer(user);

  const where: Record<string, unknown> = {};
  if (filtros?.status) where.status = filtros.status;
  if (filtros?.tipo) where.tipo = filtros.tipo;

  return prisma.culto.findMany({
    where,
    orderBy: { data: "desc" },
  });
}

/**
 * Busca um culto pelo ID.
 *
 * @description SELECT único em `cultos` por ID.
 * @param {string} id - UUID do culto.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<Culto>} Culto encontrado.
 * @throws {Response} 403 se usuário sem cargo administrativo.
 * @throws {NotFoundError} 404 se culto não existe.
 * @example
 *   const culto = await buscarCulto(id, user);
 */
export async function buscarCulto(id: string, user: SessionUser): Promise<Culto> {
  assertPodeLer(user);

  const culto = await prisma.culto.findUnique({ where: { id } });
  if (!culto) {
    throw new NotFoundError("Culto não encontrado.");
  }
  return culto;
}

/**
 * Cria um novo culto.
 *
 * @description INSERT em `cultos` com `createdById` vinculado ao usuário.
 * @param {CriarCultoInput} input - Dados do culto.
 * @param {SessionUser} user - Usuário autenticado (ADMIN/PASTOR).
 * @returns {Promise<Culto>} Culto criado.
 * @throws {Response} 403 se não tem permissão de escrita.
 * @example
 *   const culto = await criarCulto({
 *     titulo: "Culto de Domingo",
 *     tipo: "PRESENCIAL",
 *     data: "2025-01-05T09:00:00Z",
 *     horario: "09:00",
 *   }, user);
 */
export async function criarCulto(input: CriarCultoInput, user: SessionUser): Promise<Culto> {
  assertPodeEscrever(user);

  return prisma.culto.create({
    data: {
      titulo: input.titulo,
      descricao: input.descricao ?? null,
      tipo: input.tipo,
      status: input.status ?? "AGENDADO",
      data: new Date(input.data),
      horario: input.horario,
      local: input.local ?? null,
      preletor: input.preletor ?? null,
      createdById: user.id,
    },
  });
}

/**
 * Edita um culto existente (parcial).
 *
 * @description UPDATE em `cultos` com campos opcionais.
 * @param {string} id - UUID do culto.
 * @param {EditarCultoInput} input - Campos a atualizar.
 * @param {SessionUser} user - Usuário autenticado (ADMIN/PASTOR).
 * @returns {Promise<Culto>} Culto atualizado.
 * @throws {Response} 403 se não tem permissão de escrita.
 * @throws {NotFoundError} 404 se culto não existe.
 * @example
 *   const atualizado = await editarCulto(id, { titulo: "Novo Título" }, user);
 */
export async function editarCulto(id: string, input: EditarCultoInput, user: SessionUser): Promise<Culto> {
  assertPodeEscrever(user);
  await buscarCulto(id, user);

  const data: Record<string, unknown> = {};
  if (input.titulo !== undefined) data.titulo = input.titulo;
  if (input.descricao !== undefined) data.descricao = input.descricao;
  if (input.tipo !== undefined) data.tipo = input.tipo;
  if (input.status !== undefined) data.status = input.status;
  if (input.data !== undefined) data.data = new Date(input.data);
  if (input.horario !== undefined) data.horario = input.horario;
  if (input.local !== undefined) data.local = input.local;
  if (input.preletor !== undefined) data.preletor = input.preletor;

  return prisma.culto.update({ where: { id }, data });
}

/**
 * Exclui um culto (apenas ADMIN/PASTOR).
 *
 * Cultos com status REALIZADO não podem ser excluídos —
 * devem ser cancelados via `editarCulto`.
 *
 * @description DELETE em `cultos` com validação de status.
 * @param {string} id - UUID do culto.
 * @param {SessionUser} user - Usuário autenticado (ADMIN/PASTOR).
 * @returns {Promise<void>}
 * @throws {Response} 403 se não tem permissão de escrita.
 * @throws {NotFoundError} 404 se culto não existe.
 * @throws {BusinessRuleError} 422 se culto já foi realizado.
 * @example
 *   await excluirCulto(id, adminUser);
 */
export async function excluirCulto(id: string, user: SessionUser): Promise<void> {
  assertPodeEscrever(user);
  const culto = await buscarCulto(id, user);

  if (culto.status === "REALIZADO") {
    throw new BusinessRuleError("Cultos realizados não podem ser excluídos. Altere o status para CANCELADO.");
  }

  await prisma.culto.delete({ where: { id } });
}
