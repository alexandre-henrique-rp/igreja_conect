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
    <main id="main-content" className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 bg-slate-50 min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <nav className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-2">
            <span>Configurações</span>
            <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-blue-600">Acolhimento</span>
          </nav>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight font-headline">Configurações</h2>
          <p className="text-slate-500 text-sm mt-1">Gerencie as regras de negócio e parâmetros globais do sistema.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Settings Categories Sidebar */}
        <aside className="lg:col-span-1 space-y-2">
          <button
            type="button"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold bg-blue-50 text-blue-750 border border-blue-100 text-left transition-all cursor-pointer"
          >
            <svg className="w-5 h-5 shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Acolhimento
          </button>
          
          <button
            type="button"
            disabled
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-400 text-left opacity-60 cursor-not-allowed"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Notificações
          </button>
          
          <button
            type="button"
            disabled
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-400 text-left opacity-60 cursor-not-allowed"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Segurança
          </button>
        </aside>

        {/* Content Pane */}
        <section className="lg:col-span-3 space-y-6">
          <ConfigAcolhimentoCard config={cardConfig} />
          <FormConfigAcolhimento
            canEdit={canEdit}
            config={cardConfig}
            membros={membros}
            ministerios={ministerios}
          />
        </section>
      </div>
    </main>
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
    id: responsavel?.id,
  };
}
