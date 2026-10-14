/**
 * <Input /> — campo de texto base com label, hint, erro e slots.
 *
 * **Variantes:** `default` (claro), `dark` (fundo escuro).
 *
 * **Tokens:** `bg-surface border-border-strong focus:border-accent ring-accent`.
 *
 * @example
 *   <Input
 *     label="E-mail"
 *     name="email"
 *     type="email"
 *     required
 *     error={fieldErrors?.email?.[0]}
 *   />
 */
import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "~/lib/cn";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: ReactNode;
  name: string;
  type?:
    | "text"
    | "email"
    | "password"
    | "tel"
    | "number"
    | "search"
    | "date"
    | "time"
    | "url";
  id?: string;
  hint?: string;
  error?: string;
  leadingIcon?: ReactNode;
  trailingAction?: ReactNode;
  variant?: "default" | "dark";
  hideAsterisk?: boolean;
  className?: string;
};

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
  variant = "default",
  hideAsterisk = false,
  ...rest
}: InputProps) {
  const inputId = id ?? name;
  const descId = `${inputId}-desc`;
  const hasError = Boolean(error);
  const isDark = variant === "dark";

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={inputId}
        className={cn(
          "block text-xs font-bold",
          isDark ? "text-muted" : "text-fg",
        )}
      >
        {label}
        {required && !hideAsterisk && (
          <span
            aria-hidden="true"
            className={cn("ml-1", isDark ? "text-danger" : "text-danger")}
          >
            *
          </span>
        )}
      </label>
      <div className="relative">
        {leadingIcon && (
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
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
          onClick={(e) => {
            if (type === "date" || type === "time") {
              try {
                e.currentTarget.showPicker();
              } catch {}
            }
            rest.onClick?.(e);
          }}
          onFocus={(e) => {
            if (type === "date" || type === "time") {
              try {
                e.currentTarget.showPicker();
              } catch {}
            }
            rest.onFocus?.(e);
          }}
          className={cn(
            "w-full h-11 px-3 rounded-md border text-sm",
            "bg-surface text-fg placeholder:text-subtle",
            "border-border-strong hover:border-muted",
            "focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            type === "date" || type === "time" ? "cursor-pointer" : "",
            hasError && "border-danger focus:border-danger focus:ring-danger/30",
            leadingIcon ? "pl-10" : null,
            trailingAction ? "pr-12" : null,
            className,
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
          className="text-xs text-danger"
        >
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
