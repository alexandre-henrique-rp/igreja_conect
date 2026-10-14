/**
 * <Modal /> — diálogo modal do Design System (baseado em `.movement-modal`
 * do `assets/tokens.css`).
 *
 * **Comportamento preservado do DS/app.js:**
 * - overlay com blur + fade-in;
 * - fecha com `Esc` e clique no backdrop;
 * - `role="dialog"` + `aria-modal` + `aria-labelledby`;
 * - foco inicial no diálogo; restaura foco ao fechar;
 * - respeita `prefers-reduced-motion` (via CSS global).
 *
 * **Composição:** `<Modal>` (overlay) → head (title/description + close) →
 * `<ModalBody>` → `<ModalFooter>`.
 *
 * @example
 *   <Modal open={open} onClose={close} title="Registrar entrada"
 *          description="Informe a quantidade recebida.">
 *     <ModalBody>...campos...</ModalBody>
 *     <ModalFooter>
 *       <Button variant="secondary" onClick={close}>Cancelar</Button>
 *       <Button type="submit">Confirmar</Button>
 *     </ModalFooter>
 *   </Modal>
 */
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { cn } from "~/lib/cn";
import { Icon } from "./Icon";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Oculta o botão X do cabeçalho (ex.: fluxos obrigatórios). */
  hideClose?: boolean;
  className?: string;
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  hideClose = false,
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const labelId = useId();
  const descId = useId();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    document.addEventListener("keydown", handleKeyDown);
    const { body } = document;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="movement-modal"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={cn("movement-dialog", className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        <div className="movement-modal-head">
          <div className="min-w-0">
            <h2 id={labelId}>{title}</h2>
            {description && <p id={descId}>{description}</p>}
          </div>
          {!hideClose && (
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={onClose}
              aria-label="Fechar"
            >
              <Icon name="x" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

export function ModalBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("movement-modal-body", className)}>{children}</div>;
}

export function ModalFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("movement-modal-foot", className)}>{children}</div>;
}
