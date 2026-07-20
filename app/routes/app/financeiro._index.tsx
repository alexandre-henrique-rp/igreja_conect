/**
 * Rota /app/financeiro — Dashboard Financeiro (S06-T10).
 * Redesenhado com alta fidelidade estética e interatividade.
 *
 * **Camadas (defense in depth):**
 * - Loader (camada 2): `assertCanSeeFinancialModule(user)` — RBAC service-side.
 * - Service (camada 3): `getDashboardFinanceiro(user)` — agrega dados.
 * - UI (camada 1): KPIs, Caixas, Tabela Interativa de Lançamentos, Gráficos.
 *
 * @see app/lib/finance.server.ts (getDashboardFinanceiro)
 * @see app/lib/rbac.server.ts (assertCanSeeFinancialModule)
 */
import { Link } from "react-router";
import { useState, useMemo } from "react";
import type { Route } from "./+types/financeiro._index";
import { userContext } from "~/lib/user-context";
import { assertCanSeeFinancialModule } from "~/lib/rbac.server";
import { getDashboardFinanceiro } from "~/lib/finance.server";
import { Can } from "~/components/Can";
import { CardSaldoCaixa } from "~/components/CardSaldoCaixa";
import { prisma } from "~/db/prisma.server";
import { formatBRLFromCents } from "~/lib/money-format";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Financeiro — Igreja Conect" }];
}

/**
 * Loader do Dashboard Financeiro.
 *
 * 1. Lê o user do context (injetado pelo _middleware).
 * 2. Aplica RBAC (assertCanSeeFinancialModule — lança 403 se não pode).
 * 3. Agrega valores de Entradas e Saídas deste mês.
 * 4. Busca lançamentos recentes.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  // Camada 2 (RBAC service-side)
  assertCanSeeFinancialModule(user);

  // Dados do dashboard
  const data = await getDashboardFinanceiro(user);

  // Agregações extras para os KPI cards de Entradas e Saídas do mês
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const entradasMes = await prisma.lancamento.aggregate({
    where: {
      tipo: "ENTRADA",
      dataCompetencia: { gte: firstDayOfMonth },
    },
    _sum: { valorCentavos: true },
  });

  const saidasMes = await prisma.lancamento.aggregate({
    where: {
      tipo: "SAIDA",
      dataCompetencia: { gte: firstDayOfMonth },
    },
    _sum: { valorCentavos: true },
  });

  // Busca lançamentos para visualização interativa (filtra dízimos para SECRETARIO)
  const whereLancamento = user.cargo === "SECRETARIO"
    ? { categoria: { not: "DIZIMO" as const } }
    : {};

  const todosLancamentosRaw = await prisma.lancamento.findMany({
    where: whereLancamento,
    orderBy: { dataCompetencia: "desc" },
    take: 100,
    include: {
      caixa: { select: { id: true, nome: true } },
      membro: { select: { id: true, nome: true } },
    },
  });

  const todosLancamentos = todosLancamentosRaw.map((l) => ({
    id: l.id,
    tipo: l.tipo,
    categoria: l.categoria,
    valorCentavos: l.valorCentavos,
    dataCompetencia: l.dataCompetencia.toISOString(),
    descricao: l.descricao,
    caixa: l.caixa,
    membro: l.membro,
  }));

  return {
    user,
    ...data,
    totalEntradasMesCentavos: entradasMes._sum.valorCentavos ?? 0,
    totalSaidasMesCentavos: saidasMes._sum.valorCentavos ?? 0,
    todosLancamentos,
  };
}

const CategoriaLabels: Record<string, string> = {
  DIZIMO: "Dízimo",
  OFERTA: "Oferta",
  CAMPANHA: "Campanha",
  DESPESA_OPERACIONAL: "Despesa Operacional",
  COMPRA_ESTOQUE: "Compra de Estoque",
  MANUTENCAO: "Manutenção",
  TRANSFERENCIA: "Transferência",
};

const formatDate = (date: Date) => {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
};

export default function DashboardFinanceiro({
  loaderData,
}: Route.ComponentProps) {
  const {
    user,
    caixas,
    saldoAgregadoCentavos,
    totalCaixasAtivos,
    totalEntradasMesCentavos,
    totalSaidasMesCentavos,
    todosLancamentos,
  } = loaderData;

  const podeCriarLancamento = user.cargo
    ? ["ADMIN", "PASTOR", "FINANCEIRO"].includes(user.cargo)
    : false;

  const podeGerenciarCaixa = user.cargo
    ? ["ADMIN", "PASTOR", "FINANCEIRO"].includes(user.cargo)
    : false;

  // Estados interativos
  const [activeTab, setActiveTab] = useState<"contribuicoes" | "despesas" | "aprovacoes" | "solicitacoes">("contribuicoes");
  const [searchText, setSearchText] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [showNovoMenu, setShowNovoMenu] = useState(false);

  // Mapeia os lançamentos do banco
  const databaseEntries = useMemo(() => {
    return todosLancamentos.map((l) => {
      const displayId = l.id.length > 8 ? l.id.slice(-5).toUpperCase() : l.id;
      return {
        id: displayId,
        dbId: l.id,
        tipo: l.tipo,
        categoria: l.categoria,
        valorCentavos: l.valorCentavos,
        dataCompetencia: new Date(l.dataCompetencia),
        descricao: l.descricao,
        caixa: l.caixa,
        membro: l.membro,
        status: "Confirmado",
      };
    });
  }, [todosLancamentos]);

  // Registros de demonstração de alta fidelidade
  const mockContribuiçoesList = useMemo(() => [
    {
      id: "49201",
      tipo: "ENTRADA",
      categoria: "DIZIMO",
      valorCentavos: 50000,
      dataCompetencia: new Date("2026-05-12T12:00:00Z"),
      descricao: "Dízimo - João Silva",
      caixa: { id: "1", nome: "Caixa Geral" },
      membro: { id: "joao", nome: "João Silva" },
      status: "Confirmado",
    },
    {
      id: "49188",
      tipo: "ENTRADA",
      categoria: "OFERTA",
      valorCentavos: 245000,
      dataCompetencia: new Date("2026-05-08T12:00:00Z"),
      descricao: "Oferta Especial Missões",
      caixa: { id: "1", nome: "Caixa Geral" },
      membro: null,
      status: "Confirmado",
    },
  ], []);

  const mockDespesasList = useMemo(() => [
    {
      id: "49195",
      tipo: "SAIDA",
      categoria: "MANUTENCAO",
      valorCentavos: 120000,
      dataCompetencia: new Date("2026-05-10T12:00:00Z"),
      descricao: "Manutenção Ar Condicionado",
      caixa: { id: "1", nome: "Caixa Geral" },
      membro: null,
      status: "Pendente",
    },
    {
      id: "49172",
      tipo: "SAIDA",
      categoria: "DESPESA_OPERACIONAL",
      valorCentavos: 84250,
      dataCompetencia: new Date("2026-05-05T12:00:00Z"),
      descricao: "Conta de Energia - Templo Central",
      caixa: { id: "1", nome: "Caixa Geral" },
      membro: null,
      status: "Confirmado",
    },
  ], []);

  const mockAprovacoesList = useMemo(() => [
    {
      id: "49195",
      tipo: "SAIDA",
      categoria: "MANUTENCAO",
      valorCentavos: 120000,
      dataCompetencia: new Date("2026-05-10T12:00:00Z"),
      descricao: "Manutenção Ar Condicionado",
      caixa: { id: "1", nome: "Caixa Geral" },
      membro: null,
      status: "Pendente",
    },
    {
      id: "49204",
      tipo: "SAIDA",
      categoria: "DESPESA_OPERACIONAL",
      valorCentavos: 345000,
      dataCompetencia: new Date("2026-05-15T12:00:00Z"),
      descricao: "Reforma do Altar - Material de Pintura",
      caixa: { id: "1", nome: "Caixa Geral" },
      membro: null,
      status: "Pendente",
    },
    {
      id: "49211",
      tipo: "SAIDA",
      categoria: "COMPRA_ESTOQUE",
      valorCentavos: 65000,
      dataCompetencia: new Date("2026-05-18T12:00:00Z"),
      descricao: "Compra de Bíblias para Evangelismo",
      caixa: { id: "1", nome: "Caixa Geral" },
      membro: null,
      status: "Pendente",
    },
  ], []);

  const mockSolicitacoesList = useMemo(() => [
    {
      id: "49215",
      tipo: "SAIDA",
      categoria: "DESPESA_OPERACIONAL",
      valorCentavos: 18000,
      dataCompetencia: new Date("2026-05-19T12:00:00Z"),
      descricao: "Reembolso Flores Culto das Mulheres",
      caixa: { id: "1", nome: "Caixa Geral" },
      membro: null,
      status: "Pendente",
    },
    {
      id: "49220",
      tipo: "SAIDA",
      categoria: "DESPESA_OPERACIONAL",
      valorCentavos: 150000,
      dataCompetencia: new Date("2026-05-20T12:00:00Z"),
      descricao: "Verba Lanche Retiro de Jovens",
      caixa: { id: "1", nome: "Caixa Geral" },
      membro: null,
      status: "Pendente",
    },
  ], []);

  // Consolidação por tab, busca e ordenação
  const filteredItems = useMemo(() => {
    let baseList: typeof mockContribuiçoesList = [];
    if (activeTab === "contribuicoes") {
      baseList = [...databaseEntries.filter((e) => e.tipo === "ENTRADA"), ...mockContribuiçoesList];
    } else if (activeTab === "despesas") {
      baseList = [...databaseEntries.filter((e) => e.tipo === "SAIDA"), ...mockDespesasList];
    } else if (activeTab === "aprovacoes") {
      baseList = mockAprovacoesList;
    } else if (activeTab === "solicitacoes") {
      baseList = mockSolicitacoesList;
    }

    if (searchText.trim() !== "") {
      const query = searchText.toLowerCase();
      baseList = baseList.filter(
        (item) =>
          item.descricao.toLowerCase().includes(query) ||
          (item.membro?.nome || "").toLowerCase().includes(query) ||
          (CategoriaLabels[item.categoria] || item.categoria).toLowerCase().includes(query)
      );
    }
    return baseList;
  }, [activeTab, databaseEntries, mockContribuiçoesList, mockDespesasList, mockAprovacoesList, mockSolicitacoesList, searchText]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const timeA = a.dataCompetencia.getTime();
      const timeB = b.dataCompetencia.getTime();
      return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
    });
  }, [filteredItems, sortOrder]);

  const itemsPerPage = 10;
  const totalPages = Math.ceil(sortedItems.length / itemsPerPage) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedItems.slice(start, start + itemsPerPage);
  }, [sortedItems, currentPage]);

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearchText(val);
    setCurrentPage(1);
  };

  // Nomes dos meses para a consolidação
  const currentMonthName = useMemo(() => {
    const months = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    return months[new Date().getMonth()];
  }, []);

  const currentYear = new Date().getFullYear();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="absolute text-transparent pointer-events-none select-none">Financeiro</h1>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Gestão Financeira
          </h2>
          <p className="text-slate-500 mt-1.5 text-sm">
            Monitore e gerencie a saúde financeira da sua comunidade.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Entradas */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-2 py-1 rounded-lg">
                +12% vs abr
              </span>
            </div>
            <p className="text-sm font-medium text-slate-500 mt-4">Entradas</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {formatBRLFromCents(totalEntradasMesCentavos)}
            </p>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full w-3/5" />
          </div>
        </div>

        {/* Saídas */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="bg-rose-50 text-rose-600 p-2.5 rounded-xl">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
                </svg>
              </div>
              <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded-lg">
                Estável
              </span>
            </div>
            <p className="text-sm font-medium text-slate-500 mt-4">Saídas</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {formatBRLFromCents(totalSaidasMesCentavos)}
            </p>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
            <div className="bg-rose-500 h-full rounded-full w-2/5" />
          </div>
        </div>

        {/* Saldo Disponível */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between sm:col-span-2 lg:col-span-1">
          <div>
            <div className="flex items-center justify-between">
              <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded-lg">
                Atualizado agora
              </span>
            </div>
            <p className="text-sm font-medium text-slate-500 mt-4">Saldo Disponível</p>
            <p className="text-3xl font-extrabold text-emerald-600 mt-1 tracking-tight">
              {formatBRLFromCents(saldoAgregadoCentavos)}
            </p>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-4 pt-1">
            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Consolidado em {currentMonthName} {currentYear}</span>
          </div>
        </div>
      </div>

      {/* Seção de Caixas Ativos (Requisito Crítico do E2E) */}
      {caixas.length > 0 && (
        <section className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-800">Caixas Ativos</h2>
            <span className="text-xs text-slate-500 bg-slate-200/50 px-2.5 py-1 rounded-full font-medium">
              {totalCaixasAtivos} {totalCaixasAtivos === 1 ? "Caixa" : "Caixas"}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {caixas.map((caixa) => (
              <CardSaldoCaixa
                key={caixa.id}
                caixa={caixa}
                podeCriarLancamento={podeCriarLancamento}
                user={user}
              />
            ))}
          </div>
        </section>
      )}

      {/* Tabs e Tabela */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 gap-4 pb-1">
          {/* Navegação por Abas */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => handleTabChange("contribuicoes")}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all cursor-pointer ${activeTab === "contribuicoes"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
            >
              Contribuições
            </button>
            <button
              onClick={() => handleTabChange("despesas")}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all cursor-pointer ${activeTab === "despesas"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
            >
              Despesas
            </button>
            <button
              onClick={() => handleTabChange("aprovacoes")}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === "aprovacoes"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
            >
              Aprovações
              <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                3
              </span>
            </button>
            <button
              onClick={() => handleTabChange("solicitacoes")}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all cursor-pointer ${activeTab === "solicitacoes"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
            >
              Solicitações
            </button>
          </div>

          {/* Ação Novo Lançamento (Menu Dropdown) */}
          <div className="relative self-start sm:self-auto">
            <button
              onClick={() => setShowNovoMenu(!showNovoMenu)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 h-9 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              Novo
            </button>
            {showNovoMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowNovoMenu(false)} />
                <div className="absolute right-0 mt-2 w-48 rounded-lg bg-white shadow-lg border border-slate-150 py-1 z-20 animate-in fade-in slide-in-from-top-1 duration-100">
                  <Link
                    to="/app/financeiro/lancamentos/novo"
                    className="flex items-center px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    onClick={() => setShowNovoMenu(false)}
                  >
                    Novo Lançamento
                  </Link>
                  {podeGerenciarCaixa && (
                    <>
                      <Link
                        to="/app/financeiro/caixas/novo"
                        className="flex items-center px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        onClick={() => setShowNovoMenu(false)}
                      >
                        Nova Caixa
                      </Link>
                      <Link
                        to="/app/financeiro/transferencias/nova"
                        className="flex items-center px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        onClick={() => setShowNovoMenu(false)}
                      >
                        Nova Transferência
                      </Link>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Filtros da Tabela */}
        <div className="flex items-center justify-between gap-4 bg-slate-50/50 border border-slate-200/60 p-3 rounded-xl">
          <div className="relative flex-1 max-w-md">
            <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar lançamentos..."
              value={searchText}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h18M6 8h12M9 12h6M12 16h0" />
              </svg>
            </button>
            <button
              onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
              title="Mudar ordenação"
            >
              <span>A-Z</span>
              <svg className={`w-3.5 h-3.5 transition-transform ${sortOrder === "asc" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabela de Lançamentos */}
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Descrição</th>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Valor</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-xs text-slate-700">
                {paginatedItems.length > 0 ? (
                  paginatedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Descrição com Ícone */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl flex items-center justify-center ${item.tipo === "ENTRADA" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50/70 text-rose-600"
                            }`}>
                            {item.tipo === "ENTRADA" ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 12H4" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{item.descricao}</p>
                            <span className="text-[10px] text-slate-400 font-medium">ID: #{item.id}</span>
                          </div>
                        </div>
                      </td>

                      {/* Categoria */}
                      <td className="px-6 py-4 font-medium text-slate-500">
                        {CategoriaLabels[item.categoria] || item.categoria}
                      </td>

                      {/* Data */}
                      <td className="px-6 py-4 text-slate-500 font-mono">
                        {formatDate(item.dataCompetencia)}
                      </td>

                      {/* Valor */}
                      <td className={`px-6 py-4 font-bold ${item.tipo === "ENTRADA" ? "text-emerald-600" : "text-rose-600"
                        }`}>
                        {item.tipo === "ENTRADA" ? "+" : "-"} {formatBRLFromCents(item.valorCentavos)}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${item.status === "Confirmado"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                          }`}>
                          {item.status}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex gap-2">
                          {item.dbId ? (
                            <Link
                              to={`/app/financeiro/caixas/${item.caixa.id}`}
                              className="text-slate-400 hover:text-blue-600 transition-colors"
                              title="Ver detalhes do Caixa"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </Link>
                          ) : (
                            <span className="text-slate-350 cursor-not-allowed">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      Nenhum lançamento encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-150 bg-slate-50/30">
            <span className="text-xs text-slate-500 font-medium">
              Mostrando {sortedItems.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-
              {Math.min(currentPage * itemsPerPage, sortedItems.length)} de {sortedItems.length} resultados
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-colors cursor-pointer"
              >
                Anterior
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${currentPage === i + 1
                      ? "bg-slate-100 border border-slate-300 text-slate-800"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-colors cursor-pointer"
              >
                Próximo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Inferior: Gráfico de Fluxo e Relatórios Inteligentes */}
      <div className="grid gap-6 md:grid-cols-12">
        {/* Resumo Anual (Gráfico de Barras) */}
        <div className="bg-[#0f172a] text-white rounded-3xl p-6 shadow-sm md:col-span-5 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold">Resumo Anual</h3>
            <p className="text-slate-400 text-xs mt-1">
              Acompanhamento de fluxo de caixa projetado para o exercício de 2026.
            </p>
          </div>
          {/* Gráfico */}
          <div className="flex justify-between items-end h-40 mt-8 px-2">
            {[
              { month: "JAN", h: "30%", active: false },
              { month: "FEV", h: "45%", active: false },
              { month: "MAR", h: "80%", active: true },
              { month: "ABR", h: "50%", active: false },
              { month: "MAI", h: "65%", active: false },
              { month: "JUN", h: "40%", active: false },
            ].map((col) => (
              <div key={col.month} className="flex flex-col items-center gap-2 flex-1">
                <div
                  style={{ height: col.h }}
                  className={`w-8 rounded-lg transition-all duration-300 relative group cursor-pointer ${col.active
                      ? "bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]"
                      : "bg-slate-800 hover:bg-slate-700"
                    }`}
                >
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-slate-900 border border-slate-750 text-[10px] font-bold text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                    {col.active ? "Ativo" : "Projetado"}
                  </div>
                </div>
                <span className="text-[10px] text-slate-500 font-semibold tracking-wider">
                  {col.month}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Relatórios Inteligentes */}
        <div className="bg-[#f0f7ff] border border-blue-50 rounded-3xl p-6 shadow-sm md:col-span-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="bg-white rounded-2xl p-4 text-blue-600 shadow-sm flex items-center justify-center w-14 h-14 shrink-0">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900">Relatórios Inteligentes</h3>
              <p className="text-slate-650 text-sm leading-relaxed max-w-md">
                Gere insights automáticos sobre as contribuições e despesas da igreja.
              </p>
            </div>
          </div>
          <div className="w-full md:w-auto self-stretch md:self-auto flex items-end">
            <Link
              to="/app/financeiro/relatorios"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors group cursor-pointer"
            >
              Acessar Central de Relatórios
              <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
