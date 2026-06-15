/**
 * Context type-safe do usuário autenticado (RR7).
 *
 * **Por que este arquivo é separado:** `userContext` é importado por
 * loaders E pelo componente de layout de `_middleware.tsx`. Quando RR7
 * faz tree-shaking do bundle do cliente, ele precisa saber que o tipo
 * `SessionUser` não tem dependência de runtime server-only. Manter
 * `userContext` em arquivo sem `.server` suffix garante que ele pode
 * ser importado de arquivos que vão para o client sem quebrar o build.
 *
 * **Filhos consomem via:**
 * ```ts
 * import { userContext } from "~/lib/user-context";
 *
 * export async function loader({ context }: Route.LoaderArgs) {
 *   const user = context.get(userContext);
 *   if (!user) throw new Response("...", { status: 401 }); // defense in depth
 * }
 * ```
 */
import { createContext } from "react-router";
import type { SessionUser } from "~/lib/session.types";

export const userContext = createContext<SessionUser | null>(null);
