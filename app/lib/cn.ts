/**
 * Helper de classes Tailwind condicionais (S00-T15).
 *
 * Aceita string, false/undefined/null (ignorados), array, ou objeto
 * `{ classe: boolean }`. Concatena os truthy com espaço.
 *
 * Implementação intencionalmente **sem dependência externa** (clsx) para
 * manter o bundle mínimo. A regra de 3 ainda não justificou abstração.
 *
 * @example
 *   cn("base", isActive && "active", { "opacity-50": disabled })
 *   // → "base active opacity-50" (se isActive=true, disabled=true)
 */
type ClassValue =
  | string
  | number
  | false
  | null
  | undefined
  | ClassValue[]
  | { [key: string]: boolean | null | undefined };

/**
 * @description Combina classes Tailwind condicionalmente.
 * @param {...ClassValue[]} inputs - Strings, arrays, objetos, ou valores falsy.
 * @returns {string} Classes truthy concatenadas com espaço.
 */
export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];

  const walk = (v: ClassValue): void => {
    if (!v) return;
    if (typeof v === "string" || typeof v === "number") {
      classes.push(String(v));
    } else if (Array.isArray(v)) {
      v.forEach(walk);
    } else if (typeof v === "object") {
      for (const [k, val] of Object.entries(v)) {
        if (val) classes.push(k);
      }
    }
  };

  inputs.forEach(walk);
  return classes.join(" ").trim().replace(/\s+/g, " ");
}
