interface BadgeStatusPatrimonioProps {
  status: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  DISPONIVEL: {
    label: "Disponível",
    classes: "bg-emerald-100 text-emerald-700",
  },
  EM_MANUTENCAO: {
    label: "Em manutenção",
    classes: "bg-amber-100 text-amber-700",
  },
  BAIXADO_PERDA: {
    label: "Baixado (perda)",
    classes: "bg-red-100 text-red-700",
  },
};

/**
 * Badge para status de item patrimoniado.
 * DISPONIVEL → verde, EM_MANUTENCAO → amber, BAIXADO_PERDA → vermelho.
 * Se status for null (item de consumo), retorna null.
 */
export default function BadgeStatusPatrimonio({ status }: BadgeStatusPatrimonioProps) {
  if (!status) return null;
  const config = STATUS_CONFIG[status];
  if (!config) return null;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${config.classes}`}
    >
      {config.label}
    </span>
  );
}
