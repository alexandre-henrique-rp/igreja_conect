/**
 * Service de Finanças — Igreja Conect (S03-T11, estendido S06-T07/S06-T10).
 *
 * **RN-MEM-03 — Camada 3 (defense in depth):**
 * `getDizimosByMembro` é a função canônica de leitura de dízimos.
 * Ela aplica `assertCanSeeFinancials` ANTES de qualquer query — se
 * um loader ou outro service esquecer de filtrar, este service barra
 * com `Response(403)`.
 *
 * **RN-FIN-04 — Trava de Saldo:**
 * `assertSaldoSuficiente` é a função canônica de validação de saldo.
 * Deve ser chamada ANTES de qualquer `prisma.caixa.update({ decrement })`.
 * Lança `Response(409)` se saldo < valor.
 *
 * **S06-T10 — Dashboard Financeiro:**
 * `getDashboardFinanceiro` agrega saldos, lista caixas ativos e últimos
 * 5 lançamentos (filtrando DIZIMO para SECRETARIO — RBAC fina service-side).
 *
 * **Por que Response(4xx) e não DomainError:** o `assertCanSeeFinancials`
 * do `rbac.server` lança Response(403) por convenção (consistência com
 * o restante do projeto), e o React Router 7 captura Response para
 * renderizar ErrorBoundary.
 *
 * **GATE LGPD:** `safeLog` aplicado em todas as ações que mutam dados;
 * `valorCentavos` NUNCA vai para log (RAG `lgpd-igreja-conect` §2.5).
 *
 * @see .harness/RAG/pattern-trava-saldo-service.md (referência canônica de assertSaldoSuficiente)
 * @see .harness/RAG/security-rbac-matrix.md §4 (camada 3 exemplo)
 * @see .harness/RAG/lgpd-igreja-conect.md §2.2 e §2.5
 */
import { prisma } from "~/db/prisma.server";
import { assertCanSeeFinancials } from "./rbac.server";
import { assertNonNegative } from "./money.server";
import { safeLog } from "./audit.server";
import type { SessionUser } from "./session.types";

/**
 * Lista os dízimos de um membro. **Camada 3 RBAC** — bloqueia perfis
 * sem acesso a dados financeiros ANTES de qualquer query.
 *
 * **Perfis que passam:** ADMIN, PASTOR, FINANCEIRO.
 * **Perfis bloqueados (403):** SECRETARIO, DISCIPULADOR, LIDER_MINISTERIO.
 *
 * @description Camada 3 de defesa em profundidade (RN-MEM-03).
 * @param {string} membroId - UUID do membro.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<Array<unknown>>} Lançamentos do tipo DIZIMO do membro.
 * @throws {Response} 403 se usuário não tem perfil financeiro.
 * @example
 *   try {
 *     const dizimos = await getDizimosByMembro(membroId, adminUser);
 *   } catch (e) {
 *     if (e instanceof Response && e.status === 403) {
 *       // UI não renderiza a aba
 *     }
 *   }
 */
export async function getDizimosByMembro(
  membroId: string,
  user: SessionUser
): Promise<Array<unknown>> {
  // Camada 3: PRIMEIRO verifica RBAC, DEPOIS toca o DB.
  // Se um loader esquecer de aplicar a camada 1 ou 2, este service barra.
  assertCanSeeFinancials(user);

  return prisma.lancamento.findMany({
    where: { membroId, categoria: "DIZIMO" },
    orderBy: { dataCompetencia: "desc" },
  });
}

/**
 * Camada 3 de defesa para RN-FIN-04 (trava de saldo).
 *
 * Lança `Response(409)` se o caixa NÃO tem saldo suficiente para a
 * operação. Deve ser a PRIMEIRA chamada antes de qualquer
 * `prisma.caixa.update({ data: { saldoCentavos: { decrement: X } } })`.
 *
 * **NÃO decrementa o saldo aqui** — apenas valida. O decremento
 * real é feito pelo service chamador, dentro de `prisma.$transaction`
 * (atomicidade).
 *
 * **Inclui checagem de `caixa.ativo === false`** (decisão `decision-caixa-soft-delete`):
 * caixas arquivados rejeitam movimentação com 409 antes mesmo de checar saldo.
 *
 * @param {string} caixaId - UUID do caixa.
 * @param {number} valorCentavos - Valor a debitar (sempre > 0).
 * @param {string} context - Descrição do contexto (ex: "Lançamento de saída").
 * @returns {Promise<void>}
 * @throws {Response} 400 se `valorCentavos` não é Int > 0.
 * @throws {Response} 404 se caixa não existe.
 * @throws {Response} 409 se caixa arquivado OU saldo < valor.
 * @example
 *   await assertSaldoSuficiente(caixaId, 100, "Pagamento de conta de luz");
 *   // 100 cents = R$ 1,00; se saldo < 100, throws 409
 */
export async function assertSaldoSuficiente(
  caixaId: string,
  valorCentavos: number,
  context: string
): Promise<void> {
  if (!Number.isInteger(valorCentavos) || valorCentavos <= 0) {
    throw new Response(
      `${context}: valor deve ser inteiro > 0.`,
      { status: 400 }
    );
  }
  const caixa = await prisma.caixa.findUnique({
    where: { id: caixaId },
    select: { id: true, nome: true, saldoCentavos: true, ativo: true },
  });
  if (!caixa) {
    throw new Response(`${context}: caixa não encontrado.`, { status: 404 });
  }
  if (caixa.ativo === false) {
    throw new Response(
      `${context}: caixa "${caixa.nome}" está arquivado e não aceita movimentações.`,
      { status: 409 }
    );
  }
  if (caixa.saldoCentavos < valorCentavos) {
    throw new Response(
      `Saldo insuficiente no caixa de origem. Disponível: R$ ${(caixa.saldoCentavos / 100).toFixed(2)}.`,
      { status: 409 }
    );
  }
}

// ----------------- T010 — Dashboard Financeiro (S06-T10) -----------------

/** Subset seguro de Caixa para o dashboard. */
export type CaixaResumo = {
  id: string;
  nome: string;
  saldoCentavos: number;
  ativo: boolean;
  lancamentosMes: number;
  createdAt: Date;
};

/** Subset seguro de Lancamento para o dashboard. */
export type LancamentoResumo = {
  id: string;
  tipo: "ENTRADA" | "SAIDA";
  categoria: string;
  valorCentavos: number;
  dataCompetencia: Date;
  descricao: string;
  caixa: { id: string; nome: string };
  membro: { id: string; nome: string } | null;
};

/** Tipo de retorno de `getDashboardFinanceiro`. */
export type DashboardFinanceiroData = {
  caixas: CaixaResumo[];
  ultimosLancamentos: LancamentoResumo[];
  saldoAgregadoCentavos: number;
  totalCaixasAtivos: number;
};

/**
 * Agrega dados do dashboard financeiro (S06-T10).
 *
 * **Camada 3 RBAC PRIMEIRO:** `assertCanSeeFinancials(user)`.
 *
 * **Filtro DIZIMO para SECRETARIO (RN-MEM-03, RBAC fina service-side):**
 * se `user.cargo === "SECRETARIO"`, `ultimosLancamentos` é re-buscado com
 * `where: { categoria: { not: "DIZIMO" } }` — não vaza dízimos.
 *
 * **Edge cases:**
 * - 0 caixas: `caixas: []`, `saldoAgregadoCentavos: 0`.
 * - 0 lançamentos: `ultimosLancamentos: []`.
 * - Caixa arquivado: excluído do agregado e da lista `caixas` (sempre filtra `ativo: true`).
 *
 * @description Camada 3 — RBAC + lógica de agregação financeira.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<DashboardFinanceiroData>} Dados para o dashboard.
 * @throws {Response} 403 se usuário não tem perfil financeiro.
 * @example
 *   const data = await getDashboardFinanceiro(adminUser);
 *   // { caixas: [...], ultimosLancamentos: [...5 itens...], saldoAgregadoCentavos: 175000, totalCaixasAtivos: 3 }
 */
export async function getDashboardFinanceiro(
  user: SessionUser
): Promise<DashboardFinanceiroData> {
  // CAMADA 3 (RBAC) — PRIMEIRO.
  assertCanSeeFinancials(user);

  // 1) Caixas ativos (sempre filtra `ativo: true`).
  const caixasAtivos = await prisma.caixa.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, saldoCentavos: true, ativo: true, createdAt: true },
  });

  // 2) Lançamentos do mês atual (agregado por caixa — 1 query).
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

  const caixas: CaixaResumo[] = caixasAtivos.map((c) => ({
    id: c.id,
    nome: c.nome,
    saldoCentavos: c.saldoCentavos,
    ativo: c.ativo,
    lancamentosMes: lancamentosMesMap.get(c.id) ?? 0,
    createdAt: c.createdAt,
  }));

  // 3) Saldo agregado (1 query, vazio se 0 caixas).
  const agregado = await prisma.caixa.aggregate({
    where: { ativo: true },
    _sum: { saldoCentavos: true },
  });
  const saldoAgregadoCentavos = agregado._sum.saldoCentavos ?? 0;

  // 4) Últimos 5 lançamentos, com filtro DIZIMO para SECRETARIO.
  const whereLancamento = user.cargo === "SECRETARIO"
    ? { categoria: { not: "DIZIMO" as const } }
    : {};
  const ultimosLancamentosRaw = await prisma.lancamento.findMany({
    where: whereLancamento,
    orderBy: { dataCompetencia: "desc" },
    take: 5,
    include: {
      caixa: { select: { id: true, nome: true } },
      membro: { select: { id: true, nome: true } },
    },
  });

  const ultimosLancamentos: LancamentoResumo[] = ultimosLancamentosRaw.map((l) => ({
    id: l.id,
    tipo: l.tipo,
    categoria: l.categoria,
    valorCentavos: l.valorCentavos,
    dataCompetencia: l.dataCompetencia,
    descricao: l.descricao,
    caixa: l.caixa,
    membro: l.membro,
  }));

  safeLog({
    action: "view_dashboard_financeiro",
    userId: user.id,
    result: "ok",
  });

  return {
    caixas,
    ultimosLancamentos,
    saldoAgregadoCentavos,
    totalCaixasAtivos: caixas.length,
  };
}
