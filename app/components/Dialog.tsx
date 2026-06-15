/**
 * Componente <Dialog /> — modal base acessível (S03-T05).
 *
 * **Wrapper padronizado de modal** usado em todos os diálogos do
 * sistema (S03+: vincular discípulo, criar/editar ministério, excluir
 * membro, etc.). Implementa a "regra de 3" de YAGNI: já temos 3
 * consumidores (ModalSelecionarDiscipulador, ModalCriarMinisterio,
 * ModalVincularMembro).
 *
 * **Acessibilidade (WCAG 2.1 AA, 4.1.2, 2.4.3):**
 * - `role="dialog"` + `aria-modal="true"` — identifica o dialog modal
 *   para screen readers.
 * - `aria-labelledby` apontando para o `<h2>` do título.
 * - Foco preso (`useFocusTrap` interno): ao abrir, foca no primeiro
 *   elemento focável. Tab/Shift+Tab ciclam dentro. Esc fecha.
 * - Click no overlay (fora do conteúdo) fecha.
 * - Trava scroll do body (`document.body.style.overflow = "hidden"`)
 *   enquanto aberto — evita scroll da página por baixo.
 * - Restaura overflow ao fechar.
 *
 * **SSR note:** `createPortal` é no-op em `renderToString` — o conteúdo
 * do dialog é renderizado inline no HTML. No browser, vai para
 * `document.body`. Esta é a estratégia padrão de React para portais.
 *
 * **Tailwind 4 utility-first:** sem `@apply`. Classes via string.
 *
 * @example
 *   <Dialog
 *     open={modalOpen}
 *     onClose={() => setModalOpen(false)}
 *     title="Vincular discípulo"
 *     footer={
 *       <>
 *         <Button variant="ghost" onClick={onClose}>Cancelar</Button>
 *         <Button type="submit" form="form-id">Vincular</Button>
 *       </>
 *     }
 *   >
 *     <p>Conteúdo...</p>
 *   </Dialog>
 *
 * @param props - Props do componente (ver `DialogProps`).
 * @returns Elemento JSX do dialog (portal no body, ou null se fechado).
 */
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "~/lib/cn";

/**
 * Props aceitas pelo `<Dialog>`.
 */
export type DialogProps = {
  /** Se `true`, renderiza o portal. Se `false`, retorna `null`. */
  open: boolean;
  /** Callback invocado em: Esc, click no overlay, click no botão Fechar. */
  onClose: () => void;
  /** Título do modal (renderizado como `<h2>` e referenciado por `aria-labelledby`). */
  title: string;
  /** Conteúdo do corpo do modal. */
  children: ReactNode;
  /** Rodapé opcional (tipicamente botões "Cancelar" e "Confirmar"). */
  footer?: ReactNode;
  /** Classes extras no container principal. */
  className?: string;
};

/**
 * Hook interno: prende o foco dentro do container enquanto ele
 * estiver aberto. Foca o primeiro elemento focável ao montar; Tab e
 * Shift+Tab ciclam entre os focáveis internos; Esc chama onClose.
 *
 * **Por que hook interno (não lib):** useFocusTrap tem ~30 linhas.
 * Biblioteca (`focus-trap-react`) traz ~20KB e mais 1 dep. YAGNI.
 *
 * @param active - Se `true`, o trap está ativo.
 * @param onEsc - Callback para a tecla Esc.
 * @returns Ref a ser anexada no container focável.
 */
function useFocusTrap(active: boolean, onEsc: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Ref para o onEsc mais recente (evita stale closure).
  const onEscRef = useRef(onEsc);
  onEscRef.current = onEsc;

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    // Coleta elementos focáveis.
    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    const getFocusables = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));

    // Foca o primeiro focável (ou o próprio container).
    const firstFocusable = getFocusables()[0];
    if (firstFocusable) {
      firstFocusable.focus();
    } else {
      container.focus();
    }

    // Handler de Tab/Shift+Tab + Esc.
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onEscRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = getFocusables();
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [active]);

  return containerRef;
}

/**
 * Ícone X para o botão de fechar (SVG inline, sem dependências).
 */
function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/**
 * @description Modal base acessível com portal, foco preso, Esc/overlay para fechar e lock de scroll.
 * @param {DialogProps} props - Veja `DialogProps` para detalhes.
 * @returns {JSX.Element | null} Portal no `document.body` quando `open`, ou `null`.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: DialogProps) {
  const titleId = useId();
  const containerRef = useFocusTrap(open, onClose);

  // Lock do scroll do body enquanto o modal está aberto.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const dialog = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      data-testid="dialog-overlay-wrapper"
    >
      {/* Overlay — click fecha */}
      <div
        className="fixed inset-0 bg-slate-900/50"
        onClick={onClose}
        aria-hidden="true"
        data-testid="dialog-overlay"
      />
      {/* Container do dialog */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "relative bg-white rounded-lg shadow-xl",
          "max-w-lg w-full max-h-[90vh] overflow-y-auto",
          "focus:outline-none",
          className
        )}
        data-testid="dialog"
      >
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex items-center justify-center h-9 w-9 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
          >
            <CloseIcon />
          </button>
        </header>

        {/* Body */}
        <div className="p-4">{children}</div>

        {/* Footer opcional */}
        {footer && (
          <footer className="p-4 border-t border-slate-200 flex gap-2 justify-end">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );

  // Em SSR (Node, sem `document`), retorna o dialog inline para que
  // testes via `renderToString` consigam validar a estrutura.
  // No browser, vai para `document.body` via portal.
  if (typeof document === "undefined") {
    return dialog;
  }
  return createPortal(dialog, document.body);
}
