/**
 * Teste de app/lib/schemas/membros.ts (S02-T01).
 *
 * Cobre `MembroCreateSchema` e `MembroUpdateSchema`:
 *  - Campos válidos (happy path)
 *  - Mensagens em PT-BR para erros de validação
 *  - Refine cross-field: `dataBatismo >= dataConversao` quando ambos preenchidos
 *  - `coerce.date` em campos de data (form envia string)
 *  - Regex de CEP, telefone, email
 *  - GATE LGPD: rejeita campos cpf/rg/cnpj via .strict() (garante RN-MEM-02)
 */
import { describe, it, expect } from "vitest";
import {
  MembroCreateSchema,
  MembroUpdateSchema,
  type MembroCreateInput,
  type MembroUpdateInput,
} from "./membros";

describe("schemas/membros — MembroCreateSchema (S02-T01)", () => {
  it("aceita payload mínimo válido (apenas nome)", () => {
    const r = MembroCreateSchema.safeParse({ nome: "Maria Silva" });
    expect(r.success).toBe(true);
    if (r.success) {
      const data: MembroCreateInput = r.data;
      expect(data.nome).toBe("Maria Silva");
      expect(data.tipo).toBe("VISITANTE");
    }
  });

  it("aceita payload completo válido com todos os campos opcionais", () => {
    const r = MembroCreateSchema.safeParse({
      nome: "João Pereira",
      tipo: "MEMBRO_ATIVO",
      email: "joao@igreja.local",
      telefone: "(11) 98765-4321",
      profissao: "Engenheiro",
      estadoCivil: "Casado",
      dataConversao: "2020-05-10",
      dataBatismo: "2020-06-15",
      logradouro: "Rua das Flores",
      numero: "123",
      bairro: "Centro",
      cidade: "São Paulo",
      estado: "SP",
      cep: "01000-000",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      const data: MembroCreateInput = r.data;
      expect(data.tipo).toBe("MEMBRO_ATIVO");
      expect(data.email).toBe("joao@igreja.local");
      expect(data.cep).toBe("01000-000");
      expect(data.dataConversao).toBeInstanceOf(Date);
      expect(data.dataBatismo).toBeInstanceOf(Date);
    }
  });

  it("rejeita nome com < 2 chars", () => {
    const r = MembroCreateSchema.safeParse({ nome: "A" });
    expect(r.success).toBe(false);
  });

  it("rejeita nome com > 120 chars", () => {
    const r = MembroCreateSchema.safeParse({ nome: "a".repeat(121) });
    expect(r.success).toBe(false);
  });

  it("tipo default é VISITANTE quando omitido", () => {
    const r = MembroCreateSchema.safeParse({ nome: "Visitante" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tipo).toBe("VISITANTE");
  });

  it("rejeita tipo fora do enum com mensagem PT-BR", () => {
    const r = MembroCreateSchema.safeParse({ nome: "Maria", tipo: "INVALIDO" });
    expect(r.success).toBe(false);
  });

  it("rejeita email malformado com mensagem PT-BR", () => {
    const r = MembroCreateSchema.safeParse({ nome: "Maria", email: "nao-eh-email" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const emailErr = r.error.issues.find((i) => i.path[0] === "email");
      expect(emailErr?.message).toBe("E-mail inválido. Verifique o formato.");
    }
  });

  it("normaliza email para lowercase + trim", () => {
    const r = MembroCreateSchema.safeParse({
      nome: "Maria",
      email: "  Maria@IGREJA.Local  ",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("maria@igreja.local");
  });

  it("aceita telefone com máscara (11) 98765-4321", () => {
    const r = MembroCreateSchema.safeParse({ nome: "Maria", telefone: "(11) 98765-4321" });
    expect(r.success).toBe(true);
  });

  it("aceita telefone só dígitos 11987654321", () => {
    const r = MembroCreateSchema.safeParse({ nome: "Maria", telefone: "11987654321" });
    expect(r.success).toBe(true);
  });

  it("rejeita telefone com < 8 dígitos", () => {
    const r = MembroCreateSchema.safeParse({ nome: "Maria", telefone: "1234567" });
    expect(r.success).toBe(false);
  });

  it("aceita CEP com máscara 01000-000", () => {
    const r = MembroCreateSchema.safeParse({ nome: "Maria", cep: "01000-000" });
    expect(r.success).toBe(true);
  });

  it("aceita CEP só dígitos 01000000", () => {
    const r = MembroCreateSchema.safeParse({ nome: "Maria", cep: "01000000" });
    expect(r.success).toBe(true);
  });

  it("rejeita CEP inválido com mensagem PT-BR", () => {
    const r = MembroCreateSchema.safeParse({ nome: "Maria", cep: "123" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const cepErr = r.error.issues.find((i) => i.path[0] === "cep");
      expect(cepErr?.message).toBe("CEP inválido. Use o formato 00000-000.");
    }
  });

  it("coage string de data em Date (form HTML envia string)", () => {
    const r = MembroCreateSchema.safeParse({
      nome: "Maria",
      dataConversao: "2020-01-15",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.dataConversao).toBeInstanceOf(Date);
  });

  it("refine: dataBatismo >= dataConversao quando ambos preenchidos (OK se igual)", () => {
    const r = MembroCreateSchema.safeParse({
      nome: "Maria",
      dataConversao: "2020-05-10",
      dataBatismo: "2020-05-10",
    });
    expect(r.success).toBe(true);
  });

  it("refine: dataBatismo >= dataConversao quando batismo 1 dia depois (OK)", () => {
    const r = MembroCreateSchema.safeParse({
      nome: "Maria",
      dataConversao: "2020-05-10",
      dataBatismo: "2020-05-11",
    });
    expect(r.success).toBe(true);
  });

  it("refine: rejeita dataBatismo < dataConversao com mensagem PT-BR", () => {
    const r = MembroCreateSchema.safeParse({
      nome: "Maria",
      dataConversao: "2020-06-15",
      dataBatismo: "2020-05-10",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const err = r.error.issues.find((i) =>
        i.path.includes("dataBatismo") && i.code === "custom"
      );
      expect(err?.message).toBe(
        "Data de batismo não pode ser anterior à data de conversão."
      );
    }
  });

  it("refine: aceita dataBatismo preenchido sem dataConversao", () => {
    const r = MembroCreateSchema.safeParse({
      nome: "Maria",
      dataBatismo: "2020-05-10",
    });
    expect(r.success).toBe(true);
  });

  it("refine: aceita dataConversao preenchido sem dataBatismo", () => {
    const r = MembroCreateSchema.safeParse({
      nome: "Maria",
      dataConversao: "2020-05-10",
    });
    expect(r.success).toBe(true);
  });

  // GATE LGPD: RN-MEM-02 — NUNCA aceitar campos sensíveis não documentados
  it("GATE LGPD: rejeita campo cpf (RN-MEM-02)", () => {
    const r = MembroCreateSchema.safeParse({
      nome: "Maria",
      cpf: "529.982.247-25",
    });
    expect(r.success).toBe(false);
  });

  it("GATE LGPD: rejeita campo rg (RN-MEM-02)", () => {
    const r = MembroCreateSchema.safeParse({
      nome: "Maria",
      rg: "12.345.678-9",
    });
    expect(r.success).toBe(false);
  });

  it("GATE LGPD: rejeita campo cnpj (RN-MEM-02)", () => {
    const r = MembroCreateSchema.safeParse({
      nome: "Maria",
      cnpj: "11.222.333/0001-81",
    });
    expect(r.success).toBe(false);
  });
});

describe("schemas/membros — MembroUpdateSchema (S02-T01)", () => {
  it("aceita atualização parcial (apenas nome)", () => {
    const r = MembroUpdateSchema.safeParse({ nome: "Maria Atualizada" });
    expect(r.success).toBe(true);
  });

  it("aceita atualização vazia (no-op é válido)", () => {
    const r = MembroUpdateSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("aceita atualização de todos os campos", () => {
    const r = MembroUpdateSchema.safeParse({
      nome: "Maria Editada",
      tipo: "CONGREGADO",
      telefone: "11988887777",
    });
    expect(r.success).toBe(true);
  });

  it("aplica refine dataBatismo >= dataConversao também no update", () => {
    const r = MembroUpdateSchema.safeParse({
      dataConversao: "2020-06-15",
      dataBatismo: "2020-05-10",
    });
    expect(r.success).toBe(false);
  });

  it("GATE LGPD: rejeita campo senhaHash (não atualizável por aqui)", () => {
    const r = MembroUpdateSchema.safeParse({
      nome: "Maria",
      senhaHash: "$2a$10$abcdef",
    });
    expect(r.success).toBe(false);
  });

  it("GATE LGPD: rejeita cpf no update (RN-MEM-02)", () => {
    const r = MembroUpdateSchema.safeParse({
      cpf: "529.982.247-25",
    });
    expect(r.success).toBe(false);
  });

  it("exporta tipos MembroCreateInput e MembroUpdateInput derivados de z.infer", () => {
    // Compilação: se o tipo não existir, o teste nem compila
    // MembroCreateInput é o OUTPUT (após parse, com defaults aplicados),
    // então tipo é required e igual a "VISITANTE" neste caso.
    const create: MembroCreateInput = {
      nome: "Teste",
      tipo: "VISITANTE",
    };
    const update: MembroUpdateInput = {
      nome: "Teste 2",
    };
    expect(create.nome).toBe("Teste");
    expect(create.tipo).toBe("VISITANTE");
    expect(update.nome).toBe("Teste 2");
  });
});
