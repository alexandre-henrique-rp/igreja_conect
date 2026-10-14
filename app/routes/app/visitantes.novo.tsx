/**
 * Rota /app/visitantes/novo — registrar visitante (`visitante-novo.html` do DS).
 *
 * Usa `criarVisitante` (app/lib/acolhimento.server.ts): cria o `Membro` como
 * VISITANTE via `createMembro` (disparando o alerta de acolhimento, RN-MEM-05),
 * grava origem, preferência de contato, responsável e observações, registra a
 * primeira visita na linha do tempo e **grava o consentimento LGPD**
 * (`consentimentoContatoEm`). Sem a caixa de autorização marcada, não salva.
 */
import { Form, Link, data, redirect, useNavigation } from "react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbSeparator,
  Button,
  Card,
  Checkbox,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "~/components/ds";
import { ErrorAlert } from "~/components/ErrorAlert";
import { prisma } from "~/db/prisma.server";
import { criarVisitante } from "~/lib/acolhimento.server";
import { ORIGEM_LABEL, ORIGENS_VISITA, PREFERENCIAS_CONTATO, PREFERENCIA_LABEL } from "~/lib/schemas/acolhimento";
import { EmailDuplicadoError, NotFoundError } from "~/lib/errors";
import { MembroCreateSchema, cleanFormData } from "~/lib/schemas/membros";
import { userContext } from "~/lib/user-context";
import type { Route } from "./+types/visitantes.novo";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Novo visitante · Igreja Conect" }];
}

/** YYYY-MM-DD no fuso local. */
function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  const responsaveis = await prisma.membro.findMany({
    where: { tipo: { not: "VISITANTE" } },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
    take: 300,
  });
  return { responsaveis, hoje: hojeIso() };
}

type Erros = Record<string, string[] | undefined>;

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  const raw = Object.fromEntries(await request.formData()) as Record<
    string,
    string
  >;
  const falha = (fieldErrors: Erros, status = 422) =>
    data({ fieldErrors, values: raw }, { status });
  const erros: Erros = {};

  if (raw.consentimento !== "true") {
    erros.consentimento = ["Confirme a autorização de contato para continuar."];
  }
  const origem = raw.origemVisita || undefined;
  if (origem && !(ORIGENS_VISITA as readonly string[]).includes(origem))
    erros.origemVisita = ["Origem inválida."];
  const preferencia = raw.preferenciaContato || undefined;
  if (
    preferencia &&
    !(PREFERENCIAS_CONTATO as readonly string[]).includes(preferencia)
  ) {
    erros.preferenciaContato = ["Preferência inválida."];
  }
  let dataVisita: Date | undefined;
  if (raw.dataPrimeiraVisita) {
    dataVisita = new Date(`${raw.dataPrimeiraVisita}T12:00:00`);
    if (
      Number.isNaN(dataVisita.getTime()) ||
      dataVisita.getTime() > Date.now() + 24 * 3600 * 1000
    ) {
      erros.dataPrimeiraVisita = [
        "Informe uma data válida, que não seja futura.",
      ];
    }
  }
  if ((raw.observacoesVisita ?? "").length > 1000)
    erros.observacoesVisita = ["Use no máximo 1000 caracteres."];

  const base = MembroCreateSchema.safeParse({
    ...cleanFormData({
      nome: raw.nome,
      email: raw.email,
      telefone: raw.telefone,
      cidade: raw.cidade,
    }),
    tipo: "VISITANTE",
  });
  if (!base.success) Object.assign(erros, base.error.flatten().fieldErrors);
  if (Object.keys(erros).length > 0 || !base.success) return falha(erros);

  try {
    const criado = await criarVisitante(
      {
        base: base.data,
        dataPrimeiraVisita: dataVisita,
        origemVisita: origem as (typeof ORIGENS_VISITA)[number] | undefined,
        preferenciaContato: preferencia as
          | (typeof PREFERENCIAS_CONTATO)[number]
          | undefined,
        responsavelAcolhimentoId: raw.responsavelAcolhimentoId || undefined,
        observacoesVisita: raw.observacoesVisita?.trim() || undefined,
        consentimentoContato: true,
      },
      user,
    );
    return redirect(`/app/visitantes/${criado.id}`);
  } catch (e) {
    if (e instanceof EmailDuplicadoError) {
      return data(
        {
          formError: "Já existe uma pessoa cadastrada com este e-mail.",
          values: raw,
        },
        { status: 409 },
      );
    }
    if (e instanceof NotFoundError)
      return falha({ responsavelAcolhimentoId: [e.message] }, 404);
    throw e;
  }
}

export default function NovoVisitante({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { responsaveis, hoje } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const fieldErrors =
    actionData && "fieldErrors" in actionData
      ? (actionData.fieldErrors as Erros)
      : undefined;
  const formError =
    actionData && "formError" in actionData ? actionData.formError : undefined;
  const v = (
    actionData && "values" in actionData ? actionData.values : undefined
  ) as Record<string, string> | undefined;

  return (
    <div
      className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8"
      data-od-id="new-visitor-page"
    >
      <Breadcrumb>
        <BreadcrumbItem href="/app/visitantes">Visitantes</BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem current>Novo visitante</BreadcrumbItem>
      </Breadcrumb>

      <PageHeader
        title="Registrar novo visitante"
        description="Registre o primeiro contato para que a equipe possa acolher com atenção."
      />

      <Form method="post" noValidate data-od-id="new-visitor-form">
        <Card padding="lg" className="space-y-8">
          {formError && <ErrorAlert tone="error">{formError}</ErrorAlert>}

          <section aria-labelledby="vis-contato" className="space-y-4">
            <h2 id="vis-contato" className="text-base font-extrabold text-fg">
              Dados de contato
            </h2>
            <Input
              name="nome"
              label="Nome completo"
              placeholder="Ex.: Marina Santos"
              defaultValue={v?.nome ?? ""}
              error={fieldErrors?.nome?.[0]}
              required
              autoFocus
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                name="email"
                label="E-mail"
                type="email"
                placeholder="nome@email.com"
                defaultValue={v?.email ?? ""}
                error={fieldErrors?.email?.[0]}
                autoComplete="off"
              />
              <Input
                name="telefone"
                label="Telefone"
                type="tel"
                placeholder="(11) 99999-9999"
                defaultValue={v?.telefone ?? ""}
                error={fieldErrors?.telefone?.[0]}
                autoComplete="off"
              />
              <Input
                name="cidade"
                label="Cidade"
                placeholder="São Paulo"
                defaultValue={v?.cidade ?? ""}
                error={fieldErrors?.cidade?.[0]}
              />
              <Select
                name="preferenciaContato"
                label="Preferência de contato"
                defaultValue={v?.preferenciaContato ?? ""}
                error={fieldErrors?.preferenciaContato?.[0]}
                options={[
                  { value: "", label: "Sem preferência" },
                  ...PREFERENCIAS_CONTATO.map((p) => ({
                    value: p,
                    label: PREFERENCIA_LABEL[p],
                  })),
                ]}
              />
            </div>
          </section>

          <section aria-labelledby="vis-primeiro" className="space-y-4">
            <h2 id="vis-primeiro" className="text-base font-extrabold text-fg">
              Primeiro contato
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                name="dataPrimeiraVisita"
                label="Data da visita"
                type="date"
                max={hoje}
                defaultValue={v?.dataPrimeiraVisita ?? hoje}
                error={fieldErrors?.dataPrimeiraVisita?.[0]}
              />
              <Select
                name="origemVisita"
                label="Como conheceu a igreja"
                defaultValue={v?.origemVisita ?? ""}
                error={fieldErrors?.origemVisita?.[0]}
                options={[
                  { value: "", label: "Não informado" },
                  ...ORIGENS_VISITA.map((o) => ({
                    value: o,
                    label: ORIGEM_LABEL[o],
                  })),
                ]}
              />
              <Select
                name="responsavelAcolhimentoId"
                label="Responsável pelo acompanhamento"
                defaultValue={v?.responsavelAcolhimentoId ?? ""}
                error={fieldErrors?.responsavelAcolhimentoId?.[0]}
                options={[
                  { value: "", label: "Definir depois" },
                  ...responsaveis.map((r) => ({ value: r.id, label: r.nome })),
                ]}
              />
            </div>
            <Textarea
              name="observacoesVisita"
              label="Observações e pedidos"
              rows={3}
              placeholder="Como foi o primeiro contato? Há algum pedido de oração ou necessidade especial?"
              defaultValue={v?.observacoesVisita ?? ""}
              error={fieldErrors?.observacoesVisita?.[0]}
            />
          </section>

          <div className="space-y-2">
            <Checkbox
              name="consentimento"
              value="true"
              required
              defaultChecked={v?.consentimento === "true"}
              label="A pessoa autorizou o contato da igreja para fins de acolhimento."
            />
            {fieldErrors?.consentimento?.[0] && (
              <p role="alert" className="text-xs text-danger">
                {fieldErrors.consentimento[0]}
              </p>
            )}
            <p className="text-xs text-muted">
              A data e a hora da autorização ficam registradas no cadastro.
            </p>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
            <Button as={Link} to="/app/visitantes" variant="secondary">
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar visitante"}
            </Button>
          </div>
        </Card>
      </Form>
    </div>
  );
}
