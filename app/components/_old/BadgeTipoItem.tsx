interface BadgeTipoItemProps {
  tipo: string;
}

/**
 * Badge que mostra o tipo do item (Consumo ou Patrimônio).
 * CONSUMO → badge verde "Consumo"
 * PATRIMONIO → badge amber "Patrimônio"
 */
export default function BadgeTipoItem({ tipo }: BadgeTipoItemProps) {
  const isConsumo = tipo === "CONSUMO";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
        isConsumo
          ? "bg-emerald-100 text-emerald-700"
          : "bg-amber-100 text-amber-700"
      }`}
    >
      {isConsumo ? "Consumo" : "Patrimônio"}
    </span>
  );
}
