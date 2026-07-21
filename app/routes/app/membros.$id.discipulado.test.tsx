/**
 * Teste de integração de app/routes/app/membros.$id.discipulado.tsx (S03-T06).
 *
 * Cobre os 4 edge cases de RN-MEM-04 (SPEC §6.5):
 *  1. Boundary 12 OK / 13 bloqueado
 *  2. Auto-vínculo bloqueado
 *  3. Loop A→B→A bloqueado
 *  4. Membro inexistente → 404
 *  5. Sem auth → 401
 *  6. Loader: retorna estrutura completa
 *  7. Loader: DISCIPULADOR fora de escopo → 404
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prismaTest, setupTestDb } from "../../../tests/helpers/db";
import type { SessionUser } from "~/lib/session.types";

let cleanup: () => Promise<void>;
let loader: typeof import("./membros.$id.discipulado").loader;
let action: typeof import("./membros.$id.discipulado").action;

beforeAll(async () => {
  cleanup = await setupTestDb("membros_discipulado");
  vi.resetModules();
  const mod = await import("./membros.$id.discipulado");
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

async function makeMembro(opts: { nome: string; cargo?: "LIDER_MINISTERIO" | "ADMIN" | "PASTOR" | "SECRETARIO" | "FINANCEIRO" | "LIDER_MINISTERIO" | null; discipuladorId?: string | null }) {
  const m = await prismaTest.membro.create({
    data: {
      nome: opts.nome,
      cargo: opts.cargo ?? null,
      discipuladorId: opts.discipuladorId ?? null,
    },
  });
  return { id: m.id };
}

function loaderArgs(id: string, user: SessionUser | null = userWith("ADMIN")) {
  return {
    params: { id },
    context: { get: (_k: unknown) => user },
  } as unknown as Parameters<typeof loader>[0];
}

function actionArgs(id: string, intent: "assign" | "unassign", extra: Record<string, string> = {}, user: SessionUser | null = userWith("ADMIN")) {
  const formData = new FormData();
  formData.set("intent", intent);
  for (const [k, v] of Object.entries(extra)) formData.set(k, v);
  const request = new Request(`http://localhost/app/membros/${id}/discipulado`, {
    method: "POST",
    body: formData,
  });
  return {
    request,
    params: { id },
    context: { get: (_k: unknown) => user },
  } as unknown as Parameters<typeof action>[0];
}

// ----------------- loader -----------------

describe("membros.$id.discipulado — loader (S03-T06)", () => {
  it("happy path: retorna estrutura completa", async () => {
    const m = await makeMembro({ nome: "M" });
    const data = await loader(loaderArgs(m.id));
    expect(data.membro.id).toBe(m.id);
    expect(data.discipuladorAtual).toBeNull();
    expect(data.cadeia).toEqual([]);
    expect(data.discipuladoresDisponiveis).toBeInstanceOf(Array);
  });

  it("DISCIPULADOR acessando membro fora de escopo → NotFoundError", async () => {
    const m = await makeMembro({ nome: "Fora" });
    let caught: unknown = null;
    try {
      await loader(loaderArgs(m.id, userWith("LIDER_MINISTERIO")));
    } catch (e) {
      caught = e;
    }
    // getMembroById lança NotFoundError (Error subclass) — ErrorBoundary trata.
    expect((caught as { name?: string })?.name).toBe("NotFoundError");
  });

  it("Sem user no context → 401", async () => {
    const m = await makeMembro({ nome: "X" });
    let caught: unknown = null;
    try {
      await loader(loaderArgs(m.id, null));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) expect(caught.status).toBe(401);
  });
});

// ----------------- action: assign -----------------

describe("membros.$id.discipulado — action: assign (S03-T06)", () => {
  it("happy path: atribui discipulador → 302", async () => {
    const disc = await makeMembro({ nome: "Disc" });
    const aluno = await makeMembro({ nome: "Aluno" });
    const res = await action(actionArgs(aluno.id, "assign", { discipuladorId: disc.id }));
    expect(res.status).toBe(302);
    const updated = await prismaTest.membro.findUnique({ where: { id: aluno.id } });
    expect(updated?.discipuladorId).toBe(disc.id);
  });

  it("Boundary 12: 12 discípulos OK", async () => {
    const disc = await makeMembro({ nome: "Disc" });
    for (let i = 0; i < 12; i++) {
      const aluno = await makeMembro({ nome: `A${i}` });
      const res = await action(actionArgs(aluno.id, "assign", { discipuladorId: disc.id }));
      expect(res.status).toBe(302);
    }
    const count = await prismaTest.membro.count({ where: { discipuladorId: disc.id } });
    expect(count).toBe(12);
  });

  it("Boundary 13: 13º vinculado → 422 com formError", async () => {
    const disc = await makeMembro({ nome: "Disc" });
    for (let i = 0; i < 12; i++) {
      const aluno = await makeMembro({ nome: `A${i}` });
      await action(actionArgs(aluno.id, "assign", { discipuladorId: disc.id }));
    }
    const aluno13 = await makeMembro({ nome: "Aluno 13" });
    let caught: unknown = null;
    try {
      await action(actionArgs(aluno13.id, "assign", { discipuladorId: disc.id }));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(422);
      const body = JSON.parse(await caught.text());
      expect(body.formError).toMatch(/12|limite/i);
    }
  });

  it("Auto-vínculo (disc === aluno) → 422 com formError em PT-BR", async () => {
    const m = await makeMembro({ nome: "Self" });
    let caught: unknown = null;
    try {
      await action(actionArgs(m.id, "assign", { discipuladorId: m.id }));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(422);
      const body = JSON.parse(await caught.text());
      expect(body.formError).toMatch(/próprio discipulador|auto/i);
    }
  });

  it("Loop A→B→A: tentar fazer A ser discípulo de B → 422 (loop)", async () => {
    const a = await makeMembro({ nome: "A" });
    const b = await makeMembro({ nome: "B", discipuladorId: a.id });
    let caught: unknown = null;
    try {
      // Tentar atribuir A como discípulo de B = loop
      await action(actionArgs(a.id, "assign", { discipuladorId: b.id }));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(422);
      const body = JSON.parse(await caught.text());
      expect(body.formError).toMatch(/loop|circular|ciclo/i);
    }
  });

  it("Loop profundo A→B→C→A → 422 (loop)", async () => {
    const a = await makeMembro({ nome: "A" });
    const b = await makeMembro({ nome: "B", discipuladorId: a.id });
    const c = await makeMembro({ nome: "C", discipuladorId: b.id });
    let caught: unknown = null;
    try {
      await action(actionArgs(a.id, "assign", { discipuladorId: c.id }));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) expect(caught.status).toBe(422);
  });

  it("discipuladorId UUID inválido → 422 com fieldErrors", async () => {
    const m = await makeMembro({ nome: "M" });
    let caught: unknown = null;
    try {
      await action(actionArgs(m.id, "assign", { discipuladorId: "nao-eh-uuid" }));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(422);
      const body = JSON.parse(await caught.text());
      expect(body.fieldErrors.discipuladorId).toBeTruthy();
    }
  });

  it("discipulador inexistente → 404", async () => {
    const m = await makeMembro({ nome: "M" });
    let caught: unknown = null;
    try {
      await action(
        actionArgs(m.id, "assign", {
          discipuladorId: "00000000-0000-0000-0000-000000000000",
        })
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) expect(caught.status).toBe(404);
  });

  it("DISCIPULADOR tentando atribuir a si mesmo → 404 (escopo do getMembroById)", async () => {
    const m = await makeMembro({ nome: "M" });
    let caught: unknown = null;
    try {
      await action(actionArgs(m.id, "assign", { discipuladorId: m.id }, userWith("LIDER_MINISTERIO")));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      // 422 (auto-vínculo) ou 404 (escopo) — ambos corretos
      expect([404, 422]).toContain(caught.status);
    }
  });
});

// ----------------- action: unassign -----------------

describe("membros.$id.discipulado — action: unassign (S03-T06)", () => {
  it("happy path: desvincula → 302", async () => {
    const disc = await makeMembro({ nome: "Disc" });
    const aluno = await makeMembro({ nome: "Aluno", discipuladorId: disc.id });
    const res = await action(actionArgs(aluno.id, "unassign"));
    expect(res.status).toBe(302);
    const updated = await prismaTest.membro.findUnique({ where: { id: aluno.id } });
    expect(updated?.discipuladorId).toBeNull();
  });

  it("Sem discipulador: no-op OK (302)", async () => {
    const m = await makeMembro({ nome: "Sem" });
    const res = await action(actionArgs(m.id, "unassign"));
    expect(res.status).toBe(302);
  });

  it("Membro inexistente → 404", async () => {
    let caught: unknown = null;
    try {
      await action(
        actionArgs("00000000-0000-0000-0000-000000000000", "unassign")
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) expect(caught.status).toBe(404);
  });
});

// ----------------- action: edge cases -----------------

describe("membros.$id.discipulado — action: edge cases (S03-T06)", () => {
  it("Sem user no context → 401", async () => {
    const m = await makeMembro({ nome: "X" });
    let caught: unknown = null;
    try {
      await action(actionArgs(m.id, "unassign", {}, null));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) expect(caught.status).toBe(401);
  });

  it("intent inválido → 400", async () => {
    const m = await makeMembro({ nome: "M" });
    let caught: unknown = null;
    try {
      await action(actionArgs(m.id, "unassign", {}, userWith("ADMIN")));
      // Substitui o intent por um inválido
      const formData = new FormData();
      formData.set("intent", "INVALIDO");
      const request = new Request(`http://localhost/app/membros/${m.id}/discipulado`, {
        method: "POST",
        body: formData,
      });
      await action({
        request,
        params: { id: m.id },
        context: { get: () => userWith("ADMIN") },
      } as unknown as Parameters<typeof action>[0]);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) expect(caught.status).toBe(400);
  });
});
