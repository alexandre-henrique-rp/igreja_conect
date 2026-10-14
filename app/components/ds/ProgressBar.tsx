/**
 * <ProgressBar /> — barra de progresso horizontal (0..max).
 *
 * @example
 *   <ProgressBar value={32} max={100} tone="success" />
 */
import { cn } from "~/lib/cn";
import type { BadgeTone } from "./Badge";

export type ProgressBarProps = {
  value: number;
  max?: number;
  tone?: BadgeTone;
  label?: string;
  className?: string;
  /** Altura em px. Default 6. */
  height?: number;
};

const TONE_BG: Record<BadgeTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-muted",
  accent: "bg-accent",
};

export function ProgressBar({
  value,
  max = 100,
  tone = "accent",
  label,
  className,
  height = 6,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={cn(
        "w-full rounded-pill overflow-hidden bg-surface-3",
        className,
      )}
      style={{ height: `${height}px` }}
    >
      <span
        className={cn("block h-full rounded-pill transition-all", TONE_BG[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
