/**
 * Componente <BadgeStatus /> — badge de status ativo/arquivado (S06-T11).
 *
 * Exibe "Ativo" (tom `success`) ou "Arquivado" (tom `neutral`) usando o
 * `Badge` do Design System.
 *
 * @example
 *   <BadgeStatus ativo={true} />
 *   <BadgeStatus ativo={false} />
 *
 * @param props - Props do componente.
 * @param props.ativo - Se true, exibe "Ativo"; senão "Arquivado".
 * @returns Elemento JSX do badge.
 */
import { Badge } from "~/components/ds";

/**
 * Props aceitas pelo `<BadgeStatus>`.
 */
export type BadgeStatusProps = {
  /** Se true, badge "Ativo" (verde). Se false, badge "Arquivado" (neutro). */
  ativo: boolean;
};

/**
 * @description Badge de status ativo/arquivado com tons semânticos do DS.
 * @param {BadgeStatusProps} props - ativo.
 * @returns {JSX.Element} Badge de status.
 */
export function BadgeStatus({ ativo }: BadgeStatusProps) {
  return (
    <span data-testid="badge-status" className="inline-flex">
      <Badge tone={ativo ? "success" : "neutral"}>
        {ativo ? "Ativo" : "Arquivado"}
      </Badge>
    </span>
  );
}
