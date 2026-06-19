/**
 * Testes de app/lib/schemas/transferencias.ts (S07-T01).
 *
 * Cobre:
 * - T01: TransferenciaCreateSchema — input valido, rejeita origens iguais,
 *   valores <= 0, descricao > 200 chars, campos extras (strict).
 */
import { describe, it, expect } from "vitest";
import { TransferenciaCreateSchema } from "./transferencias";

const UUID_ORIGEM = "550e8400-e29b-41d4-a716-446655440001";
const UUID_DESTINO = "550e8400-e29b-41d4-a716-446655440002";
const UUID_AMBOS = "550e8400-e29b-41d4-a716-446655440003";

describe("transferencias — TransferenciaCreateSchema (T01)", () => {
  it("aceita input valido com campos obrigatorios", () => {
    const input = {
      origemId: UUID_ORIGEM,
      destinoId: UUID_DESTINO,
      valorCentavos: 1000,
    };
    const result = TransferenciaCreateSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("aceita input valido com todos os campos opcionais", () => {
    const input = {
      origemId: UUID_ORIGEM,
      destinoId: UUID_DESTINO,
      valorCentavos: 500,
      descricao: "Transferencia entre caixas",
      data: "2026-06-19T10:00:00.000Z",
    };
    const result = TransferenciaCreateSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("rejeita origem === destino (superRefine)", () => {
    const input = {
      origemId: UUID_AMBOS,
      destinoId: UUID_AMBOS,
      valorCentavos: 1000,
    };
    const result = TransferenciaCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
    const issue = result.error?.issues.find(
      (i) => i.path.includes("origemId") || i.path.includes("destinoId")
    );
    expect(issue).toBeDefined();
  });

  it("rejeita valorCentavos <= 0", () => {
    const input = {
      origemId: UUID_ORIGEM,
      destinoId: UUID_DESTINO,
      valorCentavos: 0,
    };
    const result = TransferenciaCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((i) => i.path.includes("valorCentavos"));
    expect(issue).toBeDefined();
  });

  it("rejeita valorCentavos negativo", () => {
    const input = {
      origemId: UUID_ORIGEM,
      destinoId: UUID_DESTINO,
      valorCentavos: -100,
    };
    const result = TransferenciaCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejeita descricao > 200 chars", () => {
    const input = {
      origemId: UUID_ORIGEM,
      destinoId: UUID_DESTINO,
      valorCentavos: 1000,
      descricao: "A".repeat(201),
    };
    const result = TransferenciaCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((i) => i.path.includes("descricao"));
    expect(issue).toBeDefined();
  });

  it("rejeita campos extras (strict)", () => {
    const input = {
      origemId: UUID_ORIGEM,
      destinoId: UUID_DESTINO,
      valorCentavos: 1000,
      campoExtra: "nao deveria existir",
    };
    const result = TransferenciaCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejeita origemId que nao e UUID", () => {
    const input = {
      origemId: "nao-e-uuid",
      destinoId: UUID_DESTINO,
      valorCentavos: 1000,
    };
    const result = TransferenciaCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejeita destinoId que nao e UUID", () => {
    const input = {
      origemId: UUID_ORIGEM,
      destinoId: "nao-e-uuid",
      valorCentavos: 1000,
    };
    const result = TransferenciaCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("descricao com 200 chars e aceita", () => {
    const input = {
      origemId: UUID_ORIGEM,
      destinoId: UUID_DESTINO,
      valorCentavos: 1000,
      descricao: "A".repeat(200),
    };
    const result = TransferenciaCreateSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("data default e agora", () => {
    const input = {
      origemId: UUID_ORIGEM,
      destinoId: UUID_DESTINO,
      valorCentavos: 1000,
    };
    const result = TransferenciaCreateSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data).toBeInstanceOf(Date);
    }
  });
});
