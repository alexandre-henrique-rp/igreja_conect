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
import { Form, Link, isRouteErrorResponse, useNavigation } from "react-router";
import { data } from "react-router";
import type React from "react";
import { useState, useRef, useEffect } from "react";
import type { Route } from "./+types/membros.$id";
import { userContext } from "~/lib/user-context";
import {
  getMembroAvatarSignedUrl,
  getMembroById,
  deleteMembro,
  toggleDiscipulador,
} from "~/lib/members.server";
import { getFidelidadeFinanceira } from "~/lib/finance.server";
import { getAuditLogsByMembro } from "~/lib/audit.server";
import { BusinessRuleError, NotFoundError } from "~/lib/errors";
import { getBlockedIPs, unblockIP } from "~/lib/rate-limit.server";
import { criarConvite } from "~/lib/convite.server";
import { prisma } from "~/db/prisma.server";
import { Breadcrumb } from "~/components/Breadcrumb";
import { Button } from "~/components/Button";
import { ErrorAlert } from "~/components/ErrorAlert";
import { PageHeader } from "~/components/PageHeader";

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
  const canToggleDiscipulador = user.cargo === "ADMIN" || user.cargo === "PASTOR" || user.cargo === "SECRETARIO";
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
        return new Response(
          JSON.stringify({ formError: e.message }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      }
      if (e instanceof NotFoundError) {
        return new Response(
          JSON.stringify({ formError: "Membro não encontrado." }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      throw e;
    }
  }

  if (intent === "unblock") {
    if (user.cargo !== "ADMIN") {
      return new Response(
        JSON.stringify({ formError: "Apenas administradores podem desbloquear IPs." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
    const ip = formData.get("ip") as string;
    if (ip) {
      unblockIP(ip);
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
        JSON.stringify({ formError: "Apenas administradores podem gerar convites." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
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

  return new Response(JSON.stringify({ formError: "Intent não reconhecido." }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
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
export default function MembroDetail({ loaderData, actionData }: Route.ComponentProps) {
  const { membro, canDelete, isAdmin, canToggleDiscipulador, blockedIPs, avatarSigned, discipulos, discipuladorAtual, ministeriosMembro, auditLogs } = loaderData;
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
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Avatar grande + header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="h-24 w-24 rounded-full overflow-hidden bg-slate-50 border border-slate-300 flex items-center justify-center shrink-0">
          {avatarSigned?.url ? (
            <img
              src={avatarSigned.url}
              alt={`Foto de ${membro.nome}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <svg
              className="h-10 w-10 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight truncate">
            {membro.nome}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-sm flex-wrap text-slate-500">
            <nav aria-label="Trilha de navegação">
              <ol className="flex items-center gap-1 text-sm flex-wrap">
                <li className="flex items-center gap-1">
                  <Link
                    to="/app/membros"
                    className="text-cyan-700 hover:underline"
                  >
                    Membros
                  </Link>
                  <span className="text-slate-400" aria-hidden="true">
                    ›
                  </span>
                </li>
                <li>
                  <span
                    className="font-medium text-slate-900"
                    aria-current="page"
                  >
                    {membro.nome}
                  </span>
                </li>
              </ol>
            </nav>
          </div>
        </div>
      </div>

      <PageHeader
        title=""
        action={
          <div className="flex flex-col sm:flex-row gap-2">
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
                variant={membro.isDiscipulador ? "ghost" : "blue"}
                onClick={() => setShowDiscipuladorModal(true)}
              >
                {membro.isDiscipulador ? "Remover Discipulador" : "Tornar Discipulador"}
              </Button>
            )}
            {isAdmin && temAcesso && (
              <Form method="post" className="inline">
                <input type="hidden" name="intent" value="gerar-convite" />
                <Button
                  type="submit"
                  variant="blue"
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
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Resumo principal (2/3) */}
        <article className="lg:col-span-2 border border-slate-300 rounded-lg bg-white p-4 sm:p-6 space-y-4">
          <header className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-slate-900">
              Dados cadastrais
            </h2>
            <TipoBadge tipo={membro.tipo} />
            {membro.cargo ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                {membro.cargo}
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">
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
            <h3 className="text-sm font-semibold text-slate-900 mb-2">
              Endereço
            </h3>
            {membro.logradouro || membro.cidade ? (
              <p className="text-sm text-slate-700">
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
              <p className="text-sm text-slate-500">Endereço não informado.</p>
            )}
          </div>

          {/* Card Discipulado (abaixo do endereço) */}
          <div className="border border-slate-300 rounded-lg bg-white p-4 sm:p-6 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <svg className="h-4 w-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Discipulado
              {membro.isDiscipulador && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                  Discipulador
                </span>
              )}
            </h2>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Discipulador</p>
              {discipuladorAtual ? (
                <Link
                  to={`/app/membros/${discipuladorAtual.id}`}
                  className="text-sm text-cyan-700 hover:underline"
                >
                  {discipuladorAtual.nome}
                </Link>
              ) : (
                <p className="text-sm text-slate-500">Sem discipulador</p>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                Discípulos ({discipulos.length})
              </p>
              {discipulos.length > 0 ? (
                <ul className="space-y-1">
                  {discipulos.map((d) => (
                    <li key={d.id}>
                      <Link
                        to={`/app/membros/${d.id}`}
                        className="text-sm text-cyan-700 hover:underline"
                      >
                        {d.nome}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Nenhum discípulo</p>
              )}
            </div>
          </div>
        </article>

        {/* Sidebar info (1/3) */}
        <aside className="space-y-4">
          <div className="border border-slate-300 rounded-lg bg-white p-4 sm:p-6 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">KPIs</h2>
            <Kpi label="Cadastrado em" value={formatDate(membro.createdAt)} />
            <Kpi
              label="Atualizado em"
              value={formatDate(membro.updatedAt)}
            />
            {membro.cargo && (
              <Kpi
                label="Cargo administrativo"
                value={
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-800">
                    {membro.cargo}
                  </span>
                }
              />
            )}
          </div>

          {/* Bloqueio de IP (só ADMIN) */}
          {isAdmin && (
            <div className="border border-slate-300 rounded-lg bg-white p-4 sm:p-6 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Bloqueio de IP
              </h2>
              {blockedIPs.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhum IP bloqueado no momento.</p>
              ) : (
                <div className="space-y-2">
                  {blockedIPs.map((blocked) => (
                    <div key={blocked.ip} className="flex items-center justify-between p-2 bg-red-50 rounded-lg border border-red-100">
                      <div>
                        <p className="text-xs font-mono text-red-700">{blocked.ip}</p>
                        <p className="text-[10px] text-red-500">
                          {blocked.count} falhas · expira em {Math.ceil(blocked.retryAfter / 60)}min
                        </p>
                      </div>
                      <Form method="post" className="inline">
                        <input type="hidden" name="intent" value="unblock" />
                        <input type="hidden" name="ip" value={blocked.ip} />
                        <button
                          type="submit"
                          className="text-xs font-medium text-red-600 hover:text-red-800 underline cursor-pointer"
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

          {/* Card Ministérios */}
          <div className="border border-slate-300 rounded-lg bg-white p-4 sm:p-6 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <svg className="h-4 w-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Ministérios
            </h2>
            {ministeriosMembro.length > 0 ? (
              <ul className="space-y-1.5">
                {ministeriosMembro.map((mm) => (
                  <li key={mm.ministerio.id} className="flex items-center gap-2">
                    <Link
                      to={`/app/ministerios/${mm.ministerio.id}`}
                      className="text-sm text-cyan-700 hover:underline"
                    >
                      {mm.ministerio.nome}
                    </Link>
                    {mm.lider && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                        Líder
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Sem ministérios vinculados</p>
            )}
          </div>

          {/* Card Log de Auditoria (só ADMIN) */}
          {isAdmin && auditLogs.length > 0 && (
            <div className="border border-slate-300 rounded-lg bg-white p-4 sm:p-6 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Log de Auditoria
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="pb-1 pr-3 font-medium">Ação</th>
                      <th className="pb-1 pr-3 font-medium">Data/Hora</th>
                      <th className="pb-1 pr-3 font-medium">IP (hash)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="text-slate-700">
                        <td className="py-1.5 pr-3 font-mono">{log.event}</td>
                        <td className="py-1.5 pr-3 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString("pt-BR")}
                        </td>
                        <td className="py-1.5 pr-3 font-mono text-slate-400">
                          {log.ipHash ? log.ipHash.slice(0, 12) + "…" : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Modal de Confirmação - Tornar/Remover Discipulador */}
      {showDiscipuladorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDiscipuladorModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {membro.isDiscipulador ? "Remover Discipulador" : "Tornar Discipulador"}
                </h3>
                <p className="text-sm text-slate-500">
                  {membro.isDiscipulador
                    ? `${membro.nome} não aparecerá mais na lista de discipuladores.`
                    : `${membro.nome} poderá receber discípulos vinculados a ele.`}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Form method="post" className="flex-1">
                <input type="hidden" name="intent" value="toggle-discipulador" />
                <button
                  type="submit"
                  className="w-full h-10 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                  {isTogglingDiscipulador ? "Confirmando…" : "Sim, tenho certeza"}
                </button>
              </Form>
              <button
                type="button"
                onClick={() => setShowDiscipuladorModal(false)}
                className="flex-1 h-10 rounded-lg bg-slate-100 text-slate-700 font-medium text-sm hover:bg-slate-200 transition-colors"
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
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowConviteModal(false); modalShownRef.current = false; }} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Convite gerado!</h3>
                <p className="text-sm text-slate-500">Compartilhe com {conviteData.membroNome}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              Copie o texto abaixo e envie via <strong>WhatsApp</strong> ou <strong>Telegram</strong>:
            </p>

            <div className="bg-slate-50 border border-slate-300 rounded-lg p-4 text-sm text-slate-700 max-h-60 overflow-y-auto space-y-2">
              {renderConvitePreview(conviteData.textoConvite)}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 h-10 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                {copied ? (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Copiado!
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copiar texto
                  </>
                )}
              </button>
              <button
                onClick={() => { setShowConviteModal(false); modalShownRef.current = false; }}
                className="flex-1 h-10 rounded-lg bg-slate-100 text-slate-700 font-medium text-sm hover:bg-slate-200 transition-colors"
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
    VISITANTE: "bg-amber-100 text-amber-800",
    CONGREGADO: "bg-blue-100 text-blue-800",
    MEMBRO_ATIVO: "bg-green-100 text-green-800",
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
      <dt className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="text-slate-900 mt-0.5">{value}</dd>
    </div>
  );
}

/** Sub-componente: KPI pequeno. */
function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="text-slate-900 mt-0.5">{value}</dd>
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
      message = "O membro que você procura não existe ou você não tem permissão para vê-lo.";
    } else if (error.status === 403) {
      title = "Acesso negado";
      message = "Você não tem permissão para ver este membro.";
    } else {
      title = `Erro ${error.status}`;
      message = error.statusText || message;
    }
  } else if (error instanceof NotFoundError) {
    title = "Membro não encontrado";
    message = "O membro que você procura não existe ou você não tem permissão para vê-lo.";
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <main className="p-4 sm:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">{title}</h1>
      <ErrorAlert tone="error">{message}</ErrorAlert>
      <div className="mt-4">
        <Button as={Link} to="/app/membros" variant="ghost">
          ← Voltar para a lista
        </Button>
      </div>
    </main>
  );
}
