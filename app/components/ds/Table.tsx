/**
 * <Table /> + <TableHeader /> + <TableBody /> + <TableRow /> + <TableCell /> —
 * tabela acessível com tokens semânticos.
 *
 * @example
 *   <Table>
 *     <TableHeader>
 *       <TableRow>
 *         <TableHead>Nome</TableHead>
 *         <TableHead>Status</TableHead>
 *       </TableRow>
 *     </TableHeader>
 *     <TableBody>
 *       <TableRow>
 *         <TableCell>João</TableCell>
 *         <TableCell><Badge tone="success">Ativo</Badge></TableCell>
 *       </TableRow>
 *     </TableBody>
 *   </Table>
 */
import type { HTMLAttributes, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { cn } from "~/lib/cn";

export function TableWrap({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>{children}</div>
  );
}

export function Table({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <table
      className={cn("w-full border-collapse text-left text-sm", className)}
    >
      {children}
    </table>
  );
}

export function TableHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <thead
      className={cn(
        "bg-surface-2 text-[10px] font-bold uppercase tracking-wider text-muted",
        className,
      )}
    >
      {children}
    </thead>
  );
}

export function TableBody({ children, className }: { children: ReactNode; className?: string }) {
  return <tbody className={className}>{children}</tbody>;
}

export function TableRow({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("hover:bg-accent-soft-2 transition-colors", className)}
      {...rest}
    >
      {children}
    </tr>
  );
}

export function TableHead({
  children,
  className,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-3 font-bold whitespace-nowrap",
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TableCell({
  children,
  className,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-xs text-muted border-t border-border align-middle",
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
}

export function TableFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-3.5 text-xs text-subtle",
        className,
      )}
    >
      {children}
    </div>
  );
}
