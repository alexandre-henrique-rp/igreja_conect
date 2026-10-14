/**
 * Componente <BadgeStatus /> — badge de status ativo/arquivado (S06-T11).
 *
 * Exibe "Ativo" (bg-green-100 text-green-800) ou "Arquivado" (bg-gray-100 text-gray-800)
 * conforme o valor de `ativo`.
 *
 * @example
 *   <BadgeStatus ativo={true} />
 *   <BadgeStatus ativo={false} />
 *
 * @param props - Props do componente.
 * @param props.ativo - Se true, exibe "Ativo"; senão "Arquivado".
 * @returns Elemento JSX do badge.
 */
import { cn } from "~/lib/cn";

/**
 * Props aceitas pelo `<BadgeStatus>`.
 */
export type BadgeStatusProps = {
  /** Se true, badge "Ativo" (verde). Se false, badge "Arquivado" (cinza). */
  ativo: boolean;
};

/**
 * @description Badge de status ativo/arquivado com cores semânticas.
 * @param {BadgeStatusProps} props - ativo.
 * @returns {JSX.Element} Span com badge de status.
 */
export function BadgeStatus({ ativo }: BadgeStatusProps) {
  return (
    <span
      data-testid="badge-status"
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        ativo
          ? "bg-green-100 text-green-800"
          : "bg-gray-100 text-gray-800"
      )}
    >
      {ativo ? "Ativo" : "Arquivado"}
    </span>
  );
}
