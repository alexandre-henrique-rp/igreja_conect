/**
 * Teste de app/lib/money.server.ts (S00-T09).
 *
 * Cobre formatação pt-BR de 0, 1, 99, 100, 12345 cents.
 * Usa toMatch para evitar diferenças de non-breaking space.
 */
import { describe, it, expect } from "vitest";
import { formatBRLFromCents } from "./money.server";

describe("money.server — formatBRLFromCents", () => {
  it("0 cents → R$ 0,00", () => {
    expect(formatBRLFromCents(0)).toMatch(/R\$\s*0,00/);
  });
  it("1 cent → R$ 0,01", () => {
    expect(formatBRLFromCents(1)).toMatch(/R\$\s*0,01/);
  });
  it("99 cents → R$ 0,99", () => {
    expect(formatBRLFromCents(99)).toMatch(/R\$\s*0,99/);
  });
  it("100 cents → R$ 1,00", () => {
    expect(formatBRLFromCents(100)).toMatch(/R\$\s*1,00/);
  });
  it("12345 cents → R$ 123,45", () => {
    expect(formatBRLFromCents(12345)).toMatch(/R\$\s*123,45/);
  });
});
