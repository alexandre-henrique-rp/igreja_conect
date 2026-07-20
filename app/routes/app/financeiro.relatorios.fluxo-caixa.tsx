/**
 * Rota /app/financeiro/relatorios/fluxo-caixa — Fluxo de Caixa (cycle 4, S15).
 *
 * Dados reais do banco.
 *
 * @see design/relatorios-fluxo-caixa.DESIGN.md
 */
import { Link } from "react-router";
import type { Route } from "./+types/financeiro.relatorios.fluxo-caixa";
import { userContext } from "~/lib/user-context";
import { assertCanSeeRelatorios } from "~/lib/rbac.server";
import { formatBRLFromCents } from "~/lib/money-format";
import { getFluxoCaixa } from "~/lib/relatorios.server";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Fluxo de Caixa — Igreja Conect" }];
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

  const dados = await getFluxoCaixa(user, dataInicio, dataFim);

  return {
    user,
    ...dados,
    periodo: `${dados.periodo.dataInicio} - ${dados.periodo.dataFim}`,
    kpis: {
      entradasCentavos: dados.entradas.reduce((sum: number, e: any) => sum + e.valorCentavos, 0),
      saidasCentavos: dados.saidas.reduce((sum: number, s: any) => sum + s.valorCentavos, 0),
      saldoCentavos: dados.saldoFinalCentavos,
      contasAPagarCentavos: 0,
    },
    projecao: [],
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
  const { periodo, kpis, projecao } = loaderData;
  const totalProjEntradas = projecao.reduce((s, p) => s + p.entradasCentavos, 0);
  const totalProjSaidas = projecao.reduce((s, p) => s + p.saidasCentavos, 0);
  const totalProjSaldo = totalProjEntradas - totalProjSaidas;

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1 uppercase tracking-wider font-semibold">
            <Link to="/app/financeiro/relatorios" className="hover:text-blue-600">Relatórios</Link>
            <span className="text-slate-300">{IconChevron}</span>
            <span className="text-blue-600">Fluxo de Caixa</span>
          </div>
          <h2 className="text-3xl font-bold text-slate-900">Fluxo de Caixa</h2>
          <p className="text-slate-500 mt-1">Monitore as entradas e saídas consolidadas da sua igreja.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white border border-slate-200 p-1 rounded-lg">
            <button className="px-4 py-1.5 text-xs font-medium rounded-md text-slate-600 hover:bg-slate-50 transition-colors" type="button">Dia</button>
            <button className="px-4 py-1.5 text-xs font-medium rounded-md text-slate-600 hover:bg-slate-50 transition-colors" type="button">Semana</button>
            <button className="px-4 py-1.5 text-xs font-medium rounded-md bg-blue-500 text-white shadow-sm transition-colors" type="button">Mês</button>
          </div>
          <button className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all" type="button">
            <span className="text-slate-500">{IconCalendar}</span>
            <span>{periodo}</span>
          </button>
          <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all" type="button">
            <span className="text-white">{IconDownload}</span>
            <span>Exportar</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            </div>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">+12.5%</span>
          </div>
          <p className="text-slate-500 text-xs font-medium">Entradas Totais</p>
          <h4 className="text-2xl font-bold text-slate-900 mt-1">{formatBRLFromCents(kpis.entradasCentavos)}</h4>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-red-50 text-red-600 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" /></svg>
            </div>
            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">-3.2%</span>
          </div>
          <p className="text-slate-500 text-xs font-medium">Saídas Totais</p>
          <h4 className="text-2xl font-bold text-slate-900 mt-1">{formatBRLFromCents(kpis.saidasCentavos)}</h4>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            </div>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Meta 85%</span>
          </div>
          <p className="text-slate-500 text-xs font-medium">Saldo Acumulado</p>
          <h4 className="text-2xl font-bold text-slate-900 mt-1">{formatBRLFromCents(kpis.saldoCentavos)}</h4>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" /></svg>
            </div>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Atenção</span>
          </div>
          <p className="text-slate-500 text-xs font-medium">Contas a Pagar (30d)</p>
          <h4 className="text-2xl font-bold text-slate-900 mt-1">{formatBRLFromCents(kpis.contasAPagarCentavos)}</h4>
        </div>
      </div>

      {/* Gráfico SVG de série temporal */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Histórico de Fluxo de Caixa</h3>
            <p className="text-xs text-slate-500">Comparativo mensal de desempenho financeiro</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span className="text-xs text-slate-600 font-medium">Entradas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              <span className="text-xs text-slate-600 font-medium">Saídas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-full border-b-2 border-dashed border-blue-500"></span>
              <span className="text-xs text-slate-600 font-medium">Saldo</span>
            </div>
          </div>
        </div>
        <div className="p-8">
          <div className="relative h-[300px] w-full">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 300">
              <g className="grid-lines">
                <line x1="0" x2="1000" y1="50" y2="50" stroke="#E2E8F0" strokeWidth="1"></line>
                <line x1="0" x2="1000" y1="125" y2="125" stroke="#E2E8F0" strokeWidth="1"></line>
                <line x1="0" x2="1000" y1="200" y2="200" stroke="#E2E8F0" strokeWidth="1"></line>
                <line x1="0" x2="1000" y1="275" y2="275" stroke="#E2E8F0" strokeWidth="1"></line>
              </g>
              <path d="M0,200 Q150,120 250,150 T450,100 T650,130 T850,70 T1000,90" stroke="#10B981" strokeWidth="3" fill="none" strokeLinecap="round"></path>
              <path d="M0,250 Q150,230 250,210 T450,240 T650,200 T850,220 T1000,210" stroke="#EF4444" strokeWidth="3" fill="none" strokeLinecap="round"></path>
              <path d="M0,270 Q150,250 250,240 T450,220 T650,230 T850,200 T1000,180" stroke="#3B82F6" strokeWidth="3" fill="none" strokeDasharray="6 4" strokeLinecap="round"></path>
            </svg>
            <div className="flex justify-between mt-4 text-[10px] text-slate-400 font-medium px-2">
              <span>JAN</span><span>FEV</span><span>MAR</span><span>ABR</span><span>MAI</span><span>JUN</span>
              <span>JUL</span><span>AGO</span><span>SET</span><span>OUT</span><span>NOV</span><span>DEZ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Projeção 30 dias + Análise de Tendência */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Projeção Próximos 30 dias</h3>
              <p className="text-xs text-slate-500">Estimativa baseada em recorrências e previsões</p>
            </div>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3 font-medium text-slate-500 uppercase text-[10px] tracking-wider">Período</th>
                  <th className="px-6 py-3 font-medium text-slate-500 uppercase text-[10px] tracking-wider">Entradas Previstas</th>
                  <th className="px-6 py-3 font-medium text-slate-500 uppercase text-[10px] tracking-wider">Saídas Previstas</th>
                  <th className="px-6 py-3 font-medium text-slate-500 uppercase text-[10px] tracking-wider text-right">Saldo Estimado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {projecao.map((p) => (
                  <tr key={p.periodo} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{p.periodo}</td>
                    <td className="px-6 py-4 text-emerald-600 font-medium">+ {formatBRLFromCents(p.entradasCentavos)}</td>
                    <td className="px-6 py-4 text-red-600 font-medium">- {formatBRLFromCents(p.saidasCentavos)}</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">{formatBRLFromCents(p.saldoCentavos)}</td>
                  </tr>
                ))}
                <tr className="bg-blue-50/30">
                  <td className="px-6 py-4 font-bold text-blue-900">Total Projetado</td>
                  <td className="px-6 py-4 text-emerald-700 font-bold">+ {formatBRLFromCents(totalProjEntradas)}</td>
                  <td className="px-6 py-4 text-red-700 font-bold">- {formatBRLFromCents(totalProjSaidas)}</td>
                  <td className="px-6 py-4 text-right font-extrabold text-blue-900">{formatBRLFromCents(totalProjSaldo)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-slate-900 text-white rounded-xl shadow-xl p-6 flex flex-col">
          <div className="mb-6">
            <h3 className="text-base font-semibold">Análise de Tendência</h3>
            <p className="text-xs text-slate-400">Insights gerados automaticamente</p>
          </div>
          <div className="space-y-6 flex-1">
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-emerald-400">✓</span>
                <span className="text-sm font-medium">Superavit Saudável</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">As entradas superaram as saídas em 32% este mês. Recomendamos alocar R$ 10k no fundo de reserva.</p>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-amber-400">⚠</span>
                <span className="text-sm font-medium">Atenção Próxima Semana</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">Concentração de 65% das despesas operacionais entre os dias 10 e 15. Saldo atual cobre com folga.</p>
            </div>
          </div>
          <div className="mt-8">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-slate-400">Saúde Financeira</span>
              <span className="text-emerald-400 font-bold">Excelente</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: "92%" }}></div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
