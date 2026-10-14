/**
 * Componente <FormCelula /> — formulário de célula (criar/editar).
 *
 * Seções "Identificação" e "Agenda e liderança" conforme `celula-nova.html`
 * do Design System. Mostra apenas campos persistidos no model `Celula`.
 *
 * @example
 *   <FormCelula lideres={lideres} submitLabel="Salvar célula" cancelTo="/app/celulas" />
 */
import { Form, Link, useNavigation } from "react-router";
import { Button, Card, Input, Select, Textarea } from "~/components/ds";
import { ErrorAlert } from "~/components/ErrorAlert";
import {
  DIAS_CELULA,
  DIAS_CELULA_LABEL,
  STATUS_CELULA,
  STATUS_CELULA_LABEL,
} from "~/lib/schemas/celulas";

export type FormCelulaProps = {
  /** Membros elegíveis para liderar a célula. */
  lideres: { id: string; nome: string }[];
  /** Valores iniciais (edição ou reexibição após erro). */
  defaultValues?: {
    nome?: string;
    liderId?: string | null;
    endereco?: string | null;
    diaSemana?: string | null;
    horario?: string | null;
    descricao?: string | null;
    regiao?: string | null;
    status?: string | null;
    capacidade?: number | string | null;
  };
  /** Erros por campo vindos do action. */
  fieldErrors?: Record<string, string[] | undefined>;
  /** Erro geral (regra de negócio). */
  formError?: string;
  /** Texto do botão principal. */
  submitLabel: string;
  /** Destino do botão Cancelar. */
  cancelTo: string;
};

/**
 * @description Formulário de célula com seções do DS.
 * @param {FormCelulaProps} props - lideres, defaultValues, erros e rótulos.
 * @returns {JSX.Element} Formulário.
 */
export function FormCelula({
  lideres,
  defaultValues = {},
  fieldErrors,
  formError,
  submitLabel,
  cancelTo,
}: FormCelulaProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <Form method="post" noValidate data-od-id="cell-form">
      <Card padding="lg" className="space-y-8">
        {formError && <ErrorAlert tone="error">{formError}</ErrorAlert>}

        <section aria-labelledby="cel-identificacao" className="space-y-4">
          <h2 id="cel-identificacao" className="text-base font-extrabold text-fg">
            Identificação
          </h2>
          <Input
            name="nome"
            label="Nome da célula"
            placeholder="Ex.: Vila Mariana"
            defaultValue={defaultValues.nome ?? ""}
            error={fieldErrors?.nome?.[0]}
            required
            autoFocus
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              name="regiao"
              label="Região"
              placeholder="Ex.: Zona Sul"
              defaultValue={defaultValues.regiao ?? ""}
              error={fieldErrors?.regiao?.[0]}
            />
            <Select
              name="status"
              label="Status"
              defaultValue={defaultValues.status ?? "ATIVA"}
              error={fieldErrors?.status?.[0]}
              options={STATUS_CELULA.map((s) => ({ value: s, label: STATUS_CELULA_LABEL[s] }))}
            />
          </div>
          <Input
            name="endereco"
            label="Endereço dos encontros"
            placeholder="Rua, número, bairro e cidade"
            defaultValue={defaultValues.endereco ?? ""}
            error={fieldErrors?.endereco?.[0]}
          />
        </section>

        <section aria-labelledby="cel-agenda" className="space-y-4">
          <h2 id="cel-agenda" className="text-base font-extrabold text-fg">
            Agenda e liderança
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              name="liderId"
              label="Líder responsável"
              defaultValue={defaultValues.liderId ?? ""}
              error={fieldErrors?.liderId?.[0]}
              options={[
                { value: "", label: "Sem líder definido" },
                ...lideres.map((l) => ({ value: l.id, label: l.nome })),
              ]}
            />
            <Select
              name="diaSemana"
              label="Dia da semana"
              defaultValue={defaultValues.diaSemana ?? ""}
              error={fieldErrors?.diaSemana?.[0]}
              options={[
                { value: "", label: "Não definido" },
                ...DIAS_CELULA.map((d) => ({
                  value: d,
                  label: DIAS_CELULA_LABEL[d],
                })),
              ]}
            />
            <Input
              name="horario"
              label="Horário"
              type="time"
              defaultValue={defaultValues.horario ?? ""}
              error={fieldErrors?.horario?.[0]}
            />
            <Input
              name="capacidade"
              label="Capacidade de participantes"
              type="number"
              min={1}
              max={500}
              placeholder="Ex.: 16"
              defaultValue={defaultValues.capacidade ?? ""}
              error={fieldErrors?.capacidade?.[0]}
            />
          </div>
          <Textarea
            name="descricao"
            label="Objetivo e observações"
            placeholder="Registre o propósito, o perfil do grupo ou orientações para a liderança."
            defaultValue={defaultValues.descricao ?? ""}
            error={fieldErrors?.descricao?.[0]}
          />
        </section>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <Button as={Link} to={cancelTo} variant="secondary">
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            {isSubmitting ? "Salvando..." : submitLabel}
          </Button>
        </div>
      </Card>
    </Form>
  );
}
