import { Badge, type BadgeTone } from "~/components/ds";

interface ManutencaoRow {
  id: string;
  assistenciaTecnica: string;
  enderecoAssistencia: string;
  numeroOs: string | null;
  dataEnvio: Date;
  prazoTermino: Date | null;
  dataRetorno: Date | null;
  foiPerdaTotal: boolean;
}

interface CardManutencaoProps {
  manutencoes: ManutencaoRow[];
}

function statusManutencao(m: ManutencaoRow): {
  label: string;
  tone: BadgeTone;
} {
  if (m.foiPerdaTotal) return { label: "Perda Total", tone: "danger" };
  if (m.dataRetorno) return { label: "Concluída", tone: "success" };
  return { label: "Em Andamento", tone: "warning" };
}

export default function CardManutencao({ manutencoes }: CardManutencaoProps) {
  if (manutencoes.length === 0) {
    return (
      <p className="p-6 text-sm text-subtle text-center">
        Nenhuma manutenção registrada.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border">
      {manutencoes.map((m) => {
        const st = statusManutencao(m);
        return (
          <div key={m.id} className="px-4 py-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-fg">
                {m.assistenciaTecnica}
              </span>
              <Badge tone={st.tone}>{st.label}</Badge>
            </div>
            <div className="text-xs text-subtle space-y-1">
              <p>
                <span className="font-semibold text-muted">Envio:</span>{" "}
                {new Date(m.dataEnvio).toLocaleDateString("pt-BR")}
              </p>
              <p>
                <span className="font-semibold text-muted">Endereço:</span>{" "}
                {m.enderecoAssistencia}
              </p>
              {m.numeroOs && (
                <p>
                  <span className="font-semibold text-muted">OS:</span>{" "}
                  {m.numeroOs}
                </p>
              )}
              {m.prazoTermino && (
                <p>
                  <span className="font-semibold text-muted">Prazo:</span>{" "}
                  {new Date(m.prazoTermino).toLocaleDateString("pt-BR")}
                </p>
              )}
              {m.dataRetorno && (
                <p>
                  <span className="font-semibold text-muted">Retorno:</span>{" "}
                  {new Date(m.dataRetorno).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
