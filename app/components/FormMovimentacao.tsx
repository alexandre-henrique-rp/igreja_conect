import { Form, useNavigation } from "react-router";
import { ErrorAlert } from "./ErrorAlert";
import { cn } from "~/lib/cn";
import { InfoBox } from "~/components/ds";

type TipoMovimentacao = "ENTRADA" | "SAIDA";

interface ItemEstoqueBasico {
  id: string;
  nome: string;
  quantidade: number;
  tipo: string;
}

export type FormMovimentacaoProps = {
  item: ItemEstoqueBasico;
  defaultTipo?: TipoMovimentacao;
  formError?: string;
  fieldErrors?: Record<string, string>;
};

const TIPO_OPTIONS: { value: TipoMovimentacao; label: string }[] = [
  { value: "ENTRADA", label: "Entrada" },
  { value: "SAIDA", label: "Saída" },
];

export function FormMovimentacao({
  item,
  defaultTipo = "ENTRADA",
  formError,
  fieldErrors,
}: FormMovimentacaoProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <Form method="post" noValidate className="space-y-5">
      <input type="hidden" name="itemId" value={item.id} />

      {formError && <ErrorAlert tone="error">{formError}</ErrorAlert>}

      {item.tipo !== "CONSUMO" && (
        <InfoBox tone="warning">
          Este item é do tipo <strong>Patrimônio</strong>. Ao registrar uma
          saída, a quantidade será ajustada mas o item permanecerá no
          patrimônio ativo.
        </InfoBox>
      )}

      <fieldset>
        <legend className="text-sm font-medium text-fg mb-2">
          Tipo de Movimentação
        </legend>
        <div className="flex gap-6">
          {TIPO_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 cursor-pointer select-none"
            >
              <input
                type="radio"
                name="tipo"
                value={opt.value}
                defaultChecked={defaultTipo === opt.value}
                className="text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              />
              <span className="text-sm text-fg">{opt.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1">
        <label
          htmlFor="quantidade"
          className="block text-sm font-medium text-fg"
        >
          Quantidade
          <span aria-hidden="true" className="text-danger ml-1">*</span>
        </label>
        <input
          id="quantidade"
          name="quantidade"
          type="number"
          min={1}
          required
          defaultValue={1}
          className={cn(
            "w-full h-11 px-3 rounded-md border bg-surface text-fg",
            "border-border-strong placeholder:text-subtle",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            fieldErrors?.quantidade && "border-danger"
          )}
          aria-invalid={Boolean(fieldErrors?.quantidade)}
          aria-required="true"
        />
        {fieldErrors?.quantidade && (
          <p role="alert" className="text-sm text-danger">
            {fieldErrors.quantidade}
          </p>
        )}
        <p className="text-xs text-muted">
          Saldo atual: <strong>{item.quantidade}</strong>
        </p>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="nomeRetirante"
          className="block text-sm font-medium text-fg"
        >
          Nome do Retirante
          <span aria-hidden="true" className="text-danger ml-1">*</span>
        </label>
        <input
          id="nomeRetirante"
          name="nomeRetirante"
          type="text"
          required
          maxLength={120}
          className={cn(
            "w-full h-11 px-3 rounded-md border bg-surface text-fg",
            "border-border-strong placeholder:text-subtle",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            fieldErrors?.nomeRetirante && "border-danger"
          )}
          placeholder="Nome de quem está retirando"
          aria-invalid={Boolean(fieldErrors?.nomeRetirante)}
          aria-required="true"
        />
        {fieldErrors?.nomeRetirante && (
          <p role="alert" className="text-sm text-danger">
            {fieldErrors.nomeRetirante}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label
          htmlFor="justificativa"
          className="block text-sm font-medium text-fg"
        >
          Justificativa
        </label>
        <textarea
          id="justificativa"
          name="justificativa"
          rows={3}
          maxLength={500}
          className={cn(
            "w-full rounded-md border bg-surface px-3 py-2 text-sm text-fg",
            "border-border-strong placeholder:text-subtle",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            fieldErrors?.justificativa && "border-danger"
          )}
          placeholder="Motivo da movimentação (opcional)"
          aria-invalid={Boolean(fieldErrors?.justificativa)}
        />
        {fieldErrors?.justificativa && (
          <p role="alert" className="text-sm text-danger">
            {fieldErrors.justificativa}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "inline-flex items-center justify-center rounded-md bg-accent px-6 h-11",
            "text-sm font-medium text-white hover:bg-accent-strong transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          aria-disabled={isSubmitting}
        >
          {isSubmitting ? "Salvando..." : "Registrar Movimentação"}
        </button>
      </div>
    </Form>
  );
}
