/**
 * Componente <CardSaldoCaixa /> — card de resumo de um caixa (S06-T09).
 *
 * Exibe nome, saldo e ações disponíveis (detalhe, lançamento) para um caixa
 * individual. Usado no dashboard e na listagem de caixas.
 *
 * **Saldo baixo:** borda amber (warning) quando `saldoCentavos < 1000` (R$ 10,00).
 *
 * **Ações condicionais:** botão "+ Lançar" visível apenas se `podeCriarLancamento`
 * e o caixa está ativo.
 *
 * @example
 *   <CardSaldoCaixa
 *     caixa={{ id: "cx-1", nome: "Caixa Principal", saldoCentavos: 50000, ativo: true }}
 *     podeCriarLancamento={true}
 *     user={sessionUser}
 *   />
 *
 * @param props - Props do componente.
 * @param props.caixa - Dados resumidos do caixa.
 * @param props.podeCriarLancamento - Se true, mostra botão '+ Lançar'.
 * @param props.user - Usuário autenticado.
 * @returns Elemento JSX do card.
 */
import { Link } from "react-router";
import type { CaixaResumo } from "~/lib/finance.server";
import type { SessionUser } from "~/lib/session.types";
import { cn } from "~/lib/cn";
import { formatBRLFromCents } from "~/lib/money-format";

/**
 * Props aceitas pelo `<CardSaldoCaixa>`.
 */
export type CardSaldoCaixaProps = {
  /** Dados resumidos do caixa. */
  caixa: CaixaResumo;
  /** Se true, exibe botão '+ Lançar'. */
  podeCriarLancamento: boolean;
  /** Usuário autenticado (para RBAC). */
  user: SessionUser;
};

/**
 * @description Card de resumo de caixa com saldo, link de detalhe e ação de lançamento.
 * @param {CardSaldoCaixaProps} props - caixa, podeCriarLancamento, user.
 * @returns {JSX.Element} Card do caixa.
 */
export function CardSaldoCaixa({
  caixa,
  podeCriarLancamento,
}: CardSaldoCaixaProps) {
  const saldoBaixo = caixa.saldoCentavos < 1000;

  return (
    <div
      aria-label={`Caixa ${caixa.nome}, saldo ${formatBRLFromCents(caixa.saldoCentavos)}`}
      className={cn(
        "bg-white rounded-lg border p-4 flex flex-col gap-3",
        saldoBaixo ? "border-amber-300" : "border-slate-200"
      )}
      data-testid="card-saldo-caixa"
    >
      <div className="flex items-center justify-between">
        <Link
          to={`/app/financeiro/caixas/${caixa.id}`}
          className="text-sm font-semibold text-slate-900 hover:text-cyan-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2 rounded"
        >
          {caixa.nome}
        </Link>
        <span className="text-xs text-slate-500">
          {caixa.lancamentosMes} lançamento{caixa.lancamentosMes !== 1 ? "s" : ""} (mês)
        </span>
      </div>

      <p className="text-2xl font-bold tabular-nums tracking-tight text-slate-900">
        {formatBRLFromCents(caixa.saldoCentavos)}
      </p>

      <div className="flex items-center gap-2">
        {!caixa.ativo && (
          <span className="text-xs text-slate-400 italic">Arquivado</span>
        )}
        {podeCriarLancamento && caixa.ativo && (
          <Link
            to={`/app/financeiro/lancamentos/novo?caixaId=${caixa.id}`}
            className="inline-flex items-center justify-center h-8 px-3 rounded-md text-sm font-medium bg-cyan-700 text-white hover:bg-cyan-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
            aria-label={`+ Lançar movimentação em ${caixa.nome}`}
          >
            + Lançar
          </Link>
        )}
      </div>
    </div>
  );
}
