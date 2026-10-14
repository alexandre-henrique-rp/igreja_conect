/**
 * <TopbarAutenticada /> — topbar persistente do shell autenticado.
 *
 * **Padrão do Design System (app-shell.html):**
 * - `.topbar` sticky (h-16) dentro de `.main-area`.
 * - Left: botão toggle (sidebar collapse) + breadcrumb (`.crumbs`).
 * - Right: search global (`.search`) com `kbd` shortcut `⌘ K`, notification
 *   bell com `.notification-dot`, user dropdown (avatar + nome + chevron).
 * - Inclui o `<ThemeToggle />` para alternar light/dark/auto.
 *
 * @example
 *   <TopbarAutenticada user={loaderData.user} alertasNaoLidos={3} />
 */
import { Link, useLocation } from "react-router";
import { useState, type RefObject } from "react";
import type { SessionUser } from "~/lib/session.types";
import { Icon } from "~/components/ds";
import { cn } from "~/lib/cn";
import { themeIcon, useTheme } from "~/lib/theme";

export type TopbarAutenticadaProps = {
  user: SessionUser;
  alertasNaoLidos: number;
  isMobileMenuOpen?: boolean;
  onMobileMenuOpen?: () => void;
  mobileMenuTriggerRef?: RefObject<HTMLButtonElement | null>;
};

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return (partes[0]![0]! + partes[partes.length - 1]![0]!).toUpperCase();
}

const BREADCRUMB_LABELS: Record<string, string> = {
  app: "Início",
  membros: "Membros",
  celulas: "Células",
  visitantes: "Visitantes",
  cultos: "Cultos",
  eventos: "Eventos",
  escalas: "Escalas",
  ministerios: "Ministérios",
  estoque: "Estoque",
  patrimonio: "Patrimônio",
  financeiro: "Financeiro",
  caixas: "Caixas",
  transferencias: "Transferencias",
  lancamentos: "Lançamentos",
  relatorios: "Relatórios",
  alertas: "Alertas",
  config: "Configurações",
  novo: "Novo",
  editar: "Editar",
};

function crumbLabel(segment: string): string {
  return BREADCRUMB_LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}

function ThemeToggle() {
  const { mode, cycle } = useTheme();
  const icon = themeIcon(mode);
  return (
    <button
      type="button"
      aria-label={`Tema (${icon.label}). Clique para alternar.`}
      title={icon.label}
      onClick={cycle}
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center rounded-md",
        "text-muted hover:bg-surface-3 hover:text-fg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
      )}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d={icon.d} />
      </svg>
    </button>
  );
}

export function TopbarAutenticada({
  user,
  alertasNaoLidos,
  isMobileMenuOpen = false,
  onMobileMenuOpen,
  mobileMenuTriggerRef,
}: TopbarAutenticadaProps) {
  const location = useLocation();
  const [query, setQuery] = useState("");

  const segments = location.pathname.split("/").filter(Boolean).slice(0, 4);
  const crumbs = segments.map((s, i) => ({
    label: crumbLabel(s),
    href: "/" + segments.slice(0, i + 1).join("/"),
    last: i === segments.length - 1,
  }));

  return (
    <>
      <a
        href="#main-content"
        className={cn(
          "sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50",
          "focus:px-3 focus:py-2 focus:rounded-md",
          "focus:bg-accent focus:text-white focus:text-sm focus:font-medium focus:shadow-lg",
        )}
      >
        Pular para o conteúdo
      </a>

      <header
        className="topbar sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-bg/95 px-4 backdrop-blur-md"
        data-od-id="app-shell-topbar"
      >
        <div className="topbar-left flex items-center gap-3">
          <button
            ref={mobileMenuTriggerRef}
            type="button"
            aria-label="Abrir menu principal"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation"
            onClick={onMobileMenuOpen}
            className={cn(
              "btn btn-ghost btn-icon inline-flex lg:hidden",
              "h-11 w-11 items-center justify-center rounded-md",
              "text-muted hover:bg-surface-3 hover:text-fg",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
            )}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {crumbs.length > 0 && (
            <nav aria-label="Breadcrumb" className="crumbs hidden sm:flex items-center gap-1.5 text-xs">
              {crumbs.map((c, i) => (
                <span key={c.href} className="contents">
                  {i > 0 && (
                    <Icon
                      name="chevron-right"
                      size="sm"
                      className="text-subtle"
                    />
                  )}
                  {c.last ? (
                    <strong className="text-fg font-bold">{c.label}</strong>
                  ) : (
                    <Link
                      to={c.href}
                      className="text-subtle hover:text-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm"
                    >
                      {c.label}
                    </Link>
                  )}
                </span>
              ))}
            </nav>
          )}
        </div>

        <div className="topbar-right flex items-center gap-3">
          <div className="search relative hidden md:block">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle">
              <Icon name="search" size="sm" />
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar pessoas, lançamentos..."
              aria-label="Busca global"
              className={cn(
                "h-9 w-[min(360px,32vw)] max-[1100px]:w-[min(220px,24vw)] pl-9 pr-12 rounded-md text-sm",
                "bg-surface border border-border-strong",
                "placeholder:text-subtle",
                "focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30",
              )}
            />
            <kbd className="absolute right-2 top-1.5 px-1.5 py-0.5 text-[10px] text-subtle bg-surface-2 border border-border rounded">
              ⌘ K
            </kbd>
          </div>

          <ThemeToggle />

          <Link
            to="/app/alertas"
            aria-label={
              alertasNaoLidos > 0
                ? `Alertas (${alertasNaoLidos} não lidos)`
                : "Alertas"
            }
            className="notification relative inline-flex h-11 w-11 items-center justify-center rounded-md text-muted hover:bg-surface-3 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Icon name="bell" size="md" />
            {alertasNaoLidos > 0 && (
              <>
                <span className="notification-dot absolute top-2 right-2 h-1.5 w-1.5 bg-danger border-2 border-surface rounded-full" />
                <span
                  aria-hidden="true"
                  className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-bold text-white bg-danger border-2 border-bg"
                >
                  {alertasNaoLidos > 99 ? "99+" : alertasNaoLidos}
                </span>
              </>
            )}
          </Link>

          <div className="dropdown relative">
            <details className="group">
              <summary
                aria-label="Abrir menu do usuário"
                className="list-none flex items-center gap-2 cursor-pointer select-none rounded-md hover:bg-surface-3 transition-colors px-1.5 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                <span
                  className={cn(
                    "inline-grid place-items-center rounded-full overflow-hidden",
                    "bg-accent text-white font-extrabold text-xs shrink-0",
                    "h-8 w-8",
                  )}
                  aria-hidden="true"
                >
                  {iniciais(user.nome)}
                </span>
                <span className="hidden min-[1101px]:flex flex-col text-right leading-tight">
                  <span className="text-xs font-bold text-fg">{user.nome.split(" ")[0]}</span>
                  <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                    {user.cargo === "ADMIN" ? "Administrador" : (user.cargo ?? "Membro")}
                  </span>
                </span>
                <Icon name="chevron-down" size="sm" className="text-muted group-open:rotate-180 transition-transform" />
              </summary>
              <div
                className={cn(
                  "dropdown-menu absolute z-30 right-0 mt-1 w-[190px]",
                  "bg-surface border border-border rounded-md shadow-[0_20px_50px_oklch(20.8%_0.035_260_/_0.15)]",
                  "py-1.5 grid gap-0.5",
                  "origin-top-right",
                )}
              >
                <Link
                  to="/app/config/acolhimento"
                  className="dropdown-item flex items-center gap-2 min-h-[34px] px-2.5 text-xs text-muted hover:bg-surface-3 hover:text-fg rounded-sm"
                >
                  <Icon name="user-check" size="sm" />
                  Meu perfil
                </Link>
                <Link
                  to="/app/config/acolhimento"
                  className="dropdown-item flex items-center gap-2 min-h-[34px] px-2.5 text-xs text-muted hover:bg-surface-3 hover:text-fg rounded-sm"
                >
                  <Icon name="settings" size="sm" />
                  Configurações
                </Link>
                <Link
                  to="/login"
                  className="dropdown-item flex items-center gap-2 min-h-[34px] px-2.5 text-xs text-muted hover:bg-surface-3 hover:text-danger rounded-sm"
                >
                  <Icon name="arrow-left" size="sm" />
                  Sair
                </Link>
              </div>
            </details>
          </div>
        </div>
      </header>
    </>
  );
}