/**
 * Teste de integração de app/routes/app/membros.$id.tipo.tsx (S03-T08, RN-MEM-06).
 *
 * Cobre:
 *  - GET → redirect 302 (rota é action-only)
 *  - POST tipo=CONGREGADO → 302 + update DB
 *  - POST tipo=INVALIDO → 422
 *  - POST sem user → 401
 *  - POST tipo inexistente (membro) → 404
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prismaTest, setupTestDb } from "../../../tests/helpers/db";
import type { SessionUser } from "~/lib/session.types";
import type { Route } from "./+types/membros.$id.tipo";

let cleanup: () => Promise<void>;
let loader: typeof import("./membros.$id.tipo").loader;
let action: typeof import("./membros.$id.tipo").action;

beforeAll(async () => {
  cleanup = await setupTestDb("membros_tipo");
  vi.resetModules();
  const mod = await import("./membros.$id.tipo");
  loader = mod.loader;
  action = mod.action;
});

afterAll(async () => { await cleanup(); });

beforeEach(async () => {
  await prismaTest.alertaDestinatario.deleteMany();
  await prismaTest.alerta.deleteMany();
  await prismaTest.ministerioMembro.deleteMany();
  await prismaTest.membro.updateMany({ data: { discipuladorId: null } });
  await prismaTest.membro.deleteMany();
});

// ----------------- helpers -----------------

function userWith(cargo: string | null, id = "u-" + cargo): SessionUser {
  return { id, nome: `User ${cargo}`, cargo };
}

async function makeMembro(opts: { nome: string; tipo?: "VISITANTE" | "CONGREGADO" | "MEMBRO_ATIVO" }) {
  const m = await prismaTest.membro.create({
    data: { nome: opts.nome, tipo: opts.tipo ?? "VISITANTE" },
  });
  return { id: m.id };
}

function loaderArgs(id: string): Route.LoaderArgs {
  return {
    params: { id },
    context: { get: () => userWith("ADMIN") },
  } as unknown as Route.LoaderArgs;
}

function actionArgs(id: string, tipo: string | null, user: SessionUser | null): Route.ActionArgs {
  const formData = new FormData();
  if (tipo !== null) formData.set("tipo", tipo);
  const request = new Request(`http://localhost/app/membros/${id}/tipo`, {
    method: "POST",
    body: formData,
  });
  return {
    request,
    params: { id },
    context: { get: (_k: unknown) => user },
  } as unknown as Route.ActionArgs;
}

// ----------------- loader -----------------

describe("membros.$id.tipo — loader (S03-T08)", () => {
  it("GET → redirect 302 para /app/membros/:id (rota é action-only)", async () => {
    const m = await makeMembro({ nome: "Maria" });
    const res = await loader(loaderArgs(m.id));
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(`/app/membros/${m.id}`);
  });
});

// ----------------- action -----------------

describe("membros.$id.tipo — action (S03-T08)", () => {
  it("POST tipo=CONGREGADO → 302 + DB atualizado", async () => {
    const m = await makeMembro({ nome: "Maria" });
    const res = await action(actionArgs(m.id, "CONGREGADO", userWith("ADMIN")));
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(`/app/membros/${m.id}`);
    const updated = await prismaTest.membro.findUnique({ where: { id: m.id } });
    expect(updated?.tipo).toBe("CONGREGADO");
  });

  it("POST tipo=MEMBRO_ATIVO → 302 + DB atualizado", async () => {
    const m = await makeMembro({ nome: "João", tipo: "CONGREGADO" });
    await action(actionArgs(m.id, "MEMBRO_ATIVO", userWith("ADMIN")));
    const updated = await prismaTest.membro.findUnique({ where: { id: m.id } });
    expect(updated?.tipo).toBe("MEMBRO_ATIVO");
  });

  it("POST tipo=VISITANTE → 302 (permite rebaixar)", async () => {
    const m = await makeMembro({ nome: "Ana", tipo: "MEMBRO_ATIVO" });
    await action(actionArgs(m.id, "VISITANTE", userWith("ADMIN")));
    const updated = await prismaTest.membro.findUnique({ where: { id: m.id } });
    expect(updated?.tipo).toBe("VISITANTE");
  });

  it("POST tipo=INVALIDO → 422 com fieldErrors.tipo", async () => {
    const m = await makeMembro({ nome: "Z" });
    let caught: unknown = null;
    try {
      await action(actionArgs(m.id, "INVALIDO", userWith("ADMIN")));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(422);
      const body = JSON.parse(await caught.text());
      expect(body.fieldErrors.tipo).toBeTruthy();
    }
  });

  it("POST sem campo tipo → 422", async () => {
    const m = await makeMembro({ nome: "Y" });
    let caught: unknown = null;
    try {
      await action(actionArgs(m.id, null, userWith("ADMIN")));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) expect(caught.status).toBe(422);
  });

  it("POST sem user no context → 401 (defense in depth)", async () => {
    const m = await makeMembro({ nome: "W" });
    let caught: unknown = null;
    try {
      await action(actionArgs(m.id, "CONGREGADO", null));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) expect(caught.status).toBe(401);
  });

  it("POST com membro inexistente → 404", async () => {
    let caught: unknown = null;
    try {
      await action(
        actionArgs("00000000-0000-0000-0000-000000000000", "CONGREGADO", userWith("ADMIN"))
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) expect(caught.status).toBe(404);
  });

  it("POST com PASTOR também pode promover (camada 3 RBAC)", async () => {
    const m = await makeMembro({ nome: "P" });
    const res = await action(actionArgs(m.id, "CONGREGADO", userWith("PASTOR")));
    expect(res.status).toBe(302);
  });

  it("POST com SECRETARIO também pode promover (RN-MEM-01)", async () => {
    const m = await makeMembro({ nome: "S" });
    const res = await action(actionArgs(m.id, "CONGREGADO", userWith("SECRETARIO")));
    expect(res.status).toBe(302);
  });

  it("POST com DISCIPULADOR tentando promover membro fora de escopo → 404 (não 403)", async () => {
    const m = await makeMembro({ nome: "Fora" });
    let caught: unknown = null;
    try {
      await action(actionArgs(m.id, "CONGREGADO", userWith("DISCIPULADOR")));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) expect(caught.status).toBe(404);
  });
});
