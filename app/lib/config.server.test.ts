/**
 * Teste de app/lib/config.server.ts (S04-T02).
 *
 * Cobre:
 *  - getConfigAcolhimento: sem config → null
 *  - getConfigAcolhimento: com config → dados
 *  - updateConfigAcolhimento: ADMIN cria config MEMBRO
 *  - updateConfigAcolhimento: ADMIN cria config MINISTERIO
 *  - updateConfigAcolhimento: exclusividade (troca tipo zera o outro)
 *  - updateConfigAcolhimento: não-ADMIN → 403
 *  - updateConfigAcolhimento: input inválido → ZodError
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prismaTest, setupTestDb } from "../../tests/helpers/db";
import type { SessionUser } from "./session.types";
import type { ZodError } from "zod";

let cleanup: () => Promise<void>;
let getConfigAcolhimento: typeof import("./config.server").getConfigAcolhimento;
let updateConfigAcolhimento: typeof import("./config.server").updateConfigAcolhimento;

beforeAll(async () => {
  cleanup = await setupTestDb("config.server");
  vi.resetModules();
  const mod = await import("./config.server");
  getConfigAcolhimento = mod.getConfigAcolhimento;
  updateConfigAcolhimento = mod.updateConfigAcolhimento;
});

afterAll(async () => { await cleanup(); });

beforeEach(async () => {
  await prismaTest.alertaDestinatario.deleteMany();
  await prismaTest.alerta.deleteMany();
  await prismaTest.configuracaoGeral.deleteMany();
  await prismaTest.ministerioMembro.deleteMany();
  await prismaTest.ministerio.deleteMany();
  await prismaTest.configuracaoGeral.deleteMany();
  await prismaTest.membro.updateMany({ data: { discipuladorId: null } });
  await prismaTest.membro.deleteMany();
});

// ----------------- helpers -----------------

function adminUser(): SessionUser {
  return { id: "u-admin", nome: "Admin", cargo: "ADMIN" };
}

function secretarioUser(): SessionUser {
  return { id: "u-secretario", nome: "Secretário", cargo: "SECRETARIO" };
}

async function makeMembro(nome: string, cargo?: string | null): Promise<{ id: string }> {
  const m = await prismaTest.membro.create({
    data: { nome, tipo: "MEMBRO_ATIVO", cargo: (cargo ?? null) as any },
  });
  return { id: m.id };
}

async function makeMinisterio(nome: string): Promise<{ id: string }> {
  const m = await prismaTest.ministerio.create({ data: { nome } });
  return { id: m.id };
}

// ----------------- getConfigAcolhimento -----------------

describe("config.server — getConfigAcolhimento", () => {
  it("sem config → null", async () => {
    const result = await getConfigAcolhimento();
    expect(result).toBeNull();
  });

  it("com config MEMBRO → retorna dados", async () => {
    const membro = await makeMembro("Responsável", "ADMIN");
    await prismaTest.configuracaoGeral.create({
      data: {
        id: "singleton",
        responsavelVisitanteTipo: "MEMBRO",
        responsavelMembroId: membro.id,
      },
    });
    const result = await getConfigAcolhimento();
    expect(result).not.toBeNull();
    expect(result!.responsavelVisitanteTipo).toBe("MEMBRO");
    expect(result!.responsavelMembroId).toBe(membro.id);
  });
});

// ----------------- updateConfigAcolhimento -----------------

describe("config.server — updateConfigAcolhimento", () => {
  it("ADMIN cria config MEMBRO", async () => {
    const membro = await makeMembro("Responsável Membro", "ADMIN");
    const result = await updateConfigAcolhimento(
      { responsavelVisitanteTipo: "MEMBRO", responsavelId: membro.id },
      adminUser()
    );
    expect(result.responsavelVisitanteTipo).toBe("MEMBRO");
    expect(result.responsavelMembroId).toBe(membro.id);
    expect(result.responsavelMinisterioId).toBeNull();
  });

  it("ADMIN cria config MINISTERIO", async () => {
    const ministerio = await makeMinisterio("Louvor");
    const result = await updateConfigAcolhimento(
      { responsavelVisitanteTipo: "MINISTERIO", responsavelId: ministerio.id },
      adminUser()
    );
    expect(result.responsavelVisitanteTipo).toBe("MINISTERIO");
    expect(result.responsavelMinisterioId).toBe(ministerio.id);
    expect(result.responsavelMembroId).toBeNull();
  });

  it("exclusividade: troca de MEMBRO para MINISTERIO zera responsavelMembroId", async () => {
    const membro = await makeMembro("Resp", "ADMIN");
    const ministerio = await makeMinisterio("Música");

    // Cria MEMBRO
    await updateConfigAcolhimento(
      { responsavelVisitanteTipo: "MEMBRO", responsavelId: membro.id },
      adminUser()
    );

    // Troca para MINISTERIO
    const result = await updateConfigAcolhimento(
      { responsavelVisitanteTipo: "MINISTERIO", responsavelId: ministerio.id },
      adminUser()
    );

    expect(result.responsavelVisitanteTipo).toBe("MINISTERIO");
    expect(result.responsavelMinisterioId).toBe(ministerio.id);
    expect(result.responsavelMembroId).toBeNull();
  });

  it("exclusividade: troca de MINISTERIO para MEMBRO zera responsavelMinisterioId", async () => {
    const membro = await makeMembro("Resp", "ADMIN");
    const ministerio = await makeMinisterio("Música");

    // Cria MINISTERIO
    await updateConfigAcolhimento(
      { responsavelVisitanteTipo: "MINISTERIO", responsavelId: ministerio.id },
      adminUser()
    );

    // Troca para MEMBRO
    const result = await updateConfigAcolhimento(
      { responsavelVisitanteTipo: "MEMBRO", responsavelId: membro.id },
      adminUser()
    );

    expect(result.responsavelVisitanteTipo).toBe("MEMBRO");
    expect(result.responsavelMembroId).toBe(membro.id);
    expect(result.responsavelMinisterioId).toBeNull();
  });

  it("SECRETARIO → 403 (assertIsAdmin)", async () => {
    const membro = await makeMembro("Resp", "ADMIN");
    await expect(
      updateConfigAcolhimento(
        { responsavelVisitanteTipo: "MEMBRO", responsavelId: membro.id },
        secretarioUser()
      )
    ).rejects.toThrow();
  });

  it("input inválido (tipo errado) → ZodError", async () => {
    await expect(
      updateConfigAcolhimento(
        { responsavelVisitanteTipo: "INVALIDO" as any, responsavelId: "uuid-qualquer" },
        adminUser()
      )
    ).rejects.toThrow();
  });
});
