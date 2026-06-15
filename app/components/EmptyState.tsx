/**
 * Componente <EmptyState /> — estado vazio com action opcional (S04-T10).
 *
 * Exibe título + descrição + action opcional (Link).
 * Usado em listas vazias para orientar o usuário.
 *
 * @example
 *   <EmptyState
 *     title="Nenhum resultado"
 *     description="Nenhum membro encontrado."
 *     action={{ label: "Criar membro", to: "/app/membros/novo" }}
 *   />
 *
 * @param props - Props do componente.
 * @param props.title - Título do empty state.
 * @param props.description - Descrição contextual.
 * @param props.action - Ação opcional (label + to).
 * @returns Elemento JSX.
 */
import { Link } from "react-router";
import { cn } from "~/lib/cn";

/**
 * Props aceitas pelo `<EmptyState>`.
 */
export type EmptyStateProps = {
  /** Título. */
  title: string;
  /** Descrição contextual. */
  description: string;
  /** Ação opcional (botão/Link). */
  action?: {
    label: string;
    to: string;
  };
  /** Classes extras. */
  className?: string;
};

/**
 * @description Estado vazio com descrição e ação opcional.
 * @param {EmptyStateProps} props - title, description, action.
 * @returns {JSX.Element} Elemento JSX.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      data-testid="empty-state"
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-12 w-12 text-slate-300 mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-2.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
        />
      </svg>
      <h3 className="text-lg font-medium text-slate-700 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 mb-4 max-w-sm">{description}</p>
      {action && (
        <Link
          to={action.to}
          className="inline-flex items-center justify-center rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-800 transition-colors"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
