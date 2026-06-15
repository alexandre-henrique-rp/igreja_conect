/**
 * Componente <TopbarPublica /> — topbar sticky para páginas públicas (S01-T06).
 *
 * **Estrutura:**
 * 1. Skip link WCAG (primeiro item focável — permite a usuários de
 *    teclado/screen reader pular direto para `<main id="main-content">`).
 * 2. `<header>` sticky com:
 *    - Logo "Igreja Conect" à esquerda (link para `/`).
 *    - Slot `entrarHref` à direita (botão "Entrar" opcional).
 *
 * **Por que skip link:** WCAG 2.4.1 (Bypass Blocks). Em uma topbar que
 * se repete em todas as páginas, dar a opção de pular evita que o
 * usuário de Tab precise tabular pelo logo + Entrar toda vez.
 *
 * **Visualmente:**
 * - Fundo branco com `border-b` slate-200 (sutis separação do conteúdo).
 * - Altura `h-14` (56px) — confortável para toque (≥ 44px) e para Tab.
 * - Sticky `top-0` com `z-10` (fica acima do conteúdo mas abaixo de modais futuros).
 *
 * **Quando usar:**
 * - Landing (`/`) → `entrarHref="/login"`.
 * - Login (`/login`) → sem `entrarHref` (o usuário já está no fluxo de entrar).
 *
 * @example
 *   // Na landing pública
 *   <TopbarPublica entrarHref="/login" />
 *
 * @example
 *   // No /login — sem botão Entrar
 *   <TopbarPublica />
 *
 * @param props - Props do componente (ver `TopbarPublicaProps`).
 * @returns Elemento JSX da topbar.
 */
import { Link } from "react-router";

/**
 * Props aceitas pelo `<TopbarPublica>`.
 */
export type TopbarPublicaProps = {
  /**
   * Se fornecido, renderiza um link "Entrar" à direita apontando para
   * este href. Use `null`/omitido quando o usuário já está na página
   * de login (não faz sentido mostrar "Entrar" duas vezes).
   */
  entrarHref?: string;
};

/**
 * @description Topbar pública com skip link WCAG, logo e botão Entrar opcional.
 * @param {TopbarPublicaProps} props - Veja `TopbarPublicaProps`.
 * @returns {JSX.Element} Elemento da topbar.
 */
export function TopbarPublica({ entrarHref }: TopbarPublicaProps) {
  return (
    <>
      {/*
        Skip link WCAG 2.4.1. Primeiro item focável; Tab pulará a
        navegação e mostrará o link "Pular para o conteúdo".
        Visualmente escondido até receber foco (sr-only + focus:not-sr-only).
      */}
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
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            to="/"
            aria-label="Ir para a página inicial"
            className="font-semibold text-slate-900 hover:text-cyan-700 transition-colors"
          >
            Igreja Conect
          </Link>
          {entrarHref && (
            <Link
              to={entrarHref}
              className="
                inline-flex items-center h-9 px-3 rounded-md
                text-sm font-medium text-cyan-700
                hover:bg-cyan-50
                focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-cyan-700 focus-visible:ring-offset-2
              "
            >
              Entrar
            </Link>
          )}
        </div>
      </header>
    </>
  );
}
