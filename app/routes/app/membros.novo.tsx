/**
 * Rota /app/membros/novo — criar novo membro (S02-T06).
 *
 * **Loader:** trivial (retorna `null` para o form renderizar vazio).
 *
 * **Action:** valida payload com `MembroCreateSchema`, chama
 * `createMembro` do service, redireciona 302 para `/app/membros/:id`.
 *
 * **Tratamento de erros:**
 *  - ZodError → 422 com `{ fieldErrors, defaultValues }` em JSON.
 *  - `EmailDuplicadoError` → 422 com `fieldError.email` em PT-BR.
 *  - `assertCanWriteMembers` (camada 3) → Response 403 do rbac.server.
 *
 * **S04 (cross-module):** o `createMembro` será estendido com
 * `$transaction` para gerar alerta atômico quando tipo=VISITANTE.
 * Esta sprint S02 entrega só o caso base.
 *
 * @see docs/REGRAS_DE_NEGOCIO.md (RN-MEM-01, RN-MEM-02)
 */
import type { Route } from "./+types/membros.novo";
import { ZodError } from "zod";
import { userContext } from "~/lib/user-context";
import { MembroCreateSchema } from "~/lib/schemas/membros";
import { createMembro } from "~/lib/members.server";
import { EmailDuplicadoError } from "~/lib/errors";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Cadastrar novo membro · Igreja Conect" }];
}

/**
 * Loader: retorna null (form renderiza vazio). assertCanWriteMembers
 * é executado dentro de `createMembro` no action (camada 3).
 */
export async function loader(_args: Route.LoaderArgs) {
  return null;
}

/**
 * Action: processa POST do form de criação.
 *
 * **Por que 422 (não 400):** é o padrão do `BusinessRuleError` da casa
 * (errors.ts) e mantém consistência com outros forms do projeto.
 *
 * @param args - DataFunctionArgs do RR7.
 * @returns Response 302 (sucesso) ou lança Response 422/403.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) {
    // Defense in depth — middleware já garante auth.
    throw new Response("Não autenticado.", { status: 401 });
  }

  const formData = await request.formData();
  const raw: Record<string, string> = {};
  for (const [k, v] of formData) {
    if (typeof v === "string") raw[k] = v;
  }

  let validated;
  try {
    validated = MembroCreateSchema.parse(raw);
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of e.issues) {
        const path = issue.path.join(".");
        if (path && !fieldErrors[path]) {
          fieldErrors[path] = issue.message;
        }
      }
      throw new Response(
        JSON.stringify({ fieldErrors, defaultValues: raw }),
        {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    throw e;
  }

  try {
    const created = await createMembro(validated, user);
    return new Response(null, {
      status: 302,
      headers: { Location: `/app/membros/${created.id}` },
    });
  } catch (e) {
    if (e instanceof EmailDuplicadoError) {
      throw new Response(
        JSON.stringify({
          fieldErrors: { email: e.message },
          defaultValues: raw,
        }),
        { status: 422, headers: { "Content-Type": "application/json" } }
      );
    }
    throw e;
  }
}

import { FormMembro } from "~/components/FormMembro";

export default function MembrosNovo({ actionData }: Route.ComponentProps) {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <FormMembro
        isEdit={false}
        formError={actionData?.formError}
        fieldErrors={actionData?.fieldErrors}
      />
    </div>
  );
}
