/**
 * Rota /app/membros/:id/editar — editar membro (S02-T08).
 *
 * **Loader:** `getMembroById` (escopo aplicado). Mapeia o membro
 * para `defaultValues` consumidos pelo `<FormMembro isEdit={true} />`
 * do frontend S02-T05.
 *
 * **Action:** valida payload com `MembroUpdateSchema`, chama
 * `updateMembro` do service, redireciona 302 para `/app/membros/:id`.
 *
 * **RBAC:** `getMembroById` já aplica escopo (DISCIPULADOR fora de
 * escopo → 404, não 403). `updateMembro` chama `assertCanWriteMembers`
 * internamente (camada 3).
 *
 * @see docs/REGRAS_DE_NEGOCIO.md (RN-MEM-01)
 */
import type { Route } from "./+types/membros.$id.editar";
import { ZodError } from "zod";
import { userContext } from "~/lib/user-context";
import { MembroUpdateSchema } from "~/lib/schemas/membros";
import { getMembroById, updateMembro } from "~/lib/members.server";
import { EmailDuplicadoError } from "~/lib/errors";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Editar membro · Igreja Conect" }];
}

/**
 * Loader: busca o membro e mapeia para `defaultValues` do form.
 *
 * `getMembroById` lança `NotFoundError` (404) se o membro não existe
 * OU se DISCIPULADOR tenta acessar membro fora de escopo.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  const membro = await getMembroById(params.id, user);

  // Mapeia para defaultValues: datas em ISO, campos opcionais vazios → ""
  const defaultValues = {
    nome: membro.nome,
    tipo: membro.tipo,
    email: membro.email ?? "",
    telefone: membro.telefone ?? "",
    profissao: membro.profissao ?? "",
    estadoCivil: membro.estadoCivil ?? "",
    dataConversao: membro.dataConversao
      ? membro.dataConversao.toISOString().slice(0, 10)
      : "",
    dataBatismo: membro.dataBatismo
      ? membro.dataBatismo.toISOString().slice(0, 10)
      : "",
    logradouro: membro.logradouro ?? "",
    numero: membro.numero ?? "",
    bairro: membro.bairro ?? "",
    cidade: membro.cidade ?? "",
    estado: membro.estado ?? "",
    cep: membro.cep ?? "",
  };

  return { membro, defaultValues };
}

/**
 * Action: processa POST do form de edição.
 *
 * @param args - DataFunctionArgs do RR7 (params.id vem do path).
 * @returns Response 302 (sucesso) ou lança Response 422/403/404.
 */
export async function action({ request, params, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  const formData = await request.formData();
  const raw: Record<string, string> = {};
  for (const [k, v] of formData) {
    if (typeof v === "string") raw[k] = v;
  }

  let validated;
  try {
    validated = MembroUpdateSchema.parse(raw);
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
        { status: 422, headers: { "Content-Type": "application/json" } }
      );
    }
    throw e;
  }

  try {
    await updateMembro(params.id, validated, user);
    return new Response(null, {
      status: 302,
      headers: { Location: `/app/membros/${params.id}` },
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

/**
 * Componente placeholder. Frontend S02-T05 substitui por
 * `<FormMembro isEdit={true} defaultValues={loaderData.defaultValues} />`.
 */
export default function MembrosEditar({ loaderData }: Route.ComponentProps) {
  return (
    <main id="main-content" className="p-4 container mx-auto">
      <h1 className="text-2xl font-bold">Editar membro</h1>
      <p className="text-slate-600 mt-2">
        Placeholder — UI do form virá em S02-T05.
      </p>
      <pre className="mt-4 text-xs text-slate-500">
        {JSON.stringify(loaderData, null, 2)}
      </pre>
    </main>
  );
}
