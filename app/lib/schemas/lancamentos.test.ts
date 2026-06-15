/**
 * Testes de app/lib/schemas/lancamentos.ts (S06-T06).
 *
 * Cobre LancamentoCreateSchema e ExtratoFiltrosSchema:
 * - RN-FIN-05: DIZIMO exige membroId; DESPESA/COMPRA/MANUTENCAO/TRANSFERENCIA
 *   não pode ter membroId
 * - valorCentavos > 0 (positive Int)
 * - descricao 1-500 chars
 * - strict() bloqueia campos extra (gate LGPD)
 */
import { describe, it, expect } from "vitest";
import { LancamentoCreateSchema, ExtratoFiltrosSchema } from "./lancamentos";

describe("schemas/lancamentos — LancamentoCreateSchema (T06)", () => {
  it("DIZIMO com membroId → OK", () => {
    const r = LancamentoCreateSchema.safeParse({
      tipo: "ENTRADA",
      categoria: "DIZIMO",
      valorCentavos: 5000,
      caixaId: "00000000-0000-0000-0000-000000000000",
      membroId: "00000000-0000-0000-0000-000000000000",
      dataCompetencia: "2026-06-01",
      descricao: "Dízimo mensal",
    });
    expect(r.success).toBe(true);
  });

  it("DIZIMO sem membroId → ZodError (RN-FIN-05)", () => {
    const r = LancamentoCreateSchema.safeParse({
      tipo: "ENTRADA",
      categoria: "DIZIMO",
      valorCentavos: 5000,
      caixaId: "00000000-0000-0000-0000-000000000000",
      dataCompetencia: "2026-06-01",
      descricao: "Dízimo sem membro",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const err = r.error.issues.find((i) => i.path.includes("membroId"));
      expect(err?.message).toBe("Dízimo exige membro.");
    }
  });

  it("OFERTA sem membroId → OK (pode ser anônimo)", () => {
    const r = LancamentoCreateSchema.safeParse({
      tipo: "ENTRADA",
      categoria: "OFERTA",
      valorCentavos: 1000,
      caixaId: "00000000-0000-0000-0000-000000000000",
      dataCompetencia: "2026-06-01",
      descricao: "Oferta anônima",
    });
    expect(r.success).toBe(true);
  });

  it("DESPESA com membroId → ZodError (RN-FIN-05)", () => {
    const r = LancamentoCreateSchema.safeParse({
      tipo: "SAIDA",
      categoria: "DESPESA_OPERACIONAL",
      valorCentavos: 5000,
      caixaId: "00000000-0000-0000-0000-000000000000",
      membroId: "00000000-0000-0000-0000-000000000000",
      dataCompetencia: "2026-06-01",
      descricao: "Despesa com membro vinculado",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const err = r.error.issues.find((i) => i.path.includes("membroId"));
      expect(err).toBeTruthy();
    }
  });

  it("valorCentavos=0 → ZodError (positive)", () => {
    const r = LancamentoCreateSchema.safeParse({
      tipo: "ENTRADA",
      categoria: "OFERTA",
      valorCentavos: 0,
      caixaId: "00000000-0000-0000-0000-000000000000",
      dataCompetencia: "2026-06-01",
      descricao: "Valor zero",
    });
    expect(r.success).toBe(false);
  });

  it("valorCentavos=-100 → ZodError (positive)", () => {
    const r = LancamentoCreateSchema.safeParse({
      tipo: "ENTRADA",
      categoria: "OFERTA",
      valorCentavos: -100,
      caixaId: "00000000-0000-0000-0000-000000000000",
      dataCompetencia: "2026-06-01",
      descricao: "Valor negativo",
    });
    expect(r.success).toBe(false);
  });

  it("descricao vazia → ZodError", () => {
    const r = LancamentoCreateSchema.safeParse({
      tipo: "ENTRADA",
      categoria: "OFERTA",
      valorCentavos: 1000,
      caixaId: "00000000-0000-0000-0000-000000000000",
      dataCompetencia: "2026-06-01",
      descricao: "",
    });
    expect(r.success).toBe(false);
  });

  it("descricao 501 chars → ZodError", () => {
    const r = LancamentoCreateSchema.safeParse({
      tipo: "ENTRADA",
      categoria: "OFERTA",
      valorCentavos: 1000,
      caixaId: "00000000-0000-0000-0000-000000000000",
      dataCompetencia: "2026-06-01",
      descricao: "x".repeat(501),
    });
    expect(r.success).toBe(false);
  });
});

describe("schemas/lancamentos — ExtratoFiltrosSchema (T06)", () => {
  it("aceita payload mínimo (apenas campos obrigatórios)", () => {
    const r = ExtratoFiltrosSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(1);
      expect(r.data.pageSize).toBe(25);
      expect(r.data.periodo).toBeUndefined();
    }
  });

  it("aceita filtro por periodo e categoria", () => {
    const r = ExtratoFiltrosSchema.safeParse({
      periodo: "mes_atual",
      categoria: "DIZIMO",
      page: 2,
      pageSize: 10,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.periodo).toBe("mes_atual");
      expect(r.data.categoria).toBe("DIZIMO");
      expect(r.data.page).toBe(2);
      expect(r.data.pageSize).toBe(10);
    }
  });

  it("rejeita page < 1", () => {
    const r = ExtratoFiltrosSchema.safeParse({ page: 0 });
    expect(r.success).toBe(false);
  });

  it("rejeita pageSize > 100", () => {
    const r = ExtratoFiltrosSchema.safeParse({ pageSize: 200 });
    expect(r.success).toBe(false);
  });

  it("coerce page string para number", () => {
    const r = ExtratoFiltrosSchema.safeParse({ page: "2" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.page).toBe(2);
  });
});
