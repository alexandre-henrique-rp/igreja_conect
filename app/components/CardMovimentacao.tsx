import { Badge } from "~/components/ds";

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

export default function CardMovimentacao({
  movimentacoes,
}: CardMovimentacaoProps) {
  if (movimentacoes.length === 0) {
    return (
      <p className="p-6 text-sm text-subtle text-center">
        Nenhuma movimentação registrada.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border">
      {movimentacoes.map((mov) => {
        const isEntrada = mov.quantidade > 0;
        return (
          <div key={mov.id} className="px-4 py-4 space-y-2">
            <div className="flex items-center justify-between">
              <Badge tone={isEntrada ? "success" : "danger"}>
                {isEntrada ? "ENTRADA" : "SAÍDA"}
              </Badge>
              <span
                className={`text-lg font-bold ${isEntrada ? "text-success" : "text-danger"}`}
              >
                {isEntrada ? `+${mov.quantidade}` : `${mov.quantidade}`}
              </span>
            </div>
            <div className="text-xs text-subtle space-y-1">
              <p>{new Date(mov.createdAt).toLocaleDateString("pt-BR")}</p>
              {!isEntrada && (
                <p>
                  <span className="font-semibold text-muted">Retirante:</span>{" "}
                  {mov.nomeRetirante}
                </p>
              )}
              {mov.justificativa && (
                <p>
                  <span className="font-semibold text-muted">
                    Justificativa:
                  </span>{" "}
                  {mov.justificativa}
                </p>
              )}
              {mov.autorizadoPor && (
                <p>
                  <span className="font-semibold text-muted">
                    Autorizado por:
                  </span>{" "}
                  {mov.autorizadoPor.nome}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
