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
import { cn } from "~/lib/cn";
import { EmptyState } from "~/components/ds";

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
  Visitante: "bg-warning-soft text-warning",
  Congregado: "bg-accent-soft-2 text-accent-strong",
  Membros: "bg-success-soft text-success",
};

function badgeClasse(cargo: string): string {
  return BADGE_CORES[cargo] ?? "bg-surface-2 text-fg";
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
      className={cn("border border-border rounded-lg bg-surface", className)}
    >
      <ul className="divide-y divide-surface-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium text-fg truncate">
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
