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

interface TabelaManutencoesProps {
  manutencoes: ManutencaoRow[];
}

function statusManutencao(m: ManutencaoRow): { label: string; classes: string } {
  if (m.foiPerdaTotal) return { label: "Perda Total", classes: "bg-red-100 text-red-700" };
  if (m.dataRetorno) return { label: "Concluída", classes: "bg-emerald-100 text-emerald-700" };
  return { label: "Em Andamento", classes: "bg-amber-100 text-amber-700" };
}

export default function TabelaManutencoes({ manutencoes }: TabelaManutencoesProps) {
  if (manutencoes.length === 0) {
    return <p className="p-6 text-sm text-slate-400 text-center">Nenhuma manutenção registrada.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
            <th className="px-6 py-3">Data Envio</th>
            <th className="px-6 py-3">Assistência</th>
            <th className="px-6 py-3">Endereço</th>
            <th className="px-6 py-3">OS</th>
            <th className="px-6 py-3">Prazo</th>
            <th className="px-6 py-3">Data Retorno</th>
            <th className="px-6 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {manutencoes.map((m) => {
            const st = statusManutencao(m);
            return (
              <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-3 whitespace-nowrap text-slate-600">
                  {new Date(m.dataEnvio).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-6 py-3 font-semibold text-slate-700">{m.assistenciaTecnica}</td>
                <td className="px-6 py-3 text-slate-600 max-w-[200px] truncate" title={m.enderecoAssistencia}>
                  {m.enderecoAssistencia}
                </td>
                <td className="px-6 py-3 text-slate-600 font-mono">{m.numeroOs || <span className="text-slate-300">—</span>}</td>
                <td className="px-6 py-3 whitespace-nowrap text-slate-600">
                  {m.prazoTermino ? new Date(m.prazoTermino).toLocaleDateString("pt-BR") : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-slate-600">
                  {m.dataRetorno ? new Date(m.dataRetorno).toLocaleDateString("pt-BR") : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-6 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${st.classes}`}>
                    {st.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
