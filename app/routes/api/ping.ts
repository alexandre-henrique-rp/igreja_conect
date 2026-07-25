import type { Route } from "./+types/ping";
import { data } from "react-router";

/**
 * GET /api/ping — health check simples para monitoramento.
 *
 * Retorna 200 sem exigir autenticação, para que ferramentas externas
 * possam verificar se a aplicação está respondendo.
 */
export async function loader({ request }: Route.LoaderArgs) {
  return data(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      url: request.url,
    },
    { status: 200 },
  );
}

export async function action() {
  return data({ error: "method_not_allowed" }, { status: 405 });
}
