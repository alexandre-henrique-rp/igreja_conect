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
    return <p className="p-6 text-sm text-subtle text-center">Nenhuma movimentação registrada.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-2 bg-surface-2/50 text-left text-xs font-bold text-subtle uppercase tracking-wider">
            <th className="px-6 py-3">Data</th>
            <th className="px-6 py-3">Tipo</th>
            <th className="px-6 py-3">Qtd</th>
            <th className="px-6 py-3">Retirante</th>
            <th className="px-6 py-3">Justificativa</th>
            <th className="px-6 py-3">Autorizado Por</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-2">
          {movimentacoes.map((mov) => {
            const isEntrada = mov.quantidade > 0;
            return (
              <tr key={mov.id} className="hover:bg-surface-2/50 transition-colors">
                <td className="px-6 py-3 whitespace-nowrap text-muted">
                  {new Date(mov.createdAt).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-6 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                    isEntrada ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
                  }`}>
                    {isEntrada ? "ENTRADA" : "SAÍDA"}
                  </span>
                </td>
                <td className={`px-6 py-3 font-bold ${isEntrada ? "text-success" : "text-danger"}`}>
                  {isEntrada ? `+${mov.quantidade}` : `${mov.quantidade}`}
                </td>
                <td className="px-6 py-3 text-muted">
                  {!isEntrada ? mov.nomeRetirante : <span className="text-border-strong">—</span>}
                </td>
                <td className="px-6 py-3 text-muted max-w-[200px] truncate" title={mov.justificativa ?? ""}>
                  {mov.justificativa || <span className="text-border-strong">—</span>}
                </td>
                <td className="px-6 py-3 text-muted">
                  {mov.autorizadoPor?.nome || <span className="text-border-strong">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
