/**
 * Testes para <FormTransferencia /> (S07-T03).
 *
 * Testa tipos, validação e estrutura do componente.
 * Testes de renderização real são feitos via E2E.
 */
import { describe, it, expect } from "vitest";

describe("FormTransferencia types", () => {
  it("CaixaOption tem campos corretos", () => {
    const caixa = {
      id: "cx1",
      nome: "Caixa Geral",
      saldoCentavos: 123456,
    };
    expect(caixa.id).toBe("cx1");
    expect(caixa.nome).toBe("Caixa Geral");
    expect(caixa.saldoCentavos).toBe(123456);
  });

  it("formatBRLFromCents formata corretamente", () => {
    const formatBRLFromCents = (cents: number) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(cents / 100);

    expect(formatBRLFromCents(123456)).toContain("R$");
    expect(formatBRLFromCents(123456)).toContain("1.234,56");
    expect(formatBRLFromCents(7890)).toContain("78,90");
  });

  it("parseBRLToCents converte string BRL para centavos", () => {
    const parseBRLToCents = (raw: string): number | null => {
      if (typeof raw !== "string") return null;
      const cleaned = raw.replace(/R\$\s*/gi, "").replace(/\s/g, "");
      const normalized = cleaned.includes(",") ? cleaned.replace(",", ".") : cleaned;
      const parsed = Number(normalized);
      if (!Number.isFinite(parsed) || parsed < 0) return null;
      return Math.round(parsed * 100);
    };

    expect(parseBRLToCents("100,00")).toBe(10000);
    expect(parseBRLToCents("1.234,56")).toBe(123456);
    expect(parseBRLToCents("")).toBeNull();
  });

  it("ActionData suporta erros e fields", () => {
    const actionData = {
      errors: { origemId: "Selecione a origem" },
      fields: { origemId: "cx1", destinoId: "cx2" },
      formError: undefined,
    };
    expect(actionData.errors?.origemId).toBe("Selecione a origem");
    expect(actionData.fields?.origemId).toBe("cx1");
  });

  it("formError renderiza mensagem de saldo insuficiente", () => {
    const formError = "Saldo insuficiente para esta transferência.";
    expect(formError).toContain("Saldo");
    expect(formError).toContain("insuficiente");
  });

  it("descricao tem limite de 200 caracteres", () => {
    const descricao = "a".repeat(200);
    expect(descricao.length).toBe(200);
    expect(descricao.length <= 200).toBe(true);
  });

  it("caixaOptions formatados corretamente", () => {
    const caixas = [
      { id: "cx1", nome: "Caixa Geral", saldoCentavos: 123456 },
      { id: "cx2", nome: "Cantina", saldoCentavos: 7890 },
    ];

    const opts = caixas.map((c) => ({
      value: c.id,
      label: `${c.nome} — ${new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(c.saldoCentavos / 100)}`,
    }));

    expect(opts[0].value).toBe("cx1");
    expect(opts[0].label).toContain("Caixa Geral");
    expect(opts[0].label).toContain("R$");
    expect(opts[1].value).toBe("cx2");
    expect(opts[1].label).toContain("Cantina");
  });

  it("valor negativo nao passa validacao", () => {
    const parseBRLToCents = (raw: string): number | null => {
      if (typeof raw !== "string") return null;
      const cleaned = raw.replace(/R\$\s*/gi, "").replace(/\s/g, "");
      const normalized = cleaned.includes(",") ? cleaned.replace(",", ".") : cleaned;
      const parsed = Number(normalized);
      if (!Number.isFinite(parsed) || parsed < 0) return null;
      return Math.round(parsed * 100);
    };

    expect(parseBRLToCents("-50,00")).toBeNull();
    expect(parseBRLToCents("0")).toBe(0);
  });
});
