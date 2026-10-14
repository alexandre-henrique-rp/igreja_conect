import { useState } from "react";
import { z } from "zod";
import type { Route } from "./+types/membros._index";
import { Link, Form } from "react-router";
import { prisma } from "~/db/prisma.server";
import { getMembroAvatarSignedUrl, listMembros } from "~/lib/members.server";
import { userContext } from "~/lib/user-context";
import { TabelaMembros } from "~/components/TabelaMembros";
import { Pagination } from "~/components/Pagination";
import { Card, CardBody, EmptyState, Icon, KpiCard, PageHeader, Button } from "~/components/ds";
import type { Prisma } from "../../../generated/prisma/client";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Membros — Igreja Conect" }];
}

const TIPO_LABELS = {
  VISITANTE: "Visitante",
  CONGREGADO: "Congregado",
  MEMBRO_ATIVO: "Membro Efetivo",
} as const;

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

  const itemsWithAvatars = await Promise.all(
    items.map(async ({ ministerios: vinculos, ...item }) => ({
      ...item,
      ministerios: vinculos.map((v) => ({ nome: v.ministerio.nome })),
      discipulador: item.discipuladorNome ? { nome: item.discipuladorNome } : null,
      avatarUrl: (await getMembroAvatarSignedUrl(item))?.url ?? null,
    }))
  );

  const baseWhere: Prisma.MembroWhereInput = {};

  const [kpiTotal, kpiAtivos, kpiVisitantes, kpiCongregados, ministerios, discipuladores] =
    await Promise.all([
      prisma.membro.count({ where: baseWhere }),
      prisma.membro.count({ where: { ...baseWhere, tipo: "MEMBRO_ATIVO" } }),
      prisma.membro.count({ where: { ...baseWhere, tipo: "VISITANTE" } }),
      prisma.membro.count({ where: { ...baseWhere, tipo: "CONGREGADO" } }),
      prisma.ministerio.findMany({
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
      }),
      prisma.membro.findMany({
        where: { isDiscipulador: true },
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
      }),
    ]);

  const searchParamsOut = new URLSearchParams(url.searchParams);

  return {
    items: itemsWithAvatars,
    total,
    page,
    pageSize,
    filterValues: {
      q: filter.q,
      tipo: filter.tipo,
      ministerioId: filter.ministerioId,
      discipuladorId: filter.discipuladorId,
    },
    ministerios,
    discipuladores,
    searchParams: searchParamsOut,
    kpiTotal,
    kpiAtivos,
    kpiVisitantes,
    kpiCongregados,
  };
}

export default function MembrosIndex({ loaderData }: Route.ComponentProps) {
  const {
    items,
    total,
    page,
    pageSize,
    filterValues,
    ministerios = [],
    discipuladores = [],
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
  const hasActiveFilters = Boolean(
    filterValues.q ||
      filterValues.tipo ||
      filterValues.ministerioId ||
      filterValues.discipuladorId,
  );
  const [view, setView] = useState<"grid" | "list">("grid");

  function updateFilter(name: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(name, value);
    else params.delete(name);
    params.set("page", "1");
    window.location.href = `/app/membros?${params.toString()}`;
  }

  function exportCsv() {
    const header = ["Nome", "Tipo", "E-mail", "Telefone", "Entrada"].join(",");
    const rows = items.map((item) =>
      [item.nome, TIPO_LABELS[item.tipo], item.email ?? "", item.telefone ?? "", item.createdAt]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header, ...rows].join("\\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "membros.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="members-page space-y-6" data-od-id="members-list-page">
      <PageHeader
        className="page-header"
        eyebrow="Pessoas"
        title="Membros"
        description="Gerencie todos os membros da congregação."
        actions={
          <>
            <Button type="button" variant="secondary" size="md" onClick={exportCsv}>
              <Icon name="download" size="sm" />
              Exportar CSV
            </Button>
            <Button as={Link} to="/app/membros/novo" variant="primary" size="md">
              + Novo membro
            </Button>
          </>
        }
      />

      <section className="grid-4" data-od-id="members-kpis" aria-label="Indicadores de membros">
        <KpiCard label="Total" value={kpiTotal} hint="cadastros na base" tone="accent" icon={<Icon name="users" size="md" />} />
        <KpiCard label="Membros ativos" value={kpiAtivos} hint="da base" tone="success" icon={<Icon name="check" size="md" />} />
        <KpiCard label="Congregados" value={kpiCongregados} hint="em acompanhamento" tone="info" icon={<Icon name="heart" size="md" />} />
        <KpiCard label="Visitantes" value={kpiVisitantes} hint="primeiro contato" tone="warning" icon={<Icon name="user-plus" size="md" />} />
      </section>

      <div className="filter-bar" data-od-id="members-filters">
        <Form
          id="members-filter-form"
          method="get"
          className="search relative"
          role="search"
          aria-label="Pesquisar membros"
        >
          <Icon name="search" size="sm" />
          <input
            className="input"
            type="search"
            name="q"
            placeholder="Buscar por nome, email..."
            defaultValue={filterValues.q}
          />
          {filterValues.tipo && <input type="hidden" name="tipo" value={filterValues.tipo} />}
          {filterValues.ministerioId && <input type="hidden" name="ministerioId" value={filterValues.ministerioId} />}
          {filterValues.discipuladorId && <input type="hidden" name="discipuladorId" value={filterValues.discipuladorId} />}
        </Form>
        <select
          className="select"
          name="tipo"
          aria-label="Filtrar por tipo"
          defaultValue={filterValues.tipo ?? ""}
          form="members-filter-form"
          onChange={(event) => updateFilter("tipo", event.currentTarget.value)}
        >
          <option value="">Tipo: todos</option>
          <option value="MEMBRO_ATIVO">Ativo</option>
          <option value="CONGREGADO">Congregado</option>
          <option value="VISITANTE">Visitante</option>
        </select>
        <select
          className="select"
          name="ministerioId"
          aria-label="Filtrar por ministério"
          defaultValue={filterValues.ministerioId ?? ""}
          form="members-filter-form"
          onChange={(event) => updateFilter("ministerioId", event.currentTarget.value)}
        >
          <option value="">Ministério</option>
          {ministerios.map((ministerio) => (
            <option key={ministerio.id} value={ministerio.id}>{ministerio.nome}</option>
          ))}
        </select>
        <select
          className="select"
          name="discipuladorId"
          aria-label="Filtrar por discipulador"
          defaultValue={filterValues.discipuladorId ?? ""}
          form="members-filter-form"
          onChange={(event) => updateFilter("discipuladorId", event.currentTarget.value)}
        >
          <option value="">Discipulador</option>
          {discipuladores.map((discipulador) => (
            <option key={discipulador.id} value={discipulador.id}>{discipulador.nome}</option>
          ))}
        </select>
        <span className="filter-spacer" />
        {hasActiveFilters && (
          <Link to="/app/membros" className="filter-clear">Limpar filtros</Link>
        )}
        <div className="view-toggle" aria-label="Modo de visualização">
          <button
            type="button"
            className={view === "grid" ? "active" : undefined}
            aria-label="Visualização em grade"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            <Icon name="scan" size="sm" />
          </button>
          <button
            type="button"
            className={view === "list" ? "active" : undefined}
            aria-label="Visualização em lista"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <Icon name="clipboard" size="sm" />
          </button>
        </div>
      </div>

      {!hasItems ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<Icon name="users" size="lg" />}
              title={
                hasActiveFilters
                  ? "Nenhum membro encontrado com esses filtros"
                  : "Nenhum membro por aqui ainda"
              }
              description={
                hasActiveFilters
                  ? "Tente ajustar os filtros, limpar a busca ou navegar pelas abas."
                  : "Comece cadastrando o primeiro membro da sua comunidade."
              }
              action={
                hasActiveFilters ? (
                  <Button as={Link} to="/app/membros" variant="ghost">
                    Limpar busca
                  </Button>
                ) : (
                  <Button as={Link} to="/app/membros/novo" variant="primary">
                    Cadastrar membro
                  </Button>
                )
              }
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          <TabelaMembros items={items} canEdit={true} view={view} />
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