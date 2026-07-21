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
  /** Quantidade de alertas nao lidos (se > 0 exibe badge). */
  alertasNaoLidos?: number;
};

/** Lista de itens do menu principal (declarativa — facilita YAGNI depois). */
type MenuItem = {
  label: string;
  to: string;
  /** Se `true`, match exato (sem prefixo). Para Dashboard. */
  exact?: boolean;
  icon: React.ReactNode | null;
  /** Cargos com permissão de ver este item (opcional, default = todos). */
  roles?: string[];
  /** Se `true`, item não é renderizado (oculto temporariamente). */
  hidden?: boolean;
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
    <rect x="3" y="3" width="7" height="9" />
    <rect x="14" y="3" width="7" height="5" />
    <rect x="14" y="12" width="7" height="9" />
    <rect x="3" y="16" width="7" height="5" />
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
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ICON_RELATORIOS = (
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
    <path d="M3 3v18h18" />
    <path d="M7 14l4-4 4 4 5-5" />
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
    <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
    <line x1="12" y1="4" x2="12" y2="20" />
    <line x1="2" y1="12" x2="22" y2="12" />
  </svg>
);

const ICON_CELULAS = (
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
    <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />
    <path d="M12 6v12" />
    <path d="M6 12h12" />
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

const ICON_ESCALAS = (
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
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <polyline points="9 16 11 18 15 14" />
  </svg>
);

const ICON_CULTOS = (
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
    <path d="M12 2v20M17 5H7" />
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
    <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.39 1h-3.2a1.65 1.65 0 0 0-1-1.6 1.65 1.65 0 0 0-1-.6 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1-.39v-3.2a1.65 1.65 0 0 0 1.6-1 1.65 1.65 0 0 0 .6-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .39-1h3.2a1.65 1.65 0 0 0 1 1.6 1.65 1.65 0 0 0 1 .6 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.23.37.39.77.6 1h0a1.65 1.65 0 0 0 1 .39v3.2a1.65 1.65 0 0 0-1.6 1Z" />
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

const ICON_EVENTOS = (
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
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <path d="M8 14h.01" />
    <path d="M12 14h.01" />
    <path d="M16 14h.01" />
    <path d="M8 18h.01" />
    <path d="M12 18h.01" />
    <path d="M16 18h.01" />
  </svg>
);

const ICON_ESTOQUE = (
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
    <polyline points="21 16 12 21 3 16 12 11 21 16" />
    <polyline points="3 16 3 8 12 3 21 8 21 16" />
    <line x1="12" y1="3" x2="12" y2="11" />
    <line x1="12" y1="11" x2="12" y2="21" />
    <line x1="12" y1="11" x2="21" y2="8" />
    <line x1="12" y1="11" x2="3" y2="8" />
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
  { label: "Células", to: "/app/celulas", icon: ICON_CELULAS },
  { label: "Ministérios", to: "/app/ministerios", icon: ICON_MINISTERIOS },
  { label: "Escalas", to: "/app/escalas", icon: ICON_ESCALAS },
  { label: "Cultos", to: "/app/cultos", icon: ICON_CULTOS },
  { label: "Alertas", to: "/app/alertas", icon: ICON_ALERTAS },
  { label: "Eventos", to: "/app/eventos", icon: ICON_EVENTOS },
  { label: "Estoque", to: "/app/estoque", icon: ICON_ESTOQUE },
  { label: "Configurações", to: "/app/config/acolhimento", icon: ICON_CONFIG, hidden: true },
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
 * @description Sidebar de navegação autenticada com 11 itens + botão Sair.
 * @param {SidebarProps} props - currentPath, user e alertasNaoLidos.
 * @returns {JSX.Element} Elemento da sidebar.
 */
export function Sidebar({ currentPath: currentPathProp, user, alertasNaoLidos = 0 }: SidebarProps) {
  const location = useLocation();
  const currentPath = currentPathProp ?? location.pathname;

  return (
    <nav
      aria-label="Menu principal"
      className="hidden lg:block w-60 shrink-0 border-r border-slate-800 bg-[#0F172A]"
    >
      <div className="flex flex-col h-full">
        {/* Logo / Cabeçalho */}
        <div className="p-6 border-b border-slate-800">
          <span className="text-xl font-bold text-white block">IgrejaConnect</span>
          <span className="text-[10px] tracking-wider text-slate-400 block font-semibold uppercase mt-0.5">GESTÃO ECLESIÁSTICA</span>
        </div>

        {/* Lista de itens */}
        <ul className="flex-1 py-4 px-2 space-y-1">
          {MENU_ITEMS.filter((item) => !item.hidden).map((item) => {
            const active = isItemActive(item, currentPath);

            const linkElement = (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.exact}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "flex items-center gap-3 px-3 h-10 rounded-md text-sm font-medium bg-cyan-50 text-cyan-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      : "flex items-center gap-3 px-3 h-10 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  }
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  {item.label === "Alertas" && alertasNaoLidos > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-semibold bg-red-500 text-white">
                      {alertasNaoLidos > 99 ? "99+" : alertasNaoLidos}
                    </span>
                  )}
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

        {/* Rodapé: Sair */}
        <div className="border-t border-slate-800 p-4">
          <Form method="post" action="/logout">
            <button
              type="submit"
              className="
                w-full flex items-center gap-3
                h-10 px-3 rounded-md
                text-sm font-medium text-red-400
                hover:bg-slate-800 hover:text-red-300 transition-colors
                focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
              "
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 rotate-180"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              <span>Sair</span>
            </button>
          </Form>
        </div>
      </div>
    </nav>
  );
}
