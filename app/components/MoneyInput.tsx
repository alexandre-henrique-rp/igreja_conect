/**
 * Componente <MoneyInput /> — campo de valor monetário em reais (S06-T13).
 *
 * Aceita input numérico e aplica máscara BRL client-side via `mascaraBRL`.
 * O valor submetido é sempre uma string no formato "1.234,56" que o backend
 * converte para centavos via `parseBRLToCents`.
 *
 * **Acessibilidade:**
 * - `aria-label` no campo informa o propósito.
 * - Prefixo "R$" como elemento decorativo com `aria-hidden="true"`.
 * - Mensagem de erro com `role="alert"`.
 *
 * @example
 *   <MoneyInput
 *     name="valor"
 *     label="Valor"
 *     defaultValue=""
 *     error={fieldErrors?.valor?.[0]}
 *   />
 *
 * @param props - Props do componente.
 * @param props.name - Nome do campo (obrigatório).
 * @param props.label - Texto do label.
 * @param props.defaultValue - Valor inicial em formato BRL (ex: "1.234,56").
 * @param props.error - Mensagem de erro de validação.
 * @param props.required - Se true, adiciona asterisco no label.
 * @returns Elemento JSX do input monetário.
 */
import { cn } from "~/lib/cn";

/**
 * Props aceitas pelo `<MoneyInput>`.
 */
export type MoneyInputProps = {
  /** Nome do campo no formulário. */
  name: string;
  /** Texto do label. */
  label: string;
  /** Valor inicial em formato BRL (ex: "1.234,56"). */
  defaultValue?: string;
  /** Mensagem de erro. */
  error?: string;
  /** Se true, marca como obrigatório no label. */
  required?: boolean;
  /** Placeholder personalizado (default: "0,00"). */
  placeholder?: string;
  /** Desabilitado. */
  disabled?: boolean;
};

/**
 * @description Input monetário com máscara BRL client-side.
 * @param {MoneyInputProps} props - name, label, defaultValue, error, etc.
 * @returns {JSX.Element} Campo de valor com prefixo R$.
 */
export function MoneyInput({
  name,
  label,
  defaultValue = "",
  error,
  required = false,
  placeholder = "0,00",
  disabled = false,
}: MoneyInputProps) {
  const inputId = `money-${name}`;
  const hasError = Boolean(error);

  return (
    <div className="space-y-1">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
        {required && (
          <span aria-hidden="true" className="text-red-700 ml-1">
            *
          </span>
        )}
      </label>
      <div className="relative">
        <span
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium"
          aria-hidden="true"
        >
          R$
        </span>
        <input
          id={inputId}
          name={name}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-required={required || undefined}
          aria-invalid={hasError || undefined}
          aria-label={label}
          className={cn(
            "w-full h-11 pl-10 pr-3 rounded-md border bg-white text-slate-900 tabular-nums",
            "placeholder:text-slate-400",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            hasError ? "border-red-700" : "border-slate-300"
          )}
        />
      </div>
      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
