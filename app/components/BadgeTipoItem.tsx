import { Badge } from "~/components/ds";

interface BadgeTipoItemProps {
  tipo: string;
}

/**
 * Badge que mostra o tipo do item (Consumo ou Patrimônio).
 * CONSUMO → tom `success` "Consumo"
 * PATRIMONIO → tom `warning` "Patrimônio"
 */
export default function BadgeTipoItem({ tipo }: BadgeTipoItemProps) {
  const isConsumo = tipo === "CONSUMO";
  return (
    <Badge tone={isConsumo ? "success" : "warning"}>
      {isConsumo ? "Consumo" : "Patrimônio"}
    </Badge>
  );
}
