/**
 * Rota /logout (S01-T04).
 *
 * Server-side: invalida a sessão (deleta da tabela `sessions`) e
 * limpa o cookie `__session` (Set-Cookie Max-Age=0). Idempotente —
 * funciona sem cookie (sem sessão) também.
 *
 * **Por que rota em vez de action em /app**: o logout deve estar
 * acessível de qualquer ponto do app autenticado (topbar) e mesmo
 * do `/login` (caso o usuário queira garantir limpeza). Colocá-lo
 * como rota top-level em `/logout` é a convenção REST mais clara.
 *
 * **LGPD:** loga `{userId, action: "logout", result: "ok"}` apenas
 * quando havia cookie válido (não loga o sid puro — `safeLog` filtra
 * de qualquer forma, mas mantemos a forma consistente).
 */
import type { Route } from "./+types/logout";
import { redirect } from "react-router";
import { deleteSession, sessionCookie } from "~/lib/session.server";
import { safeLog, logAction } from "~/lib/audit.server";
import { getUserFromRequest } from "~/lib/session.server";

/**
 * Action: deleta a sessão do DB (se houver) e redireciona para /login
 * com `Set-Cookie: __session=; Max-Age=0` para limpar o cookie no browser.
 *
 * **Idempotente:** se não há cookie, ainda retorna 302 + Set-Cookie
 * expirando (não dá erro). O usuário sempre sai, mesmo se a sessão
 * já estava morta no servidor.
 */
export async function action({ request }: Route.ActionArgs): Promise<Response> {
  const sid = await sessionCookie.parse(request.headers.get("Cookie"));
  const user = await getUserFromRequest(request);
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (typeof sid === "string" && sid) {
    await deleteSession(sid);
    safeLog({
      action: "logout",
      result: "ok",
      resource: "session",
      timestamp: Date.now(),
    });
    await logAction({
      membroId: user?.id,
      event: "logout",
      actorId: user?.id,
      actorRole: user?.cargo,
      ip,
    });
  }

  return redirect("/login", {
    headers: {
      "Set-Cookie": await sessionCookie.serialize("", { maxAge: 0 }),
    },
  });
}

/**
 * Loader: redireciona para /login (logout deve ser POST).
 * Aceitar GET aqui facilita links diretos e bots, e ainda limpa o cookie.
 */
export async function loader({ request }: Route.LoaderArgs): Promise<Response> {
  return action({ request, params: {}, context: {} } as Route.ActionArgs);
}
