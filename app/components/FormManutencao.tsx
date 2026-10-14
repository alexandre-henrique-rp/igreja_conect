import { Form, useNavigation } from "react-router";
import { ErrorAlert } from "./ErrorAlert";
import { cn } from "~/lib/cn";
import { InfoBox } from "~/components/ds";

interface ItemEstoqueManutencao {
  id: string;
  nome: string;
  tipo: string;
  statusPatrimonio: string;
}

export type FormManutencaoProps = {
  item: ItemEstoqueManutencao;
  formError?: string;
  fieldErrors?: Record<string, string>;
};

export function FormManutencao({
  item,
  formError,
  fieldErrors,
}: FormManutencaoProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const jaEmManutencao = item.statusPatrimonio === "EM_MANUTENCAO";

  return (
    <Form method="post" noValidate className="space-y-5">
      <input type="hidden" name="itemId" value={item.id} />

      {formError && <ErrorAlert tone="error">{formError}</ErrorAlert>}

      {jaEmManutencao && (
        <InfoBox tone="warning">
          Este item já está marcado como <strong>EM_MANUTENCAO</strong>.
          O envio criará um novo registro de manutenção.
        </InfoBox>
      )}

      <div className="space-y-1">
        <label
          htmlFor="assistenciaTecnica"
          className="block text-sm font-medium text-fg"
        >
          Assistência Técnica
          <span aria-hidden="true" className="text-danger ml-1">*</span>
        </label>
        <input
          id="assistenciaTecnica"
          name="assistenciaTecnica"
          type="text"
          required
          maxLength={200}
          className={cn(
            "w-full h-11 px-3 rounded-md border bg-surface text-fg",
            "border-border-strong placeholder:text-subtle",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            fieldErrors?.assistenciaTecnica && "border-danger"
          )}
          placeholder="Nome da empresa ou técnico"
          aria-invalid={Boolean(fieldErrors?.assistenciaTecnica)}
          aria-required="true"
        />
        {fieldErrors?.assistenciaTecnica && (
          <p role="alert" className="text-sm text-danger">
            {fieldErrors.assistenciaTecnica}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label
          htmlFor="enderecoAssistencia"
          className="block text-sm font-medium text-fg"
        >
          Endereço da Assistência
          <span aria-hidden="true" className="text-danger ml-1">*</span>
        </label>
        <input
          id="enderecoAssistencia"
          name="enderecoAssistencia"
          type="text"
          required
          maxLength={300}
          className={cn(
            "w-full h-11 px-3 rounded-md border bg-surface text-fg",
            "border-border-strong placeholder:text-subtle",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            fieldErrors?.enderecoAssistencia && "border-danger"
          )}
          placeholder="Rua, número, bairro, cidade"
          aria-invalid={Boolean(fieldErrors?.enderecoAssistencia)}
          aria-required="true"
        />
        {fieldErrors?.enderecoAssistencia && (
          <p role="alert" className="text-sm text-danger">
            {fieldErrors.enderecoAssistencia}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label
            htmlFor="numeroOs"
            className="block text-sm font-medium text-fg"
          >
            Nº OS / Protocolo
          </label>
          <input
            id="numeroOs"
            name="numeroOs"
            type="text"
            maxLength={50}
            className={cn(
              "w-full h-11 px-3 rounded-md border bg-surface text-fg",
              "border-border-strong placeholder:text-subtle",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              fieldErrors?.numeroOs && "border-danger"
            )}
            placeholder="Número da ordem de serviço"
            aria-invalid={Boolean(fieldErrors?.numeroOs)}
          />
          {fieldErrors?.numeroOs && (
            <p role="alert" className="text-sm text-danger">
              {fieldErrors.numeroOs}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label
            htmlFor="prazoTermino"
            className="block text-sm font-medium text-fg"
          >
            Previsão de Término
          </label>
          <input
            id="prazoTermino"
            name="prazoTermino"
            type="date"
            className={cn(
              "w-full h-11 px-3 rounded-md border bg-surface text-fg",
              "border-border-strong",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              fieldErrors?.prazoTermino && "border-danger"
            )}
            aria-invalid={Boolean(fieldErrors?.prazoTermino)}
          />
          {fieldErrors?.prazoTermino && (
            <p role="alert" className="text-sm text-danger">
              {fieldErrors.prazoTermino}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="custoCentavos"
          className="block text-sm font-medium text-fg"
        >
          Custo Estimado (R$)
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle text-sm">
            R$
          </span>
          <input
            id="custoCentavos"
            name="custoCentavos"
            type="number"
            min={0}
            step={1}
            className={cn(
              "w-full h-11 pl-10 pr-3 rounded-md border bg-surface text-fg",
              "border-border-strong placeholder:text-subtle",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              fieldErrors?.custoCentavos && "border-danger"
            )}
            placeholder="Valor em centavos"
            aria-invalid={Boolean(fieldErrors?.custoCentavos)}
          />
        </div>
        {fieldErrors?.custoCentavos ? (
          <p role="alert" className="text-sm text-danger">
            {fieldErrors.custoCentavos}
          </p>
        ) : (
          <p className="text-xs text-muted">
            Informe o valor em centavos (ex: 1500 = R$ 15,00)
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
          {isSubmitting ? "Enviando..." : "Enviar para Manutenção"}
        </button>
      </div>
    </Form>
  );
}
