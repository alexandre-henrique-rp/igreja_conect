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
import type React from "react";
import type { Route } from "./+types/membros.$id";
import { userContext } from "~/lib/user-context";
import { getMembroById, deleteMembro } from "~/lib/members.server";
import { getFidelidadeFinanceira } from "~/lib/finance.server";
import { BusinessRuleError, NotFoundError } from "~/lib/errors";
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

  // Quem pode excluir? Só ADMIN/PASTOR.
  const canDelete = user.cargo === "ADMIN" || user.cargo === "PASTOR";

  const fidelidadeFinanceira = await getFidelidadeFinanceira(params.id, user);

  return { membro, canDelete, fidelidadeFinanceira };
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
      // Re-throw: outros erros viram 500.
      throw e;
    }
  }

  return new Response(JSON.stringify({ formError: "Intent não reconhecido." }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
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
export default function MembroDetail({ loaderData }: Route.ComponentProps) {
  const { membro, canDelete } = loaderData;
  const navigation = useNavigation();
  const isDeleting =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "delete";

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <PageHeader
        title={membro.nome}
        breadcrumb={
          <Breadcrumb
            items={[
              { label: "Membros", href: "/app/membros" },
              { label: membro.nome },
            ]}
          />
        }
        action={
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              as={Link}
              to={`/app/membros/${membro.id}/editar`}
              variant="primary"
            >
              Editar
            </Button>
            {canDelete && (
              <Form method="post" className="inline">
                <input type="hidden" name="intent" value="delete" />
                <Button
                  type="submit"
                  variant="danger"
                  loading={isDeleting}
                  onClick={(e: React.MouseEvent<HTMLElement>) => {
                    // Confirmação inline (alert nativo) — manter simples.
                    // Modal bonito virá com `<Dialog>` em sprint futura.
                    if (
                      !window.confirm(
                        `Tem certeza que deseja excluir ${membro.nome}? Esta ação não pode ser desfeita.`
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
        <article className="lg:col-span-2 border border-slate-200 rounded-lg bg-white p-4 sm:p-6 space-y-4">
          <header className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-slate-900">
              Dados cadastrais
            </h2>
            <TipoBadge tipo={membro.tipo} />
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
        </article>

        {/* Sidebar info (1/3) */}
        <aside className="border border-slate-200 rounded-lg bg-white p-4 sm:p-6 space-y-3">
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
        </aside>
      </div>

      {/* Nota: as abas (Dados, Discipulado, Ministérios, Fidelidade)
          entram em S03. Por ora a tela é um resumo único. */}
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
