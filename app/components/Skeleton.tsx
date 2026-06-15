/**
 * Componente <Skeleton /> — esqueleto de carregamento (S04-T10).
 *
 * Renderiza linhas placeholder com animação `animate-pulse` do Tailwind.
 * Útil para mostrar "algo carregando" enquanto dados não chegam.
 *
 * @example
 *   <Skeleton rows={3} />
 *
 * @param props - Props do componente.
 * @param props.rows - Número de linhas. Default: 3.
 * @returns Elemento JSX.
 */
import { cn } from "~/lib/cn";

/**
 * Props aceitas pelo `<Skeleton>`.
 */
export type SkeletonProps = {
  /** Número de linhas placeholder. Default: 3. */
  rows?: number;
  /** Classes extras. */
  className?: string;
};

/** Larguras fixas para render determinístico. */
const ROW_WIDTHS = [80, 85, 60, 90, 70] as const;

/**
 * @description Esqueleto de carregamento com animação pulse.
 * @param {SkeletonProps} props - rows, className.
 * @returns {JSX.Element} Elemento JSX.
 */
export function Skeleton({ rows = 3, className }: SkeletonProps) {
  return (
    <div
      data-testid="skeleton"
      className={cn("space-y-3", className)}
      aria-label="Carregando..."
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-slate-200 rounded animate-pulse"
          style={{ width: `${ROW_WIDTHS[i % ROW_WIDTHS.length]}%` }}
        />
      ))}
    </div>
  );
}
