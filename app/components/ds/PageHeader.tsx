/**
 * <PageHeader /> — cabeçalho padrão de página interna.
 *
 * @example
 *   <PageHeader
 *     eyebrow="Pessoas"
 *     title="Membros"
 *     description="Gerencie os membros da igreja."
 *     actions={<Button>+ Novo membro</Button>}
 *   />
 */
import type { ReactNode } from "react";
import { cn } from "~/lib/cn";
import { Badge } from "./Badge";

export type PageHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  badge?: { label: string; tone?: "success" | "warning" | "info" | "accent" };
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  badge,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex items-start justify-between gap-6 mb-7",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-bold uppercase tracking-wider text-accent mb-1">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[28px] font-bold tracking-tight text-fg leading-tight">
          {title}
          {badge && (
            <Badge tone={badge.tone ?? "accent"} className="ml-2 align-middle">
              {badge.label}
            </Badge>
          )}
        </h1>
        {description && (
          <p className="mt-2 text-sm text-muted max-w-[60ch]">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
