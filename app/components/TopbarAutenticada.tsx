/**
 * Componente <TopbarAutenticada /> — topbar do shell autenticado (S02-T09).
 *
 * Renderiza:
 * 1. Skip link WCAG (primeiro item focável — pula para `<main id="main-content">`).
 * 2. `<header>` sticky com:
 *    - Logo "Igreja Conect" (link para `/app`).
 *    - Ícone de alertas com badge de contagem (se `alertasNaoLidos > 0`).
 *    - Avatar + nome + cargo do usuário autenticado.
 *
 * **Diferença para `<TopbarPublica />`:** esta é para rotas autenticadas.
 * Tem avatar (não botão "Entrar") e o ícone de alertas com badge de contagem.
 *
 * **Badge de alertas:** `bg-amber-600` (contraste forte em branco) com
 * número. Se `alertasNaoLidos === 0`, **NÃO** renderiza badge (sem número
 * "0" — UX padrão: sem notificação, sem número).
 *
 * **LGPD (RN-MEM-02):** o componente NÃO exibe `email` ou outros PII
 * sensíveis — apenas `nome` (já em `SessionUser.nome`).
 *
 * **Acessibilidade:**
 * - Skip link WCAG 2.4.1 (pular para conteúdo).
 * - `aria-label` no ícone de alertas ("Alertas").
 * - `aria-label` no badge de contagem ("3 alertas não lidos").
 * - Foco visível com `focus-visible:ring-2 focus-visible:ring-cyan-700`.
 *
 * **Tailwind 4 utility-first:** sem `@apply`. Classes via string.
 *
 * @example
 *   <TopbarAutenticada
 *     user={loaderData.user}
 *     alertasNaoLidos={loaderData.alertasNaoLidos}
 *   />
 *
 * @param props - Props do componente (ver `TopbarAutenticadaProps`).
 * @returns Elemento JSX da topbar.
 */
import { Link } from "react-router";
import type { SessionUser } from "~/lib/session.types";

/**
 * Props aceitas pelo `<TopbarAutenticada>`.
 */
export type TopbarAutenticadaProps = {
  /** Usuário autenticado (vem do `SessionUser` do context). */
  user: SessionUser;
  /** Quantidade de alertas não lidos (loader). Se 0, sem badge. */
  alertasNaoLidos: number;
};

/**
 * Iniciais do usuário para o avatar (até 2 letras).
 *
 * @param nome - Nome completo.
 * @returns Iniciais em maiúsculas (ex: "Maria de Teste" → "MT").
 */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return (partes[0]![0]! + partes[partes.length - 1]![0]!).toUpperCase();
}

/**
 * @description Topbar do shell autenticado com avatar, badge de alertas e skip link.
 * @param {TopbarAutenticadaProps} props - User e alertasNaoLidos.
 * @returns {JSX.Element} Elemento da topbar.
 */
export function TopbarAutenticada({
  user,
  alertasNaoLidos,
}: TopbarAutenticadaProps) {
  return (
    <>
      {/* Skip link WCAG 2.4.1 */}
      <a
        href="#main-content"
        className="
          sr-only focus:not-sr-only
          focus:fixed focus:top-2 focus:left-2 focus:z-50
          focus:px-3 focus:py-2 focus:rounded-md
          focus:bg-cyan-700 focus:text-white focus:text-sm focus:font-medium
          focus:shadow-lg
        "
      >
        Pular para o conteúdo
      </a>

      <header className="sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <Link
            to="/app"
            aria-label="Ir para o dashboard"
            className="font-semibold text-slate-900 hover:text-cyan-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2 rounded"
          >
            Igreja Conect
          </Link>

          <div className="flex items-center gap-3">
            {/* Ícone de alertas com badge */}
            <Link
              to="/app/alertas"
              aria-label={
                alertasNaoLidos > 0
                  ? `Alertas (${alertasNaoLidos} não lidos)`
                  : "Alertas"
              }
              className="relative inline-flex items-center justify-center h-9 w-9 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {alertasNaoLidos > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-xs font-bold text-white bg-amber-600"
                >
                  {alertasNaoLidos > 99 ? "99+" : alertasNaoLidos}
                </span>
              )}
            </Link>

            {/* Avatar + nome + cargo */}
            <div
              className="flex items-center gap-2"
              data-testid="user-menu"
            >
              <span
                aria-hidden="true"
                className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-cyan-700 text-white text-sm font-semibold"
              >
                {iniciais(user.nome)}
              </span>
              <div className="hidden sm:flex flex-col text-right leading-tight">
                <span className="text-sm font-medium text-slate-900">
                  {user.nome}
                </span>
                <span className="text-xs text-slate-500">
                  {user.cargo ?? "Membro"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
