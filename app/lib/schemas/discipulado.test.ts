/**
 * Teste de app/lib/schemas/discipulado.ts e ministerios.ts (S03-T03).
 *
 * Cobre:
 *  - AssignDiscipleSchema: aceita discipuladorId UUID
 *  - MinisterioCreateSchema: nome 2-80, descricao opcional 0-500
 *  - MinisterioUpdateSchema: partial de Create
 *  - VincularMembroSchema: membroId UUID
 *  - Mensagens PT-BR
 *  - Input types exportados (z.infer)
 */
import { describe, it, expect } from "vitest";
import {
  AssignDiscipleSchema,
  type AssignDiscipleInput,
} from "./discipulado";
import {
  MinisterioCreateSchema,
  MinisterioUpdateSchema,
  VincularMembroSchema,
  type MinisterioCreateInput,
  type MinisterioUpdateInput,
  type VincularMembroInput,
} from "./ministerios";

describe("schemas/discipulado — AssignDiscipleSchema (S03-T03)", () => {
  it("aceita UUID válido", () => {
    const r = AssignDiscipleSchema.safeParse({
      discipuladorId: "11111111-1111-4111-8111-111111111111",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.discipuladorId).toBeTruthy();
  });

  it("rejeita string vazia", () => {
    const r = AssignDiscipleSchema.safeParse({ discipuladorId: "" });
    expect(r.success).toBe(false);
  });

  it("rejeita UUID malformado com mensagem PT-BR", () => {
    const r = AssignDiscipleSchema.safeParse({ discipuladorId: "nao-eh-uuid" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const err = r.error.issues.find((i) => i.path[0] === "discipuladorId");
      expect(err?.message).toBeTruthy();
      // mensagem PT-BR contém "UUID" ou "inválid"
      expect(err?.message).toMatch(/UUID|inválid/);
    }
  });

  it("rejeita campo extra (strict)", () => {
    const r = AssignDiscipleSchema.safeParse({
      discipuladorId: "11111111-1111-4111-8111-111111111111",
      extra: "hacker",
    });
    expect(r.success).toBe(false);
  });

  it("exporta tipo AssignDiscipleInput", () => {
    const v: AssignDiscipleInput = {
      discipuladorId: "11111111-1111-4111-8111-111111111111",
    };
    expect(v.discipuladorId).toBeTruthy();
  });
});

describe("schemas/ministerios — MinisterioCreateSchema (S03-T03)", () => {
  it("aceita payload mínimo (apenas nome)", () => {
    const r = MinisterioCreateSchema.safeParse({ nome: "Louvor" });
    expect(r.success).toBe(true);
    if (r.success) {
      const data: MinisterioCreateInput = r.data;
      expect(data.nome).toBe("Louvor");
      expect(data.descricao).toBeUndefined();
    }
  });

  it("aceita payload completo (nome + descricao)", () => {
    const r = MinisterioCreateSchema.safeParse({
      nome: "Mídia",
      descricao: "Operação de som, vídeo e projeção.",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.descricao).toBe("Operação de som, vídeo e projeção.");
  });

  it("rejeita nome com < 2 chars", () => {
    const r = MinisterioCreateSchema.safeParse({ nome: "A" });
    expect(r.success).toBe(false);
  });

  it("rejeita nome com > 80 chars", () => {
    const r = MinisterioCreateSchema.safeParse({ nome: "n".repeat(81) });
    expect(r.success).toBe(false);
  });

  it("rejeita descricao com > 500 chars", () => {
    const r = MinisterioCreateSchema.safeParse({
      nome: "Louvor",
      descricao: "d".repeat(501),
    });
    expect(r.success).toBe(false);
  });

  it("rejeita campo extra (strict)", () => {
    const r = MinisterioCreateSchema.safeParse({
      nome: "Louvor",
      liederId: "hacker",
    });
    expect(r.success).toBe(false);
  });

  it("exporta tipo MinisterioCreateInput", () => {
    const v: MinisterioCreateInput = { nome: "Diaconia" };
    expect(v.nome).toBe("Diaconia");
  });
});

describe("schemas/ministerios — MinisterioUpdateSchema (S03-T03)", () => {
  it("aceita atualização parcial (apenas nome)", () => {
    const r = MinisterioUpdateSchema.safeParse({ nome: "Louvor Atualizado" });
    expect(r.success).toBe(true);
  });

  it("aceita atualização vazia (no-op)", () => {
    const r = MinisterioUpdateSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("aceita atualização de descricao apenas", () => {
    const r = MinisterioUpdateSchema.safeParse({
      descricao: "Nova descrição",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita nome com tamanho inválido", () => {
    const r = MinisterioUpdateSchema.safeParse({ nome: "A" });
    expect(r.success).toBe(false);
  });

  it("exporta tipo MinisterioUpdateInput", () => {
    const v: MinisterioUpdateInput = { nome: "Louvor" };
    expect(v.nome).toBe("Louvor");
  });
});

describe("schemas/ministerios — VincularMembroSchema (S03-T03)", () => {
  it("aceita UUID válido", () => {
    const r = VincularMembroSchema.safeParse({
      membroId: "22222222-2222-4222-8222-222222222222",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita UUID inválido", () => {
    const r = VincularMembroSchema.safeParse({ membroId: "abc" });
    expect(r.success).toBe(false);
  });

  it("rejeita campo extra (strict)", () => {
    const r = VincularMembroSchema.safeParse({
      membroId: "22222222-2222-4222-8222-222222222222",
      outro: "x",
    });
    expect(r.success).toBe(false);
  });

  it("exporta tipo VincularMembroInput", () => {
    const v: VincularMembroInput = {
      membroId: "22222222-2222-4222-8222-222222222222",
    };
    expect(v.membroId).toBeTruthy();
  });
});
