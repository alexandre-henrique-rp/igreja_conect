/**
 * Rate limit in-memory para o endpoint /login (S00).
 *
 * **Limitação:** estado em memória. Não persiste após restart, não escala
 * para multi-instância. Para MVP (1 processo Node) é suficiente.
 *
 * **Semântica:** 5 falhas em 15min. Cada `result: "fail"` incrementa o
 * contador. Quando o contador atinge 5, a próxima chamada (sem result ou
 * com result) é bloqueada até passar a janela de 15min.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 5;

type Bucket = { count: number; firstAt: number };
const buckets = new Map<string, Bucket>();

/** Limpa todos os buckets (testes). */
export function resetRateLimit(): void {
  buckets.clear();
}

/**
 * @description Verifica se a chave pode fazer mais uma tentativa.
 * @param {string} key - Identificador (IP).
 * @param {"success" | "fail"} [result] - Resultado da tentativa anterior.
 * @returns {{ allowed: boolean, retryAfter?: number }} `allowed: false`
 *   e `retryAfter` em segundos quando bloqueado.
 */
export function checkRateLimit(
  key: string,
  result?: "success" | "fail"
): { allowed: boolean; retryAfter?: number } {
  if (result === "success") {
    buckets.delete(key);
    return { allowed: true };
  }

  const now = Date.now();
  const existing = buckets.get(key);
  if (existing && now - existing.firstAt > WINDOW_MS) {
    buckets.delete(key);
  }

  const current = buckets.get(key) ?? { count: 0, firstAt: now };

  // Bucket já cheio: BLOQUEIA (qualquer chamada, mesmo com "fail" — não vale tentar)
  if (current.count >= MAX_FAILS) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - current.firstAt)) / 1000);
    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }

  if (result === "fail") {
    current.count += 1;
    buckets.set(key, current);
  }

  return { allowed: true };
}
