/**
 * Componente <ModalCriarMinisterio /> — modal de criar/editar ministério (S03-T09).
 *
 * Modal acessível (via `<Dialog>`) com formulário de criação/edição
 * de ministério. Usado em `/app/ministerios` para abrir o form
 * inline (sem navegar para outra página). Submete via POST com
 * `intent=create` ou `intent=update`.
 *
 * **Comportamento:**
 * - `mode="criar"`: campos vazios, hidden `intent=create`, botão "Criar".
 * - `mode="editar"`: preenche com `defaultValues`, hidden `id`,
 *   `intent=update`, botão "Salvar".
 * - `fieldErrors`: erros de validação do backend, exibidos inline.
 *   `nome` é obrigatório (RN-MEM-06 / validação Zod).
 *
 * **Acessibilidade:** foca no input de nome ao abrir (`autoFocus`).
 * Erros de validação com `aria-invalid` e `role="alert"`.
 *
 * **Fechamento:** Cancelar, Esc, click no overlay — todos chamam
 * `onClose`. Submissão é responsabilidade do `<Form>` (RR7).
 *
 * @example
 *   const [open, setOpen] = useState(false);
 *   <ModalCriarMinisterio
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     mode="criar"
 *     fieldErrors={actionData?.fieldErrors}
 *   />
 *
 * @param props - Props do componente.
 * @returns Elemento JSX do modal.
 */
import { Form } from "react-router";
import { Dialog } from "~/components/Dialog";
import { Button } from "~/components/Button";
import { Input } from "~/components/Input";

/**
 * Erros de validação por campo.
 */
export type FieldErrors = {
  nome?: string;
  descricao?: string;
};

/**
 * Props aceitas pelo `<ModalCriarMinisterio>`.
 */
export type ModalCriarMinisterioProps = {
  /** Se `true`, renderiza o modal. */
  open: boolean;
  /** Callback de fechamento. */
  onClose: () => void;
  /** Modo do modal (altera título + label do botão). */
  mode: "criar" | "editar";
  /** Valores iniciais (usados em `mode="editar"`). */
  defaultValues?: { id?: string; nome?: string; descricao?: string };
  /** Erros de validação retornados pela action. */
  fieldErrors?: FieldErrors;
};

/**
 * @description Modal de criar/editar ministério (Form + Dialog).
 * @param {ModalCriarMinisterioProps} props - Veja props.
 * @returns {JSX.Element | null} Modal ou `null` se `open=false`.
 */
export function ModalCriarMinisterio({
  open,
  onClose,
  mode,
  defaultValues,
  fieldErrors,
}: ModalCriarMinisterioProps) {
  const isCriar = mode === "criar";
  const title = isCriar ? "Novo ministério" : "Editar ministério";
  const submitLabel = isCriar ? "Criar" : "Salvar";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-ministerio" variant="primary">
            {submitLabel}
          </Button>
        </>
      }
    >
      <Form id="form-ministerio" method="post" className="space-y-3">
        <input
          type="hidden"
          name="intent"
          value={isCriar ? "create" : "update"}
        />
        {defaultValues?.id && (
          <input type="hidden" name="id" value={defaultValues.id} />
        )}

        <Input
          label="Nome"
          name="nome"
          required
          defaultValue={defaultValues?.nome ?? ""}
          error={fieldErrors?.nome}
          autoFocus
        />

        <Input
          label="Descrição"
          name="descricao"
          defaultValue={defaultValues?.descricao ?? ""}
          error={fieldErrors?.descricao}
          hint="Opcional. Até 500 caracteres."
        />
      </Form>
    </Dialog>
  );
}
