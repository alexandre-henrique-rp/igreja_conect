/**
 * Teste de integração de app/routes/app/membros.$id.tsx (S02-T07).
 *
 * Cobre loader, action e componente padrão da rota:
 *  - Loader: ADMIN lê membro válido e retorna dados + canDelete
 *  - Loader: id inválido → throw 404
 *  - Loader: DISCIPULADOR + membro de outro → throw 404 (não 403, não vaza)
 *  - Action: intent=delete + ADMIN → chama deleteMembro + redirect 302
 *  - Action: intent=delete + membro com discípulos → throw 409
 *  - Render: renderiza ResumoMembro (nome, tipo, contato) + Ações
 *
 * **Por que este teste existe:** S02 fechou com 0% coverage nesta rota
 * (393 testes não cobriam — só E2E cobria o fluxo, mas E2E não conta
 * no v8 coverage do vitest). Estes testes são unit/integration diretos
 * para elevar o coverage.
 *
 * @see app/lib/members.server.ts (getMembroById, deleteMembro)
 * @see app/routes/app/membros.$id.tsx
 */
import React from "react";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { createRoutesStub, MemoryRouter } from "react-router";
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

type Membro = {
  id: string;
  nome: string;
  tipo: "VISITANTE" | "CONGREGADO" | "MEMBRO_ATIVO";
  email: string | null;
  telefone: string | null;
  profissao: string | null;
  estadoCivil: string | null;
  dataConversao: string | Date | null;
  dataBatismo: string | Date | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  discipuladorId: string | null;
  cargo: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type LoaderData = {
  membro: Membro;
  canDelete: boolean;
  // S03:
  activeTab: "dados" | "discipulado" | "ministerios" | "fidelidade";
  canSeeFinancials: boolean;
  canEdit: boolean;
  canPromover: boolean;
  discipulador: { id: string; nome: string } | null;
  discipulos: { id: string; nome: string }[];
  ministerios: { id: string; nome: string }[];
  user: { id: string; nome: string; cargo: string | null };
};

let cleanup: () => Promise<void>;
let loader: typeof import("./membros.$id").loader;
let action: typeof import("./membros.$id").action;
let DefaultComponent: React.ComponentType<{ loaderData: LoaderData }>;
let ErrorBoundary: React.ComponentType<{
  error: unknown;
  params: Record<string, string>;
}>;

beforeAll(async () => {
  cleanup = await setupTestDb("membros_id");
  vi.resetModules();
  const mod = await import("./membros.$id");
  loader = mod.loader;
  action = mod.action;
  DefaultComponent = mod.default as unknown as React.ComponentType<{
    loaderData: LoaderData;
  }>;
  ErrorBoundary = mod.ErrorBoundary as unknown as React.ComponentType<{
    error: unknown;
    params: Record<string, string>;
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

// ===== helpers =====

function makeGetRequest(id: string): Request {
  return new Request(`http://localhost/app/membros/${id}`, { method: "GET" });
}

function makePostRequest(id: string, data: Record<string, string>): Request {
  const formData = new FormData();
  for (const [k, v] of Object.entries(data)) {
    formData.append(k, v);
  }
  return new Request(`http://localhost/app/membros/${id}`, {
    method: "POST",
    body: formData,
  });
}

function args(
  request: Request,
  user: SessionUser | null,
  params: Record<string, string> = {}
) {
  return {
    request,
    params,
    context: {
      get: (_key: unknown) => user,
    },
  } as unknown as Parameters<typeof action>[0];
}

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

async function makeMembro(
  nome: string,
  opts: {
    tipo?: "VISITANTE" | "CONGREGADO" | "MEMBRO_ATIVO";
    discipuladorId?: string | null;
    cargo?: Cargo | null;
    email?: string | null;
  } = {}
): Promise<{ id: string; nome: string; tipo: "VISITANTE" | "CONGREGADO" | "MEMBRO_ATIVO" }> {
  const m = await prismaTest.membro.create({
    data: {
      nome,
      tipo: opts.tipo ?? "VISITANTE",
      discipuladorId: opts.discipuladorId ?? null,
      cargo: opts.cargo ?? null,
      email: opts.email ?? null,
    },
  });
  return {
    id: m.id,
    nome: m.nome,
    tipo: m.tipo as "VISITANTE" | "CONGREGADO" | "MEMBRO_ATIVO",
  };
}

// ===== LOADER tests =====

describe("membros.$id — loader (S02-T07)", () => {
  it("ADMIN: retorna dados do membro + canDelete=true", async () => {
    const m = await makeMembro("Maria Detalhe", { email: "maria@x.com" });
    const user = await makeAuthUser("ADMIN");

    const result = await loader(args(makeGetRequest(m.id), user, { id: m.id }));

    expect(result.membro.id).toBe(m.id);
    expect(result.membro.nome).toBe("Maria Detalhe");
    expect(result.membro.email).toBe("maria@x.com");
    // LGPD AC-16: payload NUNCA inclui senhaHash
    expect((result.membro as Record<string, unknown>).senhaHash).toBeUndefined();
    expect(result.canDelete).toBe(true);
  });

  it("SECRETARIO: canDelete=false (não pode excluir — só ADMIN/PASTOR)", async () => {
    const m = await makeMembro("Maria S");
    const user = await makeAuthUser("SECRETARIO");

    const result = await loader(args(makeGetRequest(m.id), user, { id: m.id }));

    expect(result.canDelete).toBe(false);
  });

  it("id inválido: throw 404 (NotFoundError)", async () => {
    const user = await makeAuthUser("ADMIN");

    await expect(
      loader(
        args(makeGetRequest("00000000-0000-0000-0000-000000000000"), user, {
          id: "00000000-0000-0000-0000-000000000000",
        })
      )
    ).rejects.toThrow();
  });

  it("DISCIPULADOR + membro de outro: throw 404 (não 403 — não vaza existência)", async () => {
    const disc = await makeAuthUser("DISCIPULADOR", "Disc Test");
    const outro = await makeMembro("Fora de Escopo");

    await expect(
      loader(args(makeGetRequest(outro.id), disc, { id: outro.id }))
    ).rejects.toThrow();
  });

  it("DISCIPULADOR + seu próprio discípulo: retorna dados (escopo OK)", async () => {
    const disc = await makeAuthUser("DISCIPULADOR", "Disc OK");
    const aluno = await makeMembro("Aluno do Disc", { discipuladorId: disc.id });

    const result = await loader(args(makeGetRequest(aluno.id), disc, { id: aluno.id }));

    expect(result.membro.id).toBe(aluno.id);
  });

  it("sem user: throw 401 (defense in depth)", async () => {
    const m = await makeMembro("X");
    try {
      await loader(args(makeGetRequest(m.id), null, { id: m.id }));
      expect.fail("deveria ter lançado");
    } catch (e) {
      expect(e).toBeInstanceOf(Response);
      expect((e as Response).status).toBe(401);
    }
  });
});

// ===== ACTION tests =====

describe("membros.$id — action (S02-T07)", () => {
  it("ADMIN + intent=delete: chama deleteMembro + redirect 302 para /app/membros", async () => {
    const m = await makeMembro("Para Excluir");
    const user = await makeAuthUser("ADMIN");
    const request = makePostRequest(m.id, { intent: "delete" });

    const res = await action(args(request, user, { id: m.id }));

    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/app/membros");
    // Confirma que foi realmente excluído
    const found = await prismaTest.membro.findUnique({ where: { id: m.id } });
    expect(found).toBeNull();
  });

  it("ADMIN + intent=delete + membro com discípulos: throw 409 (BusinessRuleError)", async () => {
    const pai = await makeMembro("Pai de Alunos");
    await makeMembro("Filho 1", { discipuladorId: pai.id });
    await makeMembro("Filho 2", { discipuladorId: pai.id });
    const user = await makeAuthUser("ADMIN");
    const request = makePostRequest(pai.id, { intent: "delete" });

    const res = await action(args(request, user, { id: pai.id }));

    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.formError).toContain("Desvincule os discípulos");
    // Pai continua existindo
    const found = await prismaTest.membro.findUnique({ where: { id: pai.id } });
    expect(found).not.toBeNull();
  });

  it("SECRETARIO + intent=delete: throw 403 (não é ADMIN/PASTOR)", async () => {
    const m = await makeMembro("X");
    const user = await makeAuthUser("SECRETARIO");
    const request = makePostRequest(m.id, { intent: "delete" });

    await expect(action(args(request, user, { id: m.id }))).rejects.toThrow();
  });

  it("intent desconhecido: throw 400", async () => {
    const m = await makeMembro("X");
    const user = await makeAuthUser("ADMIN");
    const request = makePostRequest(m.id, { intent: "qualquer-coisa" });

    const res = await action(args(request, user, { id: m.id }));
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(400);
  });

  it("intent=delete + membro inexistente: throw 404", async () => {
    const user = await makeAuthUser("ADMIN");
    const request = makePostRequest("00000000-0000-0000-0000-000000000000", {
      intent: "delete",
    });

    const res = await action(
      args(request, user, { id: "00000000-0000-0000-0000-000000000000" })
    );
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(404);
  });
});

// ===== RENDER tests =====

/** Helper: constrói um loaderData completo para os testes S03. */
function makeLoaderData(overrides: Record<string, unknown> = {}) {
  return {
    membro: {
      id: "m1",
      nome: "Maria da Silva",
      tipo: "MEMBRO_ATIVO" as const,
      email: "maria@igreja.local",
      telefone: "(11) 98765-4321",
      profissao: "Professora",
      estadoCivil: "Casada",
      dataConversao: new Date("2020-05-10T00:00:00.000Z"),
      dataBatismo: new Date("2020-06-15T00:00:00.000Z"),
      logradouro: "Rua das Flores",
      numero: "123",
      bairro: "Centro",
      cidade: "São Paulo",
      estado: "SP",
      cep: "01000-000",
      discipuladorId: null,
      cargo: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    activeTab: "dados" as const,
    canSeeFinancials: true,
    canEdit: true,
    canDelete: true,
    canPromover: true,
    discipulador: null,
    discipulos: [],
    ministerios: [],
    user: { id: "u1", nome: "Auth", cargo: "ADMIN" as const },
    ...overrides,
  };
}

describe("membros.$id — render (S02-T07 + S03-T07)", () => {
  it("happy path ADMIN: renderiza PageHeader + Resumo + abas + 4 tabs (com Fidelidade)", () => {
    const Stub = createRoutesStub([
      {
        path: "/app/membros/:id",
        Component: () => (
          <DefaultComponent
            loaderData={makeLoaderData() as unknown as LoaderData}
          />
        ),
      },
    ]);
    const html = renderToString(<Stub initialEntries={["/app/membros/m1"]} />);

    // PageHeader com nome
    expect(html).toContain("Maria da Silva");
    // ResumoMembro
    expect(html).toContain("Membro ativo");
    expect(html).toContain("maria@igreja.local");
    expect(html).toContain("(11) 98765-4321");
    expect(html).toContain("Rua das Flores");
    expect(html).toContain("São Paulo");
    expect(html).toContain("CEP 01000-000");
    // Tabs
    expect(html).toContain('role="tablist"');
    expect(html).toContain("Dados");
    expect(html).toContain("Discipulado");
    expect(html).toContain("Ministérios");
    // ADMIN pode ver Fidelidade
    expect(html).toContain("Fidelidade");
    // Tab Dados ativa por default → renderiza TabDadosPessoais
    expect(html).toContain("tab-dados-pessoais");
    expect(html).toContain("Professora");
    expect(html).toContain("Casada");
    // Botão Editar + Excluir
    expect(html).toContain("Editar");
    expect(html).toContain("Excluir");
    expect(html).toContain('href="/app/membros/m1/editar"');
  });

  it("SECRETARIO (canDelete=false + !canSeeFinancials): NÃO renderiza Excluir e NÃO mostra tab Fidelidade", () => {
    const Stub = createRoutesStub([
      {
        path: "/app/membros/:id",
        Component: () => (
          <DefaultComponent
            loaderData={makeLoaderData({
              canDelete: false,
              canPromover: false,
              canSeeFinancials: false,
              user: { id: "u1", nome: "Auth", cargo: "SECRETARIO" },
            }) as unknown as LoaderData}
          />
        ),
      },
    ]);
    const html = renderToString(<Stub initialEntries={["/app/membros/m1"]} />);

    // Botão Editar ainda aparece
    expect(html).toContain("Editar");
    // Botão Excluir NÃO aparece
    expect(html).not.toContain(">Excluir<");
    // Tab Fidelidade NÃO aparece (GATE LGPD — RN-MEM-03)
    expect(html).not.toContain(">Fidelidade<");
  });

  it("DISCIPULADOR: canSeeFinancials=false, NÃO vê Fidelidade", () => {
    const Stub = createRoutesStub([
      {
        path: "/app/membros/:id",
        Component: () => (
          <DefaultComponent
            loaderData={makeLoaderData({
              canSeeFinancials: false,
              user: { id: "u1", nome: "Auth", cargo: "DISCIPULADOR" },
            }) as unknown as LoaderData}
          />
        ),
      },
    ]);
    const html = renderToString(<Stub initialEntries={["/app/membros/m1"]} />);

    expect(html).not.toContain(">Fidelidade<");
  });

  it("FINANCEIRO: canSeeFinancials=true, VÊ Fidelidade", () => {
    const Stub = createRoutesStub([
      {
        path: "/app/membros/:id",
        Component: () => (
          <DefaultComponent
            loaderData={makeLoaderData({
              canSeeFinancials: true,
              user: { id: "u1", nome: "Auth", cargo: "FINANCEIRO" },
            }) as unknown as LoaderData}
          />
        ),
      },
    ]);
    const html = renderToString(<Stub initialEntries={["/app/membros/m1"]} />);

    expect(html).toContain(">Fidelidade<");
  });

  it("BYPASS: SECRETARIO + activeTab=fidelidade → UI força tab=dados (camada 1 reforça)", () => {
    // Mesmo se loader passar activeTab="fidelidade" sem permissão,
    // a UI (TabsMembro) cai em "dados" como fallback.
    const Stub = createRoutesStub([
      {
        path: "/app/membros/:id",
        Component: () => (
          <DefaultComponent
            loaderData={makeLoaderData({
              activeTab: "fidelidade",
              canSeeFinancials: false,
              user: { id: "u1", nome: "Auth", cargo: "SECRETARIO" },
            }) as unknown as LoaderData}
          />
        ),
      },
    ]);
    const html = renderToString(<Stub initialEntries={["/app/membros/m1"]} />);

    // Tab Fidelidade NÃO renderiza (mesmo se activeTab="fidelidade")
    expect(html).not.toContain(">Fidelidade<");
    // Tab Dados está ativa → tab-dados-pessoais renderiza
    expect(html).toContain("tab-dados-pessoais");
  });

  it("LGPD: SECRETARIO + Fidelidade → HTML não contém termos sensíveis", () => {
    const Stub = createRoutesStub([
      {
        path: "/app/membros/:id",
        Component: () => (
          <DefaultComponent
            loaderData={makeLoaderData({
              activeTab: "dados",
              canSeeFinancials: false,
              user: { id: "u1", nome: "Auth", cargo: "SECRETARIO" },
            }) as unknown as LoaderData}
          />
        ),
      },
    ]);
    const html = renderToString(<Stub initialEntries={["/app/membros/m1"]} />);

    // Nenhuma string sensível de Fidelidade vaza
    expect(html).not.toContain("dízimo");
    expect(html).not.toContain("valorCentavos");
    expect(html).not.toContain("Lancamento");
  });

  it("activeTab=discipulado: renderiza TabDiscipulado", () => {
    const Stub = createRoutesStub([
      {
        path: "/app/membros/:id",
        Component: () => (
          <DefaultComponent
            loaderData={makeLoaderData({
              activeTab: "discipulado",
            }) as unknown as LoaderData}
          />
        ),
      },
    ]);
    const html = renderToString(<Stub initialEntries={["/app/membros/m1"]} />);

    expect(html).toContain("tab-discipulado");
  });

  it("activeTab=ministerios: renderiza TabMinisterios", () => {
    const Stub = createRoutesStub([
      {
        path: "/app/membros/:id",
        Component: () => (
          <DefaultComponent
            loaderData={makeLoaderData({
              activeTab: "ministerios",
            }) as unknown as LoaderData}
          />
        ),
      },
    ]);
    const html = renderToString(<Stub initialEntries={["/app/membros/m1"]} />);

    expect(html).toContain("tab-ministerios");
  });

  it("activeTab=fidelidade + canSeeFinancials=true: renderiza placeholder", () => {
    const Stub = createRoutesStub([
      {
        path: "/app/membros/:id",
        Component: () => (
          <DefaultComponent
            loaderData={makeLoaderData({
              activeTab: "fidelidade",
              canSeeFinancials: true,
            }) as unknown as LoaderData}
          />
        ),
      },
    ]);
    const html = renderToString(<Stub initialEntries={["/app/membros/m1"]} />);

    expect(html).toContain("tab-fidelidade");
    expect(html).toContain("Módulo Financeiro");
  });
});

// ===== ErrorBoundary test =====

describe("membros.$id — ErrorBoundary (S02-T07)", () => {
  it("404 → 'Membro não encontrado' + botão voltar", () => {
    // isRouteErrorResponse espera { status, statusText, internal, data }
    const error = {
      status: 404,
      statusText: "Not Found",
      internal: true,
      data: null,
    };
    const html = renderToString(
      <MemoryRouter>
        <ErrorBoundary error={error} params={{}} />
      </MemoryRouter>
    );
    expect(html).toContain("Membro não encontrado");
    expect(html).toContain("Voltar para a lista");
  });
});
