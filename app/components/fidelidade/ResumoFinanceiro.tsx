/**
 * Componente <ResumoFinanceiro /> — KPIs de fidelidade do membro (S08-T03).
 *
 * 3 `KpiCard` do Design System: total contribuído (R$), meses com dízimo
 * e quantidade de dízimos.
 *
 * @example
 *   <ResumoFinanceiro totalCentavos={150000} mesesComDizimo={6} quantidadeDizimos={8} />
 *
 * @param props - Props do componente.
 * @param props.totalCentavos - Total contribuído em centavos.
 * @param props.mesesComDizimo - Meses com ao menos 1 dízimo.
 * @param props.quantidadeDizimos - Quantidade total de dízimos.
 * @returns Elemento JSX com 3 cards.
 */
import { KpiCard } from "~/components/ds";
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
      <KpiCard
        label="Total contribuído"
        value={formatBRLFromCents(totalCentavos)}
      />
      <KpiCard label="Meses com dízimo" value={mesesComDizimo} />
      <KpiCard label="Quantidade" value={quantidadeDizimos} />
    </div>
  );
}
