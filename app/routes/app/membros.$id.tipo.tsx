/**
 * Rota /app/membros/:id/tipo — endpoint dedicado de promoção (S03-T08, RN-MEM-06).
 *
 * **RN-MEM-06:** a promoção de tipo é SEMPRE via este endpoint
 * dedicado (não confundir com edição geral de `/app/membros/:id/editar`).
 * Garante que toda mudança de `Membro.tipo` passa por `promoverTipo`
 * (que loga auditoria) e nunca por um scanner/cron/auto-promove
 * (verificável por `grep setTimeout|setInterval|node-cron|bull app/`).
 *
 * **Sem UI:** esta rota é apenas um endpoint. A UI é o formulário
 * em `TabDadosPessoais` (S03-T07) ou em `membros.$id.editar.tsx`
 * (S02-T08) que submete `tipo=CONGREGADO`.
 *
 * **Action:** valida `tipo` com Zod enum, chama `promoverTipo`,
 * redireciona 302 para `/app/membros/:id`.
 *
 * @see app/lib/members.server.ts (promoverTipo)
 * @see docs/REGRAS_DE_NEGOCIO.md (RN-MEM-06)
 */
import type { Route } from "./+types/membros.$id.tipo";
import { ZodError } from "zod";
import { userContext } from "~/lib/user-context";
import { promoverTipo } from "~/lib/members.server";
import { NotFoundError } from "~/lib/errors";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Promover tipo · Igreja Conect" }];
}

/**
 * Loader: redirect 302 para a página do membro (rota é action-only).
 * Acessar via GET não tem UI — só o POST faz sentido.
 */
export function loader({ params }: Route.LoaderArgs) {
  return new Response(null, {
    status: 302,
    headers: { Location: `/app/membros/${params.id}` },
  });
}

/**
 * Action: processa POST com `tipo=CONGREGADO` etc.
 *
 * Sucesso: redirect 302 para `/app/membros/:id`.
 * Erro Zod: 422 com `{ fieldErrors: { tipo } }` em JSON.
 * Erro NotFound: 404 com mensagem.
 * Sem auth: 401.
 *
 * @param args - Action args do RR7.
 */
export async function action({ request, params, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  const formData = await request.formData();
  const tipoRaw = formData.get("tipo");
  if (typeof tipoRaw !== "string") {
    throw new Response(
      JSON.stringify({ fieldErrors: { tipo: "Tipo é obrigatório." } }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    await promoverTipo(
      params.id,
      tipoRaw as "VISITANTE" | "CONGREGADO" | "MEMBRO_ATIVO",
      user
    );
    return new Response(null, {
      status: 302,
      headers: { Location: `/app/membros/${params.id}` },
    });
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of e.issues) {
        // Para Zod enum (raiz), path é [] — usamos "tipo" como fallback.
        const key = issue.path.length > 0 ? issue.path.join(".") : "tipo";
        if (!fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      throw new Response(JSON.stringify({ fieldErrors }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (e instanceof NotFoundError) {
      throw new Response(
        JSON.stringify({ formError: "Membro não encontrado." }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }
    throw e;
  }
}
