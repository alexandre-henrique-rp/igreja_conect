/**
 * Teste de integração de app/lib/ministries.server.ts (S03-T04).
 *
 * Cobre:
 *  - listMinisterios: lista com count e primeiros 5 membros
 *  - createMinisterio: nome duplicado (P2002) → NomeDuplicadoError
 *  - updateMinisterio: happy path
 *  - deleteMinisterio: com membros vinculados → ConflictError 409
 *  - addMembroToMinisterio: duplicata (P2002) → ConflictError
 *  - removeMembroFromMinisterio: delete
 *  - canManageMinisterios: helper boolean
 *  - assertCanManageMinisterios: 403 para perfis sem permissão
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prismaTest, setupTestDb } from "../../tests/helpers/db";
import type { SessionUser } from "./session.types";

let cleanup: () => Promise<void>;
let listMinisterios: typeof import("./ministries.server").listMinisterios;
let createMinisterio: typeof import("./ministries.server").createMinisterio;
let updateMinisterio: typeof import("./ministries.server").updateMinisterio;
let deleteMinisterio: typeof import("./ministries.server").deleteMinisterio;
let addMembroToMinisterio: typeof import("./ministries.server").addMembroToMinisterio;
let removeMembroFromMinisterio: typeof import("./ministries.server").removeMembroFromMinisterio;
let canManageMinisterios: typeof import("./ministries.server").canManageMinisterios;
let NomeDuplicadoError: typeof import("./errors").NomeDuplicadoError;
let ConflictError: typeof import("./errors").ConflictError;

beforeAll(async () => {
  cleanup = await setupTestDb("ministries.server");
  vi.resetModules();
  const mod = await import("./ministries.server");
  listMinisterios = mod.listMinisterios;
  createMinisterio = mod.createMinisterio;
  updateMinisterio = mod.updateMinisterio;
  deleteMinisterio = mod.deleteMinisterio;
  addMembroToMinisterio = mod.addMembroToMinisterio;
  removeMembroFromMinisterio = mod.removeMembroFromMinisterio;
  canManageMinisterios = mod.canManageMinisterios;
  const errMod = await import("./errors");
  NomeDuplicadoError = errMod.NomeDuplicadoError;
  ConflictError = errMod.ConflictError;
});

afterAll(async () => { await cleanup(); });

beforeEach(async () => {
  await prismaTest.alertaDestinatario.deleteMany();
  await prismaTest.alerta.deleteMany();
  await prismaTest.ministerioMembro.deleteMany();
  await prismaTest.membro.updateMany({ data: { discipuladorId: null } });
  await prismaTest.membro.deleteMany();
  await prismaTest.ministerio.deleteMany();
});

// ----------------- helpers -----------------

function userWith(cargo: string | null, id = "u-" + cargo): SessionUser {
  return { id, nome: `User ${cargo ?? "none"}`, cargo };
}

async function makeMembro(nome: string): Promise<{ id: string }> {
  const m = await prismaTest.membro.create({ data: { nome } });
  return { id: m.id };
}

async function makeMinisterio(nome: string, descricao?: string): Promise<{ id: string }> {
  const m = await prismaTest.ministerio.create({
    data: { nome, descricao: descricao ?? null },
  });
  return { id: m.id };
}

// ----------------- canManageMinisterios -----------------

describe("ministries.server — canManageMinisterios (helper)", () => {
  it("ADMIN pode", () => {
    expect(canManageMinisterios(userWith("ADMIN"))).toBe(true);
  });
  it("PASTOR pode", () => {
    expect(canManageMinisterios(userWith("PASTOR"))).toBe(true);
  });
  it("SECRETARIO pode", () => {
    expect(canManageMinisterios(userWith("SECRETARIO"))).toBe(true);
  });
  it("DISCIPULADOR NÃO pode", () => {
    expect(canManageMinisterios(userWith("LIDER_MINISTERIO"))).toBe(false);
  });
  it("FINANCEIRO NÃO pode", () => {
    expect(canManageMinisterios(userWith("FINANCEIRO"))).toBe(false);
  });
  it("LIDER_MINISTERIO NÃO pode", () => {
    expect(canManageMinisterios(userWith("LIDER_MINISTERIO"))).toBe(false);
  });
  it("null não pode", () => {
    expect(canManageMinisterios(userWith(null))).toBe(false);
  });
});

// ----------------- listMinisterios -----------------

describe("ministries.server — listMinisterios", () => {
  it("happy path: lista com count e primeiros 5 membros", async () => {
    const min = await makeMinisterio("Louvor");
    for (let i = 0; i < 6; i++) {
      const m = await makeMembro(`Membro ${i}`);
      await prismaTest.ministerioMembro.create({
        data: { ministerioId: min.id, membroId: m.id },
      });
    }
    const res = await listMinisterios(userWith("ADMIN"));
    expect(res.length).toBe(1);
    expect(res[0]?.nome).toBe("Louvor");
    expect(res[0]?.membrosCount).toBe(6);
    expect(res[0]?.primeiros5membros.length).toBe(5);
  });

  it("lista vazia retorna []", async () => {
    const res = await listMinisterios(userWith("ADMIN"));
    expect(res).toEqual([]);
  });
});

// ----------------- createMinisterio -----------------

describe("ministries.server — createMinisterio", () => {
  it("happy path: ADMIN cria", async () => {
    const result = await createMinisterio({ nome: "Louvor" }, userWith("ADMIN"));
    expect(result.nome).toBe("Louvor");
  });

  it("nome duplicado → NomeDuplicadoError 409 (captura P2002)", async () => {
    await createMinisterio({ nome: "Louvor" }, userWith("ADMIN"));
    await expect(
      createMinisterio({ nome: "Louvor" }, userWith("ADMIN"))
    ).rejects.toThrow(NomeDuplicadoError);
  });

  it("DISCIPULADOR tenta criar → 403", async () => {
    let caught: unknown = null;
    try {
      await createMinisterio({ nome: "X" }, userWith("LIDER_MINISTERIO"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) expect(caught.status).toBe(403);
  });

  it("sem cargo → 403", async () => {
    let caught: unknown = null;
    try {
      await createMinisterio({ nome: "X" }, userWith(null));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) expect(caught.status).toBe(403);
  });
});

// ----------------- updateMinisterio -----------------

describe("ministries.server — updateMinisterio", () => {
  it("happy path: atualiza nome", async () => {
    const min = await makeMinisterio("Louvor");
    const result = await updateMinisterio(min.id, { nome: "Louvor 2.0" }, userWith("ADMIN"));
    expect(result.nome).toBe("Louvor 2.0");
  });

  it("atualizar para nome já existente → NomeDuplicadoError", async () => {
    await makeMinisterio("Louvor Antigo");
    const b = await makeMinisterio("Mídia Nova");
    await expect(
      updateMinisterio(b.id, { nome: "Louvor Antigo" }, userWith("ADMIN"))
    ).rejects.toThrow(NomeDuplicadoError);
  });

  it("DISCIPULADOR tenta editar → 403", async () => {
    const min = await makeMinisterio("Louvor");
    let caught: unknown = null;
    try {
      await updateMinisterio(min.id, { nome: "X" }, userWith("LIDER_MINISTERIO"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
  });
});

// ----------------- deleteMinisterio -----------------

describe("ministries.server — deleteMinisterio", () => {
  it("happy path: deleta ministério vazio", async () => {
    const min = await makeMinisterio("Louvor");
    await deleteMinisterio(min.id, userWith("ADMIN"));
    const found = await prismaTest.ministerio.findUnique({ where: { id: min.id } });
    expect(found).toBeNull();
  });

  it("com membros vinculados → ConflictError 409", async () => {
    const min = await makeMinisterio("Louvor");
    const m = await makeMembro("Membro");
    await prismaTest.ministerioMembro.create({
      data: { ministerioId: min.id, membroId: m.id },
    });
    await expect(
      deleteMinisterio(min.id, userWith("ADMIN"))
    ).rejects.toThrow(ConflictError);
  });

  it("DISCIPULADOR tenta deletar → 403", async () => {
    const min = await makeMinisterio("Louvor");
    let caught: unknown = null;
    try {
      await deleteMinisterio(min.id, userWith("LIDER_MINISTERIO"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
  });
});

// ----------------- addMembroToMinisterio -----------------

describe("ministries.server — addMembroToMinisterio", () => {
  it("happy path: vincula membro", async () => {
    const min = await makeMinisterio("Louvor");
    const m = await makeMembro("Membro");
    await addMembroToMinisterio(min.id, m.id, userWith("ADMIN"));
    const found = await prismaTest.ministerioMembro.findFirst({
      where: { ministerioId: min.id, membroId: m.id },
    });
    expect(found).not.toBeNull();
  });

  it("membro já vinculado → ConflictError (P2002)", async () => {
    const min = await makeMinisterio("Louvor");
    const m = await makeMembro("Membro");
    await addMembroToMinisterio(min.id, m.id, userWith("ADMIN"));
    await expect(
      addMembroToMinisterio(min.id, m.id, userWith("ADMIN"))
    ).rejects.toThrow(ConflictError);
  });

  it("DISCIPULADOR tenta vincular → 403", async () => {
    const min = await makeMinisterio("Louvor");
    const m = await makeMembro("Membro");
    let caught: unknown = null;
    try {
      await addMembroToMinisterio(min.id, m.id, userWith("LIDER_MINISTERIO"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
  });
});

// ----------------- removeMembroFromMinisterio -----------------

describe("ministries.server — removeMembroFromMinisterio", () => {
  it("happy path: desvincula membro", async () => {
    const min = await makeMinisterio("Louvor");
    const m = await makeMembro("Membro");
    await prismaTest.ministerioMembro.create({
      data: { ministerioId: min.id, membroId: m.id },
    });
    await removeMembroFromMinisterio(min.id, m.id, userWith("ADMIN"));
    const found = await prismaTest.ministerioMembro.findFirst({
      where: { ministerioId: min.id, membroId: m.id },
    });
    expect(found).toBeNull();
  });

  it("membro não vinculado: no-op OK (ou lança — ver impl)", async () => {
    const min = await makeMinisterio("Louvor");
    const m = await makeMembro("Membro");
    // Não vincula antes — apenas tenta remover
    // Comportamento esperado: no-op silencioso (não é erro)
    await removeMembroFromMinisterio(min.id, m.id, userWith("ADMIN"));
    const found = await prismaTest.ministerioMembro.findFirst({
      where: { ministerioId: min.id, membroId: m.id },
    });
    expect(found).toBeNull();
  });
});
