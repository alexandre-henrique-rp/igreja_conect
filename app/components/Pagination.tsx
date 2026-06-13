/**
 * Componente <Pagination /> — paginação acessível com links (S02-T03).
 *
 * Renderiza uma trilha de navegação de páginas:
 * 1. `<nav aria-label="Paginação">` — landmark para screen readers.
 * 2. `<ol>` com `<li>` para cada link — semântica de lista.
 * 3. Texto "Página N de M" para contexto.
 * 4. Link "Anterior" (omitido se current=1).
 * 5. Links numerados 1..total (página atual destacada em `font-bold text-cyan-700`).
 * 6. Link "Próxima" (omitido se current=total).
 *
 * **Preservação de filtros:** ao gerar o href de cada link, copia
 * `searchParams` (filtros) e substitui apenas `page`. Garante que ao
 * paginar, os filtros (q, tipo, ministerioId, etc.) permanecem.
 *
 * **Quando NÃO renderizar:** se `total <= 1`, retorna `null` — sem
 * paginação visível para 0 ou 1 página (UX consistente com a regra
 * do `design/PRODUCT.md §5.2`).
 *
 * **Acessibilidade (WCAG 2.4.5 — Multiple Ways):** cada página tem
 * link dedicado, navegável por Tab. `aria-current="page"` no link
 * ativo informa ao screen reader a posição atual.
 *
 * **Tailwind 4 utility-first:** sem `@apply`. Classes via string.
 *
 * @example
 *   <Pagination
 *     current={page}
 *     total={Math.ceil(total / pageSize)}
 *     basePath="/app/membros"
 *     searchParams={new URL(request.url).searchParams}
 *   />
 *
 * @param props - Props do componente (ver `PaginationProps`).
 * @returns Elemento JSX da paginação ou `null` se `total <= 1`.
 */
import { Link } from "react-router";

/**
 * Props aceitas pelo `<Pagination>`.
 */
export type PaginationProps = {
  /** Página atual (1-indexed). */
  current: number;
  /** Total de páginas (≥ 0). Se `total <= 1`, componente retorna `null`. */
  total: number;
  /** Caminho base do href (ex: `/app/membros`). */
  basePath: string;
  /** Search params atuais para preservar (exceto `page`). */
  searchParams?: URLSearchParams;
};

/**
 * Constrói o href de uma página preservando todos os search params
 * (exceto `page`, que é substituído).
 *
 * @param basePath - Caminho base.
 * @param page - Número da página destino.
 * @param original - SearchParams originais (podem ser undefined).
 * @returns String do href (ex: `/app/membros?tipo=X&page=2`).
 */
function buildHref(
  basePath: string,
  page: number,
  original?: URLSearchParams
): string {
  const params = new URLSearchParams(original ?? "");
  params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * @description Paginação acessível que preserva search params (filtros) ao mudar de página.
 * @param {PaginationProps} props - Página atual, total, basePath, searchParams.
 * @returns {JSX.Element | null} Nav de paginação ou `null` se `total <= 1`.
 */
export function Pagination({
  current,
  total,
  basePath,
  searchParams,
}: PaginationProps) {
  if (total <= 1) return null;

  const pages = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-2 mt-4 flex-wrap">
      <p className="text-sm text-slate-600">
        Página {current} de {total}
      </p>
      <ol className="flex items-center gap-1">
        {current > 1 && (
          <li>
            <Link
              to={buildHref(basePath, current - 1, searchParams)}
              className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
            >
              ‹ Anterior
            </Link>
          </li>
        )}
        {pages.map((p) => {
          const isCurrent = p === current;
          return (
            <li key={p}>
              <Link
                to={buildHref(basePath, p, searchParams)}
                aria-current={isCurrent ? "page" : undefined}
                className={
                  isCurrent
                    ? "inline-flex items-center justify-center h-9 min-w-9 px-2 rounded-md text-sm font-bold text-cyan-700 bg-cyan-50"
                    : "inline-flex items-center justify-center h-9 min-w-9 px-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
                }
              >
                {p}
              </Link>
            </li>
          );
        })}
        {current < total && (
          <li>
            <Link
              to={buildHref(basePath, current + 1, searchParams)}
              className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
            >
              Próxima ›
            </Link>
          </li>
        )}
      </ol>
    </nav>
  );
}
