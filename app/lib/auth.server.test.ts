/**
 * Teste de app/lib/auth.server.ts (S00-T03).
 *
 * Verifica que hashPassword retorna hash bcrypt válido e verifyPassword
 * confirma/rejeita senhas. Usa cost 10 conforme ADR-002.
 */
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./auth.server";

describe("auth.server — hashPassword / verifyPassword", () => {
  it("hashPassword retorna string bcrypt de ~60 chars (cost 10)", async () => {
    const hash = await hashPassword("minha-senha-123");
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThanOrEqual(59);
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("hashPassword gera hashes diferentes para a mesma senha (salt aleatório)", async () => {
    const a = await hashPassword("senha-igual");
    const b = await hashPassword("senha-igual");
    expect(a).not.toBe(b);
  });

  it("verifyPassword retorna true para senha correta", async () => {
    const hash = await hashPassword("correta-123");
    expect(await verifyPassword("correta-123", hash)).toBe(true);
  });

  it("verifyPassword retorna false para senha incorreta", async () => {
    const hash = await hashPassword("correta-123");
    expect(await verifyPassword("errada-456", hash)).toBe(false);
  });

  it("verifyPassword retorna false para hash inválido (não lança)", async () => {
    expect(await verifyPassword("qualquer", "hash-invalido")).toBe(false);
  });
});
