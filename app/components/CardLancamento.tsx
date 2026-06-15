/**
 * Componente <CardLancamento /> — card de lançamento individual (S06-T12).
 *
 * Versão mobile/card de cada lançamento no extrato. Exibe data, tipo,
 * categoria, valor, membro (condicional) e descrição.
 *
 * Entrada: texto verde. Saída: texto vermelho.
 *
 * @example
 *   <CardLancamento item={lancamento} podeVerMembro={true} />
 *
 * @param props - Props do componente.
 * @param props.item - Dados do lançamento.
 * @param props.podeVerMembro - Se true, exibe nome do membro.
 * @returns Elemento JSX do card.
 */
import type { LancamentoResumo } from "~/lib/finance.server";
import { cn } from "~/lib/cn";
import { formatBRLFromCents } from "~/lib/money-format";

/** Mapa de categorias para label legível. */
const CATEGORIA_LABEL: Record<string, string> = {
  DIZIMO: "Dízimo",
  OFERTA: "Oferta",
  CAMPANHA: "Campanha",
  DESPESA_OPERACIONAL: "Despesa Operacional",
  DESPESA: "Despesa",
  SALARIO: "Salário",
  TAXA: "Taxa",
  TRANSFERENCIA: "Transferência",
  OUTROS: "Outros",
};

/**
 * Props aceitas pelo `<CardLancamento>`.
 */
export type CardLancamentoProps = {
  /** Dados do lançamento. */
  item: LancamentoResumo;
  /** Se true, exibe nome do membro. */
  podeVerMembro: boolean;
};

function formatDateShort(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * @description Card de lançamento individual para versão mobile do extrato.
 * @param {CardLancamentoProps} props - item, podeVerMembro.
 * @returns {JSX.Element} Card do lançamento.
 */
export function CardLancamento({
  item,
  podeVerMembro,
}: CardLancamentoProps) {
  const isEntrada = item.tipo === "ENTRADA";
  const labelCat = CATEGORIA_LABEL[item.categoria] ?? item.categoria;

  return (
    <div
      data-testid={`card-lancamento-${item.id}`}
      className="bg-white rounded-lg border border-slate-200 p-3 space-y-1"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {formatDateShort(item.dataCompetencia)}
        </span>
        <span
          className={cn(
            "text-sm font-semibold tabular-nums",
            isEntrada ? "text-green-600" : "text-red-600"
          )}
        >
          {isEntrada ? "+" : "-"} {formatBRLFromCents(item.valorCentavos)}
        </span>
      </div>
      <p className="text-sm font-medium text-slate-900">{labelCat}</p>
      {item.membro && podeVerMembro && (
        <p className="text-xs text-slate-500">{item.membro.nome}</p>
      )}
      {item.descricao && (
        <p className="text-xs text-slate-400 truncate">{item.descricao}</p>
      )}
    </div>
  );
}
