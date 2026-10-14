/**
 * Rota / (Landing pública) — Design System completo (S05-F5).
 *
 * **Padrão do Design System (landing.html):**
 * - `.landing` wrapper.
 * - `.public-nav` com `.brand` (church mark + "Igreja Conect") + `.nav-actions`.
 * - `.hero` com `.hero-grid` (2 colunas): copy à esquerda, `.community-art` à direita.
 * - `.community-art` — ilustração abstrata CSS-only: sun (::before) + skyline + church + 4 pessoas.
 * - `.feature-section` com `.section-intro` + `.grid-3.feature-card` × 6.
 * - `.trust` strip + `.public-footer` com links.
 *
 * @see design/Igreja-Conect-Design-System/landing.html
 */
import type { Route } from "./+types/index";
import { Link, redirect } from "react-router";
import { Icon, Button } from "~/components/ds";
import { getUserFromRequest } from "~/lib/session.server";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Igreja Conect — Gestão completa para sua comunidade de fé" },
    {
      name: "description",
      content:
        "Organize pessoas, finanças, ministérios e encontros em um só lugar — com clareza para quem administra e mais tempo para quem cuida.",
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

const FEATURES = [
  { icon: "users", title: "Membros", desc: "Cadastro completo, busca avançada, filtros por tipo e status." },
  { icon: "wallet", title: "Caixas & dízimos", desc: "Lançamentos, transferências entre caixas e relatórios." },
  { icon: "package", title: "Estoque & patrimônio", desc: "Inventário, níveis mínimos e histórico de movimentações." },
  { icon: "users", title: "Ministérios", desc: "Equipes, liderança, escalas e oportunidades de serviço." },
  { icon: "heart", title: "Células", desc: "Pequenos grupos, líderes, participantes e encontros." },
  { icon: "calendar", title: "Cultos & escalas", desc: "Programação, voluntários e sorteio automático." },
];

export default function Landing() {
  return (
    <main id="main-content" className="landing bg-surface min-h-screen" data-od-id="landing-page">
      <nav className="public-nav" aria-label="Navegação principal" data-od-id="landing-nav">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Igreja Conect</span>
        </Link>
        <div className="nav-actions flex items-center gap-3.5">
          <Button
            as={Link}
            to="/login"
            variant="primary"
            size="sm"
            className="btn btn-primary btn-sm"
          >
            Entrar
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero" data-od-id="landing-hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">Gestão que serve a comunidade</span>
            <h1 className="title-xl">
              Gestão completa para sua comunidade de fé
            </h1>
            <p>
              Organize pessoas, finanças, ministérios e encontros em um só
              lugar — com clareza para quem administra e mais tempo para quem
              cuida.
            </p>
            <div className="hero-actions">
              <Button
                as={Link}
                to="/login"
                variant="primary"
                size="lg"
                className="btn btn-primary btn-lg"
              >
                Entrar
              </Button>
              <Button
                as={Link}
                to="#demo"
                variant="secondary"
                size="lg"
                className="btn btn-secondary btn-lg js-demo"
              >
                Ver demonstração
              </Button>
            </div>
            <div className="hero-note">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="m5 12 4 4L19 6" />
              </svg>
              <span>
                Acesse sua conta com segurança · feito para igrejas brasileiras
              </span>
            </div>
          </div>

          <div
            className="community-art"
            data-od-id="landing-hero-illustration"
            role="img"
            aria-label="Ilustração abstrata de uma igreja e pessoas reunidas"
          >
            <div className="art-skyline" />
            <div className="church">
              <span className="church-door" />
              <span className="church-window left" />
              <span className="church-window right" />
            </div>
            <div className="people">
              <span className="person" />
              <span className="person" />
              <span className="person" />
              <span className="person" />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="feature-section" data-od-id="landing-features">
        <div className="container">
          <div className="section-intro">
            <div>
              <span className="eyebrow">O que está incluído</span>
              <h2 className="title-md">Tudo que sua igreja precisa, em um só lugar.</h2>
            </div>
            <p>
              Módulos prontos para usar desde o primeiro dia. Personalize o
              que precisar.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="feature-card card-hover rounded-lg border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-[0_8px_20px_oklch(20.8%_0.035_260_/_0.08)]"
              >
                <div className="icon-wrap h-10 w-10 rounded-lg bg-accent-soft text-accent-strong grid place-items-center mb-6">
                  <Icon name={f.icon} size="lg" />
                </div>
                <h3 className="text-base font-bold text-fg mb-2">{f.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <div className="trust" id="demo">
        <div className="container">
          <p>
            Construído para igrejas brasileiras — segurança, LGPD e suporte em
            português.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="public-footer">
        <span>© 2026 Igreja Conect · ambiente de demonstração</span>
        <nav className="flex flex-wrap gap-4">
          <Link to="/login" className="hover:text-fg">
            Login
          </Link>
          <Link to="/login" className="hover:text-fg">
            App
          </Link>
          <Link to="/login" className="hover:text-fg">
            Membros
          </Link>
          <Link to="/login" className="hover:text-fg">
            Financeiro
          </Link>
          <Link to="/login" className="hover:text-fg">
            Estoque
          </Link>
          <Link to="/login" className="hover:text-fg">
            Configurações
          </Link>
        </nav>
      </footer>
    </main>
  );
}