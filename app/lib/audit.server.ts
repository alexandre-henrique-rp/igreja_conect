/**
 * Logger seguro de auditoria (S00-T06).
 *
 * Aplica allowlist antes de imprimir no console (RAG `lgpd-igreja-conect` §2.5).
 * Proibido logar: email, telefone, senhaHash, valorCentavos, endereço.
 *
 * @example
 *   safeLog({ userId: membro.id, action: "login_attempt", result: "ok" });
 *   // console.log: {"audit":{"userId":"abc","action":"login_attempt","result":"ok"}}
 */
export const ALLOWED_FIELDS = new Set([
  "userId",
  "action",
  "resource",
  "result",
  "timestamp",
  "ip",
]);

/**
 * Filtra evento para apenas campos da allowlist e imprime como JSON.
 *
 * @param {Record<string, unknown>} event - Evento bruto de auditoria.
 * @example
 *   safeLog({ userId: "u1", email: "leaked@x.com", action: "view" });
 *   // → console.log: {"audit":{"userId":"u1","action":"view"}}
 */
export function safeLog(event: Record<string, unknown>): void {
  const filtered = Object.fromEntries(
    Object.entries(event).filter(([k]) => ALLOWED_FIELDS.has(k))
  );
  console.log(JSON.stringify({ audit: filtered }));
}
