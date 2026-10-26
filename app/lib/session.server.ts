// SEC-003 (S06-REWORK): SESSION_SECRET validation — must be set and >= 32 chars in production
if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET obrigatório em produção");
}
if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET deve ter >= 32 caracteres");
}

import { prisma } from "~/db/prisma.server";
import { createCookie } from "react-router";
import type { PrismaClient } from "../../generated/prisma/client";

/** TTL sliding: 7 dias. Cada request autenticado estende o cookie. */
export const SLIDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** TTL absoluto (teto): 30 dias. Após isso a sessão morre definitivamente. */
export const ABSOLUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Sessão SEM "lembrar de mim": TTL deslizante de 12h e teto de 24h no
 * servidor. O cookie correspondente é de sessão do navegador (sem
 * `Max-Age`), ou seja, some quando o navegador é fechado.
 */
export const SHORT_SLIDING_TTL_MS = 12 * 60 * 60 * 1000;
export const SHORT_ABSOLUTE_TTL_MS = 24 * 60 * 60 * 1000;

/** Nome do cookie httpOnly que armazena o session id. */
export const SESSION_COOKIE_NAME = "__session";

/**
 * Cookie de sessão com flags estritas (LGPD + RAG `lgpd-igreja-conect` §2.4).
 *
 * - `httpOnly: true` — sem JS, mitiga XSS roubando sessão.
 * - `sameSite: "lax"` — mitiga CSRF em mutações.
 * - `secure: NODE_ENV === "production"` — apenas HTTPS em prod.
 * - `path: "/" — escopo global.
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
 * Para testes, passe `prismaTest` como segundo argumento para usar o DB de teste.
 *
 * @description Persiste registro em `Session`. Com `remember` (padrão):
 *   `expiresAt = now + 7d` e `absoluteExpiresAt = now + 30d`. Sem `remember`
 *   ("lembrar de mim" desmarcado): `now + 12h` e `now + 24h`.
 * @param {string} membroId - UUID do membro que está logando.
 * @param {typeof import("../../generated/prisma/client").PrismaClient} [prismaClient] -
 *   PrismaClient opcional para injeção de dependência (testes).
 * @param {{ remember?: boolean }} [options] - `remember: false` cria sessão curta.
 * @returns {Promise<string>} `sid` (UUID) que vai no cookie.
 * @example
 *   const sid = await createSession(membro.id);
 *   const sidTest = await createSession(membro.id, prismaTest);
 */
export async function createSession(
  membroId: string,
  prismaClient?: PrismaClient,
  options: { remember?: boolean } = {}
): Promise<string> {
  const p = prismaClient ?? prisma;
  const remember = options.remember ?? true;
  const now = Date.now();
  const sess = await p.session.create({
    data: {
      membroId,
      expiresAt: new Date(now + (remember ? SLIDING_TTL_MS : SHORT_SLIDING_TTL_MS)),
      absoluteExpiresAt: new Date(now + (remember ? ABSOLUTE_TTL_MS : SHORT_ABSOLUTE_TTL_MS)),
    },
  });
  return sess.id;
}

/**
 * Gera o header `Set-Cookie` da sessão conforme o "lembrar de mim".
 *
 * - `remember: true` → cookie persistente de 30 dias (igual ao teto absoluto).
 * - `remember: false` → cookie de sessão do navegador (sem `Max-Age`/`Expires`).
 *
 * @param {string} sid - Id da sessão retornado por `createSession`.
 * @param {boolean} remember - Se o usuário marcou "lembrar de mim".
 * @returns {Promise<string>} Valor do header `Set-Cookie`.
 * @example
 *   headers: { "Set-Cookie": await serializeSessionCookie(sid, true) }
 */
export function serializeSessionCookie(sid: string, remember: boolean): Promise<string> {
  return sessionCookie.serialize(
    sid,
    remember
      ? { maxAge: ABSOLUTE_TTL_MS / 1000 }
      : { maxAge: undefined, expires: undefined }
  );
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
export async function getUserFromRequest(
  request: Request,
  prismaClient?: PrismaClient
): Promise<SessionUser | null> {
  const p = prismaClient ?? prisma;
  const sid = await sessionCookie.parse(request.headers.get("Cookie"));
  if (typeof sid !== "string" || !sid) return null;

  const sess = await p.session.findUnique({
    where: { id: sid },
    include: { membro: { select: { id: true, nome: true, cargo: true } } },
  });
  if (!sess) return null;

  const now = Date.now();
  if (sess.absoluteExpiresAt.getTime() < now) {
    await p.session.delete({ where: { id: sid } }).catch(() => {});
    return null;
  }
  if (sess.expiresAt.getTime() < now) {
    const newExpires = Math.min(now + SLIDING_TTL_MS, sess.absoluteExpiresAt.getTime());
    await p.session.update({
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
export async function deleteSession(
  sid: string,
  prismaClient?: PrismaClient
): Promise<void> {
  if (!sid) return;
  const p = prismaClient ?? prisma;
  await p.session.delete({ where: { id: sid } }).catch(() => {});
}
