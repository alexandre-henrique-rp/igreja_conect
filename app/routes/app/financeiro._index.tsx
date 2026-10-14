/**
 * Rota /app/financeiro — Dashboard Financeiro.
 *
 * Estrutura 100% casada com `docs/Igreja-Conect-Design-System/financeiro.html`:
 *  1. page-header (eyebrow + h1 + ações Relatórios / Novo lançamento)
 *  2. grid-4 com 4 KPIs (Saldo total / Entradas / Saídas / Aprovações)
 *  3. two-thirds section (Caixas card + Distribuição por categoria donut)
 *  4. finance-table-card (Lançamentos recentes + finance-tabs + tabela + pagination)
 *
 * **RBAC:** assertCanSeeFinancialModule aplicado no loader.
 */
import { Link } from "react-router";
import { useState, useMemo } from "react";
import type { Route } from "./+types/financeiro._index";
import { userContext } from "~/lib/user-context";
import { assertCanSeeFinancialModule } from "~/lib/rbac.server";
import { getDashboardFinanceiro } from "~/lib/finance.server";
import { Can } from "~/components/Can";
import { prisma } from "~/db/prisma.server";
import { formatBRLFromCents } from "~/lib/money-format";
import {
  Badge,
  Card,
  CardHeader,
  Icon,
  PageHeader,
} from "~/components/ds";
import { cn } from "~/lib/cn";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Financeiro — Igreja Conect" }];
}

/**
 * Loader do Dashboard Financeiro.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }
  assertCanSeeFinancialModule(user);

  const data = await getDashboardFinanceiro(user);

  const whereLancamento = user.cargo === "SECRETARIO"
    ? { categoria: { not: "DIZIMO" as const } }
    : {};

  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalEntradasMesAgg,
    totalSaidasMesAgg,
    allLancamentos,
    totalCaixasAtivosRaw,
    totalPendentesRaw,
  ] = await Promise.all([
    prisma.lancamento.aggregate({
      where: { ...whereLancamento, tipo: "ENTRADA", dataCompetencia: { gte: firstDayOfMonth } },
      _sum: { valorCentavos: true },
    }),
    prisma.lancamento.aggregate({
      where: { ...whereLancamento, tipo: "SAIDA", dataCompetencia: { gte: firstDayOfMonth } },
      _sum: { valorCentavos: true },
    }),
    prisma.lancamento.findMany({
      where: whereLancamento,
      orderBy: { dataCompetencia: "desc" },
      take: 6,
      include: {
        caixa: { select: { nome: true } },
      },
    }),
    prisma.caixa.count({ where: { ativo: true } }),
    prisma.lancamento.count({
      where: {
        ...whereLancamento,
        status: "PENDENTE",
      },
    }),
  ]);

  const totalEntradasMesCentavos = totalEntradasMesAgg._sum.valorCentavos ?? 0;
  const totalSaidasMesCentavos = totalSaidasMesAgg._sum.valorCentavos ?? 0;
  const totalCaixasAtivos = totalCaixasAtivosRaw;

  return {
    user,
    caixas: data.caixas,
    ultimosLancamentos: data.ultimosLancamentos,
    todosLancamentos: allLancamentos,
    saldoAgregadoCentavos: data.saldoAgregadoCentavos,
    totalCaixasAtivos,
    totalEntradasMesCentavos,
    totalSaidasMesCentavos,
    totalPendentes: totalPendentesRaw,
    dataAtualizacao: new Date().toISOString(),
  };
}

function formatDateBR(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = d
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "");
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export default function DashboardFinanceiro({ loaderData }: Route.ComponentProps) {
  const { user, caixas, todosLancamentos, saldoAgregadoCentavos, totalCaixasAtivos, totalEntradasMesCentavos, totalSaidasMesCentavos, totalPendentes } =
    loaderData;

  const fmt = formatBRLFromCents;

  const totalCaixasCount = caixas.length;

  const [activeTab, setActiveTab] = useState<"all" | "pending" | "approved" | "rejected">(
    "all",
  );

  const recentLancamentos = useMemo(() => {
    return todosLancamentos.slice(0, 6).map((l) => {
      const statusLabel =
        l.status === "PAGO" ? "APROVADO" : l.status === "PENDENTE" ? "PENDENTE" : "REJEITADO";
      return {
        id: l.id,
        dataStr: formatDateBR(new Date(l.dataCompetencia)),
        descricao: l.descricao,
        categoria: l.categoria,
        caixaNome: l.caixa?.nome ?? "—",
        tipo: l.tipo,
        valorCentavos: l.valorCentavos,
        status: statusLabel,
      };
    });
  }, [todosLancamentos]);

  const filteredLancamentos = useMemo(() => {
    if (activeTab === "all") return recentLancamentos;
    if (activeTab === "approved") return recentLancamentos;
    return [];
  }, [activeTab, recentLancamentos]);

  // Donut chart — proporções fixas do design system
  const donutPercent = [
    { label: "Dízimos", pct: 38, color: "var(--color-accent)" },
    { label: "Ofertas", pct: 25, color: "var(--color-success)" },
    { label: "Despesas", pct: 18, color: "var(--color-warning)" },
    { label: "Outros", pct: 19, color: "var(--color-info)" },
  ];
  let cum = 0;
  const donutGradient = donutPercent
    .map((s) => `${s.color} ${cum}% ${(cum += s.pct)}%`)
    .join(", ");

  return (
    <div>
      {/* === Page header === */}
      <div className="page-header">
        <div>
          <span className="eyebrow">Gestão financeira</span>
          <h1>Financeiro</h1>
          <p>Visão geral das finanças da igreja.</p>
        </div>
        <div className="page-actions">
          <Link
            to="/app/financeiro/relatorios"
            className="btn btn-secondary inline-flex items-center gap-1.5"
          >
            <Icon name="download" size="sm" />
            Relatórios
          </Link>
          <Can
            user={user ?? { id: "", nome: "", cargo: "ADMIN" }}
            allow={["ADMIN", "PASTOR", "FINANCEIRO"]}
          >
            <Link
              to="/app/financeiro/lancamentos/novo"
              className="btn btn-primary inline-flex items-center gap-1.5"
            >
              <Icon name="plus" size="sm" />
              Novo lançamento
            </Link>
          </Can>
        </div>
      </div>

      {/* === grid-4 KPIs === */}
      <section className="grid-4">
        <article className="card kpi">
          <div className="kpi-top">
            <span className="kpi-label">Saldo total</span>
            <span className="stat-icon">
              <Icon name="wallet" size="md" />
            </span>
          </div>
          <div className="kpi-value mono">{fmt(saldoAgregadoCentavos)}</div>
          <div className="kpi-meta">
            <span className="subtle">em {totalCaixasAtivos} caixas ativos</span>
          </div>
        </article>

        <article className="card kpi">
          <div className="kpi-top">
            <span className="kpi-label">Entradas do mês</span>
            <span className="stat-icon success">
              <Icon name="trending-up" size="md" />
            </span>
          </div>
          <div className="kpi-value mono">{fmt(totalEntradasMesCentavos)}</div>
          <div className="kpi-meta">
            <span className="delta-up">▲ 12%</span>
            <span className="subtle">vs. mês anterior</span>
          </div>
        </article>

        <article className="card kpi">
          <div className="kpi-top">
            <span className="kpi-label">Saídas do mês</span>
            <span className="stat-icon warning">
              <Icon name="trending-down" size="md" />
            </span>
          </div>
          <div className="kpi-value mono">{fmt(totalSaidasMesCentavos)}</div>
          <div className="kpi-meta">
            <span className="delta-up">▲ 5%</span>
            <span className="subtle">vs. mês anterior</span>
          </div>
        </article>

        <article className="card kpi">
          <div className="kpi-top">
            <span className="kpi-label">Aprovações pendentes</span>
            <span className="stat-icon danger">
              <Icon name="alert-triangle" size="md" />
            </span>
          </div>
          <div className="kpi-value">{totalPendentes}</div>
          <div className="kpi-meta">
            <Link
              to="/app/financeiro/lancamentos"
              className="card-link flex items-center gap-1"
              style={{ marginTop: 0 }}
            >
              Revisar agora
              <Icon name="chevron-right" size="sm" />
            </Link>
          </div>
        </article>
      </section>

      {/* === two-thirds: Caixas + Distribuição por categoria === */}
      <section className="two-thirds section-gap">
        <article className="card">
          <CardHeader
            title="Caixas"
            actions={
              <Link
                to="/app/financeiro/caixas"
                className="card-link flex items-center gap-1"
                style={{ marginTop: 0 }}
              >
                Ver caixas <Icon name="chevron-right" size="sm" />
              </Link>
            }
          />
          <div className="cash-grid">
            {caixas.slice(0, 4).map((caixa) => (
              <Link
                key={caixa.id}
                to={`/app/financeiro/caixas/${caixa.id}`}
                className="card card-hover cash-card"
                aria-label={`Caixa ${caixa.nome}, saldo ${fmt(caixa.saldoCentavos)}`}
              >
                <div className="cash-card-top">
                  <span className="cash-name">{caixa.nome}</span>
                  <span className="cash-icon">
                    <Icon name="wallet" size="sm" />
                  </span>
                </div>
                <div className="cash-balance mono">{fmt(caixa.saldoCentavos)}</div>
                <div className="cash-meta">
                  <span>
                    <strong>{totalCaixasCount}</strong> caixas
                  </span>
                  <span>
                    <strong>saldo total</strong>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </article>

        <article className="card">
          <CardHeader
            title="Distribuição por categoria"
            actions={<span className="badge badge-neutral">Setembro</span>}
          />
          <div className="donut-wrap">
            <div
              className="donut"
              style={{ background: `conic-gradient(${donutGradient})` }}
              aria-label="Distribuição: dízimos 38%, ofertas 25%, despesas 18%, outros 19%"
            >
              <div className="donut-center">
                <strong>R$ 27,6k</strong>
                <span>movimentado</span>
              </div>
            </div>
            <div className="legend-list">
              {donutPercent.map((item) => (
                <div key={item.label} className="legend-row">
                  <span className="legend-label">
                    <i
                      className="legend-swatch"
                      style={{ background: item.color }}
                    />
                    {item.label}
                  </span>
                  <strong>{item.pct}%</strong>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      {/* === finance-table-card: Lançamentos recentes === */}
      <section className="card finance-table-card section-gap">
        <CardHeader
          title="Lançamentos recentes"
          actions={
            <Link
              to="/app/financeiro/lancamentos"
              className="card-link flex items-center gap-1"
              style={{ marginTop: 0 }}
            >
              Ver todos <Icon name="chevron-right" size="sm" />
            </Link>
          }
        />
        <div className="finance-tabs">
          <div className="tabs">
            <button
              type="button"
              className={cn("tab", activeTab === "all" && "active")}
              onClick={() => setActiveTab("all")}
              data-testid="finance-tab-all"
            >
              Todos
            </button>
            <button
              type="button"
              className={cn(
                "tab flex items-center gap-1.5",
                activeTab === "pending" && "active",
              )}
              onClick={() => setActiveTab("pending")}
              data-testid="finance-tab-pending"
            >
              Pendentes
              {totalPendentes > 0 && (
                <span className="badge badge-warning">{totalPendentes}</span>
              )}
            </button>
            <button
              type="button"
              className={cn("tab", activeTab === "approved" && "active")}
              onClick={() => setActiveTab("approved")}
              data-testid="finance-tab-approved"
            >
              Aprovados
            </button>
            <button
              type="button"
              className={cn("tab", activeTab === "rejected" && "active")}
              onClick={() => setActiveTab("rejected")}
              data-testid="finance-tab-rejected"
            >
              Rejeitados
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Caixa</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredLancamentos.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-subtle"
                  >
                    Nenhum lançamento encontrado.
                  </td>
                </tr>
              ) : (
                filteredLancamentos.map((l) => (
                  <tr key={l.id}>
                    <td className="mono">{l.dataStr}</td>
                    <td>
                      <strong>{l.descricao}</strong>
                    </td>
                    <td>
                      <Badge
                        tone={
                          l.categoria === "DIZIMO" || l.categoria === "OFERTA"
                            ? "accent"
                            : l.categoria === "COMPRA_ESTOQUE" ||
                                l.categoria === "MANUTENCAO" ||
                                l.categoria === "DESPESA_OPERACIONAL"
                              ? "warning"
                              : "info"
                        }
                      >
                        {l.categoria === "DIZIMO"
                          ? "Dízimo"
                          : l.categoria === "OFERTA"
                            ? "Oferta"
                            : l.categoria === "COMPRA_ESTOQUE"
                              ? "Compra"
                              : l.categoria === "MANUTENCAO"
                                ? "Manutenção"
                                : l.categoria === "DESPESA_OPERACIONAL"
                                  ? "Despesa"
                                  : "Outros"}
                      </Badge>
                    </td>
                    <td>{l.caixaNome}</td>
                    <td
                      className={cn(
                        "mono",
                        l.tipo === "ENTRADA" ? "amount-in" : "amount-out",
                      )}
                    >
                      {l.tipo === "ENTRADA" ? "+" : "−"} {fmt(l.valorCentavos)}
                    </td>
                    <td>
                      <Badge
                        tone={
                          l.status === "APROVADO"
                            ? "success"
                            : l.status === "PENDENTE"
                              ? "warning"
                              : "danger"
                        }
                      >
                        {l.status === "APROVADO"
                          ? "Aprovado"
                          : l.status === "PENDENTE"
                            ? "Pendente"
                            : "Rejeitado"}
                      </Badge>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon btn-sm"
                        aria-label="Mais ações"
                      >
                        <Icon name="more-vertical" size="sm" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>
            Mostrando 1–{Math.min(6, filteredLancamentos.length)} de{" "}
            {recentLancamentos.length} lançamentos
          </span>
          <div className="pagination">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled
              aria-label="Página anterior"
            >
              <Icon
                name="chevron-right"
                size="sm"
                className="rotate-180"
              />
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              aria-current="page"
            >
              1
            </button>
            <button type="button" className="btn btn-secondary btn-sm">
              2
            </button>
            <button type="button" className="btn btn-secondary btn-sm">
              3
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              aria-label="Próxima página"
            >
              <Icon name="chevron-right" size="sm" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}