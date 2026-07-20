import { Form } from "react-router";

interface ItemEstoqueSearchBarProps {
  q: string;
  tipo: string;
  mostrarArquivados: boolean;
}

/**
 * Barra de busca e filtros para a lista de estoque.
 * Form GET que atualiza a URL com os parâmetros de busca.
 */
export default function ItemEstoqueSearchBar({
  q,
  tipo,
  mostrarArquivados,
}: ItemEstoqueSearchBarProps) {
  return (
    <Form method="get" className="flex flex-wrap items-center gap-3">
      <div className="relative w-full md:w-72">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input
          name="q"
          type="text"
          defaultValue={q}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
          placeholder="Buscar por nome..."
        />
      </div>
      <select
        name="tipo"
        defaultValue={tipo}
        className="pl-4 pr-10 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 bg-white focus:ring-2 focus:ring-blue-500/20 outline-none cursor-pointer"
      >
        <option value="">Todos os Tipos</option>
        <option value="CONSUMO">Consumo</option>
        <option value="PATRIMONIO">Patrimônio</option>
      </select>
      <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
        <input
          type="checkbox"
          name="mostrarArquivados"
          defaultChecked={mostrarArquivados}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        Mostrar arquivados
      </label>
      <button
        type="submit"
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
      >
        Filtrar
      </button>
    </Form>
  );
}
