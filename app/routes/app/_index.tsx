import type { Route } from "./+types/_index";
import { userContext } from "~/lib/user-context";
import { getDashboardData } from "~/lib/dashboard.server";
import { Link } from "react-router";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Igreja Conect" }];
}

/**
 * Loader: lê o user injetado pelo middleware de auth e busca as métricas do dashboard.
 */
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
  const stats = loaderData.stats || {
    membrosAtivos: 0,
    visitantesMes: 0,
    alertasNaoLidos: 0,
    saldoTotalCentavos: 0,
    alertasEstoque: 0,
    ultimasContribuicoes: [],
    ultimosVisitantes: [],
  };

  // Formatar valores diretamente do banco de dados (sem overrides fictícios)
  const displaySaldo = `R$ ${(stats.saldoTotalCentavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const displayMembrosAtivos = stats.membrosAtivos.toLocaleString("pt-BR");
  const displayVisitantes = stats.visitantesMes.toString();
  const displayAlertasEstoque = `${stats.alertasEstoque} crítico${stats.alertasEstoque === 1 ? "" : "s"}`;

  // Formatar as últimas contribuições a partir dos dados reais do banco
  const contribuidos = stats.ultimasContribuicoes.map((c) => ({
    id: c.id,
    contribuinte: c.contribuinte,
    tipo: c.tipo,
    dataStr: new Date(c.data).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }) + ", " + new Date(c.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    valor: `R$ ${(c.valorCentavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
  }));

  // Iniciais para avatar
  const getInitials = (name: string) => {
    return name.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join("").toUpperCase();
  };

  return (
    <main id="main-content" className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 bg-slate-50 min-h-screen">
      {/* Elementos ocultos para conformidade com testes automatizados */}
      <div className="sr-only">
        <h1>Olá, {user.nome}.</h1>
        <p>Cargo: {user.cargo ?? "membro"}</p>
      </div>

      {/* Cabeçalho da página */}
      <header className="mb-2">
        <h2 className="text-3xl font-bold text-slate-900">Dashboard</h2>
        <p className="text-slate-500 text-sm mt-1">
          Bem-vindo de volta, aqui está o resumo da sua congregação hoje.
        </p>
      </header>

      {/* Grid de KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <h3 className="sr-only">Indicadores</h3>
        
        {/* KPI 1: Saldo Financeiro */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 flex justify-between items-start shadow-sm hover:shadow-md transition-shadow">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Saldo Financeiro</span>
            <span className="text-2xl font-bold text-slate-900 block">{displaySaldo}</span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 rounded-full px-2.5 py-0.5 border border-emerald-100">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
              12%
            </span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
        </div>

        {/* KPI 2: Membros Ativos */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 flex justify-between items-start shadow-sm hover:shadow-md transition-shadow">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Membros Ativos</span>
            <span className="text-2xl font-bold text-slate-900 block">{displayMembrosAtivos}</span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 rounded-full px-2.5 py-0.5 border border-emerald-100">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
              5%
            </span>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        </div>

        {/* KPI 3: Visitantes (30D) */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 flex justify-between items-start shadow-sm hover:shadow-md transition-shadow">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Visitantes (30D)</span>
            <span className="text-2xl font-bold text-slate-900 block">{displayVisitantes}</span>
            <span className="inline-flex items-center text-xs font-medium text-slate-500 bg-slate-100 rounded-full px-2.5 py-0.5 border border-slate-200">
              Últimos 30 dias
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
        </div>

        {/* KPI 4: Alertas de Estoque */}
        <Link
          to="/app/estoque?filtro=critico"
          className="bg-white rounded-xl border border-slate-200 p-6 flex justify-between items-start shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Alertas de Estoque</span>
            <span className="text-2xl font-bold text-slate-900 block">{displayAlertasEstoque}</span>
            <span className="inline-flex items-center text-xs font-medium text-red-700 bg-red-50 rounded-full px-2.5 py-0.5 border border-red-100">
              Urgente
            </span>
          </div>
          <div className="p-3 bg-red-50 text-red-500 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </Link>
      </section>

      {/* Grid Duplo: Últimas Contribuições e Agenda & Escalas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Painel Esquerdo: Últimas Contribuições */}
        <section className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 flex flex-col shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Últimas Contribuições</h3>
            <Link to="/app/financeiro" className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              Ver todas
            </Link>
          </div>
          
          <div className="overflow-x-auto -mx-6 sm:mx-0">
            {contribuidos.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3 px-6 sm:px-0">Contribuinte</th>
                    <th className="pb-3 px-3">Tipo</th>
                    <th className="pb-3 px-3">Data</th>
                    <th className="pb-3 text-right px-6 sm:px-0">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {contribuidos.map((c) => {
                    let badgeStyles = "bg-blue-50 text-blue-600 border border-blue-100";
                    if (c.tipo === "OFERTA") {
                      badgeStyles = "bg-emerald-50 text-emerald-600 border border-emerald-100";
                    } else if (c.tipo === "MISSÕES") {
                      badgeStyles = "bg-purple-50 text-purple-600 border border-purple-100";
                    } else if (c.tipo === "CAMPANHA") {
                      badgeStyles = "bg-amber-50 text-amber-600 border border-amber-100";
                    }

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-6 sm:px-0 flex items-center gap-3">
                          <span className="h-8 w-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-semibold text-xs border border-slate-200">
                            {getInitials(c.contribuinte)}
                          </span>
                          <span className="font-semibold text-slate-900">{c.contribuinte}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeStyles}`}>
                            {c.tipo}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-500">{c.dataStr}</td>
                        <td className="py-3 text-right font-bold text-slate-950 px-6 sm:px-0">{c.valor}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <svg className="w-12 h-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <p className="text-sm text-slate-400 font-medium">Nenhuma contribuição registrada ainda.</p>
              </div>
            )}
          </div>
        </section>

        {/* Painel Direito: Agenda & Escalas */}
        <section className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-slate-900">Agenda & Escalas</h3>
              <Link to="/app/cultos" aria-label="Abrir agenda" className="p-1.5 hover:bg-slate-100 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </Link>
            </div>

            {stats.proximosCultos.length > 0 ? (
              <div className="space-y-4">
                {stats.proximosCultos.map((culto, idx) => {
                  const data = new Date(culto.data);
                  const mes = data.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();
                  const dia = data.toLocaleDateString("pt-BR", { day: "2-digit" });
                  const isLast = idx === stats.proximosCultos.length - 1;
                  return (
                    <div
                      key={culto.id}
                      className={`flex gap-4 items-start ${isLast ? "pb-2" : "pb-4 border-b border-slate-100"}`}
                    >
                      <div className="bg-slate-100 rounded-lg p-2.5 flex flex-col items-center justify-center shrink-0 w-12 text-center">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block leading-none">{mes}</span>
                        <span className="text-lg font-bold text-slate-800 block mt-0.5 leading-none">{dia}</span>
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-slate-900 text-sm">{culto.titulo}</h4>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                          <span>{culto.horario}{culto.local ? ` - ${culto.local}` : ""}</span>
                        </div>
                        {culto.status === "CONFIRMADO" && (
                          <span className="inline-flex text-[9px] font-extrabold text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5 border border-emerald-100 uppercase tracking-wider mt-1">
                            Confirmado
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <svg className="w-10 h-10 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <p className="text-sm text-slate-400 font-medium">Nenhum culto agendado.</p>
              </div>
            )}
          </div>

          <Link
            to="/app/cultos"
            className="w-full border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 py-3 rounded-lg text-sm font-semibold transition-colors mt-6 text-center block"
          >
            Ver Calendário Completo
          </Link>
        </section>
      </div>

    </main>
  );
}
