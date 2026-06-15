/**
 * Helpers de valores monetários em centavos (S00-T09).
 *
 * **Placeholder** criado para satisfazer imports da aba Fidelidade
 * (sprint S03). Helpers canônicos completos virão quando o módulo
 * Financeiro entrar.
 *
 * @see .harness/RAG/convention-monetary-values.md
 */

export { formatBRLFromCents } from "./money-format";

/**
 * @description Lança Response(400) se valor não é Int >= 0.
 * @param {number} valor - Valor em centavos.
 * @param {string} context - Contexto para mensagem de erro.
 * @returns {void}
 * @throws {Response} 400 se valor não é Int ou é negativo.
 * @example
 *   assertNonNegative(100, "Lançamento"); // OK
 *   assertNonNegative(-5, "Lançamento"); // throws 400
 */
export function assertNonNegative(valor: number, context: string): void {
  if (!Number.isInteger(valor) || valor < 0) {
    throw new Response(`${context}: valor deve ser inteiro >= 0.`, { status: 400 });
  }
}
