/**
 * Componente <CaixaSearchBar /> — barra de busca/filtro para listagem de caixas (S06-T11).
 *
 * Formulário GET que persiste busca textual (`q`) e toggle de "mostrar arquivados".
 * Os valores são lidos da URL/search params.
 *
 * @example
 *   // Na rota:
 *   const url = new URL(request.url);
 *   <CaixaSearchBar q={url.searchParams.get("q") ?? ""} mostrarArquivados={url.searchParams.get("mostrarArquivados") === "true"} />
 *
 * @param props - Props do componente.
 * @param props.q - Valor atual da busca (do search param).
 * @param props.mostrarArquivados - Se true, checkbox "mostrar arquivados" vem marcado.
 * @returns Elemento JSX do formulário de busca.
 */

/**
 * Props aceitas pelo `<CaixaSearchBar>`.
 */
export type CaixaSearchBarProps = {
  /** Valor atual do campo de busca. */
  q: string;
  /** Se true, checkbox "mostrar arquivados" está marcado. */
  mostrarArquivados: boolean;
};

/**
 * @description Formulário GET de busca textual + toggle de arquivados para listagem de caixas.
 * @param {CaixaSearchBarProps} props - q, mostrarArquivados.
 * @returns {JSX.Element} Barra de busca.
 */
export function CaixaSearchBar({
  q,
  mostrarArquivados,
}: CaixaSearchBarProps) {
  return (
    <form
      method="GET"
      data-testid="caixa-search-bar"
      className="flex flex-col sm:flex-row gap-3 mb-4"
    >
      <div className="flex-1">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar caixa por nome..."
          className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
          aria-label="Buscar caixa por nome"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer shrink-0">
        <input
          type="checkbox"
          name="mostrarArquivados"
          value="true"
          defaultChecked={mostrarArquivados}
          className="rounded border-slate-300 text-cyan-700 focus-visible:ring-cyan-700 h-4 w-4"
        />
        Mostrar arquivados
      </label>
      <button
        type="submit"
        className="inline-flex items-center justify-center h-10 px-4 rounded-md bg-cyan-700 text-white text-sm font-medium hover:bg-cyan-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
      >
        Filtrar
      </button>
    </form>
  );
}
