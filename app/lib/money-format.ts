/**
 * Helpers client-safe de valores monetários (S06-T13).
 *
 * `formatBRLFromCents` (Int → "R$ 1.234,56") já existe em
 * `money.server.ts` (server-only). Para evitar tree-shaking errado
 * (este módulo é importado por componentes client-side), criamos
 * aqui as versões **client-safe** que rodam tanto no browser quanto
 * no SSR. A versão canônica em `money.server.ts` permanece como
 * fonte da verdade para uso server-side.
 *
 * **Decisão:** `formatBRLFromCents` é definido aqui (client-safe) e
 * re-exportado por `money.server.ts` para uso server-side. Componentes importam
 * daqui para evitar imports `.server` em arquivos com hooks.
 *
 * @see .harness/RAG/convention-monetary-values.md
 */

/**
 * @description Formata Int (cents) como moeda BRL no formato pt-BR.
 * @param {number} cents - Valor em centavos (Int).
 * @returns {string} Ex: "R$ 1.234,56".
 * @example
 *   formatBRLFromCents(12345) === "R$ 123,45";
 */
export function formatBRLFromCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

/**
 * @description Converte string BRL (com vírgula ou ponto) para Int em
 *   centavos. Aceita formatos "50", "50,00", "50.00", "R$ 50,00",
 *   "1.234,56" (separador BR). Retorna `null` se inválido.
 * @param {string} raw - String digitada pelo usuário.
 * @returns {number | null} Centavos (Int) ou `null` se não parseável.
 * @example
 *   parseBRLToCents("50,00") === 5000;
 *   parseBRLToCents("R$ 1.234,56") === 123456;
 *   parseBRLToCents("abc") === null;
 *   parseBRLToCents("0,001") === 0;  // arredonda para centavo
 *   parseBRLToCents("") === null;
 */
export function parseBRLToCents(raw: string): number | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  // Remove prefixo "R$" e espaços.
  const cleaned = trimmed
    .replace(/R\$\s*/gi, "")
    .replace(/\s/g, "");

  // Detecta formato BR (1.234,56) vs US (1,234.56 ou 1234.56).
  // Heurística: se tem vírgula E ponto, vírgula é decimal.
  // Se tem só vírgula, vírgula é decimal.
  // Se tem só ponto, ponto é decimal.
  let normalized: string;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    // BR: "1.234,56" → remove pontos, troca vírgula por ponto
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    // "50,00" ou "50,5" → troca vírgula por ponto
    normalized = cleaned.replace(",", ".");
  } else {
    // "50" ou "50.00" ou "1234.56" → já está em formato US
    normalized = cleaned;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;

  // Converte reais para centavos e arredonda.
  const cents = Math.round(parsed * 100);
  return cents;
}

/**
 * @description Aplica máscara BRL durante a digitação (input de valor).
 *   Mostra vírgula como decimal e ponto como separador de milhar.
 *   Usado por `<MoneyInput />` para feedback visual em tempo real.
 * @param {string} raw - Texto digitado (pode conter lixo).
 * @returns {string} Valor formatado (ex: "1.234,56").
 * @example
 *   mascaraBRL("123456") === "1.234,56";
 *   mascaraBRL("5000") === "50,00";
 *   mascaraBRL("") === "";
 */
export function mascaraBRL(raw: string): string {
  // Remove tudo que não é dígito.
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return "";

  // Converte para número e divide por 100 (centavos → reais).
  const cents = parseInt(digits, 10);
  const reais = cents / 100;

  // Formata com Intl pt-BR (2 casas decimais, vírgula).
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(reais);
}
