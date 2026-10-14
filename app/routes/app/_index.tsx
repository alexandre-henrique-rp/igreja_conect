import type { Route } from "./+types/_index";
import { userContext } from "~/lib/user-context";
import { getDashboardData } from "~/lib/dashboard.server";
import { Link } from "react-router";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Icon,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ds";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Igreja Conect" }];
}

/** Meta do KPI: variação real vs. mês anterior quando existe; senão, só a legenda. */
function KpiMeta({ variacao, legenda }: { variacao: number | null; legenda: string }) {
  if (variacao === null) {
    return (
      <div className="kpi-meta">
        <span className="subtle">{legenda}</span>
      </div>
    );
  }
  const sobe = variacao >= 0;
  return (
    <div className="kpi-meta">
      <span className={sobe ? "delta-up" : "delta-down"}>
        {sobe ? "▲" : "▼"} {Math.abs(variacao)}%
      </span>
      <span className="subtle">vs. mês anterior</span>
    </div>
  );
}

function formatChartValue(valueCentavos: number) {
  return `R$ ${(valueCentavos / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getChartPoints(values: number[], maxValue: number) {
  const width = 560;
  const height = 120;
  const baseline = 150;
  const step = values.length > 1 ? width / (values.length - 1) : width;

  return values.map((value, index) => {
    const x = values.length > 1 ? index * step : width / 2;
    const y = baseline - (value / maxValue) * height;
    return { x, y };
  });
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }
  const stats = await getDashboardData(user);
  return { user, stats };
}

export default function AppIndex({ loaderData }: Route.ComponentProps) {
  const user = loaderData.user;
  const stats = {
    membrosAtivos: loaderData.stats?.membrosAtivos ?? 0,
    visitantesMes: loaderData.stats?.visitantesMes ?? 0,
    alertasNaoLidos: loaderData.stats?.alertasNaoLidos ?? 0,
    saldoTotalCentavos: loaderData.stats?.saldoTotalCentavos ?? 0,
    alertasEstoque: loaderData.stats?.alertasEstoque ?? 0,
    fluxoCaixa: loaderData.stats?.fluxoCaixa ?? [],
    ultimasContribuicoes: loaderData.stats?.ultimasContribuicoes ?? [],
    ultimosVisitantes: loaderData.stats?.ultimosVisitantes ?? [],
    proximosCultos: loaderData.stats?.proximosCultos ?? [],
    variacoes: loaderData.stats?.variacoes ?? { saldo: null, membros: null, visitantes: null },
  };

  const displaySaldo = `R$ ${(stats.saldoTotalCentavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const displayMembrosAtivos = stats.membrosAtivos.toLocaleString("pt-BR");
  const displayVisitantes = stats.visitantesMes.toString();
  const displayAlertasEstoque = `${stats.alertasEstoque} crítico${stats.alertasEstoque === 1 ? "" : "s"}`;
  const fluxoCaixa = stats.fluxoCaixa ?? [];
  const maxFluxo = Math.max(
    ...fluxoCaixa.flatMap((mes) => [mes.entradasCentavos, mes.saidasCentavos]),
    1,
  );
  const entradasPoints = getChartPoints(
    fluxoCaixa.map((mes) => mes.entradasCentavos),
    maxFluxo,
  );
  const saidasPoints = getChartPoints(
    fluxoCaixa.map((mes) => mes.saidasCentavos),
    maxFluxo,
  );
  const pointsToString = (points: Array<{ x: number; y: number }>) =>
    points.map(({ x, y }) => `${x},${y}`).join(" ");

  const contribuidos = stats.ultimasContribuicoes.map((c) => ({
    id: c.id,
    contribuinte: c.contribuinte,
    tipo: c.tipo,
    dataStr:
      new Date(c.data).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }) +
      ", " +
      new Date(c.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    valor: `R$ ${(c.valorCentavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
  }));

  const tipoBadgeTone = (tipo: string) => {
    switch (tipo) {
      case "OFERTA":
        return "success" as const;
      case "MISSÕES":
        return "accent" as const;
      case "CAMPANHA":
        return "warning" as const;
      default:
        return "neutral" as const;
    }
  };

  const getInitials = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();

  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="dashboard-page" data-od-id="dashboard-page">
      <div className="page-header" data-od-id="dashboard-header">
        <div>
          <span className="eyebrow">{hoje}</span>
          <h1>Olá, {user.nome.split(" ")[0]}</h1>
          <p>Aqui está o resumo da sua congregação hoje.</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" size="md">
            <Icon name="download" size="sm" />
            Exportar resumo
          </Button>
        </div>
      </div>

      <section className="grid-4" data-od-id="dashboard-kpis">
        <article className="card kpi">
          <div className="kpi-top">
            <span className="kpi-label">Saldo financeiro</span>
            <span className="stat-icon">
              <Icon name="wallet" size="md" />
            </span>
          </div>
          <div className="kpi-value mono">{displaySaldo}</div>
          <KpiMeta variacao={stats.variacoes.saldo} legenda="soma dos caixas ativos" />
        </article>

        <article className="card kpi">
          <div className="kpi-top">
            <span className="kpi-label">Membros ativos</span>
            <span className="stat-icon success">
              <Icon name="users" size="md" />
            </span>
          </div>
          <div className="kpi-value mono">{displayMembrosAtivos}</div>
          <KpiMeta variacao={stats.variacoes.membros} legenda="cadastros na base" />
        </article>

        <article className="card kpi">
          <div className="kpi-top">
            <span className="kpi-label">Visitantes do mês</span>
            <span className="stat-icon warning">
              <Icon name="user-plus" size="md" />
            </span>
          </div>
          <div className="kpi-value mono">{displayVisitantes}</div>
          <KpiMeta variacao={stats.variacoes.visitantes} legenda="cadastrados desde o dia 1º" />
        </article>

        <article className="card kpi" id="alertas">
          <div className="kpi-top">
            <span className="kpi-label">Alertas pendentes</span>
            <span className="stat-icon danger">
              <Icon name="alert-triangle" size="md" />
            </span>
          </div>
          <div className="kpi-value mono">{displayAlertasEstoque}</div>
          <div className="kpi-meta">
            <span className="subtle">estoque baixo e manutenções atrasadas</span>
          </div>
        </article>
      </section>

      <section className="two-thirds section-gap" data-od-id="dashboard-overview">
        <article className="card" data-od-id="dashboard-cashflow">
          <CardHeader
            title="Fluxo de caixa"
            actions={<span className="text-xs font-bold text-muted">Últimos 6 meses</span>}
          />
          <CardBody padding="none">
            <div className="chart">
              <div className="chart-grid" aria-hidden="true">
                <span /><span /><span /><span />
              </div>
              {fluxoCaixa.length > 0 ? (
                <svg
                  className="chart-svg"
                  viewBox="0 0 600 180"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label="Gráfico de entradas e saídas dos últimos 6 meses"
                >
                  <polyline className="in" points={pointsToString(entradasPoints)} />
                  <polyline className="out" points={pointsToString(saidasPoints)} />
                  {fluxoCaixa.map((mes, index) => (
                    <g key={mes.mes}>
                      <title>
                        {mes.mes}: entradas {formatChartValue(mes.entradasCentavos)}, saídas {formatChartValue(mes.saidasCentavos)}
                      </title>
                      <circle
                        cx={entradasPoints[index]?.x}
                        cy={entradasPoints[index]?.y}
                        r="4"
                        fill="var(--color-accent)"
                      />
                      <circle
                        cx={saidasPoints[index]?.x}
                        cy={saidasPoints[index]?.y}
                        r="4"
                        fill="var(--color-success)"
                      />
                    </g>
                  ))}
                </svg>
              ) : (
                <div className="grid h-full min-h-48 place-items-center text-sm text-muted">
                  Nenhum lançamento financeiro no período.
                </div>
              )}
              <div className="chart-labels">
                {fluxoCaixa.map((mes) => <span key={mes.mes}>{mes.mes}</span>)}
              </div>
            </div>
            <div className="chart-legend">
              <span><i className="legend-indigo" />Entradas</span>
              <span><i className="legend-green" />Saídas</span>
            </div>
          </CardBody>
        </article>

        <article className="card" data-od-id="dashboard-cults">
          <CardHeader
            title="Próximos cultos"
            actions={
              <Link to="/app/eventos" className="card-link flex items-center gap-1 text-xs font-bold text-accent-strong hover:underline">
                Ver agenda <Icon name="chevron-right" size="sm" />
              </Link>
            }
          />
          <CardBody padding="none">
            {stats.proximosCultos.length > 0 ? (
              <div className="event-list">
                {stats.proximosCultos.slice(0, 4).map((culto, idx) => {
                  const d = new Date(culto.data);
                  const mes = d
                    .toLocaleDateString("pt-BR", { month: "short" })
                    .replace(".", "")
                    .toUpperCase()
                    .slice(0, 3);
                  const dia = d.toLocaleDateString("pt-BR", { day: "2-digit" });
                  return (
                    <div key={culto.id} className="event-row">
                      <div className="date-tile">
                        <strong>{dia}</strong>
                        <span>{mes}</span>
                      </div>
                      <div className="event-copy">
                        <strong>{culto.titulo}</strong>
                        <span>
                          {culto.horario}
                          {culto.local ? ` · ${culto.local}` : ""}
                        </span>
                      </div>
                      <Badge tone={culto.status === "CONFIRMADO" ? "success" : "warning"} size="sm">
                        {culto.status === "CONFIRMADO" ? "Confirmado" : "Pendente"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<Icon name="calendar" size="md" />}
                title="Nenhum culto agendado"
              />
            )}
          </CardBody>
        </article>
      </section>

      <section className="section-gap" data-od-id="dashboard-contributions">
        <article className="card">
          <CardHeader
            title="Últimas contribuições"
            actions={
              <Link to="/app/financeiro" className="card-link flex items-center gap-1 text-xs font-bold text-accent-strong hover:underline">
                Ver todas <Icon name="chevron-right" size="sm" />
              </Link>
            }
          />
          <CardBody padding="none">
            {contribuidos.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contribuinte</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contribuidos.slice(0, 6).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span className="h-8 w-8 rounded-full bg-surface-2 text-muted grid place-items-center font-bold text-xs border border-border">
                            {getInitials(c.contribuinte)}
                          </span>
                          <strong className="text-fg">{c.contribuinte}</strong>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge tone={tipoBadgeTone(c.tipo)} size="sm">
                          {c.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-muted">{c.dataStr}</TableCell>
                      <TableCell className="text-right font-bold text-fg">{c.valor}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                icon={<Icon name="trending-down" size="md" />}
                title="Nenhuma contribuição registrada ainda."
              />
            )}
          </CardBody>
        </article>
      </section>
    </div>
  );
}