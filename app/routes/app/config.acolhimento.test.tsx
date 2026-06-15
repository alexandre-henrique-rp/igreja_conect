/**
 * Teste de app/routes/app/config.acolhimento.tsx (S04-T06).
 *
 * Cobre:
 *  - Loader: retorna config + canEdit
 *  - Loader: ADMIN vê canEdit=true
 *  - Loader: SECRETARIO vê canEdit=false
 *  - Action: ADMIN salva config OK → redirect
 *  - Action: SECRETARIO POST → 403
 *  - Render: ConfigAcolhimentoCard + FormConfigAcolhimento (canEdit) ou InfoBox
 */
import React from "react";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { prismaTest, setupTestDb } from "../../../tests/helpers/db";
import { hashPassword } from "~/lib/auth.server";
import type { SessionUser } from "~/lib/session.types";

type LoaderData = {
  config: {
    id: string;
    responsavelVisitanteTipo: string | null;
    responsavelMembroId: string | null;
    responsavelMinisterioId: string | null;
  } | null;
  canEdit: boolean;
  membros: Array<{ id: string; nome: string }>;
  ministerios: Array<{ id: string; nome: string }>;
};

let cleanup: () => Promise<void>;
let loader: typeof import("./config.acolhimento").loader;
let action: typeof import("./config.acolhimento").action;
let DefaultComponent: React.ComponentType<{ loaderData: LoaderData }>;

beforeAll(async () => {
  cleanup = await setupTestDb("config_acolhimento");
  vi.resetModules();
  const mod = await import("./config.acolhimento");
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
  await prismaTest.configAcolhimento.deleteMany();
  await prismaTest.ministerioMembro.deleteMany();
  await prismaTest.ministerio.deleteMany();
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
      email: `auth-${Date.now()}-${Math.random()}@igreja.local`,
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
  user: SessionUser | null,
  params: Record<string, string> = {}
) {
  return {
    request,
    params,
    context: { get: (_key: unknown) => user },
  } as unknown as Parameters<typeof action>[0];
}

// ===== LOADER =====

describe("config.acolhimento — loader (S04-T06)", () => {
  it("ADMIN: retorna config + canEdit=true", async () => {
    const user = await makeAuthUser("ADMIN");
    const result = await loader(args(makeGetRequest("http://localhost/app/config/acolhimento"), user));
    expect(result.canEdit).toBe(true);
    expect(result.config).toBeNull(); // sem config ainda
    expect(Array.isArray(result.membros)).toBe(true);
    expect(Array.isArray(result.ministerios)).toBe(true);
  });

  it("SECRETARIO: retorna apenas config atual, sem membros/ministérios", async () => {
    const user = await makeAuthUser("SECRETARIO");
    const membro = await prismaTest.membro.create({
      data: { nome: "Visível", tipo: "MEMBRO_ATIVO", cargo: "ADMIN" },
    });
    await prismaTest.ministerio.create({ data: { nome: "Louvor" } });

    const result = await loader(args(makeGetRequest("http://localhost/app/config/acolhimento"), user));
    expect(result.canEdit).toBe(false);
    expect(result.membros).toEqual([]);
    expect(result.ministerios).toEqual([]);
    expect(result.config).toBeNull();
    expect(membro.id).toBeTruthy();
  });

  it("sem user: 401", async () => {
    await expect(
      loader(args(makeGetRequest("http://localhost/app/config/acolhimento"), null))
    ).rejects.toThrow();
  });
});

// ===== ACTION =====

describe("config.acolhimento — action (S04-T06)", () => {
  it("ADMIN: POST salva config MEMBRO → redirect 302", async () => {
    const user = await makeAuthUser("ADMIN");
    const membro = await prismaTest.membro.create({
      data: { nome: "Resp", tipo: "MEMBRO_ATIVO", cargo: "ADMIN" },
    });

    const res = await action(
      args(
        makePostRequest("http://localhost/app/config/acolhimento", {
          responsavelVisitanteTipo: "MEMBRO",
          responsavelId: membro.id,
        }),
        user
      )
    );

    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(302);

    // Verifica DB
    const config = await prismaTest.configAcolhimento.findFirst();
    expect(config?.responsavelVisitanteTipo).toBe("MEMBRO");
    expect(config?.responsavelMembroId).toBe(membro.id);
  });

  it("ADMIN: POST salva config MINISTERIO → redirect 302", async () => {
    const user = await makeAuthUser("ADMIN");
    const ministerio = await prismaTest.ministerio.create({ data: { nome: "Louvor" } });

    const res = await action(
      args(
        makePostRequest("http://localhost/app/config/acolhimento", {
          responsavelVisitanteTipo: "MINISTERIO",
          responsavelId: ministerio.id,
        }),
        user
      )
    );

    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(302);

    const config = await prismaTest.configAcolhimento.findFirst();
    expect(config?.responsavelVisitanteTipo).toBe("MINISTERIO");
    expect(config?.responsavelMinisterioId).toBe(ministerio.id);
  });

  it("SECRETARIO: POST → 403", async () => {
    const user = await makeAuthUser("SECRETARIO");
    await expect(
      action(
        args(
          makePostRequest("http://localhost/app/config/acolhimento", {
            responsavelVisitanteTipo: "MEMBRO",
            responsavelId: "550e8400-e29b-41d4-a716-446655440000",
          }),
          user
        )
      )
    ).rejects.toThrow();
  });

  it("input inválido → 422", async () => {
    const user = await makeAuthUser("ADMIN");
    let caught: unknown = null;
    try {
      await action(
        args(
          makePostRequest("http://localhost/app/config/acolhimento", {
            responsavelVisitanteTipo: "INVALIDO",
            responsavelId: "uuid",
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

describe("config.acolhimento — render (S04-T06)", () => {
  it("canEdit=true: renderiza FormConfigAcolhimento", () => {
    const Stub = createRoutesStub([
      {
        path: "/app/config/acolhimento",
        Component: () => (
          <DefaultComponent
            loaderData={{
              config: null,
              canEdit: true,
              membros: [{ id: "m1", nome: "Membro 1" }],
              ministerios: [{ id: "min1", nome: "Louvor" }],
            }}
          />
        ),
      },
    ]);
    const html = renderToString(<Stub initialEntries={["/app/config/acolhimento"]} />);
    expect(html).toContain("Nenhum responsável configurado");
    expect(html).toContain("Membro responsável");
    expect(html).toContain('name="responsavelVisitanteTipo"');
    expect(html).toContain('name="responsavelId"');
  });

  it("canEdit=false: renderiza InfoBox (sem formulário de edição)", () => {
    const Stub = createRoutesStub([
      {
        path: "/app/config/acolhimento",
        Component: () => (
          <DefaultComponent
            loaderData={{
              config: null,
              canEdit: false,
              membros: [{ id: "m1", nome: "Membro 1" }],
              ministerios: [{ id: "min1", nome: "Louvor" }],
            }}
          />
        ),
      },
    ]);
    const html = renderToString(<Stub initialEntries={["/app/config/acolhimento"]} />);
    expect(html).toContain("Apenas o Admin pode alterar");
  });
});
