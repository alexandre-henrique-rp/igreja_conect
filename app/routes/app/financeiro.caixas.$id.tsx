/**
 * Rota /app/financeiro/caixas/:id — Detalhe do Caixa com Extrato (S06-T12).
 *
 * **Loader:**
 * - `assertCanSeeFinancialModule(user)` — Camada 2 RBAC.
 * - Delega para `getCaixaDetalhe()` (caixas.server.ts) que aplica RBAC Camada 3,
 *   filtros, paginação, e registra auditoria.
 * - SECRETARIO: `listarPorCaixa()` filtra DIZIMO na service layer.
 *
 * **ErrorBoundary:** 403 (perfil), 404 (caixa não existe).
 *
 * @see app/lib/caixas.server.ts (getCaixaDetalhe)
 * @see app/lib/lancamentos.server.ts (listarPorCaixa)
 */
import { Link } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/financeiro.caixas.$id";
import { userContext } from "~/lib/user-context";
import { assertCanSeeFinancialModule } from "~/lib/rbac.server";
import { getCaixaDetalhe } from "~/lib/caixas.server";
import { CaixaHeader } from "~/components/CaixaHeader";
import { ExtratoFiltros } from "~/components/ExtratoFiltros";
import { ExtratoCaixa } from "~/components/ExtratoCaixa";
import { Pagination } from "~/components/Pagination";
import { Can } from "~/components/Can";
import type { LancamentoResumo } from "~/lib/finance.server";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Detalhe do Caixa — Igreja Conect" }];
}

/** Schema de validação dos filtros do extrato. */
const FiltrosSchema = z.object({
  periodo: z.enum(["todos", "mes", "trimestre", "ano"]).default("todos"),
  categoria: z.string().default("todas"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

type Filtros = z.infer<typeof FiltrosSchema>;

/** Mapa de períodos da UI → períodos do service. */
const PERIOD_MAP: Record<string, string> = {
  todos: "todos",
  mes: "mes_atual",
  trimestre: "trimestre",
  ano: "ano_atual",
};

/**
 * Loader: busca caixa + lançamentos via service layer.
 *
 * Delega para `getCaixaDetalhe()` que aplica RBAC Camada 3, filtros,
 * paginação, auditoria e anti-TOCTOU (quando aplicável).
 */
export async function loader({ params, request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeFinancialModule(user);

  const caixaId = params.id;
  if (!caixaId) throw new Response("ID do caixa não informado.", { status: 400 });

  // Parse filtros da URL
  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { raw[k] = v; });
  const parsed = FiltrosSchema.safeParse(raw);
  const filtros: Filtros = parsed.success
    ? parsed.data
    : { periodo: "todos", categoria: "todas", page: 1, pageSize: 50 };

  // Busca via service layer (RBAC + filtros + paginação + auditoria)
  const result = await getCaixaDetalhe(
    caixaId,
    {
      periodo: PERIOD_MAP[filtros.periodo] ?? "todos",
      categoria: filtros.categoria,
      page: filtros.page,
      pageSize: filtros.pageSize,
    },
    user
  );

  if (!result) {
    throw new Response("Caixa não encontrado.", { status: 404 });
  }

  const { caixa, lancamentos, total, page, pageSize } = result;
  const totalPages = Math.ceil(total / pageSize);

  return {
    user,
    caixa,
    lancamentos: lancamentos as LancamentoResumo[],
    total,
    page,
    pageSize,
    totalPages,
    filtros,
    /** Search params serializados para a Pagination preservar filtros. */
    _qs: url.searchParams.toString(),
  };
}

/**
 * Página de detalhe do caixa.
 */
export default function DetalheCaixa({
  loaderData,
}: Route.ComponentProps) {
  const {
    user,
    caixa,
    lancamentos,
    total,
    page,
    totalPages,
    filtros,
    _qs,
  } = loaderData;

  const podeGerenciar =
    user.cargo != null &&
    ["ADMIN", "PASTOR", "FINANCEIRO"].includes(user.cargo);

  const podeVerMembro = user.cargo !== "SECRETARIO";

  const basePath = `/app/financeiro/caixas/${caixa.id}`;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Breadcrumb manual */}
      <nav className="text-sm text-slate-500 mb-4" aria-label="Breadcrumb">
        <Link
          to="/app/financeiro"
          className="hover:text-cyan-700 transition-colors"
        >
          Financeiro
        </Link>
        <span className="mx-2">/</span>
        <Link
          to="/app/financeiro/caixas"
          className="hover:text-cyan-700 transition-colors"
        >
          Caixas
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-900 font-medium">{caixa.nome}</span>
      </nav>

      <CaixaHeader
        caixa={caixa}
        totalLancamentos={total}
        podeGerenciar={podeGerenciar}
      />

      {/* Ações do caixa */}
      <div className="flex flex-wrap items-center gap-2 mt-4 mb-4">
        {caixa.ativo && (
          <Link
            to={`/app/financeiro/lancamentos/novo?caixaId=${caixa.id}`}
            className="inline-flex items-center justify-center rounded-md bg-cyan-700 px-3 h-9 text-sm font-medium text-white hover:bg-cyan-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
          >
            + Novo Lançamento
          </Link>
        )}
        <Can user={user} allow={["ADMIN", "PASTOR", "FINANCEIRO"]}>
          <Link
            to="/app/financeiro/caixas"
            className="inline-flex items-center justify-center rounded-md bg-slate-200 px-3 h-9 text-sm font-medium text-slate-700 hover:bg-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
          >
            Voltar
          </Link>
        </Can>
      </div>

      {/* Filtros */}
      <ExtratoFiltros
        periodo={filtros.periodo}
        categoria={filtros.categoria}
        basePath={basePath}
      />

      {/* Extrato */}
      <div className="bg-white rounded-lg border border-slate-200 p-2">
        <ExtratoCaixa items={lancamentos} podeVerMembro={podeVerMembro} />
      </div>

      {/* Paginação */}
      <Pagination
        current={page}
        total={totalPages}
        basePath={basePath}
        searchParams={new URLSearchParams(_qs)}
      />
    </div>
  );
}
