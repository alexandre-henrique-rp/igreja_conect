/**
 * Componente <ModalConfirmar /> — modal de confirmação de ação (S06-T11).
 *
 * Wrapper do `<Dialog>` com botões Confirmar/Cancelar, variante visual
 * (danger/primary) e acessibilidade completa.
 *
 * **Teclado:** Esc fecha, Enter confirma (se foco no botão Confirmar).
 * **Overlay:** click fora fecha.
 *
 * @example
 *   <ModalConfirmar
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     onConfirm={handleConfirm}
 *     title="Arquivar caixa"
 *     description="Tem certeza? O saldo será preservado."
 *     confirmLabel="Arquivar"
 *     variant="danger"
 *   />
 *
 * @param props - Props do componente.
 * @param props.open - Se true, renderiza o modal.
 * @param props.onClose - Callback para fechar.
 * @param props.onConfirm - Callback ao confirmar.
 * @param props.title - Título do modal.
 * @param props.description - Descrição da ação.
 * @param props.confirmLabel - Label do botão confirmar (default "Confirmar").
 * @param props.variant - Variante visual (default "primary").
 * @returns Elemento JSX do modal ou null.
 */
import { Button } from "./Button";
import { Dialog } from "./Dialog";

/**
 * Props aceitas pelo `<ModalConfirmar>`.
 */
export type ModalConfirmarProps = {
  /** Se true, renderiza o modal. */
  open: boolean;
  /** Callback para fechar (Esc, overlay, cancelar). */
  onClose: () => void;
  /** Callback ao confirmar. */
  onConfirm: () => void;
  /** Título do modal. */
  title: string;
  /** Descrição da ação. */
  description: string;
  /** Label do botão confirmar (default "Confirmar"). */
  confirmLabel?: string;
  /** Variante visual do botão confirmar (default "primary"). */
  variant?: "primary" | "danger" | "secondary";
  /** Label do botão cancelar (default "Cancelar"). */
  cancelLabel?: string;
};

/**
 * @description Modal de confirmação de ação com suporte a variante danger.
 * @param {ModalConfirmarProps} props - open, onClose, onConfirm, title, description, etc.
 * @returns {JSX.Element | null} Modal ou null.
 */
export function ModalConfirmar({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  variant = "primary",
  cancelLabel = "Cancelar",
}: ModalConfirmarProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{description}</p>
    </Dialog>
  );
}
