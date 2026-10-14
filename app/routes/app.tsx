/**
 * Layout raiz das rotas autenticadas (`/app/**`).
 *
 * **Padrão do Design System (app-shell.html):**
 * ```html
 * <div class="app-shell">
 *   <aside class="sidebar">...</aside>
 *   <div class="main-area">
 *     <header class="topbar">...</header>
 *     <main class="page">...</main>
 *   </div>
 * </div>
 * ```
 *
 * - Sidebar fixa à esquerda (240px desktop, 64px colapsada).
 * - `main-area` com `margin-left` igual à sidebar.
 * - Topbar sticky dentro de `main-area` (não da sidebar).
 * - `<Outlet />` renderiza a página filha.
 *
 * **Responsividade:** <lg esconde sidebar desktop e usa `<MobileNavigation />`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { prisma } from "~/db/prisma.server";
import { userContext } from "~/lib/user-context";
import { MobileNavigation } from "~/components/MobileNavigation";
import { Sidebar } from "~/components/Sidebar";
import { TopbarAutenticada } from "~/components/TopbarAutenticada";

export async function loader({ context }: LoaderFunctionArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }
  const alertasNaoLidos = await prisma.alertaDestinatario.count({
    where: { membroId: user.id, lido: false },
  });
  return { user, alertasNaoLidos };
}

export default function AppShell() {
  const { user, alertasNaoLidos } = useLoaderData<typeof loader>();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);

  useEffect(() => {
    if (!backgroundRef.current) return;
    backgroundRef.current.inert = isMobileMenuOpen;
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 781px)");
    const handleDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) closeMobileMenu();
    };
    desktopQuery.addEventListener("change", handleDesktop);
    return () => desktopQuery.removeEventListener("change", handleDesktop);
  }, [closeMobileMenu]);

  const sidebarWidth = sidebarCollapsed ? "min-[781px]:ml-16" : "min-[781px]:ml-60";

  return (
    <div className="app-shell min-h-screen bg-bg text-fg" data-od-id="app-shell-page">
      <Sidebar
        user={user}
        alertasNaoLidos={alertasNaoLidos}
      />
      <MobileNavigation
        user={user}
        alertasNaoLidos={alertasNaoLidos}
        isOpen={isMobileMenuOpen}
        onClose={closeMobileMenu}
        triggerRef={mobileMenuTriggerRef}
      />

      <div
        ref={backgroundRef}
        className={`main-area flex min-h-screen flex-col transition-[margin] duration-200 ${sidebarWidth}`}
      >
        <TopbarAutenticada
          user={user}
          alertasNaoLidos={alertasNaoLidos}
          isMobileMenuOpen={isMobileMenuOpen}
          onMobileMenuOpen={() => setIsMobileMenuOpen(true)}
          mobileMenuTriggerRef={mobileMenuTriggerRef}
        />
        <main id="main-content" className="page min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}