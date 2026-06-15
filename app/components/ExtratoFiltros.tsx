/**
 * Componente <ExtratoFiltros /> — filtros de extrato de caixa (S06-T12).
 *
 * Formulário GET com select de período e categoria, usado para filtrar
 * lançamentos do extrato de um caixa.
 *
 * @example
 *   <ExtratoFiltros
 *     periodo={params.get("periodo") ?? "todos"}
 *     categoria={params.get("categoria") ?? "todas"}
 *     basePath="/app/financeiro/caixas/cx-1"
 *   />
 *
 * @param props - Props do componente.
 * @param props.periodo - Período selecionado.
 * @param props.categoria - Categoria selecionada.
 * @param props.basePath - Path base (para voltar sem filtros).
 * @returns Elemento JSX do formulário de filtros.
 */
import { Link } from "react-router";

/** Opções de período. */
const PERIODOS = [
  { value: "todos", label: "Todos os períodos" },
  { value: "mes", label: "Este mês" },
  { value: "trimestre", label: "Últimos 3 meses" },
  { value: "ano", label: "Último ano" },
] as const;

/** Opções de categoria. */
const CATEGORIAS = [
  { value: "todas", label: "Todas as categorias" },
  { value: "DIZIMO", label: "Dízimo" },
  { value: "OFERTA", label: "Oferta" },
  { value: "CAMPANHA", label: "Campanha" },
  { value: "DESPESA_OPERACIONAL", label: "Despesa Operacional" },
  { value: "SALARIO", label: "Salário" },
  { value: "TAXA", label: "Taxa" },
  { value: "TRANSFERENCIA", label: "Transferência" },
  { value: "OUTROS", label: "Outros" },
] as const;

/**
 * Props aceitas pelo `<ExtratoFiltros>`.
 */
export type ExtratoFiltrosProps = {
  /** Período selecionado. */
  periodo: string;
  /** Categoria selecionada. */
  categoria: string;
  /** Path base para link "Limpar". */
  basePath: string;
};

/**
 * @description Formulário de filtros para extrato de caixa.
 * @param {ExtratoFiltrosProps} props - periodo, categoria, basePath.
 * @returns {JSX.Element} Form de filtros.
 */
export function ExtratoFiltros({
  periodo,
  categoria,
  basePath,
}: ExtratoFiltrosProps) {
  return (
    <form
      method="GET"
      data-testid="extrato-filtros"
      className="flex flex-col sm:flex-row gap-3 mb-4"
    >
      <select
        name="periodo"
        defaultValue={periodo}
        className="h-10 px-3 rounded-md border border-slate-300 text-sm bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
        aria-label="Período"
      >
        {PERIODOS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>

      <select
        name="categoria"
        defaultValue={categoria}
        className="h-10 px-3 rounded-md border border-slate-300 text-sm bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
        aria-label="Categoria"
      >
        {CATEGORIAS.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      <button
        type="submit"
        className="inline-flex items-center justify-center h-10 px-4 rounded-md bg-cyan-700 text-white text-sm font-medium hover:bg-cyan-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
      >
        Filtrar
      </button>

      <Link
        to={basePath}
        className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
      >
        Limpar
      </Link>
    </form>
  );
}
