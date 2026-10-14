import { Dialog } from "./Dialog";
import { Button } from "~/components/ds";
import {
  CalendarioDisponibilidade,
  type AtividadeCalendario,
  type IndisponibilidadeCalendario,
} from "./CalendarioDisponibilidade";

type Props = {
  open: boolean;
  onClose: () => void;
  nomeMembro: string;
  atividades: AtividadeCalendario[];
  indisponibilidades: IndisponibilidadeCalendario[];
  onAddAtividade: (data: string) => void;
  onAddIndisponibilidade: (data: string) => void;
  onRemoveAtividade: (id: string) => void;
  onRemoveIndisponibilidade: (id: string) => void;
};

export function ModalDisponibilidade({
  open,
  onClose,
  nomeMembro,
  atividades,
  indisponibilidades,
  onAddAtividade,
  onAddIndisponibilidade,
  onRemoveAtividade,
  onRemoveIndisponibilidade,
}: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Disponibilidade — ${nomeMembro}`}
      className="max-w-2xl"
      footer={
        <Button variant="ghost" onClick={onClose}>Fechar</Button>
      }
    >
      {/* Texto explicativo ponto-a-ponto */}
      <div className="mb-4 p-3 bg-surface-2 border border-border rounded-lg">
        <ul className="space-y-1 text-xs text-muted">
          <li><strong className="text-accent-strong">Cultos (azul):</strong> gerados automaticamente pelos dias de encontro e horário padrão do ministério. Não precisam ser cadastrados manualmente.</li>
          <li><strong className="text-success">Ensaios (verde):</strong> clique em um dia vazio para agendar um ensaio. Defina data e horário.</li>
          <li><strong className="text-accent-strong">Atividades extras (roxo):</strong> clique em um dia vazio para registrar um evento pontual (ex: ensaio extra, retiro). Defina data, horário e descrição.</li>
          <li><strong className="text-danger">Indisponibilidades (vermelho):</strong> marque os dias/horários em que o membro não poderá participar. O sistema não o escalará nessas datas.</li>
        </ul>
      </div>

      <CalendarioDisponibilidade
        atividades={atividades}
        indisponibilidades={indisponibilidades}
        onAddAtividade={onAddAtividade}
        onAddIndisponibilidade={onAddIndisponibilidade}
        onRemoveAtividade={onRemoveAtividade}
        onRemoveIndisponibilidade={onRemoveIndisponibilidade}
      />
    </Dialog>
  );
}
