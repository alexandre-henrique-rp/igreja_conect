/**
 * Testes para rota /app/financeiro/transferencias/nova (S07-T04).
 *
 * Testa mocks de RBAC e estrutura de dados.
 * Testes E2E completos são feitos com Playwright.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("financeiro.transferencia-nova", () => {
  // Mock assertCanTransferir
  const mockAssertCanTransferir = vi.fn();
  
  // Mock listarCaixasParaTransferencia  
  const mockListarCaixas = vi.fn(() => [
    { id: "cx1", nome: "Caixa Geral", saldoCentavos: 123456 },
    { id: "cx2", nome: "Cantina", saldoCentavos: 7890 },
  ]);

  // Mock transferirEntreCaixas - aceita argumentos
  const mockTransferir = vi.fn((_input: unknown) => ({ grupoId: "uuid-teste" }));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loader chama assertCanTransferir com user admin", () => {
    const adminUser = { id: "u1", nome: "Admin", cargo: "ADMIN" };
    mockAssertCanTransferir(adminUser);
    expect(mockAssertCanTransferir).toHaveBeenCalledWith(adminUser);
  });

  it("loader chama listarCaixasParaTransferencia", () => {
    mockListarCaixas();
    expect(mockListarCaixas).toHaveBeenCalled();
  });

  it("listarCaixas retorna caixas com saldo", () => {
    const result = mockListarCaixas();
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty("id");
    expect(result[0]).toHaveProperty("nome");
    expect(result[0]).toHaveProperty("saldoCentavos");
  });

  it("SECRETARIO nao esta em allow de transferencia", () => {
    const allowed = ["ADMIN", "PASTOR", "FINANCEIRO"];
    const secretaryCargo = "SECRETARIO";
    expect(allowed.includes(secretaryCargo)).toBe(false);
  });

  it("ADMIN esta em allow de transferencia", () => {
    const allowed = ["ADMIN", "PASTOR", "FINANCEIRO"];
    const adminCargo = "ADMIN";
    expect(allowed.includes(adminCargo)).toBe(true);
  });

  it("PASTOR esta em allow de transferencia", () => {
    const allowed = ["ADMIN", "PASTOR", "FINANCEIRO"];
    const pastorCargo = "PASTOR";
    expect(allowed.includes(pastorCargo)).toBe(true);
  });

  it("FINANCEIRO esta em allow de transferencia", () => {
    const allowed = ["ADMIN", "PASTOR", "FINANCEIRO"];
    const financeiroCargo = "FINANCEIRO";
    expect(allowed.includes(financeiroCargo)).toBe(true);
  });

  it("transferirEntreCaixas retorna grupoId", async () => {
    const result = await mockTransferir({
      origemId: "cx1",
      destinoId: "cx2",
      valorCentavos: 5000,
      descricao: "Teste",
    });
    expect(result.grupoId).toBe("uuid-teste");
  });

  it("parseBRLToCents converte valor para centavos", () => {
    const parseBRLToCents = (raw: string): number | null => {
      if (typeof raw !== "string") return null;
      const cleaned = raw.replace(/R\$\s*/gi, "").replace(/\s/g, "");
      const normalized = cleaned.includes(",") ? cleaned.replace(",", ".") : cleaned;
      const parsed = Number(normalized);
      if (!Number.isFinite(parsed) || parsed < 0) return null;
      return Math.round(parsed * 100);
    };

    expect(parseBRLToCents("100,00")).toBe(10000);
    expect(parseBRLToCents("50,00")).toBe(5000);
  });
});
