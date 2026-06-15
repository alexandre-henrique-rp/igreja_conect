/**
 * Rota /app/config/acolhimento — Configuração de Acolhimento (S04-T06).
 *
 * **RN-MEM-05:** Apenas ADMIN pode alterar a configuração.
 * SECRETARIO e demais cargos podem VISUALIZAR mas NÃO editar.
 *
 * **Loader:** retorna config atual para qualquer autenticado.
 * ADMIN também recebe membros/ministérios para editar.
 *
 * @see app/lib/config.server.ts (getConfigAcolhimento, updateConfigAcolhimento)
 * @see app/lib/schemas/config.ts (ConfigAcolhimentoSchema)
 */
import type { Route } from "./+types/config.acolhimento";
import { ZodError } from "zod";
import { prisma } from "~/db/prisma.server";
import { userContext } from "~/lib/user-context";
import { getConfigAcolhimento, updateConfigAcolhimento } from "~/lib/config.server";
import { ConfigAcolhimentoSchema } from "~/lib/schemas/config";
import { assertIsAdmin } from "~/lib/rbac.server";
import { ConfigAcolhimentoCard, type ConfigAcolhimento } from "~/components/ConfigAcolhimentoCard";
import { FormConfigAcolhimento, type MembroCargo } from "~/components/FormConfigAcolhimento";
import { InfoBox } from "~/components/InfoBox";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Config. Acolhimento — Igreja Conect" }];
}

/**
 * Loader: retorna config + lista de membros (apenas com cargo) +
 * ministérios + flag canEdit (ADMIN=true).
 */
export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  const canEdit = user.cargo === "ADMIN";
  const [config, membros, ministerios] = await Promise.all([
    getConfigAcolhimento(),
    canEdit
      ? prisma.membro.findMany({
          where: { cargo: { not: null } },
          select: { id: true, nome: true, cargo: true },
          orderBy: { nome: "asc" },
        }).then((items) =>
          items.map(
            (item): MembroCargo => ({
              id: item.id,
              nome: item.nome,
              cargo: item.cargo ?? "",
            })
          )
        )
      : Promise.resolve([]),
    canEdit
      ? prisma.ministerio.findMany({
          select: { id: true, nome: true },
          orderBy: { nome: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return {
    config,
    canEdit,
    membros,
    ministerios,
  };
}

/**
 * Action: ADMIN salva configuração. Valida input com Zod,
 * chama updateConfigAcolhimento, redirect 302.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  assertIsAdmin(user);

  const formData = await request.formData();
  const raw: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") raw[key] = value;
  }

  try {
    const validated = ConfigAcolhimentoSchema.parse({
      responsavelVisitanteTipo: raw.responsavelVisitanteTipo ?? raw.tipoResponsavel,
      responsavelId: raw.responsavelId,
    });
    await updateConfigAcolhimento(validated, user);

    return new Response(null, {
      status: 302,
      headers: { Location: "/app/config/acolhimento" },
    });
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of e.issues) {
        const key = issue.path.length > 0 ? issue.path.join(".") : "formError";
        if (!fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      throw new Response(JSON.stringify({ fieldErrors }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw e;
  }
}

/**
 * Componente padrão: mostra card de configuração atual +
 * formulário de edição (se canEdit) ou mensagem "Apenas ADMIN".
 */
export default function ConfigAcolhimentoPage({
  loaderData,
}: Route.ComponentProps) {
  const { config, canEdit, membros, ministerios } = loaderData;

  const cardConfig = toCardConfig(config);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <ConfigAcolhimentoCard config={cardConfig} />
      {canEdit ? (
        <FormConfigAcolhimento
          canEdit
          config={cardConfig}
          membros={membros}
          ministerios={ministerios}
        />
      ) : (
        <InfoBox tone="warning" title="Acesso restrito">
          Apenas o Admin pode alterar
        </InfoBox>
      )}
    </div>
  );
}

type ConfigAcolhimentoLoaderItem = {
  responsavelVisitanteTipo: string | null;
  responsavelMembroId: string | null;
  responsavelMinisterioId: string | null;
  responsavelMembro?: { id: string; nome: string } | null;
  responsavelMinisterio?: { id: string; nome: string } | null;
};

/**
 * Converte config do loader para o formato do card/form.
 */
function toCardConfig(config: ConfigAcolhimentoLoaderItem | null): ConfigAcolhimento | undefined {
  if (!config?.responsavelVisitanteTipo) {
    return undefined;
  }

  const isMembro = config.responsavelVisitanteTipo === "MEMBRO";
  const responsavel = isMembro
    ? config.responsavelMembro
    : config.responsavelMinisterio;

  return {
    tipo: isMembro ? "MEMBRO" : "MINISTERIO",
    nome: responsavel?.nome ?? "Responsável não encontrado",
  };
}
