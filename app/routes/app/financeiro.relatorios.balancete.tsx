/**
 * Rota /app/financeiro/relatorios/balancete — Balancete Mensal (cycle 4, S15).
 *
 * Dados reais do banco.
 *
 * @see design/relatorios-balancete.DESIGN.md
 */
import { Form, Link } from "react-router";
import type { Route } from "./+types/financeiro.relatorios.balancete";
import { userContext } from "~/lib/user-context";
import { assertCanSeeRelatorios } from "~/lib/rbac.server";
import { formatBRLFromCents } from "~/lib/money-format";
import { getBalanceteMensal, exportarBalanceteCSV } from "~/lib/relatorios.server";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Balancete Mensal — Igreja Conect" }];
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeRelatorios(user);

  const formData = await request.formData();
  const periodo = formData.get("periodo") as string | null;

  const hoje = new Date();
  const ano = periodo ? parseInt(periodo.split("-")[0]) : hoje.getFullYear();
  const mes = periodo ? parseInt(periodo.split("-")[1]) : hoje.getMonth() + 1;

  const csv = await exportarBalanceteCSV(user, ano, mes);
  const filename = `balancete-${ano}-${String(mes).padStart(2, "0")}.csv`;
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
  const periodoParam = url.searchParams.get("periodo");

  const hoje = new Date();
  const ano = periodoParam ? parseInt(periodoParam.split("-")[0]) : hoje.getFullYear();
  const mes = periodoParam ? parseInt(periodoParam.split("-")[1]) : hoje.getMonth() + 1;

  const dados = await getBalanceteMensal(user, ano, mes);

  return {
    user,
    ...dados,
  };
}

const IconChevron = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" />
  </svg>
);
const IconPrint = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z" />
  </svg>
);
const IconWallet = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M21 7H3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zm-9 7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
  </svg>
);
const IconBalance = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z" />
  </svg>
);

export default function BalancetePage({ loaderData }: Route.ComponentProps) {
  const { periodo, kpis, categorias, projecao } = loaderData;
  const totalEntradas = categorias.reduce((s, c) => s + c.entradasCentavos, 0);
  const totalSaidas = categorias.reduce((s, c) => s + c.saidasCentavos, 0);
  const totalLiquido = totalEntradas - totalSaidas;

  const mesStr = periodo.split("-")[1];
  const mesNum = parseInt(mesStr);
  const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const nomeMesAnterior = mesNum > 1 ? nomesMeses[mesNum - 2] : "Dezembro";

  const saidasComPercentual = categorias
    .filter((c) => c.saidasCentavos > 0)
    .map((c) => ({
      nome: c.nome,
      cor: c.cor,
      valor: c.saidasCentavos,
      percentual: totalSaidas > 0 ? Math.round((c.saidasCentavos / totalSaidas) * 100) : 0,
    }));
  const donutColors: Record<string, string> = {
    "bg-blue-500": "#3b82f6",
    "bg-indigo-500": "#6366f1",
    "bg-emerald-500": "#10b981",
    "bg-red-400": "#f87171",
    "bg-orange-400": "#fb923c",
    "bg-amber-400": "#fbbf24",
    "bg-slate-300": "#cbd5e1",
  };

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-6 bg-slate-50 min-h-screen">
      {/* Breadcrumb + Header + Seletor de Mês */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <nav className="flex mb-2 text-xs font-medium text-slate-400 uppercase tracking-wider space-x-2">
            <Link to="/app/financeiro" className="hover:text-blue-500">Financeiro</Link>
            <span className="text-slate-300">{IconChevron}</span>
            <Link to="/app/financeiro/relatorios" className="hover:text-blue-500">Relatórios</Link>
            <span className="text-slate-300">{IconChevron}</span>
            <span className="text-blue-500">Balancete</span>
          </nav>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Balancete Mensal</h1>
          <p className="text-slate-600 text-sm mt-1">Resumo detalhado das movimentações financeiras do período.</p>
        </div>
        <Form method="get" className="flex items-center space-x-3">
          <input
            name="periodo"
            aria-label="Período"
            className="bg-white border border-slate-200 rounded-lg h-10 px-4 text-sm font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            type="month"
            defaultValue={periodo}
          />
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg h-10 px-6 flex items-center space-x-2 transition-all shadow-sm active:scale-95"
          >
            <span className="text-white">{IconPrint}</span>
            <span>Atualizar</span>
          </button>
        </Form>
        <Form method="post" className="inline-flex">
          <input type="hidden" name="periodo" value={periodo} />
          <button
            type="submit"
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors h-10"
            title="Exportar Balancete em CSV"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" /></svg>
            Exportar CSV
          </button>
        </Form>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-slate-50 text-slate-600 rounded-lg"><span className="text-slate-600">{IconWallet}</span></div>
          </div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Saldo Anterior</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1 font-mono">{formatBRLFromCents(kpis.saldoAnteriorCentavos)}</h3>
          <p className="mt-4 text-[11px] font-medium text-slate-400">Referente a {nomeMesAnterior}</p>
        </div>
        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            </div>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">↑ {kpis.variacaoEntradas}%</span>
          </div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Entradas do Mês</p>
          <h3 className="text-2xl font-bold text-emerald-600 mt-1 font-mono">{formatBRLFromCents(kpis.entradasCentavos)}</h3>
        </div>
        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-red-50 text-red-600 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" /></svg>
            </div>
            <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">↓ {kpis.variacaoSaidas}%</span>
          </div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Saídas do Mês</p>
          <h3 className="text-2xl font-bold text-red-600 mt-1 font-mono">{formatBRLFromCents(kpis.saidasCentavos)}</h3>
        </div>
        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm hover:shadow-md transition-all border-l-4 border-l-blue-500">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><span className="text-blue-600">{IconBalance}</span></div>
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">+{formatBRLFromCents(kpis.saldoAtualCentavos - kpis.saldoAnteriorCentavos)}</span>
          </div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Saldo Atual</p>
          <h3 className="text-2xl font-bold text-blue-600 mt-1 font-mono">{formatBRLFromCents(kpis.saldoAtualCentavos)}</h3>
          <p className="mt-4 text-[11px] font-medium text-slate-400">Resultado Líquido do Período</p>
        </div>
      </div>

      {/* Tabela + Donut + Projeção */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tabela Resumo por Categoria */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-900">Resumo por Categoria</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Categoria</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Entradas</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Saídas</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categorias.map((c) => {
                  const saldo = c.entradasCentavos - c.saidasCentavos;
                  return (
                    <tr key={c.nome} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className={`w-2 h-2 rounded-full ${c.cor} mr-3`}></div>
                          <span className="text-sm font-medium text-slate-700">{c.nome}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-emerald-600 font-medium">
                        {c.entradasCentavos > 0 ? formatBRLFromCents(c.entradasCentavos) : <span className="text-slate-400">R$ 0,00</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-red-500 font-medium">
                        {c.saidasCentavos > 0 ? formatBRLFromCents(c.saidasCentavos) : <span className="text-slate-400">R$ 0,00</span>}
                      </td>
                      <td className={`px-6 py-4 text-sm text-right font-mono font-medium ${saldo < 0 ? "text-red-500" : "text-slate-900"}`}>
                        {saldo < 0 ? `- ${formatBRLFromCents(Math.abs(saldo))}` : formatBRLFromCents(saldo)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50/50">
                <tr>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900">TOTAIS</td>
                  <td className="px-6 py-4 text-sm text-right text-emerald-700 font-bold">{formatBRLFromCents(totalEntradas)}</td>
                  <td className="px-6 py-4 text-sm text-right text-red-700 font-bold">{formatBRLFromCents(totalSaidas)}</td>
                  <td className="px-6 py-4 text-sm text-right text-blue-700 font-bold">{formatBRLFromCents(totalLiquido)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Donut + Projeção */}
        <div className="flex flex-col space-y-8">
          {/* Donut chart Distribuição de Saídas */}
          <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900 mb-6 flex items-center justify-between">
              Distribuição de Saídas
              <span className="text-slate-400 text-xs">ⓘ</span>
            </h2>
            <div className="relative w-40 h-40 mx-auto mb-6">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" fill="none" r="15.915" stroke="#f1f5f9" strokeWidth="3"></circle>
                {(() => {
                  let offset = 0;
                  return saidasComPercentual.map((s) => {
                    const dash = s.percentual;
                    const color = donutColors[s.cor] || "#94a3b8";
                    const elem = (
                      <circle
                        key={s.nome}
                        cx="18" cy="18" fill="none" r="15.915"
                        stroke={color}
                        strokeDasharray={`${dash} 100`}
                        strokeDashoffset={-offset}
                        strokeWidth="3"
                      />
                    );
                    offset += dash;
                    return elem;
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-slate-900">{formatBRLFromCents(kpis.saidasCentavos).split(",")[0]}</span>
                <span className="text-[10px] text-slate-500 uppercase">Total Saídas</span>
              </div>
            </div>
            <div className="space-y-2">
              {saidasComPercentual.length > 0 ? saidasComPercentual.map((s) => (
                <div key={s.nome} className="flex items-center justify-between text-xs">
                  <div className="flex items-center"><span className={`w-2 h-2 rounded-full ${s.cor} mr-2`}></span> {s.nome}</div>
                  <span className="font-semibold">{s.percentual}%</span>
                </div>
              )) : (
                <div className="text-xs text-slate-400 text-center py-4">Sem saídas no período</div>
              )}
            </div>
          </div>

          {/* Projeção Próximo Mês */}
          <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg relative overflow-hidden">
            <h2 className="text-sm font-semibold mb-4 flex items-center">
              <span className="text-blue-400 mr-2">✨</span>
              Projeção Próximo Mês
            </h2>
            <p className="text-slate-400 text-xs mb-4">Estimativa baseada no histórico de arrecadação e despesas recorrentes.</p>
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <span className="text-xs text-slate-300">Saldo Est.</span>
                <span className="text-lg font-bold font-mono">{formatBRLFromCents(projecao.saldoEstimadoCentavos)}</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full" style={{ width: `${projecao.percentualBarra}%` }}></div>
              </div>
              <p className="text-[10px] text-emerald-400 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" /></svg>
                Tendência de crescimento positiva ({projecao.tendencia})
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
