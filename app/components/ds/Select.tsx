/**
 * <Select /> — dropdown com label, hint e erro (Acessível WCAG AA).
 *
 * @example
 *   <Select
 *     label="Status"
 *     name="status"
 *     options={[{ value: "ATIVO", label: "Ativo" }]}
 *   />
 */
import type { SelectHTMLAttributes, ReactNode } from "react";
import { cn } from "~/lib/cn";

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & {
  label: ReactNode;
  name: string;
  id?: string;
  options: SelectOption[];
  hint?: string;
  error?: string;
  placeholder?: string;
  variant?: "default" | "dark";
  className?: string;
};

export function Select({
  label,
  name,
  id,
  options,
  hint,
  error,
  placeholder,
  variant = "default",
  className,
  required,
  ...rest
}: SelectProps) {
  const selectId = id ?? name;
  const descId = `${selectId}-desc`;
  const hasError = Boolean(error);
  const isDark = variant === "dark";

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={selectId}
        className={cn(
          "block text-xs font-bold",
          isDark ? "text-muted" : "text-fg",
        )}
      >
        {label}
        {required && (
          <span aria-hidden="true" className="text-danger ml-1">
            *
          </span>
        )}
      </label>
      <div className="relative">
        <select
          id={selectId}
          name={name}
          required={required}
          aria-required={required || undefined}
          aria-invalid={hasError || undefined}
          aria-describedby={hint || error ? descId : undefined}
          className={cn(
            "w-full h-11 px-3 pr-10 rounded-md border text-sm appearance-none",
            "bg-surface text-fg",
            "border-border-strong hover:border-muted",
            "focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            hasError && "border-danger focus:border-danger focus:ring-danger/30",
            className,
          )}
          style={{
            backgroundImage:
              "linear-gradient(45deg, transparent 50%, var(--color-muted) 50%), linear-gradient(135deg, var(--color-muted) 50%, transparent 50%)",
            backgroundPosition:
              "calc(100% - 16px) 17px, calc(100% - 12px) 17px",
            backgroundSize: "4px 4px, 4px 4px",
            backgroundRepeat: "no-repeat",
          }}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
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
