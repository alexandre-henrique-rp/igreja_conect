/**
 * Componente <CardTransferencia /> — card de exibição de transferência (S07-T03).
 *
 * Layout horizontal com seta indicando origem → destino, valor centralizado,
 * data e descrição. Link "Ver no extrato" preparado para S09+.
 *
 * @example
 *   <CardTransferencia
 *     transferencia={{
 *       grupoId: "uuid",
 *       origem: { nome: "Caixa Geral" },
 *       destino: { nome: "Cantina" },
 *       valorCentavos: 5000,
 *       data: new Date("2025-01-15"),
 *       descricao: "Reposição semanal"
 *     }}
 *   />
 *
 * @param props - Props do componente.
 * @param props.transferencia - Dados da transferência.
 * @returns Elemento JSX do card.
 */
import { formatBRLFromCents } from "~/lib/money-format";

/** Dados de uma transferência para display. */
export type TransferenciaDisplay = {
  grupoId: string;
  origem: { id: string; nome: string };
  destino: { id: string; nome: string };
  valorCentavos: number;
  data: Date;
  descricao?: string | null;
};

/**
 * Props aceitas pelo \`<CardTransferencia>\`.
 */
export type CardTransferenciaProps = {
  /** Dados da transferência a exibir. */
  transferencia: TransferenciaDisplay;
};

/**
 * @description Card horizontal exibindo uma transferência entre caixas.
 * @param {CardTransferenciaProps} props - transferencia.
 * @returns {JSX.Element} Card de transferência.
 */
export function CardTransferencia({ transferencia }: CardTransferenciaProps) {
  const { origem, destino, valorCentavos, data, descricao } = transferencia;

  const formattedDate = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(data));

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-white rounded-lg border border-slate-200">
      {/* Origem → Destino */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium text-slate-900 truncate">{origem.nome}</span>
        <svg
          className="w-4 h-4 text-slate-400 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
        <span className="text-sm font-medium text-slate-900 truncate">{destino.nome}</span>
      </div>

      {/* Valor centralizado */}
      <div className="flex-1 text-center">
        <span className="text-base font-bold text-cyan-700">
          {formatBRLFromCents(valorCentavos)}
        </span>
      </div>

      {/* Data + descrição */}
      <div className="flex flex-col items-end gap-0.5 min-w-0">
        <time dateTime={data.toISOString()} className="text-xs text-slate-500">
          {formattedDate}
        </time>
        {descricao && (
          <span className="text-xs text-slate-400 truncate max-w-[200px]" title={descricao}>
            {descricao}
          </span>
        )}
        <a
          href={`/app/financeiro/extrato?transferencia=${transferencia.grupoId}`}
          className="text-xs text-cyan-700 hover:text-cyan-800 underline"
        >
          Ver no extrato
        </a>
      </div>
    </div>
  );
}
