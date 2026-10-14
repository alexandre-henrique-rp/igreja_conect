/**
 * <Checkbox /> + <CheckboxGroup /> — caixa de seleção acessível.
 *
 * @example
 *   <Checkbox name="aceito" label="Aceito os termos" required />
 */
import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "~/lib/cn";

export type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "id"
> & {
  label: ReactNode;
  name: string;
  id?: string;
  description?: ReactNode;
  className?: string;
};

export function Checkbox({
  label,
  name,
  id,
  description,
  className,
  ...rest
}: CheckboxProps) {
  const cbId = id ?? name;
  return (
    <label
      htmlFor={cbId}
      className={cn(
        "inline-flex items-start gap-2 cursor-pointer select-none",
        className,
      )}
    >
      <input
        id={cbId}
        name={name}
        type="checkbox"
        className={cn(
          "h-4 w-4 mt-0.5 rounded border-border-strong text-accent",
          "focus:outline-none focus:ring-2 focus:ring-accent/30 focus:ring-offset-2 focus:ring-offset-bg",
        )}
        {...rest}
      />
      <span className="text-sm text-fg">
        {label}
        {description && (
          <span className="block text-xs text-muted mt-0.5">{description}</span>
        )}
      </span>
    </label>
  );
}
