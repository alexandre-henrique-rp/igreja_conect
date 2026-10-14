/**
 * <Breadcrumb /> + <BreadcrumbItem /> — trilha de navegação.
 *
 * @example
 *   <Breadcrumb>
 *     <BreadcrumbItem href="/app">Início</BreadcrumbItem>
 *     <BreadcrumbItem href="/app/membros">Membros</BreadcrumbItem>
 *     <BreadcrumbItem current>João Silva</BreadcrumbItem>
 *   </Breadcrumb>
 */
import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "~/lib/cn";

export function Breadcrumb({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-1.5 text-xs", className)}
    >
      <ol className="flex items-center gap-1.5 flex-wrap">
        {children}
      </ol>
    </nav>
  );
}

export function BreadcrumbItem({
  href,
  children,
  current,
  className,
}: {
  href?: string;
  children: ReactNode;
  current?: boolean;
  className?: string;
}) {
  if (current || !href) {
    return (
      <li
        aria-current="page"
        className={cn("text-fg font-bold", className)}
      >
        {children}
      </li>
    );
  }
  return (
    <li>
      <Link
        to={href}
        className={cn(
          "text-subtle hover:text-fg hover:underline",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm",
          className,
        )}
      >
        {children}
      </Link>
    </li>
  );
}

export function BreadcrumbSeparator() {
  return (
    <li aria-hidden="true" className="text-subtle">
      /
    </li>
  );
}
