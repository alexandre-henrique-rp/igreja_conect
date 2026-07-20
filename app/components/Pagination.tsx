import { Link } from "react-router";
import { cn } from "~/lib/cn";

export type PaginationProps = {
  current: number;
  total: number;
  basePath: string;
  searchParams?: URLSearchParams;
  totalItems?: number;
  pageSize?: number;
};

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

export function Pagination({
  current,
  total,
  basePath,
  searchParams,
  totalItems,
  pageSize = 25,
}: PaginationProps) {
  if (total <= 0) return null;

  const pages = Array.from({ length: total }, (_, i) => i + 1);

  // Calculate items range
  let rangeText = `Página ${current} de ${total}`;
  if (totalItems !== undefined) {
    const startItem = totalItems === 0 ? 0 : (current - 1) * pageSize + 1;
    const endItem = Math.min(current * pageSize, totalItems);
    rangeText = `Exibindo ${startItem} a ${endItem} de ${totalItems} membros`;
  }

  return (
    <nav
      aria-label="Paginação"
      className="flex items-center justify-between gap-4 mt-6 pt-4 border-t border-slate-100 flex-wrap"
    >
      <p className="text-sm font-semibold text-slate-500">
        {rangeText}
      </p>
      <ol className="flex items-center gap-1.5">
        <li>
          <Link
            to={current > 1 ? buildHref(basePath, current - 1, searchParams) : "#"}
            aria-disabled={current <= 1}
            tabIndex={current <= 1 ? -1 : undefined}
            className={cn(
              "inline-flex items-center h-9 px-4 rounded-lg text-sm font-semibold border border-slate-200 bg-white transition-colors",
              current > 1
                ? "text-slate-700 hover:bg-slate-50 cursor-pointer"
                : "text-slate-300 bg-slate-50/50 cursor-not-allowed pointer-events-none"
            )}
          >
            Anterior
          </Link>
        </li>
        {pages.map((p) => {
          const isCurrent = p === current;
          return (
            <li key={p}>
              <Link
                to={buildHref(basePath, p, searchParams)}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "inline-flex items-center justify-center h-9 min-w-9 px-3 rounded-lg text-sm font-semibold transition-colors border",
                  isCurrent
                    ? "bg-blue-600 text-white border-transparent hover:bg-blue-700"
                    : "text-slate-700 bg-white border-slate-200 hover:bg-slate-50"
                )}
              >
                {p}
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            to={current < total ? buildHref(basePath, current + 1, searchParams) : "#"}
            aria-disabled={current >= total}
            tabIndex={current >= total ? -1 : undefined}
            className={cn(
              "inline-flex items-center h-9 px-4 rounded-lg text-sm font-semibold border border-slate-200 bg-white transition-colors",
              current < total
                ? "text-slate-700 hover:bg-slate-50 cursor-pointer"
                : "text-slate-300 bg-slate-50/50 cursor-not-allowed pointer-events-none"
            )}
          >
            Próximo
          </Link>
        </li>
      </ol>
    </nav>
  );
}
