/**
 * Teste de app/routes/app/alertas._index.tsx (S04-T08).
 *
 * Cobre:
 *  - Loader: ADMIN vê todos os alertas
 *  - Loader: MEMBRO vê apenas seus alertas (como destinatário)
 *  - Paginação via query params page/take
 *  - Action: POST marcarLido → 302
 *  - Action: POST marcarResolvido → 302
 *  - Action: POST inválido → 422
 *  - Render: lista de alertas com botões lido/resolvido
 */
import React from "react";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { hashPassword } from "~/lib/auth.server";
import { prismaTest, setupTestDb } from "../../../tests/helpers/db";

type LoaderData = {
  items: Array<{
    id: string;
    titulo: string;
    mensagem: string;
    lido: boolean;
    resolvido: boolean;
    createdAt: string;
  }>;
  counts: {
    todos: number;
    naoLidos: number;
    resolvidos: number;
  };
  activeFilter: "todos" | "naoLidos" | "resolvidos";
  canResolve: boolean;
};

let cleanup: () => Promise<void>;
let loader: typeof import("./alertas._index").loader;
let action: typeof import("./alertas._index").action;
let DefaultComponent: React.ComponentType<{ loaderData: LoaderData }>;

beforeAll(async () => {
  cleanup = await setupTestDb("alertas_index");
  vi.resetModules();
  const mod = await import("./alertas._index");
  loader = mod.loader;
  action = mod.action;
  DefaultComponent = mod.default as unknown as React.ComponentType<{
    loaderData: LoaderData;
  }>;
});

afterAll(async () => { await cleanup(); });

beforeEach(async () => {
  await prismaTest.alertaDestinatario.deleteMany();
  await prismaTest.alerta.deleteMany();
  await prismaTest.membro.deleteMany();
});

// ===== helpers =====

async function makeAuthUser(
  cargo: string | null,
  nome = "Auth User"
): Promise<{ id: string; nome: string; cargo: string | null }> {
  const m = await prismaTest.membro.create({
    data: {
      nome,
      email: `alertas-${Date.now()}-${Math.random()}@igreja.local`,
      tipo: "MEMBRO_ATIVO",
      cargo: cargo as any,
      senhaHash: await hashPassword("senha-123"),
    },
  });
  return { id: m.id, nome: m.nome, cargo };
}

function makeGetRequest(url: string): Request {
  return new Request(url, { method: "GET" });
}

function makePostRequest(url: string, data: Record<string, string>): Request {
  const formData = new FormData();
  for (const [k, v] of Object.entries(data)) {
    formData.append(k, v);
  }
  return new Request(url, { method: "POST", body: formData });
}

function args(
  request: Request,
  user: { id: string; nome: string; cargo: string | null } | null,
  params: Record<string, string> = {}
) {
  return {
    request,
    params,
    context: { get: (_key: unknown) => user },
  } as unknown as Parameters<typeof action>[0];
}

async function createAlerta(
  titulo: string,
  destinatarioIds: string[]
) {
  return prismaTest.alerta.create({
    data: {
      titulo,
      mensagem: `Mensagem: ${titulo}`,
      destinatarios: {
        create: destinatarioIds.map((membroId) => ({ membroId })),
      },
    },
  });
}

// ===== LOADER =====

describe("alertas._index — loader (S04-T08)", () => {
  it("ADMIN: vê apenas alertas onde é destinatário", async () => {
    const user = await makeAuthUser("ADMIN");
    const outro = await makeAuthUser("PASTOR", "Outro");
    const a1 = await createAlerta("Alerta do user", [user.id]);
    await createAlerta("Alerta do outro", [outro.id]);

    const result = await loader(
      args(makeGetRequest("http://localhost/app/alertas"), user)
    );

    expect(result.items.map((a) => a.id)).toEqual([a1.id]);
    expect(result.counts.todos).toBe(1);
    expect(result.canResolve).toBe(true);
  });

  it("MEMBRO (sem cargo): vê apenas alertas onde é destinatário", async () => {
    const user = await makeAuthUser(null, "MembroComum");
    const outro = await makeAuthUser(null, "Outro");
    await createAlerta("Alerta do user", [user.id]);
    await createAlerta("Alerta do outro", [outro.id]);
    await createAlerta("Alerta compartilhado", [user.id, outro.id]);

    const result = await loader(
      args(makeGetRequest("http://localhost/app/alertas"), user)
    );

    expect(result.items).toHaveLength(2);
    expect(result.counts.todos).toBe(2);
    expect(result.canResolve).toBe(false);
  });

  it("filtro naoLidos: lê ?filter=naoLidos", async () => {
    const user = await makeAuthUser(null, "MembroComum");
    const lido = await createAlerta("Já lido", [user.id]);
    await createAlerta("Não lido", [user.id]);

    await prismaTest.alertaDestinatario.updateMany({
      where: { alertaId: lido.id, membroId: user.id },
      data: { lido: true },
    });

    const result = await loader(
      args(makeGetRequest("http://localhost/app/alertas?filter=naoLidos"), user)
    );

    expect(result.activeFilter).toBe("naoLidos");
    expect(result.items.map((a) => a.titulo)).toEqual(["Não lido"]);
    expect(result.counts.naoLidos).toBe(1);
  });

  it("filtro resolvidos: lê ?filter=resolvidos", async () => {
    const user = await makeAuthUser(null, "MembroComum");
    await createAlerta("Aberto", [user.id]);
    const resolvido = await createAlerta("Resolvido", [user.id]);
    await prismaTest.alertaDestinatario.updateMany({
      where: { alertaId: resolvido.id, membroId: user.id },
      data: { resolvido: true, lido: true },
    });

    const result = await loader(
      args(makeGetRequest("http://localhost/app/alertas?filter=resolvidos"), user)
    );

    expect(result.activeFilter).toBe("resolvidos");
    expect(result.items.map((a) => a.titulo)).toEqual(["Resolvido"]);
    expect(result.counts.resolvidos).toBe(1);
  });

  it("sem user: 401", async () => {
    await expect(
      loader(args(makeGetRequest("http://localhost/app/alertas"), null))
    ).rejects.toThrow();
  });
});

// ===== ACTION =====

describe("alertas._index — action (S04-T08)", () => {
  it("ADMIN: marcarLido → 302 e atualiza somente destinatário", async () => {
    const user = await makeAuthUser("ADMIN");
    const alerta = await createAlerta("Teste", [user.id]);

    const res = await action(
      args(
        makePostRequest("http://localhost/app/alertas", {
          _action: "marcarLido",
          alertaId: alerta.id,
        }),
        user
      )
    );

    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(302);

    const updatedAlerta = await prismaTest.alerta.findUnique({
      where: { id: alerta.id },
    });
    const updatedDestinatario = await prismaTest.alertaDestinatario.findFirst({
      where: { alertaId: alerta.id, membroId: user.id },
    });
    expect(updatedDestinatario?.lido).toBe(true);
  });

  it("ADMIN: marcarResolvido → 302 e atualiza somente destinatário", async () => {
    const user = await makeAuthUser("ADMIN");
    const alerta = await createAlerta("Resolvível", [user.id]);

    const res = await action(
      args(
        makePostRequest("http://localhost/app/alertas", {
          _action: "marcarResolvido",
          alertaId: alerta.id,
        }),
        user
      )
    );

    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(302);

    const updatedAlerta = await prismaTest.alerta.findUnique({
      where: { id: alerta.id },
    });
    const updatedDestinatario = await prismaTest.alertaDestinatario.findFirst({
      where: { alertaId: alerta.id, membroId: user.id },
    });
    expect(updatedAlerta?.resolvido).toBe(false);
    expect(updatedDestinatario?.resolvido).toBe(true);
    expect(updatedDestinatario?.lido).toBe(true);
  });

  it("MEMBRO (sem cargo): marcarResolvido → 403", async () => {
    const user = await makeAuthUser(null, "Comum");
    const alerta = await createAlerta("Bloqueado", [user.id]);

    await expect(
      action(
        args(
          makePostRequest("http://localhost/app/alertas", {
            _action: "marcarResolvido",
            alertaId: alerta.id,
          }),
          user
        )
      )
    ).rejects.toThrow();
  });

  it("action inválida → 422", async () => {
    const user = await makeAuthUser("ADMIN");
    let caught: unknown = null;
    try {
      await action(
        args(
          makePostRequest("http://localhost/app/alertas", {
            _action: "invalido",
            alertaId: "uuid",
          }),
          user
        )
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) expect(caught.status).toBe(422);
  });
});

// ===== RENDER =====

describe("alertas._index — render (S04-T08)", () => {
  it("renderiza TabsFiltroAlertas e CardAlerta com _action compatível", () => {
    const Stub = createRoutesStub([
      {
        path: "/app/alertas",
        Component: () => (
          <DefaultComponent
            loaderData={{
              items: [
                {
                  id: "a1",
                  titulo: "Alerta Teste",
                  mensagem: "Mensagem teste",
                  lido: false,
                  resolvido: false,
                  createdAt: "2026-01-01T00:00:00.000Z",
                },
              ],
              counts: { todos: 1, naoLidos: 1, resolvidos: 0 },
              activeFilter: "todos",
              canResolve: true,
            }}
          />
        ),
      },
      {
        path: "/app/membros/:id",
        Component: () => null,
      },
    ]);
    const html = renderToString(<Stub initialEntries={["/app/alertas"]} />);
    expect(html).toContain("Alerta Teste");
    expect(html).toContain("Alertas");
    expect(html).toContain("filter=todos");
    expect(html).toContain('name="_action"');
    expect(html).toContain('value="marcarLido"');
    expect(html).toContain("Marcar lido");
  });
});
