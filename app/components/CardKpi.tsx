/**
 * Componente <CardKpi /> — card de KPI para dashboard (S04-T10).
 *
 * Exibe um indicador com label + valor (grande, bold) + hint opcional.
 * Se `href` for fornecido, o card inteiro vira um `<Link>`.
 * `tone="attention"` muda o fundo para amber-50.
 *
 * @example
 *   <CardKpi label="Membros Ativos" value={42} hint="+5 este mês" href="/app/membros" />
 *
 * @example
 *   // Com tom de atenção
 *   <CardKpi label="Visitantes" value={12} tone="attention" />
 *
 * @param props - Props do componente.
 * @param props.label - Rótulo do indicador.
 * @param props.value - Valor numérico.
 * @param props.hint - Texto de apoio (opcional).
 * @param props.href - Link opcional.
 * @param props.tone - Tom visual: "default" ou "attention".
 * @returns Elemento JSX.
 */
import { Link } from "react-router";
import { cn } from "~/lib/cn";

/**
 * Props aceitas pelo `<CardKpi>`.
 */
export type CardKpiProps = {
  /** Rótulo do indicador. */
  label: string;
  /** Valor numérico. */
  value: number;
  /** Texto de apoio (opcional). */
  hint?: string;
  /** Link opcional (transforma o card em Link). */
  href?: string;
  /** Tom visual. Default: "default". */
  tone?: "default" | "attention";
};

/** Classes de fundo por tone. */
const TONE_CLASSES = {
  default: "bg-white",
  attention: "bg-amber-50",
};

/**
 * @description Card de KPI com valor em destaque.
 * @param {CardKpiProps} props - label, value, hint, href, tone.
 * @returns {JSX.Element} Elemento do card.
 */
export function CardKpi({
  label,
  value,
  hint,
  href,
  tone = "default",
}: CardKpiProps) {
  const content = (
    <div
      data-testid="card-kpi"
      className={cn(
        "rounded-lg border border-slate-200 p-4 space-y-1",
        TONE_CLASSES[tone]
      )}
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );

  if (href) {
    return (
      <Link to={href} className="block hover:opacity-80 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}
