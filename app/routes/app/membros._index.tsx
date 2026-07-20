import { z } from "zod";
import type { Route } from "./+types/membros._index";
import { Link, Form } from "react-router";
import { prisma } from "~/db/prisma.server";
import { listMembros } from "~/lib/members.server";
import { userContext } from "~/lib/user-context";
import { Button } from "~/components/Button";
import { TabelaMembros } from "~/components/TabelaMembros";
import { CardMembro } from "~/components/CardMembro";
import { Pagination } from "~/components/Pagination";
import { cn } from "~/lib/cn";
import type { Prisma } from "../../generated/prisma/client";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Membros — Igreja Conect" }];
}

/** Schema de validação dos search params. */
const SearchParamsSchema = z.object({
  tipo: z
    .enum(["VISITANTE", "CONGREGADO", "MEMBRO_ATIVO"])
    .optional(),
  q: z.string().max(100).optional(),
  ministerioId: z.string().uuid().optional(),
  discipuladorId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    raw[key] = value;
  });
  const parsed = SearchParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
      filterValues: {
        q: undefined,
        tipo: undefined,
        ministerioId: undefined,
        discipuladorId: undefined,
      },
      searchParams: url.searchParams,
      kpiTotal: 0,
      kpiAtivos: 0,
      kpiVisitantes: 0,
      kpiCongregados: 0,
    };
  }
  const filter = parsed.data;

  // Service: listMembros com RBAC fina aplicada.
  const { items, total, page, pageSize } = await listMembros(
    {
      tipo: filter.tipo,
      q: filter.q,
      page: filter.page,
      pageSize: filter.pageSize,
      ministerioId: filter.ministerioId,
      discipuladorId: filter.discipuladorId,
    },
    user
  );

  // Scoped count queries for KPI cards matching user RBAC scope
  const baseWhere: Prisma.MembroWhereInput = {};
  if (user.cargo === "DISCIPULADOR") {
    baseWhere.discipuladorId = user.id;
  }

  const [kpiTotal, kpiAtivos, kpiVisitantes, kpiCongregados] = await Promise.all([
    prisma.membro.count({ where: baseWhere }),
    prisma.membro.count({ where: { ...baseWhere, tipo: "MEMBRO_ATIVO" } }),
    prisma.membro.count({ where: { ...baseWhere, tipo: "VISITANTE" } }),
    prisma.membro.count({ where: { ...baseWhere, tipo: "CONGREGADO" } }),
  ]);

  const searchParamsOut = new URLSearchParams(url.searchParams);

  return {
    items,
    total,
    page,
    pageSize,
    filterValues: {
      q: filter.q,
      tipo: filter.tipo,
      ministerioId: filter.ministerioId,
      discipuladorId: filter.discipuladorId,
    },
    searchParams: searchParamsOut,
    kpiTotal,
    kpiAtivos,
    kpiVisitantes,
    kpiCongregados,
  };
}

function getTabHref(currentParams: URLSearchParams, newTipo?: string) {
  const params = new URLSearchParams(currentParams);
  if (newTipo) {
    params.set("tipo", newTipo);
  } else {
    params.delete("tipo");
  }
  params.set("page", "1"); // reset to page 1 on filter tab change
  return `/app/membros?${params.toString()}`;
}

export default function MembrosIndex({ loaderData }: Route.ComponentProps) {
  const {
    items,
    total,
    page,
    pageSize,
    filterValues,
    kpiTotal,
    kpiAtivos,
    kpiVisitantes,
    kpiCongregados,
  } = loaderData;

  const searchParams: URLSearchParams =
    loaderData.searchParams instanceof URLSearchParams
      ? loaderData.searchParams
      : new URLSearchParams(loaderData.searchParams as unknown as string);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasItems = items.length > 0;
  const hasActiveFilters = !!filterValues.q || !!filterValues.tipo;

  const kpis = [
    {
      label: "TOTAL",
      value: kpiTotal,
      icon: (
        <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      bgColor: "bg-blue-50 border-blue-100",
    },
    {
      label: "ATIVOS",
      value: kpiAtivos,
      icon: (
        <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bgColor: "bg-emerald-50 border-emerald-100",
    },
    {
      label: "VISITANTES",
      value: kpiVisitantes,
      icon: (
        <svg className="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      ),
      bgColor: "bg-amber-50 border-amber-100",
    },
    {
      label: "CONGREGADOS",
      value: kpiCongregados,
      icon: (
        <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      bgColor: "bg-purple-50 border-purple-100",
    },
  ];

  const tabs = [
    { label: "Todos", value: undefined },
    { label: "Ativos", value: "MEMBRO_ATIVO" },
    { label: "Visitantes", value: "VISITANTE" },
    { label: "Congregados", value: "CONGREGADO" },
  ];

  const activeTab = filterValues.tipo;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Redesigned Header matching visual design */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Membros</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Gerencie e visualize todos os membros da sua comunidade.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Form method="get" className="relative flex-1 md:w-80" role="search" aria-label="Pesquisar membros">
            {filterValues.tipo && <input type="hidden" name="tipo" value={filterValues.tipo} />}
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              name="q"
              placeholder="Pesquisar membros..."
              defaultValue={filterValues.q}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all placeholder:text-slate-400 font-semibold"
            />
          </Form>
          <Link
            to="/app/membros/novo"
            className="inline-flex items-center justify-center h-10 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition-colors flex-shrink-0 cursor-pointer shadow-sm gap-1.5"
          >
            <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Novo Membro
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="flex items-center gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className={cn("p-3 rounded-xl border flex items-center justify-center flex-shrink-0", kpi.bgColor)}>
              {kpi.icon}
            </div>
            <div>
              <p className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">{kpi.label}</p>
              <p className="text-3xl font-extrabold text-slate-900 mt-1.5">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Category Tabs Filter */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-6" aria-label="Abas de filtragem">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.value;
            const href = getTabHref(searchParams, tab.value);
            return (
              <Link
                key={tab.label}
                to={href}
                className={cn(
                  "pb-3.5 px-1 border-b-2 font-semibold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded-t-sm",
                  isActive
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main List & Table with Empty State */}
      {!hasItems ? (
        <div className="border border-slate-200 rounded-2xl bg-white p-12 text-center shadow-xs">
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            {hasActiveFilters
              ? "Nenhum membro encontrado com esses filtros"
              : "Nenhum membro por aqui ainda"}
          </h2>
          <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
            {hasActiveFilters
              ? "Tente ajustar os filtros, limpar a busca ou navegar pelas abas."
              : "Comece cadastrando o primeiro membro da sua comunidade."}
          </p>
          {hasActiveFilters ? (
            <Button as={Link} to="/app/membros" variant="ghost">
              Limpar busca
            </Button>
          ) : (
            <Button as={Link} to="/app/membros/novo" variant="primary">
              Cadastrar membro
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <TabelaMembros items={items} canEdit={true} />
          <CardMembro items={items} canEdit={true} />
          <Pagination
            current={page}
            total={totalPages}
            basePath="/app/membros"
            searchParams={searchParams}
            totalItems={total}
            pageSize={pageSize}
          />
        </div>
      )}
    </div>
  );
}
