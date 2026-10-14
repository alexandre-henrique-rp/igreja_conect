/**
 * <FormSection />, <FormFooter />, <FormGrid />, <FormLayout /> — padrões
 * de layout de formulário do Design System.
 *
 * @example
 *   <FormSection title="Dados pessoais">
 *     <FormGrid cols={2}>
 *       <Input label="Nome" name="nome" />
 *       <Input label="Email" name="email" />
 *     </FormGrid>
 *   </FormSection>
 *   <FormFooter>
 *     <Button variant="secondary">Cancelar</Button>
 *     <Button variant="primary" type="submit">Salvar</Button>
 *   </FormFooter>
 */
import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

export function FormSection({
  title,
  index,
  description,
  children,
  className,
}: {
  title: ReactNode;
  index?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("px-6 py-5 border-b border-border last:border-b-0", className)}
    >
      <h2 className="flex items-center gap-2 mb-4 text-sm font-bold text-fg tracking-tight">
        {index !== undefined && (
          <span className="grid place-items-center h-[22px] w-[22px] rounded-md bg-accent-soft text-accent-strong text-[11px]">
            {index}
          </span>
        )}
        {title}
      </h2>
      {description && (
        <p className="text-xs text-muted mb-3">{description}</p>
      )}
      {children}
    </section>
  );
}

export function FormFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 px-6 py-4 border-t border-border",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FormGrid({
  cols = 2,
  gap = 18,
  children,
  className,
}: {
  cols?: 1 | 2;
  gap?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        cols === 2 ? "grid grid-cols-1 md:grid-cols-2" : "grid grid-cols-1",
        className,
      )}
      style={{ gap: `${gap}px` }}
    >
      {children}
    </div>
  );
}

/**
 * Helper para span de 2 colunas dentro de `<FormGrid cols={2}>`.
 */
export function SpanTwo({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("md:col-span-2", className)}>{children}</div>;
}

export function FormLayout({
  sidebar,
  children,
  className,
}: {
  sidebar: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_180px] gap-7",
        className,
      )}
    >
      <div className="min-w-0">{children}</div>
      <aside className="space-y-4">{sidebar}</aside>
    </div>
  );
}
