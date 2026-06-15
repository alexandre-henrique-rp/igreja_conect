/**
 * Componente <RelativeTime /> — exibe data relativa em PT-BR (S04-T07).
 *
 * Renderiza `<time dateTime={ISO}>` com texto como "há 5 minutos",
 * "ontem", "há 3 dias", etc. Usa o helper puro `formatRelative`
 * internamente, aceitando `now` como parâmetro para testabilidade.
 *
 * **Não chama Date.now() no render** — recebe `now` opcional.
 *
 * @example
 *   <RelativeTime date={new Date("2026-06-13T12:00:00")} />
 *
 * @example
 *   // Com now explícito (testes)
 *   <RelativeTime date={date} now={new Date("2026-06-13T14:00:00")} />
 *
 * @param props - Props do componente.
 * @param props.date - Data a ser exibida.
 * @param props.now - Referência do "agora" (opcional).
 * @param props.className - Classes extras.
 * @returns Elemento JSX <time>.
 */
import { formatRelative } from "~/lib/format-date";
import { cn } from "~/lib/cn";

/**
 * Props aceitas pelo `<RelativeTime>`.
 */
export type RelativeTimeProps = {
  /** Data a ser exibida. */
  date: Date;
  /** Referência do "agora" (opcional — default = new Date()). */
  now?: Date;
  /** Classes extras. */
  className?: string;
};

/**
 * @description Badge de tempo relativo em PT-BR.
 * @param {RelativeTimeProps} props - date, now opcional, className opcional.
 * @returns {JSX.Element} Elemento <time>.
 */
export function RelativeTime({
  date,
  now,
  className,
}: RelativeTimeProps) {
  const text = formatRelative(date, now);
  return (
    <time
      dateTime={date.toISOString()}
      className={cn("text-sm text-slate-500", className)}
      data-testid="relative-time"
    >
      {text}
    </time>
  );
}
