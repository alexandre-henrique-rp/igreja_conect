import { Form, useSubmit } from "react-router";

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
  const submit = useSubmit();

  return (
    <Form method="get" className="flex flex-wrap items-center gap-3" onChange={(e) => submit(e.currentTarget)}>
      <input type="hidden" name="mostrarArquivados" value={String(mostrarArquivados)} />
      <div className="relative w-full md:w-72">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input
          name="q"
          type="text"
          defaultValue={q}
          className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition-all"
          placeholder="Buscar por nome..."
        />
      </div>
      <select
        name="tipo"
        defaultValue={tipo}
        className="pl-4 pr-10 py-2 border border-border rounded-lg text-sm font-semibold text-fg bg-surface focus:ring-2 focus:ring-accent/20 outline-none cursor-pointer"
      >
        <option value="">Todos os Tipos</option>
        <option value="CONSUMO">Consumo</option>
        <option value="PATRIMONIO">Patrimônio</option>
      </select>
      <button
        type="submit"
        className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent-strong transition-colors"
      >
        Filtrar
      </button>
    </Form>
  );
}
