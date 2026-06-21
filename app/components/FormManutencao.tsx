import { Form, useNavigation } from "react-router";
import { InfoBox } from "./InfoBox";
import { ErrorAlert } from "./ErrorAlert";
import { cn } from "~/lib/cn";

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
          className="block text-sm font-medium text-slate-700"
        >
          Assistência Técnica
          <span aria-hidden="true" className="text-red-700 ml-1">*</span>
        </label>
        <input
          id="assistenciaTecnica"
          name="assistenciaTecnica"
          type="text"
          required
          maxLength={200}
          className={cn(
            "w-full h-11 px-3 rounded-md border bg-white text-slate-900",
            "border-slate-300 placeholder:text-slate-400",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            fieldErrors?.assistenciaTecnica && "border-red-700"
          )}
          placeholder="Nome da empresa ou técnico"
          aria-invalid={Boolean(fieldErrors?.assistenciaTecnica)}
          aria-required="true"
        />
        {fieldErrors?.assistenciaTecnica && (
          <p role="alert" className="text-sm text-red-700">
            {fieldErrors.assistenciaTecnica}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label
          htmlFor="enderecoAssistencia"
          className="block text-sm font-medium text-slate-700"
        >
          Endereço da Assistência
          <span aria-hidden="true" className="text-red-700 ml-1">*</span>
        </label>
        <input
          id="enderecoAssistencia"
          name="enderecoAssistencia"
          type="text"
          required
          maxLength={300}
          className={cn(
            "w-full h-11 px-3 rounded-md border bg-white text-slate-900",
            "border-slate-300 placeholder:text-slate-400",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            fieldErrors?.enderecoAssistencia && "border-red-700"
          )}
          placeholder="Rua, número, bairro, cidade"
          aria-invalid={Boolean(fieldErrors?.enderecoAssistencia)}
          aria-required="true"
        />
        {fieldErrors?.enderecoAssistencia && (
          <p role="alert" className="text-sm text-red-700">
            {fieldErrors.enderecoAssistencia}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label
            htmlFor="numeroOs"
            className="block text-sm font-medium text-slate-700"
          >
            Nº OS / Protocolo
          </label>
          <input
            id="numeroOs"
            name="numeroOs"
            type="text"
            maxLength={50}
            className={cn(
              "w-full h-11 px-3 rounded-md border bg-white text-slate-900",
              "border-slate-300 placeholder:text-slate-400",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              fieldErrors?.numeroOs && "border-red-700"
            )}
            placeholder="Número da ordem de serviço"
            aria-invalid={Boolean(fieldErrors?.numeroOs)}
          />
          {fieldErrors?.numeroOs && (
            <p role="alert" className="text-sm text-red-700">
              {fieldErrors.numeroOs}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label
            htmlFor="prazoTermino"
            className="block text-sm font-medium text-slate-700"
          >
            Previsão de Término
          </label>
          <input
            id="prazoTermino"
            name="prazoTermino"
            type="date"
            className={cn(
              "w-full h-11 px-3 rounded-md border bg-white text-slate-900",
              "border-slate-300",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              fieldErrors?.prazoTermino && "border-red-700"
            )}
            aria-invalid={Boolean(fieldErrors?.prazoTermino)}
          />
          {fieldErrors?.prazoTermino && (
            <p role="alert" className="text-sm text-red-700">
              {fieldErrors.prazoTermino}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="custoCentavos"
          className="block text-sm font-medium text-slate-700"
        >
          Custo Estimado (R$)
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            R$
          </span>
          <input
            id="custoCentavos"
            name="custoCentavos"
            type="number"
            min={0}
            step={1}
            className={cn(
              "w-full h-11 pl-10 pr-3 rounded-md border bg-white text-slate-900",
              "border-slate-300 placeholder:text-slate-400",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              fieldErrors?.custoCentavos && "border-red-700"
            )}
            placeholder="Valor em centavos"
            aria-invalid={Boolean(fieldErrors?.custoCentavos)}
          />
        </div>
        {fieldErrors?.custoCentavos ? (
          <p role="alert" className="text-sm text-red-700">
            {fieldErrors.custoCentavos}
          </p>
        ) : (
          <p className="text-xs text-slate-500">
            Informe o valor em centavos (ex: 1500 = R$ 15,00)
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
          {isSubmitting ? "Enviando..." : "Enviar para Manutenção"}
        </button>
      </div>
    </Form>
  );
}
