/**
 * <Badge /> — etiqueta colorida (success/warning/danger/info/neutral/accent).
 *
 * @example
 *   <Badge tone="success">Ativo</Badge>
 *   <Badge tone="accent" size="sm">Novo</Badge>
 */
import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

export type BadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "accent";

export type BadgeSize = "sm" | "md";

export type BadgeProps = {
  tone?: BadgeTone;
  size?: BadgeSize;
  children: ReactNode;
  className?: string;
};

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-3 text-muted",
  accent: "bg-accent-soft text-accent-strong",
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: "h-[20px] px-1.5 text-[10px]",
  md: "h-[22px] px-2 text-[11px]",
};

export function Badge({
  tone = "neutral",
  size = "md",
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-bold leading-none whitespace-nowrap",
        TONE_CLASSES[tone],
        SIZE_CLASSES[size],
        className,
      )}
    >
      {children}
    </span>
  );
}
