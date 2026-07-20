/**
 * Rota /app/alertas — Central de Alertas (S04-T08).
 *
 * **Loader:** lista alertas onde o usuário autenticado é destinatário.
 * **Action:** marcarLido (qualquer destinatário), marcarResolvido (ADMIN).
 *
 * @see app/lib/alerts.server.ts (marcarLido, marcarResolvido)
 * @see app/lib/schemas/alertas.ts (MarcarLidoSchema, MarcarResolvidoSchema)
 */
import { ZodError } from "zod";
import { CardAlerta } from "~/components/CardAlerta";
import { TabsFiltroAlertas } from "~/components/TabsFiltroAlertas";
import { userContext } from "~/lib/user-context";
import { listAlertas, marcarLido, marcarResolvido } from "~/lib/alerts.server";
import { assertIsAdmin } from "~/lib/rbac.server";
import type { SessionUser } from "~/lib/session.types";
import {
  MarcarLidoSchema,
  MarcarResolvidoSchema,
} from "~/lib/schemas/alertas";

/** Filtro usado na URL e nos componentes frontend. */
export type AlertaFilterFrontend = "todos" | "naoLidos" | "resolvidos";

type AlertaFilterBackend = Parameters<typeof listAlertas>[1];
type RouteLoaderArgs = {
  request: Request;
  context: { get: <T>(key: unknown) => T };
};

type RouteActionArgs = RouteLoaderArgs;

/** Dados carregados pela rota de Alertas. */
export type AlertasLoaderData = {
  items: Array<Awaited<ReturnType<typeof listAlertas>>["items"][number]>;
  counts: AlertaCountsFrontend;
  activeFilter: AlertaFilterFrontend;
  canResolve: boolean;
};
/** Counts exibidos nas abas. */
export type AlertaCountsFrontend = {
  todos: number;
  naoLidos: number;
  resolvidos: number;
};

export function meta() {
  return [{ title: "Alertas — Igreja Conect" }];
}

/**
 * Loader: lista alertas por destinatário e lê ?filter=.
 */
export async function loader({ request, context }: RouteLoaderArgs): Promise<AlertasLoaderData> {
  const user = context.get<SessionUser | null>(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  const url = new URL(request.url);
  const activeFilter = normalizeAlertaFilter(url.searchParams.get("filter"));
  const { items, counts } = await listAlertas(user, toBackendFilter(activeFilter));

  return {
    items,
    counts: {
      todos: counts.total,
      naoLidos: counts.naoLidos,
      resolvidos: counts.resolvidos,
    },
    activeFilter,
    canResolve: user.cargo === "ADMIN",
  };
}

/**
 * Action: processa marcarLido e marcarResolvido.
 */
export async function action({ request, context }: RouteActionArgs) {
  const user = context.get<SessionUser | null>(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  const formData = await request.formData();
  const actionType = formData.get("_action") as string | null;

  try {
    if (actionType === "marcarLido") {
      const { alertaId } = MarcarLidoSchema.parse(formDataToRecord(formData));
      await marcarLido(alertaId, user);
    } else if (actionType === "marcarResolvido") {
      assertIsAdmin(user);
      const { alertaId } = MarcarResolvidoSchema.parse(formDataToRecord(formData));
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
export default function AlertasPage({ loaderData }: { loaderData: AlertasLoaderData }) {
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

function formDataToRecord(formData: FormData): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key !== "_action" && typeof value === "string") {
      raw[key] = value;
    }
  }
  return raw;
}

/** Normaliza filtro da query para o formato frontend. */
function normalizeAlertaFilter(value: string | null): AlertaFilterFrontend {
  if (value === "nao_lidos") return "naoLidos";
  if (value === "todos" || value === "naoLidos" || value === "resolvidos") {
    return value;
  }
  return "todos";
}

function toBackendFilter(filter: AlertaFilterFrontend): AlertaFilterBackend {
  return filter === "naoLidos" ? "nao_lidos" : filter;
}

/** Texto de empty state contextual por filtro. */
function emptyAlertaMessage(filter: AlertaFilterFrontend) {
  if (filter === "naoLidos") return "Nenhum alerta não lido.";
  if (filter === "resolvidos") return "Nenhum alerta resolvido.";
  return "Nenhum alerta encontrado.";
}
