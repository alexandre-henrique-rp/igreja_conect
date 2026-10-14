/**
 * Componente <TabDiscipulado /> — aba de discipulado (S03-T07).
 *
 * Renderiza o resumo do vínculo de discipulado do membro DENTRO da
 * página de detalhe. Para ações de vincular/desvincular, aponta para
 * a página dedicada `/app/membros/:id/discipulado`.
 *
 * **Por que não renderiza `<DiscipuladoPainel>` inteiro aqui:**
 * este é um **resumo** (camada de leitura). Vínculos completos ficam
 * na página dedicada, que tem modal de seleção, anti-loop, etc.
 *
 * **Estados:**
 * - Com discipulador: card com nome + link "Gerenciar".
 * - Sem discipulador: card "não vinculado" + link "Gerenciar".
 * - Com discípulos (este membro é discipulador): lista dos seus.
 *
 * **RBAC:** link "Gerenciar" só aparece se `canEdit=true` (DISCIPULADOR
 * pode, SECRETARIO pode, etc). O backend revalida o escopo.
 *
 * @example
 *   <TabDiscipulado
 *     membroId={membro.id}
 *     discipulador={discipulador}
 *     discipulos={discipulos}
 *     canEdit={canEdit}
 *   />
 *
 * @param props - Props do componente.
 * @returns Elemento JSX da tab.
 */
import { Link } from "react-router";

/**
 * Subset de Membro (id + nome).
 */
export type TabMembroMini = { id: string; nome: string };

/**
 * Props aceitas pelo `<TabDiscipulado>`.
 */
export type TabDiscipuladoProps = {
  /** ID do membro foco. */
  membroId: string;
  /** Discipulador atual (null = sem vínculo). */
  discipulador: TabMembroMini | null;
  /** Discípulos do membro (vazio se ele não é discipulador). */
  discipulos: TabMembroMini[];
  /** Se `true`, renderiza link para a página de gerenciamento. */
  canEdit: boolean;
};

/**
 * @description Tab de discipulado com resumo + link para gerenciamento completo.
 * @param {TabDiscipuladoProps} props - membroId, discipulador, discipulos, canEdit.
 * @returns {JSX.Element} Elemento JSX da tab.
 */
export function TabDiscipulado({
  membroId,
  discipulador,
  discipulos,
  canEdit,
}: TabDiscipuladoProps) {
  return (
    <div className="space-y-4" data-testid="tab-discipulado">
      {/* Card do discipulador */}
      <div className="border border-border rounded-lg bg-surface p-4 space-y-2">
        <h3 className="text-sm font-semibold text-fg">
          Discipulador atual
        </h3>
        {discipulador ? (
          <p className="text-base text-fg">{discipulador.nome}</p>
        ) : (
          <p className="text-sm text-fg">
            Este membro não possui discipulador vinculado.
          </p>
        )}
        {canEdit && (
          <Link
            to={`/app/membros/${membroId}/discipulado`}
            className="inline-block text-sm text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded"
          >
            Gerenciar discipulado →
          </Link>
        )}
      </div>

      {/* Lista de discípulos (quando o foco é o discipulador) */}
      {discipulos.length > 0 && (
        <div className="border border-border rounded-lg bg-surface p-4 space-y-2">
          <h3 className="text-sm font-semibold text-fg">
            Discípulos ({discipulos.length})
          </h3>
          <ul className="space-y-1">
            {discipulos.map((d) => (
              <li key={d.id} className="text-sm">
                <Link
                  to={`/app/membros/${d.id}`}
                  className="text-accent hover:underline"
                >
                  {d.nome}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
