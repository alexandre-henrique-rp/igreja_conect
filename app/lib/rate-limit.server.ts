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
import { logAction } from "./audit.server";
import type { SessionUser } from "./session.types";

const WINDOW_MS = 60 * 60 * 1000; // 1 hora
const MAX_FAILS = 3;

// Whitelist conservadora: só caracteres válidos em IPv4 e IPv6 (incluindo
// notação `[::1]`). Tamanho máximo típico de um IP escrito é ≤ 45 chars.
const IP_VALIDATION_REGEX = /^[0-9a-fA-F.:[\]]+$/;
const IP_MAX_LEN = 64;

type Bucket = { count: number; firstAt: number };
const buckets = new Map<string, Bucket>();

/** Limpa todos os buckets (testes). */
export function resetRateLimit(): void {
  buckets.clear();
}

/**
 * Remove o bucket de um IP específico (desbloqueio manual via admin).
 *
 * **Camada 3 (defense in depth):** este service é gateado internamente — se
 * `user` for fornecido, exige-se ADMIN antes de mutar o estado. A checagem
 * na action (camada 2) já garante isso, mas mantemos a duplicata para que
 * qualquer chamada futura (test, CLI, outro service) não consiga desbloquear
 * IPs sem privilégio.
 *
 * **Validação:** input que não pareça IP (regex whitelist) é silenciosamente
 * ignorado — `buckets.delete` é idempotente e aceitar lixo só polui o log.
 *
 * **Audit (LGPD art. 46):** quando `user` é fornecido, persiste evento
 * `ratelimit.unblock` com `ipHash` SHA-256 (raw IP nunca toca o log).
 *
 * @param {string} ip - IP bruto do request (validado por regex).
 * @param {SessionUser} [user] - Admin que executou o unblock (opcional
 *   para compatibilidade com testes/migration; omitir em produção é proibido
 *   pela camada 2 da action).
 */
export function unblockIP(ip: string, user?: SessionUser): void {
  // Gate de role (camada 3)
  if (user && user.cargo !== "ADMIN") {
    throw new Response(
      "Apenas ADMIN pode desbloquear IPs.",
      { status: 403 }
    );
  }

  // Validação de input (defesa contra string lixo)
  if (
    !ip ||
    typeof ip !== "string" ||
    ip.length > IP_MAX_LEN ||
    !IP_VALIDATION_REGEX.test(ip)
  ) {
    return;
  }

  buckets.delete(ip);

  // Audit log (best-effort — não bloqueia a operação se falhar)
  if (user) {
    logAction({
      event: "ratelimit.unblock",
      actorId: user.id,
      actorRole: user.cargo,
      ip,
      details: JSON.stringify({ reason: "admin_manual_override" }),
    }).catch((err) => {
      console.error("rate-limit.server: falha ao logar unblockIP", err);
    });
  }
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
