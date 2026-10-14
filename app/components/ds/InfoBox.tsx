/**
 * <InfoBox /> — caixa de aviso contextual (warning / info).
 *
 * @example
 *   <InfoBox tone="warning" title="Atenção">
 *     Esta ação não pode ser desfeita.
 *   </InfoBox>
 */
import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

export type InfoBoxTone = "warning" | "info" | "success" | "danger";

export type InfoBoxProps = {
  tone?: InfoBoxTone;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
};

const TONE_CLASSES: Record<InfoBoxTone, string> = {
  warning: "bg-warning-soft text-warning border-warning/40",
  info: "bg-info-soft text-info border-info/40",
  success: "bg-success-soft text-success border-success/40",
  danger: "bg-danger-soft text-danger border-danger/40",
};

export function InfoBox({
  tone = "warning",
  title,
  children,
  className,
}: InfoBoxProps) {
  return (
    <div
      role={tone === "warning" || tone === "danger" ? "alert" : undefined}
      className={cn(
        "flex items-start gap-2.5 px-3.5 py-3 rounded-md border text-xs",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 shrink-0 mt-0.5"
        aria-hidden="true"
      >
        <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <div>
        {title && <p className="font-bold mb-0.5">{title}</p>}
        <div className="leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
