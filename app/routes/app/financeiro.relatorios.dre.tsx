/**
 * Rota /app/financeiro/relatorios/dre — DRE (Demonstração de Resultado).
 *
 * Dados reais do banco via getDRE(). Action exporta CSV via exportarDRECSV().
 *
 * @see design/relatorios-dre.DESIGN.md
 */
import { Form, Link } from "react-router";
import type { Route } from "./+types/financeiro.relatorios.dre";
import { userContext } from "~/lib/user-context";
import { assertCanSeeRelatorios } from "~/lib/rbac.server";
import { formatBRLFromCents } from "~/lib/money-format";
import { getDRE, exportarDRECSV } from "~/lib/relatorios.server";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "DRE — Igreja Conect" }];
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

  const csv = await exportarDRECSV(user, dtInicio, dtFim);
  const filename = `dre-${dtInicio.toISOString().split("T")[0]}-a-${dtFim.toISOString().split("T")[0]}.csv`;
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

  const dados = await getDRE(user, dataInicio, dataFim);

  return {
    user,
    ...dados,
    dataInicioISO: dataInicio.toISOString().split("T")[0],
    dataFimISO: dataFim.toISOString().split("T")[0],
  };
}

const IconRefresh = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.65 6.35A8 8 0 1 0 19.73 14h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
  </svg>
);
const IconChevron = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" />
  </svg>
);
const IconTrendingUp = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);
const IconTrendingDown = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
  </svg>
);
const IconWallet = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

export default function DREPage({ loaderData }: Route.ComponentProps) {
  const { periodo, kpis, entradasPorTipo, saidasPorCategoria, dataInicioISO, dataFimISO } = loaderData;
  const isLucro = kpis.resultadoCentavos >= 0;
  const percentualResultado = kpis.totalEntradasCentavos > 0
    ? Math.round((kpis.resultadoCentavos / kpis.totalEntradasCentavos) * 100)
    : 0;

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-6 bg-white min-h-screen">
      {/* Breadcrumb + Page Header + Período */}
      <div className="mb-8">
        <nav className="flex text-xs text-slate-400 font-medium mb-2 space-x-2">
          <Link to="/app/financeiro" className="hover:text-blue-500">Financeiro</Link>
          <span className="text-slate-300">{IconChevron}</span>
          <Link to="/app/financeiro/relatorios" className="hover:text-blue-500">Relatórios</Link>
          <span className="text-slate-300">{IconChevron}</span>
          <span className="text-slate-600">DRE</span>
        </nav>
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">DRE - Demonstração do Resultado</h1>
            <p className="text-slate-600 mt-1">Análise detalhada de performance financeira do período.</p>
          </div>
          <div className="flex items-center gap-3">
            <Form method="get" className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
              <div className="flex flex-col">
                <label htmlFor="dataInicio" className="text-[10px] uppercase font-bold text-slate-400 px-3">Início</label>
                <input
                  id="dataInicio"
                  name="dataInicio"
                  className="border-none focus:ring-0 text-sm py-0 font-medium text-slate-700 bg-transparent"
                  type="date"
                  defaultValue={periodo.dataInicio}
                />
              </div>
              <div className="h-8 w-px bg-slate-200"></div>
              <div className="flex flex-col">
                <label htmlFor="dataFim" className="text-[10px] uppercase font-bold text-slate-400 px-3">Fim</label>
                <input
                  id="dataFim"
                  name="dataFim"
                  className="border-none focus:ring-0 text-sm py-0 font-medium text-slate-700 bg-transparent"
                  type="date"
                  defaultValue={periodo.dataFim}
                />
              </div>
              <button
                type="submit"
                className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition-colors"
                title="Atualizar período"
              >
                <span className="text-white">{IconRefresh}</span>
              </button>
            </Form>
            <Form method="post" className="inline-flex">
              <input type="hidden" name="dataInicio" value={dataInicioISO} />
              <input type="hidden" name="dataFim" value={dataFimISO} />
              <button
                type="submit"
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                title="Exportar DRE em CSV"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" /></svg>
                Exportar CSV
              </button>
            </Form>
          </div>
        </div>
      </div>

      {/* 3 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600 group-hover:scale-110 transition-transform">{IconTrendingUp}</div>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">{percentualResultado}% margem</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Total de Entradas</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{formatBRLFromCents(kpis.totalEntradasCentavos)}</h3>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-red-50 rounded-lg text-red-600 group-hover:scale-110 transition-transform">{IconTrendingDown}</div>
            <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">{kpis.totalSaidasCentavos > 0 ? Math.round((kpis.totalSaidasCentavos / kpis.totalEntradasCentavos) * 100) : 0}% das entradas</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Total de Saídas</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{formatBRLFromCents(kpis.totalSaidasCentavos)}</h3>
        </div>
        <div className={`bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group ring-2 ${isLucro ? "ring-blue-500/10" : "ring-red-500/10"}`}>
          <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-lg group-hover:scale-110 transition-transform ${isLucro ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600"}`}>{IconWallet}</div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full uppercase tracking-wider ${isLucro ? "text-blue-600 bg-blue-50" : "text-red-600 bg-red-50"}`}>{isLucro ? "Lucro" : "Prejuízo"}</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Resultado Líquido</p>
          <h3 className={`text-2xl font-bold mt-1 ${isLucro ? "text-slate-900" : "text-red-600"}`}>{formatBRLFromCents(Math.abs(kpis.resultadoCentavos))}</h3>
        </div>
      </div>

      {/* 2 painéis: Entradas por Tipo + Saídas por Categoria */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Entradas por Tipo */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-fit">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-900">Entradas por Tipo</h3>
          </div>
          <div className="p-6 space-y-6">
            {entradasPorTipo.map((e) => (
              <div key={e.tipo} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-700">{e.tipo}</span>
                  <span className="text-slate-900 font-bold">{formatBRLFromCents(e.valorCentavos)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className={`${e.cor} h-full rounded-full transition-all duration-1000`} style={{ width: `${e.percentual}%` }}></div>
                </div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">{e.percentual}% do total de entradas</p>
              </div>
            ))}
            <div className="pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center text-xs text-slate-500">
                <span>Base de cálculo: Receitas Brutas</span>
                <button className="text-blue-500 font-semibold hover:underline" type="button">Ver Detalhes</button>
              </div>
            </div>
          </div>
        </div>

        {/* Saídas por Categoria */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-900">Saídas por Categoria</h3>
            <div className="flex gap-2">
              <button className="px-3 py-1 text-xs font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors" type="button">Exportar PDF</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/80 text-[10px] uppercase font-bold text-slate-400">
                <tr>
                  <th className="px-6 py-4 border-b border-slate-100">Categoria</th>
                  <th className="px-6 py-4 border-b border-slate-100">Transações</th>
                  <th className="px-6 py-4 border-b border-slate-100">Impacto</th>
                  <th className="px-6 py-4 border-b border-slate-100 text-right">Valor Total</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {saidasPorCategoria.map((s) => (
                  <tr key={s.categoria} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${s.cor}`}></div>
                        <span className="font-medium text-slate-700">{s.categoria}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 border-b border-slate-100 text-slate-500">{s.transacoes} lançamentos</td>
                    <td className="px-6 py-4 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-slate-100 rounded-full max-w-[60px]">
                          <div className={`h-full ${s.cor} rounded-full`} style={{ width: `${s.percentual}%` }}></div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">{s.percentual}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 border-b border-slate-100 text-right font-bold text-slate-900">{formatBRLFromCents(s.valorCentavos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Banner "Resumo de Saúde Financeira" */}
      <div className="mt-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-8 text-white relative overflow-hidden shadow-lg group">
        <div className="relative z-10 max-w-3xl">
          <h4 className="text-xl font-bold mb-2">Resumo de Saúde Financeira</h4>
          <p className="text-blue-100 text-sm leading-relaxed opacity-90">
            {isLucro
              ? `Resultado líquido positivo de ${formatBRLFromCents(kpis.resultadoCentavos)} no período (${percentualResultado}% de margem). ${entradasPorTipo.length > 0 ? `Maior fonte de entradas: ${entradasPorTipo[0].tipo}.` : ""}`
              : `Déficit de ${formatBRLFromCents(Math.abs(kpis.resultadoCentavos))} no período. Recomenda-se revisar despesas operacionais.`
            }
          </p>
          <button type="button" className="mt-6 px-6 py-2 bg-white text-blue-600 rounded-lg text-sm font-bold shadow-lg hover:shadow-xl transition-all active:scale-95">
            Imprimir Relatório Anual
          </button>
        </div>
      </div>
    </main>
  );
}
