/**
 * Rota /app/membros/:id/discipulado — gerenciar vínculo de discipulado (S03-T06).
 *
 * **Loader:** `getDiscipuladoData(membroId, user)` — retorna
 * { membro, discipuladorAtual, discipulosDoDiscipulador, cadeia, discipuladoresDisponiveis }.
 *
 * **Action:** dispatch por `intent`:
 *  - `intent=assign` → `assignDisciple` (validação boundary 12, anti-loop, auto-vínculo)
 *  - `intent=unassign` → `unassignDisciple` (DELETE do vínculo)
 *
 * **Erros:** captura `BusinessRuleError` (400/409/422) e devolve
 * 422 com `{ formError }` no body (frontend exibe no painel).
 *
 * **RBAC:** `getDiscipuladoData` chama `getMembroById` que aplica
 * escopo — DISCIPULADOR acessando membro de outro → 404.
 *
 * @see app/lib/discipleship.server.ts
 * @see docs/REGRAS_DE_NEGOCIO.md (RN-MEM-04)
 */
import type { Route } from "./+types/membros.$id.discipulado";
import { ZodError } from "zod";
import { userContext } from "~/lib/user-context";
import {
  assignDisciple,
  unassignDisciple,
  getDiscipuladoData,
} from "~/lib/discipleship.server";
import { AssignDiscipleSchema } from "~/lib/schemas/discipulado";
import { BusinessRuleError, NotFoundError } from "~/lib/errors";

export function meta({ data }: Route.MetaArgs) {
  if (!data?.membro) {
    return [{ title: "Discipulado · Igreja Conect" }];
  }
  return [{ title: `Discipulado — ${data.membro.nome} · Igreja Conect` }];
}

/**
 * Loader: carrega dados do painel de discipulado.
 * `getDiscipuladoData` aplica escopo (DISCIPULADOR fora → 404).
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  const data = await getDiscipuladoData(params.id, user);
  return { ...data, canWrite: !!user.cargo };
}

/**
 * Action: processa intent=assign|unassign.
 *
 * **Assign:** valida `discipuladorId` com Zod, chama `assignDisciple`.
 *   Erros `BusinessRuleError` (boundary 12, auto-vínculo, loop) viram 422.
 *
 * **Unassign:** chama `unassignDisciple`. Sucesso → 302.
 *
 * Sucesso (assign ou unassign): 302 para `/app/membros/:id`.
 * Erro: 422 (BusinessRule, Zod), 404 (NotFound), 401 (sem auth).
 */
export async function action({ request, params, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "assign") {
    const raw = { discipuladorId: formData.get("discipuladorId") };
    let validated;
    try {
      validated = AssignDiscipleSchema.parse(raw);
    } catch (e) {
      if (e instanceof ZodError) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of e.issues) {
          const key = issue.path.length > 0 ? issue.path.join(".") : "discipuladorId";
          if (!fieldErrors[key]) fieldErrors[key] = issue.message;
        }
        throw new Response(JSON.stringify({ fieldErrors }), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw e;
    }

    try {
      await assignDisciple(validated.discipuladorId, params.id, user);
      return new Response(null, {
        status: 302,
        headers: { Location: `/app/membros/${params.id}/discipulado` },
      });
    } catch (e) {
      if (e instanceof BusinessRuleError) {
        throw new Response(
          JSON.stringify({ formError: e.message }),
          { status: 422, headers: { "Content-Type": "application/json" } }
        );
      }
      if (e instanceof NotFoundError) {
        throw new Response(
          JSON.stringify({ formError: e.message }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      throw e;
    }
  }

  if (intent === "unassign") {
    try {
      await unassignDisciple(params.id, user);
      return new Response(null, {
        status: 302,
        headers: { Location: `/app/membros/${params.id}/discipulado` },
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

  throw new Response(JSON.stringify({ formError: "Intent não reconhecido." }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}
