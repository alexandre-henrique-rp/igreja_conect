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

function statusManutencao(m: ManutencaoRow): { label: string; classes: string } {
  if (m.foiPerdaTotal) return { label: "Perda Total", classes: "bg-red-100 text-red-700" };
  if (m.dataRetorno) return { label: "Concluída", classes: "bg-emerald-100 text-emerald-700" };
  return { label: "Em Andamento", classes: "bg-amber-100 text-amber-700" };
}

export default function CardManutencao({ manutencoes }: CardManutencaoProps) {
  if (manutencoes.length === 0) {
    return <p className="p-6 text-sm text-slate-400 text-center">Nenhuma manutenção registrada.</p>;
  }

  return (
    <div className="divide-y divide-slate-100">
      {manutencoes.map((m) => {
        const st = statusManutencao(m);
        return (
          <div key={m.id} className="px-4 py-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">{m.assistenciaTecnica}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${st.classes}`}>
                {st.label}
              </span>
            </div>
            <div className="text-xs text-slate-400 space-y-1">
              <p><span className="font-semibold text-slate-500">Envio:</span> {new Date(m.dataEnvio).toLocaleDateString("pt-BR")}</p>
              <p><span className="font-semibold text-slate-500">Endereço:</span> {m.enderecoAssistencia}</p>
              {m.numeroOs && <p><span className="font-semibold text-slate-500">OS:</span> {m.numeroOs}</p>}
              {m.prazoTermino && <p><span className="font-semibold text-slate-500">Prazo:</span> {new Date(m.prazoTermino).toLocaleDateString("pt-BR")}</p>}
              {m.dataRetorno && <p><span className="font-semibold text-slate-500">Retorno:</span> {new Date(m.dataRetorno).toLocaleDateString("pt-BR")}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
