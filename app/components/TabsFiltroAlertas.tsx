/**
 * Componente <TabsFiltroAlertas /> — abas de filtro para alertas (S04-T07).
 *
 * Renderiza 3 abas (Todos, Não lidos, Resolvidos) com contagem em badge
 * cada uma. Usa `<Link>` do React Router com `?filter=` para navegação
 * (sem JS state — funciona sem JavaScript).
 *
 * A aba ativa recebe `aria-current="page"` para acessibilidade.
 *
 * @example
 *   <TabsFiltroAlertas
 *     activeFilter="naoLidos"
 *     counts={{ todos: 10, naoLidos: 3, resolvidos: 7 }}
 *   />
 *
 * @param props - Props do componente.
 * @param props.activeFilter - Filtro ativo ("todos", "naoLidos", "resolvidos").
 * @param props.counts - Contagens para cada filtro.
 * @returns Elemento JSX do nav de abas.
 */
import { Link } from "react-router";
import { cn } from "~/lib/cn";

/**
 * Contagens para cada filtro.
 */
export type FiltroCounts = {
  /** Total de alertas. */
  todos: number;
  /** Alertas não lidos. */
  naoLidos: number;
  /** Alertas resolvidos. */
  resolvidos: number;
};

/**
 * Filtro ativo.
 */
export type FiltroAlerta = "todos" | "naoLidos" | "resolvidos";

/**
 * Props aceitas pelo `<TabsFiltroAlertas>`.
 */
export type TabsFiltroAlertasProps = {
  /** Filtro atualmente selecionado. */
  activeFilter: FiltroAlerta;
  /** Contagens de cada categoria. */
  counts: FiltroCounts;
  /** Classes extras. */
  className?: string;
};

/** Definição das abas (label, filter key). */
const TABS = [
  { key: "todos" as FiltroAlerta, label: "Todos" },
  { key: "naoLidos" as FiltroAlerta, label: "Não lidos" },
  { key: "resolvidos" as FiltroAlerta, label: "Resolvidos" },
] as const;

/** Mapa de chave -> campo em counts. */
const COUNT_KEY: Record<FiltroAlerta, keyof FiltroCounts> = {
  todos: "todos",
  naoLidos: "naoLidos",
  resolvidos: "resolvidos",
};

/**
 * @description Abas de filtro com badges de contagem e links sem JS.
 * @param {TabsFiltroAlertasProps} props - activeFilter, counts.
 * @returns {JSX.Element} Elemento nav.
 */
export function TabsFiltroAlertas({
  activeFilter,
  counts,
  className,
}: TabsFiltroAlertasProps) {
  return (
    <nav
      className={cn("flex gap-1 border-b border-slate-200", className)}
      data-testid="tabs-filtro-alertas"
      aria-label="Filtrar alertas"
    >
      {TABS.map((tab) => {
        const isActive = tab.key === activeFilter;
        const count = counts[COUNT_KEY[tab.key]];
        return (
          <Link
            key={tab.key}
            to={`?filter=${tab.key}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "text-cyan-700 border-b-2 border-cyan-700 -mb-px"
                : "text-slate-500 hover:text-slate-700 hover:border-b-2 hover:border-slate-300 -mb-px"
            )}
          >
            {tab.label}
            <span
              className={cn(
                "inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-semibold",
                isActive
                  ? "bg-cyan-100 text-cyan-800"
                  : "bg-slate-100 text-slate-600"
              )}
            >
              {count}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
