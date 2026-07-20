/**
 * Teste de integração de app/routes/app/membros._index.tsx (S02-T04).
 *
 * Cobre o loader e o componente padrão da rota:
 *  - Loader com ADMIN + ?tipo=VISITANTE → chama listMembros com filtro correto
 *  - Loader com DISCIPULADOR → força discipuladorId = user.id (RBAC fina)
 *  - Render básico: renderiza TabelaMembros com membros retornados
 *  - Empty state: "Nenhum membro com esses filtros" + botão Limpar
 *
 * **Por que testamos loader e render:** o loader é o coração da rota
 * (RBAC + filtros + enriquecimento). O render prova que a UI consome
 * o payload corretamente (empty state, contagem, tabela).
 *
 * @see app/lib/members.server.ts (listMembros)
 * @see app/routes/app/membros._index.tsx
 */
import React from "react";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { prismaTest, setupTestDb } from "../../../tests/helpers/db";
import { hashPassword } from "~/lib/auth.server";

type Cargo =
  | "ADMIN"
  | "PASTOR"
  | "SECRETARIO"
  | "DISCIPULADOR"
  | "FINANCEIRO"
  | "LIDER_MINISTERIO";

type SessionUser = { id: string; nome: string; cargo: Cargo | null };

type MembroListItem = {
  id: string;
  nome: string;
  tipo: "VISITANTE" | "CONGREGADO" | "MEMBRO_ATIVO";
  discipulador: { id: string; nome: string } | null;
  ministerios: { id: string; nome: string }[];
};

type LoaderData = {
  items: MembroListItem[];
  total: number;
  page: number;
  pageSize: number;
  ministerios: { id: string; nome: string }[];
  discipuladores: { id: string; nome: string }[];
  filterValues: {
    q?: string;
    tipo?: "VISITANTE" | "CONGREGADO" | "MEMBRO_ATIVO";
    ministerioId?: string;
    discipuladorId?: string;
  };
  searchParams: URLSearchParams;
};

let cleanup: () => Promise<void>;
let loader: typeof import("./membros._index").loader;
let DefaultComponent: React.ComponentType<{ loaderData: LoaderData }>;

beforeAll(async () => {
  cleanup = await setupTestDb("membros_index");
  vi.resetModules();
  const mod = await import("./membros._index");
  loader = mod.loader;
  // Type cast: o RR7 infere `Route.ComponentProps` que requer params/matches,
  // mas para renderizar isoladamente só loaderData importa.
  DefaultComponent = mod.default as unknown as React.ComponentType<{
    loaderData: LoaderData;
  }>;
});

afterAll(async () => {
  await cleanup();
});

beforeEach(async () => {
  await prismaTest.alertaDestinatario.deleteMany();
  await prismaTest.alerta.deleteMany();
  await prismaTest.ministerioMembro.deleteMany();
  await prismaTest.movimentacaoEstoque.deleteMany();
  await prismaTest.manutencaoAtivo.deleteMany();
  await prismaTest.lancamento.deleteMany();
  await prismaTest.transferenciaCaixa.deleteMany();
  await prismaTest.session.deleteMany();
  await prismaTest.membro.updateMany({ data: { discipuladorId: null } });
  await prismaTest.membro.deleteMany();
});

/** Helper: cria Request com URL customizada (preserva search params). */
function makeRequest(url: string, method: "GET" | "POST" = "GET"): Request {
  return new Request(url, { method });
}

/** Helper: cria args com user injetado no context. */
function loaderArgs(request: Request, user: SessionUser) {
  return {
    request,
    params: {},
    context: {
      get: (_key: unknown) => user,
    },
  } as unknown as Parameters<typeof loader>[0];
}

/** Helper: cria usuário com cargo para auth do loader. */
async function makeAuthUser(
  cargo: Cargo,
  nome = "Auth User"
): Promise<{ id: string; nome: string; cargo: Cargo }> {
  const m = await prismaTest.membro.create({
    data: {
      nome,
      email: `auth-${Date.now()}-${Math.random()}@igreja.local`,
      tipo: "MEMBRO_ATIVO",
      cargo,
      senhaHash: await hashPassword("senha-123"),
    },
  });
  return { id: m.id, nome: m.nome, cargo };
}

/** Helper: cria membro genérico (sem cargo). */
async function makeMembro(
  nome: string,
  tipo: "VISITANTE" | "CONGREGADO" | "MEMBRO_ATIVO" = "VISITANTE"
): Promise<{ id: string; nome: string; tipo: typeof tipo }> {
  const m = await prismaTest.membro.create({
    data: { nome, tipo },
  });
  return { id: m.id, nome: m.nome, tipo };
}

describe("membros._index — loader (S02-T04)", () => {
  it("ADMIN + ?tipo=VISITANTE: retorna apenas VISITANTE", async () => {
    await makeMembro("Maria Visitante", "VISITANTE");
    await makeMembro("João Membro", "MEMBRO_ATIVO");
    const user = await makeAuthUser("ADMIN");

    const result = await loader(
      loaderArgs(
        makeRequest("http://localhost/app/membros?tipo=VISITANTE"),
        user
      )
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.nome).toBe("Maria Visitante");
    expect(result.total).toBe(1);
    // Filtro de tipo é ecoado em filterValues
    expect(result.filterValues.tipo).toBe("VISITANTE");
  });

  it("DISCIPULADOR: força discipuladorId = user.id (RBAC fina, ignora query string)", async () => {
    const disc = await makeAuthUser("DISCIPULADOR", "Disc Test");
    // Cria 2 discípulos do "disc" + 1 membro sem discipulador (que não deveria aparecer)
    const aluno1 = await makeMembro("Aluno 1");
    const aluno2 = await makeMembro("Aluno 2");
    await prismaTest.membro.update({
      where: { id: aluno1.id },
      data: { discipuladorId: disc.id },
    });
    await prismaTest.membro.update({
      where: { id: aluno2.id },
      data: { discipuladorId: disc.id },
    });
    await makeMembro("Sem Discipulador"); // não pertence a "disc"

    const result = await loader(loaderArgs(makeRequest("http://localhost/app/membros"), disc));

    // Apenas os discípulos de disc aparecem (RBAC força escopo).
    expect(result.total).toBe(2);
    expect(result.items.map((i) => i.nome).sort()).toEqual(["Aluno 1", "Aluno 2"]);
    // DISCIPULADOR não pode ter filtro de discipuladorId próprio via URL
    expect(result.filterValues.discipuladorId).toBeUndefined();
  });

  it("search params inválidos: loader NÃO throw, retorna defaults (UX gentil)", async () => {
    const user = await makeAuthUser("ADMIN");
    await makeMembro("Maria");

    // ?page=abc não é número válido → Zod falha → loader retorna defaults
    const result = await loader(
      loaderArgs(makeRequest("http://localhost/app/membros?page=abc"), user)
    );

    // Não lança, retorna items vazios + defaults
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
  });

  it("sem user no context: throw 401 (defense in depth)", async () => {
    await expect(
      loader(loaderArgs(makeRequest("http://localhost/app/membros"), null as never))
    ).rejects.toBeInstanceOf(Response);
    try {
      await loader(loaderArgs(makeRequest("http://localhost/app/membros"), null as never));
    } catch (e) {
      expect((e as Response).status).toBe(401);
    }
  });
});

describe("membros._index — render (S02-T04)", () => {
  it("happy path: renderiza TabelaMembros com membros do loaderData", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/membros",
        Component: () => (
          <DefaultComponent
            loaderData={{
              items: [
                {
                  id: "m1",
                  nome: "Maria da Silva",
                  tipo: "MEMBRO_ATIVO",
                  email: "maria@email.com",
                  createdAt: new Date("2022-03-12T12:00:00Z"),
                },
              ],
              total: 1,
              page: 1,
              pageSize: 25,
              filterValues: {
                q: undefined,
                tipo: undefined,
              },
              searchParams: new URLSearchParams(""),
              kpiTotal: 1,
              kpiAtivos: 1,
              kpiVisitantes: 0,
              kpiCongregados: 0,
            }}
          />
        ),
      },
    ]);
    const html = renderToString(<Stub initialEntries={["/app/membros"]} />);

    // TabelaMembros renderiza a <table> com caption sr-only
    expect(html).toContain("<table");
    expect(html).toContain("Lista de membros");
    // Nome do membro aparece
    expect(html).toContain("Maria da Silva");
    // Mapped tipo MEMBRO_ATIVO -> Membro Efetivo
    expect(html).toContain("Membro Efetivo");
    // Email aparece
    expect(html).toContain("maria@email.com");
    // Pagination text is rendered
    expect(html).toContain("Exibindo 1 a 1 de 1 membros");
  });

  it("empty state SEM filtros: mostra 'Nenhum membro por aqui ainda' + botão Cadastrar", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/membros",
        Component: () => (
          <DefaultComponent
            loaderData={{
              items: [],
              total: 0,
              page: 1,
              pageSize: 25,
              filterValues: {
                q: undefined,
                tipo: undefined,
              },
              searchParams: new URLSearchParams(""),
              kpiTotal: 0,
              kpiAtivos: 0,
              kpiVisitantes: 0,
              kpiCongregados: 0,
            }}
          />
        ),
      },
    ]);
    const html = renderToString(<Stub initialEntries={["/app/membros"]} />);

    expect(html).toContain("Nenhum membro por aqui ainda");
    expect(html).toContain("Comece cadastrando o primeiro membro da sua comunidade.");
    // Botão "Cadastrar membro" leva para /app/membros/novo
    expect(html).toContain("Cadastrar membro");
    expect(html).toContain('href="/app/membros/novo"');
  });

  it("empty state COM filtros: mostra 'Nenhum membro encontrado com esses filtros' + botão Limpar", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/membros",
        Component: () => (
          <DefaultComponent
            loaderData={{
              items: [],
              total: 0,
              page: 1,
              pageSize: 25,
              filterValues: {
                q: "maria",
                tipo: "VISITANTE",
              },
              searchParams: new URLSearchParams("?q=maria&tipo=VISITANTE"),
              kpiTotal: 0,
              kpiAtivos: 0,
              kpiVisitantes: 0,
              kpiCongregados: 0,
            }}
          />
        ),
      },
    ]);
    const html = renderToString(
      <Stub initialEntries={["/app/membros?q=maria&tipo=VISITANTE"]} />
    );

    expect(html).toContain("Nenhum membro encontrado com esses filtros");
    expect(html).toContain("Tente ajustar os filtros, limpar a busca ou navegar pelas abas.");
    // Botão "Limpar busca" leva para /app/membros (sem query)
    expect(html).toContain("Limpar busca");
  });

  it("contagem plural: 'Exibindo 1 a 2 de 2 membros'", async () => {
    const Stub = createRoutesStub([
      {
        path: "/app/membros",
        Component: () => (
          <DefaultComponent
            loaderData={{
              items: [
                {
                  id: "m1",
                  nome: "A",
                  tipo: "VISITANTE",
                  email: null,
                  createdAt: new Date("2023-11-05T12:00:00Z"),
                },
                {
                  id: "m2",
                  nome: "B",
                  tipo: "VISITANTE",
                  email: null,
                  createdAt: new Date("2023-11-06T12:00:00Z"),
                },
              ],
              total: 2,
              page: 1,
              pageSize: 25,
              filterValues: {
                q: undefined,
                tipo: undefined,
              },
              searchParams: new URLSearchParams(""),
              kpiTotal: 2,
              kpiAtivos: 0,
              kpiVisitantes: 2,
              kpiCongregados: 0,
            }}
          />
        ),
      },
    ]);
    const html = renderToString(<Stub initialEntries={["/app/membros"]} />);

    expect(html).toContain("Exibindo 1 a 2 de 2 membros");
  });
});

describe("membros._index — meta (S02-T04)", () => {
  it("meta retorna title 'Membros — Igreja Conect'", async () => {
    const mod = await import("./membros._index");
    const meta = (mod.meta as unknown as (a?: unknown) => Array<{ title: string }>)(undefined);
    expect(Array.isArray(meta)).toBe(true);
    expect(meta[0]?.title).toBe("Membros — Igreja Conect");
  });
});
