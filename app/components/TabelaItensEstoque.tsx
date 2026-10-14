import { Link } from "react-router";
import type { ItemEstoqueResumo } from "~/lib/itemEstoque.server";
import BadgeStatusPatrimonio from "./BadgeStatusPatrimonio";
import BadgeTipoItem from "./BadgeTipoItem";

interface TabelaItensEstoqueProps {
  items: ItemEstoqueResumo[];
  podeGerenciar: boolean;
  onArquivar?: (id: string) => void;
  onReabrir?: (id: string) => void;
  onExcluir?: (id: string) => void;
}

/**
 * Tabela de itens de estoque.
 * Colunas: Nome (link p/ detalhe), Tipo (badge), Quantidade, Status, Ações.
 */
export default function TabelaItensEstoque({
  items,
  podeGerenciar,
  onArquivar,
  onReabrir,
  onExcluir,
}: TabelaItensEstoqueProps) {
  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-subtle space-y-2">
        <p className="font-semibold text-muted">Nenhum produto encontrado</p>
        <p className="text-xs">Tente ajustar seus filtros de busca acima.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-surface-2/50">
            <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider border-b border-surface-2">
              Produto
            </th>
            <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider border-b border-surface-2">
              Tipo
            </th>
            <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider border-b border-surface-2 text-center">
              Qtd
            </th>
            <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider border-b border-surface-2">
              Status
            </th>
            <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider border-b border-surface-2">
              Localização
            </th>
            {podeGerenciar && (
              <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider border-b border-surface-2 text-right">
                Ações
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-2">
          {items.map((item) => {
            const isLow = item.tipo === "CONSUMO" && item.quantidade <= 5;
            return (
              <tr
                key={item.id}
                className="hover:bg-surface-2/50 transition-colors"
              >
                <td className="px-6 py-4">
                  <Link
                    to={`/app/estoque/${item.id}`}
                    className="font-semibold text-fg hover:text-accent transition-colors"
                  >
                    {item.nome}
                  </Link>
                  {!item.ativo && (
                    <span className="ml-2 text-xs text-subtle italic">
                      (arquivado)
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <BadgeTipoItem tipo={item.tipo} />
                </td>
                <td className="px-6 py-4 text-center">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      isLow
                        ? "bg-danger-soft text-danger"
                        : "bg-surface-2 text-fg"
                    }`}
                  >
                    {item.quantidade}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <BadgeStatusPatrimonio status={item.statusPatrimonio} />
                </td>
                <td className="px-6 py-4 text-sm text-muted">
                  {item.localizacaoFisica || "—"}
                </td>
                {podeGerenciar && (
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {item.ativo ? (
                        <button
                          type="button"
                          className="p-1.5 text-subtle hover:text-danger hover:bg-surface-2 rounded-md transition-colors cursor-pointer text-xs"
                          title="Arquivar"
                          onClick={() => onArquivar?.(item.id)}
                        >
                          Arquivar
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="p-1.5 text-subtle hover:text-success hover:bg-surface-2 rounded-md transition-colors cursor-pointer text-xs"
                            title="Reabrir"
                            onClick={() => onReabrir?.(item.id)}
                          >
                            Reabrir
                          </button>
                          <button
                            type="button"
                            className="p-1.5 text-subtle hover:text-danger hover:bg-danger-soft rounded-md transition-colors cursor-pointer text-xs"
                            title="Excluir permanentemente"
                            onClick={() => onExcluir?.(item.id)}
                          >
                            Excluir
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
