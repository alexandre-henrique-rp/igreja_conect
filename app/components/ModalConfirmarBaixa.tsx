import { Dialog } from "./Dialog";
import { Button } from "./Button";

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
        <p className="text-sm text-slate-600">
          Você está prestes a dar baixa neste item. Esta ação é{" "}
          <strong className="text-red-700">IRREVERSÍVEL</strong>.
        </p>
        <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
          <p className="text-xs font-medium text-slate-500 mb-1">Motivo:</p>
          <p className="text-sm text-slate-900 whitespace-pre-wrap">
            {motivo}
          </p>
        </div>
      </div>
    </Dialog>
  );
}
