/**
 * POST /api/auth/login (S00-T09).
 *
 * Body (JSON): { email, senha }
 * Resposta OK: 204 No Content + Set-Cookie __session
 * Resposta fail: 401 Unauthorized com mensagem genérica (anti-enumeração)
 *
 * Rate limit: 5 tentativas / 15min / IP (in-memory).
 *
 * @see app/lib/session.server.ts
 * @see app/lib/auth.server.ts
 * @see app/lib/rate-limit.server.ts
 */
import type { ActionFunctionArgs } from "react-router";
import { prisma } from "~/db/prisma.server";
import { verifyPassword } from "~/lib/auth.server";
import { createSession, sessionCookie } from "~/lib/session.server";
import { checkRateLimit } from "~/lib/rate-limit.server";
import { safeLog } from "~/lib/audit.server";
import { LoginInputSchema } from "~/lib/validators/auth";

/**
 * @description Action de login: valida payload, aplica rate limit, verifica
 *   credenciais, cria sessão e seta cookie httpOnly.
 * @param {ActionFunctionArgs} args - Request do React Router.
 * @returns {Response} 204 (sucesso), 401 (credenciais inválidas),
 *   400 (payload inválido), 429 (rate limit).
 */
export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Método não permitido", { status: 405 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  // Rate limit
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    safeLog({ action: "login", result: "rate_limited", ip, timestamp: Date.now() });
    return new Response("Muitas tentativas. Tente novamente em alguns minutos.", {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfter) },
    });
  }

  // Parse + valida payload
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }
  const parsed = LoginInputSchema.safeParse(body);
  if (!parsed.success) {
    checkRateLimit(ip, "fail");
    safeLog({ action: "login", result: "invalid_payload", ip, timestamp: Date.now() });
    return new Response("Email ou senha inválidos.", { status: 400 });
  }

  // Busca membro por email
  const membro = await prisma.membro.findUnique({
    where: { email: parsed.data.email },
  });

  // Mensagem genérica para não vazar se email existe
  const fail = () => {
    checkRateLimit(ip, "fail");
    safeLog({ action: "login", result: "invalid_credentials", ip, timestamp: Date.now() });
    return new Response("Email ou senha inválidos.", { status: 401 });
  };

  if (!membro || !membro.senhaHash) return fail();

  const ok = await verifyPassword(parsed.data.senha, membro.senhaHash);
  if (!ok) return fail();

  // Login OK: cria sessão e seta cookie
  const sid = await createSession(membro.id);
  safeLog({ userId: membro.id, action: "login", result: "ok", ip, timestamp: Date.now() });

  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": await sessionCookie.serialize(sid) },
  });
}

/** GET não é permitido — só POST. */
export function loader(): Response {
  return new Response("Método não permitido", { status: 405 });
}
