import { Form, useNavigation } from "react-router";
import { InfoBox } from "./InfoBox";
import { ErrorAlert } from "./ErrorAlert";
import { cn } from "~/lib/cn";

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
        <legend className="text-sm font-medium text-slate-700 mb-2">
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
                className="text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
              />
              <span className="text-sm text-slate-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1">
        <label
          htmlFor="quantidade"
          className="block text-sm font-medium text-slate-700"
        >
          Quantidade
          <span aria-hidden="true" className="text-red-700 ml-1">*</span>
        </label>
        <input
          id="quantidade"
          name="quantidade"
          type="number"
          min={1}
          required
          defaultValue={1}
          className={cn(
            "w-full h-11 px-3 rounded-md border bg-white text-slate-900",
            "border-slate-300 placeholder:text-slate-400",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            fieldErrors?.quantidade && "border-red-700"
          )}
          aria-invalid={Boolean(fieldErrors?.quantidade)}
          aria-required="true"
        />
        {fieldErrors?.quantidade && (
          <p role="alert" className="text-sm text-red-700">
            {fieldErrors.quantidade}
          </p>
        )}
        <p className="text-xs text-slate-500">
          Saldo atual: <strong>{item.quantidade}</strong>
        </p>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="nomeRetirante"
          className="block text-sm font-medium text-slate-700"
        >
          Nome do Retirante
          <span aria-hidden="true" className="text-red-700 ml-1">*</span>
        </label>
        <input
          id="nomeRetirante"
          name="nomeRetirante"
          type="text"
          required
          maxLength={120}
          className={cn(
            "w-full h-11 px-3 rounded-md border bg-white text-slate-900",
            "border-slate-300 placeholder:text-slate-400",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            fieldErrors?.nomeRetirante && "border-red-700"
          )}
          placeholder="Nome de quem está retirando"
          aria-invalid={Boolean(fieldErrors?.nomeRetirante)}
          aria-required="true"
        />
        {fieldErrors?.nomeRetirante && (
          <p role="alert" className="text-sm text-red-700">
            {fieldErrors.nomeRetirante}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label
          htmlFor="justificativa"
          className="block text-sm font-medium text-slate-700"
        >
          Justificativa
        </label>
        <textarea
          id="justificativa"
          name="justificativa"
          rows={3}
          maxLength={500}
          className={cn(
            "w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900",
            "border-slate-300 placeholder:text-slate-400",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            fieldErrors?.justificativa && "border-red-700"
          )}
          placeholder="Motivo da movimentação (opcional)"
          aria-invalid={Boolean(fieldErrors?.justificativa)}
        />
        {fieldErrors?.justificativa && (
          <p role="alert" className="text-sm text-red-700">
            {fieldErrors.justificativa}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "inline-flex items-center justify-center rounded-md bg-cyan-700 px-6 h-11",
            "text-sm font-medium text-white hover:bg-cyan-800 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2",
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
