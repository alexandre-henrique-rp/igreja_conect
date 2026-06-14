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
