import { Form, useNavigation } from "react-router";
import { ErrorAlert } from "./ErrorAlert";
import { cn } from "~/lib/cn";

interface ItemEstoqueBasico {
  id: string;
  nome: string;
}

export type FormBaixaProps = {
  item: ItemEstoqueBasico;
  formError?: string;
  fieldErrors?: Record<string, string>;
};

export function FormBaixa({
  item,
  formError,
  fieldErrors,
}: FormBaixaProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <Form method="post" noValidate className="space-y-5">
      <input type="hidden" name="itemId" value={item.id} />

      {formError && <ErrorAlert tone="error">{formError}</ErrorAlert>}

      <div
        role="alert"
        className="rounded-md border border-danger-soft bg-danger-soft p-4 text-sm text-danger"
      >
        <p className="font-medium mb-1">
          Esta operação é <strong>IRREVERSÍVEL</strong>.
        </p>
        <p>
          O item <strong>{item.nome}</strong> será marcado como{" "}
          <strong>BAIXADO</strong> e removido do patrimônio ativo.
        </p>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="motivo"
          className="block text-sm font-medium text-fg"
        >
          Motivo da Baixa
          <span aria-hidden="true" className="text-danger ml-1">*</span>
        </label>
        <textarea
          id="motivo"
          name="motivo"
          required
          rows={4}
          minLength={10}
          maxLength={500}
          className={cn(
            "w-full rounded-md border bg-surface px-3 py-2 text-sm text-fg",
            "border-border-strong placeholder:text-subtle",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            fieldErrors?.motivo && "border-danger"
          )}
          placeholder="Descreva o motivo da baixa (mínimo de 10 caracteres)"
          aria-invalid={Boolean(fieldErrors?.motivo)}
          aria-required="true"
        />
        {fieldErrors?.motivo ? (
          <p role="alert" className="text-sm text-danger">
            {fieldErrors.motivo}
          </p>
        ) : (
          <p className="text-xs text-muted">
            Mínimo de 10 caracteres. Máximo de 500.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "inline-flex items-center justify-center rounded-md bg-danger px-6 h-11",
            "text-sm font-medium text-white hover:bg-danger transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          aria-disabled={isSubmitting}
        >
          {isSubmitting ? "Salvando..." : "Dar Baixa no Item"}
        </button>
      </div>
    </Form>
  );
}
