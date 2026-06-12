/**
 * Teste de app/lib/validators/common.ts (S00-T08).
 */
import { describe, it, expect } from "vitest";
import {
  emailSchema,
  telefoneSchema,
  uuidSchema,
  senhaSchema,
  nonEmptyString,
  compact,
} from "./common";

describe("validators/common — emailSchema", () => {
  it("aceita email válido e normaliza (lowercase + trim)", () => {
    const r = emailSchema.safeParse("  User@IGREJA.Local  ");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("user@igreja.local");
  });
  it("rejeita email inválido", () => {
    expect(emailSchema.safeParse("invalid").success).toBe(false);
  });
  it("rejeita email > 120 chars", () => {
    const long = "a".repeat(120) + "@x.com";
    expect(emailSchema.safeParse(long).success).toBe(false);
  });
});

describe("validators/common — telefoneSchema", () => {
  it("aceita telefone com máscara", () => {
    expect(telefoneSchema.safeParse("(11) 98765-4321").success).toBe(true);
  });
  it("aceita telefone só dígitos", () => {
    expect(telefoneSchema.safeParse("11987654321").success).toBe(true);
  });
  it("rejeita < 8 dígitos", () => {
    expect(telefoneSchema.safeParse("1234567").success).toBe(false);
  });
  it("rejeita > 20 dígitos", () => {
    expect(telefoneSchema.safeParse("1".repeat(21)).success).toBe(false);
  });
});

describe("validators/common — uuidSchema", () => {
  it("aceita UUID válido", () => {
    const u = "550e8400-e29b-41d4-a716-446655440000";
    expect(uuidSchema.safeParse(u).success).toBe(true);
  });
  it("rejeita string não-UUID", () => {
    expect(uuidSchema.safeParse("abc-123").success).toBe(false);
  });
});

describe("validators/common — senhaSchema", () => {
  it("aceita senha com ≥ 8 chars", () => {
    expect(senhaSchema.safeParse("12345678").success).toBe(true);
  });
  it("rejeita < 8 chars", () => {
    expect(senhaSchema.safeParse("1234567").success).toBe(false);
  });
  it("rejeita > 128 chars", () => {
    expect(senhaSchema.safeParse("a".repeat(129)).success).toBe(false);
  });
});

describe("validators/common — nonEmptyString", () => {
  it("rejeita string vazia", () => {
    expect(nonEmptyString.safeParse("").success).toBe(false);
  });
  it("rejeita string só com espaços", () => {
    expect(nonEmptyString.safeParse("   ").success).toBe(false);
  });
  it("aceita string com conteúdo", () => {
    const r = nonEmptyString.safeParse("  Maria  ");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("Maria");
  });
});

describe("validators/common — compact", () => {
  it("remove undefined, null, e string vazia", () => {
    expect(compact({ a: 1, b: undefined, c: null, d: "", e: "x" })).toEqual({ a: 1, e: "x" });
  });
  it("preserva 0 e false (falsy válidos)", () => {
    expect(compact({ a: 0, b: false })).toEqual({ a: 0, b: false });
  });
});
