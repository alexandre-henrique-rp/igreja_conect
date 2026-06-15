/**
 * Componente <ModalSelecionarDiscipulador /> — modal acessível (S03-T05).
 *
 * Modal usado em `DiscipuladoPainel` para **selecionar** o discipulador
 * de um membro (vincular ou reatribuir). Implementa:
 *
 * - **Busca textual** filtra a lista em tempo real (sem debounce — a
 *   lista é pequena no MVP; refinar se passar de 50 itens).
 * - **Radio group** com `<fieldset><legend>` para a11y (WCAG 1.3.1).
 * - **RN-MEM-04:** discipulador com `count >= 12` aparece com
 *   `disabled` e badge "Limite atingido" — não selecionável pela UI.
 *   Service revalida no backend (defense in depth).
 * - **Form** com `intent=assign` + `membroId` + `discipuladorId`
 *   submetido para a action da rota.
 * - **Dois modos:** `vincular` (texto "Vincular") e `reatribuir`
 *   (texto "Reatribuir") — diferença é só o título + label do botão.
 *
 * **Por que busca client-side (sem submit):** a lista vem do loader e
 * é pequena (cargo in [PASTOR, ADMIN, DISCIPULADOR, ...]). Filtrar
 * local é mais responsivo. Quando a igreja tiver 500+ membros,
 * adicionar autocomplete com remote search (refinar em sprint 2+).
 *
 * **Acessibilidade:**
 * - Fieldset/legend agrupa o radio group.
 * - Radio `disabled` é anunciado pelo screen reader.
 * - Badge "Limite" tem `aria-label="Limite atingido"`.
 * - Foco preso delegado ao `<Dialog>` pai.
 *
 * **Estado:** controlado — `open` + `onClose` vêm do pai. A busca e o
 * radio selecionado são internos (useState).
 *
 * @example
 *   const [open, setOpen] = useState(false);
 *   <ModalSelecionarDiscipulador
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     membroId={membro.id}
 *     discipuladores={[
 *       { id: "d1", nome: "João", count: 8 },
 *     ]}
 *     mode="vincular"
 *   />
 *
 * @param props - Props do componente.
 * @returns Elemento JSX do modal (ou null se `open=false`).
 */
import { useState, useId } from "react";
import { Form } from "react-router";
import { Dialog } from "~/components/Dialog";
import { Button } from "~/components/Button";
import { Input } from "~/components/Input";
import { cn } from "~/lib/cn";

/** Limite máximo de discípulos por discipulador (RN-MEM-04). */
export const MAX_DISCIPULOS = 12;

/**
 * Props aceitas pelo `<ModalSelecionarDiscipulador>`.
 */
export type ModalSelecionarDiscipuladorProps = {
  /** Se `true`, renderiza o modal. */
  open: boolean;
  /** Callback de fechamento. */
  onClose: () => void;
  /** ID do membro que receberá o vínculo. */
  membroId: string;
  /** Lista de discipuladores elegíveis (vinda do loader — excl. self e descendentes). */
  discipuladores: { id: string; nome: string; count: number }[];
  /** Modo do modal (altera título + label do botão). */
  mode: "vincular" | "reatribuir";
};

/**
 * @description Modal acessível para escolher discipulador (vincular ou reatribuir).
 * @param {ModalSelecionarDiscipuladorProps} props - Veja `ModalSelecionarDiscipuladorProps`.
 * @returns {JSX.Element | null} Modal ou `null` se `open=false`.
 */
export function ModalSelecionarDiscipulador({
  open,
  onClose,
  membroId,
  discipuladores,
  mode,
}: ModalSelecionarDiscipuladorProps) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const searchId = useId();

  // Filtro textual (case-insensitive). Lista pequena — sem debounce.
  const filtered = discipuladores.filter((d) =>
    d.nome.toLowerCase().includes(search.toLowerCase())
  );

  const isVincular = mode === "vincular";
  const title = isVincular ? "Vincular discipulador" : "Reatribuir discipulador";
  const submitLabel = isVincular ? "Vincular" : "Reatribuir";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      data-testid="modal-selecionar-discipulador"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-vincular"
            variant="primary"
            disabled={!selectedId}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <Form id="form-vincular" method="post" className="space-y-3">
        <input type="hidden" name="intent" value="assign" />
        <input type="hidden" name="membroId" value={membroId} />
        <input
          type="hidden"
          name="discipuladorId"
          value={selectedId ?? ""}
        />

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

        <fieldset>
          <legend className="text-sm font-medium text-slate-700 mb-1">
            Selecionar discipulador
          </legend>
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500 py-2">
              Nenhum discipulador disponível com este nome.
            </p>
          ) : (
            <ul
              role="radiogroup"
              aria-label="Lista de discipuladores"
              className="space-y-1 max-h-64 overflow-y-auto"
            >
              {filtered.map((d) => {
                const isLimit = d.count >= MAX_DISCIPULOS;
                const isSelected = selectedId === d.id;
                return (
                  <li key={d.id}>
                    <label
                      className={cn(
                        "flex items-center gap-2 p-2 rounded border border-slate-200 cursor-pointer",
                        "hover:bg-slate-50",
                        isSelected && "bg-cyan-50 border-cyan-300",
                        isLimit && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <input
                        type="radio"
                        name="discipulador"
                        value={d.id}
                        checked={isSelected}
                        disabled={isLimit}
                        onChange={() => setSelectedId(d.id)}
                        className="text-cyan-700 focus-visible:ring-2 focus-visible:ring-cyan-700"
                      />
                      <span className="flex-1 text-sm text-slate-900">
                        {d.nome}
                      </span>
                      <span
                        className={cn(
                          "text-sm",
                          isLimit ? "text-amber-800 font-semibold" : "text-slate-500"
                        )}
                      >
                        {`${d.count}/${MAX_DISCIPULOS}`}
                      </span>
                      {isLimit && (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800"
                          aria-label="Limite atingido"
                        >
                          Limite
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>
      </Form>
    </Dialog>
  );
}
