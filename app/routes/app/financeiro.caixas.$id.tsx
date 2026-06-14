/**
 * Rota /app/financeiro/caixas/:id — Detalhe do Caixa com Extrato (S06-T12).
 *
 * **Loader:**
 * - `assertCanSeeFinancials(user)` — Camada 2 RBAC.
 * - Busca caixa + lançamentos com filtros (período, categoria).
 * - SECRETARIO: tabela SEM coluna Membro, SEM botões arquivar/reabrir.
 *
 * **ErrorBoundary:** 403 (perfil), 404 (caixa não existe).
 *
 * @see app/lib/caixas.server.ts
 * @see app/lib/lancamentos.server.ts (a ser implementado pelo backend)
 */
import { Link } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/financeiro.caixas.$id";
import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "~/db/prisma.server";
import { userContext } from "~/lib/user-context";
import { assertCanSeeFinancials } from "~/lib/rbac.server";
import { CaixaHeader } from "~/components/CaixaHeader";
import { ExtratoFiltros } from "~/components/ExtratoFiltros";
import { ExtratoCaixa } from "~/components/ExtratoCaixa";
import { Pagination } from "~/components/Pagination";
import { Can } from "~/components/Can";
import type { CaixaResumo, LancamentoResumo } from "~/lib/finance.server";

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

/**
 * Constrói o filtro de data baseado no período.
 */
function buildPeriodFilter(periodo: Filtros["periodo"]): Date | undefined {
  const now = new Date();
  switch (periodo) {
    case "mes":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "trimestre":
      return new Date(now.getFullYear(), now.getMonth() - 2, 1);
    case "ano":
      return new Date(now.getFullYear(), 0, 1);
    default:
      return undefined;
  }
}

/**
 * Loader: busca caixa + lançamentos com filtros.
 */
export async function loader({ params, request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeFinancials(user);

  const caixaId = params.id;
  if (!caixaId) throw new Response("ID do caixa não informado.", { status: 400 });

  // Busca caixa
  const caixa = await prisma.caixa.findUnique({
    where: { id: caixaId },
    select: {
      id: true,
      nome: true,
      saldoCentavos: true,
      ativo: true,
      createdAt: true,
    },
  });

  if (!caixa) {
    throw new Response("Caixa não encontrado.", { status: 404 });
  }

  // Parse filtros
  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { raw[k] = v; });
  const parsed = FiltrosSchema.safeParse(raw);
  const filtros: Filtros = parsed.success
    ? parsed.data
    : { periodo: "todos", categoria: "todas", page: 1, pageSize: 50 };

  const { periodo, categoria, page, pageSize } = filtros;

  // Monta where de lancamentos
  const whereLancamento: Prisma.LancamentoWhereInput = { caixaId };

  const periodoFilter = buildPeriodFilter(periodo);
  if (periodoFilter) {
    whereLancamento.dataCompetencia = { gte: periodoFilter };
  }

  if (categoria && categoria !== "todas") {
    whereLancamento.categoria = categoria as any;
  }

  // SECRETARIO: filtra DIZIMO
  if (user.cargo === "SECRETARIO") {
    whereLancamento.categoria = { not: "DIZIMO" as any };
  }

  // Total de lançamentos
  const total = await prisma.lancamento.count({
    where: whereLancamento,
  });

  // Lançamentos paginados
  const lancamentosRaw = await prisma.lancamento.findMany({
    where: whereLancamento,
    orderBy: { dataCompetencia: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      caixa: { select: { id: true, nome: true } },
      membro: { select: { id: true, nome: true } },
    },
  });

  const lancamentos: LancamentoResumo[] = lancamentosRaw.map((l) => ({
    id: l.id,
    tipo: l.tipo,
    categoria: l.categoria,
    valorCentavos: l.valorCentavos,
    dataCompetencia: l.dataCompetencia,
    descricao: l.descricao,
    caixa: l.caixa,
    membro: l.membro,
  }));

  // Monta CaixaResumo com lancamentosMes (do mês atual)
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lancamentosMes = await prisma.lancamento.count({
    where: { caixaId, dataCompetencia: { gte: firstDayOfMonth } },
  });

  const caixaResumo: CaixaResumo = {
    ...caixa,
    lancamentosMes,
  };

  return {
    user,
    caixa: caixaResumo,
    lancamentos,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
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
