/**
 * Componente <Atalho /> — link rápido do dashboard (S04-T10).
 *
 * Link com ícone + label, em duas variantes visuais:
 * - `primary`: fundo cyan-700, texto branco (CTA principal).
 * - `secondary`: fundo slate-200, texto escuro (ação secundária).
 *
 * @example
 *   <Atalho to="/app/membros" label="Membros" variant="primary" />
 *   <Atalho to="/app/alertas" label="Alertas" variant="secondary" />
 *
 * @param props - Props do componente.
 * @param props.to - URL de destino.
 * @param props.label - Texto do atalho.
 * @param props.variant - "primary" ou "secondary".
 * @returns Elemento JSX do link.
 */
import { Link } from "react-router";
import { cn } from "~/lib/cn";

/**
 * Props aceitas pelo `<Atalho>`.
 */
export type AtalhoProps = {
  /** URL de destino. */
  to: string;
  /** Texto do atalho. */
  label: string;
  /** Variante visual. */
  variant: "primary" | "secondary";
};

/** Ícone SVG de seta (usado nos dois variants). */
function IconSeta() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Classes por variante. */
const VARIANT_CLASSES = {
  primary:
    "bg-cyan-700 text-white hover:bg-cyan-800",
  secondary:
    "bg-slate-200 text-slate-900 hover:bg-slate-300",
};

/**
 * @description Link de atalho com duas variantes visuais.
 * @param {AtalhoProps} props - to, label, variant.
 * @returns {JSX.Element} Elemento Link.
 */
export function Atalho({ to, label, variant }: AtalhoProps) {
  return (
    <Link
      to={to}
      data-testid="atalho"
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors",
        VARIANT_CLASSES[variant]
      )}
    >
      <IconSeta />
      <span>{label}</span>
    </Link>
  );
}
