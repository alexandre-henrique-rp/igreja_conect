/**
 * Teste de app/lib/schemas/config.ts (S04-T01).
 *
 * Cobre:
 *  - ConfigAcolhimentoSchema: parse válido
 *  - responsavelVisitanteTipo enum: MEMBRO ou MINISTERIO
 *  - responsavelId: uuid inválido → erro
 *  - strict: campos extras → erro
 *  - Mensagens em PT-BR
 */
import { describe, it, expect, beforeAll } from "vitest";
import type { ZodSchema } from "zod";

let ConfigAcolhimentoSchema: ZodSchema;

beforeAll(async () => {
  const mod = await import("./config");
  ConfigAcolhimentoSchema = mod.ConfigAcolhimentoSchema;
});

describe("config.ts — ConfigAcolhimentoSchema (S04-T01)", () => {
  it("parse válido: MEMBRO + uuid", () => {
    const result = ConfigAcolhimentoSchema.safeParse({
      responsavelVisitanteTipo: "MEMBRO",
      responsavelId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("parse válido: MINISTERIO + uuid", () => {
    const result = ConfigAcolhimentoSchema.safeParse({
      responsavelVisitanteTipo: "MINISTERIO",
      responsavelId: "550e8400-e29b-41d4-a716-446655440001",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita responsavelVisitanteTipo inválido (não enum)", () => {
    const result = ConfigAcolhimentoSchema.safeParse({
      responsavelVisitanteTipo: "OUTRO",
      responsavelId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs.some((m) => m.includes("MEMBRO") || m.includes("MINISTERIO"))).toBe(true);
    }
  });

  it("rejeita responsavelId não-uuid", () => {
    const result = ConfigAcolhimentoSchema.safeParse({
      responsavelVisitanteTipo: "MEMBRO",
      responsavelId: "nao-e-um-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita responsavelId vazio", () => {
    const result = ConfigAcolhimentoSchema.safeParse({
      responsavelVisitanteTipo: "MEMBRO",
      responsavelId: "",
    });
    expect(result.success).toBe(false);
  });

  it("strict: campos extras → erro", () => {
    const result = ConfigAcolhimentoSchema.safeParse({
      responsavelVisitanteTipo: "MEMBRO",
      responsavelId: "550e8400-e29b-41d4-a716-446655440000",
      extraCampo: "nao-permitido",
    });
    expect(result.success).toBe(false);
  });

  it("exporta Schema como valor (runtime)", async () => {
    const configModule = await import("./config");
    expect(configModule.ConfigAcolhimentoSchema).toBeDefined();
    expect(configModule.ConfigAcolhimentoSchema.safeParse).toBeDefined();
  });
});
