/**
 * Componente <Breadcrumb /> — trilha de navegação semântica (S02-T03).
 *
 * Renderiza uma trilha de navegação com:
 * 1. `<nav aria-label="Trilha de navegação">` — landmark para screen readers.
 * 2. `<ol>` — lista ordenada (semântica de trilha, não de classificação).
 * 3. Itens com `href` viram `<Link>`; sem `href` viram `<span aria-current="page">`
 *    (último item, sem link).
 * 4. Separador `›` (U+203A) entre itens, em `text-slate-400`.
 *
 * **Visual:**
 * - Ancestrais: `text-cyan-700 hover:underline` (link, clicável).
 * - Atual: `font-medium text-slate-900` (sem link, indica "você está aqui").
 * - Separador: `text-slate-400` (sutis, não compete com o conteúdo).
 *
 * **Acessibilidade (WCAG 2.4.8 — Location):** o usuário sabe onde está
 * dentro da hierarquia de páginas. Screen reader anuncia "Trilha de
 * navegação" + lista de itens.
 *
 * **Tailwind 4 utility-first:** sem `@apply`. Classes via string template.
 *
 * @example
 *   <Breadcrumb
 *     items={[
 *       { label: "Membros", href: "/app/membros" },
 *       { label: "Maria da Silva" },
 *     ]}
 *   />
 *
 * @example
 *   // Sem link no pai (você está na home)
 *   <Breadcrumb items={[{ label: "Membros" }]} />
 *
 * @param props - Props do componente (ver `BreadcrumbProps`).
 * @returns Elemento JSX do breadcrumb.
 */
import { Link } from "react-router";

/**
 * Props aceitas pelo `<Breadcrumb>`.
 */
export type BreadcrumbProps = {
  /**
   * Itens da trilha em ordem do mais ancestral (esquerda) ao mais
   * específico (direita). O **último** item é considerado o "atual"
   * e NÃO deve ter `href` (regra do componente).
   */
  items: { label: string; href?: string }[];
};

/**
 * @description Trilha de navegação acessível (`<nav>` + `<ol>` + separador `›`).
 * @param {BreadcrumbProps} props - Itens da trilha.
 * @returns {JSX.Element} Elemento do breadcrumb.
 */
export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Trilha de navegação">
      <ol className="flex items-center gap-1 text-sm flex-wrap">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <Link
                  to={item.href}
                  className="text-cyan-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2 rounded"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className="font-medium text-slate-900"
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast && (
                <span className="text-slate-400" aria-hidden="true">
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
