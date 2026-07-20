/**
 * Layout raiz das rotas autenticadas (`/app/**`) (S02-T09).
 *
 * **Aplicado em:** todas as rotas filhas de `routes/app/**` (configurado
 * em `app/routes.ts` como `layout("routes/app.tsx", [...])`).
 *
 * **Hierarquia visual (todas as rotas autenticadas):**
 * 1. `<TopbarAutenticada />` — logo, badge de alertas, avatar.
 * 2. `<Sidebar />` — 5 itens do menu (Dashboard, Membros, Ministérios, Alertas, Configurações) + botão Sair.
 * 3. `<main id="main-content">` — área da rota filha (`<Outlet />`).
 *
 * **Loader:** busca o user (já injetado pelo `_middleware`) + contagem
 * de alertas não lidos (`alertasNaoLidos`). Ambos são passados via
 * `loaderData` para os componentes filhos.
 *
 * **Por que este layout existe:** S01 só tinha `<Outlet />` (esqueleto).
 * S02 traz a UI real do shell. S04 vai sofisticar (drawer mobile, busca
 * global, etc).
 *
 * @see app/routes/app/_middleware.tsx para o middleware de auth
 * @see design/PRODUCT.md §2.2
 */
import { Outlet, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { prisma } from "~/db/prisma.server";
import { userContext } from "~/lib/user-context";
import { Sidebar } from "~/components/Sidebar";
import { TopbarAutenticada } from "~/components/TopbarAutenticada";
import type { SessionUser } from "~/lib/session.types";

/**
 * Loader do layout autenticado.
 *
 * 1. Lê o user injetado pelo `_middleware` (defense in depth: 401 se null).
 * 2. Conta alertas não lidos do membro (tabela `alerta_destinatarios`).
 *    - `0` é o normal; UI esconde o badge se for 0.
 * 3. Retorna `{ user, alertasNaoLidos }` para o componente.
 *
 * @param args - LoaderFunctionArgs do RR7 (context, request).
 * @returns `{ user, alertasNaoLidos }`.
 */
export async function loader({ context }: LoaderFunctionArgs) {
  const user = context.get(userContext);
  if (!user) {
    // Defense in depth — não deve acontecer se o _middleware está aplicado.
    throw new Response("Não autenticado.", { status: 401 });
  }

  // Contagem de alertas não lidos (sprint S02 não cria alertas — sempre
  // 0 por enquanto; o helper já funciona para S04).
  const alertasNaoLidos = await prisma.alertaDestinatario.count({
    where: { membroId: user.id, lido: false },
  });

  return { user, alertasNaoLidos };
}

/**
 * Componente do layout: Topbar + Sidebar + `<Outlet />` (área da rota).
 *
 * **Responsividade:**
 * - `lg+`: sidebar visível (240px) à esquerda; topbar 100% width.
 * - `<lg`: sidebar escondida (drawer mobile entra em S04); topbar com
 *   hamburger (placeholder — sem ação na S02).
 */
export default function AppShell() {
  const { user, alertasNaoLidos } = useLoaderData<typeof loader>();
  return (
    <div className="h-screen flex bg-slate-50">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopbarAutenticada user={user} alertasNaoLidos={alertasNaoLidos} />
        <main
          id="main-content"
          className="flex-1 min-w-0 overflow-y-auto"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
