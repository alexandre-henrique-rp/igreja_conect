/**
 * <Switch /> — toggle CSS-only (sem JS), com label e descrição.
 *
 * @example
 *   <Switch name="notif" label="Notificações por e-mail" defaultChecked />
 */
import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

export type SwitchProps = {
  name: string;
  label: ReactNode;
  description?: ReactNode;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
};

export function Switch({
  name,
  label,
  description,
  defaultChecked,
  checked,
  onChange,
  disabled,
  className,
  id,
}: SwitchProps) {
  const switchId = id ?? name;
  return (
    <label
      htmlFor={switchId}
      className={cn(
        "flex items-start justify-between gap-4 cursor-pointer select-none py-3",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      <span>
        <span className="block text-sm font-medium text-fg">{label}</span>
        {description && (
          <span className="block text-xs text-muted mt-0.5">{description}</span>
        )}
      </span>
      <span className="relative shrink-0 mt-1">
        <input
          id={switchId}
          name={name}
          type="checkbox"
          role="switch"
          defaultChecked={defaultChecked}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={cn(
            "block h-[22px] w-[38px] rounded-full bg-border-strong",
            "transition-colors duration-200",
            "peer-checked:bg-accent",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg",
            "after:absolute after:left-[3px] after:top-[3px] after:h-4 after:w-4",
            "after:rounded-full after:bg-surface after:shadow-sm",
            "after:transition-transform after:duration-200",
            "peer-checked:after:translate-x-4",
          )}
        />
      </span>
    </label>
  );
}
