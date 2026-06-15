/**
 * Componente <InfoBox /> — caixa de informação contextual (S03-T09).
 *
 * Renderiza uma caixa visual com ícone + título opcional + conteúdo,
 * em 2 tons (info/warning). Usado para mensagens contextuais em
 * telas e formulários (ex: "Módulo Financeiro em breve",
 * "Este ministério está sem coordenação").
 *
 * **Diferença para `<ErrorAlert>`:** InfoBox é **não urgente** (não
 * usa `role="alert"`). Use ErrorAlert para erros e InfoBox para
 * contexto neutro. Acessibilidade: `role="note"` informa screen
 * readers que é uma anotação informativa.
 *
 * **Visual:**
 * - `tone="info"`: borda + fundo cyan (mensagem neutra).
 * - `tone="warning"`: borda + fundo amber (atenção, sem bloquear).
 * - Ícone SVG `aria-hidden` (o título e children são a mensagem real).
 *
 * @example
 *   <InfoBox title="Atenção">
 *     Módulo Financeiro ainda não disponível.
 *   </InfoBox>
 *
 * @example
 *   // Warning
 *   <InfoBox tone="warning" title="Limite próximo">
 *     Este discipulador já tem 10 discípulos.
 *   </InfoBox>
 *
 * @param props - Props do componente.
 * @returns Elemento JSX do info box.
 */
import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

/**
 * Tom visual da InfoBox.
 */
export type InfoBoxTone = "info" | "warning";

/**
 * Props aceitas pelo `<InfoBox>`.
 */
export type InfoBoxProps = {
  /** Conteúdo da mensagem. */
  children: ReactNode;
  /** Título opcional (renderizado como `<h3>`). */
  title?: string;
  /** Tom visual. Default: "info". */
  tone?: InfoBoxTone;
  /** Classes extras. */
  className?: string;
};

/** Classes por tom. */
const TONE_CLASSES: Record<InfoBoxTone, { container: string; icon: string }> =
  {
    info: {
      container: "border-cyan-200 bg-cyan-50 text-cyan-900",
      icon: "text-cyan-700",
    },
    warning: {
      container: "border-amber-200 bg-amber-50 text-amber-900",
      icon: "text-amber-700",
    },
  };

/**
 * Ícone circular com "i" para info, ou exclamação para warning.
 */
function InfoIcon({ tone }: { tone: InfoBoxTone }) {
  if (tone === "warning") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className={cn("h-5 w-5 shrink-0", TONE_CLASSES[tone].icon)}
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-5 w-5 shrink-0", TONE_CLASSES[tone].icon)}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * @description Caixa de informação contextual com ícone + título opcional + 2 tons.
 * @param {InfoBoxProps} props - children, title, tone.
 * @returns {JSX.Element} Elemento JSX do info box.
 */
export function InfoBox({
  children,
  title,
  tone = "info",
  className,
}: InfoBoxProps) {
  return (
    <div
      role="note"
      className={cn(
        "border rounded-md p-3 flex gap-2",
        TONE_CLASSES[tone].container,
        className
      )}
      data-testid="info-box"
    >
      <InfoIcon tone={tone} />
      <div className="flex-1 leading-relaxed text-sm">
        {title && <h3 className="font-medium mb-0.5">{title}</h3>}
        <div>{children}</div>
      </div>
    </div>
  );
}
