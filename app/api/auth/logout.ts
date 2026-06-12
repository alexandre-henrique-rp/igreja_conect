/**
 * POST /api/auth/logout (S00-T10).
 *
 * Invalida a sessão no servidor (delete Session) e limpa o cookie.
 * Resposta: 204 No Content + Set-Cookie __session=; Max-Age=0
 */
import type { ActionFunctionArgs } from "react-router";
import { sessionCookie, deleteSession } from "~/lib/session.server";
import { safeLog } from "~/lib/audit.server";

/**
 * @description Action de logout: deleta a sessão e limpa o cookie.
 * @param {ActionFunctionArgs} args - Request do React Router.
 * @returns {Response} 204 No Content + Set-Cookie expirando.
 */
export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Método não permitido", { status: 405 });
  }

  const sid = await sessionCookie.parse(request.headers.get("Cookie"));
  if (typeof sid === "string" && sid) {
    await deleteSession(sid);
    safeLog({ userId: "self", action: "logout", result: "ok", timestamp: Date.now() });
  }

  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": await sessionCookie.serialize("", { maxAge: 0 }) },
  });
}

/** GET não é permitido — só POST. */
export function loader(): Response {
  return new Response("Método não permitido", { status: 405 });
}
