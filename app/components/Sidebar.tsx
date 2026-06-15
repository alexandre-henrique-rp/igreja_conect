/**
 * Componente <Sidebar /> — menu lateral do shell autenticado (S02-T09 / S06-T09).
 *
 * Renderiza a navegação lateral com 6 itens fixos:
 * 1. **Dashboard** (`/app`) — destino do redirect pós-login.
 * 2. **Membros** (`/app/membros`) — listagem (única área funcional em S02).
 * 3. **Financeiro** (`/app/financeiro`) — dashboard financeiro (S06, apenas ADMIN/PASTOR/FINANCEIRO/SECRETARIO).
 * 4. **Ministérios** (`/app/ministerios`) — placeholder (sprint futura).
 * 5. **Alertas** (`/app/alertas`) — placeholder (sprint futura).
 * 6. **Configurações** (`/app/config/acolhimento`) — placeholder ADMIN only.
 *
 * **Item ativo:** destacado com `bg-cyan-50 text-cyan-900 font-medium` e
 * `aria-current="page"`. Match é exato (`/app` ativa Dashboard) ou por
 * prefixo (`/app/membros/abc` também ativa Membros).
 *
 * **RBAC Financeiro:** o link de Financeiro só renderiza para cargos
 * `['ADMIN', 'PASTOR', 'FINANCEIRO', 'SECRETARIO']` (ver Can.tsx).
 *
 * **Botão Sair:** form que submete `POST /logout` (action do backend).
 * O backend invalida a sessão e redireciona para `/login`.
 *
 * **Responsividade:**
 * - `lg+` (≥1024px): sidebar fixa (`hidden lg:block`).
 * - `<lg` (mobile/tablet): escondida — hamburger/drawer entra em S04.
 *
 * **Acessibilidade:**
 * - `<nav aria-label="Menu principal">` — landmark.
 * - Links de item ativo com `aria-current="page"`.
 * - `focus-visible:ring-2 focus-visible:ring-cyan-700` em todos os links.
 *
 * @example
 *   <Sidebar currentPath={location.pathname} user={user} />
 *
 * @param props - Props do componente (ver `SidebarProps`).
 * @returns Elemento JSX da sidebar.
 */
import { Form, NavLink, useLocation } from "react-router";
import type { SessionUser } from "~/lib/session.types";
import { Can } from "./Can";

/**
 * Props aceitas pelo `<Sidebar>`.
 */
export type SidebarProps = {
  /** Pathname atual (para destacar o item ativo). */
  currentPath?: string;
  /** Usuário autenticado (para mostrar nome no rodapé). */
  user: SessionUser;
};

/** Lista de itens do menu principal (declarativa — facilita YAGNI depois). */
type MenuItem = {
  label: string;
  to: string;
  /** Se `true`, match exato (sem prefixo). Para Dashboard. */
  exact?: boolean;
  icon: React.ReactNode;
  /** Cargos com permissão de ver este item (opcional, default = todos). */
  roles?: string[];
};

const ICON_DASHBOARD = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const ICON_MEMBERS = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ICON_FINANCEIRO = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const ICON_MINISTERIOS = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
  </svg>
);

const ICON_ALERTAS = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const ICON_CONFIG = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const MENU_ITEMS: MenuItem[] = [
  { label: "Dashboard", to: "/app", exact: true, icon: ICON_DASHBOARD },
  { label: "Membros", to: "/app/membros", icon: ICON_MEMBERS },
  {
    label: "Financeiro",
    to: "/app/financeiro",
    icon: ICON_FINANCEIRO,
    roles: ["ADMIN", "PASTOR", "FINANCEIRO", "SECRETARIO"],
  },
  { label: "Ministérios", to: "/app/ministerios", icon: ICON_MINISTERIOS },
  { label: "Alertas", to: "/app/alertas", icon: ICON_ALERTAS },
  {
    label: "Configurações",
    to: "/app/config/acolhimento",
    icon: ICON_CONFIG,
  },
];

/**
 * Verifica se um item está ativo dado o currentPath.
 * - Itens com `exact: true` (Dashboard) só estão ativos no path exato.
 * - Demais: match por prefixo (ex: /app/membros/abc ativa Membros).
 *
 * @param item - Item do menu.
 * @param currentPath - Pathname atual.
 * @returns `true` se o item está ativo.
 */
function isItemActive(item: MenuItem, currentPath: string): boolean {
  if (item.exact) {
    return currentPath === item.to;
  }
  return currentPath === item.to || currentPath.startsWith(item.to + "/");
}

/**
 * @description Sidebar de navegação autenticada com 6 itens + botão Sair.
 * @param {SidebarProps} props - currentPath e user.
 * @returns {JSX.Element} Elemento da sidebar.
 */
export function Sidebar({ currentPath: currentPathProp, user }: SidebarProps) {
  // Se currentPath não for passada, usa location.pathname (RR7).
  // Para SSR, prioriza a prop (loader injeta).
  const location = useLocation();
  const currentPath = currentPathProp ?? location.pathname;

  return (
    <nav
      aria-label="Menu principal"
      className="hidden lg:block w-60 shrink-0 border-r border-slate-200 bg-white"
    >
      <div className="flex flex-col h-full">
        {/* Lista de itens */}
        <ul className="flex-1 py-4 px-2 space-y-1">
          {MENU_ITEMS.map((item) => {
            const active = isItemActive(item, currentPath);

            // Se o item tem restrição de cargo, usa <Can> para RBAC
            const linkElement = (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.exact}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "flex items-center gap-3 px-3 h-10 rounded-md text-sm font-medium bg-cyan-50 text-cyan-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
                      : "flex items-center gap-3 px-3 h-10 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
                  }
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              </li>
            );

            if (item.roles) {
              return (
                <Can key={item.to} user={user} allow={item.roles}>
                  {linkElement}
                </Can>
              );
            }

            return linkElement;
          })}
        </ul>

        {/* Rodapé: usuário + Sair */}
        <div className="border-t border-slate-200 p-3 space-y-2">
          <p className="text-xs text-slate-500 truncate" title={user.nome}>
            {user.nome}
          </p>
          <Form method="post" action="/logout">
            <button
              type="submit"
              className="
                w-full inline-flex items-center justify-center
                h-9 px-3 rounded-md
                text-sm font-medium text-slate-700
                hover:bg-slate-100
                focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-cyan-700 focus-visible:ring-offset-2
              "
            >
              Sair
            </button>
          </Form>
        </div>
      </div>
    </nav>
  );
}
