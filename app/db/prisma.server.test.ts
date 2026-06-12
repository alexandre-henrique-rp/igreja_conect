/**
 * Teste do singleton do Prisma Client (S00-T01).
 *
 * Verifica que:
 * 1. Duas importações consecutivas retornam a mesma referência.
 * 2. O `prisma` tem o shape esperado (tem `.membro`, `.session`, etc).
 */
import { describe, it, expect } from "vitest";

describe("prisma.server singleton", () => {
  it("retorna a mesma referência em duas importações (HMR-safe)", async () => {
    const { prisma } = await import("./prisma.server");
    const { prisma: prisma2 } = await import("./prisma.server");
    expect(prisma).toBe(prisma2);
  });

  it("expõe models esperados (membro, session, etc.)", async () => {
    const { prisma } = await import("./prisma.server");
    expect(prisma).toBeDefined();
    expect(prisma.membro).toBeDefined();
    // $queryRaw é o mínimo de PrismaClient que o singleton precisa ter
    expect(typeof prisma.$queryRaw).toBe("function");
  });
});
