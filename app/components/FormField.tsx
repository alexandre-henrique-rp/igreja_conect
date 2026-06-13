/**
 * Componente <FormField /> — wrapper genérico de campo de formulário (S02-T03).
 *
 * Encapsula 3 responsabilidades em torno de qualquer campo (Input, Select,
 * textarea custom):
 * 1. **Label** associado via `htmlFor`/`id` (WCAG 3.3.2 — Labels or Instructions).
 * 2. **Hint** (mensagem de ajuda) com `id` próprio, pronto para `aria-describedby`.
 * 3. **Error** (mensagem de erro) com `role="alert"` (anuncia imediatamente).
 *
 * **Por que um wrapper genérico em vez de várias variantes?** O
 * `<Input />` e `<Select />` da S01 já encapsulam label + erro. Mas para
 * campos compostos (ex: input de telefone com máscara client-side,
 * input de CEP com botão "Buscar" — futuro) ou `<textarea>`, um wrapper
 * aberto é mais flexível.
 *
 * **Regra de ouro:** `error` **sempre** sobrescreve `hint` (não mostrar
 * dica quando o campo está em estado de erro).
 *
 * **Acessibilidade:**
 * - Label `htmlFor` → input focável por clique no label.
 * - `aria-required` no label quando `required` (asterisco vermelho decorativo).
 * - Mensagem de erro com `role="alert"` (anuncia mudança sem foco).
 *
 * **Tailwind 4 utility-first:** sem `@apply`. Classes via string.
 *
 * @example
 *   // Input simples
 *   <FormField label="Nome" name="nome" id="nome" required>
 *     <Input id="nome" name="nome" required />
 *   </FormField>
 *
 * @example
 *   // Com erro de validação
 *   <FormField label="E-mail" name="email" id="email" error={fieldErrors?.email?.[0]}>
 *     <Input id="email" name="email" type="email" />
 *   </FormField>
 *
 * @param props - Props do componente (ver `FormFieldProps`).
 * @returns Elemento JSX do wrapper de campo.
 */
import type { ReactNode } from "react";

/**
 * Props aceitas pelo `<FormField>`.
 */
export type FormFieldProps = {
  /** Texto do label. Sempre renderizado. */
  label: string;
  /** `name` do campo. Usado no `id` quando não fornecido. */
  name: string;
  /** ID único — usado em `htmlFor` do label. Default: `name`. */
  id?: string;
  /** Indica campo obrigatório (adiciona asterisco vermelho no label). */
  required?: boolean;
  /** Mensagem de ajuda (não renderizada quando há `error`). */
  hint?: string;
  /** Mensagem de erro. Quando presente, sobrescreve `hint` e usa `role="alert"`. */
  error?: string;
  /** O campo em si (Input, Select, textarea, etc.). */
  children: ReactNode;
};

/**
 * @description Wrapper de campo de formulário com label, hint, error e `aria-*`.
 * @param {FormFieldProps} props - Veja `FormFieldProps`.
 * @returns {JSX.Element} Elemento do wrapper.
 */
export function FormField({
  label,
  name,
  id,
  required,
  hint,
  error,
  children,
}: FormFieldProps) {
  const fieldId = id ?? name;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const hasError = Boolean(error);

  return (
    <div className="space-y-1">
      <label
        htmlFor={fieldId}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
        {required && (
          <span aria-hidden="true" className="text-red-700 ml-1">
            *
          </span>
        )}
      </label>
      {children}
      {!hasError && hint && (
        <p id={hintId} className="text-sm text-slate-500">
          {hint}
        </p>
      )}
      {hasError && (
        <p id={errorId} role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
