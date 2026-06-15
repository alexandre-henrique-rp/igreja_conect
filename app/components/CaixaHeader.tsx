/**
 * Componente <CaixaHeader /> — cabeçalho da página de detalhe de caixa (S06-T12).
 *
 * Exibe nome do caixa, saldo formatado, data de criação, total de lançamentos
 * e badge de status. Mostra um info-box de warning se o caixa estiver arquivado.
 *
 * @example
 *   <CaixaHeader
 *     caixa={{ id: "cx-1", nome: "Caixa Principal", saldoCentavos: 50000, ativo: true, lancamentosMes: 10, createdAt: new Date() }}
 *     totalLancamentos={42}
 *     podeGerenciar={true}
 *   />
 *
 * @param props - Props do componente.
 * @param props.caixa - Dados do caixa.
 * @param props.totalLancamentos - Total de lançamentos do caixa.
 * @param props.podeGerenciar - Se true, exibe ações de arquivar/reabrir.
 * @returns Elemento JSX do cabeçalho.
 */
import type { CaixaResumo } from "~/lib/finance.server";
import { formatBRLFromCents } from "~/lib/money-format";
import { BadgeStatus } from "./BadgeStatus";
import { InfoBox } from "./InfoBox";

/**
 * Props aceitas pelo `<CaixaHeader>`.
 */
export type CaixaHeaderProps = {
  /** Dados do caixa. */
  caixa: CaixaResumo;
  /** Total de lançamentos do caixa. */
  totalLancamentos: number;
  /** Se true, exibe ações de gerenciamento. */
  podeGerenciar: boolean;
};

function formatDateShort(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * @description Cabeçalho da página de detalhe de caixa com resumo e status.
 * @param {CaixaHeaderProps} props - caixa, totalLancamentos, podeGerenciar.
 * @returns {JSX.Element} Cabeçalho do caixa.
 */
export function CaixaHeader({
  caixa,
  totalLancamentos,
  podeGerenciar: _podeGerenciar,
}: CaixaHeaderProps) {
  return (
    <div data-testid="caixa-header" className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{caixa.nome}</h1>
          <BadgeStatus ativo={caixa.ativo} />
        </div>
      </div>

      <div className="flex flex-wrap gap-6 text-sm">
        <div>
          <span className="text-slate-500">Saldo: </span>
          <span className="font-semibold text-slate-900 tabular-nums">
            {formatBRLFromCents(caixa.saldoCentavos)}
          </span>
        </div>
        <div>
          <span className="text-slate-500">Criado em: </span>
          <span className="text-slate-700">
            {formatDateShort(caixa.createdAt)}
          </span>
        </div>
        <div>
          <span className="text-slate-500">Lançamentos: </span>
          <span className="text-slate-700">{totalLancamentos}</span>
        </div>
      </div>

      {!caixa.ativo && (
        <InfoBox tone="warning" title="Caixa Arquivado">
          Este caixa está arquivado e não aceita novos lançamentos.
          Para reativá-lo, utilize a opção Reabrir.
        </InfoBox>
      )}
    </div>
  );
}
