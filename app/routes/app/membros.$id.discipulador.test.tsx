/**
 * Teste de integração de app/routes/app/membros.$id.discipulador.tsx (S03-T13).
 *
 * Cobre:
 *  - GET → redirect 302
 *  - POST/DELETE desvincula → 302 + DB null
 *  - Membro inexistente → 404
 *  - Sem auth → 401
 *  - Sem discipulador (no-op) → 302 OK
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prismaTest, setupTestDb } from "../../../tests/helpers/db";
import type { SessionUser } from "~/lib/session.types";
import type { Route } from "./+types/membros.$id.discipulador";

let cleanup: () => Promise<void>;
let loader: typeof import("./membros.$id.discipulador").loader;
let action: typeof import("./membros.$id.discipulador").action;

beforeAll(async () => {
  cleanup = await setupTestDb("membros_discipulador");
  vi.resetModules();
  const mod = await import("./membros.$id.discipulador");
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

async function makeMembro(opts: { nome: string; discipuladorId?: string | null }) {
  const m = await prismaTest.membro.create({
    data: { nome: opts.nome, discipuladorId: opts.discipuladorId ?? null },
  });
  return { id: m.id };
}

function loaderArgs(id: string): Route.LoaderArgs {
  return {
    params: { id },
    context: { get: () => userWith("ADMIN") },
  } as unknown as Route.LoaderArgs;
}

function actionArgs(id: string, method: "POST" | "DELETE" = "POST", user: SessionUser | null = userWith("ADMIN")): Route.ActionArgs {
  const request = new Request(`http://localhost/app/membros/${id}/discipulador`, {
    method,
  });
  return {
    request,
    params: { id },
    context: { get: (_k: unknown) => user },
  } as unknown as Route.ActionArgs;
}

// ----------------- loader -----------------

describe("membros.$id.discipulador — loader (S03-T13)", () => {
  it("GET → redirect 302 para /app/membros/:id", async () => {
    const m = await makeMembro({ nome: "X" });
    const res = await loader(loaderArgs(m.id));
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(`/app/membros/${m.id}`);
  });
});

// ----------------- action -----------------

describe("membros.$id.discipulador — action (S03-T13)", () => {
  it("POST: desvincula discípulo existente → 302 + DB null", async () => {
    const disc = await prismaTest.membro.create({ data: { nome: "Disc" } });
    const aluno = await makeMembro({ nome: "Aluno", discipuladorId: disc.id });
    const res = await action(actionArgs(aluno.id));
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(`/app/membros/${aluno.id}`);
    const updated = await prismaTest.membro.findUnique({ where: { id: aluno.id } });
    expect(updated?.discipuladorId).toBeNull();
  });

  it("DELETE: desvincula discípulo existente → 302 + DB null", async () => {
    const disc = await prismaTest.membro.create({ data: { nome: "Disc" } });
    const aluno = await makeMembro({ nome: "Aluno", discipuladorId: disc.id });
    const res = await action(actionArgs(aluno.id, "DELETE"));
    expect(res.status).toBe(302);
    const updated = await prismaTest.membro.findUnique({ where: { id: aluno.id } });
    expect(updated?.discipuladorId).toBeNull();
  });

  it("Membro sem discipulador: no-op OK (302)", async () => {
    const m = await makeMembro({ nome: "Sem Disc" });
    const res = await action(actionArgs(m.id));
    expect(res.status).toBe(302);
    const updated = await prismaTest.membro.findUnique({ where: { id: m.id } });
    expect(updated?.discipuladorId).toBeNull();
  });

  it("Membro inexistente → 404", async () => {
    let caught: unknown = null;
    try {
      await action(
        actionArgs("00000000-0000-0000-0000-000000000000", "POST", userWith("ADMIN"))
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) expect(caught.status).toBe(404);
  });

  it("Sem user no context → 401", async () => {
    const m = await makeMembro({ nome: "Y" });
    let caught: unknown = null;
    try {
      await action(actionArgs(m.id, "POST", null));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) expect(caught.status).toBe(401);
  });

  it("DISCIPULADOR pode desvincular (camada 3 RBAC — assertCanWriteMembers)", async () => {
    const disc = await prismaTest.membro.create({
      data: { nome: "Disc", cargo: "LIDER_MINISTERIO" },
    });
    const aluno = await makeMembro({ nome: "Filho", discipuladorId: disc.id });
    const res = await action(
      actionArgs(aluno.id, "POST", {
        id: disc.id,
        nome: "Disc",
        cargo: "LIDER_MINISTERIO",
      })
    );
    expect(res.status).toBe(302);
  });
});
