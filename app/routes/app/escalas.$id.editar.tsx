/**
 * Rota /app/escalas/:id/editar — editar escala (`escala-editar.html` do DS).
 *
 * Duas ações (campo `intent`):
 *  - `salvar`: título, data, status, culto vinculado e observação.
 *  - `add-voluntario` / `remover-voluntario`: equipe escalada.
 *
 * O ministério não é editável (os voluntários pertencem a ele). A repetição
 * do mockup é uma ação de geração de escalas (`/app/escalas/novo`), não um
 * campo da escala.
 *
 * RBAC: ADMIN/PASTOR/LIDER_MINISTERIO do ministério (validado no service).
 */
import { Form, Link, data, redirect, useNavigation } from "react-router";
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbSeparator,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "~/components/ds";
import { ErrorAlert } from "~/components/ErrorAlert";
import { prisma } from "~/db/prisma.server";
import { BusinessRuleError, NotFoundError } from "~/lib/errors";
import {
  adicionarVoluntario,
  buscarEscala,
  editarEscala,
  removerVoluntario,
} from "~/lib/escalas.server";
import {
  EscalaEditarSchema,
  EscalaVoluntarioSchema,
  STATUS_ESCALA,
  STATUS_ESCALA_LABEL,
} from "~/lib/schemas/escalas";
import { userContext } from "~/lib/user-context";
import type { Route } from "./+types/escalas.$id.editar";

const CARGOS_EDITAR = ["ADMIN", "PASTOR", "LIDER_MINISTERIO"];

const STATUS_TONE = {
  PENDENTE: "warning",
  CONFIRMADA: "success",
  REALIZADA: "info",
  CANCELADA: "danger",
} as const;

/** Data (UTC) no formato do `<input type="date">` — mesmo critério de `criarEscala`. */
function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDateBR(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function meta({ data }: Route.MetaArgs) {
  const titulo = data?.escala?.titulo ?? "Escala";
  return [{ title: `Editar ${titulo} · Igreja Conect` }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  if (!user.cargo || !CARGOS_EDITAR.includes(user.cargo)) {
    throw new Response("Apenas ADMIN, PASTOR ou LIDER_MINISTERIO podem editar escalas.", { status: 403 });
  }

  try {
    const escala = await buscarEscala(params.id, user);
    const [funcoes, membrosMinisterio, cultos] = await Promise.all([
      prisma.funcaoMinisterio.findMany({
        where: { ministerioId: escala.ministerioId },
        select: { nome: true },
        orderBy: { nome: "asc" },
      }),
      prisma.ministerioMembro.findMany({
        where: { ministerioId: escala.ministerioId },
        select: { membro: { select: { id: true, nome: true } } },
        orderBy: { membro: { nome: "asc" } },
      }),
      prisma.culto.findMany({
        where: { status: { not: "CANCELADO" } },
        select: { id: true, titulo: true, data: true },
        orderBy: { data: "desc" },
        take: 60,
      }),
    ]);

    return {
      escala: { ...escala, dataInput: toDateInput(escala.data), dataBR: formatDateBR(escala.data) },
      funcoes: funcoes.map((f) => f.nome),
      membros: membrosMinisterio.map((m) => m.membro),
      cultos: cultos.map((c) => ({ id: c.id, label: `${c.titulo} — ${formatDateBR(c.data)}` })),
    };
  } catch (e) {
    if (e instanceof NotFoundError) throw new Response("Escala não encontrada.", { status: 404 });
    throw e;
  }
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  const form = await request.formData();
  const values = Object.fromEntries(form) as Record<string, string>;
  const intent = values.intent;

  try {
    if (intent === "salvar") {
      const parsed = EscalaEditarSchema.safeParse(values);
      if (!parsed.success) {
        return data(
          { intent, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>, values },
          { status: 422 },
        );
      }
      await editarEscala(params.id, parsed.data, user);
      return redirect("/app/escalas");
    }

    if (intent === "add-voluntario") {
      const parsed = EscalaVoluntarioSchema.safeParse(values);
      if (!parsed.success) {
        return data(
          { intent, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[] | undefined> },
          { status: 422 },
        );
      }
      await adicionarVoluntario(params.id, parsed.data, user);
      return { intent, ok: true as const };
    }

    if (intent === "remover-voluntario") {
      await removerVoluntario(String(values.voluntarioId ?? ""), user);
      return { intent, ok: true as const };
    }

    return data({ intent, formError: "Ação inválida." }, { status: 400 });
  } catch (e) {
    if (e instanceof NotFoundError) return data({ intent, formError: e.message }, { status: 404 });
    if (e instanceof BusinessRuleError) return data({ intent, formError: e.message }, { status: 422 });
    // P2002: mesmo voluntário na mesma função já escalado.
    if ((e as { code?: string })?.code === "P2002") {
      return data({ intent, formError: "Este voluntário já está escalado nessa função." }, { status: 409 });
    }
    throw e;
  }
}

export default function EditarEscala({ loaderData, actionData }: Route.ComponentProps) {
  const { escala, funcoes, membros, cultos } = loaderData;
  const navigation = useNavigation();
  const intentAtual = navigation.state === "submitting" ? String(navigation.formData?.get("intent") ?? "") : "";

  const erro = actionData && "formError" in actionData ? actionData : undefined;
  const salvarErros =
    actionData && "fieldErrors" in actionData && actionData.intent === "salvar" ? actionData.fieldErrors : undefined;
  const addErros =
    actionData && "fieldErrors" in actionData && actionData.intent === "add-voluntario" ? actionData.fieldErrors : undefined;
  const v = (actionData && "values" in actionData ? actionData.values : undefined) as
    | Record<string, string>
    | undefined;

  const status = escala.status as keyof typeof STATUS_ESCALA_LABEL;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8" data-od-id="edit-schedule-page">
      <Breadcrumb>
        <BreadcrumbItem href="/app/escalas">Escalas</BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem current>Editar escala</BreadcrumbItem>
      </Breadcrumb>

      <PageHeader
        eyebrow={escala.ministerioNome}
        title="Editar escala"
        description={`Editando a escala de ${escala.dataBR} · ${escala.titulo}. Atualize os detalhes e a equipe escalada.`}
        actions={<Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_ESCALA_LABEL[status] ?? escala.status}</Badge>}
      />

      {erro && <ErrorAlert tone="error">{erro.formError}</ErrorAlert>}

      <Form method="post" noValidate data-od-id="edit-schedule-form">
        <input type="hidden" name="intent" value="salvar" />
        <Card padding="lg" className="space-y-5">
          <h2 className="text-base font-extrabold text-fg">1. Contexto da escala</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              name="titulo"
              label="Título"
              defaultValue={v?.titulo ?? escala.titulo}
              error={salvarErros?.titulo?.[0]}
              required
            />
            <Input
              name="data"
              label="Data"
              type="date"
              defaultValue={v?.data ?? escala.dataInput}
              error={salvarErros?.data?.[0]}
              required
            />
            <Select
              name="status"
              label="Status"
              defaultValue={v?.status ?? escala.status}
              error={salvarErros?.status?.[0]}
              options={STATUS_ESCALA.map((s) => ({ value: s, label: STATUS_ESCALA_LABEL[s] }))}
            />
            <Select
              name="cultoId"
              label="Culto vinculado"
              defaultValue={v?.cultoId ?? escala.cultoId ?? ""}
              error={salvarErros?.cultoId?.[0]}
              options={[{ value: "", label: "Nenhum" }, ...cultos.map((c) => ({ value: c.id, label: c.label }))]}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Input
              name="local"
              label="Local"
              placeholder="Ex.: Salão principal"
              defaultValue={v?.local ?? escala.local ?? ""}
              error={salvarErros?.local?.[0]}
            />
            <Input
              name="horaInicio"
              label="Início"
              type="time"
              defaultValue={v?.horaInicio ?? escala.horaInicio ?? ""}
              error={salvarErros?.horaInicio?.[0]}
            />
            <Input
              name="horaFim"
              label="Término"
              type="time"
              defaultValue={v?.horaFim ?? escala.horaFim ?? ""}
              error={salvarErros?.horaFim?.[0]}
            />
          </div>
          <Textarea
            name="observacao"
            label="Observações"
            rows={3}
            defaultValue={v?.observacao ?? escala.observacao ?? ""}
            error={salvarErros?.observacao?.[0]}
          />
          <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
            <Button as={Link} to="/app/escalas" variant="secondary">
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={intentAtual === "salvar"}>
              {intentAtual === "salvar" ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </Card>
      </Form>

      <Card padding="none" data-od-id="edit-schedule-team">
        <CardHeader
          title="2. Equipe escalada"
          description="Quem continuar na escala mantém a confirmação existente."
        />
        <CardBody>
          {escala.voluntarios.length === 0 ? (
            <EmptyState title="Ninguém escalado ainda" description="Adicione voluntários usando o formulário abaixo." />
          ) : (
            <ul className="divide-y divide-border">
              {escala.voluntarios.map((vol) => (
                <li key={vol.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-fg">{vol.membroNome}</p>
                    <p className="text-xs text-muted">{vol.funcao}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={vol.status === "CONFIRMADO" ? "success" : "neutral"}>{vol.status}</Badge>
                    <Form method="post">
                      <input type="hidden" name="intent" value="remover-voluntario" />
                      <input type="hidden" name="voluntarioId" value={vol.id} />
                      <Button type="submit" variant="ghost" size="sm" aria-label={`Remover ${vol.membroNome} da escala`}>
                        Remover
                      </Button>
                    </Form>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Form method="post" noValidate className="mt-5 grid grid-cols-1 gap-3 border-t border-border pt-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <input type="hidden" name="intent" value="add-voluntario" />
            {funcoes.length > 0 ? (
              <Select
                name="funcao"
                label="Função"
                defaultValue=""
                error={addErros?.funcao?.[0]}
                options={[{ value: "", label: "Selecione uma função" }, ...funcoes.map((f) => ({ value: f, label: f }))]}
              />
            ) : (
              <Input name="funcao" label="Função" placeholder="Ex.: Voz" error={addErros?.funcao?.[0]} />
            )}
            <Select
              name="membroId"
              label="Voluntário"
              defaultValue=""
              error={addErros?.membroId?.[0]}
              options={[
                { value: "", label: membros.length ? "Selecione uma pessoa" : "Ministério sem membros" },
                ...membros.map((m) => ({ value: m.id, label: m.nome })),
              ]}
            />
            <Button type="submit" variant="secondary" loading={intentAtual === "add-voluntario"} disabled={membros.length === 0}>
              Adicionar
            </Button>
          </Form>
        </CardBody>
      </Card>
    </div>
  );
}
