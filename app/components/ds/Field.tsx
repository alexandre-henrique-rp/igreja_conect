/**
 * <Field /> — wrapper canônico de campo de formulário.
 *
 * Encapsula label + hint + error + required com acessibilidade WCAG AA.
 * Use SEMPRE que envolver um campo composto (textarea, autocomplete,
 * máscara custom). Para inputs nativos simples, prefira `<Input />`,
 * `<Select />`, `<Textarea />` (já trazem label/erro embutidos).
 *
 * **Tokens:** `text-fg`, `text-muted`, `text-danger`.
 *
 * @example
 *   <Field label="Nome" name="nome" required>
 *     <Input name="nome" />
 *   </Field>
 *
 * @example
 *   <Field label="Bio" hint="Até 500 caracteres.">
 *     <Textarea name="bio" />
 *   </Field>
 */
import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

export type FieldProps = {
  label: ReactNode;
  name: string;
  id?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
};

export function Field({
  label,
  name,
  id,
  required,
  hint,
  error,
  children,
  className,
}: FieldProps) {
  const fieldId = id ?? name;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const hasError = Boolean(error);

  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={fieldId}
        className="block text-xs font-bold text-fg"
      >
        {label}
        {required && (
          <span aria-hidden="true" className="text-danger ml-1">
            *
          </span>
        )}
      </label>
      {children}
      {!hasError && hint && (
        <p id={hintId} className="text-xs text-subtle">
          {hint}
        </p>
      )}
      {hasError && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
