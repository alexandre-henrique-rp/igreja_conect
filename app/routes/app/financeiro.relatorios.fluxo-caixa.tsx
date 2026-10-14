/**
 * Rota /app/financeiro/relatorios/fluxo-caixa — Fluxo de Caixa (cycle 4, S15).
 *
 * Dados reais do banco.
 *
 * @see design/relatorios-fluxo-caixa.DESIGN.md
 */
import { Form, Link } from "react-router";
import type { Route } from "./+types/financeiro.relatorios.fluxo-caixa";
import { userContext } from "~/lib/user-context";
import { assertCanSeeRelatorios } from "~/lib/rbac.server";
import { formatBRLFromCents } from "~/lib/money-format";
import { getFluxoCaixa, exportarFluxoCaixaCSV, getContasAPagar, getProjecao3Meses, getFluxoMensal } from "~/lib/relatorios.server";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Fluxo de Caixa — Igreja Conect" }];
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeRelatorios(user);

  const formData = await request.formData();
  const dataInicio = formData.get("dataInicio");
  const dataFim = formData.get("dataFim");

  const hoje = new Date();
  const dtInicio = typeof dataInicio === "string" && dataInicio ? new Date(dataInicio) : new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const dtFim = typeof dataFim === "string" && dataFim ? new Date(dataFim) : new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

  const csv = await exportarFluxoCaixaCSV(user, dtInicio, dtFim);
  const filename = `fluxo-caixa-${dtInicio.toISOString().split("T")[0]}-a-${dtFim.toISOString().split("T")[0]}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeRelatorios(user);

  const url = new URL(request.url);
  const dataInicioParam = url.searchParams.get("dataInicio");
  const dataFimParam = url.searchParams.get("dataFim");

  const hoje = new Date();
  const dataInicio = dataInicioParam ? new Date(dataInicioParam) : new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const dataFim = dataFimParam ? new Date(dataFimParam) : new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

  const [dados, contasAPagarCentavos, projecao, fluxoMensal] = await Promise.all([
    getFluxoCaixa(user, dataInicio, dataFim),
    getContasAPagar(user),
    getProjecao3Meses(user, dataFim),
    getFluxoMensal(user, dataInicio, dataFim),
  ]);

  return {
    user,
    ...dados,
    periodo: `${dados.periodo.dataInicio} - ${dados.periodo.dataFim}`,
    periodoIni: dados.periodo.dataInicio,
    periodoFim: dados.periodo.dataFim,
    kpis: {
      entradasCentavos: dados.entradas.reduce((sum: number, e: any) => sum + e.valorCentavos, 0),
      saidasCentavos: dados.saidas.reduce((sum: number, s: any) => sum + s.valorCentavos, 0),
      saldoCentavos: dados.saldoFinalCentavos,
      contasAPagarCentavos,
    },
    projecao,
    fluxoMensal,
  };
}

const IconChevron = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" /></svg>
);
const IconCalendar = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V10h14v10z" /></svg>
);
const IconDownload = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" /></svg>
);

export default function FluxoCaixaPage({ loaderData }: Route.ComponentProps) {
  const { periodo, periodoIni, periodoFim, kpis, projecao, fluxoMensal } = loaderData;
  const totalProjEntradas = projecao.reduce((s, p) => s + p.entradasCentavos, 0);
  const totalProjSaidas = projecao.reduce((s, p) => s + p.saidasCentavos, 0);
  const totalProjSaldo = totalProjEntradas - totalProjSaidas;

  const maxValor = Math.max(...fluxoMensal.map((m) => Math.max(m.entradasCentavos, m.saidasCentavos)), 1);
  const maxSaldo = Math.max(...fluxoMensal.map((m) => Math.abs(m.saldoCentavos)), 1);
  const isSuperavit = kpis.saldoCentavos >= 0;
  const percentualSaldo = kpis.entradasCentavos > 0 ? Math.round((kpis.saldoCentavos / kpis.entradasCentavos) * 100) : 0;

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-8 bg-surface-2 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-muted text-xs mb-1 uppercase tracking-wider font-semibold">
            <Link to="/app/financeiro/relatorios" className="hover:text-accent">Relatórios</Link>
            <span className="text-border-strong">{IconChevron}</span>
            <span className="text-accent">Fluxo de Caixa</span>
          </div>
          <h2 className="text-3xl font-bold text-fg">Fluxo de Caixa</h2>
          <p className="text-muted mt-1">Monitore as entradas e saídas consolidadas da sua igreja.</p>
        </div>
        <Form method="get" className="flex items-center gap-3">
          <div className="flex flex-col">
            <label htmlFor="dataInicio" className="text-[10px] uppercase font-bold text-subtle px-1">Início</label>
            <input
              id="dataInicio"
              name="dataInicio"
              aria-label="Data inicial"
              type="date"
              defaultValue={periodoIni}
              className="bg-surface border border-border rounded-lg h-10 px-3 text-sm font-medium focus:border-accent focus:ring-2 focus:ring-accent-soft-2 outline-none transition-all"
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="dataFim" className="text-[10px] uppercase font-bold text-subtle px-1">Fim</label>
            <input
              id="dataFim"
              name="dataFim"
              aria-label="Data final"
              type="date"
              defaultValue={periodoFim}
              className="bg-surface border border-border rounded-lg h-10 px-3 text-sm font-medium focus:border-accent focus:ring-2 focus:ring-accent-soft-2 outline-none transition-all"
            />
          </div>
          <button
            type="submit"
            className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent-strong shadow-md shadow-accent/20 transition-all h-10"
          >
            <span className="text-white">{IconCalendar}</span>
            <span>Aplicar</span>
          </button>
        </Form>
        <Form method="post" className="inline-flex">
          <input type="hidden" name="dataInicio" value={periodoIni} />
          <input type="hidden" name="dataFim" value={periodoFim} />
          <button
            type="submit"
            className="flex items-center gap-2 bg-success text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-success transition-colors h-10"
            title="Exportar Fluxo de Caixa em CSV"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" /></svg>
            Exportar CSV
          </button>
        </Form>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-surface p-6 rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-success-soft text-success rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            </div>
            <span className="text-[10px] font-bold text-success bg-success-soft px-2 py-0.5 rounded-full">{percentualSaldo}% margem</span>
          </div>
          <p className="text-muted text-xs font-medium">Entradas Totais</p>
          <h4 className="text-2xl font-bold text-fg mt-1">{formatBRLFromCents(kpis.entradasCentavos)}</h4>
        </div>
        <div className="bg-surface p-6 rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-danger-soft text-danger rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" /></svg>
            </div>
            <span className="text-[10px] font-bold text-danger bg-danger-soft px-2 py-0.5 rounded-full">{kpis.entradasCentavos > 0 ? Math.round((kpis.saidasCentavos / kpis.entradasCentavos) * 100) : 0}% das entradas</span>
          </div>
          <p className="text-muted text-xs font-medium">Saídas Totais</p>
          <h4 className="text-2xl font-bold text-fg mt-1">{formatBRLFromCents(kpis.saidasCentavos)}</h4>
        </div>
        <div className="bg-surface p-6 rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-accent-soft-2 text-accent rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            </div>
            <span className="text-[10px] font-bold text-accent bg-accent-soft-2 px-2 py-0.5 rounded-full">{isSuperavit ? "Superávit" : "Déficit"}</span>
          </div>
          <p className="text-muted text-xs font-medium">Saldo Acumulado</p>
          <h4 className="text-2xl font-bold text-fg mt-1">{formatBRLFromCents(kpis.saldoCentavos)}</h4>
        </div>
        <div className="bg-surface p-6 rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-warning-soft text-warning rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" /></svg>
            </div>
            <span className="text-[10px] font-bold text-warning bg-warning-soft px-2 py-0.5 rounded-full">Atenção</span>
          </div>
          <p className="text-muted text-xs font-medium">Contas a Pagar (30d)</p>
          <h4 className="text-2xl font-bold text-fg mt-1">{formatBRLFromCents(kpis.contasAPagarCentavos)}</h4>
        </div>
      </div>

      {/* Gráfico SVG de série temporal */}
      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-2 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-fg">Histórico de Fluxo de Caixa</h3>
            <p className="text-xs text-muted">Comparativo mensal de desempenho financeiro</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-success"></span>
              <span className="text-xs text-muted font-medium">Entradas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-danger"></span>
              <span className="text-xs text-muted font-medium">Saídas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-full border-b-2 border-dashed border-accent"></span>
              <span className="text-xs text-muted font-medium">Saldo</span>
            </div>
          </div>
        </div>
        <div className="p-8">
          <div className="relative h-[300px] w-full">
            {fluxoMensal.length > 0 ? (
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox={`0 0 ${fluxoMensal.length * 100} 300`}>
                <g className="grid-lines">
                  {[50, 125, 200, 275].map((y) => (
                    <line key={y} x1="0" x2={fluxoMensal.length * 100} y1={y} y2={y} stroke="var(--color-border)" strokeWidth="1" />
                  ))}
                </g>
                {fluxoMensal.map((m, i) => {
                  const x = i * 100 + 50;
                  const yEntrada = 275 - (m.entradasCentavos / maxValor) * 225;
                  const ySaida = 275 - (m.saidasCentavos / maxValor) * 225;
                  const ySaldo = 275 - (Math.abs(m.saldoCentavos) / maxSaldo) * 225;
                  return (
                    <g key={i}>
                      {i > 0 && (
                        <>
                          <line x1={(i - 1) * 100 + 50} y1={275 - (fluxoMensal[i - 1].entradasCentavos / maxValor) * 225} x2={x} y2={yEntrada} stroke="var(--color-success)" strokeWidth="3" />
                          <line x1={(i - 1) * 100 + 50} y1={275 - (fluxoMensal[i - 1].saidasCentavos / maxValor) * 225} x2={x} y2={ySaida} stroke="var(--color-danger)" strokeWidth="3" />
                          <line x1={(i - 1) * 100 + 50} y1={275 - (Math.abs(fluxoMensal[i - 1].saldoCentavos) / maxSaldo) * 225} x2={x} y2={ySaldo} stroke="var(--color-info)" strokeWidth="3" strokeDasharray="6 4" />
                        </>
                      )}
                      <circle cx={x} cy={yEntrada} r="3" fill="var(--color-success)" />
                      <circle cx={x} cy={ySaida} r="3" fill="var(--color-danger)" />
                      <circle cx={x} cy={ySaldo} r="3" fill="var(--color-info)" />
                    </g>
                  );
                })}
              </svg>
            ) : (
              <div className="flex items-center justify-center h-full text-subtle text-sm">Sem dados para o período selecionado</div>
            )}
            <div className="flex justify-between mt-4 text-[10px] text-subtle font-medium px-2">
              {fluxoMensal.map((m, i) => (
                <span key={i}>{m.mes}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Projeção 30 dias + Análise de Tendência */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-surface rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-surface-2 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-fg">Projeção Próximos 30 dias</h3>
              <p className="text-xs text-muted">Estimativa baseada em recorrências e previsões</p>
            </div>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-sm">
<caption className="sr-only">Fluxo de caixa previsto por período</caption>
              <thead className="bg-surface-2 border-b border-surface-2">
                <tr>
                  <th scope="col" className="px-6 py-3 font-medium text-muted uppercase text-[10px] tracking-wider">Período</th>
                  <th scope="col" className="px-6 py-3 font-medium text-muted uppercase text-[10px] tracking-wider">Entradas Previstas</th>
                  <th scope="col" className="px-6 py-3 font-medium text-muted uppercase text-[10px] tracking-wider">Saídas Previstas</th>
                  <th scope="col" className="px-6 py-3 font-medium text-muted uppercase text-[10px] tracking-wider text-right">Saldo Estimado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-2">
                {projecao.map((p) => (
                  <tr key={p.periodo} className="hover:bg-surface-2 transition-colors">
                    <td className="px-6 py-4 font-medium text-fg">{p.periodo}</td>
                    <td className="px-6 py-4 text-success font-medium">+ {formatBRLFromCents(p.entradasCentavos)}</td>
                    <td className="px-6 py-4 text-danger font-medium">- {formatBRLFromCents(p.saidasCentavos)}</td>
                    <td className="px-6 py-4 text-right font-bold text-fg">{formatBRLFromCents(p.saldoCentavos)}</td>
                  </tr>
                ))}
                <tr className="bg-accent-soft-2/30">
                  <td className="px-6 py-4 font-bold text-accent-strong">Total Projetado</td>
                  <td className="px-6 py-4 text-success font-bold">+ {formatBRLFromCents(totalProjEntradas)}</td>
                  <td className="px-6 py-4 text-danger font-bold">- {formatBRLFromCents(totalProjSaidas)}</td>
                  <td className="px-6 py-4 text-right font-extrabold text-accent-strong">{formatBRLFromCents(totalProjSaldo)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-fg text-white rounded-xl shadow-xl p-6 flex flex-col">
          <div className="mb-6">
            <h3 className="text-base font-semibold">Análise de Tendência</h3>
            <p className="text-xs text-subtle">Insights gerados automaticamente</p>
          </div>
          <div className="space-y-6 flex-1">
            <div className="bg-fg/50 p-4 rounded-lg border border-fg">
              <div className="flex items-center gap-3 mb-2">
                <span className={isSuperavit ? "text-success" : "text-danger"}>{isSuperavit ? "✓" : "⚠"}</span>
                <span className="text-sm font-medium">{isSuperavit ? "Superávit no Período" : "Déficit no Período"}</span>
              </div>
              <p className="text-xs text-subtle leading-relaxed">
                {isSuperavit
                  ? `As entradas superaram as saídas em ${percentualSaldo}% no período. Saldo final de ${formatBRLFromCents(kpis.saldoCentavos)}.`
                  : `As saídas superaram as entradas. Saldo negativo de ${formatBRLFromCents(Math.abs(kpis.saldoCentavos))}.`
                }
              </p>
            </div>
            {kpis.contasAPagarCentavos > 0 && (
              <div className="bg-fg/50 p-4 rounded-lg border border-fg">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-warning">⚠</span>
                  <span className="text-sm font-medium">Contas Pendentes</span>
                </div>
                <p className="text-xs text-subtle leading-relaxed">Há ${formatBRLFromCents(kpis.contasAPagarCentavos)} em lançamentos pendentes ou agendados a serem processados.</p>
              </div>
            )}
          </div>
          <div className="mt-8">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-subtle">Saúde Financeira</span>
              <span className={isSuperavit ? "text-success font-bold" : "text-danger font-bold"}>{isSuperavit ? "Saudável" : "Atenção"}</span>
            </div>
            <div className="w-full bg-fg h-1.5 rounded-full overflow-hidden">
              <div className={`${isSuperavit ? "bg-success" : "bg-danger"} h-full transition-all duration-1000`} style={{ width: `${Math.min(100, Math.max(5, percentualSaldo))}%` }}></div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
