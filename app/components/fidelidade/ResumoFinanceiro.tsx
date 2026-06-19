/**
 * Componente <ResumoFinanceiro /> — KPIs de dízimos do membro (S08-T03).
 *
 * Exibe 3 cards: total contribuído (R$), meses com dízimo e quantidade
 * de dízimos. Estilo copiado de `<CardKpi>`.
 *
 * @example
 *   <ResumoFinanceiro
 *     totalCentavos={150000}
 *     mesesComDizimo={12}
 *     quantidadeDizimos={24}
 *   />
 *
 * @param props - Props do componente.
 * @param props.totalCentavos - Total em centavos.
 * @param props.mesesComDizimo - Quantidade de meses com ao menos 1 dízimo.
 * @param props.quantidadeDizimos - Quantidade total de dízimos.
 * @returns Elemento JSX.
 */
import { CardKpi } from "~/components/CardKpi";
import { formatBRLFromCents } from "~/lib/money-format";

/**
 * Props aceitas pelo `<ResumoFinanceiro>`.
 */
export type ResumoFinanceiroProps = {
  /** Total contribuído em centavos. */
  totalCentavos: number;
  /** Meses com ao menos 1 dízimo. */
  mesesComDizimo: number;
  /** Quantidade total de dízimos. */
  quantidadeDizimos: number;
};

/**
 * @description 3 KPI cards: total R$, meses com dízimo, quantidade.
 * @param {ResumoFinanceiroProps} props - totalCentavos, mesesComDizimo, quantidadeDizimos.
 * @returns {JSX.Element} Elemento JSX com 3 cards.
 */
export function ResumoFinanceiro({
  totalCentavos,
  mesesComDizimo,
  quantidadeDizimos,
}: ResumoFinanceiroProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <CardKpi
        label="Total contribuído"
        value={formatBRLFromCents(totalCentavos) as unknown as number}
      />
      <CardKpi
        label="Meses com dízimo"
        value={mesesComDizimo}
      />
      <CardKpi
        label="Quantidade"
        value={quantidadeDizimos}
      />
    </div>
  );
}
