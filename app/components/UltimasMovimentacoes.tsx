/**
 * Componente <UltimasMovimentacoes /> — lista dos últimos lançamentos (S06-T09).
 *
 * Exibe os últimos 5 lançamentos financeiros com data, valor, categoria,
 * tipo (ENTRADA/SAIDA) e condicionalmente o nome do membro.
 *
 * **Cores:** ENTRADA em verde (`text-green-600`), SAIDA em vermelho (`text-red-600`).
 *
 * **Categorias legíveis:** Dízimo, Oferta, Campanha, Despesa Operacional, etc.
 *
 * **SECRETARIO:** se `podeVerMembro=false`, membro é ocultado (label genérico "Dízimo").
 *
 * **Empty state:** reusa `<EmptyState>` se `items` está vazio.
 *
 * @example
 *   <UltimasMovimentacoes items={lancamentos} podeVerMembro={true} />
 *
 * @param props - Props do componente.
 * @param props.items - Lista de lançamentos resumidos.
 * @param props.podeVerMembro - Se true, exibe nomes de membros.
 * @returns Elemento JSX da lista.
 */
import type { LancamentoResumo } from "~/lib/finance.server";
import { cn } from "~/lib/cn";
import { formatBRLFromCents } from "~/lib/money-format";
import { EmptyState } from "./EmptyState";

/**
 * Props aceitas pelo `<UltimasMovimentacoes>`.
 */
export type UltimasMovimentacoesProps = {
  /** Lista de lançamentos resumidos (últimos 5). */
  items: LancamentoResumo[];
  /** Se true, exibe nome do membro. */
  podeVerMembro: boolean;
};

/** Mapa de categorias para label legível em PT-BR. */
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
 * Retorna label legível para a categoria.
 * @param categoria - Código da categoria.
 * @returns Label em PT-BR.
 */
function labelCategoria(categoria: string): string {
  return CATEGORIA_LABEL[categoria] ?? categoria;
}

/**
 * Formata data no formato dd/MM.
 * @param date - Data a formatar.
 * @returns String dd/MM.
 */
function formatDateShort(date: Date): string {
  const dia = String(date.getDate()).padStart(2, "0");
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}`;
}

/**
 * @description Lista das últimas movimentações financeiras com formatação condicional.
 * @param {UltimasMovimentacoesProps} props - items, podeVerMembro.
 * @returns {JSX.Element} Lista ou EmptyState.
 */
export function UltimasMovimentacoes({
  items,
  podeVerMembro,
}: UltimasMovimentacoesProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Nenhuma movimentação"
        description="Nenhum lançamento financeiro registrado ainda."
      />
    );
  }

  return (
    <div data-testid="ultimas-movimentacoes" className="space-y-1">
      {items.map((item) => {
        const isEntrada = item.tipo === "ENTRADA";
        const valorLabel = `${isEntrada ? "+" : "-"} ${formatBRLFromCents(item.valorCentavos)}`;
        const labelCat = labelCategoria(item.categoria);

        return (
          <div
            key={item.id}
            className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-slate-50 transition-colors"
            data-testid={`lancamento-${item.id}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm text-slate-500 tabular-nums shrink-0 w-10">
                {formatDateShort(item.dataCompetencia)}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {labelCat}
                  {item.membro && podeVerMembro && (
                    <span className="text-slate-500 font-normal">
                      {" "}— {item.membro.nome}
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {item.descricao || item.caixa.nome}
                </p>
              </div>
            </div>
            <span
              className={cn(
                "text-sm font-medium tabular-nums shrink-0 ml-2",
                isEntrada ? "text-green-600" : "text-red-600"
              )}
            >
              {valorLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}
