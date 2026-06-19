/**
 * Service de Caixas — Igreja Conect (S06-T02, T03, T04).
 *
 * **RN-FIN-01:** Caixa tem apenas nome (saldo é derivado de lançamentos).
 * **RN-FIN-04 (trava de saldo):** `assertSaldoSuficiente` é a função canônica
 *   de validação — usada em lançamentos, NÃO aqui.
 *
 * **Camada 3 RBAC:**
 * - `listarCaixas` → `assertCanSeeFinancialModule` (ADMIN, PASTOR, FINANCEIRO, SECRETARIO)
 * - `criarCaixa`, `arquivarCaixa`, `reabrirCaixa` → `assertCanManageCaixa` (ADMIN, PASTOR, FINANCEIRO)
 *
 * @see .harness/RAG/security-rbac-matrix.md §4
 */
import { prisma } from "~/db/prisma.server";
import { assertCanSeeFinancialModule, assertCanManageCaixa } from "./rbac.server";
import { CaixaCreateSchema } from "./schemas/caixas";
import { safeLog } from "./audit.server";
import { listarPorCaixa } from "./lancamentos.server";
import type { SessionUser } from "./session.types";
import type { Prisma } from "../../generated/prisma/client";

// -------------------- Tipos públicos --------------------

/** Subset seguro de Caixa para listagens (mesmo shape de finance.server CaixaResumo). */
export type CaixaResumo = {
  id: string;
  nome: string;
  saldoCentavos: number;
  ativo: boolean;
  lancamentosMes: number;
  createdAt: Date;
};

/** Retorno de listarCaixas. */
export type ListarCaixasResult = {
  ativos: CaixaResumo[];
  arquivados: CaixaResumo[];
};

// -------------------- T02 — listarCaixas --------------------

/**
 * Lista caixas com suporte a filtros.
 *
 * **Camada 3 RBAC PRIMEIRO:** `assertCanSeeFinancialModule(user)`.
 *
 * @description Retorna caixas separados em ativos e arquivados.
 * @param {Object} options - Opções de filtro.
 * @param {boolean} [options.apenasAtivos] - Se true, retorna apenas ativos (default).
 * @param {string} [options.q] - Busca textual por nome (case-insensitive).
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<ListarCaixasResult>} Caixas separados em ativos e arquivados.
 * @throws {Response} 403 se usuário não tem perfil financeiro.
 * @example
 *   const { ativos, arquivados } = await listarCaixas({ q: "Geral" }, adminUser);
 */
export async function listarCaixas(
  options: { apenasAtivos?: boolean; q?: string },
  user: SessionUser
): Promise<ListarCaixasResult> {
  assertCanSeeFinancialModule(user);

  const where: Prisma.CaixaWhereInput = {};
  if (options.apenasAtivos !== false) {
    where.ativo = true;
  }
  if (options.q) {
    where.nome = { contains: options.q };
  }

  const caixas = await prisma.caixa.findMany({
    where,
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, saldoCentavos: true, ativo: true, createdAt: true },
  });

  // Lançamentos do mês (1 query agregada)
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lancamentosMesByCaixa = await prisma.lancamento.groupBy({
    by: ["caixaId"],
    where: { dataCompetencia: { gte: firstDayOfMonth } },
    _count: { _all: true },
  });
  const lancamentosMesMap = new Map<string, number>();
  for (const row of lancamentosMesByCaixa) {
    lancamentosMesMap.set(row.caixaId, row._count._all);
  }

  const caixasComLancamentos: CaixaResumo[] = caixas.map((c) => ({
    id: c.id,
    nome: c.nome,
    saldoCentavos: c.saldoCentavos,
    ativo: c.ativo,
    lancamentosMes: lancamentosMesMap.get(c.id) ?? 0,
    createdAt: c.createdAt,
  }));

  return {
    ativos: caixasComLancamentos.filter((c) => c.ativo),
    arquivados: caixasComLancamentos.filter((c) => !c.ativo),
  };
}

// -------------------- T03 — criarCaixa --------------------

/**
 * Cria um novo caixa.
 *
 * **Camada 3 RBAC PRIMEIRO:** `assertCanManageCaixa(user)`.
 * **Validação:** `CaixaCreateSchema.parse(input)` — 422 se inválido.
 * **Idempotência:** nome unique → P2002 → 409.
 *
 * @description Cria caixa com saldo zero e ativo=true.
 * @param {Object} input - Dados do caixa (apenas nome).
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<Object>} Caixa criado.
 * @throws {Response} 403 se sem permissão.
 * @throws {Response} 422 se input inválido (Zod).
 * @throws {Response} 409 se nome duplicado.
 * @example
 *   const caixa = await criarCaixa({ nome: "Cantina" }, adminUser);
 *   // { id: "...", nome: "Cantina", ativo: true, saldoCentavos: 0, ... }
 */
export async function criarCaixa(
  input: { nome: string },
  user: SessionUser
): Promise<unknown> {
  assertCanManageCaixa(user);

  // Validação Zod — 422 se inválido
  const parsed = CaixaCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new Response(JSON.stringify(parsed.error.issues), { status: 422 });
  }

  try {
    const caixa = await prisma.caixa.create({
      data: {
        nome: parsed.data.nome,
        ativo: true,
        saldoCentavos: 0,
      },
    });

    safeLog({ action: "create_caixa", resource: `caixa:${caixa.id}`, userId: user.id, result: "ok" });
    return caixa;
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
      throw new Response("Já existe um caixa com este nome.", { status: 409 });
    }
    throw err;
  }
}

// -------------------- T04 — arquivarCaixa --------------------

/**
 * Arquivamento lógico de um caixa (soft-delete via `ativo: false`).
 *
 * **Camada 3 RBAC PRIMEIRO:** `assertCanManageCaixa(user)`.
 * **Idempotente:** se já `ativo === false`, 409.
 * **Seguro:** NÃO altera `saldoCentavos`.
 *
 * @description Marca caixa como inativo. Saldo é preservado.
 * @param {string} id - UUID do caixa.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<Object>} Caixa atualizado.
 * @throws {Response} 403 se sem permissão.
 * @throws {Response} 404 se caixa não existe.
 * @throws {Response} 409 se caixa já está arquivado.
 * @example
 *   const caixa = await arquivarCaixa("uuid", adminUser);
 *   // caixa.ativo === false, caixa.saldoCentavos preservado
 */
export async function arquivarCaixa(id: string, user: SessionUser): Promise<unknown> {
  assertCanManageCaixa(user);

  const existente = await prisma.caixa.findUnique({
    where: { id },
    select: { id: true, ativo: true },
  });

  if (!existente) {
    throw new Response("Caixa não encontrado.", { status: 404 });
  }
  if (existente.ativo === false) {
    throw new Response("Caixa já está arquivado.", { status: 409 });
  }

  const caixa = await prisma.caixa.update({
    where: { id },
    data: { ativo: false },
  });

  safeLog({ action: "arquivar_caixa", resource: `caixa:${id}`, userId: user.id, result: "ok" });
  return caixa;
}

// -------------------- T04 — reabrirCaixa --------------------

/**
 * Reabre um caixa arquivado (reativa via `ativo: true`).
 *
 * Simétrico a `arquivarCaixa`. Idempotente: se já `ativo === true`, 409.
 * NÃO altera `saldoCentavos`.
 *
 * @description Reativa caixa arquivado.
 * @param {string} id - UUID do caixa.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<Object>} Caixa atualizado.
 * @throws {Response} 403 se sem permissão.
 * @throws {Response} 404 se caixa não existe.
 * @throws {Response} 409 se caixa já está ativo.
 * @example
 *   const caixa = await reabrirCaixa("uuid", adminUser);
 *   // caixa.ativo === true, caixa.saldoCentavos preservado
 */
export async function reabrirCaixa(id: string, user: SessionUser): Promise<unknown> {
  assertCanManageCaixa(user);

  const existente = await prisma.caixa.findUnique({
    where: { id },
    select: { id: true, ativo: true },
  });

  if (!existente) {
    throw new Response("Caixa não encontrado.", { status: 404 });
  }
  if (existente.ativo === true) {
    throw new Response("Caixa já está ativo.", { status: 409 });
  }

  const caixa = await prisma.caixa.update({
    where: { id },
    data: { ativo: true },
  });

  safeLog({ action: "reabrir_caixa", resource: `caixa:${id}`, userId: user.id, result: "ok" });
  return caixa;
}

// -------------------- T08 — listarCaixasParaSelect --------------------

/**
 * @description Retorna top 50 caixas ativos para use em selects.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<Array<{id: string, nome: string}>>} Lista de caixas.
 * @throws {Response} 403 se perfil não autorizado.
 */
export async function listarCaixasParaSelect(user: SessionUser): Promise<Array<{ id: string; nome: string }>> {
  assertCanSeeFinancialModule(user);
  return prisma.caixa.findMany({
    where: { ativo: true },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
    take: 50,
  });
}

// -------------------- T08 — getCaixaDetalhe --------------------

/**
 * @description Wrapper que retorna detalhe do caixa + extrato paginado.
 * @param {string} caixaId - UUID do caixa.
 * @param {Object} filtros - Filtros do extrato.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<Object|null>} Dados completos ou null se caixa não existe.
 * @throws {Response} 403 se perfil não autorizado.
 */
export async function getCaixaDetalhe(
  caixaId: string,
  filtros: { periodo?: string; categoria?: string; page?: number; pageSize?: number },
  user: SessionUser
): Promise<{
  caixa: { id: string; nome: string; saldoCentavos: number; ativo: boolean; createdAt: Date; lancamentosMes: number };
  lancamentos: Array<unknown>;
  total: number; page: number; pageSize: number;
} | null> {
  const result = await listarPorCaixa(caixaId, filtros, user);
  if (!result) return null;

  // Calcula lancamentosMes
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lancamentosMes = await prisma.lancamento.count({
    where: { caixaId, dataCompetencia: { gte: firstDayOfMonth } },
  });

  safeLog({ action: 'view_extrato', resource: `caixa:${caixaId}`, userId: user.id, result: 'ok' });

  return {
    caixa: { ...result.caixa, lancamentosMes },
    lancamentos: result.lancamentos,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  };
}

// -------------------- S07-T07: listarCaixasParaTransferencia --------------------

/**
 * Lista caixas ativos para uso em transferência (S07-T07).
 *
 * **Camada 3 RBAC PRIMEIRO:** `assertCanTransferir(user)`.
 *   Os 3 perfis autorizados (ADMIN, PASTOR, FINANCEIRO) veem todos os caixas.
 *
 * **RN-FIN-01:** Retorna apenas caixas ativos (caixas arquivados não aceitam transferência).
 *
 * @description Lista caixas que podem ser usados como origem ou destino de transferência.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<Array<{id: string, nome: string, saldoCentavos: number}>>}
 * @throws {Response} 403 se cargo não está em TRANSFERENCIA_CARGOS.
 * @example
 *   const caixas = await listarCaixasParaTransferencia(user);
 *   // [{ id: "...", nome: "Caixa Geral", saldoCentavos: 5000 }, ...]
 */
export async function listarCaixasParaTransferencia(
  user: SessionUser
): Promise<Array<{ id: string; nome: string; saldoCentavos: number }>> {
  // CAMADA 3: RBAC primeiro (RN-FIN-02: apenas ADMIN, PASTOR, FINANCEIRO)
  const { assertCanTransferir } = await import("./rbac.server");
  assertCanTransferir(user);

  return prisma.caixa.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, saldoCentavos: true },
    orderBy: { nome: "asc" },
    take: 100,
  });
}
