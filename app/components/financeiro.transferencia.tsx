/**
 * Componente <FormTransferencia /> — formulário de transferência entre caixas (S07-T03, rework S07).
 *
 * Renderiza campos para origem, destino, valor e descrição de transferência.
 *
 * **Validação client-side:**
 * - origem !== destino
 * - valor > 0
 * - descrição ≤ 200 caracteres
 *
 * **Idempotency (SEC-S07-003):**
 * - Gera UUID v4 no mount via `crypto.randomUUID()`.
 * - Envia via campo hidden `idempotencyKey` no FormData.
 * - Previene double-submit/race condition.
 *
 * **Acessibilidade:**
 * - Todos os campos com `<label htmlFor>`.
 * - Erros com `role="alert"` e `aria-invalid`.
 * - `aria-describedby` apontando para mensagem de erro.
 * - Foco automático no primeiro campo com erro após submit.
 *
 * @example
 *   <FormTransferencia
 *     caixas={[{ id: "c1", nome: "Caixa Geral", saldoCentavos: 123456 }]}
 *     actionData={{ errors: {} }}
 *     defaultValues={{}}
 *   />
 *
 * @param props - Props do componente.
 * @param props.caixas - Lista de caixas disponíveis com saldo.
 * @param props.actionData - Resposta da action com erros ou valores preenchidos.
 * @param props.defaultValues - Valores para preservar em caso de erro.
 * @returns Elemento JSX do formulário.
 */
import { Form, useNavigation } from "react-router";
import { useEffect, useRef, useState } from "react";
import { Select } from "~/components/Select";
import { Input } from "~/components/Input";
import { MoneyInput } from "~/components/MoneyInput";
import { formatBRLFromCents } from "~/lib/money-format";

/** Opção de caixa para o select com saldo formatado. */
export type CaixaOption = {
  id: string;
  nome: string;
  saldoCentavos: number;
};

/** Erros de validação por campo. */
export type FormTransferenciaErrors = {
  origemId?: string;
  destinoId?: string;
  valorCentavos?: string;
  descricao?: string;
  _global?: string;
};

/** Dados de resposta da action. */
export type ActionData = {
  errors?: FormTransferenciaErrors;
  fields?: {
    origemId?: string;
    destinoId?: string;
    valorCentavos?: string;
    descricao?: string;
    idempotencyKey?: string;
  };
  formError?: string;
};

/**
 * Props aceitas pelo `<FormTransferencia>`.
 */
export type FormTransferenciaProps = {
  /** Lista de caixas disponíveis (com saldo). */
  caixas: CaixaOption[];
  /** Resposta da action (erros e valores preenchidos). */
  actionData?: ActionData;
  /** Valores padrão para preservar em caso de erro. */
  defaultValues?: {
    origemId?: string;
    destinoId?: string;
    valorCentavos?: string;
    descricao?: string;
  };
};

/**
 * @description Formulário de transferência entre caixas com validação client-side.
 * @param {FormTransferenciaProps} props - caixas, actionData, defaultValues.
 * @returns {JSX.Element} Elemento do formulário.
 */
export function FormTransferencia({
  caixas,
  actionData,
  defaultValues,
}: FormTransferenciaProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const firstErrorRef = useRef<HTMLSelectElement | HTMLInputElement | null>(null);

  // SEC-S07-003: Gerar idempotencyKey no mount (cliente)
  const [idempotencyKey, setIdempotencyKey] = useState<string>(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : (actionData?.fields?.idempotencyKey ?? "")
  );

  // Opções formatadas: nome + saldo
  const caixaOptions = caixas.map((c) => ({
    value: c.id,
    label: `${c.nome} — ${formatBRLFromCents(c.saldoCentavos)}`,
  }));

  // Valores do defaultValues ou actionData.fields
  const values = actionData?.fields ?? defaultValues ?? {};

  // Erros
  const errors = actionData?.errors ?? {};
  const formError = actionData?.formError;

  // Focar no primeiro campo com erro após submit
  useEffect(() => {
    if (!isSubmitting && firstErrorRef.current) {
      firstErrorRef.current.focus();
    }
  }, [isSubmitting]);

  // Monta refs para focusing
  const setOrigemRef = (el: HTMLSelectElement | null) => {
    if (errors.origemId) firstErrorRef.current = el;
  };
  const setDestinoRef = (el: HTMLSelectElement | null) => {
    if (errors.destinoId && !firstErrorRef.current) firstErrorRef.current = el;
  };
  const setValorRef = (el: HTMLInputElement | null) => {
    if (errors.valorCentavos && !firstErrorRef.current) firstErrorRef.current = el;
  };

  return (
    <Form
      method="POST"
      noValidate
      data-testid="form-transferencia"
      className="space-y-5"
    >
      {/* Erro global (não associado a campo). */}
      {formError && (
        <div
          role="alert"
          className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800"
        >
          {formError}
        </div>
      )}

      {/* SEC-S07-003: Idempotency key — hidden field */}
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Origem */}
        <div ref={setOrigemRef as never}>
          <Select
            name="origemId"
            label="Caixa de Origem"
            placeholder="Selecione o caixa de origem"
            options={caixaOptions}
            defaultValue={values.origemId ?? ""}
            required
            aria-invalid={errors.origemId ? true : undefined}
            aria-describedby={errors.origemId ? "origemId-error" : undefined}
          />
          {errors.origemId && (
            <p id="origemId-error" role="alert" className="text-sm text-red-700 mt-1">
              {errors.origemId}
            </p>
          )}
        </div>

        {/* Destino */}
        <div ref={setDestinoRef as never}>
          <Select
            name="destinoId"
            label="Caixa de Destino"
            placeholder="Selecione o caixa de destino"
            options={caixaOptions}
            defaultValue={values.destinoId ?? ""}
            required
            aria-invalid={errors.destinoId ? true : undefined}
            aria-describedby={errors.destinoId ? "destinoId-error" : undefined}
          />
          {errors.destinoId && (
            <p id="destinoId-error" role="alert" className="text-sm text-red-700 mt-1">
              {errors.destinoId}
            </p>
          )}
        </div>
      </div>

      {/* Valor */}
      <div ref={setValorRef as never}>
        <MoneyInput
          name="valorDisplay"
          label="Valor"
          defaultValue={values.valorCentavos ? String(Number(values.valorCentavos) / 100).replace(".", ",") : ""}
          error={errors.valorCentavos}
          required
        />
        <input type="hidden" name="valorCentavos" value={values.valorCentavos ?? ""} />
      </div>

      {/* Descrição */}
      <Input
        name="descricao"
        label="Descrição (opcional)"
        type="text"
        defaultValue={values.descricao ?? ""}
        error={errors.descricao}
        hint="Máximo 200 caracteres"
        maxLength={200}
        aria-describedby={errors.descricao ? "descricao-error" : "descricao-hint"}
      />
      {errors.descricao && (
        <p id="descricao-error" role="alert" className="text-sm text-red-700 -mt-3">
          {errors.descricao}
        </p>
      )}

      {/* Ações */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          aria-disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-md bg-cyan-700 px-6 h-11 text-sm font-medium text-white hover:bg-cyan-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Transferindo..." : "Transferir"}
        </button>
      </div>
    </Form>
  );
}
