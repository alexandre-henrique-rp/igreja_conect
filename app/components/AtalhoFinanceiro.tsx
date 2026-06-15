/**
 * Componente <AtalhoFinanceiro /> — atalho de navegação do módulo financeiro (S06-T09).
 *
 * Wrapper de `<Button as={Link}>` para links de atalho no dashboard financeiro.
 * Aceita variante visual opcional (default "secondary").
 *
 * @example
 *   <AtalhoFinanceiro label="Novo Lançamento" href="/app/financeiro/lancamentos/novo" />
 *
 * @param props - Props do componente.
 * @param props.label - Texto do botão.
 * @param props.href - URL de destino.
 * @param props.variant - Variante visual (default "secondary").
 * @returns Elemento JSX do atalho.
 */
import { Link } from "react-router";
import { Button } from "./Button";

/**
 * Props aceitas pelo `<AtalhoFinanceiro>`.
 */
export type AtalhoFinanceiroProps = {
  /** Texto do botão. */
  label: string;
  /** URL de destino. */
  href: string;
  /** Variante visual. */
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

/**
 * @description Atalho de navegação para ações rápidas do módulo financeiro.
 * @param {AtalhoFinanceiroProps} props - label, href, variant.
 * @returns {JSX.Element} Botão/Link de atalho.
 */
export function AtalhoFinanceiro({
  label,
  href,
  variant = "secondary",
}: AtalhoFinanceiroProps) {
  return (
    <Button as={Link} to={href} variant={variant} size="sm">
      {label}
    </Button>
  );
}
