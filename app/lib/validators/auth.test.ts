/**
 * Teste de app/lib/validators/auth.ts (S00-T07).
 */
import { describe, it, expect } from "vitest";
import { LoginInputSchema, MembroCreateSchema } from "./auth";

describe("validators/auth — LoginInputSchema", () => {
  it("aceita email + senha válidos (≥ 8 chars)", () => {
    const r = LoginInputSchema.safeParse({ email: "user@igreja.local", senha: "12345678" });
    expect(r.success).toBe(true);
  });

  it("rejeita email inválido", () => {
    const r = LoginInputSchema.safeParse({ email: "invalid", senha: "12345678" });
    expect(r.success).toBe(false);
  });

  it("rejeita senha com < 8 chars", () => {
    const r = LoginInputSchema.safeParse({ email: "user@igreja.local", senha: "1234567" });
    expect(r.success).toBe(false);
  });

  it("rejeita campos faltando", () => {
    expect(LoginInputSchema.safeParse({ email: "x@x.com" }).success).toBe(false);
    expect(LoginInputSchema.safeParse({ senha: "12345678" }).success).toBe(false);
  });
});

describe("validators/auth — MembroCreateSchema", () => {
  it("aceita dados válidos", () => {
    const r = MembroCreateSchema.safeParse({
      nome: "Maria Silva",
      tipo: "VISITANTE",
      email: "maria@x.com",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita nome com < 2 chars", () => {
    const r = MembroCreateSchema.safeParse({ nome: "A", tipo: "VISITANTE" });
    expect(r.success).toBe(false);
  });

  it("rejeita tipo inválido", () => {
    const r = MembroCreateSchema.safeParse({ nome: "Maria", tipo: "INVALIDO" });
    expect(r.success).toBe(false);
  });

  it("tipo default é VISITANTE se omitido", () => {
    const r = MembroCreateSchema.safeParse({ nome: "Maria" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tipo).toBe("VISITANTE");
  });
});
