/**
 * Rota /app/financeiro/lancamentos/:id — Detalhe de Lançamento (Onda 2b).
 *
 * Exibe dados completos do lançamento + comprovante (se houver) + ações
 * (atualizar status, ver caixa vinculada).
 *
 * **RBAC:**
 * - VER: ADMIN/PASTOR/FINANCEIRO/SECRETARIO (assertCanSeeFinancialModule).
 *   SECRETARIO não vê lançamentos DIZIMO.
 * - EDIT status: ADMIN/PASTOR/FINANCEIRO (assertCanWriteLancamento).
 *
 * **Ações futuras (TODO):**
 * - Estornar lançamento (criar entrada/saída oposta + marcar original como estornado)
 * - Editar campos além de status (categoria, valor, descrição)
 * - Histórico de mudanças
 *
 * @see app/lib/lancamentos.server.ts (criarLancamento, listarPorCaixa)
 * @see app/lib/storage/signed-url.server.ts (signed URLs)
 */
import { Form, Link, data } from "react-router";
import type { Route } from "./+types/financeiro.lancamentos.$id";
import { userContext } from "~/lib/user-context";
import { prisma } from "~/db/prisma.server";
import { assertCanSeeFinancialModule, assertCanWriteLancamento } from "~/lib/rbac.server";
import { formatBRLFromCents } from "~/lib/money-format";
import { getSignedPreviewUrl } from "~/lib/storage/signed-url.server";
import { Breadcrumb } from "~/components/Breadcrumb";
import { PageHeader } from "~/components/PageHeader";
import { Button } from "~/components/Button";
import { ErrorAlert } from "~/components/ErrorAlert";
import { ComprovanteUpload } from "~/components/ComprovanteUpload";

export function meta({ data }: Route.MetaArgs) {
  if (!data?.lancamento) {
    return [{ title: "Lançamento não encontrado — Igreja Conect" }];
  }
  return [{ title: `Lançamento #${data.lancamento.id.slice(0, 8)} — Igreja Conect` }];
}

const STATUS_LABEL: Record<string, string> = {
  PAGO: "Pago / Confirmado",
  PENDENTE: "Pendente",
  AGENDADO: "Agendado",
};

const CATEGORIA_LABEL: Record<string, string> = {
  DIZIMO: "Dízimo",
  OFERTA: "Oferta",
  CAMPANHA: "Campanha",
  DESPESA_OPERACIONAL: "Despesa Operacional",
  COMPRA_ESTOQUE: "Compra de Estoque",
  MANUTENCAO: "Manutenção",
  TRANSFERENCIA: "Transferência",
};

/**
 * Loader: valida RBAC, busca lançamento por id + signed URL do comprovante.
 * SECRETARIO não vê DIZIMO → retornamos 404 (não vaza existência).
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeFinancialModule(user);

  const id = params.id;
  const lancamento = await prisma.lancamento.findUnique({
    where: { id },
    include: {
      caixa: { select: { id: true, nome: true } },
      membro: { select: { id: true, nome: true } },
      attachmentUpload: {
        select: {
          id: true,
          status: true,
          bucket: true,
          storageKeyPrefix: true,
          ext: true,
          detectedMime: true,
          originalFilename: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!lancamento) {
    throw new Response("Lançamento não encontrado.", { status: 404 });
  }

  // RBAC fino: SECRETARIO não vê DIZIMO (404, não 403 — não vaza existência)
  if (user.cargo === "SECRETARIO" && lancamento.categoria === "DIZIMO") {
    throw new Response("Lançamento não encontrado.", { status: 404 });
  }

  // Signed URL do comprovante (15min expiry)
  let comprovanteUrl: string | null = null;
  if (
    lancamento.attachmentUpload &&
    lancamento.attachmentUpload.status === "READY" &&
    !lancamento.attachmentUpload.deletedAt
  ) {
    const ext = lancamento.attachmentUpload.ext ?? "";
    const key = `${lancamento.attachmentUpload.storageKeyPrefix}${ext}`;
    try {
      comprovanteUrl = await getSignedPreviewUrl({
        bucket: lancamento.attachmentUpload.bucket,
        key,
      });
    } catch {
      comprovanteUrl = null;
    }
  }

  return {
    user,
    lancamento,
    comprovanteUrl,
    /** Pode editar status? (não-SECRETARIO) */
    podeEditar: user.cargo
      ? ["ADMIN", "PASTOR", "FINANCEIRO"].includes(user.cargo)
      : false,
  };
}

/**
 * Action: atualiza status do lançamento (PAGO | PENDENTE | AGENDADO).
 * RBAC: assertCanWriteLancamento (ADMIN/PASTOR/FINANCEIRO).
 */
export async function action({ params, request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanWriteLancamento(user);

  const formData = await request.formData();
  const intent = formData.get("intent");
  const status = formData.get("status");

  if (intent !== "atualizar-status") {
    return data({ error: "Intent inválido." }, { status: 400 });
  }

  if (
    status !== "PAGO" &&
    status !== "PENDENTE" &&
    status !== "AGENDADO"
  ) {
    return data({ error: "Status inválido." }, { status: 422 });
  }

  await prisma.lancamento.update({
    where: { id: params.id },
    data: { status: status as "PAGO" | "PENDENTE" | "AGENDADO" },
  });

  return { ok: true };
}

/**
 * Formata data para PT-BR (dd/mm/aaaa).
 */
function formatDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function LancamentoDetail({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { user, lancamento, comprovanteUrl, podeEditar } = loaderData;
  const error = (actionData as { error?: string } | undefined)?.error;

  const isEntrada = lancamento.tipo === "ENTRADA";

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {error && <ErrorAlert tone="error">{error}</ErrorAlert>}

      <Breadcrumb
        items={[
          { label: "Financeiro", href: "/app/financeiro" },
          {
            label: "Caixa " + lancamento.caixa.nome,
            href: `/app/financeiro/caixas/${lancamento.caixa.id}`,
          },
          { label: `Lançamento #${lancamento.id.slice(0, 8)}` },
        ]}
      />

      <PageHeader
        title={`Lançamento #${lancamento.id.slice(0, 8)}`}
        action={
          <div className="flex flex-col sm:flex-row gap-2">
            <Button as={Link} to={`/app/financeiro/caixas/${lancamento.caixa.id}`} variant="ghost">
              ← Ver Caixa
            </Button>
          </div>
        }
      />

      <p className="text-sm text-slate-600 -mt-4 mb-4">
        {CATEGORIA_LABEL[lancamento.categoria] || lancamento.categoria} • {formatDate(lancamento.dataCompetencia)}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Detalhes do Lançamento (2/3) */}
        <article className="lg:col-span-2 space-y-4">
          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <header className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
              <div
                className={`p-3 rounded-xl ${
                  isEntrada
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-rose-50 text-rose-600"
                }`}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={isEntrada ? "M12 4v16m8-8H4" : "M20 12H4"}
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-900">
                  {CATEGORIA_LABEL[lancamento.categoria] || lancamento.categoria}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  ID: #{lancamento.id.slice(0, 8)} •{" "}
                  {formatDate(lancamento.dataCompetencia)}
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  isEntrada
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700"
                }`}
              >
                {isEntrada ? "Entrada" : "Saída"}
              </span>
            </header>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">
                  Valor
                </dt>
                <dd
                  className={`text-2xl font-bold mt-1 ${
                    isEntrada ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {isEntrada ? "+" : "−"}{" "}
                  {formatBRLFromCents(lancamento.valorCentavos)}
                </dd>
                <dd className="text-xs text-slate-400 mt-0.5 font-mono">
                  {lancamento.valorCentavos} centavos
                </dd>
              </div>

              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">
                  Status
                </dt>
                <dd className="mt-1">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase ${
                      lancamento.status === "PAGO"
                        ? "bg-emerald-50 text-emerald-700"
                        : lancamento.status === "PENDENTE"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {STATUS_LABEL[lancamento.status] || lancamento.status}
                  </span>
                </dd>
              </div>

              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">
                  Data de Competência
                </dt>
                <dd className="text-slate-900 mt-1 font-mono">
                  {formatDate(lancamento.dataCompetencia)}
                </dd>
              </div>

              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">
                  Categoria
                </dt>
                <dd className="text-slate-900 mt-1">
                  {CATEGORIA_LABEL[lancamento.categoria] || lancamento.categoria}
                </dd>
              </div>

              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">
                  Caixa
                </dt>
                <dd className="text-slate-900 mt-1">
                  <Link
                    to={`/app/financeiro/caixas/${lancamento.caixa.id}`}
                    className="text-cyan-700 hover:underline"
                  >
                    {lancamento.caixa.nome}
                  </Link>
                </dd>
              </div>

              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">
                  Membro / Doador
                </dt>
                <dd className="text-slate-900 mt-1">
                  {lancamento.membro ? (
                    <span>
                      {lancamento.membro.nome}
                      <span className="text-xs text-slate-400 ml-1.5">
                        #{lancamento.membro.id.slice(0, 8)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">— sem membro</span>
                  )}
                </dd>
              </div>
            </dl>

            {lancamento.descricao && (
              <div className="mt-5 pt-5 border-t border-slate-100">
                <dt className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                  Descrição
                </dt>
                <dd className="text-sm text-slate-700 whitespace-pre-wrap">
                  {lancamento.descricao}
                </dd>
              </div>
            )}
          </section>

          {/* Comprovante */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <header className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Comprovante</h3>
            </header>
            <ComprovanteUpload
              lancamentoId={lancamento.id}
              currentUrl={comprovanteUrl}
              currentFilename={lancamento.attachmentUpload?.originalFilename ?? null}
              currentUploadId={lancamento.attachmentUploadId}
              currentStatus={lancamento.attachmentUpload?.status ?? null}
              currentMime={lancamento.attachmentUpload?.detectedMime ?? null}
            />
          </section>
        </article>

        {/* Sidebar: Ações (1/3) */}
        <aside className="space-y-4">
          {/* Mudar status */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-4">Alterar Status</h3>
            {!podeEditar ? (
              <p className="text-xs text-slate-500 italic">
                Apenas ADMIN/PASTOR/FINANCEIRO podem alterar status.
              </p>
            ) : (
              <Form method="post" className="space-y-2">
                <input type="hidden" name="intent" value="atualizar-status" />
                {(["PAGO", "PENDENTE", "AGENDADO"] as const).map((s) => (
                  <button
                    key={s}
                    type="submit"
                    name="status"
                    value={s}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-sm font-medium transition-colors ${
                      lancamento.status === s
                        ? "border-blue-500 bg-blue-50 text-blue-900"
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span>{STATUS_LABEL[s]}</span>
                    {lancamento.status === s && (
                      <svg
                        className="w-4 h-4 text-blue-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </Form>
            )}
          </section>

          {/* Ações futuras */}
          <section className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-2">Próximas ações</h3>
            <ul className="text-xs text-slate-500 space-y-1.5 list-disc pl-4">
              <li>Estornar lançamento (gera oposto)</li>
              <li>Editar valor / categoria / descrição</li>
              <li>Histórico de mudanças (audit log)</li>
              <li>Exportar lançamento em PDF</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

/**
 * ErrorBoundary para 404 (não encontrado / sem permissão SECRETARIO sobre DIZIMO).
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Erro ao carregar lançamento.";
  if (error instanceof Response) {
    if (error.status === 404) {
      message = "Lançamento não encontrado ou você não tem permissão para vê-lo.";
    } else {
      message = error.statusText || message;
    }
  } else if (error instanceof Error) {
    message = error.message;
  }
  return (
    <main className="p-4 sm:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Erro</h1>
      <ErrorAlert tone="error">{message}</ErrorAlert>
      <div className="mt-4">
        <Button as={Link} to="/app/financeiro" variant="ghost">
          ← Voltar ao Financeiro
        </Button>
      </div>
    </main>
  );
}
