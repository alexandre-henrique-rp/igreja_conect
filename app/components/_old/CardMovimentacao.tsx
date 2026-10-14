interface MovimentacaoRow {
  id: string;
  quantidade: number;
  justificativa: string | null;
  nomeRetirante: string;
  createdAt: Date;
  autorizadoPor: { id: string; nome: string } | null;
}

interface CardMovimentacaoProps {
  movimentacoes: MovimentacaoRow[];
}

export default function CardMovimentacao({ movimentacoes }: CardMovimentacaoProps) {
  if (movimentacoes.length === 0) {
    return <p className="p-6 text-sm text-slate-400 text-center">Nenhuma movimentação registrada.</p>;
  }

  return (
    <div className="divide-y divide-slate-100">
      {movimentacoes.map((mov) => {
        const isEntrada = mov.quantidade > 0;
        return (
          <div key={mov.id} className="px-4 py-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                isEntrada ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              }`}>
                {isEntrada ? "ENTRADA" : "SAÍDA"}
              </span>
              <span className={`text-lg font-bold ${isEntrada ? "text-emerald-600" : "text-red-600"}`}>
                {isEntrada ? `+${mov.quantidade}` : `${mov.quantidade}`}
              </span>
            </div>
            <div className="text-xs text-slate-400 space-y-1">
              <p>{new Date(mov.createdAt).toLocaleDateString("pt-BR")}</p>
              {!isEntrada && <p><span className="font-semibold text-slate-500">Retirante:</span> {mov.nomeRetirante}</p>}
              {mov.justificativa && <p><span className="font-semibold text-slate-500">Justificativa:</span> {mov.justificativa}</p>}
              {mov.autorizadoPor && <p><span className="font-semibold text-slate-500">Autorizado por:</span> {mov.autorizadoPor.nome}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
