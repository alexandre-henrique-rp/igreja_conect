/**
 * <DateTile /> — bloco compacto de data (dia + mês) do Design System,
 * baseado em `.date-tile` do `assets/tokens.css`. Usado em listas de
 * eventos, cultos e indisponibilidades.
 *
 * @example
 *   <DateTile day={12} month="out" />
 *   <DateTile day="04" month="out" tone="warning" />
 */
import { cn } from "~/lib/cn";
import type { BadgeTone } from "./Badge";

export type DateTileProps = {
  day: number | string;
  month: string;
  tone?: BadgeTone;
  className?: string;
};

const TONE_CLASSES: Record<BadgeTone, string> = {
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-3 text-muted",
};

export function DateTile({
  day,
  month,
  tone = "accent",
  className,
}: DateTileProps) {
  return (
    <div
      className={cn(
        "grid place-items-center h-[46px] w-[42px] shrink-0 rounded-[9px]",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <strong className="text-base leading-none">{day}</strong>
      <span className="text-[9px] font-extrabold uppercase">{month}</span>
    </div>
  );
}
