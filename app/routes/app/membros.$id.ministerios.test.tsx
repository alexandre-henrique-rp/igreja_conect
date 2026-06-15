/**
 * Teste de app/routes/app/membros.$id.ministerios.tsx (S04-T12).
 *
 * Cobre:
 *  - Loader: retorna membro + ministérios do membro + disponíveis
 *  - Action POST (intent=add): addMembroToMinisterio → redirect 302
 *  - Action POST (intent=remove): removeMembroFromMinisterio → redirect 302
 *  - SECRETARIO pode gerenciar
 *  - DISCIPULADOR → 403
 */
import React from "react";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { hashPassword } from "~/lib/auth.server";
import { prismaTest, setupTestDb } from "../../../tests/helpers/db";

type LoaderData = {
  membro: { id: string; nome: string } | null;
  ministeriosDoMembro: Array<{ id: string; nome: string }>;
  ministeriosDisponiveis: Array<{ id: string; nome: string }>;
  canEdit: boolean;
};

let cleanup: () => Promise<void>;
let loader: typeof import("./membros.$id.ministerios").loader;
let action: typeof import("./membros.$id.ministerios").action;
let DefaultComponent: React.ComponentType<{ loaderData: LoaderData }>;

beforeAll(async () => {
  cleanup = await setupTestDb("membros_ministerios");
  vi.resetModules();
  const mod = await import("./membros.$id.ministerios");
  loader = mod.loader;
  action = mod.action;
  DefaultComponent = mod.default as unknown as React.ComponentType<{
    loaderData: LoaderData;
  }>;
});

afterAll(async () => { await cleanup(); });

beforeEach(async () => {
  await prismaTest.ministerioMembro.deleteMany();
  await prismaTest.ministerio.deleteMany();
  await prismaTest.alertaDestinatario.deleteMany();
  await prismaTest.alerta.deleteMany();
  await prismaTest.membro.updateMany({ data: { discipuladorId: null } });
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
      email: `min-${Date.now()}-${Math.random()}@igreja.local`,
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

async function makeMinisterio(nome: string) {
  return prismaTest.ministerio.create({ data: { nome } });
}

async function makeMembro(nome: string) {
  return prismaTest.membro.create({
    data: {
      nome,
      email: `m-${Date.now()}-${Math.random()}@igreja.local`,
      tipo: "MEMBRO_ATIVO",
    },
  });
}

// ===== LOADER =====

describe("membros.$id.ministerios — loader (S04-T12)", () => {
  it("ADMIN: retorna membro + ministerios do membro + disponíveis", async () => {
    const user = await makeAuthUser("ADMIN");
    const membro = await makeMembro("João");
    const m1 = await makeMinisterio("Louvor");
    const m2 = await makeMinisterio("Ensino");
    const m3 = await makeMinisterio("Diaconia");

    // João está em Louvor
    await prismaTest.ministerioMembro.create({
      data: { ministerioId: m1.id, membroId: membro.id },
    });

    const result = await loader(
      args(
        makeGetRequest(`http://localhost/app/membros/${membro.id}/ministerios`),
        user,
        { id: membro.id }
      )
    );

    expect(result.membro?.id).toBe(membro.id);
    expect(result.membro?.nome).toBe("João");
    expect(result.ministeriosDoMembro).toHaveLength(1);
    expect(result.ministeriosDoMembro[0].id).toBe(m1.id);
    expect(result.ministeriosDisponiveis).toHaveLength(2); // m2 + m3
    expect(result.canEdit).toBe(true);
  });

  it("SECRETARIO: canEdit=true", async () => {
    const user = await makeAuthUser("SECRETARIO");
    const membro = await makeMembro("Maria");
    const result = await loader(
      args(
        makeGetRequest(`http://localhost/app/membros/${membro.id}/ministerios`),
        user,
        { id: membro.id }
      )
    );
    expect(result.canEdit).toBe(true);
  });

  it("DISCIPULADOR: fora de escopo → 404", async () => {
    const user = await makeAuthUser("DISCIPULADOR");
    const membro = await makeMembro("Pedro");

    await expect(
      loader(
        args(
          makeGetRequest(`http://localhost/app/membros/${membro.id}/ministerios`),
          user,
          { id: membro.id }
        )
      )
    ).rejects.toThrow();
  });

  it("DISCIPULADOR: em escopo canEdit=false", async () => {
    const user = await makeAuthUser("DISCIPULADOR");
    const membro = await prismaTest.membro.create({
      data: {
        nome: "Discípulo",
        email: `m-${Date.now()}-${Math.random()}@igreja.local`,
        tipo: "MEMBRO_ATIVO",
        discipuladorId: user.id,
      },
    });
    const result = await loader(
      args(
        makeGetRequest(`http://localhost/app/membros/${membro.id}/ministerios`),
        user,
        { id: membro.id }
      )
    );
    expect(result.canEdit).toBe(false);
  });

  it("membro inexistente → 404", async () => {
    const user = await makeAuthUser("ADMIN");
    await expect(
      loader(
        args(
          makeGetRequest("http://localhost/app/membros/inexistente/ministerios"),
          user,
          { id: "inexistente" }
        )
      )
    ).rejects.toThrow();
  });

  it("sem user → 401", async () => {
    await expect(
      loader(
        args(
          makeGetRequest("http://localhost/app/membros/123/ministerios"),
          null,
          { id: "123" }
        )
      )
    ).rejects.toThrow();
  });
});

// ===== ACTION =====

describe("membros.$id.ministerios — action (S04-T12)", () => {
  it("ADMIN: POST add → redirect 302", async () => {
    const user = await makeAuthUser("ADMIN");
    const membro = await makeMembro("João");
    const min = await makeMinisterio("Louvor");

    const res = await action(
      args(
        makePostRequest(
          `http://localhost/app/membros/${membro.id}/ministerios`,
          { intent: "add", ministerioId: min.id }
        ),
        user,
        { id: membro.id }
      )
    );

    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(302);

    // Verifica DB
    const vinculado = await prismaTest.ministerioMembro.findFirst({
      where: { ministerioId: min.id, membroId: membro.id },
    });
    expect(vinculado).not.toBeNull();
  });

  it("ADMIN: POST remove → redirect 302", async () => {
    const user = await makeAuthUser("ADMIN");
    const membro = await makeMembro("João");
    const min = await makeMinisterio("Louvor");
    await prismaTest.ministerioMembro.create({
      data: { ministerioId: min.id, membroId: membro.id },
    });

    const res = await action(
      args(
        makePostRequest(
          `http://localhost/app/membros/${membro.id}/ministerios`,
          { intent: "remove", ministerioId: min.id }
        ),
        user,
        { id: membro.id }
      )
    );

    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(302);

    const vinculado = await prismaTest.ministerioMembro.findFirst({
      where: { ministerioId: min.id, membroId: membro.id },
    });
    expect(vinculado).toBeNull();
  });

  it("ADMIN: ministerioId inválido → 400", async () => {
    const user = await makeAuthUser("ADMIN");
    const membro = await makeMembro("João");

    await expect(
      action(
        args(
          makePostRequest(
            `http://localhost/app/membros/${membro.id}/ministerios`,
            { intent: "add", ministerioId: "uuid-invalido" }
          ),
          user,
          { id: membro.id }
        )
      )
    ).rejects.toThrow();
  });

  it("DISCIPULADOR: POST add → 403", async () => {
    const user = await makeAuthUser("DISCIPULADOR");
    const membro = await makeMembro("Pedro");
    const min = await makeMinisterio("Ensino");

    await expect(
      action(
        args(
          makePostRequest(
            `http://localhost/app/membros/${membro.id}/ministerios`,
            { intent: "add", ministerioId: min.id }
          ),
          user,
          { id: membro.id }
        )
      )
    ).rejects.toThrow();
  });

  it("intent inválido → 400", async () => {
    const user = await makeAuthUser("ADMIN");
    const membro = await makeMembro("Teste");
    await expect(
      action(
        args(
          makePostRequest(
            `http://localhost/app/membros/${membro.id}/ministerios`,
            { intent: "invalid" }
          ),
          user,
          { id: membro.id }
        )
      )
    ).rejects.toThrow();
  });
});

// ===== RENDER =====

describe("membros.$id.ministerios — render (S04-T12)", () => {
  it("renderiza lista de ministérios + disponíveis", () => {
    const Stub = createRoutesStub([
      {
        path: "/app/membros/:id/ministerios",
        Component: () => (
          <DefaultComponent
            loaderData={{
              membro: { id: "m1", nome: "João" },
              ministeriosDoMembro: [{ id: "min1", nome: "Louvor" }],
              ministeriosDisponiveis: [{ id: "min2", nome: "Ensino" }],
              canEdit: true,
            }}
          />
        ),
      },
    ]);
    const html = renderToString(
      <Stub initialEntries={["/app/membros/m1/ministerios"]} />
    );
    expect(html).toContain("João");
    expect(html).toContain("Ministérios");
  });
});
