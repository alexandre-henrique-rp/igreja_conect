/**
 * Rota /app/visitantes/:id — perfil do visitante (`visitante-detalhe.html` do DS).
 *
 * Mostra contato, dados do acolhimento (origem, preferência, responsável,
 * consentimento LGPD), status do cuidado e a linha do tempo. Ações (campo
 * `intent`):
 *  - `registrar`: adiciona contato ou próxima ação à linha do tempo;
 *  - `concluir`: marca uma próxima ação como concluída;
 *  - `converter`: promove a Congregado/Membro (registra a conversão).
 *
 * Quem já foi convertido é redirecionado ao perfil completo de membro.
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
  Input,
  Select,
} from "~/components/ds";
import { ErrorAlert } from "~/components/ErrorAlert";
import { concluirAcao, converterVisitante, obterAcolhimento, registrarAcolhimento } from "~/lib/acolhimento.server";
import { ORIGEM_LABEL, PREFERENCIA_LABEL, TIPOS_REGISTRO, TIPO_REGISTRO_LABEL, type OrigemVisita, type PreferenciaContato, type TipoRegistro } from "~/lib/schemas/acolhimento";
import { NotFoundError } from "~/lib/errors";
import { getMembroById } from "~/lib/members.server";
import { userContext } from "~/lib/user-context";
import type { Route } from "./+types/visitantes.$id";

export function meta({ data }: Route.MetaArgs) {
  const nome = data?.visitante?.nome ?? "Visitante";
  return [{ title: `${nome} · Visitantes · Igreja Conect` }];
}

const STATUS_BADGE = {
  NOVO: { tone: "info", label: "Novo" },
  ACOMPANHAR: { tone: "warning", label: "Acompanhar" },
  RETORNOU: { tone: "success", label: "Retornou" },
} as const;

const TIPOS_MANUAIS = TIPOS_REGISTRO.filter((t) => t !== "PRIMEIRA_VISITA");

export async function loader({ params, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  try {
    const m = await getMembroById(params.id, user);
    // Quem já foi convertido tem o perfil completo em /app/membros/:id.
    if (m.tipo !== "VISITANTE") throw redirect(`/app/membros/${m.id}`);
    const a = await obterAcolhimento(params.id, user);

    return {
      visitante: {
        id: m.id,
        nome: m.nome,
        email: m.email,
        telefone: m.telefone,
        cidade: m.cidade,
        estado: m.estado,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      },
      acolhimento: {
        status: a.status,
        dataPrimeiraVisita: (a.dataPrimeiraVisita ?? a.createdAt).toISOString(),
        origem: a.origemVisita as OrigemVisita | null,
        preferencia: a.preferenciaContato as PreferenciaContato | null,
        observacoes: a.observacoesVisita,
        consentimentoEm: a.consentimentoContatoEm?.toISOString() ?? null,
        responsavel: a.responsavelAcolhimento,
        ultimoContato: a.ultimoContato
          ? {
              tipo: a.ultimoContato.tipo,
              em: a.ultimoContato.createdAt.toISOString(),
            }
          : null,
        proximaAcao: a.proximaAcao
          ? {
              descricao: a.proximaAcao.descricao,
              prazo: a.proximaAcao.prazo?.toISOString() ?? null,
            }
          : null,
        registros: a.registrosAcolhimento.map((r) => ({
          id: r.id,
          tipo: r.tipo as TipoRegistro,
          descricao: r.descricao,
          prazo: r.prazo?.toISOString() ?? null,
          concluido: r.concluido,
          em: r.createdAt.toISOString(),
          autor: r.autor?.nome ?? null,
        })),
      },
    };
  } catch (e) {
    if (e instanceof NotFoundError)
      throw new Response("Visitante não encontrado.", { status: 404 });
    throw e;
  }
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  try {
    if (intent === "registrar") {
      const tipo = String(form.get("tipo") ?? "");
      const descricao = String(form.get("descricao") ?? "").trim();
      const prazoRaw = String(form.get("prazo") ?? "");
      const fieldErrors: Record<string, string[]> = {};
      if (!(TIPOS_MANUAIS as readonly string[]).includes(tipo))
        fieldErrors.tipo = ["Escolha o tipo de registro."];
      if (descricao.length < 2 || descricao.length > 500)
        fieldErrors.descricao = ["Descreva em 2 a 500 caracteres."];
      let prazo: Date | undefined;
      if (prazoRaw) {
        prazo = new Date(`${prazoRaw}T12:00:00`);
        if (Number.isNaN(prazo.getTime()))
          fieldErrors.prazo = ["Data inválida."];
      }
      if (Object.keys(fieldErrors).length > 0)
        return data({ intent, fieldErrors }, { status: 422 });
      await registrarAcolhimento(
        params.id,
        { tipo: tipo as (typeof TIPOS_REGISTRO)[number], descricao, prazo },
        user,
      );
      return { intent, ok: true as const };
    }

    if (intent === "concluir") {
      await concluirAcao(params.id, String(form.get("registroId") ?? ""), user);
      return { intent, ok: true as const };
    }

    if (intent === "converter") {
      const tipo = String(form.get("tipo") ?? "");
      if (tipo !== "CONGREGADO" && tipo !== "MEMBRO_ATIVO") {
        return data(
          { intent, formError: "Escolha para qual tipo converter." },
          { status: 422 },
        );
      }
      await converterVisitante(params.id, tipo, user);
      return redirect(`/app/membros/${params.id}`);
    }

    return data({ intent, formError: "Ação inválida." }, { status: 400 });
  } catch (e) {
    if (e instanceof NotFoundError)
      return data({ intent, formError: e.message }, { status: 404 });
    throw e;
  }
}

const fmtData = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const fmtDataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function VisitanteDetalhe({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { visitante: v, acolhimento: a } = loaderData;
  const navigation = useNavigation();
  const intentAtual =
    navigation.state === "submitting"
      ? String(navigation.formData?.get("intent") ?? "")
      : "";
  const convertendo =
    intentAtual === "converter"
      ? String(navigation.formData?.get("tipo") ?? "")
      : "";
  const formError =
    actionData && "formError" in actionData ? actionData.formError : undefined;
  const registrarErros =
    actionData &&
    "fieldErrors" in actionData &&
    actionData.intent === "registrar"
      ? (actionData.fieldErrors as Record<string, string[] | undefined>)
      : undefined;
  const local = [v.cidade, v.estado].filter(Boolean).join(", ");
  const badge = STATUS_BADGE[a.status];

  return (
    <div
      className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8"
      data-od-id="visitor-detail-page"
    >
      <Breadcrumb>
        <BreadcrumbItem href="/app/visitantes">Visitantes</BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem current>{v.nome}</BreadcrumbItem>
      </Breadcrumb>

      <header
        className="flex flex-wrap items-center gap-4"
        data-od-id="visitor-profile-header"
      >
        <Avatar name={v.nome} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-fg">
            {v.nome}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Badge tone={badge.tone}>{badge.label}</Badge>
            {a.origem && <span>{ORIGEM_LABEL[a.origem]}</span>}
            <span>Primeira visita em {fmtData(a.dataPrimeiraVisita)}</span>
          </p>
        </div>
        <Button
          as={Link}
          to={`/app/membros/${v.id}/editar`}
          variant="secondary"
        >
          Editar cadastro
        </Button>
      </header>

      {formError && <ErrorAlert tone="error">{formError}</ErrorAlert>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card padding="none" data-od-id="visitor-personal-info">
            <CardHeader
              title="Informações de contato"
              description={`Atualizado em ${fmtData(v.updatedAt)}`}
            />
            <CardBody>
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-muted">
                    Telefone
                  </dt>
                  <dd className="mt-1 text-fg">
                    {v.telefone ?? "Não informado"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-muted">
                    E-mail
                  </dt>
                  <dd className="mt-1 break-all text-fg">
                    {v.email ?? "Não informado"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-muted">
                    Cidade
                  </dt>
                  <dd className="mt-1 text-fg">{local || "Não informada"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-muted">
                    Preferência de contato
                  </dt>
                  <dd className="mt-1 text-fg">
                    {a.preferencia
                      ? PREFERENCIA_LABEL[a.preferencia]
                      : "Sem preferência"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-bold uppercase tracking-wide text-muted">
                    Observações
                  </dt>
                  <dd className="mt-1 whitespace-pre-line text-fg">
                    {a.observacoes ?? "Sem observações."}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-bold uppercase tracking-wide text-muted">
                    Autorização de contato (LGPD)
                  </dt>
                  <dd className="mt-1 text-fg">
                    {a.consentimentoEm ? (
                      <span>
                        <Badge tone="success">Autorizado</Badge> em{" "}
                        {fmtDataHora(a.consentimentoEm)}
                      </span>
                    ) : (
                      <span>
                        <Badge tone="warning">Sem registro</Badge> Obtenha a
                        autorização antes de entrar em contato.
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <Card padding="none" data-od-id="visitor-journey">
            <CardHeader
              title="Jornada de acolhimento"
              description="Registros de contato e próximos passos"
            />
            <CardBody>
              {a.registros.length === 0 ? (
                <EmptyState
                  title="Nenhum registro ainda"
                  description="Adicione o primeiro contato abaixo."
                />
              ) : (
                <ol className="divide-y divide-border">
                  {a.registros.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-start justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-fg">
                          {TIPO_REGISTRO_LABEL[r.tipo] ?? r.tipo}
                          {r.tipo === "PROXIMA_ACAO" && r.concluido && (
                            <span className="ml-2 font-normal text-success">
                              concluída
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-muted">{r.descricao}</p>
                        <p className="mt-0.5 text-xs text-subtle">
                          {r.autor ? `${r.autor} · ` : ""}
                          {r.prazo ? `prazo ${fmtData(r.prazo)}` : null}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <time dateTime={r.em} className="text-xs text-muted">
                          {fmtData(r.em)}
                        </time>
                        {r.tipo === "PROXIMA_ACAO" && !r.concluido && (
                          <Form method="post">
                            <input
                              type="hidden"
                              name="intent"
                              value="concluir"
                            />
                            <input
                              type="hidden"
                              name="registroId"
                              value={r.id}
                            />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              aria-label="Marcar ação como concluída"
                            >
                              Concluir
                            </Button>
                          </Form>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              <Form
                method="post"
                noValidate
                className="mt-5 space-y-3 border-t border-border pt-5"
              >
                <input type="hidden" name="intent" value="registrar" />
                <h3 className="text-sm font-extrabold text-fg">
                  Adicionar registro
                </h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Select
                    name="tipo"
                    label="Tipo"
                    defaultValue="MENSAGEM"
                    error={registrarErros?.tipo?.[0]}
                    options={TIPOS_MANUAIS.map((t) => ({
                      value: t,
                      label: TIPO_REGISTRO_LABEL[t],
                    }))}
                  />
                  <div className="md:col-span-2">
                    <Input
                      name="descricao"
                      label="O que aconteceu ou será feito"
                      placeholder="Ex.: Convidar para a célula Vila Mariana"
                      error={registrarErros?.descricao?.[0]}
                      required
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="sm:w-56">
                    <Input
                      name="prazo"
                      label="Prazo (opcional)"
                      type="date"
                      error={registrarErros?.prazo?.[0]}
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="secondary"
                    loading={intentAtual === "registrar"}
                  >
                    Adicionar registro
                  </Button>
                </div>
              </Form>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card padding="none" data-od-id="visitor-status-card">
            <CardHeader
              title="Status do cuidado"
              actions={<Badge tone={badge.tone}>{badge.label}</Badge>}
            />
            <CardBody>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Responsável</dt>
                  <dd className="text-right font-bold text-fg">
                    {a.responsavel?.nome ?? "Não definido"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Último contato</dt>
                  <dd className="text-right font-bold text-fg">
                    {a.ultimoContato
                      ? fmtDataHora(a.ultimoContato.em)
                      : "Nenhum"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Próxima ação</dt>
                  <dd className="text-right font-bold text-fg">
                    {a.proximaAcao?.descricao ?? "Nenhuma"}
                  </dd>
                </div>
                {a.proximaAcao?.prazo && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Prazo</dt>
                    <dd className="text-right font-bold text-fg">
                      {fmtData(a.proximaAcao.prazo)}
                    </dd>
                  </div>
                )}
              </dl>
            </CardBody>
          </Card>

          <Card padding="none" data-od-id="visitor-quick-actions">
            <CardHeader
              title="Converter em"
              description="Ao converter, o perfil passa a ser o de membro."
            />
            <CardBody>
              <div className="flex flex-col gap-2">
                {(
                  [
                    ["CONGREGADO", "Congregado"],
                    ["MEMBRO_ATIVO", "Membro efetivo"],
                  ] as const
                ).map(([tipo, label]) => (
                  <Form
                    key={tipo}
                    method="post"
                    onSubmit={(e) => {
                      if (
                        !window.confirm(
                          `Converter ${v.nome} em ${label.toLowerCase()}?`,
                        )
                      )
                        e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="intent" value="converter" />
                    <input type="hidden" name="tipo" value={tipo} />
                    <Button
                      type="submit"
                      variant="secondary"
                      fullWidth
                      loading={convertendo === tipo}
                    >
                      {label}
                    </Button>
                  </Form>
                ))}
                <Button
                  as={Link}
                  to={`/app/membros/${v.id}`}
                  variant="ghost"
                  fullWidth
                >
                  Ver cadastro completo
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
