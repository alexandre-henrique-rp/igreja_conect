/**
 * Service de Dashboard — Igreja Conect (S04-T09 / S06-T10).
 *
 * Fornece dados agregados para a página inicial do sistema:
 * - Counts de membros ativos, visitantes do mês, alertas não lidos
 * - Saldo total em caixas ativos, alertas de estoque críticos
 * - Últimas contribuições (entradas de dízimos/ofertas/campanhas)
 * - Últimos 5 visitantes cadastrados
 *
 * **RBAC fina:**
 * - DISCIPULADOR filtra membros por `discipuladorId=user.id`.
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

/** Dados do dashboard retornados ao cliente. */
export type DashboardData = {
  membrosAtivos: number;
  visitantesMes: number;
  alertasNaoLidos: number;
  saldoTotalCentavos: number;
  alertasEstoque: number;
  ultimasContribuicoes: ContribuicaoResumo[];
  ultimosVisitantes: Array<{ id: string; nome: string; createdAt: Date }>;
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
export async function getDashboardData(
  user: SessionUser
): Promise<DashboardData> {
  const isDiscipulador = user.cargo === "DISCIPULADOR";
  const canSeeFinance = user.cargo && ["ADMIN", "PASTOR", "FINANCEIRO", "SECRETARIO"].includes(user.cargo);
  const canSeeDizimos = user.cargo && ["ADMIN", "PASTOR", "FINANCEIRO"].includes(user.cargo);

  // Where base para membros (RBAC fina)
  const membroWhere: { OR?: Array<{ id: string } | { discipuladorId: string }> } =
    isDiscipulador
      ? { OR: [{ id: user.id }, { discipuladorId: user.id }] }
      : {};

  // Where para visitantes
  const visitanteWhere = {
    ...membroWhere,
    tipo: "VISITANTE" as const,
  };

  // Where para visitantes do mês
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
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
  const queries: [
    Promise<number>,
    Promise<number>,
    Promise<number>,
    Promise<number>,
    Promise<number>,
    Promise<any[]>,
    Promise<any>
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
  ];

  const [
    membrosAtivos,
    visitantesMes,
    alertasNaoLidos,
    consumoBaixo,
    manutencaoAtrasada,
    ultimosVisitantes,
    caixaAgregado,
  ] = await Promise.all(queries);

  const saldoTotalCentavos = caixaAgregado._sum.saldoCentavos ?? 0;
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
    ultimasContribuicoes,
    ultimosVisitantes,
  };
}
