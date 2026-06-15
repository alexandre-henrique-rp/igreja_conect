/**
 * Testes do helper de formatação monetária (S06-T13).
 */
import { describe, it, expect } from "vitest";
import { parseBRLToCents, mascaraBRL, formatBRLFromCents } from "./money-format";

describe("parseBRLToCents", () => {
  it("converte '50' → 5000", () => {
    expect(parseBRLToCents("50")).toBe(5000);
  });

  it("converte '50,00' → 5000", () => {
    expect(parseBRLToCents("50,00")).toBe(5000);
  });

  it("converte '50.00' → 5000", () => {
    expect(parseBRLToCents("50.00")).toBe(5000);
  });

  it("converte 'R$ 50,00' → 5000 (com prefixo)", () => {
    expect(parseBRLToCents("R$ 50,00")).toBe(5000);
  });

  it("converte '1.234,56' (BR) → 123456", () => {
    expect(parseBRLToCents("1.234,56")).toBe(123456);
  });

  it("converte '1234,5' → 123450", () => {
    expect(parseBRLToCents("1234,5")).toBe(123450);
  });

  it("converte '0,01' → 1", () => {
    expect(parseBRLToCents("0,01")).toBe(1);
  });

  it("converte 'R$ 0,50' → 50", () => {
    expect(parseBRLToCents("R$ 0,50")).toBe(50);
  });

  it("arredonda 0,001 → 0 (Math.round)", () => {
    expect(parseBRLToCents("0,001")).toBe(0);
  });

  it("retorna null para string vazia", () => {
    expect(parseBRLToCents("")).toBeNull();
  });

  it("retorna null para string não-numérica", () => {
    expect(parseBRLToCents("abc")).toBeNull();
  });

  it("retorna null para valor negativo", () => {
    expect(parseBRLToCents("-50,00")).toBeNull();
  });

  it("retorna null para entrada inválida (dois pontos)", () => {
    expect(parseBRLToCents("1.234.56")).toBeNull();
  });

  it("aceita string com espaços", () => {
    expect(parseBRLToCents("  50,00  ")).toBe(5000);
  });
});

describe("mascaraBRL", () => {
  it("string vazia → vazia", () => {
    expect(mascaraBRL("")).toBe("");
  });

  it("'5000' → '50,00'", () => {
    expect(mascaraBRL("5000")).toBe("50,00");
  });

  it("'123456' → '1.234,56'", () => {
    expect(mascaraBRL("123456")).toBe("1.234,56");
  });

  it("'50' → '0,50'", () => {
    expect(mascaraBRL("50")).toBe("0,50");
  });

  it("'5' → '0,05'", () => {
    expect(mascaraBRL("5")).toBe("0,05");
  });

  it("remove não-dígitos", () => {
    expect(mascaraBRL("R$ 50,00")).toBe("50,00");
  });
});

describe("formatBRLFromCents (re-export)", () => {
  it("0 → 'R$ 0,00'", () => {
    expect(formatBRLFromCents(0)).toBe("R$ 0,00");
  });

  it("5000 → 'R$ 50,00'", () => {
    expect(formatBRLFromCents(5000)).toBe("R$ 50,00");
  });

  it("123456 → 'R$ 1.234,56'", () => {
    expect(formatBRLFromCents(123456)).toBe("R$ 1.234,56");
  });
});
