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
 * **UI:**
 * - `<TopbarPublica entrarHref="/login" />` com skip link WCAG.
 * - `<main id="main-content">` com `<h1>Igreja Conect</h1>` + descrição.
 * - 2 `<CardInfo>` (disponíveis / em desenvolvimento).
 * - CTA "Entrar no sistema →" como `<Button as={Link} to="/login">`.
 * - `<footer>` com copyright.
 *
 * **LGPD (RAG §2.4):** zero coleta, zero cookie, zero dependência
 * externa. Página é puramente estática + 1 lookup de `getUserFromRequest`.
 *
 * **Acessibilidade (WCAG 2.1 AA):**
 * - Skip link no topo (via TopbarPublica).
 * - `<h1>` único e descritivo.
 * - `<h2>` nos cards (hierarquia correta).
 * - Foco visível, contraste AA+ (slate-900 em slate-50).
 *
 * @see design/public-landing.DESIGN.md
 */
import type { Route } from "./+types/index";
import { Link, redirect } from "react-router";
import { Button } from "~/components/Button";
import { CardInfo } from "~/components/CardInfo";
import { TopbarPublica } from "~/components/TopbarPublica";
import { getUserFromRequest } from "~/lib/session.server";

/**
 * Metadados da página (title + description).
 */
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

/**
 * Loader: redireciona para `/app` se já houver cookie válido.
 * Senão, retorna `null` (loader ok = renderiza a landing).
 */
export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUserFromRequest(request);
  if (user) {
    throw redirect("/app");
  }
  return null;
}

/**
 * Conteúdo informativo dos 2 cards.
 * Mantido inline (sem `i18n` — YAGNI) e em PT-BR.
 */
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

/**
 * Componente principal da landing.
 *
 * Renderiza: topbar + main (h1, descrição, 2 cards, CTA) + footer.
 */
export default function Landing() {
  return (
    <>
      <TopbarPublica entrarHref="/login" />
      <main
        id="main-content"
        className="max-w-3xl mx-auto px-4 py-12 sm:py-16"
      >
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Igreja Conect
          </h1>
          <p className="text-base text-slate-600 mt-1">
            Sistema de gestão eclesiástica local
          </p>
        </header>

        <div className="space-y-6">
          <CardInfo
            title="O que está disponível agora"
            description="Funcionalidades ativas neste MVP."
            tone="available"
            items={ITENS_DISPONIVEIS}
          />
          <CardInfo
            title="Em desenvolvimento"
            description="Módulos previstos para sprints futuras."
            tone="planned"
            items={ITENS_EM_DESENVOLVIMENTO}
          />
        </div>

        <div className="mt-8">
          <Button as={Link} to="/login" variant="primary" size="md">
            Entrar no sistema →
          </Button>
        </div>
      </main>
      <footer className="border-t border-slate-200 mt-12 py-4 text-center text-xs text-slate-500">
        © Igreja Conect 2026
      </footer>
    </>
  );
}
