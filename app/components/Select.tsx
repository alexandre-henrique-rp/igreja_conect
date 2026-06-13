/**
 * Componente <Select /> — `<select>` HTML acessível com label opcional (S02-T03).
 *
 * Wrapper leve sobre o `<select>` nativo. Quando `label` é fornecido, renderiza
 * `<label htmlFor={id}>` associado (WCAG 2.4.6 / 4.1.2). Sem `label`, o
 * `<select>` fica sem label visível — útil quando o contexto do form (ex:
 * `<label>` acima) já cobre a associação.
 *
 * **Diferença para `<Input />`:** Input encapsula mais (hint, error, ícones).
 * Select é focado em "lista curta de opções conhecidas". Para erros
 * de validação, exiba a mensagem no nível do `<FormField>` pai (ou
 * use `aria-describedby` externamente).
 *
 * **Mobile-first:** `h-11` (44px) para garantir target de toque ≥ 44px
 * (Apple HIG). Em `sm+`, o tamanho é confortável para clique.
 *
 * **Tailwind 4 utility-first:** sem `@apply`. Classes concatenadas via `cn()`.
 *
 * @example
 *   <Select
 *     name="tipo"
 *     id="tipo"
 *     label="Tipo"
 *     defaultValue={params.get("tipo") ?? ""}
 *     placeholder="Todos os tipos"
 *     options={[
 *       { value: "VISITANTE", label: "Visitantes" },
 *       { value: "CONGREGADO", label: "Congregados" },
 *       { value: "MEMBRO_ATIVO", label: "Membros ativos" },
 *     ]}
 *   />
 *
 * @param props - Props do componente (ver `SelectProps`).
 * @returns Elemento JSX do select.
 */
import type { SelectHTMLAttributes } from "react";
import { cn } from "~/lib/cn";

/**
 * Opção do `<Select>`. `value` é o que vai no submit; `label` é o texto visível.
 */
export type SelectOption = {
  /** Valor submetido no FormData. */
  value: string;
  /** Texto exibido para o usuário. */
  label: string;
};

/**
 * Props aceitas pelo `<Select>`. Aceita todas as props nativas de
 * `<select>` via `Omit<>` (excluímos as que gerenciamos internamente).
 */
export type SelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "id"
> & {
  /** `name` do select — também usado no `id` quando não fornecido. */
  name: string;
  /** Lista de opções renderizadas. */
  options: SelectOption[];
  /** Primeira option com `value=""` e este label (placeholder visual). */
  placeholder?: string;
  /** Texto do label (sempre visível). Quando omitido, não renderiza `<label>`. */
  label?: string;
  /** ID único — usado em `htmlFor` do label. Default: `name`. */
  id?: string;
};

/**
 * @description Select acessível com label opcional, options e placeholder.
 * @param {SelectProps} props - Veja `SelectProps`.
 * @returns {JSX.Element} Elemento do select.
 */
export function Select({
  name,
  options,
  placeholder,
  label,
  id,
  className,
  defaultValue,
  ...rest
}: SelectProps) {
  const selectId = id ?? name;

  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-slate-700"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        name={name}
        defaultValue={defaultValue}
        className={cn(
          "w-full h-11 px-3 pr-8 rounded-md border border-slate-300 bg-white text-slate-900",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
