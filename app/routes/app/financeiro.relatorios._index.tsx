/**
 * Rota /app/financeiro/relatorios — Hub de Relatórios Financeiros (cycle 4, S15).
 *
 * Página central com 4 cards de relatórios (DRE, Balancete, Fluxo, Customizado).
 * Dados reais do banco.
 *
 * **Camadas (defense in depth):**
 * - Loader (camada 2): assertCanSeeRelatorios(user) — RBAC.
 * - UI (camada 1): Sidebar esconde item para SECRETARIO/DISCIPULADOR/LIDER_MIN.
 *
 * **RBAC:** 3 perfis (ADMIN, PASTOR, FINANCEIRO). SECRETARIO bloqueado.
 *
 * @see design/relatorios-hub.DESIGN.md
 * @see design/relatorios-hub.PROMPT.md
 * @see brief-relatorios.md §4.4.1
 */
import { Link } from "react-router";
import type { Route } from "./+types/financeiro.relatorios._index";
import { userContext } from "~/lib/user-context";
import { assertCanSeeRelatorios } from "~/lib/rbac.server";
import { prisma } from "~/db/prisma.server";
import { Button } from "~/components/Button";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Relatórios — Igreja Conect" }];
}

/**
 * Loader: valida RBAC (camada 2) e retorna dados reais do Hub.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeRelatorios(user);

  const totalLancamentos = await prisma.lancamento.count();
  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  return {
    user,
    relatorios: [
      {
        id: "dre",
        titulo: "DRE (Demonstrativo de Resultado)",
        descricao: "Visão consolidada de receitas e despesas. Analise o superávit ou déficit mensal com detalhamento por categorias.",
        icone: "bar_chart_4_bars",
        cor: "blue",
        ultimaGeracao: totalLancamentos > 0 ? "Dados disponíveis" : "Sem dados",
        href: "/app/financeiro/relatorios/dre",
      },
      {
        id: "balancete",
        titulo: "Balancete Mensal",
        descricao: "Conferência completa de saldos bancários, entradas e saídas. Ideal para reuniões de conselho e prestação de contas.",
        icone: "description",
        cor: "emerald",
        ultimaGeracao: `${String(mesAtual + 1).padStart(2, "0")}/${anoAtual}`,
        href: "/app/financeiro/relatorios/balancete",
      },
      {
        id: "fluxo-caixa",
        titulo: "Fluxo de Caixa",
        descricao: "Projeções financeiras e acompanhamento diário de caixa. Visualize tendências e prepare-se para investimentos futuros.",
        icone: "trending_up",
        cor: "indigo",
        ultimaGeracao: "Atualizado em tempo real",
        href: "/app/financeiro/relatorios/fluxo-caixa",
      },
      {
        id: "customizado",
        titulo: "Relatório Customizado",
        descricao: "Crie filtros específicos por centro de custo, período ou departamento. Exporte dados em PDF ou CSV de forma flexível.",
        icone: "tune",
        cor: "orange",
        ultimaGeracao: "Personalize seus dados",
        href: "/app/financeiro/relatorios/customizado",
      },
    ],
    dica: {
      texto: "Mantenha seus lançamentos atualizados diariamente para garantir a precisão do seu Fluxo de Caixa projetado.",
    },
  };
}

// SVGs inline (Material Symbols convertidos) para 4 ícones + 1 utility
const IconBarChart = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
    <path d="M3 3h2v18H3V3zm4 8h2v10H7V11zm4-4h2v14h-2V7zm4 7h2v7h-2v-7zm4-3h2v10h-2V11z" />
  </svg>
);
const IconDescription = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
  </svg>
);
const IconTrendingUp = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
    <path d="M3 17l6-6 4 4 8-8m0 0v6m0-6h-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconTune = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
    <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z" />
  </svg>
);
const IconTips = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2a7 7 0 0 0-4 12.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26A7 7 0 0 0 12 2zm-2 19a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-1h-4v1z" />
  </svg>
);
const IconHistory = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 1 1 2.05 4.95l-1.42 1.42A9 9 0 1 0 13 3zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
  </svg>
);
const IconArrowForward = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z" />
  </svg>
);

const ICON_MAP: Record<string, React.ReactNode> = {
  bar_chart_4_bars: IconBarChart,
  description: IconDescription,
  trending_up: IconTrendingUp,
  tune: IconTune,
};

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  blue: { bg: "bg-blue-50", text: "text-blue-600" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600" },
  indigo: { bg: "bg-indigo-50", text: "text-indigo-600" },
  orange: { bg: "bg-orange-50", text: "text-orange-600" },
};

export default function HubRelatorios({ loaderData }: Route.ComponentProps) {
  const { relatorios, dica } = loaderData;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header alinhado ao Novo Lançamento */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatórios Financeiros</h1>
          <p className="text-slate-600 mt-1">Análises e demonstrativos detalhados do movimento financeiro da igreja.</p>
        </div>
        <Button variant="blue" size="sm">
          {IconHistory}
          Histórico de Geração
        </Button>
      </div>

      {/* Grid de cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {relatorios.map((r) => {
          const cor = COLOR_MAP[r.cor];
          const icon = ICON_MAP[r.icone];
          return (
            <div
              key={r.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow"
            >
              <div className="p-6 space-y-4">
                <div className={`w-12 h-12 ${cor.bg} rounded-xl flex items-center justify-center`}>
                  <span className={cor.text}>{icon}</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{r.titulo}</h3>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">{r.descricao}</p>
                </div>
              </div>
              <div className="mt-auto px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">{r.ultimaGeracao}</span>
                <Button as={Link} to={r.href} variant="blue" size="sm">
                  Gerar Relatório
                  {IconArrowForward}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Seção secundária */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-slate-900 text-white rounded-xl p-6 relative overflow-hidden flex items-center">
          <div className="z-10 max-w-lg">
            <h4 className="text-xl font-bold mb-2">Relatório de Transparência {new Date().getFullYear() - 1}</h4>
            <p className="text-slate-300 text-sm mb-6">
              Nosso compromisso é com a clareza e honestidade. Acesse o demonstrativo anual consolidado para apresentação à assembleia geral.
            </p>
            <Button variant="secondary" size="sm">
              Acessar Documento
            </Button>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-blue-600">{IconTips}</span>
            <h4 className="font-bold text-slate-900">Dica de Gestão</h4>
          </div>
          <p className="text-sm text-slate-600 italic">"{dica.texto}"</p>
          <div className="mt-6 flex items-center justify-between text-xs text-blue-500 font-semibold cursor-pointer hover:underline">
            <span>Ver mais dicas</span>
            <span>↗</span>
          </div>
        </div>
      </div>
    </div>
  );
}
