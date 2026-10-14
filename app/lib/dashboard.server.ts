/**
 * Service de Dashboard — Igreja Conect (S04-T09 / S06-T10).
 *
 * Fornece dados agregados para a página inicial do sistema:
 * - Counts de membros ativos, visitantes do mês, alertas não lidos
 * - Saldo total em caixas ativos, alertas de estoque críticos
 * - Últimas contribuições (entradas de dízimos/ofertas/campanhas)
 * - Últimos 5 visitantes cadastrados
 *
 * **Variações vs. mês anterior** (`variacoes`, em %; `null` quando não há base
 * de comparação):
 * - `membros`: cadastros atuais vs. cadastros existentes antes do dia 1º (pela
 *   data de cadastro; não há histórico de mudança de tipo).
 * - `visitantes`: visitantes cadastrados neste mês vs. no mês anterior.
 * - `saldo`: saldo atual vs. saldo estimado do dia 1º (saldo atual menos o
 *   movimento dos lançamentos com competência neste mês, nos caixas ativos).
 * - Alertas de estoque não têm histórico e por isso não têm variação.
 *
 * **RBAC fina:**
 * - DISCIPULADOR e LIDER_MINISTERIO veem apenas o seu escopo (si mesmos e seus
 *   discípulos, `discipuladorId=user.id`) — mesma regra de `listMembros`.
 * - SECRETARIO não vê lançamentos da categoria DIZIMO.
 * - Perfis sem cargo financeiro veem saldo financeiro como 0 e contribuições vazias.
 *
 * @see app/lib/dashboard.server.test.ts
 */
import { prisma } from "~/db/prisma.server";
import type { SessionUser } from "./session.types";

/** Tipo de lançamento simplificado para o dashboard. */
export type ContribuicaoResumo = {
  id: string;
  contribuinte: string;
  tipo: "DÍZIMO" | "OFERTA" | "CAMPANHA" | "MISSÕES";
  data: Date;
  valorCentavos: number;
};

/** Culto resumido para o painel "Agenda & Escalas" do dashboard. */
export type CultoResumo = {
  id: string;
  titulo: string;
  data: Date;
  horario: string;
  local: string | null;
  status: "AGENDADO" | "CONFIRMADO" | "REALIZADO" | "CANCELADO";
};

/** Dados do dashboard retornados ao cliente. */
export type FluxoCaixaResumo = {
  mes: string;
  entradasCentavos: number;
  saidasCentavos: number;
};

export type DashboardData = {
  membrosAtivos: number;
  visitantesMes: number;
  alertasNaoLidos: number;
  saldoTotalCentavos: number;
  alertasEstoque: number;
  fluxoCaixa: FluxoCaixaResumo[];
  ultimasContribuicoes: ContribuicaoResumo[];
  ultimosVisitantes: Array<{ id: string; nome: string; createdAt: Date }>;
  proximosCultos: CultoResumo[];
  /** Variação percentual vs. mês anterior (null = sem base de comparação). */
  variacoes: {
    saldo: number | null;
    membros: number | null;
    visitantes: number | null;
  };
};

/**
 * Retorna dados agregados para o dashboard.
 *
 * Executa as queries em paralelo para alta performance.
 *
 * @description Agregação de métricas com RBAC fina aplicado na query layer.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<DashboardData>} Dados agregados.
 */
/** Variação percentual inteira; `null` se a base anterior não é positiva. */
function variacaoPercentual(atual: number, anterior: number): number | null {
  if (anterior <= 0) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

export async function getDashboardData(
  user: SessionUser
): Promise<DashboardData> {
  const canSeeFinance = user.cargo && ["ADMIN", "PASTOR", "FINANCEIRO", "SECRETARIO"].includes(user.cargo);
  const canSeeDizimos = user.cargo && ["ADMIN", "PASTOR", "FINANCEIRO"].includes(user.cargo);

  // Where base para membros: DISCIPULADOR/LIDER_MINISTERIO só veem o seu escopo
  // (a si mesmos e aos seus discípulos), como em `listMembros`.
  const escopoRestrito = user.cargo === "DISCIPULADOR" || user.cargo === "LIDER_MINISTERIO";
  const membroWhere: Record<string, unknown> = escopoRestrito
    ? { OR: [{ discipuladorId: user.id }, { id: user.id }] }
    : {};

  // Where para visitantes
  const visitanteWhere = {
    ...membroWhere,
    tipo: "VISITANTE" as const,
  };

  // Where para visitantes do mês
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const visitantesMesWhere = {
    ...visitanteWhere,
    createdAt: { gte: startOfMonth },
  };

  // Where para alertas (NUNCA filtra por discipulador)
  const alertasWhere = {
    destinatarios: { some: { membroId: user.id, lido: false } },
  };

  // Alertas de estoque: quantidade <= 5 (consumo) ou manutenção atrasada (> 30 dias sem prazo)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Preparação de queries paralelas
  const fluxoInicio = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const fluxoWhere: Record<string, unknown> = {
    dataCompetencia: { gte: fluxoInicio, lte: now },
  };
  if (!canSeeDizimos) {
    fluxoWhere.categoria = { not: "DIZIMO" };
  }

  const queries: [
    Promise<number>,
    Promise<number>,
    Promise<number>,
    Promise<number>,
    Promise<number>,
    Promise<any[]>,
    Promise<any>,
    Promise<any[]>,
    Promise<any[]>
  ] = [
    prisma.membro.count({ where: membroWhere }),
    prisma.membro.count({ where: visitantesMesWhere }),
    prisma.alerta.count({ where: alertasWhere }),
    prisma.itemEstoque.count({ where: { tipo: "CONSUMO", quantidade: { lte: 5 } } }),
    prisma.manutencaoAtivo.count({
      where: {
        dataRetorno: null,
        foiPerdaTotal: false,
        dataEnvio: { lt: thirtyDaysAgo },
        prazoTermino: null,
      },
    }),
    prisma.membro.findMany({
      where: visitanteWhere,
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, nome: true, createdAt: true },
    }),
    canSeeFinance
      ? prisma.caixa.aggregate({
          where: { ativo: true },
          _sum: { saldoCentavos: true },
        })
      : Promise.resolve({ _sum: { saldoCentavos: 0 } }),
    prisma.culto.findMany({
      where: {
        data: { gte: now },
        status: { in: ["AGENDADO", "CONFIRMADO"] },
      },
      orderBy: { data: "asc" },
      take: 3,
      select: { id: true, titulo: true, data: true, horario: true, local: true, status: true },
    }),
    canSeeFinance
      ? prisma.lancamento.findMany({
          where: fluxoWhere,
          orderBy: { dataCompetencia: "asc" },
          select: { tipo: true, valorCentavos: true, dataCompetencia: true },
        })
      : Promise.resolve([]),
  ];

  const [
    membrosAtivos,
    visitantesMes,
    alertasNaoLidos,
    consumoBaixo,
    manutencaoAtrasada,
    ultimosVisitantes,
    caixaAgregado,
    proximosCultos,
    lancamentosFluxo,
  ] = await Promise.all(queries);

  // Base de comparação para as variações vs. mês anterior.
  const [membrosInicioMes, visitantesMesAnterior, movimentoMes] = await Promise.all([
    prisma.membro.count({ where: { ...membroWhere, createdAt: { lt: startOfMonth } } }),
    prisma.membro.count({
      where: { ...visitanteWhere, createdAt: { gte: startOfPrevMonth, lt: startOfMonth } },
    }),
    canSeeFinance
      ? prisma.lancamento.groupBy({
          by: ["tipo"],
          where: { caixa: { ativo: true }, dataCompetencia: { gte: startOfMonth } },
          _sum: { valorCentavos: true },
        })
      : Promise.resolve([] as Array<{ tipo: string; _sum: { valorCentavos: number | null } }>),
  ]);
  const fluxoPorMes = new Map<string, { entradasCentavos: number; saidasCentavos: number }>();
  for (let offset = 0; offset < 6; offset += 1) {
    const date = new Date(fluxoInicio.getFullYear(), fluxoInicio.getMonth() + offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    fluxoPorMes.set(key, { entradasCentavos: 0, saidasCentavos: 0 });
  }
  for (const lancamento of lancamentosFluxo) {
    const date = new Date(lancamento.dataCompetencia);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const mes = fluxoPorMes.get(key);
    if (!mes) continue;
    if (lancamento.tipo === "ENTRADA") mes.entradasCentavos += lancamento.valorCentavos;
    else mes.saidasCentavos += lancamento.valorCentavos;
  }
  const fluxoCaixa = [...fluxoPorMes.entries()].map(([key, valores]) => {
    const [ano, mes] = key.split("-").map(Number);
    return {
      mes: new Date(ano, mes - 1, 1)
        .toLocaleDateString("pt-BR", { month: "short" })
        .replace(".", ""),
      ...valores,
    };
  });

  const saldoTotalCentavos = caixaAgregado._sum.saldoCentavos ?? 0;
  const entradasMes = movimentoMes.find((m) => m.tipo === "ENTRADA")?._sum.valorCentavos ?? 0;
  const saidasMes = movimentoMes.find((m) => m.tipo === "SAIDA")?._sum.valorCentavos ?? 0;
  const saldoInicioMes = saldoTotalCentavos - (entradasMes - saidasMes);
  const variacoes = {
    saldo: canSeeFinance ? variacaoPercentual(saldoTotalCentavos, saldoInicioMes) : null,
    membros: variacaoPercentual(membrosAtivos, membrosInicioMes),
    visitantes: variacaoPercentual(visitantesMes, visitantesMesAnterior),
  };
  const alertasEstoque = consumoBaixo + manutencaoAtrasada;

  // Query para últimas contribuições
  let ultimasContribuicoes: ContribuicaoResumo[] = [];
  if (canSeeFinance) {
    const whereLancamento: any = {
      tipo: "ENTRADA" as const,
      categoria: { in: ["DIZIMO" as const, "OFERTA" as const, "CAMPANHA" as const] },
    };
    if (!canSeeDizimos) {
      whereLancamento.categoria = { in: ["OFERTA" as const, "CAMPANHA" as const] };
    }

    const lancamentos = await prisma.lancamento.findMany({
      where: whereLancamento,
      orderBy: { dataCompetencia: "desc" },
      take: 4,
      include: {
        membro: { select: { nome: true } },
      },
    });

    ultimasContribuicoes = lancamentos.map((l) => {
      let tipoFormatado: "DÍZIMO" | "OFERTA" | "CAMPANHA" | "MISSÕES" = "OFERTA";
      if (l.categoria === "DIZIMO") tipoFormatado = "DÍZIMO";
      if (l.categoria === "CAMPANHA") tipoFormatado = "CAMPANHA";

      return {
        id: l.id,
        contribuinte: l.membro?.nome ?? "Anônimo",
        tipo: tipoFormatado,
        data: l.dataCompetencia,
        valorCentavos: l.valorCentavos,
      };
    });
  }

  return {
    membrosAtivos,
    visitantesMes,
    alertasNaoLidos,
    saldoTotalCentavos,
    alertasEstoque,
    fluxoCaixa,
    ultimasContribuicoes,
    ultimosVisitantes,
    proximosCultos,
    variacoes,
  };
}
