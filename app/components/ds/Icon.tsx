/**
 * <Icon /> — wrapper consistente para ícones SVG via sprite (`/icons.svg`).
 *
 * Renderiza `<svg>` com `stroke-width=1.7`, viewBox 24x24 e tamanhos
 * padronizados. Use `<use href="/icons.svg#name" />` para puxar do sprite.
 *
 * **Tamanhos:** `sm` 16, `md` 18 (default), `lg` 20, `xl` 24 px.
 *
 * @example
 *   <Icon name="users" size="md" />
 *   <Icon name="bell" size="lg" className="text-warning" />
 *
 * @example children
 *   <Icon size="lg"><path d="..." /></Icon>
 */
import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

export type IconSize = "sm" | "md" | "lg" | "xl";

export type IconProps = {
  /** Nome do ícone do sprite (`/icons.svg#name`). */
  name?: string;
  size?: IconSize;
  className?: string;
  /** Path do sprite. Default: `/icons.svg`. */
  spriteHref?: string;
  /** Quando passado, renderiza children em vez do sprite. */
  children?: ReactNode;
  /** aria-label para ícone informativo. Default: oculto. */
  "aria-label"?: string;
};

const SIZE_CLASSES: Record<IconSize, string> = {
  sm: "h-4 w-4",
  md: "h-[18px] w-[18px]",
  lg: "h-5 w-5",
  xl: "h-6 w-6",
};

export function Icon({
  name,
  size = "md",
  className,
  spriteHref = "/icons.svg",
  children,
  "aria-label": ariaLabel,
}: IconProps) {
  const labelled = ariaLabel !== undefined;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", SIZE_CLASSES[size], className)}
      aria-hidden={labelled ? undefined : "true"}
      aria-label={labelled ? ariaLabel : undefined}
      role={labelled ? "img" : undefined}
    >
      {children}
      {name && <use href={`${spriteHref}#${name}`} />}
    </svg>
  );
}

/**
 * <IconWrap /> — quadrado arredondado que envolve um <Icon>.
 *
 * @example
 *   <IconWrap tone="accent" size="md"><Icon name="users" /></IconWrap>
 */
import type { BadgeTone } from "./Badge";

const WRAP_TONE: Record<BadgeTone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-3 text-muted",
  accent: "bg-accent-soft text-accent-strong",
};

export type IconWrapProps = {
  tone?: BadgeTone;
  size?: "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
};

const WRAP_SIZE = {
  sm: "h-8 w-8 rounded-md",
  md: "h-10 w-10 rounded-lg",
  lg: "h-12 w-12 rounded-lg",
};

export function IconWrap({
  tone = "accent",
  size = "md",
  className,
  children,
}: IconWrapProps) {
  return (
    <span
      className={cn(
        "inline-grid place-items-center shrink-0",
        WRAP_TONE[tone],
        WRAP_SIZE[size],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** <StatIcon /> — IconWrap pré-configurado para KPIs. */
export function StatIcon({
  tone,
  className,
  children,
}: {
  tone: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <IconWrap tone={tone} size="sm" className={className}>
      {children}
    </IconWrap>
  );
}