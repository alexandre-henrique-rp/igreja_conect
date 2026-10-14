/**
 * Rota /app/ministerios — lista de ministérios (S03-T10).
 *
 * Estados:
 * - Empty: sem ministérios → ilustração + CTA
 * - Com dados: KPIs + grid de cards + paginação
 * - Erro: capturado via ErrorBoundary
 */
import { useState } from "react";
import { Form, Link } from "react-router";
import { z } from "zod";
import { Button, EmptyState } from "~/components/ds";
import { ModalVincularMembro } from "~/components/ModalVincularMembro";
import { prisma } from "~/db/prisma.server";
import {
  addMembroToMinisterio,
  createMinisterio,
  deleteMinisterio,
  removeMembroFromMinisterio,
} from "~/lib/ministries.server";
import { userContext } from "~/lib/user-context";
import type { Route } from "./+types/ministerios._index";

/** Cargos que podem gerenciar ministérios. */
const CAN_MANAGE = ["ADMIN", "PASTOR", "SECRETARIO"] as const;

const PAGE_SIZE = 6;

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Ministérios · Igreja Conect" }];
}

const CreateSchema = z.object({
  nome: z.string().min(2, "Nome deve ter ao menos 2 caracteres.").max(80),
  descricao: z.string().max(500).optional(),
});

export async function loader({ context, request }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  const canEdit =
    user.cargo != null &&
    (CAN_MANAGE as readonly string[]).includes(user.cargo);

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));

  const [total, rows, membros] = await Promise.all([
    prisma.ministerio.count(),
    prisma.ministerio.findMany({
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        nome: true,
        descricao: true,
        _count: { select: { membros: true } },
        membros: {
          where: { lider: true },
          take: 1,
          orderBy: { membro: { nome: "asc" } },
          select: { membro: { select: { id: true, nome: true } } },
        },
      },
      orderBy: { nome: "asc" },
    }),
    prisma.membro.findMany({
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
      take: 100,
    }),
  ]);

  const vinculados = await prisma.ministerioMembro.findMany({
    where: { ministerioId: { in: rows.map((row) => row.id) } },
    select: { ministerioId: true, membroId: true },
  });
  const vinculadosPorMinisterio = new Map<string, Set<string>>();
  for (const vinculo of vinculados) {
    const ids =
      vinculadosPorMinisterio.get(vinculo.ministerioId) ?? new Set<string>();
    ids.add(vinculo.membroId);
    vinculadosPorMinisterio.set(vinculo.ministerioId, ids);
  }

  const ativos = total;

  return {
    ministerios: rows.map((m) => ({
      id: m.id,
      nome: m.nome,
      descricao: m.descricao,
      totalMembros: m._count.membros,
      lider: m.membros[0]?.membro ?? null,
      membrosDisponiveis: membros.filter(
        (membro) => !vinculadosPorMinisterio.get(m.id)?.has(membro.id),
      ),
    })),
    stats: {
      total,
      ativos,
      comLider: rows.filter((m) => m.membros.length > 0).length,
    },
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
    },
    canEdit,
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  const canEdit =
    user.cargo != null &&
    (CAN_MANAGE as readonly string[]).includes(user.cargo);
  if (!canEdit)
    throw new Response("Sem permissão para gerenciar ministérios.", {
      status: 403,
    });

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const raw = {
      nome: String(formData.get("nome") ?? ""),
      descricao: formData.get("descricao")
        ? String(formData.get("descricao"))
        : undefined,
    };
    const parsed = CreateSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
      }
      return new Response(JSON.stringify({ fieldErrors }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }
    await createMinisterio(
      { nome: parsed.data.nome, descricao: parsed.data.descricao },
      user,
    );
    return new Response(null, {
      status: 302,
      headers: { Location: "/app/ministerios" },
    });
  }

  if (intent === "delete") {
    const ministerioId = String(formData.get("ministerioId") ?? "");
    if (!ministerioId)
      throw new Response("ministerioId obrigatório.", { status: 400 });
    await deleteMinisterio(ministerioId, user);
    return new Response(null, {
      status: 302,
      headers: { Location: "/app/ministerios" },
    });
  }

  if (intent === "add-membro") {
    const ministerioId = String(formData.get("ministerioId") ?? "");
    const membroId = String(formData.get("membroId") ?? "");
    if (!ministerioId || !membroId)
      throw new Response("ministerioId e membroId obrigatórios.", {
        status: 400,
      });
    await addMembroToMinisterio(ministerioId, membroId, user);
    return new Response(null, {
      status: 302,
      headers: { Location: "/app/ministerios" },
    });
  }

  if (intent === "remove-membro") {
    const ministerioId = String(formData.get("ministerioId") ?? "");
    const membroId = String(formData.get("membroId") ?? "");
    if (!ministerioId || !membroId)
      throw new Response("ministerioId e membroId obrigatórios.", {
        status: 400,
      });
    await removeMembroFromMinisterio(ministerioId, membroId, user);
    return new Response(null, {
      status: 302,
      headers: { Location: "/app/ministerios" },
    });
  }

  throw new Response("Intent não reconhecido.", { status: 400 });
}

// ─── Paleta da barra de cor por índice (tokens semânticos do DS) ───
const CARD_COLORS = [
  "bg-info",
  "bg-warning",
  "bg-accent",
  "bg-success",
  "bg-danger",
  "bg-accent-strong",
];

// ─── Ícones SVG inline ───
function IconMinisterio() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  );
}

function IconTeam() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function IconLeader() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
      />
    </svg>
  );
}

// ─── Componente Principal ───
export default function MinisteriosIndex({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { ministerios, stats, pagination, canEdit } = loaderData;
  const [modalVincular, setModalVincular] = useState<{
    ministerioId: string;
    ministerioNome: string;
  } | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const isEmpty = stats.total === 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-fg tracking-tight">
            Ministérios
          </h1>
          <p className="text-sm text-muted mt-1">
            {isEmpty
              ? "Gerencie os departamentos, equipes e voluntários da sua congregação."
              : "Gerencie a estrutura e liderança das frentes de atuação da igreja."}
          </p>
        </div>
        {canEdit && !isEmpty && (
          <Link to="/app/ministerios/novo" className="shrink-0">
            <Button variant="primary" size="sm" className="whitespace-nowrap">
              + Novo Ministério
            </Button>
          </Link>
        )}
      </div>

      {/* ── KPI Cards ── */}
      {isEmpty ? (
        /* Estado vazio: 4 KPIs zerados */
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            {
              icon: <IconMinisterio />,
              label: "Ministérios ativos",
              value: 0,
              color: "bg-accent-soft-2 text-accent",
            },
            {
              icon: <IconTeam />,
              label: "Voluntários escalados",
              value: 0,
              color: "bg-success-soft text-success",
            },
            {
              icon: <IconLeader />,
              label: "Líderes nomeados",
              value: 0,
              color: "bg-warning-soft text-warning",
            },
            {
              icon: (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="1.8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              ),
              label: "Escalas incompletas",
              value: 0,
              color: "bg-warning-soft text-warning",
            },
          ].map((kpi, i) => (
            <div
              key={i}
              className="bg-surface border border-border rounded-xl p-4 flex flex-col items-center text-center gap-2"
            >
              <div className={`p-2 rounded-lg ${kpi.color}`}>{kpi.icon}</div>
              <p className="text-2xl font-extrabold text-fg">{kpi.value}</p>
              <p className="text-xs text-muted font-medium">{kpi.label}</p>
            </div>
          ))}
        </div>
      ) : (
        /* Estado com dados: 3 KPIs */
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-accent-soft-2 text-accent">
              <IconMinisterio />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-subtle">
                Total de Ministérios
              </p>
              <p className="text-3xl font-extrabold text-fg">{stats.total}</p>
            </div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-success-soft text-success">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="1.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-subtle">
                Ministérios Ativos
              </p>
              <p className="text-3xl font-extrabold text-fg">{stats.ativos}</p>
            </div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-warning-soft text-warning">
              <IconLeader />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-subtle">
                Com Líder
              </p>
              <p className="text-3xl font-extrabold text-fg">
                {stats.comLider}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Estado Vazio ── */}
      {isEmpty && (
        <EmptyState
          className="py-12"
          icon={
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          }
          title="Nenhum ministério encontrado"
          description="Comece organizando sua igreja criando o seu primeiro ministério. Você poderá definir líderes, gerenciar voluntários e criar escalas de serviço."
          action={
            canEdit ? (
              <Button as={Link} to="/app/ministerios/novo" variant="primary">
                + Novo Ministério
              </Button>
            ) : undefined
          }
        />
      )}

      {/* ── Grid de Cards ── */}
      {!isEmpty && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {ministerios.map((m, idx) => {
              const cor = CARD_COLORS[idx % CARD_COLORS.length];
              return (
                <article
                  key={m.id}
                  className="bg-surface border border-border rounded-2xl overflow-hidden flex flex-col hover:shadow-md transition-shadow"
                  data-testid={`card-ministerio-${m.id}`}
                >
                  {/* Barra de cor no topo */}
                  <div className={`h-1.5 w-full ${cor}`} aria-hidden="true" />

                  <div className="p-5 flex flex-col flex-1">
                    {/* Nome + Status */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h2 className="text-base font-extrabold text-fg leading-tight">
                        {m.nome}
                      </h2>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-success-soft text-success border border-success-soft shrink-0">
                        ATIVO
                      </span>
                    </div>

                    {/* Descrição */}
                    <p className="text-sm text-muted leading-relaxed flex-1 line-clamp-3 mb-4">
                      {m.descricao || "Sem descrição cadastrada."}
                    </p>

                    {/* Líder + Membros */}
                    <div className="flex items-end justify-between gap-2 pt-3 border-t border-surface-2">
                      <div className="flex items-center gap-2">
                        {m.lider ? (
                          <>
                            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-accent-soft-2 to-accent-soft text-accent-strong text-xs font-bold flex items-center justify-center shrink-0">
                              {m.lider.nome.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">
                                Líder
                              </p>
                              <p className="text-xs font-semibold text-fg truncate max-w-[120px]">
                                {m.lider.nome}
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="h-7 w-7 rounded-full bg-surface-2 text-subtle text-xs flex items-center justify-center shrink-0">
                              <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                strokeWidth="2"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                />
                              </svg>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">
                                Líder
                              </p>
                              <p className="text-xs font-semibold text-subtle">
                                Não definido
                              </p>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">
                          Membros
                        </p>
                        <p className="text-sm font-extrabold text-fg">
                          {m.totalMembros}
                        </p>
                      </div>
                    </div>

                    {/* Ações */}
                    {canEdit && (
                      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-surface-2">
                        <button
                          type="button"
                          onClick={() =>
                            setModalVincular({
                              ministerioId: m.id,
                              ministerioNome: m.nome,
                            })
                          }
                          className="px-2 py-1 text-xs font-semibold text-accent hover:bg-accent-soft-2 rounded-md transition-colors"
                        >
                          Adicionar membro
                        </button>
                        <Link
                          to={`/app/ministerios/${m.id}`}
                          className="p-1.5 text-subtle hover:text-accent rounded-md hover:bg-accent-soft-2 transition-colors"
                          aria-label={`Editar ${m.nome}`}
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth="2"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </Link>

                        {/* Excluir com confirmação inline */}
                        {confirmDelete === m.id ? (
                          <div className="flex items-center gap-1.5 ml-auto">
                            <span className="text-xs text-danger font-medium">
                              Confirmar?
                            </span>
                            <Form method="post" className="inline">
                              <input
                                type="hidden"
                                name="intent"
                                value="delete"
                              />
                              <input
                                type="hidden"
                                name="ministerioId"
                                value={m.id}
                              />
                              <button
                                type="submit"
                                className="text-xs font-bold text-danger hover:text-danger px-2 py-1 rounded hover:bg-danger-soft"
                              >
                                Sim
                              </button>
                            </Form>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(null)}
                              className="text-xs font-bold text-muted hover:text-fg px-2 py-1 rounded hover:bg-surface-2"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(m.id)}
                            className="p-1.5 text-subtle hover:text-danger rounded-md hover:bg-danger-soft transition-colors"
                            aria-label={`Excluir ${m.nome}`}
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              strokeWidth="2"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {/* ── Paginação ── */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">
                Mostrando{" "}
                <span className="font-semibold text-fg">
                  {(pagination.page - 1) * pagination.pageSize + 1}
                </span>{" "}
                a{" "}
                <span className="font-semibold text-fg">
                  {Math.min(
                    pagination.page * pagination.pageSize,
                    pagination.total,
                  )}
                </span>{" "}
                de{" "}
                <span className="font-semibold text-fg">
                  {pagination.total}
                </span>{" "}
                ministérios
              </p>
              <div className="flex items-center gap-1">
                <Link
                  to={`?page=${pagination.page - 1}`}
                  className={
                    pagination.page <= 1
                      ? "pointer-events-none opacity-40 px-3 py-1.5 text-sm text-muted border border-border rounded-md"
                      : "px-3 py-1.5 text-sm text-fg border border-border rounded-md hover:bg-surface-2 transition-colors"
                  }
                  aria-disabled={pagination.page <= 1}
                >
                  ← Anterior
                </Link>

                {Array.from(
                  { length: pagination.totalPages },
                  (_, i) => i + 1,
                ).map((p) => (
                  <Link
                    key={p}
                    to={`?page=${p}`}
                    className={
                      p === pagination.page
                        ? "px-3 py-1.5 text-sm font-bold bg-accent text-white rounded-md"
                        : "px-3 py-1.5 text-sm text-fg border border-border rounded-md hover:bg-surface-2 transition-colors"
                    }
                  >
                    {p}
                  </Link>
                ))}

                <Link
                  to={`?page=${pagination.page + 1}`}
                  className={
                    pagination.page >= pagination.totalPages
                      ? "pointer-events-none opacity-40 px-3 py-1.5 text-sm text-muted border border-border rounded-md"
                      : "px-3 py-1.5 text-sm text-fg border border-border rounded-md hover:bg-surface-2 transition-colors"
                  }
                  aria-disabled={pagination.page >= pagination.totalPages}
                >
                  Próximo →
                </Link>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal vincular membro */}
      {canEdit && modalVincular && (
        <ModalVincularMembro
          open={!!modalVincular}
          onClose={() => setModalVincular(null)}
          ministerioId={modalVincular.ministerioId}
          membrosDisponiveis={
            ministerios.find(
              (ministerio) => ministerio.id === modalVincular.ministerioId,
            )?.membrosDisponiveis ?? []
          }
        />
      )}
    </div>
  );
}

// ── ErrorBoundary ──
export function ErrorBoundary() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-fg">Ministérios</h1>
          <p className="text-sm text-muted mt-1">
            Gerencie os departamentos e lideranças da sua igreja.
          </p>
        </div>
        <Link to="/app/ministerios/novo">
          <Button variant="primary" size="sm" className="whitespace-nowrap">
            + Novo Ministério
          </Button>
        </Link>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-10 flex flex-col items-center text-center max-w-sm mx-auto">
        <div className="h-14 w-14 rounded-full bg-danger-soft text-danger flex items-center justify-center mb-4">
          <svg
            className="h-7 w-7"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-base font-extrabold text-fg mb-2">
          Ops! Ocorreu um erro ao carregar os ministérios
        </h2>
        <p className="text-sm text-muted mb-6">
          Verifique sua conexão ou tente novamente em instantes.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full flex items-center justify-center gap-2 h-10 px-4 bg-accent text-white text-sm font-semibold rounded-lg hover:bg-accent-strong transition-colors mb-3"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Tentar Novamente
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm text-muted hover:text-accent transition-colors font-medium"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          Contatar Suporte
        </button>
      </div>
    </div>
  );
}

// Re-exports para compatibilidade
export type { MinisterioMini } from "~/components/CardMinisterio";
