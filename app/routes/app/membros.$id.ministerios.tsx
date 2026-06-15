/**
 * Rota /app/membros/:id/ministerios — Gerenciar vínculos de ministério (S04-T12).
 *
 * **Loader:** dados do membro + ministérios atuais + disponíveis.
 * **Action:** POST com `intent=add` ou `intent=remove` + `ministerioId`.
 *
 * **RBAC:** ADMIN, PASTOR, SECRETARIO podem gerenciar (canEdit=true).
 * Demais cargos: apenas visualização (canEdit=false).
 *
 * @see app/lib/ministries.server.ts (addMembroToMinisterio, removeMembroFromMinisterio)
 * @see docs/REGRAS_DE_NEGOCIO.md (RN-MEM-04)
 */
import type { Route } from "./+types/membros.$id.ministerios";
import { prisma } from "~/db/prisma.server";
import { getMembroById } from "~/lib/members.server";
import { userContext } from "~/lib/user-context";
import {
  addMembroToMinisterio,
  removeMembroFromMinisterio,
  canManageMinisterios,
} from "~/lib/ministries.server";

/** Cargos que podem gerenciar ministérios. */
const CAN_MANAGE = ["ADMIN", "PASTOR", "SECRETARIO"] as const;

/** Valida UUID antes de tocar em actions. */
function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Ministérios do Membro — Igreja Conect" }];
}

/**
 * Loader: retorna membro + lista de ministérios atuais + disponíveis.
 *
 * @param args - Route loader args com params.id = membroId.
 * @returns Membro + ministeriosDoMembro + ministeriosDisponiveis + canEdit.
 * @throws 401 se não autenticado, 404 se membro não existe.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  const membro = await getMembroById(params.id, user);

  const canEdit =
    user.cargo != null &&
    (CAN_MANAGE as readonly string[]).includes(user.cargo);

  // IDs dos ministérios que o membro já está
  const vinculos = await prisma.ministerioMembro.findMany({
    where: { membroId: membro.id },
    select: { ministerioId: true },
  });
  const vinculoIds = new Set(vinculos.map((v) => v.ministerioId));

  const todosMinisterios = await prisma.ministerio.findMany({
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });

  return {
    membro,
    ministeriosDoMembro: todosMinisterios.filter((m) =>
      vinculoIds.has(m.id)
    ),
    ministeriosDisponiveis: todosMinisterios.filter(
      (m) => !vinculoIds.has(m.id)
    ),
    canEdit,
  };
}

/**
 * Action: POST para adicionar ou remover vínculo de ministério.
 *
 * - intent=add + ministerioId → addMembroToMinisterio
 * - intent=remove + ministerioId → removeMembroFromMinisterio
 *
 * @returns Redirect 302 para a mesma página.
 * @throws 401/403/400 conforme RBAC ou input inválido.
 */
export async function action({ params, request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  if (!canManageMinisterios(user)) {
    throw new Response("Sem permissão para gerenciar ministérios.", {
      status: 403,
    });
  }

  const formData = await request.formData();
  const intent = formData.get("intent") as string | null;
  const ministerioId = formData.get("ministerioId") as string | null;

  if (!ministerioId) {
    throw new Response("ministerioId é obrigatório.", { status: 400 });
  }

  if (!isValidUuid(ministerioId)) {
    throw new Response("ministerioId inválido.", { status: 400 });
  }

  if (intent === "add") {
    await addMembroToMinisterio(ministerioId, params.id, user);
  } else if (intent === "remove") {
    await removeMembroFromMinisterio(ministerioId, params.id, user);
  } else {
    throw new Response("Intent inválido. Use 'add' ou 'remove'.", {
      status: 400,
    });
  }

  return new Response(null, {
    status: 302,
    headers: { Location: `/app/membros/${params.id}/ministerios` },
  });
}

/**
 * Página de gerenciamento de ministérios do membro.
 */
export default function MembroMinisteriosPage({
  loaderData,
}: Route.ComponentProps) {
  const { membro, ministeriosDoMembro, ministeriosDisponiveis, canEdit } =
    loaderData;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-4">
        Ministérios — {membro?.nome ?? "Carregando..."}
      </h1>

      {/* Ministérios atuais */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">
          Ministérios do membro
        </h2>
        {ministeriosDoMembro.length === 0 ? (
          <p className="text-sm text-slate-500">
            Este membro não está em nenhum ministério.
          </p>
        ) : (
          <ul className="space-y-2">
            {ministeriosDoMembro.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg"
              >
                <span className="text-sm text-slate-800">{m.nome}</span>
                {canEdit && (
                  <form method="POST" className="inline">
                    <input type="hidden" name="intent" value="remove" />
                    <input type="hidden" name="ministerioId" value={m.id} />
                    <button
                      type="submit"
                      className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
                    >
                      Remover
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Ministérios disponíveis */}
      {canEdit && ministeriosDisponiveis.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">
            Adicionar a ministério
          </h2>
          <ul className="space-y-2">
            {ministeriosDisponiveis.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg"
              >
                <span className="text-sm text-slate-800">{m.nome}</span>
                <form method="POST" className="inline">
                  <input type="hidden" name="intent" value="add" />
                  <input type="hidden" name="ministerioId" value={m.id} />
                  <button
                    type="submit"
                    className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                  >
                    Adicionar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
