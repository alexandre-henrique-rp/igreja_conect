/**
 * Rate limit in-memory para o endpoint /login.
 *
 * **Limitação:** estado em memória. Não persiste após restart, não escala
 * para multi-instância. Para MVP (1 processo Node) é suficiente.
 *
 * **Semântica:** 3 falhas em 1h. Cada `result: "fail"` incrementa o
 * contador. Quando o contador atinge 3, a próxima chamada é bloqueada
 * até passar a janela de 1h.
 */
const WINDOW_MS = 60 * 60 * 1000; // 1 hora
const MAX_FAILS = 3;

type Bucket = { count: number; firstAt: number };
const buckets = new Map<string, Bucket>();

/** Limpa todos os buckets (testes). */
export function resetRateLimit(): void {
  buckets.clear();
}

/**
 * Remove o bucket de um IP específico (desbloqueio manual via admin).
 */
export function unblockIP(ip: string): void {
  buckets.delete(ip);
}

/**
 * Retorna lista de IPs bloqueados (para UI admin).
 */
export function getBlockedIPs(): Array<{ ip: string; count: number; firstAt: number; retryAfter: number }> {
  const now = Date.now();
  const blocked: Array<{ ip: string; count: number; firstAt: number; retryAfter: number }> = [];

  for (const [ip, bucket] of buckets) {
    if (now - bucket.firstAt > WINDOW_MS) {
      buckets.delete(ip);
      continue;
    }
    if (bucket.count >= MAX_FAILS) {
      const retryAfter = Math.ceil((WINDOW_MS - (now - bucket.firstAt)) / 1000);
      blocked.push({ ip, count: bucket.count, firstAt: bucket.firstAt, retryAfter: Math.max(1, retryAfter) });
    }
  }

  return blocked;
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
