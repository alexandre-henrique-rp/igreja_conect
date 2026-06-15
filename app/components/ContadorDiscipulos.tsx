/**
 * Componente <ContadorDiscipulos /> — contador visual de discípulos (S03-T05).
 *
 * Exibe "X/12 discípulos" com cor que varia conforme a proximidade do
 * limite (RN-MEM-04: trava de 12). Inclui badge de aviso quando >= 10
 * e badge de "Limite atingido" quando === 12.
 *
 * **Lógica de cor (regra crítica):**
 * - `atual < 10`: `text-slate-700` (normal).
 * - `10 <= atual < 12`: `text-amber-700` (atenção).
 * - `atual === 12`: `text-amber-800 font-bold` (limite).
 *
 * **Acessibilidade (WCAG 1.3.1, 4.1.3):**
 * - `aria-live="polite"` — screen reader anuncia mudanças sem interromper.
 * - `aria-label` descritivo: "X de 12 discípulos" (com vagas restantes se < 12).
 * - Badge de atenção/limite também tem `aria-label` próprio.
 *
 * **Tailwind 4 utility-first:** sem `@apply`. Classes via string template.
 *
 * @example
 *   <ContadorDiscipulos atual={8} /> // "8/12 discípulos" em slate
 *
 * @example
 *   <ContadorDiscipulos atual={12} /> // "12/12 discípulos" em amber-800 + badge "Limite atingido"
 *
 * @param props - Props do componente (ver `ContadorDiscipulosProps`).
 * @returns Elemento JSX do contador.
 */
import { cn } from "~/lib/cn";

/**
 * Props aceitas pelo `<ContadorDiscipulos>`.
 */
export type ContadorDiscipulosProps = {
  /** Quantidade atual de discípulos vinculados. */
  atual: number;
  /** Limite máximo (padrão 12 conforme RN-MEM-04). */
  max?: number;
};

/**
 * @description Contador "X/max discípulos" com cor reativa e badge de aviso (RN-MEM-04).
 * @param {ContadorDiscipulosProps} props - atual e max (opcional, default 12).
 * @returns {JSX.Element} Elemento JSX do contador.
 */
export function ContadorDiscipulos({ atual, max = 12 }: ContadorDiscipulosProps) {
  const isLimit = atual === max;
  const isAttention = atual >= 10 && atual < max;

  // Cor: amber-800 no limite, amber-700 em atenção, slate-700 normal.
  const colorClass = isLimit
    ? "text-amber-800"
    : isAttention
      ? "text-amber-700"
      : "text-slate-700";

  // Vagas restantes (apenas para o aria-label, fica implícito na UI).
  const vagasRestantes = Math.max(0, max - atual);
  const ariaLabel =
    atual < max
      ? `${atual} de ${max} discípulos — ${vagasRestantes} vaga${vagasRestantes === 1 ? "" : "s"} restante${vagasRestantes === 1 ? "" : "s"}`
      : `${atual} de ${max} discípulos — limite atingido`;

  return (
    <p
      className={cn("text-sm flex items-center gap-2 flex-wrap", colorClass)}
      aria-live="polite"
      aria-label={ariaLabel}
      data-testid="contador-discipulos"
    >
      <span className={cn("text-base font-semibold", isLimit && "font-bold")}>
        {atual}
      </span>
      <span>{`/${max} discípulos`}</span>

      {isLimit && (
        <span
          className="inline-flex items-center gap-1 text-xs font-medium text-amber-800"
          aria-label="Limite atingido"
        >
          <span aria-hidden="true">⚠</span>
          Limite atingido
        </span>
      )}

      {isAttention && (
        <span
          className="inline-flex items-center gap-1 text-xs font-medium text-amber-700"
          aria-label="Atenção: próximo do limite"
        >
          <span aria-hidden="true">⚠</span>
          Atenção
        </span>
      )}
    </p>
  );
}
