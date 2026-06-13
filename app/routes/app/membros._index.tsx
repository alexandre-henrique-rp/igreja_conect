/**
 * Rota /app/membros — listagem de membros com filtros + paginação (S02-T04).
 *
 * **Camadas (defense in depth):**
 * - UI: `<FiltrosMembros />` em form method=get; `<Pagination />` preserva
 *   query string.
 * - Loader (esta rota): valida search params com Zod, chama `listMembros`
 *   do service (camada 3) com RBAC fina já aplicada.
 * - Service: `listMembros` força escopo de `DISCIPULADOR` no `where`
 *   do Prisma (camada 3 — ver RAG `security-rbac-matrix`).
 *
 * **Enriquecimento para UI:** o service retorna o `MEMBRO_SAFE_SELECT`
 * (sem relações populadas). Esta rota busca em batch:
 * 1. Nomes dos discipuladores (`membro.findMany` com `id IN (...)`).
 * 2. Ministérios de cada membro (`ministerioMembro.findMany` com
 *   `membroId IN (...)` e include de `ministerio`).
 *
 * **Regra anti-N+1 (RAG `convention-prisma-sqlite.md` §5):** 2 queries
 * agregadas, não N queries em loop.
 *
 * **Empty state contextual:**
 * - 0 membros no sistema → CTA "+ Cadastrar membro".
 * - Filtros retornaram 0 → botão "Limpar filtros".
 *
 * @see app/lib/members.server.ts (listMembros)
 * @see design/private-membros-list.DESIGN.md
 */
import { z } from "zod";
import type { Route } from "./+types/membros._index";
import { Link } from "react-router";
import { prisma } from "~/db/prisma.server";
import { listMembros } from "~/lib/members.server";
import { userContext } from "~/lib/user-context";
import { Breadcrumb } from "~/components/Breadcrumb";
import { Button } from "~/components/Button";
import { CardMembro, type MembroListItem } from "~/components/CardMembro";
import { FiltrosMembros } from "~/components/FiltrosMembros";
import { PageHeader } from "~/components/PageHeader";
import { Pagination } from "~/components/Pagination";
import { TabelaMembros } from "~/components/TabelaMembros";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Membros — Igreja Conect" }];
}

/** Schema de validação dos search params (defesa contra query maliciosa). */
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

/**
 * Loader: lê search params, valida com Zod, chama `listMembros`
 * (RBAC fina já aplicada) e enriquece com discipulador + ministerios.
 *
 * @param args - Loader args do RR7 (request, context).
 * @returns Items enriquecidos, total, paginação, opções de filtro.
 */
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
    // Search params inválidos → resetar para defaults (não vaza 422)
    return {
      items: [] as MembroListItem[],
      total: 0,
      page: 1,
      pageSize: 25,
      ministerios: [],
      discipuladores: [],
      filterValues: {
        q: undefined,
        tipo: undefined,
        ministerioId: undefined,
        discipuladorId: undefined,
      },
      searchParams: url.searchParams,
    };
  }
  const filter = parsed.data;

  // Service: listMembros aplica RBAC fina (DISCIPULADOR → escopo).
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

  // Enriquecimento: nomes de discipuladores (1 query agregada).
  const discipuladorIds = Array.from(
    new Set(items.map((m) => m.discipuladorId).filter((id): id is string => !!id))
  );
  const discipuladoresMap = new Map<string, { id: string; nome: string }>();
  if (discipuladorIds.length > 0) {
    const ds = await prisma.membro.findMany({
      where: { id: { in: discipuladorIds } },
      select: { id: true, nome: true },
    });
    for (const d of ds) discipuladoresMap.set(d.id, d);
  }

  // Enriquecimento: ministérios (1 query agregada).
  const membroIds = items.map((m) => m.id);
  const ministeriosByMembro = new Map<string, { id: string; nome: string }[]>();
  if (membroIds.length > 0) {
    const vincs = await prisma.ministerioMembro.findMany({
      where: { membroId: { in: membroIds } },
      select: { membroId: true, ministerio: { select: { id: true, nome: true } } },
    });
    for (const v of vincs) {
      const arr = ministeriosByMembro.get(v.membroId) ?? [];
      arr.push(v.ministerio);
      ministeriosByMembro.set(v.membroId, arr);
    }
  }

  // Map para o tipo consumido por TabelaMembros / CardMembro.
  const enrichedItems: MembroListItem[] = items.map((m) => ({
    id: m.id,
    nome: m.nome,
    tipo: m.tipo,
    discipulador: m.discipuladorId
      ? discipuladoresMap.get(m.discipuladorId) ?? null
      : null,
    ministerios: ministeriosByMembro.get(m.id) ?? [],
  }));

  // Opções dos selects dependentes (todos os ministérios + discipuladores).
  // Carregado **independente** do filtro — para popular os dropdowns.
  const [ministeriosAll, discipuladoresAll] = await Promise.all([
    prisma.ministerio.findMany({
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    // Discipuladores = membros com cargo não-nulo.
    prisma.membro.findMany({
      where: { cargo: { not: null } },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  // Converte para um URLSearchParams "puro" (garante tipo URLSearchParams,
  // não o tipo ReadonlyMap que o TS infere de `url.searchParams`).
  const searchParamsOut = new URLSearchParams(url.searchParams);

  return {
    items: enrichedItems,
    total,
    page,
    pageSize,
    ministerios: ministeriosAll,
    discipuladores: discipuladoresAll,
    filterValues: {
      q: filter.q,
      tipo: filter.tipo,
      ministerioId: filter.ministerioId,
      discipuladorId: filter.discipuladorId,
    },
    searchParams: searchParamsOut,
  };
}

/**
 * Componente padrão: PageHeader + Filtros + Tabela (md+) / Cards (<md)
 * + Pagination + Empty state contextual.
 */
export default function MembrosIndex({ loaderData }: Route.ComponentProps) {
  const {
    items,
    total,
    page,
    pageSize,
    ministerios,
    discipuladores,
    filterValues,
  } = loaderData;
  // RR7 infere o tipo do searchParams de forma ampla. Convertemos
  // para URLSearchParams real para o tipo do `<Pagination>`.
  const searchParams: URLSearchParams =
    loaderData.searchParams instanceof URLSearchParams
      ? loaderData.searchParams
      : new URLSearchParams(loaderData.searchParams as unknown as string);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasItems = items.length > 0;
  const hasActiveFilters =
    !!filterValues.q ||
    !!filterValues.tipo ||
    !!filterValues.ministerioId ||
    !!filterValues.discipuladorId;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Membros"
        breadcrumb={
          <Breadcrumb items={[{ label: "Configurações" }, { label: "Membros" }]} />
        }
        action={
          <Button as={Link} to="/app/membros/novo" variant="primary">
            + Novo membro
          </Button>
        }
      />

      <FiltrosMembros
        defaultValues={filterValues}
        ministerios={ministerios}
        discipuladores={discipuladores}
      />

      {/* Contagem + empty state contextual */}
      <div
        className="text-sm text-slate-600 mb-2"
        aria-live="polite"
      >
        {total === 0
          ? "Nenhum membro encontrado"
          : `${total} ${total === 1 ? "membro encontrado" : "membros encontrados"}`}
      </div>

      {!hasItems ? (
        <div className="border border-slate-200 rounded-lg bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            {hasActiveFilters
              ? "Nenhum membro com esses filtros"
              : "Nenhum membro por aqui ainda"}
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            {hasActiveFilters
              ? "Tente ajustar os filtros ou limpar a busca."
              : "Cadastre o primeiro membro para começar."}
          </p>
          {hasActiveFilters ? (
            <Button as={Link} to="/app/membros" variant="ghost">
              Limpar filtros
            </Button>
          ) : (
            <Button as={Link} to="/app/membros/novo" variant="primary">
              + Cadastrar membro
            </Button>
          )}
        </div>
      ) : (
        <>
          <TabelaMembros items={items} canEdit={true} />
          <CardMembro items={items} canEdit={true} />
          <Pagination
            current={page}
            total={totalPages}
            basePath="/app/membros"
            searchParams={searchParams}
          />
        </>
      )}
    </div>
  );
}
