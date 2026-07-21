/**
 * Componente <CardSaldoCaixa /> — card de resumo de um caixa (S06-T09).
 *
 * Exibe nome, saldo e ações disponíveis (detalhe, lançamento) para um caixa
 * individual. Usado no dashboard e na listagem de caixas.
 *
 * **Saldo baixo:** borda amber (warning) quando `saldoCentavos < 1000` (R$ 10,00).
 *
 * @example
 *   <CardSaldoCaixa
 *     caixa={{ id: "cx-1", nome: "Caixa Principal", saldoCentavos: 50000, ativo: true }}
 *   />
 *
 * @param props - Props do componente.
 * @param props.caixa - Dados resumidos do caixa.
 * @returns Elemento JSX do card.
 */
import { Link } from "react-router";
import type { CaixaResumo } from "~/lib/finance.server";
import { cn } from "~/lib/cn";
import { formatBRLFromCents } from "~/lib/money-format";

/**
 * Props aceitas pelo `<CardSaldoCaixa>`.
 */
export type CardSaldoCaixaProps = {
  /** Dados resumidos do caixa. */
  caixa: CaixaResumo;
};

/**
 * @description Card de resumo de caixa com saldo, clicável para a página do caixa.
 * @param {CardSaldoCaixaProps} props - caixa.
 * @returns {JSX.Element} Card do caixa.
 */
export function CardSaldoCaixa({
  caixa,
}: CardSaldoCaixaProps) {
  const saldoBaixo = caixa.saldoCentavos < 1000;

  return (
    <Link
      to={`/app/financeiro/caixas/${caixa.id}`}
      aria-label={`Caixa ${caixa.nome}, saldo ${formatBRLFromCents(caixa.saldoCentavos)}`}
      className={cn(
        "bg-white rounded-lg border p-4 flex flex-col gap-3 transition-colors hover:border-cyan-400 hover:shadow-sm",
        saldoBaixo ? "border-amber-300" : "border-slate-200"
      )}
      data-testid="card-saldo-caixa"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-900">
          {caixa.nome}
        </span>
      </div>

      <p className="text-2xl font-bold tabular-nums tracking-tight text-slate-900">
        {formatBRLFromCents(caixa.saldoCentavos)}
      </p>

      <div className="flex items-center gap-2">
        {!caixa.ativo && (
          <span className="text-xs text-slate-400 italic">Arquivado</span>
        )}
      </div>
    </Link>
  );
}
