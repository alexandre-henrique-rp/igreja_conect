/**
 * Componente <TabelaCaixas /> — tabela de listagem de caixas (S06-T11).
 *
 * Exibe caixas em formato de tabela (desktop) ou cards empilhados (mobile).
 *
 * **Colunas:** Nome, Saldo, Lançamentos (mês), Status, Ações.
 *
 * **Ações:** olho (detalhe) sempre visível; arquivar/reabrir condicional a `podeGerenciar`.
 *
 * @example
 *   <TabelaCaixas
 *     items={caixas}
 *     podeGerenciar={true}
 *     onArquivar={(id) => ...}
 *     onReabrir={(id) => ...}
 *   />
 *
 * @param props - Props do componente.
 * @param props.items - Lista de caixas.
 * @param props.podeGerenciar - Se true, exibe botões de arquivar/reabrir.
 * @param props.onArquivar - Callback para arquivar caixa.
 * @param props.onReabrir - Callback para reabrir caixa.
 * @returns Elemento JSX da tabela.
 */
import { Link } from "react-router";
import type { CaixaResumo } from "~/lib/finance.server";
import { formatBRLFromCents } from "~/lib/money-format";
import { BadgeStatus } from "./BadgeStatus";

/**
 * Props aceitas pelo `<TabelaCaixas>`.
 */
export type TabelaCaixasProps = {
  /** Lista de caixas a exibir. */
  items: CaixaResumo[];
  /** Se true, exibe botões de arquivar/reabrir. */
  podeGerenciar: boolean;
  /** Callback ao clicar em arquivar. */
  onArquivar?: (id: string) => void;
  /** Callback ao clicar em reabrir. */
  onReabrir?: (id: string) => void;
};

/**
 * @description Tabela responsiva de caixas com ações condicionais.
 * @param {TabelaCaixasProps} props - items, podeGerenciar, onArquivar, onReabrir.
 * @returns {JSX.Element} Tabela ou cards.
 */
export function TabelaCaixas({
  items,
  podeGerenciar,
  onArquivar,
  onReabrir,
}: TabelaCaixasProps) {
  if (items.length === 0) return null;

  return (
    <div data-testid="tabela-caixas">
      {/* Versão desktop: tabela */}
      <div className="hidden sm:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              <th className="pb-2 pr-4">Nome</th>
              <th className="pb-2 pr-4">Saldo</th>
              <th className="pb-2 pr-4">Lançamentos (mês)</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2 pr-4">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((caixa) => (
              <tr
                key={caixa.id}
                className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                data-testid={`caixa-row-${caixa.id}`}
              >
                <td className="py-3 pr-4">
                  <Link
                    to={`/app/financeiro/caixas/${caixa.id}`}
                    className="text-sm font-medium text-slate-900 hover:text-cyan-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2 rounded"
                  >
                    {caixa.nome}
                  </Link>
                </td>
                <td className="py-3 pr-4 text-sm font-medium tabular-nums text-slate-900">
                  {formatBRLFromCents(caixa.saldoCentavos)}
                </td>
                <td className="py-3 pr-4 text-sm text-slate-600">
                  {caixa.lancamentosMes}
                </td>
                <td className="py-3 pr-4">
                  <BadgeStatus ativo={caixa.ativo} />
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/app/financeiro/caixas/${caixa.id}`}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-md text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
                      aria-label={`Ver detalhes de ${caixa.nome}`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </Link>
                    {podeGerenciar && caixa.ativo && onArquivar && (
                      <button
                        type="button"
                        onClick={() => onArquivar(caixa.id)}
                        className="inline-flex items-center justify-center h-8 px-2 rounded-md text-xs font-medium text-amber-700 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
                        aria-label={`Arquivar ${caixa.nome}`}
                      >
                        Arquivar
                      </button>
                    )}
                    {podeGerenciar && !caixa.ativo && onReabrir && (
                      <button
                        type="button"
                        onClick={() => onReabrir(caixa.id)}
                        className="inline-flex items-center justify-center h-8 px-2 rounded-md text-xs font-medium text-green-700 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
                        aria-label={`Reabrir ${caixa.nome}`}
                      >
                        Reabrir
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Versão mobile: cards */}
      <div className="sm:hidden space-y-3">
        {items.map((caixa) => (
          <div
            key={caixa.id}
            className="bg-white rounded-lg border border-slate-200 p-4 space-y-2"
            data-testid={`caixa-card-${caixa.id}`}
          >
            <div className="flex items-center justify-between">
              <Link
                to={`/app/financeiro/caixas/${caixa.id}`}
                className="text-sm font-semibold text-slate-900 hover:text-cyan-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2 rounded"
              >
                {caixa.nome}
              </Link>
              <BadgeStatus ativo={caixa.ativo} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Saldo</span>
              <span className="font-medium tabular-nums text-slate-900">
                {formatBRLFromCents(caixa.saldoCentavos)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Lançamentos (mês)</span>
              <span className="text-slate-700">{caixa.lancamentosMes}</span>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Link
                to={`/app/financeiro/caixas/${caixa.id}`}
                className="inline-flex items-center justify-center h-8 px-3 rounded-md text-xs font-medium bg-cyan-700 text-white hover:bg-cyan-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
              >
                Detalhes
              </Link>
              {podeGerenciar && caixa.ativo && onArquivar && (
                <button
                  type="button"
                  onClick={() => onArquivar(caixa.id)}
                  className="inline-flex items-center justify-center h-8 px-3 rounded-md text-xs font-medium border border-amber-300 text-amber-700 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
                >
                  Arquivar
                </button>
              )}
              {podeGerenciar && !caixa.ativo && onReabrir && (
                <button
                  type="button"
                  onClick={() => onReabrir(caixa.id)}
                  className="inline-flex items-center justify-center h-8 px-3 rounded-md text-xs font-medium border border-green-300 text-green-700 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
                >
                  Reabrir
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
