/**
 * Componente <Input /> — campo de texto base do Igreja Conect (S01-T06).
 *
 * Renderiza `<label>` + `<input>` + mensagem opcional (hint ou erro)
 * totalmente acessível (WCAG 2.1 AA). Usado em todos os formulários:
 * cadastro de membro, edição, login, etc.
 *
 * **Acessibilidade:**
 * - `<label htmlFor={id}>` associado ao `<input id={id}>` (clique no label foca o input).
 * - `aria-required="true"` quando `required` (mas a validação fica no action, não em HTML5 — o form usa `noValidate`).
 * - `aria-invalid="true"` + `aria-describedby={id}-desc` quando há erro.
 * - `aria-describedby` também aponta para a mensagem de hint quando não há erro.
 * - Mensagem de erro tem `role="alert"` para que screen readers leiam imediatamente.
 * - Foco visível: `focus-visible:ring-2 focus-visible:ring-cyan-700`.
 *
 * **Variantes:**
 * - `type="email"`, `type="password"`, `type="tel"`, `type="text"` — todos suportados.
 * - `leadingIcon` à esquerda do input (ex: ícone de envelope).
 * - `trailingAction` à direita (ex: botão de toggle de visibilidade da senha).
 *
 * **Tailwind 4:** sem `@apply`. As classes vêm dos tokens de `app/app.css`.
 *
 * @example
 *   <Input
 *     label="E-mail"
 *     name="email"
 *     type="email"
 *     required
 *     autoComplete="email"
 *     inputMode="email"
 *     error={fieldErrors?.email?.[0]}
 *   />
 *
 * @example
 *   // Com toggle de visibilidade (sub-componente client-side)
 *   <Input
 *     label="Senha"
 *     name="senha"
 *     type="password"
 *     trailingAction={<ToggleVisibilidade for="senha" />}
 *   />
 *
 * @param props - Props do componente (ver `InputProps`).
 * @returns Elemento JSX do campo de input.
 */
import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "~/lib/cn";

/**
 * Props aceitas pelo `<Input>`. Aceita todas as props nativas de
 * `<input>` via `Omit<InputHTMLAttributes, ...>` (excluímos as que
 * gerenciamos internamente: `id`, `type` redefinido).
 */
export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  /** Texto do label (sempre visível). */
  label: string;
  /** `name` do campo — também usado no `id` quando não fornecido. */
  name: string;
  /** Tipo do input. Default: `text`. */
  type?: "text" | "email" | "password" | "tel" | "number" | "search" | "date";
  /** ID único — usado em `htmlFor` do label e `aria-describedby`. Default: `name`. */
  id?: string;
  /** Mensagem de ajuda exibida abaixo do input (só quando NÃO há erro). */
  hint?: string;
  /** Mensagem de erro — quando presente, vira vermelho e anuncia via screen reader. */
  error?: string;
  /** Ícone à esquerda do input (ex: envelope para e-mail). */
  leadingIcon?: ReactNode;
  /** Botão de ação à direita (ex: toggle de visibilidade). */
  trailingAction?: ReactNode;
};

/**
 * @description Input acessível com label, hint, erro e slots para ícones.
 * @param {InputProps} props - Veja `InputProps` para detalhes.
 * @returns {JSX.Element} Elemento do input.
 */
export function Input({
  label,
  name,
  type = "text",
  id,
  hint,
  error,
  leadingIcon,
  trailingAction,
  className,
  required,
  ...rest
}: InputProps) {
  const inputId = id ?? name;
  const descId = `${inputId}-desc`;
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
        {leadingIcon && (
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          >
            {leadingIcon}
          </span>
        )}
        <input
          id={inputId}
          name={name}
          type={type}
          required={required}
          aria-required={required || undefined}
          aria-invalid={hasError || undefined}
          aria-describedby={hint || error ? descId : undefined}
          className={cn(
            "w-full h-11 px-3 rounded-md border bg-white text-slate-900",
            "placeholder:text-slate-400",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            hasError ? "border-red-700" : "border-slate-300",
            Boolean(leadingIcon) && "pl-10",
            Boolean(trailingAction) && "pr-12",
            className
          )}
          {...rest}
        />
        {trailingAction && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2">
            {trailingAction}
          </span>
        )}
      </div>
      {error ? (
        <p
          id={descId}
          role="alert"
          className="text-sm text-red-700"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={descId} className="text-sm text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
