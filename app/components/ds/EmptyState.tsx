/**
 * <EmptyState /> — placeholder para listas vazias / sem dados.
 *
 * @example
 *   <EmptyState
 *     title="Nenhum membro encontrado"
 *     description="Adicione o primeiro membro para começar."
 *     action={<Button>+ Adicionar membro</Button>}
 *   />
 */
import type { ReactNode } from "react";
import { cn } from "~/lib/cn";
import { IconWrap } from "./Icon";

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /** Quando há ícone passado, define o tom do IconWrap. */
  iconTone?: "accent" | "success" | "warning" | "danger" | "info" | "neutral";
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  iconTone = "accent",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "grid justify-items-center gap-3 px-5 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <IconWrap tone={iconTone} size="lg" className="rounded-2xl">
          {icon}
        </IconWrap>
      )}
      <h3 className="text-sm font-bold text-fg">{title}</h3>
      {description && (
        <p className="text-sm text-muted max-w-[44ch]">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
