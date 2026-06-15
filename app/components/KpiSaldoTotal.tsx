/**
 * Componente <KpiSaldoTotal /> — KPI de saldo agregado do dashboard financeiro (S06-T09).
 *
 * Exibe o saldo total consolidado de todos os caixas ativos em formato BRL,
 * com contagem de caixas ativos abaixo do valor.
 *
 * **Visual:** fundo bg-cyan-700, texto branco, ícone de cifrão à esquerda.
 *
 * @example
 *   <KpiSaldoTotal saldoCentavos={150000} totalCaixas={3} />
 *
 * @param props - Props do componente.
 * @param props.saldoCentavos - Saldo total em centavos (Int).
 * @param props.totalCaixas - Quantidade de caixas ativos.
 * @param props.className - Classes extras.
 * @returns Elemento JSX do KPI.
 */
import { cn } from "~/lib/cn";
import { formatBRLFromCents } from "~/lib/money-format";

/**
 * Props aceitas pelo `<KpiSaldoTotal>`.
 */
export type KpiSaldoTotalProps = {
  /** Saldo total em centavos (Int). */
  saldoCentavos: number;
  /** Quantidade de caixas ativos. */
  totalCaixas: number;
  /** Classes extras. */
  className?: string;
};

/**
 * @description KPI de saldo total consolidado do módulo financeiro.
 * @param {KpiSaldoTotalProps} props - saldoCentavos, totalCaixas, className.
 * @returns {JSX.Element} Card com saldo formatado.
 */
export function KpiSaldoTotal({
  saldoCentavos,
  totalCaixas,
  className,
}: KpiSaldoTotalProps) {
  const plural = totalCaixas !== 1;
  return (
    <div
      data-testid="kpi-saldo-total"
      className={cn(
        "bg-cyan-700 text-white rounded-lg p-5 flex items-center gap-4",
        className
      )}
    >
      <div
        className="bg-cyan-600/50 rounded-full p-3 shrink-0"
        aria-hidden="true"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-7 w-7"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      </div>
      <div>
        <p className="text-3xl font-bold tabular-nums tracking-tight">
          {formatBRLFromCents(saldoCentavos)}
        </p>
        <p className="text-cyan-100 text-sm mt-0.5">
          {totalCaixas} caixa{plural ? "s" : ""} ativo{plural ? "s" : ""}
        </p>
      </div>
    </div>
  );
}
