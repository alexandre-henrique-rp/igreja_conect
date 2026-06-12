/**
 * Teste de prisma/seed.ts (S00-T13).
 *
 * Verifica idempotência: rodar 2x não duplica ADMIN.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { prismaTest, setupTestDb } from "../tests/helpers/db";
import { runSeed } from "./seed";

let cleanup: () => Promise<void>;
let consoleLogSpy: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  cleanup = await setupTestDb();
  consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterAll(async () => {
  await prismaTest.$disconnect();
  await cleanup();
  consoleLogSpy.mockRestore();
});

beforeEach(async () => {
  await prismaTest.membro.deleteMany();
  consoleLogSpy.mockClear();
});

describe("prisma/seed", () => {
  it("1ª execução cria ADMIN", async () => {
    await runSeed();
    const admin = await prismaTest.membro.findFirst({ where: { cargo: "ADMIN" } });
    expect(admin).not.toBeNull();
    expect(admin!.email).toBe("admin@igreja.local");
    expect(admin!.senhaHash).toMatch(/^\$2/);
    expect(admin!.tipo).toBe("MEMBRO_ATIVO");
  });

  it("2ª execução NÃO duplica (imprime 'já existe')", async () => {
    await runSeed();
    const first = await prismaTest.membro.findMany({ where: { cargo: "ADMIN" } });
    expect(first).toHaveLength(1);

    await runSeed();
    const second = await prismaTest.membro.findMany({ where: { cargo: "ADMIN" } });
    expect(second).toHaveLength(1);

    const logs = consoleLogSpy.mock.calls.map((c: unknown[]) => c[0] as string).join("\n");
    expect(logs).toContain("ADMIN já existe");
  });
});
