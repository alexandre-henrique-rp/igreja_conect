/**
 * Componente <TabelaDizimos /> — lista de dízimos do membro (S08-T03).
 *
 * Tabela responsiva com colunas: Data | Caixa | Valor.
 * Ordenação: dataCompetencia DESC (já vem do backend).
 * Empty state quando `dizimos.length === 0`.
 *
 * @example
 *   <TabelaDizimos dizimos={[{ id: "1", valorCentavos: 10000, dataCompetencia: new Date(), caixaId: "cx-1", caixaNome: "Caixa Principal" }]} />
 *
 * @param props - Props do componente.
 * @param props.dizimos - Lista de dízimos do membro.
 * @returns Elemento JSX da tabela.
 */
import { EmptyState } from "~/components/EmptyState";
import { formatBRLFromCents } from "~/lib/money-format";

/**
 * Tipo de um registro de dízimo.
 */
export type DizimoRow = {
  id: string;
  valorCentavos: number;
  dataCompetencia: Date;
  caixaId: string;
  caixaNome: string;
};

/**
 * Props aceitas pelo `<TabelaDizimos>`.
 */
export type TabelaDizimosProps = {
  /** Lista de dízimos (já ordenada por data DESC). */
  dizimos: DizimoRow[];
};

/**
 * Formata data para DD/MM/AAAA (pt-BR).
 */
function formatDate(date: Date): string {
  const dia = String(date.getDate()).padStart(2, "0");
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const ano = date.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

/**
 * @description Tabela responsiva de dízimos com empty state.
 * @param {TabelaDizimosProps} props - dizimos.
 * @returns {JSX.Element} Tabela ou empty state.
 */
export function TabelaDizimos({ dizimos }: TabelaDizimosProps) {
  if (dizimos.length === 0) {
    return (
      <EmptyState
        title="Nenhum dízimo registrado"
        description="Este membro ainda não possui dízimos registrados."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm text-left" aria-label="Dízimos do membro">
        <thead className="bg-slate-50 text-slate-700 uppercase tracking-wide">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">Data</th>
            <th scope="col" className="px-4 py-3 font-semibold">Caixa</th>
            <th scope="col" className="px-4 py-3 font-semibold text-right">Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {dizimos.map((dizimo) => (
            <tr key={dizimo.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-900">{formatDate(new Date(dizimo.dataCompetencia))}</td>
              <td className="px-4 py-3 text-slate-700">{dizimo.caixaNome}</td>
              <td className="px-4 py-3 text-right font-medium text-slate-900 tabular-nums">
                {formatBRLFromCents(dizimo.valorCentavos)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
