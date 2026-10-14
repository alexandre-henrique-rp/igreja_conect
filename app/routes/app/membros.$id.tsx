/**
 * Rota /app/membros/:id — detalhe do membro (S02-T07).
 *
 * **Versão S02 (sem abas):** primeira entrega mostra ResumoMembro (nome,
 * tipo, contato, endereço, dados eclesiásticos) + AcoesMembro (Editar
 * + Excluir se ADMIN/PASTOR). S03 adicionará as abas (Dados, Discipulado,
 * Ministérios) e a aba Fidelidade (RN-MEM-03).
 *
 * **RBAC (defense in depth — 3 camadas):**
 * 1. **UI:** `<Can>` esconde botão Excluir para quem não é ADMIN/PASTOR.
 * 2. **Loader:** chama `getMembroById(id, user)` que aplica escopo.
 *    DISCIPULADOR acessando membro de outro → 404 (não 403 — não vaza
 *    existência, ver RAG `security-rbac-matrix` §3.3).
 * 3. **Service:** `getMembroById` valida escopo no nível do `where`.
 *
 * **Action (intent=delete):** só ADMIN/PASTOR (RN-MEM-04). Bloqueia
 * exclusão se há discípulos vinculados (RN-MEM-04 + `deleteMembro`).
 *
 * **LGPD:** payload NUNCA inclui `senhaHash` (RAG `lgpd-igreja-conect`
 * AC-16 — `getMembroById` usa `MEMBRO_SAFE_SELECT`).
 *
 * **ErrorBoundary:** 404 e 403 renderizam mensagem amigável em
 * português (não stack trace).
 *
 * @see app/lib/members.server.ts (getMembroById, deleteMembro)
 * @see design/private-membros-detail.DESIGN.md
 */
import type React from "react";
import { useEffect, useRef, useState } from "react";
import {
  Form,
  Link,
  data,
  isRouteErrorResponse,
  useNavigation,
  useSearchParams,
} from "react-router";
import { Avatar, Badge, Button, EmptyState } from "~/components/ds";
import { ErrorAlert } from "~/components/ErrorAlert";
import { CardFidelidade } from "~/components/fidelidade/CardFidelidade";
import { prisma } from "~/db/prisma.server";
import { getAuditLogsByMembro } from "~/lib/audit.server";
import { criarConvite } from "~/lib/convite.server";
import { BusinessRuleError, NotFoundError } from "~/lib/errors";
import { getFidelidadeFinanceira } from "~/lib/finance.server";
import {
  deleteMembro,
  getMembroAvatarSignedUrl,
  getMembroById,
  toggleDiscipulador,
} from "~/lib/members.server";
import { getBlockedIPs, unblockIP } from "~/lib/rate-limit.server";
import { userContext } from "~/lib/user-context";
import type { Route } from "./+types/membros.$id";

export function meta({ data }: Route.MetaArgs) {
  if (!data?.membro) {
    return [{ title: "Membro não encontrado — Igreja Conect" }];
  }
  return [{ title: `${data.membro.nome} — Igreja Conect` }];
}

/**
 * Loader: busca o membro com escopo RBAC + dados de fidelidade financeira (S08-T05).
 *
 * **DISCIPULADOR fora de escopo** → 404 (camada 2 RBAC).
 *
 * @param args - Loader args do RR7.
 * @returns Membro + canDelete + fidelidadeFinanceira.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  const membro = await getMembroById(params.id, user);
  const canDelete = user.cargo === "ADMIN" || user.cargo === "PASTOR";
  const isAdmin = user.cargo === "ADMIN";
  const canToggleDiscipulador =
    user.cargo === "ADMIN" ||
    user.cargo === "PASTOR" ||
    user.cargo === "SECRETARIO";
  const fidelidadeFinanceira = await getFidelidadeFinanceira(params.id, user);

  // IPs bloqueados (apenas ADMIN vê)
  const blockedIPs = isAdmin ? getBlockedIPs() : [];

  // Avatar (signed URL, 15min). Null se não tem ou se upload foi deletado.
  const avatarSigned = await getMembroAvatarSignedUrl(membro);

  // Discípulos diretos do membro
  const discipulos = await prisma.membro.findMany({
    where: { discipuladorId: params.id },
    select: { id: true, nome: true, tipo: true },
    orderBy: { nome: "asc" },
  });

  // Discipulador atual (se houver)
  let discipuladorAtual: { id: string; nome: string } | null = null;
  if (membro.discipuladorId) {
    const found = await prisma.membro.findUnique({
      where: { id: membro.discipuladorId },
      select: { id: true, nome: true },
    });
    discipuladorAtual = found;
  }

  // Ministérios do membro com flag de líder
  const ministeriosMembro = await prisma.ministerioMembro.findMany({
    where: { membroId: params.id },
    select: {
      lider: true,
      ministerio: { select: { id: true, nome: true } },
    },
    orderBy: { ministerio: { nome: "asc" } },
  });

  // Logs de auditoria (apenas ADMIN)
  const auditLogs = isAdmin ? await getAuditLogsByMembro(params.id, 20) : [];

  return {
    membro,
    canDelete,
    isAdmin,
    canToggleDiscipulador,
    fidelidadeFinanceira,
    blockedIPs,
    avatarSigned,
    discipulos,
    discipuladorAtual,
    ministeriosMembro,
    auditLogs,
  };
}

/**
 * Action: `intent=delete` exclui o membro.
 *
 * **RN-MEM-04:** se há discípulos vinculados, `deleteMembro` lança
 * `BusinessRuleError(409)` — devolvemos 409 com mensagem legível.
 *
 * Sucesso: redirect 302 para `/app/membros` (lista).
 *
 * @param args - Action args do RR7.
 */
export async function action({ params, context, request }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    try {
      await deleteMembro(params.id, user);
      return new Response(null, {
        status: 302,
        headers: { Location: "/app/membros" },
      });
    } catch (e) {
      if (e instanceof BusinessRuleError) {
        return new Response(JSON.stringify({ formError: e.message }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (e instanceof NotFoundError) {
        return new Response(
          JSON.stringify({ formError: "Membro não encontrado." }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        );
      }
      throw e;
    }
  }

  if (intent === "unblock") {
    if (user.cargo !== "ADMIN") {
      return new Response(
        JSON.stringify({
          formError: "Apenas administradores podem desbloquear IPs.",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }
    const ip = formData.get("ip") as string;
    if (ip) {
      // Camada 2 → camada 3: service valida role + IP + loga auditoria
      unblockIP(ip, user);
    }
    return new Response(null, {
      status: 302,
      headers: { Location: `/app/membros/${params.id}` },
    });
  }

  if (intent === "toggle-discipulador") {
    try {
      const updated = await toggleDiscipulador(params.id, user);
      return data({
        toggleDiscipulador: {
          isDiscipulador: updated.isDiscipulador,
          nome: updated.nome,
        },
      });
    } catch (e) {
      if (e instanceof NotFoundError) {
        return data({ formError: "Membro não encontrado." }, { status: 404 });
      }
      throw e;
    }
  }

  if (intent === "gerar-convite") {
    if (user.cargo !== "ADMIN") {
      return new Response(
        JSON.stringify({
          formError: "Apenas administradores podem gerar convites.",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }
    const membro = await getMembroById(params.id, user);
    if (!membro.cargo || !membro.email) {
      return data({
        conviteError: "Membro precisa ter cargo e e-mail para gerar convite.",
      });
    }
    const convite = await criarConvite(membro.id, membro.nome, membro.cargo);
    return data({
      convite: {
        url: convite.url,
        textoConvite: convite.textoConvite,
        membroNome: membro.nome,
      },
    });
  }

  return new Response(
    JSON.stringify({ formError: "Intent não reconhecido." }),
    {
      status: 400,
      headers: { "Content-Type": "application/json" },
    },
  );
}

/**
 * Renderiza preview mínimo do Markdown usado em `criarConvite`.
 *
 * Suporta apenas o subconjunto gerado pelo service:
 * - `*texto*` → `<strong>texto</strong>`
 * - `\n\n`    → novo parágrafo
 * - `\n`      → `<br/>`
 *
 * HTML é escapado antes da transformação para evitar XSS via
 * `membroNome` (campo controlado pelo usuário).
 *
 * @param text - Texto bruto (Markdown WhatsApp/Telegram).
 * @returns Árvore React com parágrafos renderizados.
 */
function renderConvitePreview(text: string): React.ReactNode {
  const escape = (s: string) =>
    s.replace(/[&<>"']/g, (c) => {
      const map: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return map[c] ?? c;
    });

  return text.split(/\n{2,}/).map((paragraph, i) => {
    const html = escape(paragraph)
      .replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br/>");
    return (
      <p
        key={i}
        className="leading-relaxed"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  });
}

/**
 * Formata uma data para PT-BR (dd/mm/aaaa). Retorna "—" se nula.
 */
function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Componente padrão: PageHeader com breadcrumb + Resumo + Ações.
 *
 * **Mobile:** "Editar" e "Excluir" empilham; "Excluir" só aparece
 * para ADMIN/PASTOR.
 */
export default function MembroDetail({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const {
    membro,
    canDelete,
    isAdmin,
    canToggleDiscipulador,
    blockedIPs = [],
    avatarSigned,
    discipulos = [],
    discipuladorAtual,
    ministeriosMembro = [],
    auditLogs = [],
    fidelidadeFinanceira,
  } = loaderData;
  const canSeeFinancials = Boolean(fidelidadeFinanceira);

  // Abas controladas pela URL (?tab=). Fidelidade (RN-MEM-03) só existe quando
  // o loader liberou os dados; Auditoria e Segurança são exclusivas de ADMIN.
  const [searchParams] = useSearchParams();
  const TABS = [
    { key: "dados", label: "Dados" },
    { key: "discipulado", label: "Discipulado" },
    { key: "ministerios", label: "Ministérios" },
    ...(canSeeFinancials ? [{ key: "fidelidade", label: "Fidelidade" }] : []),
    ...(isAdmin
      ? [
          { key: "auditoria", label: "Auditoria" },
          { key: "seguranca", label: "Segurança" },
        ]
      : []),
  ];
  const tabParam = searchParams.get("tab");
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam : "dados";
  const navigation = useNavigation();
  const isDeleting =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "delete";
  const isGerandoConvite =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "gerar-convite";
  const isTogglingDiscipulador =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "toggle-discipulador";

  const [showConviteModal, setShowConviteModal] = useState(false);
  const [showDiscipuladorModal, setShowDiscipuladorModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const modalShownRef = useRef(false);

  const conviteData =
    actionData && "convite" in actionData
      ? (actionData.convite as {
          url: string;
          textoConvite: string;
          membroNome: string;
        })
      : undefined;

  const toggleDiscipuladorResult =
    actionData && "toggleDiscipulador" in actionData
      ? (actionData.toggleDiscipulador as {
          isDiscipulador: boolean;
          nome: string;
        })
      : undefined;

  useEffect(() => {
    if (conviteData && !modalShownRef.current) {
      modalShownRef.current = true;
      setShowConviteModal(true);
    }
  }, [conviteData]);

  useEffect(() => {
    if (toggleDiscipuladorResult) {
      setShowDiscipuladorModal(false);
    }
  }, [toggleDiscipuladorResult]);

  const handleCopy = async () => {
    if (!conviteData) return;
    await navigator.clipboard.writeText(conviteData.textoConvite);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const temAcesso = !!membro.cargo && !!membro.email;

  return (
    <div className="member-detail-page" data-od-id="member-detail-page">
      <header className="profile-head" data-od-id="member-detail-header">
        <Avatar
          name={membro.nome}
          src={avatarSigned?.url ?? undefined}
          size={96}
          alt={`Foto de ${membro.nome}`}
        />
        <div className="profile-copy">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h1>{membro.nome}</h1>
            <Badge tone={membro.status === "Inativo" ? "danger" : "success"}>
              {membro.status ?? "Ativo"}
            </Badge>
            {membro.cargo && <Badge tone="accent">{membro.cargo}</Badge>}
          </div>
          <nav aria-label="Trilha de navegação" className="profile-meta">
            <Link to="/app/membros" className="text-accent hover:underline">
              Membros
            </Link>
            <span aria-hidden="true" className="text-subtle">
              ›
            </span>
            <span aria-current="page">
              Membro desde {formatDate(membro.createdAt)}
            </span>
          </nav>
        </div>
        <div className="profile-actions">
          <Button
            as={Link}
            to={`/app/membros/${membro.id}/editar`}
            variant="primary"
          >
            Editar
          </Button>
          {canToggleDiscipulador && (
            <Button
              type="button"
              variant={membro.isDiscipulador ? "ghost" : "secondary"}
              onClick={() => setShowDiscipuladorModal(true)}
            >
              {membro.isDiscipulador
                ? "Remover Discipulador"
                : "Tornar Discipulador"}
            </Button>
          )}
          {isAdmin && temAcesso && (
            <Form method="post" className="inline">
              <input type="hidden" name="intent" value="gerar-convite" />
              <Button
                type="submit"
                variant="secondary"
                loading={isGerandoConvite}
              >
                Gerar Convite
              </Button>
            </Form>
          )}
          {canDelete && (
            <Form method="post" className="inline">
              <input type="hidden" name="intent" value="delete" />
              <Button
                type="submit"
                variant="danger"
                loading={isDeleting}
                onClick={(e: React.MouseEvent<HTMLElement>) => {
                  if (
                    !window.confirm(
                      `Tem certeza que deseja excluir ${membro.nome}? Esta ação não pode ser desfeita.`,
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                Excluir
              </Button>
            </Form>
          )}
        </div>
      </header>

      <nav
        className="member-detail-tabs"
        data-od-id="member-detail-tabs"
        aria-label="Seções do membro"
      >
        {TABS.map((t) => (
          <Link
            key={t.key}
            to={`/app/membros/${membro.id}?tab=${t.key}`}
            preventScrollReset
            className={tab === t.key ? "active" : undefined}
            aria-current={tab === t.key ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {/* ── Aba Dados ── */}
      {tab === "dados" && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Resumo principal (2/3) */}
        <article className="lg:col-span-2 card p-4 sm:p-6 space-y-4">
          <header className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-fg">Dados cadastrais</h2>
            <TipoBadge tipo={membro.tipo} />
            {membro.cargo ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-success-soft text-success">
                {membro.cargo}
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-2 text-muted">
                Sem acesso ao sistema
              </span>
            )}
          </header>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <DataField label="E-mail" value={membro.email ?? "—"} />
            <DataField label="Telefone" value={membro.telefone ?? "—"} />
            <DataField label="Profissão" value={membro.profissao ?? "—"} />
            <DataField label="Estado civil" value={membro.estadoCivil ?? "—"} />
            <DataField
              label="Data de conversão"
              value={formatDate(membro.dataConversao)}
            />
            <DataField
              label="Data de batismo"
              value={formatDate(membro.dataBatismo)}
            />
          </dl>

          <div>
            <h3 className="text-sm font-semibold text-fg mb-2">Endereço</h3>
            {membro.logradouro || membro.cidade ? (
              <p className="text-sm text-fg">
                {[
                  membro.logradouro,
                  membro.numero ? `nº ${membro.numero}` : null,
                  membro.bairro,
                  membro.cidade,
                  membro.estado,
                ]
                  .filter(Boolean)
                  .join(", ")}
                {membro.cep ? ` — CEP ${membro.cep}` : ""}
              </p>
            ) : (
              <p className="text-sm text-muted">Endereço não informado.</p>
            )}
          </div>

        </article>
        <aside className="space-y-4">
          <div className="card p-4 sm:p-6 space-y-3">
            <h2 className="text-sm font-semibold text-fg">KPIs</h2>
            <Kpi label="Cadastrado em" value={formatDate(membro.createdAt)} />
            <Kpi label="Atualizado em" value={formatDate(membro.updatedAt)} />
            {membro.cargo && (
              <Kpi
                label="Cargo administrativo"
                value={
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent-soft-2 text-accent-strong">
                    {membro.cargo}
                  </span>
                }
              />
            )}
          </div>

        </aside>
      </div>
      )}

      {/* ── Aba Discipulado ── */}
      {tab === "discipulado" && (
        <div className="max-w-3xl space-y-3">
          <div className="card p-4 sm:p-6 space-y-3">
            <h2 className="text-sm font-semibold text-fg flex items-center gap-2">
              <svg
                className="h-4 w-4 text-accent"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              Discipulado
              {membro.isDiscipulador && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent-soft-2 text-accent-strong">
                  Discipulador
                </span>
              )}
            </h2>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted mb-1">
                Discipulador
              </p>
              {discipuladorAtual ? (
                <Link
                  to={`/app/membros/${discipuladorAtual.id}`}
                  className="text-sm text-accent hover:underline"
                >
                  {discipuladorAtual.nome}
                </Link>
              ) : (
                <p className="text-sm text-muted">Sem discipulador</p>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted mb-1">
                Discípulos ({discipulos.length})
              </p>
              {discipulos.length > 0 ? (
                <ul className="space-y-1">
                  {discipulos.map((d) => (
                    <li key={d.id}>
                      <Link
                        to={`/app/membros/${d.id}`}
                        className="text-sm text-accent hover:underline"
                      >
                        {d.nome}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Nenhum discípulo</p>
              )}
            </div>
          </div>
          <Button as={Link} to={`/app/membros/${membro.id}/discipulado`} variant="secondary">
            Gerenciar discipulado
          </Button>
        </div>
      )}

      {/* ── Aba Ministérios ── */}
      {tab === "ministerios" && (
        <div className="max-w-3xl space-y-3">
          <div className="card p-4 sm:p-6 space-y-3">
            <h2 className="text-sm font-semibold text-fg flex items-center gap-2">
              <svg
                className="h-4 w-4 text-warning"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Ministérios
            </h2>
            {ministeriosMembro.length > 0 ? (
              <ul className="space-y-1.5">
                {ministeriosMembro.map((mm) => (
                  <li
                    key={mm.ministerio.id}
                    className="flex items-center gap-2"
                  >
                    <Link
                      to={`/app/ministerios/${mm.ministerio.id}`}
                      className="text-sm text-accent hover:underline"
                    >
                      {mm.ministerio.nome}
                    </Link>
                    {mm.lider && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-warning-soft text-warning">
                        Líder
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Sem ministérios vinculados</p>
            )}
          </div>

          <Button as={Link} to={`/app/membros/${membro.id}/ministerios`} variant="secondary">
            Gerenciar ministérios
          </Button>
        </div>
      )}

      {/* ── Aba Fidelidade (RN-MEM-03): só existe se o loader liberou os dados ── */}
      {tab === "fidelidade" && canSeeFinancials && (
        <section
          id="fidelidade"
          aria-labelledby="fidelidade-titulo"
          className="space-y-4"
          data-od-id="member-detail-fidelidade"
        >
          <h2 id="fidelidade-titulo" className="text-lg font-semibold text-fg">
            Fidelidade e contribuições
          </h2>
          <CardFidelidade data={fidelidadeFinanceira} />
        </section>
      )}

      {/* ── Aba Auditoria (ADMIN) ── */}
      {tab === "auditoria" && isAdmin && (
        <div className="max-w-3xl">
          {isAdmin && auditLogs.length > 0 && (
            <div
              id="auditoria"
              className="card p-4 sm:p-6 space-y-3 scroll-mt-24"
            >
              <h2 className="text-sm font-semibold text-fg flex items-center gap-2">
                <svg
                  className="h-4 w-4 text-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Log de Auditoria
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted border-b border-border">
                      <th className="pb-1 pr-3 font-medium">Ação</th>
                      <th className="pb-1 pr-3 font-medium">Data/Hora</th>
                      <th className="pb-1 pr-3 font-medium">IP (hash)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="text-fg">
                        <td className="py-1.5 pr-3 font-mono">{log.event}</td>
                        <td className="py-1.5 pr-3 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString("pt-BR")}
                        </td>
                        <td className="py-1.5 pr-3 font-mono text-subtle">
                          {log.ipHash ? log.ipHash.slice(0, 12) + "…" : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {auditLogs.length === 0 && (
            <EmptyState title="Nenhum evento registrado" description="As ações sobre este cadastro aparecerão aqui." />
          )}
        </div>
      )}

      {/* ── Aba Segurança (ADMIN) ── */}
      {tab === "seguranca" && isAdmin && (
        <div className="max-w-3xl">
          {isAdmin && (
            <div className="card p-4 sm:p-6 space-y-3">
              <h2 className="text-sm font-semibold text-fg flex items-center gap-2">
                <svg
                  className="h-4 w-4 text-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                Bloqueio de IP
              </h2>
              {blockedIPs.length === 0 ? (
                <p className="text-xs text-muted">
                  Nenhum IP bloqueado no momento.
                </p>
              ) : (
                <div className="space-y-2">
                  {blockedIPs.map((blocked) => (
                    <div
                      key={blocked.ip}
                      className="flex items-center justify-between p-2 bg-danger-soft rounded-lg border border-danger-soft"
                    >
                      <div>
                        <p className="text-xs font-mono text-danger">
                          {blocked.ip}
                        </p>
                        <p className="text-[10px] text-danger">
                          {blocked.count} falhas · expira em{" "}
                          {Math.ceil(blocked.retryAfter / 60)}min
                        </p>
                      </div>
                      <Form method="post" className="inline">
                        <input type="hidden" name="intent" value="unblock" />
                        <input type="hidden" name="ip" value={blocked.ip} />
                        <button
                          type="submit"
                          className="text-xs font-medium text-danger hover:text-danger underline cursor-pointer"
                          onClick={(e: React.MouseEvent<HTMLElement>) => {
                            if (
                              !window.confirm(
                                `Desbloquear o IP ${blocked.ip}? O evento será registrado na auditoria.`,
                              )
                            ) {
                              e.preventDefault();
                            }
                          }}
                        >
                          Desbloquear
                        </button>
                      </Form>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* Modal de Confirmação - Tornar/Remover Discipulador */}
      {showDiscipuladorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDiscipuladorModal(false)}
          />
          <div className="relative bg-surface rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent-soft-2 flex items-center justify-center">
                <svg
                  className="h-5 w-5 text-accent"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-fg">
                  {membro.isDiscipulador
                    ? "Remover Discipulador"
                    : "Tornar Discipulador"}
                </h3>
                <p className="text-sm text-muted">
                  {membro.isDiscipulador
                    ? `${membro.nome} não aparecerá mais na lista de discipuladores.`
                    : `${membro.nome} poderá receber discípulos vinculados a ele.`}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Form method="post" className="flex-1">
                <input
                  type="hidden"
                  name="intent"
                  value="toggle-discipulador"
                />
                <button
                  type="submit"
                  className="w-full h-10 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-strong transition-colors flex items-center justify-center gap-2"
                >
                  {isTogglingDiscipulador
                    ? "Confirmando…"
                    : "Sim, tenho certeza"}
                </button>
              </Form>
              <button
                type="button"
                onClick={() => setShowDiscipuladorModal(false)}
                className="flex-1 h-10 rounded-lg bg-surface-2 text-fg font-medium text-sm hover:bg-border transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Convite */}
      {showConviteModal && conviteData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setShowConviteModal(false);
              modalShownRef.current = false;
            }}
          />
          <div className="relative bg-surface rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-success-soft flex items-center justify-center">
                <svg
                  className="h-5 w-5 text-success"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-fg">Convite gerado!</h3>
                <p className="text-sm text-muted">
                  Compartilhe com {conviteData.membroNome}
                </p>
              </div>
            </div>

            <p className="text-sm text-muted">
              Copie o texto abaixo e envie via <strong>WhatsApp</strong> ou{" "}
              <strong>Telegram</strong>:
            </p>

            <div className="bg-surface-2 border border-border-strong rounded-lg p-4 text-sm text-fg max-h-60 overflow-y-auto space-y-2">
              {renderConvitePreview(conviteData.textoConvite)}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 h-10 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-strong transition-colors flex items-center justify-center gap-2"
              >
                {copied ? (
                  <>
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
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Copiado!
                  </>
                ) : (
                  <>
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
                        d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                      />
                    </svg>
                    Copiar texto
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowConviteModal(false);
                  modalShownRef.current = false;
                }}
                className="flex-1 h-10 rounded-lg bg-surface-2 text-fg font-medium text-sm hover:bg-border transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Sub-componente: badge de tipo (mesmas cores da tabela). */
function TipoBadge({
  tipo,
}: {
  tipo: "VISITANTE" | "CONGREGADO" | "MEMBRO_ATIVO";
}) {
  const classes = {
    VISITANTE: "bg-warning-soft text-warning",
    CONGREGADO: "bg-accent-soft-2 text-accent-strong",
    MEMBRO_ATIVO: "bg-success-soft text-success",
  }[tipo];
  const label = {
    VISITANTE: "Visitante",
    CONGREGADO: "Congregado",
    MEMBRO_ATIVO: "Membro ativo",
  }[tipo];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${classes}`}
    >
      {label}
    </span>
  );
}

/** Sub-componente: campo de dado (label + valor) semântico. */
function DataField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-fg mt-0.5">{value}</dd>
    </div>
  );
}

/** Sub-componente: KPI pequeno. */
function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-fg mt-0.5">{value}</dd>
    </div>
  );
}

/**
 * ErrorBoundary para 404 / 403 / 500 — mensagem amigável em PT-BR.
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Erro";
  let message = "Ocorreu um erro inesperado ao carregar este membro.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Membro não encontrado";
      message =
        "O membro que você procura não existe ou você não tem permissão para vê-lo.";
    } else if (error.status === 403) {
      title = "Acesso negado";
      message = "Você não tem permissão para ver este membro.";
    } else {
      title = `Erro ${error.status}`;
      message = error.statusText || message;
    }
  } else if (error instanceof NotFoundError) {
    title = "Membro não encontrado";
    message =
      "O membro que você procura não existe ou você não tem permissão para vê-lo.";
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <main className="p-4 sm:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-fg mb-2">{title}</h1>
      <ErrorAlert tone="error">{message}</ErrorAlert>
      <div className="mt-4">
        <Button as={Link} to="/app/membros" variant="ghost">
          ← Voltar para a lista
        </Button>
      </div>
    </main>
  );
}
