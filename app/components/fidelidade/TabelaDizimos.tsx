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
import { EmptyState } from "~/components/ds";
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
    <div className="overflow-x-auto rounded-lg border border-border">
      <table
        className="w-full text-sm text-left"
        aria-label="Dízimos do membro"
      >
        <thead className="bg-surface-2 text-fg uppercase tracking-wide">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">
              Data
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Caixa
            </th>
            <th scope="col" className="px-4 py-3 font-semibold text-right">
              Valor
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-2 bg-surface">
          {dizimos.map((dizimo) => (
            <tr key={dizimo.id} className="hover:bg-surface-2">
              <td className="px-4 py-3 text-fg">
                {formatDate(new Date(dizimo.dataCompetencia))}
              </td>
              <td className="px-4 py-3 text-fg">{dizimo.caixaNome}</td>
              <td className="px-4 py-3 text-right font-medium text-fg tabular-nums">
                {formatBRLFromCents(dizimo.valorCentavos)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
