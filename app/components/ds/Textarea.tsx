/**
 * <Textarea /> — área de texto multilinha com label, hint, erro.
 *
 * @example
 *   <Textarea label="Observações" name="obs" rows={4} />
 */
import type { TextareaHTMLAttributes, ReactNode } from "react";
import { cn } from "~/lib/cn";

export type TextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "id"
> & {
  label: ReactNode;
  name: string;
  id?: string;
  hint?: string;
  error?: string;
  className?: string;
};

export function Textarea({
  label,
  name,
  id,
  hint,
  error,
  className,
  required,
  rows = 4,
  ...rest
}: TextareaProps) {
  const taId = id ?? name;
  const descId = `${taId}-desc`;
  const hasError = Boolean(error);

  return (
    <div className="space-y-1.5">
      <label htmlFor={taId} className="block text-xs font-bold text-fg">
        {label}
        {required && (
          <span aria-hidden="true" className="text-danger ml-1">
            *
          </span>
        )}
      </label>
      <textarea
        id={taId}
        name={name}
        rows={rows}
        required={required}
        aria-required={required || undefined}
        aria-invalid={hasError || undefined}
        aria-describedby={hint || error ? descId : undefined}
        className={cn(
          "w-full px-3 py-2.5 rounded-md border text-sm resize-y",
          "bg-surface text-fg placeholder:text-subtle",
          "border-border-strong hover:border-muted",
          "focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          hasError && "border-danger focus:border-danger focus:ring-danger/30",
          className,
        )}
        {...rest}
      />
      {error ? (
        <p id={descId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={descId} className="text-xs text-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
