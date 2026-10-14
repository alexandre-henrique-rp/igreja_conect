/**
 * <Section /> — seção com eyebrow + título + descrição (padrão dos blocos
 * de páginas internas).
 *
 * @example
 *   <Section eyebrow="01 · Tokens" title="Cor e tipografia">
 *     <Card>...</Card>
 *   </Section>
 */
import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

export type SectionProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Adiciona margem top (use entre seções). */
  gap?: boolean;
};

export function Section({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
  gap = false,
}: SectionProps) {
  return (
    <section className={cn(gap && "mt-6", className)}>
      {(eyebrow || title || description || actions) && (
        <header className="flex items-end justify-between gap-6 mb-7">
          <div>
            {eyebrow && (
              <p className="text-[11px] font-bold uppercase tracking-wider text-accent">
                {eyebrow}
              </p>
            )}
            <h2 className="text-[26px] font-bold tracking-tight text-fg leading-tight">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-muted max-w-[52ch]">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
