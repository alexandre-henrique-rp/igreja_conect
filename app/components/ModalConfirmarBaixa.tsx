import { Dialog } from "./Dialog";
import { Button } from "~/components/ds";

export type ModalConfirmarBaixaProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  motivo: string;
};

export function ModalConfirmarBaixa({
  open,
  onClose,
  onConfirm,
  motivo,
}: ModalConfirmarBaixaProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Confirmar Baixa"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Confirmar Baixa
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Você está prestes a dar baixa neste item. Esta ação é{" "}
          <strong className="text-danger">IRREVERSÍVEL</strong>.
        </p>
        <div className="bg-surface-2 border border-border rounded-md p-3">
          <p className="text-xs font-medium text-muted mb-1">Motivo:</p>
          <p className="text-sm text-fg whitespace-pre-wrap">
            {motivo}
          </p>
        </div>
      </div>
    </Dialog>
  );
}
