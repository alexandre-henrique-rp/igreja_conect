import { Link, Form } from "react-router";
import BadgeTipoItem from "./BadgeTipoItem";
import BadgeStatusPatrimonio from "./BadgeStatusPatrimonio";
import type { ItemEstoqueResumo } from "~/lib/itemEstoque.server";

interface TabelaItensEstoqueProps {
  items: ItemEstoqueResumo[];
  podeGerenciar: boolean;
  onArquivar?: (id: string) => void;
  onReabrir?: (id: string) => void;
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
}: TabelaItensEstoqueProps) {
  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 space-y-2">
        <p className="font-semibold text-slate-600">Nenhum produto encontrado</p>
        <p className="text-xs">Tente ajustar seus filtros de busca acima.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/50">
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Produto</th>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Tipo</th>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 text-center">Qtd</th>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Status</th>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Localização</th>
            {podeGerenciar && (
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 text-right">Ações</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => {
            const isLow = item.tipo === "CONSUMO" && item.quantidade <= 5;
            return (
              <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <Link
                    to={`/app/estoque/${item.id}`}
                    className="font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                  >
                    {item.nome}
                  </Link>
                  {!item.ativo && (
                    <span className="ml-2 text-xs text-slate-400 italic">(arquivado)</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <BadgeTipoItem tipo={item.tipo} />
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    isLow ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"
                  }`}>
                    {item.quantidade}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <BadgeStatusPatrimonio status={item.statusPatrimonio} />
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {item.localizacaoFisica || "—"}
                </td>
                {podeGerenciar && (
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {item.ativo ? (
                        <button
                          type="button"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer text-xs"
                          title="Arquivar"
                          onClick={() => onArquivar?.(item.id)}
                        >
                          Arquivar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer text-xs"
                          title="Reabrir"
                          onClick={() => onReabrir?.(item.id)}
                        >
                          Reabrir
                        </button>
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
