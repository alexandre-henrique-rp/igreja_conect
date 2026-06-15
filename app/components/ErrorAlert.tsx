/**
 * Componente <ErrorAlert /> — banner de alerta reutilizável (S01-T06).
 *
 * Renderiza uma caixa visual com ícone + texto, com `role="alert"`
 * para que screen readers leiam **imediatamente** assim que o elemento
 * aparece no DOM (sem precisar de foco).
 *
 * **Tons (3):**
 * - `error` — vermelho. Para erros de validação, falha de login, 500.
 * - `warning` — âmbar. Para avisos que merecem atenção mas não bloqueiam.
 * - `info` — azul. Para mensagens informativas (ex: "sessão expirada").
 *
 * **Uso típico:** no topo do `<FormLogin>` quando há `formError`, ou
 * em formulários de cadastro quando há erros de payload do action.
 *
 * **Acessibilidade (WCAG 2.4.4 / 4.1.3):**
 * - `role="alert"` → anuncia mudança de estado imediatamente.
 * - Ícone SVG com `aria-hidden="true"` (não anunciar duas vezes).
 * - Contraste garantido pelos pares bg/border/text de cada tom.
 *
 * @example
 *   {formError && <ErrorAlert tone="error">{formError}</ErrorAlert>}
 *
 * @example
 *   {motivo === "expirado" && (
 *     <ErrorAlert tone="info">
 *       Sua sessão expirou. Faça login novamente.
 *     </ErrorAlert>
 *   )}
 *
 * @param props - Props do componente (ver `ErrorAlertProps`).
 * @returns Elemento JSX do alerta.
 */
import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

/**
 * Props aceitas pelo `<ErrorAlert>`. O conteúdo pode ser string ou
 * elementos React (ex: link no meio da mensagem).
 */
export type ErrorAlertProps = {
  /** Tom visual. Escolhe as cores do background/border/texto. */
  tone: "error" | "warning" | "info";
  /** Conteúdo da mensagem — string ou JSX. */
  children: ReactNode;
  /** Classes extras para o container. */
  className?: string;
};

/** Mapa de classes CSS por tom — separa cores do JSX. */
const TONE_CLASSES = {
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-blue-200 bg-blue-50 text-blue-800",
} as const;

/** Cor do ícone (mesma família do tom). */
const ICON_CLASSES = {
  error: "text-red-700",
  warning: "text-amber-700",
  info: "text-blue-700",
} as const;

/** Ícone SVG simples (círculo com exclamação) para todos os tons. */
function AlertIcon({ tone }: { tone: ErrorAlertProps["tone"] }) {
  return (
    <svg
      className={cn("h-5 w-5 shrink-0", ICON_CLASSES[tone])}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M18 10A8 8 0 1 1 2 10a8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1 9a1 1 0 0 1-1-1v-4a1 1 0 1 1 2 0v4a1 1 0 0 1-1 1Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * @description Banner de alerta com 3 tons e ícone, com `role="alert"` para screen readers.
 * @param {ErrorAlertProps} props - Tom, conteúdo e classes extras.
 * @returns {JSX.Element} Elemento do alerta.
 */
export function ErrorAlert({ tone, children, className }: ErrorAlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 border rounded-md p-3 text-sm",
        TONE_CLASSES[tone],
        className
      )}
    >
      <AlertIcon tone={tone} />
      <div className="flex-1 leading-relaxed">{children}</div>
    </div>
  );
}
