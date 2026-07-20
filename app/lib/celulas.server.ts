/**
 * Service de Células — Igreja Conect (S04-T03).
 *
 * **Operações de domínio (server-only):**
 *  - `listarCelulas` — listagem com líder e total de membros
 *  - `buscarCelula` — leitura individual
 *  - `criarCelula` — criação de nova célula
 *  - `editarCelula` — atualização parcial
 *  - `excluirCelula` — exclusão com validação de membros
 *  - `vincularMembro` — vincula membro à célula
 *  - `desvincularMembro` — desvincula membro da célula
 *
 * **RBAC:**
 *  - ADMIN/PASTOR: CRUD completo
 *  - SECRETARIO: CRUD de célula + gerenciar membros
 *  - DISCIPULADOR: apenas vincular/desvincular membros
 *  - Demais cargos: leitura apenas
 */
import { prisma } from "~/db/prisma.server";
import { NotFoundError, BusinessRuleError } from "./errors";
import type { SessionUser } from "./session.types";

/** Célula com líder e total de membros. */
export type CelulaComLider = {
  id: string;
  nome: string;
  descricao: string | null;
  lider: { id: string; nome: string } | null;
  endereco: string | null;
  diaSemana: string | null;
  horario: string | null;
  totalMembros: number;
};

/** Input para criar célula. */
export type CriarCelulaInput = {
  nome: string;
  descricao?: string;
  liderId?: string;
  endereco?: string;
  diaSemana?: string;
  horario?: string;
};

/** Input para editar célula (parcial). */
export type EditarCelulaInput = Partial<CriarCelulaInput>;

const CARGO_LEITURA = ["ADMIN", "PASTOR", "SECRETARIO", "DISCIPULADOR", "FINANCEIRO", "LIDER_MINISTERIO"] as const;
const CARGO_ESCRITA = ["ADMIN", "PASTOR", "SECRETARIO"] as const;
const CARGO_VINCULAR = ["ADMIN", "PASTOR", "SECRETARIO", "DISCIPULADOR"] as const;

function assertPodeLer(user: SessionUser): void {
  if (!user.cargo || !(CARGO_LEITURA as readonly string[]).includes(user.cargo)) {
    throw new Response("Acesso restrito a usuários com cargo administrativo.", { status: 403 });
  }
}

function assertPodeEscrever(user: SessionUser): void {
  if (!user.cargo || !(CARGO_ESCRITA as readonly string[]).includes(user.cargo)) {
    throw new Response("Apenas ADMIN, PASTOR ou SECRETARIO podem gerenciar células.", { status: 403 });
  }
}

function assertPodeVincular(user: SessionUser): void {
  if (!user.cargo || !(CARGO_VINCULAR as readonly string[]).includes(user.cargo)) {
    throw new Response("Você não tem permissão para gerenciar membros de células.", { status: 403 });
  }
}

const celulaComLiderSelect = {
  id: true,
  nome: true,
  descricao: true,
  endereco: true,
  diaSemana: true,
  horario: true,
  lider: { select: { id: true, nome: true } },
  _count: { select: { membros: true } },
} as const;

function formatCelula(raw: {
  id: string;
  nome: string;
  descricao: string | null;
  endereco: string | null;
  diaSemana: string | null;
  horario: string | null;
  lider: { id: string; nome: string } | null;
  _count: { membros: number };
}): CelulaComLider {
  return {
    id: raw.id,
    nome: raw.nome,
    descricao: raw.descricao,
    lider: raw.lider,
    endereco: raw.endereco,
    diaSemana: raw.diaSemana,
    horario: raw.horario,
    totalMembros: raw._count.membros,
  };
}

/**
 * Lista todas as células com líder e total de membros.
 *
 * @description SELECT em `celulas` com include de líder e count de membros.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<CelulaComLider[]>} Lista de células.
 * @throws {Response} 403 se usuário sem cargo administrativo.
 * @example
 *   const celulas = await listarCelulas(user);
 */
export async function listarCelulas(user: SessionUser): Promise<CelulaComLider[]> {
  assertPodeLer(user);

  const raw = await prisma.celula.findMany({
    select: celulaComLiderSelect,
    orderBy: { nome: "asc" },
  });

  return raw.map(formatCelula);
}

/**
 * Busca uma célula pelo ID.
 *
 * @description SELECT único em `celulas` com líder e count.
 * @param {string} id - UUID da célula.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<CelulaComLider>} Célula encontrada.
 * @throws {Response} 403 se usuário sem cargo administrativo.
 * @throws {NotFoundError} 404 se célula não existe.
 * @example
 *   const celula = await buscarCelula(id, user);
 */
export async function buscarCelula(id: string, user: SessionUser): Promise<CelulaComLider> {
  assertPodeLer(user);

  const raw = await prisma.celula.findUnique({
    where: { id },
    select: celulaComLiderSelect,
  });

  if (!raw) {
    throw new NotFoundError("Célula não encontrada.");
  }

  return formatCelula(raw);
}

/**
 * Cria uma nova célula.
 *
 * @description INSERT em `celulas` com validação de nome único.
 * @param {CriarCelulaInput} input - Dados da célula.
 * @param {SessionUser} user - Usuário autenticado (ADMIN/PASTOR/SECRETARIO).
 * @returns {Promise<CelulaComLider>} Célula criada.
 * @throws {Response} 403 se não tem permissão de escrita.
 * @throws {BusinessRuleError} 409 se nome já existe.
 * @throws {NotFoundError} 404 se líder informado não existe.
 * @example
 *   const celula = await criarCelula({ nome: "Célula Esperança" }, user);
 */
export async function criarCelula(input: CriarCelulaInput, user: SessionUser): Promise<CelulaComLider> {
  assertPodeEscrever(user);

  const existente = await prisma.celula.findUnique({ where: { nome: input.nome } });
  if (existente) {
    throw new BusinessRuleError("Já existe uma célula com este nome.");
  }

  if (input.liderId) {
    const lider = await prisma.membro.findUnique({ where: { id: input.liderId }, select: { id: true } });
    if (!lider) {
      throw new NotFoundError("Líder não encontrado.");
    }
  }

  const raw = await prisma.celula.create({
    data: {
      nome: input.nome,
      descricao: input.descricao ?? null,
      liderId: input.liderId ?? null,
      endereco: input.endereco ?? null,
      diaSemana: input.diaSemana ?? null,
      horario: input.horario ?? null,
    },
    select: celulaComLiderSelect,
  });

  return formatCelula(raw);
}

/**
 * Edita uma célula existente (parcial).
 *
 * @description UPDATE em `celulas` com campos opcionais.
 * @param {string} id - UUID da célula.
 * @param {EditarCelulaInput} input - Campos a atualizar.
 * @param {SessionUser} user - Usuário autenticado (ADMIN/PASTOR/SECRETARIO).
 * @returns {Promise<CelulaComLider>} Célula atualizada.
 * @throws {Response} 403 se não tem permissão de escrita.
 * @throws {NotFoundError} 404 se célula não existe.
 * @throws {BusinessRuleError} 409 se novo nome já existe.
 * @example
 *   const atualizada = await editarCelula(id, { endereco: "Rua Nova" }, user);
 */
export async function editarCelula(id: string, input: EditarCelulaInput, user: SessionUser): Promise<CelulaComLider> {
  assertPodeEscrever(user);
  await buscarCelula(id, user);

  if (input.nome !== undefined) {
    const duplicado = await prisma.celula.findUnique({ where: { nome: input.nome } });
    if (duplicado && duplicado.id !== id) {
      throw new BusinessRuleError("Já existe outra célula com este nome.");
    }
  }

  if (input.liderId !== undefined) {
    if (input.liderId) {
      const lider = await prisma.membro.findUnique({ where: { id: input.liderId }, select: { id: true } });
      if (!lider) {
        throw new NotFoundError("Líder não encontrado.");
      }
    }
  }

  const data: Record<string, unknown> = {};
  if (input.nome !== undefined) data.nome = input.nome;
  if (input.descricao !== undefined) data.descricao = input.descricao;
  if (input.liderId !== undefined) data.liderId = input.liderId;
  if (input.endereco !== undefined) data.endereco = input.endereco;
  if (input.diaSemana !== undefined) data.diaSemana = input.diaSemana;
  if (input.horario !== undefined) data.horario = input.horario;

  const raw = await prisma.celula.update({ where: { id }, data, select: celulaComLiderSelect });
  return formatCelula(raw);
}

/**
 * Exclui uma célula (apenas ADMIN/PASTOR).
 *
 * Células com membros vinculados não podem ser excluídas —
 * desvincule todos os membros primeiro.
 *
 * @description DELETE em `celulas` com validação de membros vinculados.
 * @param {string} id - UUID da célula.
 * @param {SessionUser} user - Usuário autenticado (ADMIN/PASTOR).
 * @returns {Promise<void>}
 * @throws {Response} 403 se não tem permissão (apenas ADMIN/PASTOR).
 * @throws {NotFoundError} 404 se célula não existe.
 * @throws {BusinessRuleError} 422 se célula tem membros vinculados.
 * @example
 *   await excluirCelula(id, adminUser);
 */
export async function excluirCelula(id: string, user: SessionUser): Promise<void> {
  if (user.cargo !== "ADMIN" && user.cargo !== "PASTOR") {
    throw new Response("Apenas ADMIN ou PASTOR podem excluir células.", { status: 403 });
  }

  const celula = await prisma.celula.findUnique({
    where: { id },
    select: { _count: { select: { membros: true } } },
  });
  if (!celula) {
    throw new NotFoundError("Célula não encontrada.");
  }

  if (celula._count.membros > 0) {
    throw new BusinessRuleError("Desvincule todos os membros antes de excluir esta célula.");
  }

  await prisma.celula.delete({ where: { id } });
}

/**
 * Vincula um membro a uma célula.
 *
 * @description INSERT em `membro_celulas`.
 * @param {string} celulaId - UUID da célula.
 * @param {string} membroId - UUID do membro.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<void>}
 * @throws {Response} 403 se não tem permissão.
 * @throws {NotFoundError} 404 se célula ou membro não existem.
 * @throws {BusinessRuleError} 409 se membro já está na célula.
 * @example
 *   await vincularMembro(celulaId, membroId, user);
 */
export async function vincularMembro(celulaId: string, membroId: string, user: SessionUser): Promise<void> {
  assertPodeVincular(user);

  const celula = await prisma.celula.findUnique({ where: { id: celulaId }, select: { id: true } });
  if (!celula) {
    throw new NotFoundError("Célula não encontrada.");
  }

  const membro = await prisma.membro.findUnique({ where: { id: membroId }, select: { id: true } });
  if (!membro) {
    throw new NotFoundError("Membro não encontrado.");
  }

  const existente = await prisma.membroCelula.findUnique({
    where: { membroId_celulaId: { membroId, celulaId } },
  });
  if (existente) {
    throw new BusinessRuleError("Membro já está vinculado a esta célula.");
  }

  await prisma.membroCelula.create({ data: { celulaId, membroId } });
}

/**
 * Desvincula um membro de uma célula.
 *
 * @description DELETE em `membro_celulas`.
 * @param {string} celulaId - UUID da célula.
 * @param {string} membroId - UUID do membro.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<void>}
 * @throws {Response} 403 se não tem permissão.
 * @throws {NotFoundError} 404 se vínculo não existe.
 * @example
 *   await desvincularMembro(celulaId, membroId, user);
 */
export async function desvincularMembro(celulaId: string, membroId: string, user: SessionUser): Promise<void> {
  assertPodeVincular(user);

  const vinculo = await prisma.membroCelula.findUnique({
    where: { membroId_celulaId: { membroId, celulaId } },
  });
  if (!vinculo) {
    throw new NotFoundError("Membro não está vinculado a esta célula.");
  }

  await prisma.membroCelula.delete({ where: { membroId_celulaId: { membroId, celulaId } } });
}
