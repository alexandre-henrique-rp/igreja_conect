/**
 * Rota /app/membros/:id/discipulador — endpoint dedicado DELETE de discípulo (S03-T13).
 *
 * **SPEC §10:** `DELETE /app/membros/:id/discipulador` — remove o
 * vínculo de discipulado do membro (seta `discipuladorId = null`).
 *
 * **Diferença vs `POST /app/membros/:id/discipulado` (S03-T06):**
 *  - S03-T06 (POST) — atribui um novo discipulador (com validação de
 *    boundary 12, anti-loop, auto-vínculo).
 *  - S03-T13 (DELETE) — desvincula (sempre OK, sem regras).
 *
 * **HTTP method:** esta rota aceita POST com `intent=unassign` (mais
 * simples para `<Form method=post>` do React Router) OU DELETE
 * (semanticamente correto). S03-T06 também faz unassign por intent;
 * esta rota é dedicada a DELETE-only.
 *
 * @see app/lib/discipleship.server.ts (unassignDisciple)
 * @see SPEC §10
 */
import type { Route } from "./+types/membros.$id.discipulador";
import { userContext } from "~/lib/user-context";
import { unassignDisciple } from "~/lib/discipleship.server";
import { NotFoundError } from "~/lib/errors";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Desvincular discipulador · Igreja Conect" }];
}

/**
 * Loader: redirect 302 para a página do membro (rota é action-only).
 */
export function loader({ params }: Route.LoaderArgs) {
  return new Response(null, {
    status: 302,
    headers: { Location: `/app/membros/${params.id}` },
  });
}

/**
 * Action: processa POST/DELETE para desvincular.
 *
 * Sucesso: redirect 302 para `/app/membros/:id`.
 * Erro: 404 (membro não existe), 401 (sem auth).
 *
 * @param args - Action args do RR7.
 */
export async function action({ params, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  try {
    await unassignDisciple(params.id, user);
    return new Response(null, {
      status: 302,
      headers: { Location: `/app/membros/${params.id}` },
    });
  } catch (e) {
    if (e instanceof NotFoundError) {
      throw new Response(
        JSON.stringify({ formError: "Membro não encontrado." }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }
    throw e;
  }
}
