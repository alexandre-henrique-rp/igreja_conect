/**
 * Componente <CardMinisterio /> — card de um ministério (S03-T09).
 *
 * Renderiza um card visual para um ministério na lista, com:
 * - **Header:** nome (h2) + badge de contagem de membros.
 * - **Lista:** até 5 primeiros membros (vindos do loader), cada um
 *   com botão "Desvincular" (se canEdit).
 * - **+ Adicionar membro:** botão (se canEdit) que abre modal.
 * - **Footer:** Editar + Excluir (se canEdit).
 *
 * **Por que `onAddMembro`/`onEdit`/etc são callbacks em vez de Forms:**
 * os modais de criar/vincular/editar são controlados por estado no
 * pai (`useState`). Quando o usuário submete, o pai navega/revalida.
 * Esta arquitetura evita múltiplos forms na mesma rota com intents
 * diferentes — mais simples que descobrir qual form foi submetido.
 *
 * **Diferença para `ListaDiscipulos`:** aqui o `intent` é
 * `remove-membro` (não `unassign`), e a estrutura é de "ministério",
 * não "discipulador".
 *
 * @example
 *   <CardMinisterio
 *     ministerio={{ id: "min-1", nome: "Louvor" }}
 *     membros={[...5 primeiros...]}
 *     totalMembros={12}
 *     canEdit={true}
 *     onAddMembro={() => setModalVincular("min-1")}
 *     onRemoveMembro={(id) => handleRemove("min-1", id)}
 *     onEdit={() => setModalEditar("min-1")}
 *     onDelete={() => setModalExcluir("min-1")}
 *   />
 *
 * @param props - Props do componente.
 * @returns Elemento JSX do card.
 */
import { Form } from "react-router";
import { Button } from "~/components/Button";

/**
 * Subset de Ministerio usado pelo card.
 */
export type MinisterioMini = { id: string; nome: string; descricao?: string };

/**
 * Subset de Membro (só id + nome).
 */
export type MembroMini = { id: string; nome: string };

/**
 * Props aceitas pelo `<CardMinisterio>`.
 */
export type CardMinisterioProps = {
  /** Ministério a renderizar. */
  ministerio: MinisterioMini;
  /** Primeiros 5 membros (loader entrega este subset). */
  membros: MembroMini[];
  /** Total real de membros (badge mostra este número). */
  totalMembros: number;
  /** Se `true`, mostra botões de Adicionar/Editar/Excluir/Desvincular. */
  canEdit: boolean;
  /** Callback: abrir modal de vincular membro. */
  onAddMembro: () => void;
  /** Callback: abrir modal de excluir membro (não usado — form inline). */
  onRemoveMembro: (membroId: string) => void;
  /** Callback: abrir modal de editar ministério. */
  onEdit: () => void;
  /** Callback: abrir modal de excluir ministério. */
  onDelete: () => void;
};

/**
 * @description Card visual de um ministério com header, lista de membros e ações.
 * @param {CardMinisterioProps} props - Veja `CardMinisterioProps`.
 * @returns {JSX.Element} Elemento JSX do card.
 */
export function CardMinisterio({
  ministerio,
  membros,
  totalMembros,
  canEdit,
  onAddMembro,
  onEdit,
  onDelete,
}: CardMinisterioProps) {
  return (
    <article
      className="border border-slate-200 rounded-lg bg-white p-4 sm:p-6 space-y-3"
      data-testid={`card-ministerio-${ministerio.id}`}
    >
      {/* Header */}
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {ministerio.nome}
          </h2>
          {ministerio.descricao && (
            <p className="text-sm text-slate-600 mt-0.5">
              {ministerio.descricao}
            </p>
          )}
        </div>
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-800"
          aria-label={`${totalMembros} ${
            totalMembros === 1 ? "membro vinculado" : "membros vinculados"
          }`}
        >
          {`${totalMembros} ${totalMembros === 1 ? "membro" : "membros"}`}
        </span>
      </header>

      {/* Lista de membros */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-2">Membros</h3>
        {membros.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum membro vinculado.</p>
        ) : (
          <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white">
            {membros.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between px-3 py-2 gap-2"
              >
                <span className="text-sm text-slate-900">{m.nome}</span>
                {canEdit && (
                  <Form method="post" className="inline">
                    <input
                      type="hidden"
                      name="intent"
                      value="remove-membro"
                    />
                    <input
                      type="hidden"
                      name="ministerioId"
                      value={ministerio.id}
                    />
                    <input type="hidden" name="membroId" value={m.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      aria-label={`Desvincular ${m.nome} de ${ministerio.nome}`}
                    >
                      Desvincular
                    </Button>
                  </Form>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Ações */}
      {canEdit && (
        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-200">
          <Button
            type="button"
            variant="secondary"
            onClick={onAddMembro}
            aria-label={`Adicionar membro ao ministério ${ministerio.nome}`}
          >
            + Adicionar membro
          </Button>
          <div className="flex gap-2 sm:ml-auto">
            <Button type="button" variant="ghost" onClick={onEdit}>
              Editar
            </Button>
            <Button type="button" variant="ghost" onClick={onDelete}>
              Excluir
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
