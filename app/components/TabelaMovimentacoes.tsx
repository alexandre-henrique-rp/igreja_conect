interface MovimentacaoRow {
  id: string;
  quantidade: number;
  justificativa: string | null;
  nomeRetirante: string;
  createdAt: Date;
  autorizadoPor: { id: string; nome: string } | null;
}

interface TabelaMovimentacoesProps {
  movimentacoes: MovimentacaoRow[];
}

export default function TabelaMovimentacoes({ movimentacoes }: TabelaMovimentacoesProps) {
  if (movimentacoes.length === 0) {
    return <p className="p-6 text-sm text-slate-400 text-center">Nenhuma movimentação registrada.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
            <th className="px-6 py-3">Data</th>
            <th className="px-6 py-3">Tipo</th>
            <th className="px-6 py-3">Qtd</th>
            <th className="px-6 py-3">Retirante</th>
            <th className="px-6 py-3">Justificativa</th>
            <th className="px-6 py-3">Autorizado Por</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {movimentacoes.map((mov) => {
            const isEntrada = mov.quantidade > 0;
            return (
              <tr key={mov.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-3 whitespace-nowrap text-slate-600">
                  {new Date(mov.createdAt).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-6 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                    isEntrada ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                  }`}>
                    {isEntrada ? "ENTRADA" : "SAÍDA"}
                  </span>
                </td>
                <td className={`px-6 py-3 font-bold ${isEntrada ? "text-emerald-600" : "text-red-600"}`}>
                  {isEntrada ? `+${mov.quantidade}` : `${mov.quantidade}`}
                </td>
                <td className="px-6 py-3 text-slate-600">
                  {!isEntrada ? mov.nomeRetirante : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-6 py-3 text-slate-600 max-w-[200px] truncate" title={mov.justificativa ?? ""}>
                  {mov.justificativa || <span className="text-slate-300">—</span>}
                </td>
                <td className="px-6 py-3 text-slate-600">
                  {mov.autorizadoPor?.nome || <span className="text-slate-300">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
