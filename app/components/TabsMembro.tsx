/**
 * Componente <TabsMembro /> — orquestrador de abas do membro (S03-T07).
 *
 * **GATE LGPD (RN-MEM-03) — defesa em 3 camadas:**
 * 1. **UI (camada 1):** se `canSeeFinancials=false`, a tab Fidelidade
 *    **NÃO é renderizada** (nem o botão). Este é o ponto crítico
 *    deste componente.
 * 2. **Loader (camada 2):** se a URL `?tab=fidelidade` é acessada
 *    sem permissão, o loader força `tab=dados` antes de chegar aqui.
 * 3. **Service (camada 3):** `getDizimosByMembro` lança
 *    `ForbiddenError` (RN-MEM-03).
 *
 * **Acessibilidade (WCAG 1.3.1, 4.1.2, 2.4.3):**
 * - `<div role="tablist">` contém os botões de tab.
 * - Cada `<Link role="tab" aria-selected aria-controls>` aponta
 *   para o `tabpanel` abaixo.
 * - `<div role="tabpanel" aria-labelledby="tab-{id}">` é o conteúdo.
 * - Navegação por URL `?tab=...` (RR7 navigation), setas ←/→ ficam
 *   para sprint 2+ (YAGNI no MVP).
 *
 * **Tabs visíveis (com canSeeFinancials=true):**
 * 1. Dados (default)
 * 2. Discipulado
 * 3. Ministérios
 * 4. Fidelidade
 *
 * **Tabs visíveis (com canSeeFinancials=false):**
 * 1. Dados
 * 2. Discipulado
 * 3. Ministérios
 *
 * @example
 *   <TabsMembro
 *     activeTab="dados"
 *     canSeeFinancials={canSeeFinancials}
 *     membro={membro}
 *     discipulador={discipulador}
 *     ...
 *   />
 *
 * @param props - Props do componente.
 * @returns Elemento JSX das tabs.
 */
import { Link } from "react-router";
import { TabDadosPessoais } from "~/components/TabDadosPessoais";
import { TabDiscipulado } from "~/components/TabDiscipulado";
import { TabMinisterios } from "~/components/TabMinisterios";
import { TabFidelidadeFinanceira } from "~/components/TabFidelidadeFinanceira";
import { cn } from "~/lib/cn";

/**
 * Tipos de tab válidas.
 */
export type TabKey = "dados" | "discipulado" | "ministerios" | "fidelidade";

/**
 * Subset de Membro para `TabDadosPessoais`.
 */
type DadosPessoaisMembro = Parameters<typeof TabDadosPessoais>[0]["membro"];

/**
 * Subset de Membro para `TabDiscipulado`/`TabMinisterios`.
 */
type TabMembroMini = { id: string; nome: string };

/**
 * Subset de Ministerio.
 */
type TabMinisterioMini = { id: string; nome: string };

/**
 * Props aceitas pelo `<TabsMembro>`.
 */
export type TabsMembroProps = {
  /** Tab ativa (URL-driven). */
  activeTab: TabKey;
  /** Se `false`, a tab Fidelidade NÃO é renderizada (LGPD). */
  canSeeFinancials: boolean;
  /** Membro foco (passado para cada tab). */
  membro: DadosPessoaisMembro;
  /** Discipulador atual do membro. */
  discipulador: TabMembroMini | null;
  /** Discípulos do membro (vazio se não é discipulador). */
  discipulos: TabMembroMini[];
  /** Ministérios do membro. */
  ministerios: TabMinisterioMini[];
  /** Se `true`, permite editar (Vincular, Desvincular). */
  canEdit: boolean;
  /** Se `true`, mostra botão de promover tipo (ADMIN/PASTOR). */
  canPromover: boolean;
  /** Usuário autenticado (subset — só `cargo`). */
  user: { cargo: string | null };
};

/**
 * Estilo da aba inativa vs ativa.
 */
function tabClassName(active: boolean): string {
  return cn(
    "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2",
    active
      ? "border-cyan-700 text-cyan-900"
      : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
  );
}

/**
 * @description Tabs da página de detalhe: Dados / Discipulado / Ministérios / [Fidelidade bloqueada].
 * @param {TabsMembroProps} props - Veja `TabsMembroProps`.
 * @returns {JSX.Element} Elemento JSX das tabs.
 */
export function TabsMembro({
  activeTab,
  canSeeFinancials,
  membro,
  discipulador,
  discipulos,
  ministerios,
  canEdit,
  canPromover,
  user,
}: TabsMembroProps) {
  // Se a URL mandou tab=fidelidade mas o usuário não pode ver, cai
  // em "dados" como fallback. (Camada 2 do loader já deveria ter
  // forçado isso, mas esta UI reforça — defense in depth.)
  const effectiveTab: TabKey =
    activeTab === "fidelidade" && !canSeeFinancials ? "dados" : activeTab;

  return (
    <div data-testid="tabs-membro">
      {/* Tablist */}
      <div
        role="tablist"
        aria-label="Abas do membro"
        className="border-b border-slate-200 flex gap-1 overflow-x-auto"
      >
        <Link
          to="?tab=dados"
          role="tab"
          aria-selected={effectiveTab === "dados"}
          aria-controls="tabpanel-membro"
          id="tab-dados"
          className={tabClassName(effectiveTab === "dados")}
        >
          Dados
        </Link>
        <Link
          to="?tab=discipulado"
          role="tab"
          aria-selected={effectiveTab === "discipulado"}
          aria-controls="tabpanel-membro"
          id="tab-discipulado"
          className={tabClassName(effectiveTab === "discipulado")}
        >
          Discipulado
        </Link>
        <Link
          to="?tab=ministerios"
          role="tab"
          aria-selected={effectiveTab === "ministerios"}
          aria-controls="tabpanel-membro"
          id="tab-ministerios"
          className={tabClassName(effectiveTab === "ministerios")}
        >
          Ministérios
        </Link>

        {/* CAMADA 1 RBAC — Fidelidade: SÓ renderiza se canSeeFinancials.
            Se loader enviou activeTab="fidelidade" mas o usuário não
            pode, esta branch não monta o botão. */}
        {canSeeFinancials && (
          <Link
            to="?tab=fidelidade"
            role="tab"
            aria-selected={effectiveTab === "fidelidade"}
            aria-controls="tabpanel-membro"
            id="tab-fidelidade"
            className={tabClassName(effectiveTab === "fidelidade")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                clipRule="evenodd"
              />
            </svg>
            Fidelidade
          </Link>
        )}
      </div>

      {/* Tabpanel */}
      <div
        role="tabpanel"
        id="tabpanel-membro"
        aria-labelledby={`tab-${effectiveTab}`}
        className="py-6"
      >
        {effectiveTab === "dados" && (
          <TabDadosPessoais membro={membro} canPromover={canPromover} />
        )}
        {effectiveTab === "discipulado" && (
          <TabDiscipulado
            membroId={membro.id}
            discipulador={discipulador}
            discipulos={discipulos}
            canEdit={canEdit}
          />
        )}
        {effectiveTab === "ministerios" && (
          <TabMinisterios
            membroId={membro.id}
            ministerios={ministerios}
            canEdit={canEdit}
          />
        )}
        {effectiveTab === "fidelidade" && canSeeFinancials && (
          <TabFidelidadeFinanceira membroId={membro.id} />
        )}
      </div>

      {/* user.cargo (não usado aqui, mas mantido para extensões futuras
          — ex: badge de auditoria "visto por {cargo}") */}
      {void user}
    </div>
  );
}
