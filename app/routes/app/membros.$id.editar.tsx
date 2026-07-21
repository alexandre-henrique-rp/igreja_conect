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
import { data } from "react-router";
import { ZodError } from "zod";
import { userContext } from "~/lib/user-context";
import { MembroUpdateSchema, cleanFormData } from "~/lib/schemas/membros";
import {
  getMembroAvatarSignedUrl,
  getMembroById,
  updateMembro,
} from "~/lib/members.server";
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
    cargo: membro.cargo ?? "",
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
    dataNascimento: membro.dataNascimento
      ? membro.dataNascimento.toISOString().slice(0, 10)
      : "",
    sexo: membro.sexo ?? "",
    status: membro.status ?? "",
    grupo: membro.grupo ?? "",
    discipuladorNome: membro.discipuladorNome ?? "",
    complemento: membro.complemento ?? "",
    logradouro: membro.logradouro ?? "",
    numero: membro.numero ?? "",
    bairro: membro.bairro ?? "",
    cidade: membro.cidade ?? "",
    estado: membro.estado ?? "",
    cep: membro.cep ?? "",
    createdAt: membro.createdAt,
    updatedAt: membro.updatedAt,
  };

  // Avatar (URL signed pra preview no FormMembro)
  const avatarSigned = await getMembroAvatarSignedUrl(membro);

  return { membro, defaultValues, avatarSigned };
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
  // Campos de UI que não pertencem ao schema Zod (.strict() rejeita keys desconhecidas)
  const UI_ONLY_FIELDS = new Set(["temAcesso"]);
  for (const [k, v] of formData) {
    if (typeof v === "string" && !k.endsWith("_dummy") && !UI_ONLY_FIELDS.has(k)) raw[k] = v;
  }

  const cleaned = cleanFormData(raw);

  let validated;
  try {
    validated = MembroUpdateSchema.parse(cleaned);
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of e.issues) {
        const path = issue.path.join(".");
        if (path && !fieldErrors[path]) {
          fieldErrors[path] = issue.message;
        }
      }
      return data(
        { fieldErrors, defaultValues: raw },
        { status: 422 }
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
      return data(
        { fieldErrors: { email: e.message }, defaultValues: raw },
        { status: 422 }
      );
    }
    throw e;
  }
}

import { FormMembro } from "~/components/FormMembro";

export default function MembrosEditar({ loaderData, actionData }: Route.ComponentProps) {
  const typedActionData = actionData as { formError?: string; fieldErrors?: Record<string, string[]> } | undefined;
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* `key` força remount quando o usuário navega de /membros/A/editar
          para /membros/B/editar. Sem ele, o FormMembro reusa o estado
          controlado (telefone, cep, cargo, temAcesso) do membro anterior
          porque useState só lê o initial value uma vez. */}
      <FormMembro
        key={loaderData.membro.id}
        isEdit={true}
        defaultValues={{
          ...loaderData.defaultValues,
          id: loaderData.membro.id,
          avatarUploadId: loaderData.avatarSigned?.uploadId ?? null,
          avatarUrl: loaderData.avatarSigned?.url || null,
          avatarStatus: loaderData.avatarSigned?.status ?? null,
        }}
        formError={typedActionData?.formError}
        fieldErrors={typedActionData?.fieldErrors}
      />
    </div>
  );
}
