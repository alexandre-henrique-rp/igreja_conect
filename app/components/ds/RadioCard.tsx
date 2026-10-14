/**
 * <RadioGroup /> + <RadioCard /> — radios clássicos ou em formato card.
 *
 * **RadioCard** é o padrão visual do Design System (cartão selecionável,
 * ex: tipo de movimentação, role, etc.).
 *
 * @example
 *   <RadioGroup name="tipo" value={tipo} onChange={setTipo}>
 *     <RadioCard value="in" label="Entrada" description="Adicionar ao caixa." />
 *     <RadioCard value="out" label="Saída" description="Retirar do caixa." />
 *   </RadioGroup>
 */
import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

export type RadioCardProps = {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  /** Tom aplicado quando selecionado. Default: `accent`. */
  tone?: "accent" | "warning";
  className?: string;
};

export function RadioCard({
  value,
  label,
  description,
  icon,
  tone = "accent",
  className,
}: RadioCardProps) {
  return (
    <label
      className={cn(
        "radio-card group",
        "flex items-center gap-2.5 min-h-12 px-3.5 py-0 rounded-md border border-border-strong",
        "text-xs font-bold text-muted bg-surface cursor-pointer",
        "transition-colors hover:text-fg hover:border-accent",
        "has-[:checked]:text-accent-strong has-[:checked]:bg-accent-soft has-[:checked]:border-accent",
        tone === "warning" &&
          "has-[:checked]:text-warning has-[:checked]:bg-warning-soft has-[:checked]:border-warning",
        className,
      )}
    >
      <input
        type="radio"
        value={value}
        className="w-4 h-4 accent-[color:var(--color-accent)]"
      />
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="grid gap-0.5">
        <span className="text-xs">{label}</span>
        {description && (
          <span className="text-[10px] font-normal text-subtle leading-snug group-has-[:checked]:opacity-80">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

/**
 * Wrapper para múltiplos `<RadioCard>` que compartilham `name`.
 */
export function RadioGroup({
  name,
  value,
  onChange,
  children,
  className,
}: {
  name: string;
  value?: string;
  onChange?: (next: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      className={cn("flex gap-2.5 flex-wrap", className)}
      onChange={(e) => {
        const target = e.target as HTMLInputElement;
        if (target.type === "radio" && target.name === name) {
          onChange?.(target.value);
        }
      }}
    >
      {Array.isArray(children)
        ? children.map((child, i) => {
            if (
              child &&
              typeof child === "object" &&
              "props" in child &&
              (child.props as { name?: string }).name === undefined
            ) {
              return (
                <RadioGroupItem
                  key={i}
                  name={name}
                  checked={(child.props as { value?: string }).value === value}
                  value={(child.props as { value?: string }).value ?? ""}
                >
                  {child}
                </RadioGroupItem>
              );
            }
            return child;
          })
        : children}
    </div>
  );
}

function RadioGroupItem({
  name,
  value,
  checked,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  children: ReactNode;
}) {
  return (
    <span data-checked={checked || undefined} className="contents">
      <input type="hidden" name={name} value={value} defaultChecked={checked} />
      {children}
    </span>
  );
}
