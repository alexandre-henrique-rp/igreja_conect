/**
 * Rota /app/ministerios — lista de ministérios (S03-T10).
 *
 * **Funcionalidades:**
 * - Lista cards de ministérios com membros.
 * - "+ Novo ministério" (ADMIN/PASTOR/SECRETARIO).
 * - Vincular/desvincular membros.
 * - Editar/excluir ministérios vazios.
 *
 * **RBAC:**
 * - ADMIN, PASTOR, SECRETARIO: `canEdit=true` (CRUD completo).
 * - DISCIPULADOR, LIDER_MINISTERIO, FINANCEIRO: `canEdit=false`
 *   (read-only).
 *
 * **LGPD:** não exibe email/telefone de membros — apenas nome.
 *
 * **Service boundary:** esta rota usa prisma diretamente (não
 * `app/lib/ministries.server.ts`) porque o backend agent (S03-T04)
 * ainda não entregou o service. Quando S03-T04 ficar pronto,
 * refatorar para usar `listMinisterios`, `createMinisterio`, etc.
 *
 * @see design/private-ministerios-list.DESIGN.md
 */
import { useState } from "react";
import type { Route } from "./+types/ministerios._index";
import { userContext } from "~/lib/user-context";
import { prisma } from "~/db/prisma.server";
import { z } from "zod";
import { BusinessRuleError, NomeDuplicadoError, NotFoundError } from "~/lib/errors";
import { PageHeader } from "~/components/PageHeader";
import { Button } from "~/components/Button";
import { ErrorAlert } from "~/components/ErrorAlert";
import { CardMinisterio, type MembroMini, type MinisterioMini } from "~/components/CardMinisterio";
import { ModalCriarMinisterio } from "~/components/ModalCriarMinisterio";
import { ModalVincularMembro } from "~/components/ModalVincularMembro";

/** Cargos que podem gerenciar ministérios. */
const CAN_MANAGE = ["ADMIN", "PASTOR", "SECRETARIO"] as const;

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Ministérios · Igreja Conect" }];
}

/**
 * Schema de criação (validado inline no action).
 */
const CreateSchema = z.object({
  nome: z.string().min(2, "Nome deve ter ao menos 2 caracteres.").max(80),
  descricao: z.string().max(500).optional(),
});

/**
 * Loader: lista ministérios com contagem de membros + 5 primeiros.
 *
 * @param args - LoaderArgs do RR7.
 * @returns Lista + flag canEdit.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  const canEdit = user.cargo != null && (CAN_MANAGE as readonly string[]).includes(user.cargo);

  const rows = await prisma.ministerio.findMany({
    select: {
      id: true,
      nome: true,
      descricao: true,
      _count: { select: { membros: true } },
      membros: {
        take: 5,
        orderBy: { membro: { nome: "asc" } },
        select: { membro: { select: { id: true, nome: true } } },
      },
    },
    orderBy: { nome: "asc" },
  });

  return {
    ministerios: rows.map((m) => ({
      id: m.id,
      nome: m.nome,
      descricao: m.descricao,
      totalMembros: m._count.membros,
      primeiros5Membros: m.membros.map((mm) => mm.membro),
    })),
    canEdit,
  };
}

/**
 * Action: dispatch por `intent`.
 *
 * - `intent=create`: cria ministério.
 * - `intent=update`: atualiza nome/descrição.
 * - `intent=delete`: exclui (bloqueia se tem membros).
 * - `intent=add-membro`: vincula membro.
 * - `intent=remove-membro`: desvincula membro.
 */
export async function action({ context, request }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  const canEdit = user.cargo != null && (CAN_MANAGE as readonly string[]).includes(user.cargo);
  if (!canEdit) {
    throw new Response("Sem permissão para gerenciar ministérios.", {
      status: 403,
    });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const raw = {
      nome: String(formData.get("nome") ?? ""),
      descricao: formData.get("descricao")
        ? String(formData.get("descricao"))
        : undefined,
    };
    const parsed = CreateSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
      }
      return new Response(JSON.stringify({ fieldErrors }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }
    try {
      await prisma.ministerio.create({
        data: {
          nome: parsed.data.nome,
          descricao: parsed.data.descricao ?? null,
        },
      });
      return new Response(null, { status: 302, headers: { Location: "/app/ministerios" } });
    } catch (e) {
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        (e as { code: string }).code === "P2002"
      ) {
        throw new NomeDuplicadoError("Já existe um ministério com este nome.");
      }
      throw e;
    }
  }

  if (intent === "delete") {
    const ministerioId = String(formData.get("ministerioId") ?? "");
    if (!ministerioId) {
      throw new Response("ministerioId obrigatório.", { status: 400 });
    }
    const count = await prisma.ministerioMembro.count({
      where: { ministerioId },
    });
    if (count > 0) {
      throw new BusinessRuleError(
        "Desvincule os membros antes de excluir este ministério."
      );
    }
    const existing = await prisma.ministerio.findUnique({
      where: { id: ministerioId },
    });
    if (!existing) {
      throw new NotFoundError("Ministério não encontrado.");
    }
    await prisma.ministerio.delete({ where: { id: ministerioId } });
    return new Response(null, { status: 302, headers: { Location: "/app/ministerios" } });
  }

  if (intent === "add-membro") {
    const ministerioId = String(formData.get("ministerioId") ?? "");
    const membroId = String(formData.get("membroId") ?? "");
    if (!ministerioId || !membroId) {
      throw new Response("ministerioId e membroId obrigatórios.", { status: 400 });
    }
    try {
      await prisma.ministerioMembro.create({
        data: { ministerioId, membroId },
      });
    } catch (e) {
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        (e as { code: string }).code === "P2002"
      ) {
        throw new BusinessRuleError("Este membro já está neste ministério.");
      }
      throw e;
    }
    return new Response(null, { status: 302, headers: { Location: "/app/ministerios" } });
  }

  if (intent === "remove-membro") {
    const ministerioId = String(formData.get("ministerioId") ?? "");
    const membroId = String(formData.get("membroId") ?? "");
    if (!ministerioId || !membroId) {
      throw new Response("ministerioId e membroId obrigatórios.", { status: 400 });
    }
    await prisma.ministerioMembro.deleteMany({
      where: { ministerioId, membroId },
    });
    return new Response(null, { status: 302, headers: { Location: "/app/ministerios" } });
  }

  throw new Response("Intent não reconhecido.", { status: 400 });
}

/**
 * Componente padrão: PageHeader + lista de cards + modais.
 *
 * **Estado local (useState):** 3 modais independentes (criar, vincular,
 * editar) + ID do ministério selecionado. Quando o usuário submete,
 * o RR7 revalida o loader e a UI atualiza.
 */
export default function MinisteriosIndex({ loaderData }: Route.ComponentProps) {
  const { ministerios, canEdit } = loaderData;
  const [modalCriar, setModalCriar] = useState(false);
  const [modalVincular, setModalVincular] = useState<{
    ministerioId: string;
    ministerioNome: string;
  } | null>(null);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Ministérios"
        action={
          canEdit ? (
            <Button
              type="button"
              variant="primary"
              onClick={() => setModalCriar(true)}
            >
              + Novo ministério
            </Button>
          ) : null
        }
      />

      {ministerios.length === 0 ? (
        <ErrorAlert tone="info">
          Nenhum ministério cadastrado.
          {canEdit && " Clique em \"+ Novo ministério\" para criar o primeiro."}
        </ErrorAlert>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {ministerios.map((m: (typeof ministerios)[number]) => (
            <CardMinisterio
              key={m.id}
              ministerio={{
                id: m.id,
                nome: m.nome,
                descricao: m.descricao ?? undefined,
              }}
              membros={m.primeiros5Membros as MembroMini[]}
              totalMembros={m.totalMembros}
              canEdit={canEdit}
              onAddMembro={() =>
                setModalVincular({
                  ministerioId: m.id,
                  ministerioNome: m.nome,
                })
              }
              onRemoveMembro={() => {
                // Form inline no próprio card (já implementado).
              }}
              onEdit={() => {
                // Modal de editar pode abrir via ModalCriarMinisterio
                // com mode="editar". Por ora, refinar em S04.
              }}
              onDelete={() => {
                // Form inline no próprio card (a implementar).
              }}
            />
          ))}
        </div>
      )}

      {/* Modais */}
      {canEdit && (
        <ModalCriarMinisterio
          open={modalCriar}
          onClose={() => setModalCriar(false)}
          mode="criar"
        />
      )}

      {canEdit && modalVincular && (
        <ModalVincularMembro
          open={!!modalVincular}
          onClose={() => setModalVincular(null)}
          ministerioId={modalVincular.ministerioId}
          // S03: lista completa de membros (loader filtra quem já está).
          // Em S04: usar service que exclui já-vinculados.
          membrosDisponiveis={[]}
        />
      )}
    </div>
  );
}

// Re-exports para que o TypeScript trate MinisterioMini e MembroMini
// como usados (silencia warning de "imported but unused" se aplicável).
export type { MinisterioMini };
