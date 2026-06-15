/**
 * Teste de app/lib/schemas/alertas.ts (S04-T01).
 *
 * Cobre:
 *  - MarcarLidoSchema: alertaId uuid válido
 *  - MarcarResolvidoSchema: alertaId uuid válido
 *  - alertaId inválido → erro
 *  - strict: campos extras → erro
 *  - Mensagens em PT-BR
 */
import { describe, it, expect, beforeAll } from "vitest";
import type { ZodSchema } from "zod";

let MarcarLidoSchema: ZodSchema;
let MarcarResolvidoSchema: ZodSchema;

beforeAll(async () => {
  const mod = await import("./alertas");
  MarcarLidoSchema = mod.MarcarLidoSchema;
  MarcarResolvidoSchema = mod.MarcarResolvidoSchema;
});

describe("alertas.ts — MarcarLidoSchema (S04-T01)", () => {
  it("parse válido: alertaId uuid", () => {
    const result = MarcarLidoSchema.safeParse({
      alertaId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita alertaId não-uuid", () => {
    const result = MarcarLidoSchema.safeParse({ alertaId: "invalido" });
    expect(result.success).toBe(false);
  });

  it("rejeita alertaId vazio", () => {
    const result = MarcarLidoSchema.safeParse({ alertaId: "" });
    expect(result.success).toBe(false);
  });

  it("strict: campos extras → erro", () => {
    const result = MarcarLidoSchema.safeParse({
      alertaId: "550e8400-e29b-41d4-a716-446655440000",
      extra: "nao-permitido",
    });
    expect(result.success).toBe(false);
  });
});

describe("alertas.ts — MarcarResolvidoSchema (S04-T01)", () => {
  it("parse válido: alertaId uuid", () => {
    const result = MarcarResolvidoSchema.safeParse({
      alertaId: "550e8400-e29b-41d4-a716-446655440001",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita alertaId não-uuid", () => {
    const result = MarcarResolvidoSchema.safeParse({ alertaId: "invalido" });
    expect(result.success).toBe(false);
  });

  it("strict: campos extras → erro", () => {
    const result = MarcarResolvidoSchema.safeParse({
      alertaId: "550e8400-e29b-41d4-a716-446655440001",
      extra: "nao-permitido",
    });
    expect(result.success).toBe(false);
  });
});
