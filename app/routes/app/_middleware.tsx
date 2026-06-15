/**
 * Middleware de autenticação para /app/** (S01-T05).
 *
 * **Aplicado em:** todas as rotas filhas de `routes/app/**` (configurado
 * em `app/routes.ts` como `layout("routes/app/_middleware.tsx", [...])`).
 *
 * **Comportamento:**
 * 1. Lê o cookie `__session` e busca o usuário via `getUserFromRequest`.
 * 2. Se não há usuário válido (anônimo OU sessão expirada/inválida):
 *    `throw redirect("/login?next=" + encodeURIComponent(pathname+search))`.
 * 3. Se autenticado: `context.set(userContext, user)`, chama `next()`.
 *
 * **Filhos leem o user de `context.get(userContext)`** (substitui o antigo
 * `context.user` de RR6 — agora usa `createContext` type-safe).
 *
 * **Por que middleware e não em cada loader:**
 * 1. DRY — todas as rotas filhas ganham auth sem repetir `getUserFromRequest`.
 * 2. Defense in depth — uma única fonte de verdade: se o cookie for inválido,
 *    o request nunca chega no loader da rota filha.
 *
 * @see .harness/RAG/security-rbac-matrix.md (3 camadas: UI/loader/service)
 */
import {
  Outlet,
  redirect,
  type MiddlewareFunction,
} from "react-router";
import { getUserFromRequest } from "~/lib/session.server";
import { userContext } from "~/lib/user-context";

// Re-exportado para que filhos (`app/routes/app/*.tsx`) e testes possam
// importar `userContext` deste arquivo. A IMPLEMENTAÇÃO vive em
// `~/lib/user-context` (arquivo sem `.server` para tree-shaking correto
// no client bundle). O RR7 não reclama deste re-export porque ele
// é apenas um símbolo de tipo/context — não tem dependência de runtime.
export { userContext };

/**
 * Middleware de auth aplicado em todas as rotas filhas.
 *
 * Resolve o usuário do cookie. Se ausente/expirado → `throw redirect("/login?next=...")`.
 * Se presente → seta o context, chama `next()`.
 *
 * @param args - DataFunctionArgs do RR7 (request, params, context).
 * @param next - Função que executa os handlers filhos (loaders/actions).
 * @returns Response do `next()` (geralmente).
 * @throws {Response} 302 redirect para `/login` quando anônimo.
 */
const authMiddleware: MiddlewareFunction = async (
  { request, context },
  next
) => {
  const user = await getUserFromRequest(request);
  if (!user) {
    const url = new URL(request.url);
    // pathname + search para preservar a URL completa no redirect
    const next_param = url.pathname + url.search;
    throw redirect(`/login?next=${encodeURIComponent(next_param)}`);
  }

  context.set(userContext, user);
  return next();
};

/**
 * Array de middlewares exportado para RR7 (v8_middleware) aplicar.
 * Cada filho da rota `layout("routes/app/_middleware.tsx", [...])` herda
 * este middleware automaticamente.
 */
export const middleware = [authMiddleware];

/**
 * Componente raiz do layout /app. Renderiza o `<Outlet />` para os
 * filhos. (TopbarAutenticada e layout de UI entram em S04.)
 */
export default function AppLayout() {
  return <Outlet />;
}
