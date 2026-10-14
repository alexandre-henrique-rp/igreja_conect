import { Form, useNavigation } from "react-router";
import { ErrorAlert } from "./ErrorAlert";
import { cn } from "~/lib/cn";
import { InfoBox } from "~/components/ds";

interface DadosManutencao {
  id: string;
  assistenciaTecnica: string;
  dataEnvio: string;
}

export type FormRetornoProps = {
  manutencao: DadosManutencao;
  formError?: string;
  fieldErrors?: Record<string, string>;
};

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function FormRetorno({
  manutencao,
  formError,
  fieldErrors,
}: FormRetornoProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <Form method="post" noValidate className="space-y-5">
      <input type="hidden" name="manutencaoId" value={manutencao.id} />

      {formError && <ErrorAlert tone="error">{formError}</ErrorAlert>}

      <InfoBox tone="info">
        Esta operação marca a manutenção como concluída e atualiza o status
        do item para <strong>DISPONIVEL</strong>.
      </InfoBox>

      <div className="bg-surface-2 border border-border rounded-md p-4 space-y-2">
        <p className="text-sm text-muted">
          <span className="font-medium text-fg">Assistência:</span>{" "}
          {manutencao.assistenciaTecnica}
        </p>
        <p className="text-sm text-muted">
          <span className="font-medium text-fg">Data de envio:</span>{" "}
          {formatDate(manutencao.dataEnvio)}
        </p>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="dataRetorno"
          className="block text-sm font-medium text-fg"
        >
          Data de Retorno
          <span aria-hidden="true" className="text-danger ml-1">*</span>
        </label>
        <input
          id="dataRetorno"
          name="dataRetorno"
          type="date"
          required
          defaultValue={new Date().toISOString().split("T")[0]}
          className={cn(
            "w-full h-11 px-3 rounded-md border bg-surface text-fg",
            "border-border-strong",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            fieldErrors?.dataRetorno && "border-danger"
          )}
          aria-invalid={Boolean(fieldErrors?.dataRetorno)}
          aria-required="true"
        />
        {fieldErrors?.dataRetorno && (
          <p role="alert" className="text-sm text-danger">
            {fieldErrors.dataRetorno}
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
          {isSubmitting ? "Registrando..." : "Registrar Retorno"}
        </button>
      </div>
    </Form>
  );
}
