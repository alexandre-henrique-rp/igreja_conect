/**
 * <Card /> — primitivo container do Design System.
 *
 * **Variantes:**
 * - `default` — fundo surface, borda, sombra leve.
 * - `hover` — adiciona transição (translateY + borda accent) ao passar.
 * - `flat` — sem sombra (cards inline, sem destaque).
 * - `kpi` — KPI padrão do dashboard (label/value/hint).
 * - `finance` — card financeiro (cash, lançamentos).
 *
 * **Padding:** `none | sm (16) | md (20) | lg (24)`.
 *
 * **Tokens:** `bg-surface border-border`, hover com `border-accent`.
 *
 * @example
 *   <Card variant="hover" padding="md">
 *     <CardHeader title="..." />
 *     <CardBody>...</CardBody>
 *   </Card>
 */
import type { ElementType, ReactNode } from "react";
import { cn } from "~/lib/cn";

export type CardVariant =
  | "default"
  | "hover"
  | "flat"
  | "kpi"
  | "finance"
  | "alert";

export type CardPadding = "none" | "sm" | "md" | "lg";

export type CardProps = {
  variant?: CardVariant;
  padding?: CardPadding;
  as?: ElementType;
  to?: string;
  children?: ReactNode;
  className?: string;
  /** Acessibilidade — `aria-label` quando o card é interativo (link). */
  "aria-label"?: string;
};

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default:
    "bg-surface border border-border shadow-[0_1px_2px_oklch(20.8%_0.035_260_/_0.04)]",
  hover:
    "bg-surface border border-border shadow-[0_1px_2px_oklch(20.8%_0.035_260_/_0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-[0_8px_20px_oklch(20.8%_0.035_260_/_0.08)]",
  flat: "bg-surface border border-border",
  kpi: "bg-surface border border-border shadow-[0_1px_2px_oklch(20.8%_0.035_260_/_0.04)]",
  finance:
    "bg-surface border border-border shadow-[0_1px_2px_oklch(20.8%_0.035_260_/_0.04)]",
  alert:
    "bg-warning-soft border border-warning/40",
};

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export function Card({
  variant = "default",
  padding = "md",
  as,
  to,
  children,
  className,
  ...rest
}: CardProps) {
  const Component = (as ?? "div") as ElementType;
  const extraProps: Record<string, unknown> = to !== undefined ? { to } : {};
  return (
    <Component
      className={cn(
        "rounded-lg",
        VARIANT_CLASSES[variant],
        padding !== "none" && PADDING_CLASSES[padding],
        className,
      )}
      {...extraProps}
      {...rest}
    >
      {children}
    </Component>
  );
}

export function CardHeader({
  title,
  eyebrow,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4",
        "px-5 py-4 border-b border-border",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-bold uppercase tracking-wider text-accent">
            {eyebrow}
          </p>
        )}
        <h3 className="text-sm font-bold text-fg leading-tight">{title}</h3>
        {description && (
          <p className="mt-1 text-xs text-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function CardBody({
  children,
  className,
  padding = "md",
}: {
  children: ReactNode;
  className?: string;
  padding?: CardPadding;
}) {
  return (
    <div
      className={cn(
        padding !== "none" && PADDING_CLASSES[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2",
        "px-5 py-4 border-t border-border",
        className,
      )}
    >
      {children}
    </div>
  );
}
