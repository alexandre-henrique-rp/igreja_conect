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
 * S02 traz a UI real do shell; o drawer mobile mantém a navegação
 * disponível abaixo do breakpoint `lg`.
 *
 * @see app/routes/app/_middleware.tsx para o middleware de auth
 * @see design/PRODUCT.md §2.2
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { prisma } from "~/db/prisma.server";
import { userContext } from "~/lib/user-context";
import { MobileNavigation } from "~/components/MobileNavigation";
import { Sidebar } from "~/components/Sidebar";
import { TopbarAutenticada } from "~/components/TopbarAutenticada";

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
 * - `<lg`: sidebar desktop escondida; hamburger abre drawer acessível
 *   com a mesma navegação e permissões.
 */
export default function AppShell() {
  const { user, alertasNaoLidos } = useLoaderData<typeof loader>();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);

  useEffect(() => {
    if (!backgroundRef.current) return;
    backgroundRef.current.inert = isMobileMenuOpen;
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const handleDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) closeMobileMenu();
    };
    desktopQuery.addEventListener("change", handleDesktop);
    return () => desktopQuery.removeEventListener("change", handleDesktop);
  }, [closeMobileMenu]);

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar user={user} alertasNaoLidos={alertasNaoLidos} />
      <MobileNavigation
        user={user}
        alertasNaoLidos={alertasNaoLidos}
        isOpen={isMobileMenuOpen}
        onClose={closeMobileMenu}
        triggerRef={mobileMenuTriggerRef}
      />
      <div ref={backgroundRef} className="flex min-w-0 flex-1 flex-col">
        <TopbarAutenticada
          user={user}
          alertasNaoLidos={alertasNaoLidos}
          isMobileMenuOpen={isMobileMenuOpen}
          onMobileMenuOpen={() => setIsMobileMenuOpen(true)}
          mobileMenuTriggerRef={mobileMenuTriggerRef}
        />
        <main id="main-content" className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
