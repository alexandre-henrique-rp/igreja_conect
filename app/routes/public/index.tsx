/**
 * Rota / (Landing pública) (S01-T08).
 *
 * Página inicial do Igreja Conect, acessível por qualquer visitante
 * anônimo. Dois objetivos:
 * 1. Identificar institucionalmente a igreja.
 * 2. Direcionar para `/login` (única ação real).
 *
 * **Server-side (`loader`):** se já há cookie válido, redireciona
 * direto para `/app` (UX: usuário logado não vê a landing).
 *
 * **UI:** tema dark/moderno com hero, feature cards glassmorphism e CTA.
 *
 * @see design/public-landing.DESIGN.md
 */
import type { Route } from "./+types/index";
import { Link, redirect } from "react-router";
import { Button } from "~/components/Button";
import { CardInfo } from "~/components/CardInfo";
import { TopbarPublica } from "~/components/TopbarPublica";
import { getUserFromRequest } from "~/lib/session.server";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Igreja Conect" },
    {
      name: "description",
      content:
        "Sistema interno de gestão eclesiástica local — membros, discipulado, ministérios e alertas.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUserFromRequest(request);
  if (user) {
    throw redirect("/app");
  }
  return null;
}

const ITENS_DISPONIVEIS = [
  "Cadastro e busca de membros",
  "Vínculo de discipulado (limite de 12 discípulos por líder)",
  "Vinculação de membros a ministérios",
  "Acolhimento automático de visitantes com alerta",
  "Central de alertas interna",
];

const ITENS_EM_DESENVOLVIMENTO = [
  "Módulo Financeiro (caixas, dízimos, ofertas)",
  "Módulo de Estoque (consumo e patrimônio)",
  "Manutenção de ativos",
];

const FEATURES = [
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: "Gestão de Membros",
    description: "Cadastro completo com busca, filtros e histórico de discipulado.",
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    title: "Sistema de Alertas",
    description: "Alertas internos automáticos para visitantes e ocorrências.",
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: "Ministérios",
    description: "Organize e vincule membros aos ministérios da igreja.",
  },
];

export default function Landing() {
  return (
    <>
      <TopbarPublica entrarHref="/login" />
      <main id="main-content" className="bg-[#070e1b] min-h-screen">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/15 blur-[140px] pointer-events-none" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />

          <div className="relative max-w-4xl mx-auto px-4 pt-20 pb-16 sm:pt-28 sm:pb-20 text-center z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Sistema de gestão eclesiástica
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Conecte sua{" "}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                igreja
              </span>{" "}
              com tecnologia
            </h1>

            <p className="mt-5 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Gerencie membros, discipulados, ministérios e alertas em um só
              lugar. Feito para igrejas que valorizam organização e acolhimento.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button as={Link} to="/login" variant="blue" size="md">
                Entrar no sistema
              </Button>
              <span className="text-sm text-slate-500">Acesso para membros autorizados</span>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-4xl mx-auto px-4 pb-16 sm:pb-20">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-[#121b2c]/60 backdrop-blur-sm border border-[#202f47] rounded-xl p-5 hover:border-blue-500/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 mb-4">
                  {f.icon}
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Disponível agora + Em desenvolvimento */}
        <section className="max-w-4xl mx-auto px-4 pb-16 sm:pb-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CardInfo
              title="Disponível agora"
              description="Funcionalidades ativas neste MVP."
              tone="available"
              variant="dark"
              items={ITENS_DISPONIVEIS}
            />
            <CardInfo
              title="Em desenvolvimento"
              description="Módulos previstos para sprints futuras."
              tone="planned"
              variant="dark"
              items={ITENS_EM_DESENVOLVIMENTO}
            />
          </div>
        </section>
      </main>

      <footer className="bg-[#070e1b] border-t border-[#202f47] py-6 text-center text-xs text-slate-500">
        © 2026 Igreja Conect — Sistema de gestão eclesiástica
      </footer>
    </>
  );
}
