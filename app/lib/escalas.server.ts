/**
 * Service de Escalas — Igreja Conect (S04-T03).
 *
 * **Operações de domínio (server-only):**
 *  - `listarEscalas` — listagem por ministério
 *  - `buscarEscala` — leitura com voluntários
 *  - `criarEscala` — criação de nova escala
 *  - `adicionarVoluntario` — vincula membro à escala
 *  - `removerVoluntario` — desvincula voluntário
 *  - `atualizarStatus` — altera status da escala
 *
 * **RBAC:**
 *  - ADMIN/PASTOR: CRUD completo em qualquer escala
 *  - LIDER_MINISTERIO: CRUD apenas em escalas do seu ministério
 *  - SECRETARIO/DISCIPULADOR/FINANCEIRO: leitura apenas
 */
import { prisma } from "~/db/prisma.server";
import { NotFoundError, BusinessRuleError } from "./errors";
import type { SessionUser } from "./session.types";

export type { StatusEscala } from "../../generated/prisma/client";

/** Escala com voluntários e nome do ministério. */
export type EscalaComVoluntarios = {
  id: string;
  ministerioId: string;
  ministerioNome: string;
  titulo: string;
  data: Date;
  observacao: string | null;
  status: string;
  geradaAutomaticamente: boolean;
  voluntarios: Array<{
    id: string;
    membroId: string;
    membroNome: string;
    funcao: string;
    status: string;
  }>;
};

/** Input para criar escala. */
export type CriarEscalaInput = {
  ministerioId: string;
  titulo: string;
  data: string;
  observacao?: string;
  status?: string;
};

/** Input para adicionar voluntário. */
export type AdicionarVoluntarioInput = {
  membroId: string;
  funcao: string;
  observacao?: string;
};

const CARGO_LEITURA = ["ADMIN", "PASTOR", "SECRETARIO", "FINANCEIRO", "LIDER_MINISTERIO"] as const;

function assertPodeLer(user: SessionUser): void {
  if (!user.cargo || !(CARGO_LEITURA as readonly string[]).includes(user.cargo)) {
    throw new Response("Acesso restrito a usuários com cargo administrativo.", { status: 403 });
  }
}

function assertPodeEscrever(user: SessionUser): void {
  if (!user.cargo || (user.cargo !== "ADMIN" && user.cargo !== "PASTOR" && user.cargo !== "LIDER_MINISTERIO")) {
    throw new Response("Apenas ADMIN, PASTOR ou LIDER_MINISTERIO podem gerenciar escalas.", { status: 403 });
  }
}

/**
 * Verifica se o LIDER_MINISTERIO pertence ao ministério informado.
 * ADMIN e PASTOR são aprovados automaticamente.
 */
async function assertPodeGerenciarMinisterio(ministerioId: string, user: SessionUser): Promise<void> {
  if (user.cargo === "ADMIN" || user.cargo === "PASTOR") return;

  if (user.cargo === "LIDER_MINISTERIO") {
    const vinculo = await prisma.ministerioMembro.findUnique({
      where: { membroId_ministerioId: { membroId: user.id, ministerioId } },
    });
    if (!vinculo) {
      throw new Response("Você não pertence a este ministério.", { status: 403 });
    }
    return;
  }

  throw new Response("Acesso restrito.", { status: 403 });
}

const escalaComVoluntariosSelect = {
  id: true,
  ministerioId: true,
  titulo: true,
  data: true,
  observacao: true,
  status: true,
  geradaAutomaticamente: true,
  ministerio: { select: { nome: true } },
  voluntarios: {
    select: {
      id: true,
      membroId: true,
      funcao: true,
      status: true,
      observacao: true,
      membro: { select: { nome: true } },
    },
  },
} as const;

function formatEscala(raw: {
  id: string;
  ministerioId: string;
  titulo: string;
  data: Date;
  observacao: string | null;
  status: string;
  geradaAutomaticamente: boolean;
  ministerio: { nome: string };
  voluntarios: Array<{
    id: string;
    membroId: string;
    funcao: string;
    status: string;
    observacao: string | null;
    membro: { nome: string };
  }>;
}): EscalaComVoluntarios {
  return {
    id: raw.id,
    ministerioId: raw.ministerioId,
    ministerioNome: raw.ministerio.nome,
    titulo: raw.titulo,
    data: raw.data,
    observacao: raw.observacao,
    status: raw.status,
    geradaAutomaticamente: raw.geradaAutomaticamente,
    voluntarios: raw.voluntarios.map((v) => ({
      id: v.id,
      membroId: v.membroId,
      membroNome: v.membro.nome,
      funcao: v.funcao,
      status: v.status,
    })),
  };
}

/**
 * Lista escalas com voluntários. LIDER_MINISTERIO vê apenas
 * escalas do seu ministério.
 *
 * @description SELECT em `escalas` com include de ministerio e voluntarios.
 * @param {SessionUser} user - Usuário autenticado.
 * @param {string} [ministerioId] - Filtrar por ministério.
 * @returns {Promise<EscalaComVoluntarios[]>} Lista de escalas.
 * @throws {Response} 403 se usuário sem cargo administrativo.
 * @example
 *   const escalas = await listarEscalas(user);
 *   const escalasDoMinisterio = await listarEscalas(user, ministerioId);
 */
export async function listarEscalas(
  user: SessionUser,
  ministerioId?: string
): Promise<EscalaComVoluntarios[]> {
  assertPodeLer(user);

  const where: Record<string, unknown> = {};

  if (user.cargo === "LIDER_MINISTERIO") {
    const ministerios = await prisma.ministerioMembro.findMany({
      where: { membroId: user.id },
      select: { ministerioId: true },
    });
    where.ministerioId = { in: ministerios.map((m) => m.ministerioId) };
  }

  if (ministerioId) {
    where.ministerioId = ministerioId;
  }

  const raw = await prisma.escala.findMany({
    where,
    select: escalaComVoluntariosSelect,
    orderBy: { data: "desc" },
  });

  return raw.map(formatEscala);
}

/**
 * Busca uma escala pelo ID com voluntários.
 *
 * @description SELECT único em `escalas` com voluntários.
 * @param {string} id - UUID da escala.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<EscalaComVoluntarios>} Escala encontrada.
 * @throws {Response} 403 se usuário sem cargo administrativo.
 * @throws {NotFoundError} 404 se escala não existe.
 * @example
 *   const escala = await buscarEscala(id, user);
 */
export async function buscarEscala(id: string, user: SessionUser): Promise<EscalaComVoluntarios> {
  assertPodeLer(user);

  const raw = await prisma.escala.findUnique({
    where: { id },
    select: escalaComVoluntariosSelect,
  });

  if (!raw) {
    throw new NotFoundError("Escala não encontrada.");
  }

  return formatEscala(raw);
}

/**
 * Cria uma nova escala.
 *
 * @description INSERT em `escalas` vinculada a um ministério.
 * @param {CriarEscalaInput} input - Dados da escala.
 * @param {SessionUser} user - Usuário autenticado (ADMIN/PASTOR/LIDER_MINISTERIO).
 * @returns {Promise<EscalaComVoluntarios>} Escala criada.
 * @throws {Response} 403 se não tem permissão ou não pertence ao ministério.
 * @throws {NotFoundError} 404 se ministério não existe.
 * @example
 *   const escala = await criarEscala({
 *     ministerioId: mid,
 *     titulo: "Escala de Louvor",
 *     data: "2025-01-10T19:00:00Z",
 *   }, user);
 */
export async function criarEscala(input: CriarEscalaInput, user: SessionUser): Promise<EscalaComVoluntarios> {
  assertPodeEscrever(user);

  const ministerio = await prisma.ministerio.findUnique({ where: { id: input.ministerioId } });
  if (!ministerio) {
    throw new NotFoundError("Ministério não encontrado.");
  }

  await assertPodeGerenciarMinisterio(input.ministerioId, user);

  const raw = await prisma.escala.create({
    data: {
      ministerioId: input.ministerioId,
      titulo: input.titulo,
      data: new Date(input.data),
      observacao: input.observacao ?? null,
      status: (input.status as "PENDENTE" | "CONFIRMADA" | "REALIZADA" | "CANCELADA") ?? "PENDENTE",
      createdById: user.id,
    },
    select: escalaComVoluntariosSelect,
  });

  return formatEscala(raw);
}

/**
 * Adiciona um voluntário a uma escala.
 *
 * @description INSERT em `escala_voluntarios`.
 * @param {string} escalaId - UUID da escala.
 * @param {AdicionarVoluntarioInput} input - Dados do voluntário.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<EscalaComVoluntarios>} Escala atualizada.
 * @throws {Response} 403 se não tem permissão.
 * @throws {NotFoundError} 404 se escala ou membro não existem.
 * @example
 *   await adicionarVoluntario(escalaId, { membroId, funcao: "Vocal" }, user);
 */
export async function adicionarVoluntario(
  escalaId: string,
  input: AdicionarVoluntarioInput,
  user: SessionUser
): Promise<EscalaComVoluntarios> {
  assertPodeEscrever(user);

  const escala = await prisma.escala.findUnique({
    where: { id: escalaId },
    select: { id: true, ministerioId: true },
  });
  if (!escala) {
    throw new NotFoundError("Escala não encontrada.");
  }

  await assertPodeGerenciarMinisterio(escala.ministerioId, user);

  const membro = await prisma.membro.findUnique({ where: { id: input.membroId }, select: { id: true } });
  if (!membro) {
    throw new NotFoundError("Membro não encontrado.");
  }

  await prisma.escalaVoluntario.create({
    data: {
      escalaId,
      membroId: input.membroId,
      funcao: input.funcao,
      status: "CONFIRMADO",
      observacao: input.observacao ?? null,
    },
  });

  return buscarEscala(escalaId, user);
}

/**
 * Remove um voluntário de uma escala.
 *
 * @description DELETE em `escala_voluntarios` por ID.
 * @param {string} id - UUID do vínculo (EscalaVoluntario).
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<void>}
 * @throws {Response} 403 se não tem permissão.
 * @throws {NotFoundError} 404 se vínculo não existe.
 * @example
 *   await removerVoluntario(vinculoId, user);
 */
export async function removerVoluntario(id: string, user: SessionUser): Promise<void> {
  assertPodeEscrever(user);

  const vinculo = await prisma.escalaVoluntario.findUnique({
    where: { id },
    select: {
      id: true,
      escala: { select: { ministerioId: true } },
    },
  });
  if (!vinculo) {
    throw new NotFoundError("Vínculo não encontrado.");
  }

  await assertPodeGerenciarMinisterio(vinculo.escala.ministerioId, user);

  await prisma.escalaVoluntario.delete({ where: { id } });
}

/**
 * Atualiza o status de uma escala.
 *
 * @description UPDATE em `escalas` com novo status.
 * @param {string} id - UUID da escala.
 * @param {"PENDENTE" | "CONFIRMADA" | "REALIZADA" | "CANCELADA"} status - Novo status.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<EscalaComVoluntarios>} Escala atualizada.
 * @throws {Response} 403 se não tem permissão.
 * @throws {NotFoundError} 404 se escala não existe.
 * @throws {BusinessRuleError} 422 se status inválido para transição.
 * @example
 *   await atualizarStatus(id, "CONFIRMADA", user);
 */
export async function atualizarStatus(
  id: string,
  status: "PENDENTE" | "CONFIRMADA" | "REALIZADA" | "CANCELADA",
  user: SessionUser
): Promise<EscalaComVoluntarios> {
  assertPodeEscrever(user);

  const escala = await prisma.escala.findUnique({
    where: { id },
    select: { id: true, ministerioId: true, status: true },
  });
  if (!escala) {
    throw new NotFoundError("Escala não encontrada.");
  }

  await assertPodeGerenciarMinisterio(escala.ministerioId, user);

  if (escala.status === "REALIZADA" && status !== "REALIZADA") {
    throw new BusinessRuleError("Escalas realizadas não podem ter o status alterado.");
  }

  await prisma.escala.update({
    where: { id },
    data: { status },
  });

  return buscarEscala(id, user);
}
