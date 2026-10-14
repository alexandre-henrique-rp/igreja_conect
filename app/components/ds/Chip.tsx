/**
 * <Chip /> — etiqueta neutra pequena (12px radius 6) usada em filtros,
 * listagens, status secundários.
 *
 * @example
 *   <Chip tone="success">Disponível</Chip>
 */
import type { ReactNode } from "react";
import { cn } from "~/lib/cn";
import type { BadgeTone } from "./Badge";

export type ChipProps = {
  tone?: BadgeTone;
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

export function Chip({ tone = "neutral", children, className }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center h-[22px] px-2 rounded-md text-[11px] font-semibold whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
