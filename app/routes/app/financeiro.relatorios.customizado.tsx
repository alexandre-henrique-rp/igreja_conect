/**
 * Rota /app/financeiro/relatorios/customizado — Relatório Customizado.
 *
 * Dados reais do banco. Action "export-csv" chama exportarLancamentosCSV.
 *
 * @see design/relatorios-customizado.DESIGN.md
 */
import { Form, Link } from "react-router";
import type { Route } from "./+types/financeiro.relatorios.customizado";
import { userContext } from "~/lib/user-context";
import { assertCanSeeRelatorios } from "~/lib/rbac.server";
import { formatBRLFromCents } from "~/lib/money-format";
import {
  exportarLancamentosCSV,
  getRelatorioCustomizado,
} from "~/lib/relatorios.server";
import { listarCaixasParaSelect } from "~/lib/caixas.server";
import { CATEGORIAS_LANCAMENTO } from "~/lib/schemas/lancamentos";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Relatório Customizado — Igreja Conect" }];
}

/**
 * Action: exporta os lançamentos filtrados como CSV (download).
 *
 * Lê os mesmos filtros da URL (dataInicio, dataFim, caixaId, categoria, tipo)
 * e retorna `text/csv; charset=utf-8` com `Content-Disposition: attachment`.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeRelatorios(user);

  const formData = await request.formData();
  const dataInicio = formData.get("dataInicio");
  const dataFim = formData.get("dataFim");
  const caixaId = formData.get("caixaId");
  const categoria = formData.get("categoria");
  const tipo = formData.get("tipo");

  const csv = await exportarLancamentosCSV(user, {
    dataInicio: typeof dataInicio === "string" && dataInicio ? new Date(dataInicio) : undefined,
    dataFim: typeof dataFim === "string" && dataFim ? new Date(dataFim) : undefined,
    caixaId: typeof caixaId === "string" && caixaId ? caixaId : undefined,
    categoria: typeof categoria === "string" && categoria ? categoria : undefined,
    tipo: tipo === "ENTRADA" || tipo === "SAIDA" ? tipo : undefined,
  });

  const filename = `lancamentos-${new Date().toISOString().split("T")[0]}.csv`;
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
  const caixaIdParam = url.searchParams.get("caixaId");
  const categoriaParam = url.searchParams.get("categoria");
  const tipoParam = url.searchParams.get("tipo") as "ENTRADA" | "SAIDA" | null;

  const hoje = new Date();
  const dataInicio = dataInicioParam ? new Date(dataInicioParam) : new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const dataFim = dataFimParam ? new Date(dataFimParam) : new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

  const [dados, caixas] = await Promise.all([
    getRelatorioCustomizado(user, {
      dataInicio,
      dataFim,
      caixaId: caixaIdParam || undefined,
      categoria: categoriaParam || undefined,
      tipo: tipoParam || undefined,
    }),
    listarCaixasParaSelect(user),
  ]);

  return {
    user,
    dataInicioISO: dataInicio.toISOString().split("T")[0],
    dataFimISO: dataFim.toISOString().split("T")[0],
    caixaSelecionado: caixaIdParam ?? "",
    categoriaSelecionada: categoriaParam ?? "",
    tipoSelecionado: tipoParam ?? "",
    caixas,
    kpis: {
      totalEntradasCentavos: dados.totais.entradasCentavos,
      totalSaidasCentavos: dados.totais.saidasCentavos,
      saldoConsolidadoCentavos: dados.totais.saldoCentavos,
    },
    lancamentos: dados.lancamentos.map((l) => ({
      id: l.id,
      data: l.data,
      descricao: l.descricao,
      conta: l.caixa,
      categoria: l.categoria,
      valorCentavos: l.valorCentavos,
      tipo: l.tipo,
      status: l.status,
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
  PAGO: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  PENDENTE: "bg-amber-50 text-amber-700 border border-amber-100",
  AGENDADO: "bg-blue-50 text-blue-700 border border-blue-100",
};

const CATEGORIA_STYLES: Record<string, string> = {
  Dízimo: "bg-blue-50 text-blue-600",
  Oferta: "bg-indigo-50 text-indigo-600",
  Campanha: "bg-emerald-50 text-emerald-600",
  "Despesa Operacional": "bg-red-50 text-red-600",
  "Compra de Estoque": "bg-orange-50 text-orange-600",
  Manutenção: "bg-amber-50 text-amber-600",
  Transferência: "bg-slate-100 text-slate-600",
};

export default function RelatorioCustomizadoPage({ loaderData }: Route.ComponentProps) {
  const {
    kpis,
    lancamentos,
    dataInicioISO,
    dataFimISO,
    caixaSelecionado,
    categoriaSelecionada,
    tipoSelecionado,
    caixas,
  } = loaderData;

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
          {/* Exporta os filtros atuais (mesma URL) como CSV — Form separado pra não
              interferir com o GET do filtro principal. */}
          <Form method="post" className="inline-flex">
            <input type="hidden" name="dataInicio" value={dataInicioISO} />
            <input type="hidden" name="dataFim" value={dataFimISO} />
            <input type="hidden" name="caixaId" value={caixaSelecionado} />
            <input type="hidden" name="categoria" value={categoriaSelecionada} />
            <input type="hidden" name="tipo" value={tipoSelecionado} />
            <button
              type="submit"
              className="flex items-center bg-white border border-slate-200 text-slate-700 rounded-lg h-10 px-4 font-medium hover:bg-slate-50 transition-colors shadow-sm"
              title={`Baixar ${lancamentos.length} lançamentos em CSV`}
            >
              <span className="text-slate-500 mr-2">{IconCloudDownload}</span>
              Exportar CSV ({lancamentos.length})
            </button>
          </Form>
        </div>
      </div>

      {/* Bento Grid Filtros + KPIs */}
      <Form method="get" className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
        <div className="md:col-span-8 bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center space-x-2 mb-6">
            <span className="text-blue-500">{IconFilter}</span>
            <h3 className="text-lg font-semibold text-slate-900">Filtros Avançados</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Período (datas)</label>
              <div className="flex gap-2">
                <input name="dataInicio" type="date" defaultValue={dataInicioISO} className="w-full bg-slate-50 border border-slate-200 rounded-lg h-10 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                <input name="dataFim" type="date" defaultValue={dataFimISO} className="w-full bg-slate-50 border border-slate-200 rounded-lg h-10 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Tipo de Lançamento</label>
              <select name="tipo" className="w-full bg-slate-50 border border-slate-200 rounded-lg h-10 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" defaultValue={tipoSelecionado || "all"}>
                <option value="all">Todos os tipos</option>
                <option value="ENTRADA">Entradas</option>
                <option value="SAIDA">Saídas</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Categoria</label>
              <select name="categoria" className="w-full bg-slate-50 border border-slate-200 rounded-lg h-10 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" defaultValue={categoriaSelecionada || "all"}>
                <option value="all">Todas as categorias</option>
                {CATEGORIAS_LANCAMENTO.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Membro / Fornecedor</label>
              <input className="w-full bg-slate-50 border border-slate-200 rounded-lg h-10 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Nome do membro..." type="text" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Conta / Caixa</label>
              <select name="caixaId" className="w-full bg-slate-50 border border-slate-200 rounded-lg h-10 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" defaultValue={caixaSelecionado || "all"}>
                <option value="all">Todos os caixas</option>
                {caixas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Status</label>
              <select name="status" className="w-full bg-slate-50 border border-slate-200 rounded-lg h-10 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" defaultValue="all">
                <option value="all">Todos os status</option>
                <option value="PAGO">Pago</option>
                <option value="PENDENTE">Pendente</option>
                <option value="AGENDADO">Agendado</option>
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
      </Form>

      {/* Tabela Lançamentos Consolidados */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-semibold text-slate-900">Lançamentos Consolidados</h3>
          <span className="text-xs text-slate-500">Exibindo {lancamentos.length} registros</span>
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
                    <p className="text-xs text-slate-400">{l.conta}</p>
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
          <span className="text-sm text-slate-500">Total: {lancamentos.length} lançamentos</span>
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
                <span className="text-[10px] uppercase opacity-60 font-bold tracking-widest">Saldo do Período</span>
                <span className="text-lg font-semibold">{formatBRLFromCents(kpis.saldoConsolidadoCentavos)}</span>
              </div>
              {kpis.totalEntradasCentavos > 0 && (
                <>
                  <div className="h-8 w-px bg-white/20"></div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase opacity-60 font-bold tracking-widest">Margem</span>
                    <span className="text-lg font-semibold">{Math.round((kpis.saldoConsolidadoCentavos / kpis.totalEntradasCentavos) * 100)}%</span>
                  </div>
                </>
              )}
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
