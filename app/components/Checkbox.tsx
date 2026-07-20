/**
 * Componente <Checkbox /> — caixa de seleção nativa do Igreja Conect (S01-T06).
 *
 * Usa o **padrão de label aninhado** (label encapsula o input) ao invés
 * de `htmlFor`/`id`. Isso elimina o problema de IDs duplicados quando
 * o mesmo form é renderizado múltiplas vezes na mesma página (ex: lista
 * de cards) e funciona perfeitamente com screen readers — clicar no
 * texto do label marca/desmarca o input.
 *
 * **Visual:** checkbox cyan-700 quando marcado, foco visível com ring-2.
 *
 * **Acessibilidade:**
 * - Associação label/input por aninhamento (sem `for`/`id`).
 * - `focus-visible:ring-2 focus-visible:ring-cyan-700` (WCAG 2.4.7).
 * - Contraste cyan-700 em branco = ~5.5:1 (passa AA+).
 *
 * **Tailwind 4:** sem `@apply`. Classes vêm dos tokens de `app/app.css`.
 *
 * @example
 *   <Checkbox
 *     label="Manter-me conectado (30 dias)"
 *     name="manterConectado"
 *     value="true"
 *   />
 *
 * @param props - Props do componente (ver `CheckboxProps`).
 * @returns Elemento JSX do checkbox.
 */
import type { InputHTMLAttributes } from "react";
import { cn } from "~/lib/cn";

/**
 * Props aceitas pelo `<Checkbox>`. Aceita props nativas de `<input>`
 * via spread (excluindo `type` que sempre é `checkbox`).
 */
export type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "id"
> & {
  /** Texto visível ao lado do checkbox. */
  label: string;
  /** `name` do input — enviado no FormData. */
  name: string;
  /** Variante visual. Default: `default`. */
  variant?: "default" | "dark";
};

/**
 * @description Checkbox acessível com label aninhado.
 * @param {CheckboxProps} props - Veja `CheckboxProps`.
 * @returns {JSX.Element} Elemento do checkbox.
 */
export function Checkbox({ label, className, variant = "default", ...rest }: CheckboxProps) {
  const isDark = variant === "dark";

  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        className={cn(
          "h-4 w-4 rounded focus-visible:outline-none focus-visible:ring-2",
          isDark
            ? "border-[#253551] bg-[#131d30] text-blue-600 focus-visible:ring-blue-500 focus-visible:ring-offset-0 accent-blue-500"
            : "border-slate-300 text-cyan-700 focus-visible:ring-cyan-700 focus-visible:ring-offset-2",
          className
        )}
        {...rest}
      />
      <span className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-700")}>{label}</span>
    </label>
  );
}
