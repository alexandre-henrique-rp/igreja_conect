import { prisma } from "~/db/prisma.server";
import { createCookie } from "react-router";

/** TTL sliding: 7 dias. Cada request autenticado estende o cookie. */
export const SLIDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** TTL absoluto (teto): 30 dias. Após isso a sessão morre definitivamente. */
export const ABSOLUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Nome do cookie httpOnly que armazena o session id. */
export const SESSION_COOKIE_NAME = "__session";

/**
 * Cookie de sessão com flags estritas (LGPD + RAG `lgpd-igreja-conect` §2.4).
 *
 * - `httpOnly: true` — sem JS, mitiga XSS roubando sessão.
 * - `sameSite: "lax"` — mitiga CSRF em mutações.
 * - `secure: NODE_ENV === "production"` — apenas HTTPS em prod.
 * - `path: "/"` — escopo global.
 * - TTL do cookie: 7 dias (sliding; absoluto é controlado server-side).
 */
export const sessionCookie = createCookie(SESSION_COOKIE_NAME, {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SLIDING_TTL_MS / 1000,
  secrets: [process.env.SESSION_SECRET ?? "dev-only-not-secret"],
});

/**
 * Subset de Membro que vai para a session — nunca inclui `senhaHash`.
 */
export type SessionUser = {
  id: string;
  nome: string;
  cargo: string | null;
};

/**
 * Cria uma sessão para o membro, persistindo no DB e retornando o `sid`.
 *
 * @description Persiste registro em `Session` com `expiresAt = now + 7d`
 *   e `absoluteExpiresAt = now + 30d`.
 * @param {string} membroId - UUID do membro que está logando.
 * @returns {Promise<string>} `sid` (UUID) que vai no cookie.
 * @example
 *   const sid = await createSession(membro.id);
 *   return redirect("/app", {
 *     headers: { "Set-Cookie": await sessionCookie.serialize(sid) }
 *   });
 */
export async function createSession(membroId: string): Promise<string> {
  const now = Date.now();
  const sess = await prisma.session.create({
    data: {
      membroId,
      expiresAt: new Date(now + SLIDING_TTL_MS),
      absoluteExpiresAt: new Date(now + ABSOLUTE_TTL_MS),
    },
  });
  return sess.id;
}

/**
 * Lê o cookie de sessão e devolve o usuário (sem senha) ou null.
 *
 * Aplica sliding renewal: se a sessão está válida mas perto de expirar,
 * estende `expiresAt` para `min(now + 7d, absoluteExpiresAt)`. Se passou
 * `absoluteExpiresAt`, deleta o registro e retorna null.
 *
 * @description Lê cookie, busca Session+Membro, faz sliding renewal ou invalida.
 * @param {Request} request - Request do React Router (do loader/action).
 * @returns {Promise<SessionUser | null>} `{id, nome, cargo}` ou `null`.
 * @example
 *   const user = await getUserFromRequest(request);
 *   if (!user) throw redirect("/login");
 */
export async function getUserFromRequest(request: Request): Promise<SessionUser | null> {
  const sid = await sessionCookie.parse(request.headers.get("Cookie"));
  if (typeof sid !== "string" || !sid) return null;

  const sess = await prisma.session.findUnique({
    where: { id: sid },
    include: { membro: { select: { id: true, nome: true, cargo: true } } },
  });
  if (!sess) return null;

  const now = Date.now();
  if (sess.absoluteExpiresAt.getTime() < now) {
    await prisma.session.delete({ where: { id: sid } }).catch(() => {});
    return null;
  }
  if (sess.expiresAt.getTime() < now) {
    const newExpires = Math.min(now + SLIDING_TTL_MS, sess.absoluteExpiresAt.getTime());
    await prisma.session.update({
      where: { id: sid },
      data: { expiresAt: new Date(newExpires) },
    });
  }

  return {
    id: sess.membro.id,
    nome: sess.membro.nome,
    cargo: sess.membro.cargo,
  };
}

/**
 * Remove o registro da sessão (logout server-side).
 *
 * O cookie no browser é limpo pelo chamador via
 * `Set-Cookie: __session=; Max-Age=0`. Esta função só mexe no DB.
 *
 * @description Invalida sessão no servidor.
 * @param {string} sid - UUID da sessão a deletar.
 * @returns {Promise<void>}
 * @example
 *   await deleteSession(sid);
 *   return redirect("/login", {
 *     headers: { "Set-Cookie": await sessionCookie.serialize("", { maxAge: 0 }) }
 *   });
 */
export async function deleteSession(sid: string): Promise<void> {
  if (!sid) return;
  await prisma.session.delete({ where: { id: sid } }).catch(() => {});
}
