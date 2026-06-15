/**
 * Componente <ModalVincularMembro /> — modal de vincular membro (S03-T09).
 *
 * Modal acessível para vincular um membro a um ministério. Recebe a
 * lista de membros **disponíveis** (loader exclui quem já está no
 * ministério) e submete com `intent=add-membro` + `membroId` +
 * `ministerioId`.
 *
 * **Busca client-side:** filtra os membros por nome (sem debounce —
 * lista pequena). Refinar com autocomplete se passar de 50.
 *
 * **Acessibilidade:**
 * - `<label htmlFor>` no campo de busca + select (associados).
 * - `autoFocus` no campo de busca.
 * - Mensagem de lista vazia (`role="status"`).
 *
 * @example
 *   const [open, setOpen] = useState(false);
 *   <ModalVincularMembro
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     ministerioId={ministerio.id}
 *     membrosDisponiveis={membros}
 *   />
 *
 * @param props - Props do componente.
 * @returns Elemento JSX do modal.
 */
import { useId, useState } from "react";
import { Form } from "react-router";
import { Dialog } from "~/components/Dialog";
import { Button } from "~/components/Button";
import { Input } from "~/components/Input";
import { Select } from "~/components/Select";

/**
 * Props aceitas pelo `<ModalVincularMembro>`.
 */
export type ModalVincularMembroProps = {
  /** Se `true`, renderiza o modal. */
  open: boolean;
  /** Callback de fechamento. */
  onClose: () => void;
  /** ID do ministério que receberá o vínculo. */
  ministerioId: string;
  /** Membros elegíveis (loader exclui quem já está no ministério). */
  membrosDisponiveis: { id: string; nome: string }[];
};

/**
 * @description Modal acessível para vincular membro a um ministério.
 * @param {ModalVincularMembroProps} props - Veja props.
 * @returns {JSX.Element | null} Modal ou `null` se `open=false`.
 */
export function ModalVincularMembro({
  open,
  onClose,
  ministerioId,
  membrosDisponiveis,
}: ModalVincularMembroProps) {
  const [search, setSearch] = useState("");
  const searchId = useId();
  const selectId = useId();

  const filtered = membrosDisponiveis.filter((m) =>
    m.nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Vincular membro"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-vincular-membro" variant="primary">
            Vincular
          </Button>
        </>
      }
    >
      <Form id="form-vincular-membro" method="post" className="space-y-3">
        <input type="hidden" name="intent" value="add-membro" />
        <input type="hidden" name="ministerioId" value={ministerioId} />

        <Input
          id={searchId}
          name="search"
          label="Buscar por nome"
          type="search"
          placeholder="Digite o nome..."
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          autoFocus
        />

        {filtered.length === 0 ? (
          <p
            role="status"
            className="text-sm text-slate-500 py-2"
            data-testid="membros-vazio"
          >
            Nenhum membro disponível.
          </p>
        ) : (
          <Select
            id={selectId}
            name="membroId"
            label="Membro"
            options={filtered.map((m) => ({ value: m.id, label: m.nome }))}
            placeholder="Selecione um membro"
            required
          />
        )}
      </Form>
    </Dialog>
  );
}
