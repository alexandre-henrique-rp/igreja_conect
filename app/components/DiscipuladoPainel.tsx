/**
 * Componente <DiscipuladoPainel /> — orquestrador do painel de discipulado (S03-T05).
 *
 * Combina os demais componentes de discipulado em uma visão única
 * usada pela rota `/app/membros/:id/discipulado`:
 *
 * 1. Se **sem discipulador**: card vazio + botão "Vincular a um
 *    discipulador" (abre modal).
 * 2. Se **com discipulador**: card com nome + `<ContadorDiscipulos>`
 *    + botões "Reatribuir" / "Desvincular".
 * 3. **Cadeia** (Pr. → Disc. → Membro): `<CadeiaDiscipulado>` sempre
 *    que houver cadeia.
 * 4. **Lista de discípulos** (quando o foco é o discipulador):
 *    `<ListaDiscipulos>` com botão "Desvincular" por linha.
 * 5. **Modal controlado** por `useState` para Vincular/Reatribuir.
 *
 * **RBAC (UI — camada 1):** `canEdit` esconde botões de ação para
 * perfis sem permissão. O backend revalida (camada 3).
 *
 * **Diferença Vincular vs Reatribuir:** ambos abrem o mesmo modal,
 * passando `mode` diferente. O modal renderiza título + label do
 * botão de submit de acordo.
 *
 * **LGPD:** não renderiza `email`, `telefone` ou outros PII — apenas
 * nome + cargo pastoral.
 *
 * @example
 *   <DiscipuladoPainel
 *     membro={{ id: "m1", nome: "Maria" }}
 *     discipuladorAtual={discipuladorAtual}
 *     discipulosDoDiscipulador={[{ id: "x", nome: "Ana" }]}
 *     cadeia={[{ id: "d1", nome: "João" }]}
 *     discipuladoresDisponiveis={[...]}
 *     canEdit={true}
 *   />
 *
 * @param props - Props do componente.
 * @returns Elemento JSX do painel.
 */
import { useState } from "react";
import { Form, Link } from "react-router";
import { Button } from "~/components/Button";
import { ContadorDiscipulos } from "~/components/ContadorDiscipulos";
import { CadeiaDiscipulado } from "~/components/CadeiaDiscipulado";
import { ListaDiscipulos } from "~/components/ListaDiscipulos";
import { ModalSelecionarDiscipulador } from "~/components/ModalSelecionarDiscipulador";

/**
 * Subset de Membro usado pelo painel — só id + nome. Loader entrega
 * apenas o necessário (LGPD AC-16).
 */
export type PainelMembro = { id: string; nome: string };

/**
 * Props aceitas pelo `<DiscipuladoPainel>`.
 */
export type DiscipuladoPainelProps = {
  /** Membro foco do painel. */
  membro: PainelMembro;
  /** Discipulador atual do membro (null = sem vínculo). */
  discipuladorAtual: PainelMembro | null;
  /** Discípulos atuais do discipulador (vazio se não é discipulador). */
  discipulosDoDiscipulador: PainelMembro[];
  /** Cadeia completa do mais alto (raiz pastoral) ao mais baixo (membro). */
  cadeia: PainelMembro[];
  /** Lista de discipuladores elegíveis para o modal (loader exclui self + descendentes). */
  discipuladoresDisponiveis: { id: string; nome: string; count: number }[];
  /** Se `false`, esconde botões de Vincular/Reatribuir/Desvincular. */
  canEdit: boolean;
};

/**
 * @description Painel de discipulado: orquestra Contador, Cadeia, Lista e Modal.
 * @param {DiscipuladoPainelProps} props - Veja `DiscipuladoPainelProps`.
 * @returns {JSX.Element} Elemento JSX do painel.
 */
export function DiscipuladoPainel({
  membro,
  discipuladorAtual,
  discipulosDoDiscipulador,
  cadeia,
  discipuladoresDisponiveis,
  canEdit,
}: DiscipuladoPainelProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"vincular" | "reatribuir">(
    "vincular"
  );

  return (
    <div className="space-y-4" data-testid="discipulado-painel">
      {/* Card principal: discipulador atual ou vazio */}
      <article
        className="border border-slate-200 rounded-lg bg-white p-4 sm:p-6"
        data-testid="card-discipulador"
      >
        {discipuladorAtual ? (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Discipulador atual
                </h2>
                <p className="text-base text-slate-900 mt-1">
                  {discipuladorAtual.nome}
                </p>
              </div>
              <ContadorDiscipulos atual={discipulosDoDiscipulador.length} />
            </div>

            {canEdit && (
              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-200">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setModalMode("reatribuir");
                    setModalOpen(true);
                  }}
                  type="button"
                >
                  Reatribuir
                </Button>
                <Form method="post" className="inline">
                  <input
                    type="hidden"
                    name="intent"
                    value="unassign"
                  />
                  <input
                    type="hidden"
                    name="membroId"
                    value={membro.id}
                  />
                  <Button
                    type="submit"
                    variant="ghost"
                    aria-label={`Desvincular ${discipuladorAtual.nome}`}
                  >
                    Desvincular
                  </Button>
                </Form>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Situação atual
              </h2>
              <p className="text-sm text-slate-700 mt-1">
                {membro.nome} não possui discipulador vinculado.
              </p>
            </div>
            {canEdit && (
              <Button
                variant="primary"
                onClick={() => {
                  setModalMode("vincular");
                  setModalOpen(true);
                }}
                type="button"
              >
                Vincular a um discipulador
              </Button>
            )}
          </div>
        )}
      </article>

      {/* Discípulos atuais (quando o foco é o discipulador) */}
      {discipuladorAtual && discipulosDoDiscipulador.length > 0 && (
        <article className="border border-slate-200 rounded-lg bg-white p-4 sm:p-6 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Discípulos de {discipuladorAtual.nome} (
            {discipulosDoDiscipulador.length})
          </h2>
          {canEdit ? (
            <ListaDiscipulos discipulos={discipulosDoDiscipulador} />
          ) : (
            <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white">
              {discipulosDoDiscipulador.map((d) => (
                <li key={d.id} className="px-4 py-2 text-sm">
                  <Link
                    to={`/app/membros/${d.id}`}
                    className="text-cyan-700 hover:underline"
                  >
                    {d.nome}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </article>
      )}

      {/* Cadeia (sempre que houver) */}
      {cadeia.length > 0 && (
        <article className="border border-slate-200 rounded-lg bg-white p-4 sm:p-6 space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Cadeia de discipulado
          </h2>
          <CadeiaDiscipulado cadeia={cadeia} />
        </article>
      )}

      {/* Modal controlado */}
      {canEdit && (
        <ModalSelecionarDiscipulador
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          membroId={membro.id}
          discipuladores={discipuladoresDisponiveis}
          mode={modalMode}
        />
      )}
    </div>
  );
}
