/**
 * <Segmented /> — grupo de botões segmentados (toggle visual).
 *
 * @example
 *   <Segmented
 *     value={view}
 *     onChange={setView}
 *     options={[
 *       { value: "grid", label: "Grade" },
 *       { value: "list", label: "Lista" },
 *     ]}
 *   />
 */
import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

export type SegmentedOption<T extends string = string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
};

export type SegmentedProps<T extends string = string> = {
  value: T;
  onChange: (next: T) => void;
  options: SegmentedOption<T>[];
  "aria-label"?: string;
  className?: string;
};

export function Segmented<T extends string = string>({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex gap-0.5 p-0.5 bg-surface-3 rounded-md",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "min-h-[30px] px-3 text-[11px] font-bold rounded-sm",
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
              active
                ? "bg-surface text-accent-strong shadow-[0_1px_2px_oklch(20.8%_0.035_260_/_0.04)]"
                : "text-muted hover:text-fg",
              opt.disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
