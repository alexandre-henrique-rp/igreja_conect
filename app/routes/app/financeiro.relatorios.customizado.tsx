/**
 * Rota /app/financeiro/relatorios/customizado — Relatório Customizado (cycle 4, S15).
 *
 * Dados MOCK. Quando S14 for implementado, action "export-csv" chamará
 * exportarLancamentosCSV(user, filtros) e retornará Response com
 * Content-Type: text/csv; charset=utf-8.
 *
 * @see design/relatorios-customizado.DESIGN.md
 * @see .harness/RAG/convention-relatorios-csv-export.md
 */
import { Form, Link, useLoaderData } from "react-router";
import type { Route } from "./+types/financeiro.relatorios.customizado";
import { userContext } from "~/lib/user-context";
import { assertCanSeeRelatorios } from "~/lib/rbac.server";
import { formatBRLFromCents } from "~/lib/money-format";
import { getRelatorioCustomizado } from "~/lib/relatorios.server";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Relatório Customizado — Igreja Conect" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeRelatorios(user);

  const url = new URL(request.url);
  const dataInicioParam = url.searchParams.get("dataInicio");
  const dataFimParam = url.searchParams.get("dataFim");
  const caixaIdParam = url.searchParams.get("caixaId");
  const categoriaParam = url.searchParams.get("categoria");
  const tipoParam = url.searchParams.get("tipo") as "ENTRADA" | "SAIDA" | null;

  const hoje = new Date();
  const dataInicio = dataInicioParam ? new Date(dataInicioParam) : new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const dataFim = dataFimParam ? new Date(dataFimParam) : new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

  const dados = await getRelatorioCustomizado(user, {
    dataInicio,
    dataFim,
    caixaId: caixaIdParam || undefined,
    categoria: categoriaParam || undefined,
    tipo: tipoParam || undefined,
  });

  return {
    user,
    kpis: {
      totalEntradasCentavos: dados.totais.entradasCentavos,
      totalSaidasCentavos: dados.totais.saidasCentavos,
      saldoConsolidadoCentavos: dados.totais.saldoCentavos,
    },
    lancamentos: dados.lancamentos.map((l) => ({
      id: l.id,
      data: l.data,
      descricao: l.descricao,
      membro: l.caixa,
      categoria: l.categoria,
      conta: l.caixa,
      valorCentavos: l.valorCentavos,
      tipo: l.tipo,
      status: "Confirmado",
    })),
  };
}

const IconChevron = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" /></svg>
);
const IconCloudDownload = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.35 10.04A7.49 7.49 0 0 0 12 4a7.49 7.49 0 0 0-7.35 6.04A5.494 5.494 0 0 0 0 15.5C0 18.43 2.57 21 5.5 21h13a5.5 5.5 0 0 0 .85-10.96zM12 19l-4-4h2.5v-3h3v3H16l-4 4z" /></svg>
);
const IconFilter = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10z" /></svg>
);
const IconWallet = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32" fill="currentColor" viewBox="0 0 24 24"><path d="M21 7H3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zm-9 7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" /></svg>
);

const STATUS_STYLES: Record<string, string> = {
  Confirmado: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  Pendente: "bg-amber-50 text-amber-700 border border-amber-100",
  Cancelado: "bg-red-50 text-red-700 border border-red-100",
};

const CATEGORIA_STYLES: Record<string, string> = {
  Dízimo: "bg-blue-50 text-blue-600",
  Utilidades: "bg-amber-50 text-amber-600",
  Missões: "bg-indigo-50 text-indigo-600",
  Manutenção: "bg-slate-100 text-slate-600",
};

export default function RelatorioCustomizadoPage({ loaderData }: Route.ComponentProps) {
  const { kpis, lancamentos } = loaderData;

  return (
    <main className="p-8 bg-slate-50 min-h-[calc(100vh-64px)]">
      {/* Page Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <nav className="flex text-xs text-slate-400 mb-2 space-x-2">
            <Link to="/app/financeiro" className="hover:text-blue-500">Financeiro</Link>
            <span>/</span>
            <Link to="/app/financeiro/relatorios" className="hover:text-blue-500">Relatórios</Link>
            <span>/</span>
            <span className="text-slate-600">Customizado</span>
          </nav>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Relatório Customizado</h2>
          <p className="text-slate-600 mt-1">Gere relatórios detalhados de entradas e saídas com filtros avançados.</p>
        </div>
        <div className="flex space-x-3">
          <button className="flex items-center bg-white border border-slate-200 text-slate-700 rounded-lg h-10 px-4 font-medium hover:shadow-md transition-all" type="button">
            <span className="text-slate-500 mr-2">{IconCloudDownload}</span>
            Exportar CSV
          </button>
          <button className="flex items-center bg-blue-500 text-white rounded-lg h-10 px-6 font-medium hover:bg-blue-600 shadow-sm transition-all" type="button">
            <span className="text-white mr-2">{IconFilter}</span>
            Aplicar Filtros
          </button>
        </div>
      </div>

      {/* Bento Grid Filtros + KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
        <div className="md:col-span-8 bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center space-x-2 mb-6">
            <span className="text-blue-500">{IconFilter}</span>
            <h3 className="text-lg font-semibold text-slate-900">Filtros Avançados</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Período</label>
              <select className="w-full bg-slate-50 border border-slate-200 rounded-lg h-10 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" defaultValue="30d">
                <option value="7d">Últimos 7 dias</option>
                <option value="30d">Últimos 30 dias</option>
                <option value="month">Mês Atual</option>
                <option value="year">Ano Corrente</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Tipo de Lançamento</label>
              <select className="w-full bg-slate-50 border border-slate-200 rounded-lg h-10 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" defaultValue="all">
                <option value="all">Todos os tipos</option>
                <option value="ENTRADA">Entradas</option>
                <option value="SAIDA">Saídas</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Categoria</label>
              <select className="w-full bg-slate-50 border border-slate-200 rounded-lg h-10 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" defaultValue="all">
                <option value="all">Todas as categorias</option>
                <option value="DIZIMO">Dízimos</option>
                <option value="OFERTA">Ofertas</option>
                <option value="DESPESA_OPERACIONAL">Despesas</option>
                <option value="MANUTENCAO">Manutenção</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Membro / Fornecedor</label>
              <input className="w-full bg-slate-50 border border-slate-200 rounded-lg h-10 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Nome do membro..." type="text" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Conta Bancária</label>
              <select className="w-full bg-slate-50 border border-slate-200 rounded-lg h-10 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" defaultValue="all">
                <option value="all">Todas as contas</option>
                <option value="caixa-geral">Caixa Geral</option>
                <option value="cantina">Cantina</option>
                <option value="missoes">Missões</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Status</label>
              <select className="w-full bg-slate-50 border border-slate-200 rounded-lg h-10 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" defaultValue="all">
                <option value="all">Todos os status</option>
                <option value="Confirmado">Confirmado</option>
                <option value="Pendente">Pendente</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </div>
          </div>
        </div>

        <div className="md:col-span-4 grid grid-rows-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </span>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">Período</span>
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Total de Entradas</p>
              <h4 className="text-2xl font-bold text-slate-900">{formatBRLFromCents(kpis.totalEntradasCentavos)}</h4>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="p-2 bg-red-50 text-red-600 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" /></svg>
              </span>
              <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full uppercase">Período</span>
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Total de Saídas</p>
              <h4 className="text-2xl font-bold text-slate-900">{formatBRLFromCents(kpis.totalSaidasCentavos)}</h4>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela Lançamentos Consolidados */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-semibold text-slate-900">Lançamentos Consolidados</h3>
          <span className="text-xs text-slate-500">Exibindo {lancamentos.length} de 1.280 registros</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição / Membro</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Categoria</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Conta</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lancamentos.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono text-slate-600">{l.data}</td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-slate-900">{l.descricao}</p>
                    <p className="text-xs text-slate-400">{l.membro}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${CATEGORIA_STYLES[l.categoria] || "bg-slate-100 text-slate-600"}`}>{l.categoria}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{l.conta}</td>
                  <td className={`px-6 py-4 text-sm font-bold ${l.tipo === "ENTRADA" ? "text-emerald-600" : "text-red-600"}`}>
                    {l.tipo === "ENTRADA" ? "+" : "-"} {formatBRLFromCents(l.valorCentavos)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_STYLES[l.status]}`}>{l.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <button className="text-sm text-slate-500 hover:text-blue-600 disabled:opacity-50 flex items-center" disabled type="button">
            <span className="mr-1">‹</span> Anterior
          </button>
          <div className="flex space-x-2">
            <span className="w-8 h-8 flex items-center justify-center rounded bg-blue-500 text-white text-xs font-bold">1</span>
            <span className="w-8 h-8 flex items-center justify-center rounded text-slate-600 hover:bg-slate-100 text-xs cursor-pointer">2</span>
            <span className="w-8 h-8 flex items-center justify-center rounded text-slate-600 hover:bg-slate-100 text-xs cursor-pointer">3</span>
          </div>
          <button className="text-sm text-slate-600 hover:text-blue-600 flex items-center" type="button">
            Próximo <span className="ml-1">›</span>
          </button>
        </div>
      </div>

      {/* Banner Saldo Consolidado + Ações Rápidas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-8 text-white relative overflow-hidden shadow-lg">
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div>
              <h3 className="text-lg font-semibold opacity-80">Saldo Consolidado do Período</h3>
              <p className="text-4xl font-bold mt-2">{formatBRLFromCents(kpis.saldoConsolidadoCentavos)}</p>
            </div>
            <div className="mt-8 flex items-center space-x-4">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase opacity-60 font-bold tracking-widest">Taxa de Conversão</span>
                <span className="text-lg font-semibold">14.2% Acima da média</span>
              </div>
              <div className="h-8 w-px bg-white/20"></div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase opacity-60 font-bold tracking-widest">Crescimento Mensal</span>
                <span className="text-lg font-semibold">+8.5% YoY</span>
              </div>
            </div>
          </div>
          <span className="text-white/10 absolute -right-8 -bottom-8 pointer-events-none">{IconWallet}</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">Ações Rápidas</h3>
          <div className="space-y-3">
            <button className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-all group" type="button">
              <div className="flex items-center">
                <span className="text-blue-500 mr-3">📄</span>
                <span className="text-sm font-medium text-slate-700">Imprimir em PDF</span>
              </div>
              <span className="text-slate-300 group-hover:text-slate-500">›</span>
            </button>
            <button className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-all group" type="button">
              <div className="flex items-center">
                <span className="text-emerald-500 mr-3">✉</span>
                <span className="text-sm font-medium text-slate-700">Enviar por E-mail</span>
              </div>
              <span className="text-slate-300 group-hover:text-slate-500">›</span>
            </button>
            <button className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-all group" type="button">
              <div className="flex items-center">
                <span className="text-amber-500 mr-3">⏰</span>
                <span className="text-sm font-medium text-slate-700">Agendar Relatório</span>
              </div>
              <span className="text-slate-300 group-hover:text-slate-500">›</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
