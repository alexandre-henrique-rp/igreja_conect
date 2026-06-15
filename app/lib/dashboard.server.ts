/**
 * Service de Dashboard — Igreja Conect (S04-T09).
 *
 * Fornece dados agregados para a página inicial do sistema:
 * - Counts de membros ativos, visitantes do mês, alertas não lidos
 * - Últimos 5 visitantes cadastrados
 *
 * **RBAC fina:** DISCIPULADOR filtra membros por `discipuladorId=user.id`,
 * mas alertasNaoLidos é por destinatário (não filtra por discipuladorId).
 *
 * @see app/lib/dashboard.server.test.ts
 */
import { prisma } from "~/db/prisma.server";
import type { SessionUser } from "./session.types";

/** Dados do dashboard retornados ao cliente. */
export type DashboardData = {
  membrosAtivos: number;
  visitantesMes: number;
  alertasNaoLidos: number;
  ultimosVisitantes: Array<{ id: string; nome: string; createdAt: Date }>;
};

/**
 * Retorna dados agregados para o dashboard.
 *
 * Executa 3 counts em paralelo + 1 query de últimos visitantes.
 * DISCIPULADOR: `membrosAtivos` e `visitantesMes`/`ultimosVisitantes`
 * filtram por `discipuladorId=user.id`.
 *
 * @description 4 queries paralelas via Promise.all.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<DashboardData>} Dados agregados.
 * @example
 *   const data = await getDashboardData(user);
 *   // { membrosAtivos: 42, visitantesMes: 5, alertasNaoLidos: 2, ultimosVisitantes: [...] }
 */
export async function getDashboardData(
  user: SessionUser
): Promise<DashboardData> {
  const isDiscipulador = user.cargo === "DISCIPULADOR";

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

  const [membrosAtivos, visitantesMes, alertasNaoLidos, ultimosVisitantes] =
    await Promise.all([
      prisma.membro.count({ where: membroWhere }),
      prisma.membro.count({ where: visitantesMesWhere }),
      prisma.alerta.count({ where: alertasWhere }),
      prisma.membro.findMany({
        where: visitanteWhere,
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, nome: true, createdAt: true },
      }),
    ]);

  return {
    membrosAtivos,
    visitantesMes,
    alertasNaoLidos,
    ultimosVisitantes,
  };
}
