/**
 * Service de Eventos — Igreja Conect (S04-T03).
 *
 * **Operações de domínio (server-only):**
 *  - `listarEventos` — listagem com filtros por status e tipo
 *  - `buscarEvento` — leitura individual com responsável
 *  - `criarEvento` — criação de novo evento
 *  - `editarEvento` — atualização parcial
 *  - `excluirEvento` — exclusão com validação de status
 *
 * **RBAC:**
 *  - ADMIN/PASTOR: CRUD completo
 *  - SECRETARIO: criar, editar, listar, ler
 *  - Demais cargos: leitura apenas
 */
import { prisma } from "~/db/prisma.server";
import { NotFoundError, BusinessRuleError } from "./errors";
import type { SessionUser } from "./session.types";
import type { Evento, TipoEvento, StatusEvento } from "../../generated/prisma/client";

export type { Evento, TipoEvento, StatusEvento };

/** Input para criar evento. */
export type CriarEventoInput = {
  titulo: string;
  descricao?: string;
  tipo: TipoEvento;
  status?: StatusEvento;
  dataInicio: string;
  dataFim?: string;
  local?: string;
  responsavelId?: string;
};

/** Input para editar evento (parcial). */
export type EditarEventoInput = Partial<CriarEventoInput>;

/** Filtros de listagem. */
export type ListarEventosFiltros = {
  status?: StatusEvento;
  tipo?: TipoEvento;
};

/** Evento com dados do responsável. */
export type EventoComResponsavel = Evento & {
  responsavel: { id: string; nome: string } | null;
};

const CARGO_LEITURA = ["ADMIN", "PASTOR", "SECRETARIO", "DISCIPULADOR", "FINANCEIRO", "LIDER_MINISTERIO"] as const;
const CARGO_ESCRITA = ["ADMIN", "PASTOR", "SECRETARIO"] as const;

function assertPodeLer(user: SessionUser): void {
  if (!user.cargo || !(CARGO_LEITURA as readonly string[]).includes(user.cargo)) {
    throw new Response("Acesso restrito a usuários com cargo administrativo.", { status: 403 });
  }
}

function assertPodeEscrever(user: SessionUser): void {
  if (!user.cargo || !(CARGO_ESCRITA as readonly string[]).includes(user.cargo)) {
    throw new Response("Apenas ADMIN, PASTOR ou SECRETARIO podem gerenciar eventos.", { status: 403 });
  }
}

/**
 * Lista eventos com filtros opcionais.
 *
 * @description SELECT em `eventos` com filtro por status e/ou tipo.
 * @param {SessionUser} user - Usuário autenticado.
 * @param {ListarEventosFiltros} [filtros] - Filtros opcionais (status, tipo).
 * @returns {Promise<EventoComResponsavel[]>} Lista de eventos.
 * @throws {Response} 403 se usuário sem cargo administrativo.
 * @example
 *   const eventos = await listarEventos(user, { status: "PUBLICADO" });
 */
export async function listarEventos(
  user: SessionUser,
  filtros?: ListarEventosFiltros
): Promise<EventoComResponsavel[]> {
  assertPodeLer(user);

  const where: Record<string, unknown> = {};
  if (filtros?.status) where.status = filtros.status;
  if (filtros?.tipo) where.tipo = filtros.tipo;

  return prisma.evento.findMany({
    where,
    include: { responsavel: { select: { id: true, nome: true } } },
    orderBy: { dataInicio: "desc" },
  });
}

/**
 * Busca um evento pelo ID.
 *
 * @description SELECT único em `eventos` com responsável.
 * @param {string} id - UUID do evento.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<EventoComResponsavel>} Evento encontrado.
 * @throws {Response} 403 se usuário sem cargo administrativo.
 * @throws {NotFoundError} 404 se evento não existe.
 * @example
 *   const evento = await buscarEvento(id, user);
 */
export async function buscarEvento(id: string, user: SessionUser): Promise<EventoComResponsavel> {
  assertPodeLer(user);

  const evento = await prisma.evento.findUnique({
    where: { id },
    include: { responsavel: { select: { id: true, nome: true } } },
  });

  if (!evento) {
    throw new NotFoundError("Evento não encontrado.");
  }

  return evento;
}

/**
 * Cria um novo evento.
 *
 * @description INSERT em `eventos` com createdById.
 * @param {CriarEventoInput} input - Dados do evento.
 * @param {SessionUser} user - Usuário autenticado (ADMIN/PASTOR/SECRETARIO).
 * @returns {Promise<EventoComResponsavel>} Evento criado.
 * @throws {Response} 403 se não tem permissão de escrita.
 * @throws {NotFoundError} 404 se responsável informado não existe.
 * @example
 *   const evento = await criarEvento({
 *     titulo: "Conferência",
 *     tipo: "ESPECIAL",
 *     dataInicio: "2025-06-01T08:00:00Z",
 *   }, user);
 */
export async function criarEvento(input: CriarEventoInput, user: SessionUser): Promise<EventoComResponsavel> {
  assertPodeEscrever(user);

  if (input.responsavelId) {
    const responsavel = await prisma.membro.findUnique({ where: { id: input.responsavelId }, select: { id: true } });
    if (!responsavel) {
      throw new NotFoundError("Responsável não encontrado.");
    }
  }

  const evento = await prisma.evento.create({
    data: {
      titulo: input.titulo,
      descricao: input.descricao ?? null,
      tipo: input.tipo,
      status: input.status ?? "RASCUNHO",
      dataInicio: new Date(input.dataInicio),
      dataFim: input.dataFim ? new Date(input.dataFim) : null,
      local: input.local ?? null,
      responsavelId: input.responsavelId ?? null,
      createdById: user.id,
    },
    include: { responsavel: { select: { id: true, nome: true } } },
  });

  return evento;
}

/**
 * Edita um evento existente (parcial).
 *
 * @description UPDATE em `eventos` com campos opcionais.
 * @param {string} id - UUID do evento.
 * @param {EditarEventoInput} input - Campos a atualizar.
 * @param {SessionUser} user - Usuário autenticado (ADMIN/PASTOR/SECRETARIO).
 * @returns {Promise<EventoComResponsavel>} Evento atualizado.
 * @throws {Response} 403 se não tem permissão de escrita.
 * @throws {NotFoundError} 404 se evento ou responsável não existem.
 * @example
 *   const atualizado = await editarEvento(id, { status: "PUBLICADO" }, user);
 */
export async function editarEvento(id: string, input: EditarEventoInput, user: SessionUser): Promise<EventoComResponsavel> {
  assertPodeEscrever(user);
  await buscarEvento(id, user);

  if (input.responsavelId !== undefined) {
    if (input.responsavelId) {
      const responsavel = await prisma.membro.findUnique({ where: { id: input.responsavelId }, select: { id: true } });
      if (!responsavel) {
        throw new NotFoundError("Responsável não encontrado.");
      }
    }
  }

  const data: Record<string, unknown> = {};
  if (input.titulo !== undefined) data.titulo = input.titulo;
  if (input.descricao !== undefined) data.descricao = input.descricao;
  if (input.tipo !== undefined) data.tipo = input.tipo;
  if (input.status !== undefined) data.status = input.status;
  if (input.dataInicio !== undefined) data.dataInicio = new Date(input.dataInicio);
  if (input.dataFim !== undefined) data.dataFim = input.dataFim ? new Date(input.dataFim) : null;
  if (input.local !== undefined) data.local = input.local;
  if (input.responsavelId !== undefined) data.responsavelId = input.responsavelId;

  const evento = await prisma.evento.update({
    where: { id },
    data,
    include: { responsavel: { select: { id: true, nome: true } } },
  });

  return evento;
}

/**
 * Exclui um evento (apenas ADMIN/PASTOR).
 *
 * Eventos com status REALIZADO não podem ser excluídos —
 * devem ser cancelados via `editarEvento`.
 *
 * @description DELETE em `eventos` com validação de status.
 * @param {string} id - UUID do evento.
 * @param {SessionUser} user - Usuário autenticado (ADMIN/PASTOR).
 * @returns {Promise<void>}
 * @throws {Response} 403 se não tem permissão (apenas ADMIN/PASTOR).
 * @throws {NotFoundError} 404 se evento não existe.
 * @throws {BusinessRuleError} 422 se evento já foi realizado.
 * @example
 *   await excluirEvento(id, adminUser);
 */
export async function excluirEvento(id: string, user: SessionUser): Promise<void> {
  if (user.cargo !== "ADMIN" && user.cargo !== "PASTOR") {
    throw new Response("Apenas ADMIN ou PASTOR podem excluir eventos.", { status: 403 });
  }

  const evento = await prisma.evento.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!evento) {
    throw new NotFoundError("Evento não encontrado.");
  }

  if (evento.status === "REALIZADO") {
    throw new BusinessRuleError("Eventos realizados não podem ser excluídos. Altere o status para CANCELADO.");
  }

  await prisma.evento.delete({ where: { id } });
}
