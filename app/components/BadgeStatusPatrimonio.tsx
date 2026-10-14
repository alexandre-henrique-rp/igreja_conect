import { Badge, type BadgeTone } from "~/components/ds";

interface BadgeStatusPatrimonioProps {
  status: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; tone: BadgeTone }> = {
  DISPONIVEL: { label: "Disponível", tone: "success" },
  EM_MANUTENCAO: { label: "Em manutenção", tone: "warning" },
  BAIXADO_PERDA: { label: "Baixado (perda)", tone: "danger" },
};

/**
 * Badge para status de item patrimoniado.
 * DISPONIVEL → success, EM_MANUTENCAO → warning, BAIXADO_PERDA → danger.
 * Se status for null (item de consumo), retorna null.
 */
export default function BadgeStatusPatrimonio({
  status,
}: BadgeStatusPatrimonioProps) {
  if (!status) return null;
  const config = STATUS_CONFIG[status];
  if (!config) return null;
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
