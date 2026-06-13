/**
 * Helpers de máscara client-side para telefone e CEP (S02-T05).
 *
 * **Por que regex em vez de lib externa (`react-imask`)?** O DESIGN
 * §5.3 diz "sem lib externa" — máscaras são 5 linhas de regex.
 *
 * **Comportamento:**
 * - Aceitam string parcial (usuário digitando) e aplicam a máscara progressivamente.
 * - Não bloqueiam `backspace` (apagar): basta remover os caracteres
 *   não-dígitos da entrada e reaplicar a máscara.
 * - Limitam ao tamanho máximo esperado (11 dígitos p/ telefone, 8 p/ CEP).
 *
 * **Edge cases cobertos:**
 * - String vazia → string vazia.
 * - Caracteres não-dígito (parênteses, hífens, espaços) são removidos antes.
 * - Tamanho máximo: nunca mais dígitos que o suportado.
 */

const TELEFONE_MAX_DIGITOS = 11; // (11) 98765-4321
const CEP_MAX_DIGITOS = 8; // 01000-000

/** Remove tudo que não é dígito. */
function soDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * Aplica máscara de telefone BR: `(11) 98765-4321` (11 dígitos) ou
 * `(11) 1234-5678` (10 dígitos).
 *
 * @param raw - Texto digitado pelo usuário (pode conter lixo).
 * @returns Telefone formatado (pode ser parcial enquanto digita).
 * @example
 *   mascaraTelefone("11987654321"); // "(11) 98765-4321"
 *   mascaraTelefone("1112345678");  // "(11) 1234-5678"
 *   mascaraTelefone("11");          // "(11"
 */
export function mascaraTelefone(raw: string): string {
  const digitos = soDigitos(raw).slice(0, TELEFONE_MAX_DIGITOS);
  if (digitos.length === 0) return "";
  if (digitos.length <= 2) {
    return `(${digitos}`;
  }
  if (digitos.length <= 6) {
    // (11) 1234
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  }
  if (digitos.length <= 10) {
    // Fixo: (11) 1234-5678
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  // Celular: (11) 98765-4321
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

/**
 * Aplica máscara de CEP: `01000-000`.
 *
 * @param raw - Texto digitado pelo usuário.
 * @returns CEP formatado (pode ser parcial).
 * @example
 *   mascaraCep("01000000"); // "01000-000"
 *   mascaraCep("01000");    // "01000-"
 */
export function mascaraCep(raw: string): string {
  const digitos = soDigitos(raw).slice(0, CEP_MAX_DIGITOS);
  if (digitos.length === 0) return "";
  if (digitos.length <= 5) {
    return digitos;
  }
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
}
