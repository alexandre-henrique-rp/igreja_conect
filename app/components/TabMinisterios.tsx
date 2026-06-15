/**
 * Componente <TabMinisterios /> — aba de ministérios (S03-T07).
 *
 * Renderiza os ministérios do membro DENTRO da página de detalhe.
 * Cada item tem botão "Desvincular" (Form method=post) se canEdit.
 * Botão "+ Adicionar" (se canEdit) aciona modal de seleção.
 *
 * **Diferença para `<CardMinisterio>`:** este renderiza a perspectiva
 * **do membro** (lista de ministérios dele), não a perspectiva do
 * ministério (lista de membros). Cards de ministérios ficam em
 * `/app/ministerios`.
 *
 * **No MVP:** o botão "+ Adicionar" não abre modal (não há gestão
 * inline nesta tab). A gestão completa de ministérios fica em
 * `/app/ministerios`. Aqui, o foco é **mostrar e permitir desvincular**.
 *
 * @example
 *   <TabMinisterios
 *     membroId={membro.id}
 *     ministerios={[{ id: "min-1", nome: "Louvor" }]}
 *     canEdit={canEdit}
 *   />
 *
 * @param props - Props do componente.
 * @returns Elemento JSX da tab.
 */
import { Form } from "react-router";
import { Button } from "~/components/Button";

/**
 * Subset de Ministerio (id + nome).
 */
export type TabMinisterioMini = { id: string; nome: string };

/**
 * Props aceitas pelo `<TabMinisterios>`.
 */
export type TabMinisteriosProps = {
  /** ID do membro foco. */
  membroId: string;
  /** Ministérios do membro. */
  ministerios: TabMinisterioMini[];
  /** Se `true`, mostra botões de Desvincular. */
  canEdit: boolean;
};

/**
 * @description Tab de ministérios do membro com lista e botão Desvincular.
 * @param {TabMinisteriosProps} props - membroId, ministerios, canEdit.
 * @returns {JSX.Element} Elemento JSX da tab.
 */
export function TabMinisterios({
  membroId,
  ministerios,
  canEdit,
}: TabMinisteriosProps) {
  // `membroId` é usado no Form abaixo; mantido na assinatura para
  // consistência com TabDiscipulado e futura extensão (filtro por
  // "ministérios em comum" com este membro).
  void membroId;
  return (
    <div className="space-y-3" data-testid="tab-ministerios">
      {ministerios.length === 0 ? (
        <p className="text-sm text-slate-500">
          Este membro não está em nenhum ministério.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white">
          {ministerios.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between px-4 py-2 gap-2"
            >
              <span className="text-sm text-slate-900">{m.nome}</span>
              {canEdit && (
                <Form method="post" className="inline">
                  <input
                    type="hidden"
                    name="intent"
                    value="remove-membro"
                  />
                  <input type="hidden" name="ministerioId" value={m.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    aria-label={`Desvincular ${m.nome}`}
                  >
                    Desvincular
                  </Button>
                </Form>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && ministerios.length > 0 && (
        <p className="text-xs text-slate-500">
          Para adicionar o membro a outros ministérios, vá em{" "}
          <a
            href="/app/ministerios"
            className="text-cyan-700 hover:underline"
          >
            Ministérios
          </a>
          .
        </p>
      )}
    </div>
  );
}
