/**
 * Componente <ListaRecente /> — lista de itens recentes (S04-T10).
 *
 * Exibe uma lista `<ul>` com nome, badge de cargo e RelativeTime.
 * Se `items` estiver vazio, renderiza `<EmptyState>` com texto contextual.
 *
 * @example
 *   <ListaRecente
 *     items={[
 *       { id: "1", nome: "João", cargo: "Visitante", createdAt: new Date() }
 *     ]}
 *     empty="Nenhum visitante recente"
 *   />
 *
 * @param props - Props do componente.
 * @param props.items - Lista de itens recentes.
 * @param props.empty - Texto do empty state quando items vazio.
 * @param props.now - Referência de "agora" para RelativeTime (opcional).
 * @returns Elemento JSX.
 */
import { RelativeTime } from "./RelativeTime";
import { EmptyState } from "./EmptyState";
import { cn } from "~/lib/cn";

/**
 * Item da lista recente.
 */
export type ListaRecenteItem = {
  /** ID único. */
  id: string;
  /** Nome da pessoa. */
  nome: string;
  /** Cargo/função (ex: Visitante, Congregado). */
  cargo: string;
  /** Data de criação do registro. */
  createdAt: Date;
};

/**
 * Props aceitas pelo `<ListaRecente>`.
 */
export type ListaRecenteProps = {
  /** Lista de itens. */
  items: ListaRecenteItem[];
  /** Texto exibido quando a lista está vazia. */
  empty: string;
  /** Referência de "agora" (opcional). */
  now?: Date;
  /** Classes extras. */
  className?: string;
};

/** Mapa de cores de badge por cargo. */
const BADGE_CORES: Record<string, string> = {
  Visitante: "bg-amber-100 text-amber-800",
  Congregado: "bg-blue-100 text-blue-800",
  Membros: "bg-green-100 text-green-800",
};

function badgeClasse(cargo: string): string {
  return BADGE_CORES[cargo] ?? "bg-slate-100 text-slate-700";
}

/**
 * @description Lista de itens recentes com empty state.
 * @param {ListaRecenteProps} props - items, empty, now, className.
 * @returns {JSX.Element} Elemento da lista.
 */
export function ListaRecente({
  items,
  empty,
  now,
  className,
}: ListaRecenteProps) {
  if (items.length === 0) {
    return <EmptyState title="Nada aqui" description={empty} />;
  }

  return (
    <div
      data-testid="lista-recente"
      className={cn("border border-slate-200 rounded-lg bg-white", className)}
    >
      <ul className="divide-y divide-slate-100">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium text-slate-900 truncate">
                {item.nome}
              </span>
              <span
                className={cn(
                  "inline-block text-xs font-medium px-2 py-0.5 rounded-full shrink-0",
                  badgeClasse(item.cargo)
                )}
              >
                {item.cargo}
              </span>
            </div>
            <RelativeTime
              date={item.createdAt}
              now={now}
              className="shrink-0"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
