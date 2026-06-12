/**
 * Helpers de valores monetários em centavos (S00-T09).
 *
 * **Placeholder** criado para satisfazer imports da aba Fidelidade
 * (sprint S03). Helpers canônicos completos virão quando o módulo
 * Financeiro entrar.
 *
 * @see .harness/RAG/convention-monetary-values.md
 */

/**
 * @description Formata Int (cents) como moeda BRL no formato pt-BR.
 * @param {number} cents - Valor em centavos (Int).
 * @returns {string} Ex: "R$ 1.234,56" (com ponto de milhar e vírgula decimal).
 * @example
 *   formatBRLFromCents(12345) === "R$ 123,45";
 *   formatBRLFromCents(0)     === "R$ 0,00";
 */
export function formatBRLFromCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(cents / 100);
}
