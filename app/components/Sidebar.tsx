/**
 * <Sidebar /> — navegação persistente do app autenticado.
 *
 * **Padrão do Design System (app-shell.html):**
 * - `.app-shell` wrapper com `.sidebar` (240px) + `.main-area` (margin-left).
 * - Sidebar: `.brand` com `brand-mark` (ícone igreja) + `.sidebar-scroll` com
 *   `.nav-group` (label + `.nav-link`).
 * - Footer: `.user-mini.dropdown` com avatar + nome + cargo + chevron.
 * - **Toggle de colapso:** 240px ↔ 64px (apenas labels somem).
 *
 * **RBAC:** cada grupo pode ter `roles`. Items sem `roles` são públicos.
 *
 * @example
 *   <Sidebar user={loaderData.user} alertasNaoLidos={3} />
 */
import { Form, Link, useLocation } from "react-router";
import { useState } from "react";
import type { SessionUser } from "~/lib/session.types";
import { Can } from "./Can";
import { Icon } from "~/components/ds";
import { cn } from "~/lib/cn";

export type SidebarProps = {
  user: SessionUser;
  alertasNaoLidos?: number;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

type NavItem = {
  label: string;
  to: string;
  icon: string;
  exact?: boolean;
  roles?: string[];
  hidden?: boolean;
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Principal",
    items: [
      { label: "Dashboard", to: "/app", icon: "building-2", exact: true },
    ],
  },
  {
    label: "Pessoas",
    items: [
      { label: "Membros", to: "/app/membros", icon: "users" },
      { label: "Células", to: "/app/celulas", icon: "heart" },
      { label: "Visitantes", to: "/app/visitantes", icon: "user-plus" },
    ],
  },
  {
    label: "Agenda",
    items: [
      { label: "Eventos", to: "/app/eventos", icon: "megaphone" },
      { label: "Escalas", to: "/app/escalas", icon: "clock" },
    ],
  },
  {
    label: "Equipes",
    items: [
      { label: "Ministérios", to: "/app/ministerios", icon: "users" },
    ],
  },
  {
    label: "Operações",
    items: [
      { label: "Estoque", to: "/app/estoque", icon: "package" },
      {
        label: "Patrimônio",
        to: "/app/patrimonio",
        icon: "archive",
      },
    ],
  },
  {
    label: "Financeiro",
    items: [
      {
        label: "Dashboard",
        to: "/app/financeiro",
        icon: "trending-up",
        roles: ["ADMIN", "PASTOR", "FINANCEIRO", "SECRETARIO"],
      },
      {
        label: "Lançamentos",
        to: "/app/financeiro/lancamentos/novo",
        icon: "credit-card",
        roles: ["ADMIN", "PASTOR", "FINANCEIRO"],
      },
      {
        label: "Caixas",
        to: "/app/financeiro/caixas",
        icon: "wallet",
        roles: ["ADMIN", "PASTOR", "FINANCEIRO"],
      },
      {
        label: "Transferências",
        to: "/app/financeiro/transferencias",
        icon: "chevron-right",
        roles: ["ADMIN", "PASTOR", "FINANCEIRO"],
      },
      {
        label: "Relatórios",
        to: "/app/financeiro/relatorios",
        icon: "download",
        roles: ["ADMIN", "PASTOR", "FINANCEIRO"],
      },
    ],
  },
  {
    label: "Administração",
    items: [
      { label: "Alertas", to: "/app/alertas", icon: "alert-triangle" },
      { label: "Configurações", to: "/app/config/acolhimento", icon: "settings" },
    ],
  },
];

function isItemActive(item: NavItem, currentPath: string): boolean {
  if (item.exact) {
    return currentPath === item.to;
  }
  return currentPath === item.to || currentPath.startsWith(item.to + "/");
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return (partes[0]![0]! + partes[partes.length - 1]![0]!).toUpperCase();
}

function cargoLabel(cargo?: string | null): string {
  switch (cargo) {
    case "ADMIN":
      return "Administrador";
    case "PASTOR":
      return "Pastor";
    case "SECRETARIO":
      return "Secretário";
    case "FINANCEIRO":
      return "Financeiro";
    case "LIDER_MINISTERIO":
      return "Líder";
    default:
      return cargo ?? "Membro";
  }
}

export type NavigationContentProps = {
  alertasNaoLidos: number;
  currentPath: string;
  collapsed?: boolean;
  onNavigate?: () => void;
  user: SessionUser;
};

function NavGroupContent({
  group,
  currentPath,
  collapsed = false,
  alertasNaoLidos,
  user,
  onNavigate,
}: {
  group: NavGroup;
  currentPath: string;
  collapsed?: boolean;
  alertasNaoLidos: number;
  user: SessionUser;
  onNavigate?: () => void;
}) {
  const visible = group.items.filter((it) => !it.hidden);
  if (visible.length === 0) return null;
  return (
    <div className="nav-group mb-5">
      {!collapsed && (
        <div className="nav-label px-2.5 pb-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-subtle">
          {group.label}
        </div>
      )}
      <div className="grid gap-[5px]">
        {visible.map((item) => {
          const active = isItemActive(item, currentPath);
          const link = (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "nav-link flex items-center gap-2.5 min-h-9 px-2.5 rounded-md text-xs font-semibold",
                "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                active
                  ? "text-accent-strong bg-accent-soft"
                  : "text-muted hover:text-fg hover:bg-surface-3",
                collapsed && "justify-center",
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon name={item.icon} size="md" />
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {item.label === "Alertas" && alertasNaoLidos > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">
                      {alertasNaoLidos > 99 ? "99+" : alertasNaoLidos}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
          if (item.roles) {
            return (
              <Can key={item.to} user={user} allow={item.roles}>
                {link}
              </Can>
            );
          }
          return <span key={item.to}>{link}</span>;
        })}
      </div>
    </div>
  );
}

export function NavigationContent({
  alertasNaoLidos,
  currentPath,
  collapsed,
  onNavigate,
  user,
}: NavigationContentProps) {
  return (
    <>
      <div className="sidebar-scroll flex-1 overflow-y-auto py-4 px-2.5">
        {NAV_GROUPS.map((g) => (
          <NavGroupContent
            key={g.label}
            group={g}
            currentPath={currentPath}
            collapsed={collapsed}
            alertasNaoLidos={alertasNaoLidos}
            user={user}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      <div className="border-t border-border p-3">
        <div className="dropdown relative">
          <details className="group">
            <summary
              className={cn(
                "flex items-center gap-2 min-w-0 rounded-md cursor-pointer select-none list-none",
                "hover:bg-surface-3 transition-colors",
                collapsed ? "justify-center p-1.5" : "p-1.5",
              )}
            >
              <span
                className={cn(
                  "inline-grid place-items-center rounded-full overflow-hidden",
                  "bg-accent-soft text-accent-strong font-extrabold text-xs shrink-0",
                  "h-8 w-8",
                )}
                aria-hidden="true"
              >
                {iniciais(user.nome)}
              </span>
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-fg">
                      {user.nome}
                    </span>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-subtle">
                      {cargoLabel(user.cargo)}
                    </span>
                  </span>
                  <Icon
                    name="chevron-down"
                    size="sm"
                    className="text-muted group-open:rotate-180 transition-transform"
                  />
                </>
              )}
            </summary>
            <div
              className={cn(
                "absolute z-30 bg-surface border border-border rounded-md",
                "shadow-[0_20px_50px_oklch(20.8%_0.035_260_/_0.15)] py-1.5",
                collapsed ? "left-full ml-2 bottom-0 w-[190px]" : "left-0 right-0 mt-1",
              )}
            >
              <Link
                to="/app/config/acolhimento"
                className="flex items-center gap-2 min-h-[34px] px-2.5 text-xs text-muted hover:bg-surface-3 hover:text-fg rounded-sm"
              >
                <Icon name="user-check" size="sm" />
                Meu perfil
              </Link>
              <Link
                to="/app/config/acolhimento"
                className="flex items-center gap-2 min-h-[34px] px-2.5 text-xs text-muted hover:bg-surface-3 hover:text-fg rounded-sm"
              >
                <Icon name="settings" size="sm" />
                Preferências
              </Link>
              <Form method="post" action="/logout" className="contents">
                <button
                  type="submit"
                  className="flex items-center gap-2 min-h-[34px] px-2.5 text-xs text-muted hover:bg-surface-3 hover:text-danger rounded-sm w-full text-left"
                >
                  <Icon name="arrow-left" size="sm" />
                  Sair
                </button>
              </Form>
            </div>
          </details>
        </div>
      </div>
    </>
  );
}

export function Sidebar({ user, alertasNaoLidos = 0 }: SidebarProps) {
  const location = useLocation();
  const currentPath = location.pathname;
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      aria-label="Menu principal"
      data-od-id="app-shell-sidebar"
      className={cn(
        "sidebar fixed inset-y-0 left-0 z-20 hidden min-[781px]:flex flex-col border-r border-border bg-surface transition-[width] duration-200",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <Link
        to="/app"
        className="brand flex h-16 items-center gap-2.5 px-4 border-b border-border text-fg"
      >
        <span className="brand-mark" aria-hidden="true" />
        {!collapsed && <span className="brand-name">Igreja Conect</span>}
      </Link>

      <NavigationContent
        alertasNaoLidos={alertasNaoLidos}
        currentPath={currentPath}
        collapsed={collapsed}
        user={user}
      />

      <button
        type="button"
        aria-label="Recolher menu"
        title="Recolher menu"
        onClick={() => setCollapsed((c) => !c)}
        className={cn(
          "absolute top-3 -right-3 z-10 h-6 w-6 grid place-items-center",
          "rounded-full border border-border bg-surface text-muted hover:text-fg",
          "shadow-[0_1px_2px_oklch(20.8%_0.035_260_/_0.04)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        )}
      >
        <Icon
          name="chevron-right"
          size="sm"
          className={cn("transition-transform", collapsed ? "" : "rotate-180")}
        />
      </button>
    </aside>
  );
}

/** Conteúdo apenas para drawer mobile (sem o `aside fixed`). */
export function MobileSidebar(props: NavigationContentProps) {
  return (
    <div className="flex h-full flex-col bg-surface">
      <Link
        to="/app"
        className="flex h-16 items-center gap-2.5 px-4 border-b border-border text-fg"
      >
        <span
          className="grid h-[30px] w-[30px] place-items-center rounded-[9px] bg-accent text-white"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <path d="M12 2 4 6v8l8 4 8-4V6l-8-4Z" />
          </svg>
        </span>
        <span className="text-sm font-extrabold tracking-[-0.02em]">
          Igreja Conect
        </span>
      </Link>
      <NavigationContent {...props} />
    </div>
  );
}