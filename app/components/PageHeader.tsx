/**
 * Componente <PageHeader /> — cabeçalho de página com título + CTA opcional (S02-T03).
 *
 * Estrutura:
 * 1. `<h1>` com `text-2xl font-bold text-slate-900` — única h1 por página.
 * 2. Slot `breadcrumb` (opcional) — renderizado **abaixo** do h1.
 * 3. Slot `action` (opcional) — renderizado à **direita** do título em `sm+`,
 *    abaixo em `<sm` (mobile-first: empilha em telas pequenas).
 *
 * **Responsivo:** em `<sm` (mobile), o layout é `flex-col` (título em cima,
 * ação embaixo). Em `sm+`, vira `flex-row` com `justify-between` (título à
 * esquerda, ação à direita).
 *
 * **Acessibilidade (WCAG 2.4.6 — Headings and Labels):** a página tem
 * exatamente 1 `<h1>` que identifica o conteúdo principal.
 *
 * **Tailwind 4 utility-first:** sem `@apply`. Classes via string.
 *
 * @example
 *   <PageHeader
 *     title="Membros"
 *     action={
 *       <Button as={Link} to="/app/membros/novo" variant="primary">
 *         + Novo membro
 *       </Button>
 *     }
 *   />
 *
 * @example
 *   <PageHeader
 *     title="Editar Maria"
 *     breadcrumb={
 *       <Breadcrumb
 *         items={[
 *           { label: "Membros", href: "/app/membros" },
 *           { label: "Maria" },
 *           { label: "Editar" },
 *         ]}
 *       />
 *     }
 *   />
 *
 * @param props - Props do componente (ver `PageHeaderProps`).
 * @returns Elemento JSX do cabeçalho.
 */
import type { ReactNode } from "react";

/**
 * Props aceitas pelo `<PageHeader>`.
 */
export type PageHeaderProps = {
  /** Texto do título (renderizado como `<h1>`). */
  title: string;
  /** Slot à direita (sm+) / abaixo (mobile) — tipicamente CTA `<Button>`. */
  action?: ReactNode;
  /** Slot abaixo do `<h1>` — tipicamente `<Breadcrumb />`. */
  breadcrumb?: ReactNode;
};

/**
 * @description Cabeçalho de página com título, ação (CTA) e breadcrumb opcionais.
 * @param {PageHeaderProps} props - Veja `PageHeaderProps`.
 * @returns {JSX.Element} Elemento do cabeçalho.
 */
export function PageHeader({ title, action, breadcrumb }: PageHeaderProps) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {breadcrumb && <div className="mt-1">{breadcrumb}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
