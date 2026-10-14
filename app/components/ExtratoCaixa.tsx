/**
 * Componente <ExtratoCaixa /> — extrato de lançamentos de um caixa (S06-T12).
 *
 * Exibe a lista de lançamentos em formato de tabela (desktop) ou cards (mobile).
 *
 * **Colunas (desktop):** Data | Tipo | Categoria | Valor (+/-) | Membro | Descrição | Comprovante
 * **SECRETARIO:** coluna Membro oculta se `podeVerMembro=false`.
 *
 * **Dízimo órfão (membro=null):** exibe "(membro removido)".
 *
 * **Comprovante (1:1):** coluna final mostra `<ComprovanteUpload>` (upload
 * inline + preview + download). Comprovantes são privados (LGPD art. 46) —
 * sempre via signed URL (15min).
 *
 * @example
 *   <ExtratoCaixa items={lancamentos} podeVerMembro={true} />
 *
 * @param props - Props do componente.
 * @param props.items - Lista de lançamentos (já com `comprovanteUrl` resolvida).
 * @param props.podeVerMembro - Se true, exibe coluna Membro.
 * @returns Elemento JSX do extrato.
 */
import { cn } from "~/lib/cn";
import type { LancamentoExtratoItem } from "~/lib/finance.server";
import { formatBRLFromCents } from "~/lib/money-format";
import { CardLancamento } from "./CardLancamento";
import { ComprovanteUpload } from "./ComprovanteUpload";
import { EmptyState } from "~/components/ds";

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
 * Props aceitas pelo `<ExtratoCaixa>`.
 */
export type ExtratoCaixaProps = {
  /** Lista de lançamentos (com `comprovanteUrl` resolvida no loader). */
  items: LancamentoExtratoItem[];
  /** Se true, exibe coluna Membro. */
  podeVerMembro: boolean;
};

function formatDateShort(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * @description Extrato de lançamentos com tabela responsiva, formatação condicional
 *   e coluna de comprovante (upload inline).
 * @param {ExtratoCaixaProps} props - items, podeVerMembro.
 * @returns {JSX.Element} Tabela ou cards do extrato.
 */
export function ExtratoCaixa({ items, podeVerMembro }: ExtratoCaixaProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Nenhum lançamento"
        description="Este caixa ainda não possui lançamentos."
      />
    );
  }

  return (
    <div data-testid="extrato-caixa">
      {/* Versão desktop: tabela */}
      <div className="hidden sm:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-muted uppercase tracking-wider">
              <th className="pb-2 pr-3">Data</th>
              <th className="pb-2 pr-3">Tipo</th>
              <th className="pb-2 pr-3">Categoria</th>
              <th className="pb-2 pr-3">Valor</th>
              {podeVerMembro && <th className="pb-2 pr-3">Membro</th>}
              <th className="pb-2 pr-3">Descrição</th>
              <th className="pb-2 pr-3">Comprovante</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isEntrada = item.tipo === "ENTRADA";
              const labelCat =
                CATEGORIA_LABEL[item.categoria] ?? item.categoria;
              const membroLabel =
                item.membro?.nome ??
                (item.categoria === "DIZIMO" ? "(membro removido)" : null);

              return (
                <tr
                  key={item.id}
                  className="border-b border-surface-2 hover:bg-surface-2 transition-colors align-middle"
                  data-testid={`extrato-row-${item.id}`}
                >
                  <td className="py-2 pr-3 text-sm text-muted tabular-nums whitespace-nowrap">
                    {formatDateShort(item.dataCompetencia)}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        isEntrada
                          ? "bg-success-soft text-success"
                          : "bg-danger-soft text-danger",
                      )}
                    >
                      {isEntrada ? "Entrada" : "Saída"}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-sm text-fg">{labelCat}</td>
                  <td
                    className={cn(
                      "py-2 pr-3 text-sm font-medium tabular-nums whitespace-nowrap",
                      isEntrada ? "text-success" : "text-danger",
                    )}
                  >
                    {isEntrada ? "+" : "-"}{" "}
                    {formatBRLFromCents(item.valorCentavos)}
                  </td>
                  {podeVerMembro && (
                    <td className="py-2 pr-3 text-sm text-muted">
                      {membroLabel ? (
                        <span
                          className={cn(!item.membro && "italic text-subtle")}
                        >
                          {membroLabel}
                        </span>
                      ) : (
                        <span className="text-border-strong">—</span>
                      )}
                    </td>
                  )}
                  <td className="py-2 text-sm text-muted max-w-xs truncate">
                    {item.descricao || (
                      <span className="text-border-strong">—</span>
                    )}
                  </td>
                  <td className="py-2 min-w-[260px]">
                    <ComprovanteUpload
                      lancamentoId={item.id}
                      currentUrl={item.comprovanteUrl}
                      currentFilename={item.attachmentUpload ? null : null}
                      currentUploadId={item.attachmentUploadId}
                      currentStatus={item.attachmentUpload?.status ?? null}
                      currentMime={item.attachmentUpload?.detectedMime ?? null}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Versão mobile: cards */}
      <div className="sm:hidden space-y-2">
        {items.map((item) => (
          <CardLancamento
            key={item.id}
            item={item}
            podeVerMembro={podeVerMembro}
          />
        ))}
      </div>
    </div>
  );
}
