/**
 * Rota /app/celulas/:id — detalhe da célula (`celula-detalhe.html` do DS).
 *
 * Mostra apenas dados persistidos: líder, endereço, agenda semanal, objetivo
 * e participantes. Ações: vincular/desvincular participante (ADMIN/PASTOR/
 * SECRETARIO) e excluir célula (ADMIN/PASTOR, só sem participantes).
 *
 * O mockup também traz presença média, relatórios e região/status/capacidade,
 * que não existem no modelo de dados atual e por isso não são exibidos.
 */
import { Form, Link, data, redirect, useNavigation } from "react-router";
import {
  Avatar,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbSeparator,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  KpiCard,
  PageHeader,
  Select,
} from "~/components/ds";
import { ErrorAlert } from "~/components/ErrorAlert";
import { prisma } from "~/db/prisma.server";
import {
  buscarCelula,
  desvincularMembro,
  excluirCelula,
  vincularMembro,
} from "~/lib/celulas.server";
import { BusinessRuleError, NotFoundError } from "~/lib/errors";
import { DIAS_CELULA_LABEL, STATUS_CELULA_LABEL } from "~/lib/schemas/celulas";
import { userContext } from "~/lib/user-context";
import type { Route } from "./+types/celulas.$id";

const CARGOS_GERENCIAR = ["ADMIN", "PASTOR", "SECRETARIO"];

export function meta({ data }: Route.MetaArgs) {
  const nome = data?.celula?.nome ?? "Célula";
  return [{ title: `${nome} · Células · Igreja Conect` }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  try {
    const celula = await buscarCelula(params.id, user);
    const podeGerenciar = !!user.cargo && CARGOS_GERENCIAR.includes(user.cargo);
    const podeExcluir = user.cargo === "ADMIN" || user.cargo === "PASTOR";

    const [vinculos, candidatos] = await Promise.all([
      prisma.membroCelula.findMany({
        where: { celulaId: params.id },
        select: {
          membro: { select: { id: true, nome: true, email: true, tipo: true } },
        },
        orderBy: { membro: { nome: "asc" } },
      }),
      podeGerenciar
        ? prisma.membro.findMany({
            where: { celulas: { none: { celulaId: params.id } } },
            select: { id: true, nome: true },
            orderBy: { nome: "asc" },
            take: 300,
          })
        : Promise.resolve([] as { id: string; nome: string }[]),
    ]);

    return {
      celula,
      participantes: vinculos.map((v) => v.membro),
      candidatos,
      podeGerenciar,
      podeExcluir,
    };
  } catch (e) {
    if (e instanceof NotFoundError)
      throw new Response("Célula não encontrada.", { status: 404 });
    throw e;
  }
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  try {
    if (intent === "vincular") {
      const membroId = String(form.get("membroId") ?? "");
      if (!membroId)
        return data({ formError: "Selecione um membro." }, { status: 422 });
      await vincularMembro(params.id, membroId, user);
      return { ok: true };
    }
    if (intent === "desvincular") {
      await desvincularMembro(
        params.id,
        String(form.get("membroId") ?? ""),
        user,
      );
      return { ok: true };
    }
    if (intent === "excluir") {
      await excluirCelula(params.id, user);
      return redirect("/app/celulas");
    }
    return data({ formError: "Ação inválida." }, { status: 400 });
  } catch (e) {
    if (e instanceof NotFoundError)
      return data({ formError: e.message }, { status: 404 });
    if (e instanceof BusinessRuleError)
      return data({ formError: e.message }, { status: 422 });
    throw e;
  }
}

function formatAgenda(dia: string | null, horario: string | null): string {
  const diaLabel = dia
    ? (DIAS_CELULA_LABEL[dia as keyof typeof DIAS_CELULA_LABEL] ?? dia)
    : null;
  if (diaLabel && horario) return `${diaLabel} às ${horario}`;
  return diaLabel ?? horario ?? "Não definido";
}

export default function CelulaDetalhe({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { celula, participantes, candidatos, podeGerenciar, podeExcluir } =
    loaderData;
  const navigation = useNavigation();
  const intentAtual =
    navigation.state === "submitting"
      ? navigation.formData?.get("intent")
      : null;
  const formError =
    actionData && "formError" in actionData ? actionData.formError : undefined;
  const agenda = formatAgenda(celula.diaSemana, celula.horario);

  return (
    <div
      className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8"
      data-od-id="cell-detail-page"
    >
      <Breadcrumb>
        <BreadcrumbItem href="/app/celulas">Células</BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem current>{celula.nome}</BreadcrumbItem>
      </Breadcrumb>

      <PageHeader
        eyebrow={celula.regiao ? `Célula · ${celula.regiao}` : "Célula"}
        title={celula.nome}
        description={[
          agenda !== "Não definido" ? agenda : null,
          celula.endereco,
          celula.lider ? `Líder ${celula.lider.nome}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            {podeGerenciar && (
              <Button
                as={Link}
                to={`/app/celulas/${celula.id}/editar`}
                variant="secondary"
              >
                Editar
              </Button>
            )}
            {podeExcluir && (
              <Form
                method="post"
                onSubmit={(e) => {
                  if (
                    !window.confirm(
                      `Excluir a célula ${celula.nome}? Esta ação não pode ser desfeita.`,
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="intent" value="excluir" />
                <Button
                  type="submit"
                  variant="danger"
                  loading={intentAtual === "excluir"}
                >
                  Excluir
                </Button>
              </Form>
            )}
          </>
        }
      />

      {formError && <ErrorAlert tone="error">{formError}</ErrorAlert>}

      <section
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        aria-label="Indicadores da célula"
        data-od-id="cell-detail-kpis"
      >
        <KpiCard
          label="Participantes"
          value={celula.totalMembros}
          hint={celula.capacidade ? `de ${celula.capacidade} vagas` : "membros vinculados"}
        />
        <KpiCard label="Encontro semanal" value={agenda} tone="warning" />
        <KpiCard
          label="Líder"
          value={celula.lider?.nome ?? "Sem líder"}
          tone="success"
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          padding="none"
          data-od-id="cell-participants"
        >
          <CardHeader
            title="Participantes"
            eyebrow={`${participantes.length} na célula`}
          />
          <CardBody>
            {participantes.length === 0 ? (
              <EmptyState
                title="Nenhum participante ainda"
                description={
                  podeGerenciar
                    ? "Vincule membros à célula usando o campo abaixo."
                    : "Esta célula ainda não tem participantes."
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {participantes.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={m.nome} size={40} />
                      <div className="min-w-0">
                        <Link
                          to={`/app/membros/${m.id}`}
                          className="block truncate text-sm font-bold text-fg hover:text-accent"
                        >
                          {m.nome}
                        </Link>
                        <p className="truncate text-xs text-muted">
                          {m.email ?? "E-mail não informado"}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {celula.lider?.id === m.id && (
                        <Badge tone="accent">Líder</Badge>
                      )}
                      {podeGerenciar && (
                        <Form method="post">
                          <input
                            type="hidden"
                            name="intent"
                            value="desvincular"
                          />
                          <input type="hidden" name="membroId" value={m.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            aria-label={`Remover ${m.nome} da célula`}
                          >
                            Remover
                          </Button>
                        </Form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {podeGerenciar && (
              <Form
                method="post"
                className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-end"
              >
                <input type="hidden" name="intent" value="vincular" />
                <div className="flex-1">
                  <Select
                    name="membroId"
                    label="Adicionar participante"
                    defaultValue=""
                    options={[
                      {
                        value: "",
                        label: candidatos.length
                          ? "Selecione um membro"
                          : "Nenhum membro disponível",
                      },
                      ...candidatos.map((c) => ({
                        value: c.id,
                        label: c.nome,
                      })),
                    ]}
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  loading={intentAtual === "vincular"}
                  disabled={candidatos.length === 0}
                >
                  Adicionar
                </Button>
              </Form>
            )}
          </CardBody>
        </Card>

        <Card padding="none" data-od-id="cell-info">
          <CardHeader title="Dados da célula" />
          <CardBody>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-muted">
                  Status
                </dt>
                <dd className="mt-1">
                  <Badge
                    tone={
                      celula.status === "ATIVA"
                        ? "success"
                        : celula.status === "EM_FORMACAO"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {STATUS_CELULA_LABEL[celula.status as keyof typeof STATUS_CELULA_LABEL] ?? celula.status}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-muted">
                  Região
                </dt>
                <dd className="mt-1 text-fg">{celula.regiao ?? "Não informada"}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-muted">
                  Endereço
                </dt>
                <dd className="mt-1 text-fg">
                  {celula.endereco ?? "Não informado"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-muted">
                  Agenda
                </dt>
                <dd className="mt-1 text-fg">{agenda}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-muted">
                  Objetivo e observações
                </dt>
                <dd className="mt-1 whitespace-pre-line text-fg">
                  {celula.descricao ?? "Sem observações."}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
