/**
 * <KpiCard /> — card de KPI com label + valor + hint + ícone opcional.
 *
 * @example
 *   <KpiCard
 *     label="Membros ativos"
 *     value={42}
 *     hint="+5 este mês"
 *     icon={<Icon name="users" />}
 *     tone="accent"
 *   />
 */
import type { ReactNode } from "react";
import { cn } from "~/lib/cn";
import { IconWrap } from "./Icon";
import type { BadgeTone } from "./Badge";

export type KpiCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  delta?: { value: string; direction: "up" | "down" };
  icon?: ReactNode;
  tone?: BadgeTone;
  className?: string;
};

export function KpiCard({
  label,
  value,
  hint,
  delta,
  icon,
  tone = "accent",
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-5 shadow-[0_1px_2px_oklch(20.8%_0.035_260_/_0.04)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="text-xs font-semibold text-muted">{label}</span>
        {icon && <IconWrap tone={tone} size="sm">{icon}</IconWrap>}
      </div>
      <p className="text-[26px] font-extrabold tracking-tight text-fg leading-none mb-1.5">
        {value}
      </p>
      {(hint || delta) && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted">
          {delta && (
            <span
              className={cn(
                "font-bold",
                delta.direction === "up" ? "text-success" : "text-danger",
              )}
            >
              {delta.direction === "up" ? "▲" : "▼"} {delta.value}
            </span>
          )}
          {hint && <span>{hint}</span>}
        </p>
      )}
    </div>
  );
}
