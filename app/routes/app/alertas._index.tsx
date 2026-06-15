/**
 * Rota /app/alertas — Central de Alertas (S04-T08).
 *
 * **Loader:** lista alertas onde o usuário autenticado é destinatário.
 * **Action:** marcarLido (qualquer destinatário), marcarResolvido (ADMIN).
 *
 * @see app/lib/alerts.server.ts (marcarLido, marcarResolvido)
 * @see app/lib/schemas/alertas.ts (MarcarLidoSchema, MarcarResolvidoSchema)
 */
import type { Route } from "./+types/alertas._index";
import { ZodError } from "zod";
import type { Prisma } from "../../../generated/prisma/client";
import { CardAlerta } from "~/components/CardAlerta";
import { TabsFiltroAlertas } from "~/components/TabsFiltroAlertas";
import { prisma } from "~/db/prisma.server";
import { userContext } from "~/lib/user-context";
import { marcarLido, marcarResolvido } from "~/lib/alerts.server";
import {
  MarcarLidoSchema,
  MarcarResolvidoSchema,
} from "~/lib/schemas/alertas";

/** Filtro usado na URL e nos componentes frontend. */
export type AlertaFilterFrontend = "todos" | "naoLidos" | "resolvidos";

/** Filtro usado internamente no Prisma. */
type AlertaFilterBackend = "todos" | "nao_lidos" | "resolvidos";

/** Counts exibidos nas abas. */
export type AlertaCountsFrontend = {
  todos: number;
  naoLidos: number;
  resolvidos: number;
};

const FILTER_QUERY_TO_BACKEND: Record<string, AlertaFilterBackend> = {
  todos: "todos",
  naoLidos: "nao_lidos",
  nao_lidos: "nao_lidos",
  resolvidos: "resolvidos",
};

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Alertas — Igreja Conect" }];
}

/**
 * Loader: lista alertas por destinatário e lê ?filter=.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  const url = new URL(request.url);
  const activeFilter = normalizeAlertaFilter(url.searchParams.get("filter"));
  const where = alertaWhere(user, activeFilter);

  const [items, total, naoLidos, resolvidos] = await Promise.all([
    prisma.alerta.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        titulo: true,
        mensagem: true,
        createdAt: true,
        membroId: true,
        destinatarios: {
          where: { membroId: user.id },
          select: { lido: true, resolvido: true },
        },
      },
    }),
    prisma.alerta.count({ where: baseAlertaWhere(user) }),
    prisma.alerta.count({
      where: { destinatarios: { some: { membroId: user.id, lido: false } } },
    }),
    prisma.alerta.count({
      where: {
        destinatarios: { some: { membroId: user.id, resolvido: true } },
      },
    }),
  ]);

  return {
    items: items.map(toAlertaItem),
    counts: { todos: total, naoLidos, resolvidos },
    activeFilter,
    canResolve: user.cargo === "ADMIN",
  };
}

/**
 * Action: processa marcarLido e marcarResolvido.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  const formData = await request.formData();
  const actionType = formData.get("_action") as string | null;

  try {
    if (actionType === "marcarLido") {
      const raw: Record<string, string> = {};
      for (const [k, v] of formData.entries()) {
        if (k !== "_action" && typeof v === "string") raw[k] = v;
      }
      const { alertaId } = MarcarLidoSchema.parse(raw);
      await marcarLido(alertaId, user);
    } else if (actionType === "marcarResolvido") {
      const { assertIsAdmin } = await import("~/lib/rbac.server");
      assertIsAdmin(user);
      const raw: Record<string, string> = {};
      for (const [k, v] of formData.entries()) {
        if (k !== "_action" && typeof v === "string") raw[k] = v;
      }
      const { alertaId } = MarcarResolvidoSchema.parse(raw);
      await marcarResolvido(alertaId, user);
    } else {
      throw new Response(JSON.stringify({ error: "Ação inválida" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: `/app/alertas?filter=${normalizeAlertaFilter(
          new URL(request.url).searchParams.get("filter")
        )}`,
      },
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
 * Página de alertas com abas, cards e actions compatíveis com _action.
 */
export default function AlertasPage({ loaderData }: Route.ComponentProps) {
  const { items, counts, activeFilter, canResolve } = loaderData;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Alertas</h1>
      <TabsFiltroAlertas activeFilter={activeFilter} counts={counts} />

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyAlertaMessage(activeFilter)}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((alerta) => (
            <li key={alerta.id}>
              <CardAlerta
                alerta={{
                  id: alerta.id,
                  titulo: alerta.titulo,
                  mensagem: alerta.mensagem,
                  createdAt: new Date(alerta.createdAt),
                  lido: alerta.lido,
                  resolvido: alerta.resolvido,
                  membroId: alerta.membroId ?? undefined,
                }}
                canResolve={canResolve}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Normaliza filtro da query para o formato frontend. */
function normalizeAlertaFilter(value: string | null): AlertaFilterFrontend {
  const backendFilter = FILTER_QUERY_TO_BACKEND[value ?? "todos"] ?? "todos";
  return backendFilter === "nao_lidos" ? "naoLidos" : backendFilter;
}

/** Where base: usuário vê apenas alertas onde é destinatário. */
function baseAlertaWhere(user: { id: string }): Prisma.AlertaWhereInput {
  return { destinatarios: { some: { membroId: user.id } } };
}

/** Where por filtro de aba. */
function alertaWhere(
  user: { id: string },
  filter: AlertaFilterFrontend
): Prisma.AlertaWhereInput {
  if (filter === "naoLidos") {
    return { destinatarios: { some: { membroId: user.id, lido: false } } };
  }
  if (filter === "resolvidos") {
    return { destinatarios: { some: { membroId: user.id, resolvido: true } } };
  }
  return baseAlertaWhere(user);
}

/** Converte linha Prisma para item do CardAlerta.
 *
 * O estado `lido`/`resolvido` vem do **AlertaDestinatario** (escopo por
 * destinatário), não do Alerta global. O Alerta global tem `lido`/`resolvido`
 * redundantes do schema, mas o estado de leitura é por destinatário (RN §3.2).
 */
function toAlertaItem(alerta: {
  id: string;
  titulo: string;
  mensagem: string;
  createdAt: Date;
  membroId: string | null;
  destinatarios: Array<{ lido: boolean; resolvido: boolean }>;
}) {
  const destinatario = alerta.destinatarios[0];
  return {
    id: alerta.id,
    titulo: alerta.titulo,
    mensagem: alerta.mensagem,
    lido: destinatario?.lido ?? false,
    resolvido: destinatario?.resolvido ?? false,
    createdAt: alerta.createdAt,
    membroId: alerta.membroId ?? undefined,
  };
}

/** Texto de empty state contextual por filtro. */
function emptyAlertaMessage(filter: AlertaFilterFrontend) {
  if (filter === "naoLidos") return "Nenhum alerta não lido.";
  if (filter === "resolvidos") return "Nenhum alerta resolvido.";
  return "Nenhum alerta encontrado.";
}
