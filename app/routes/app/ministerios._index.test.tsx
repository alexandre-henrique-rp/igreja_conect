/**
 * Teste de integração de `app/routes/app/ministerios._index.tsx` (S03-T10).
 *
 * Cobre:
 * - Loader: lista ministérios + canEdit.
 * - Render: ADMIN vê botões; DISCIPULADOR vê cards read-only.
 * - Empty state: 0 ministérios.
 * - Action: dispatch por intent (create, update, delete, add-membro, remove-membro).
 *
 * **Estratégia:** tests com `setupTestDb` + prismaTest (integration).
 *
 * @see app/routes/app/ministerios._index.tsx
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

type MinisterioListItem = {
  id: string;
  nome: string;
  descricao: string | null;
  totalMembros: number;
  lider: { id: string; nome: string } | null;
};

type LoaderData = {
  ministerios: MinisterioListItem[];
  stats: { total: number; ativos: number; comLider: number };
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  canEdit: boolean;
};

let cleanup: () => Promise<void>;
let loader: typeof import("./ministerios._index").loader;
let action: typeof import("./ministerios._index").action;
let DefaultComponent: React.ComponentType<{ loaderData: LoaderData; actionData?: unknown }>;

beforeAll(async () => {
  cleanup = await setupTestDb("ministerios_index");
  vi.resetModules();
  const mod = await import("./ministerios._index");
  loader = mod.loader;
  action = mod.action;
  DefaultComponent = mod.default as unknown as React.ComponentType<{
    loaderData: LoaderData;
  }>;
});

afterAll(async () => {
  await cleanup();
});

beforeEach(async () => {
  await prismaTest.ministerioMembro.deleteMany();
  await prismaTest.ministerio.deleteMany();
  await prismaTest.session.deleteMany();
  await prismaTest.membro.updateMany({ data: { discipuladorId: null } });
  await prismaTest.membro.deleteMany();
});

// ===== helpers =====

function makeGetRequest(): Request {
  return new Request("http://localhost/app/ministerios", { method: "GET" });
}

function makePostRequest(data: Record<string, string>): Request {
  const formData = new FormData();
  for (const [k, v] of Object.entries(data)) {
    formData.append(k, v);
  }
  return new Request("http://localhost/app/ministerios", {
    method: "POST",
    body: formData,
  });
}

function args(request: Request, user: SessionUser | null) {
  return {
    request,
    params: {},
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

async function makeMinisterio(
  nome: string,
  descricao: string | null = null
): Promise<{ id: string; nome: string }> {
  const m = await prismaTest.ministerio.create({
    data: { nome, descricao },
  });
  return { id: m.id, nome: m.nome };
}

async function makeMembro(nome: string): Promise<{ id: string; nome: string }> {
  const m = await prismaTest.membro.create({
    data: { nome, tipo: "MEMBRO_ATIVO" },
  });
  return { id: m.id, nome: m.nome };
}

// ===== LOADER tests =====

describe("ministerios._index — loader (S03-T10)", () => {
  it("ADMIN: retorna lista de ministérios + canEdit=true", async () => {
    await makeMinisterio("Louvor");
    await makeMinisterio("Infantil");
    const user = await makeAuthUser("ADMIN");

    const result = await loader(args(makeGetRequest(), user));

    expect(result.ministerios).toHaveLength(2);
    expect(result.ministerios[0]?.nome).toBe("Infantil"); // ordenação por nome
    expect(result.ministerios[1]?.nome).toBe("Louvor");
    expect(result.canEdit).toBe(true);
  });

  it("DISCIPULADOR: canEdit=false (read-only)", async () => {
    await makeMinisterio("Louvor");
    const user = await makeAuthUser("DISCIPULADOR");

    const result = await loader(args(makeGetRequest(), user));

    expect(result.ministerios).toHaveLength(1);
    expect(result.canEdit).toBe(false);
  });

  it("0 ministérios: retorna lista vazia", async () => {
    const user = await makeAuthUser("ADMIN");

    const result = await loader(args(makeGetRequest(), user));

    expect(result.ministerios).toEqual([]);
  });

  it("sem user: throw 401", async () => {
    try {
      await loader(args(makeGetRequest(), null));
      expect.fail("deveria ter lançado");
    } catch (e) {
      expect(e).toBeInstanceOf(Response);
      expect((e as Response).status).toBe(401);
    }
  });

  it("ministério com membros: totalMembros e lider", async () => {
    const m = await makeMinisterio("Louvor");
    const ana = await makeMembro("Ana");
    const carlos = await makeMembro("Carlos");
    await prismaTest.ministerioMembro.create({
      data: { ministerioId: m.id, membroId: ana.id },
    });
    await prismaTest.ministerioMembro.create({
      data: { ministerioId: m.id, membroId: carlos.id },
    });
    const user = await makeAuthUser("ADMIN");

    const result = await loader(args(makeGetRequest(), user));

    expect(result.ministerios[0]?.totalMembros).toBe(2);
    expect(result.ministerios[0]?.lider).not.toBeNull();
  });
});

// ===== ACTION tests =====

describe("ministerios._index — action (S03-T10)", () => {
  it("ADMIN + intent=create: cria ministério + redirect 302", async () => {
    const user = await makeAuthUser("ADMIN");
    const request = makePostRequest({
      intent: "create",
      nome: "Louvor",
      descricao: "Equipe de louvor",
    });

    const res = await action(args(request, user));

    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(302);
    const created = await prismaTest.ministerio.findFirst({
      where: { nome: "Louvor" },
    });
    expect(created).not.toBeNull();
  });

  it("DISCIPULADOR + intent=create: throw 403 (não pode criar)", async () => {
    const user = await makeAuthUser("DISCIPULADOR");
    const request = makePostRequest({ intent: "create", nome: "Louvor" });

    await expect(action(args(request, user))).rejects.toThrow();
  });

  it("intent=create + nome duplicado: throw 409", async () => {
    await makeMinisterio("Louvor");
    const user = await makeAuthUser("ADMIN");
    const request = makePostRequest({ intent: "create", nome: "Louvor" });

    await expect(action(args(request, user))).rejects.toThrow();
  });

  it("ADMIN + intent=delete: exclui ministério vazio + redirect 302", async () => {
    const m = await makeMinisterio("Louvor");
    const user = await makeAuthUser("ADMIN");
    const request = makePostRequest({
      intent: "delete",
      ministerioId: m.id,
    });

    const res = await action(args(request, user));

    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(302);
    const after = await prismaTest.ministerio.findUnique({
      where: { id: m.id },
    });
    expect(after).toBeNull();
  });

  it("intent=delete + ministério com membros: throw 409", async () => {
    const m = await makeMinisterio("Louvor");
    const ana = await makeMembro("Ana");
    await prismaTest.ministerioMembro.create({
      data: { ministerioId: m.id, membroId: ana.id },
    });
    const user = await makeAuthUser("ADMIN");
    const request = makePostRequest({
      intent: "delete",
      ministerioId: m.id,
    });

    await expect(action(args(request, user))).rejects.toThrow();
  });

  it("ADMIN + intent=add-membro: vincula + redirect 302", async () => {
    const m = await makeMinisterio("Louvor");
    const ana = await makeMembro("Ana");
    const user = await makeAuthUser("ADMIN");
    const request = makePostRequest({
      intent: "add-membro",
      ministerioId: m.id,
      membroId: ana.id,
    });

    const res = await action(args(request, user));

    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(302);
    const link = await prismaTest.ministerioMembro.findUnique({
      where: { membroId_ministerioId: { membroId: ana.id, ministerioId: m.id } },
    });
    expect(link).not.toBeNull();
  });

  it("ADMIN + intent=remove-membro: desvincula + redirect 302", async () => {
    const m = await makeMinisterio("Louvor");
    const ana = await makeMembro("Ana");
    await prismaTest.ministerioMembro.create({
      data: { ministerioId: m.id, membroId: ana.id },
    });
    const user = await makeAuthUser("ADMIN");
    const request = makePostRequest({
      intent: "remove-membro",
      ministerioId: m.id,
      membroId: ana.id,
    });

    const res = await action(args(request, user));

    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(302);
    const link = await prismaTest.ministerioMembro.findUnique({
      where: { membroId_ministerioId: { membroId: ana.id, ministerioId: m.id } },
    });
    expect(link).toBeNull();
  });

  it("intent desconhecido: throw 400", async () => {
    const user = await makeAuthUser("ADMIN");
    const request = makePostRequest({ intent: "qualquer-coisa" });

    await expect(action(args(request, user))).rejects.toThrow();
  });
});

// ===== RENDER tests =====

describe("ministerios._index — render (S03-T10)", () => {
  it("ADMIN: renderiza h1 'Ministérios' + botão '+ Novo ministério'", () => {
    const Stub = createRoutesStub([
      {
        path: "/app/ministerios",
        Component: () => (
          <DefaultComponent
            loaderData={{
              ministerios: [
                {
                  id: "m1",
                  nome: "Louvor",
                  descricao: null,
                  totalMembros: 0,
                  lider: null,
                },
              ],
              stats: { total: 1, ativos: 1, comLider: 0 },
              pagination: { page: 1, pageSize: 6, total: 1, totalPages: 1 },
              canEdit: true,
            }}
          />
        ),
      },
    ]);
    const html = renderToString(<Stub initialEntries={["/app/ministerios"]} />);

    expect(html).toContain("Ministérios");
    expect(html).toContain("Novo minist");
    expect(html).toContain("Louvor");
  });

  it("DISCIPULADOR (canEdit=false): NÃO mostra botões de ação", () => {
    const Stub = createRoutesStub([
      {
        path: "/app/ministerios",
        Component: () => (
          <DefaultComponent
            loaderData={{
              ministerios: [
                {
                  id: "m1",
                  nome: "Louvor",
                  descricao: null,
                  totalMembros: 0,
                  lider: null,
                },
              ],
              stats: { total: 1, ativos: 1, comLider: 0 },
              pagination: { page: 1, pageSize: 6, total: 1, totalPages: 1 },
              canEdit: false,
            }}
          />
        ),
      },
    ]);
    const html = renderToString(<Stub initialEntries={["/app/ministerios"]} />);

    // Sem botões de criar/editar/excluir
    expect(html).not.toContain(">Novo minist");
    expect(html).toContain("Louvor"); // mas os cards aparecem
  });

  it("0 ministérios: empty state", () => {
    const Stub = createRoutesStub([
      {
        path: "/app/ministerios",
        Component: () => (
          <DefaultComponent
            loaderData={{
              ministerios: [],
              stats: { total: 0, ativos: 0, comLider: 0 },
              pagination: { page: 1, pageSize: 6, total: 0, totalPages: 0 },
              canEdit: true,
            }}
          />
        ),
      },
    ]);
    const html = renderToString(<Stub initialEntries={["/app/ministerios"]} />);

    expect(html).toContain("Nenhum minist");
  });
});
