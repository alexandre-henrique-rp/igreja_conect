/**
 * <AuthLayout /> — wrapper canônico para rotas de autenticação.
 *
 * Implementa o padrão `.auth-page` do Design System:
 * split visual + form (login) ou centralizado (recuperação, convite).
 *
 * **Variantes:**
 * - `split` — duas colunas (visual + form). Para `/login`.
 * - `centered` — form centralizado com gradiente. Para `/recuperar-senha`, `/convite/:token`.
 *
 * @example
 *   <AuthLayout variant="split">
 *     <AuthVisual>
 *       <AuthVisualCopy title="Cuide da casa.">...</AuthVisualCopy>
 *     </AuthVisual>
 *     <AuthFormSide>
 *       <AuthCard title="Entrar" lead="...">...</AuthCard>
 *     </AuthFormSide>
 *   </AuthLayout>
 *
 * @example
 *   <AuthLayout variant="centered">
 *     <AuthCard title="Recuperar senha">...</AuthCard>
 *   </AuthLayout>
 */
import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

export function AuthLayout({
  variant = "centered",
  children,
  className,
  id,
}: {
  variant?: "split" | "centered";
  children: ReactNode;
  className?: string;
  /** Alvo do skip link (ex.: `main-content`). */
  id?: string;
}) {
  return (
    <main
      id={id}
      className={cn(
        variant === "split"
          ? "grid min-h-screen bg-bg md:grid-cols-2"
          : "grid place-items-center min-h-screen py-8 px-4 bg-gradient-to-b from-accent-soft to-bg",
        className,
      )}
    >
      {children}
    </main>
  );
}

export function AuthVisual({ children }: { children: ReactNode }) {
  return (
    <section className="hidden md:flex relative flex-col justify-between min-h-screen px-6 md:px-16 py-12 overflow-hidden text-white bg-accent">
      {children}
    </section>
  );
}

export function AuthVisualCopy({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative z-10 max-w-md my-auto">
      {eyebrow && (
        <p className="text-xs font-bold uppercase tracking-wider opacity-70">
          {eyebrow}
        </p>
      )}
      <h1 className="mt-4 text-4xl md:text-5xl font-extrabold leading-tight tracking-tight">
        {title}
      </h1>
      {children && (
        <p className="mt-4 text-base opacity-80 leading-relaxed max-w-prose">
          {children}
        </p>
      )}
    </div>
  );
}

export function AuthFormSide({ children }: { children: ReactNode }) {
  return <section className="grid place-items-center p-8">{children}</section>;
}

export function AuthCard({
  title,
  lead,
  children,
  footer,
}: {
  title: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="w-full max-w-md bg-surface border border-border rounded-lg p-8 shadow-[0_1px_2px_oklch(20.8%_0.035_260_/_0.04)]">
      <h1 className="text-2xl font-extrabold tracking-tight text-fg">
        {title}
      </h1>
      {lead && <p className="mt-2 mb-7 text-sm text-muted">{lead}</p>}
      {children}
      {footer && (
        <p className="mt-6 text-xs text-muted text-center">{footer}</p>
      )}
    </div>
  );
}

/**
 * <LandingLayout /> — wrapper para a landing page institucional.
 *
 * Inclui cabeçalho público + footer padrão.
 */
export function LandingLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen overflow-hidden bg-bg">{children}</div>;
}

export function PublicNav({ children }: { children: ReactNode }) {
  return (
    <nav className="flex items-center justify-between max-w-[1180px] mx-auto px-4 min-h-[76px]">
      {children}
    </nav>
  );
}

export function PublicFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="flex justify-between gap-6 px-4 py-8 text-subtle text-xs flex-wrap max-w-[1180px] mx-auto">
      {children}
    </footer>
  );
}
