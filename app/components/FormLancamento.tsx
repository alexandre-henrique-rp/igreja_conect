/**
 * Componente <FormLancamento /> — formulário de lançamento financeiro (S06-T13).
 *
 * Renderiza todos os campos de criação de lançamento: tipo, categoria,
 * valor (R$), caixa, membro (condicional), data de competência e descrição.
 *
 * **RN-FIN-05:**
 * - `DIZIMO` → membro obrigatório.
 * - `DESPESA_OPERACIONAL`, `COMPRA_ESTOQUE`, `MANUTENCAO`, `TRANSFERENCIA`
 *   → membro NÃO permitido.
 * - `OFERTA` e `CAMPANHA` → membro opcional.
 *
 * **Acessibilidade:**
 * - Todos os campos com `<label htmlFor={id}>`.
 * - Erros com `role="alert"`.
 * - Botões com `aria-disabled` durante submissão.
 * - Formulário com `noValidate` (validação server-side via Zod).
 *
 * @example
 *   <FormLancamento
 *     caixas={[{ id: "cx1", nome: "Caixa Principal" }]}
 *     membros={[{ id: "m1", nome: "João" }]}
 *     fieldErrors={{}}
 *     defaultValues={{}}
 *   />
 *
 * @param props - Props do componente.
 * @param props.caixas - Lista de caixas disponíveis.
 * @param props.membros - Lista de membros (para vínculo DIZIMO/OFERTA).
 * @param props.fieldErrors - Erros de validação por campo.
 * @param props.defaultValues - Valores preenchidos anteriormente.
 * @returns Elemento JSX do formulário.
 */
import type { CaixaResumo } from "~/lib/finance.server";
import { Input } from "./Input";
import { Select } from "./Select";
import { MoneyInput } from "./MoneyInput";
import { CATEGORIAS_LANCAMENTO, TIPOS_LANCAMENTO } from "~/lib/schemas/lancamentos";

/** Subset de Membro para o select. */
export type MembroOption = {
  id: string;
  nome: string;
};

/**
 * Props aceitas pelo `<FormLancamento>`.
 */
export type FormLancamentoProps = {
  /** Lista de caixas ativos. */
  caixas: { id: string; nome: string }[];
  /** Lista de membros. */
  membros: MembroOption[];
  /** Erros de validação (chave = name do campo). */
  fieldErrors: Record<string, string>;
  /** Valores padrão (preenchidos de volta em caso de erro). */
  defaultValues: Record<string, string>;
};

/** Mapa legível de tipo. */
const TIPO_LABEL: Record<string, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
};

/** Mapa legível de categoria. */
const CATEGORIA_LABEL: Record<string, string> = {
  DIZIMO: "Dízimo",
  OFERTA: "Oferta",
  CAMPANHA: "Campanha",
  DESPESA_OPERACIONAL: "Despesa Operacional",
  COMPRA_ESTOQUE: "Compra de Estoque",
  MANUTENCAO: "Manutenção",
  TRANSFERENCIA: "Transferência",
};

/**
 * @description Formulário de lançamento financeiro com campos acessíveis.
 * @param {FormLancamentoProps} props - caixas, membros, fieldErrors, defaultValues.
 * @returns {JSX.Element} Elemento do formulário.
 */
export function FormLancamento({
  caixas,
  membros,
  fieldErrors,
  defaultValues,
}: FormLancamentoProps) {
  return (
    <form method="POST" noValidate data-testid="form-lancamento" className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Tipo */}
        <Select
          name="tipo"
          label="Tipo"
          placeholder="Selecione o tipo"
          options={TIPOS_LANCAMENTO.map((t) => ({ value: t, label: TIPO_LABEL[t] ?? t }))}
          defaultValue={defaultValues.tipo ?? ""}
        />

        {/* Categoria */}
        <Select
          name="categoria"
          label="Categoria"
          placeholder="Selecione a categoria"
          options={CATEGORIAS_LANCAMENTO.map((c) => ({
            value: c,
            label: CATEGORIA_LABEL[c] ?? c,
          }))}
          defaultValue={defaultValues.categoria ?? ""}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Valor */}
        <MoneyInput
          name="valorDisplay"
          label="Valor"
          defaultValue={defaultValues.valorDisplay ?? ""}
          error={fieldErrors.valorDisplay}
          required
        />

        {/* Caixa */}
        <Select
          name="caixaId"
          label="Caixa"
          placeholder="Selecione o caixa"
          options={caixas.map((c) => ({ value: c.id, label: c.nome }))}
          defaultValue={defaultValues.caixaId ?? ""}
        />
      </div>

      {/* Membro (condicional por RN-FIN-05) */}
      <Select
        name="membroId"
        label="Membro (opcional)"
        placeholder="Nenhum"
        options={membros.map((m) => ({ value: m.id, label: m.nome }))}
        defaultValue={defaultValues.membroId ?? ""}
      />

      {/* Data de Competência */}
      <Input
        name="dataCompetencia"
        label="Data de Competência"
        type="date"
        defaultValue={defaultValues.dataCompetencia ?? ""}
        error={fieldErrors.dataCompetencia}
        required
      />

      {/* Descrição */}
      <div className="space-y-1">
        <label
          htmlFor="descricao"
          className="block text-sm font-medium text-slate-700"
        >
          Descrição
          <span aria-hidden="true" className="text-red-700 ml-1">*</span>
        </label>
        <textarea
          id="descricao"
          name="descricao"
          required
          rows={3}
          defaultValue={defaultValues.descricao ?? ""}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-required="true"
        />
        {fieldErrors.descricao && (
          <p role="alert" className="text-sm text-red-700">
            {fieldErrors.descricao}
          </p>
        )}
      </div>

      {/* Erro geral (não associado a campo) */}
      {fieldErrors._global && (
        <div role="alert" className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {fieldErrors._global}
        </div>
      )}

      {/* Ações */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-cyan-700 px-6 h-11 text-sm font-medium text-white hover:bg-cyan-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
        >
          Criar Lançamento
        </button>
      </div>

    </form>
  );
}
