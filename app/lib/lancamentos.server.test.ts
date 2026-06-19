/**
 * Testes de app/lib/lancamentos.server.ts (S06-T07).
 *
 * Cobre criarLancamento com os testes de borda do brief §7.3:
 * - #3: Saldo=0 + SAIDA 1 centavo → 409 (BLOQUEADOR)
 * - #4: DIZIMO sem membroId → ZodError (propagado, action captura → 422)
 * - #5: OFERTA sem membroId → OK anônimo
 * - #12: caixa arquivado → 409
 * - Borda exata: saldo=1000 + SAIDA 1000 → OK, saldo=0
 * - TRANSFERENCIA via criarLancamento → Response 400 (bloqueio explícito)
 * - DESPESA com membroId → ZodError (propagado, action captura → 422)
 * - RBAC: SECRETARIO OK, DISCIPULADOR 403
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prismaTest, setupTestDb } from "../../tests/helpers/db";
import type { SessionUser } from "./session.types";

let cleanup: () => Promise<void>;
let criarLancamento: typeof import("./lancamentos.server").criarLancamento;

beforeAll(async () => {
  cleanup = await setupTestDb();
  vi.resetModules();
  const mod = await import("./lancamentos.server");
  criarLancamento = mod.criarLancamento;
});

afterAll(async () => { await cleanup(); });

beforeEach(async () => {
  await prismaTest.lancamento.deleteMany();
  await prismaTest.transferenciaCaixa.deleteMany();
  await prismaTest.caixa.deleteMany();
  await prismaTest.membro.deleteMany();
});

function userWith(cargo: string | null, id = "u-" + (cargo ?? "none")): SessionUser {
  return { id, nome: `User ${cargo ?? "none"}`, cargo };
}

async function makeCaixa(opts: {
  nome: string;
  saldoCentavos?: number;
  ativo?: boolean;
}): Promise<{ id: string; nome: string; saldoCentavos: number; ativo: boolean }> {
  return prismaTest.caixa.create({
    data: {
      nome: opts.nome,
      saldoCentavos: opts.saldoCentavos ?? 0,
      ativo: opts.ativo ?? true,
    },
  });
}

async function makeMembro(nome = "João"): Promise<{ id: string; nome: string }> {
  return prismaTest.membro.create({
    data: {
      nome,
      email: `${nome.toLowerCase()}${Date.now()}@test.com`,
      tipo: "MEMBRO_ATIVO",
    },
  });
}

/** Helper para capturar Response de erro em testes. */
async function catchResponse(promise: Promise<unknown>): Promise<Response | null> {
  try { await promise; return null; } catch (e) { return e instanceof Response ? e : null; }
}

describe("lancamentos.server — criarLancamento (T07)", () => {

  // ===== Teste #3 (BLOQUEADOR) =====
  it("Teste #3: saldo=0 + SAIDA 1 centavo → 409, saldo permanece 0", async () => {
    const caixa = await makeCaixa({ nome: "Geral", saldoCentavos: 0 });
    const res = await catchResponse(criarLancamento({
      tipo: "SAIDA",
      categoria: "DESPESA_OPERACIONAL",
      valorCentavos: 1,
      caixaId: caixa.id,
      dataCompetencia: new Date("2026-06-01"),
      descricao: "Tentativa falha",
    }, userWith("ADMIN")));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(409);
    const atual = await prismaTest.caixa.findUnique({ where: { id: caixa.id } });
    expect(atual!.saldoCentavos).toBe(0);
  });

  // ===== Teste #4 (ZodError — propagado) =====
  it("Teste #4: DIZIMO sem membroId → ZodError (action captura → 422)", async () => {
    const caixa = await makeCaixa({ nome: "Geral", saldoCentavos: 1000 });
    await expect(criarLancamento({
      tipo: "ENTRADA",
      categoria: "DIZIMO",
      valorCentavos: 500,
      caixaId: caixa.id,
      dataCompetencia: new Date("2026-06-01"),
      descricao: "Dízimo sem membro",
    }, userWith("ADMIN"))).rejects.toThrow(); // Propaga ZodError (validação)
  });

  // ===== Teste #5 =====
  it("Teste #5: OFERTA sem membroId → OK, anônimo, saldo incrementa", async () => {
    const caixa = await makeCaixa({ nome: "Geral", saldoCentavos: 0 });
    const result = await criarLancamento({
      tipo: "ENTRADA",
      categoria: "OFERTA",
      valorCentavos: 1000,
      caixaId: caixa.id,
      dataCompetencia: new Date("2026-06-01"),
      descricao: "Oferta anônima",
    }, userWith("ADMIN"));
    expect(result).not.toBeNull();
    const r = result as { tipo: string; categoria: string; membroId: string | null };
    expect(r.tipo).toBe("ENTRADA");
    expect(r.categoria).toBe("OFERTA");
    expect(r.membroId).toBeNull();
    const atual = await prismaTest.caixa.findUnique({ where: { id: caixa.id } });
    expect(atual!.saldoCentavos).toBe(1000);
  });

  // ===== Teste #12 =====
  it("Teste #12: caixa arquivado → 409", async () => {
    const caixa = await makeCaixa({ nome: "Arquivado", ativo: false, saldoCentavos: 5000 });
    const res = await catchResponse(criarLancamento({
      tipo: "ENTRADA",
      categoria: "OFERTA",
      valorCentavos: 100,
      caixaId: caixa.id,
      dataCompetencia: new Date("2026-06-01"),
      descricao: "Tentar lançar em caixa arquivado",
    }, userWith("ADMIN")));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(409);
  });

  // ===== Borda exata =====
  it("borda exata: saldo=1000 + SAIDA 1000 → OK, saldo=0", async () => {
    const caixa = await makeCaixa({ nome: "Geral", saldoCentavos: 1000 });
    const result = await criarLancamento({
      tipo: "SAIDA",
      categoria: "DESPESA_OPERACIONAL",
      valorCentavos: 1000,
      caixaId: caixa.id,
      dataCompetencia: new Date("2026-06-01"),
      descricao: "Gastou tudo",
    }, userWith("ADMIN"));
    expect(result).not.toBeNull();
    expect((result as { tipo: string }).tipo).toBe("SAIDA");
    const atual = await prismaTest.caixa.findUnique({ where: { id: caixa.id } });
    expect(atual!.saldoCentavos).toBe(0);
  });

  // ===== TRANSFERENCIA bloqueada =====
  it("TRANSFERENCIA via criarLancamento → 400 (bloqueio explícito)", async () => {
    const caixa = await makeCaixa({ nome: "Geral", saldoCentavos: 5000 });
    const res = await catchResponse(criarLancamento({
      tipo: "SAIDA",
      categoria: "TRANSFERENCIA",
      valorCentavos: 1000,
      caixaId: caixa.id,
      dataCompetencia: new Date("2026-06-01"),
      descricao: "Tentativa de transferência",
    }, userWith("ADMIN")));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(400);
    const text = await res!.text();
    expect(text).toMatch(/TRANSFERENCIA/i);
  });

  // ===== DESPESA com membroId → ZodError =====
  it("DESPESA com membroId → ZodError (RN-FIN-05)", async () => {
    const caixa = await makeCaixa({ nome: "Geral", saldoCentavos: 5000 });
    const membro = await makeMembro();
    await expect(criarLancamento({
      tipo: "SAIDA",
      categoria: "DESPESA_OPERACIONAL",
      valorCentavos: 1000,
      caixaId: caixa.id,
      membroId: membro.id,
      dataCompetencia: new Date("2026-06-01"),
      descricao: "Despesa vinculada a membro",
    }, userWith("ADMIN"))).rejects.toThrow();
  });

  // ===== ENTRADA feliz =====
  it("ENTRADA DIZIMO com membroId → OK, saldo incrementa", async () => {
    const caixa = await makeCaixa({ nome: "Geral", saldoCentavos: 0 });
    const membro = await makeMembro();
    const result = await criarLancamento({
      tipo: "ENTRADA",
      categoria: "DIZIMO",
      valorCentavos: 5000,
      caixaId: caixa.id,
      membroId: membro.id,
      dataCompetencia: new Date("2026-06-01"),
      descricao: "Dízimo do João",
    }, userWith("ADMIN"));
    expect(result).not.toBeNull();
    const r3 = result as { tipo: string; categoria: string; membroId: string | null };
    expect(r3.tipo).toBe("ENTRADA");
    expect(r3.categoria).toBe("DIZIMO");
    expect(r3.membroId).toBe(membro.id);
    const atual = await prismaTest.caixa.findUnique({ where: { id: caixa.id } });
    expect(atual!.saldoCentavos).toBe(5000);
  });

  // ===== RBAC =====
  it("SECRETARIO pode criar lancamento (4 perfis)", async () => {
    const caixa = await makeCaixa({ nome: "Geral", saldoCentavos: 0 });
    const result = await criarLancamento({
      tipo: "ENTRADA",
      categoria: "OFERTA",
      valorCentavos: 100,
      caixaId: caixa.id,
      dataCompetencia: new Date("2026-06-01"),
      descricao: "Oferta do culto",
    }, userWith("SECRETARIO"));
    expect(result).not.toBeNull();
  });

  it("DISCIPULADOR NÃO pode criar lancamento → 403", async () => {
    const caixa = await makeCaixa({ nome: "Geral", saldoCentavos: 5000 });
    const res = await catchResponse(criarLancamento({
      tipo: "ENTRADA",
      categoria: "OFERTA",
      valorCentavos: 100,
      caixaId: caixa.id,
      dataCompetencia: new Date("2026-06-01"),
      descricao: "Inválido",
    }, userWith("DISCIPULADOR")));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  // ===== SAIDA com saldo insuficiente =====
  it("SAIDA com saldo insuficiente → 409 (assertSaldoSuficiente)", async () => {
    const caixa = await makeCaixa({ nome: "Geral", saldoCentavos: 100 });
    const res = await catchResponse(criarLancamento({
      tipo: "SAIDA",
      categoria: "DESPESA_OPERACIONAL",
      valorCentavos: 200,
      caixaId: caixa.id,
      dataCompetencia: new Date("2026-06-01"),
      descricao: "Sem saldo",
    }, userWith("ADMIN")));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(409);
  });
});

// ==================== T08: listarPorCaixa coverage (S06-REWORK) ====================

describe("lancamentos.server — listarPorCaixa (T08)", () => {
  // Import fresh to avoid vitest module cache issues
  let listarPorCaixa: typeof import("./lancamentos.server").listarPorCaixa;

  beforeAll(async () => {
    vi.resetModules();
    const mod = await import("./lancamentos.server");
    listarPorCaixa = mod.listarPorCaixa;
  });

  it("ADMIN lista todos lançamentos do caixa (inclui DIZIMO)", async () => {
    const caixa = await makeCaixa({ nome: "Geral", saldoCentavos: 0 });
    const membro = await makeMembro();
    await criarLancamento({
      tipo: "ENTRADA",
      categoria: "DIZIMO",
      valorCentavos: 1000,
      caixaId: caixa.id,
      membroId: membro.id,
      dataCompetencia: new Date("2026-06-01"),
      descricao: "Dízimo",
    }, userWith("ADMIN"));
    await criarLancamento({
      tipo: "ENTRADA",
      categoria: "OFERTA",
      valorCentavos: 500,
      caixaId: caixa.id,
      dataCompetencia: new Date("2026-06-02"),
      descricao: "Oferta",
    }, userWith("ADMIN"));

    const result = await listarPorCaixa(caixa.id, {}, userWith("ADMIN"));

    expect(result).not.toBeNull();
    expect(result!.lancamentos).toHaveLength(2);
    expect(result!.lancamentos.map(l => l.categoria)).toContain("DIZIMO");
    expect(result!.lancamentos.map(l => l.categoria)).toContain("OFERTA");
  });

  it("SECRETARIO vê apenas OFERTA/SAIDA (não DIZIMO) — RN-MEM-03", async () => {
    const caixa = await makeCaixa({ nome: "Geral", saldoCentavos: 0 });
    const membro = await makeMembro();
    await criarLancamento({
      tipo: "ENTRADA",
      categoria: "DIZIMO",
      valorCentavos: 1000,
      caixaId: caixa.id,
      membroId: membro.id,
      dataCompetencia: new Date("2026-06-01"),
      descricao: "Dízimo",
    }, userWith("ADMIN"));
    await criarLancamento({
      tipo: "ENTRADA",
      categoria: "OFERTA",
      valorCentavos: 500,
      caixaId: caixa.id,
      dataCompetencia: new Date("2026-06-02"),
      descricao: "Oferta",
    }, userWith("ADMIN"));

    const result = await listarPorCaixa(caixa.id, {}, userWith("SECRETARIO"));

    expect(result).not.toBeNull();
    expect(result!.lancamentos).toHaveLength(1);
    expect(result!.lancamentos[0].categoria).toBe("OFERTA");
  });

  it("Filtro por periodo: mes_atual retorna apenas lançamentos do mês", async () => {
    const caixa = await makeCaixa({ nome: "Geral", saldoCentavos: 0 });
    // Current month
    const now = new Date();
    await criarLancamento({
      tipo: "ENTRADA",
      categoria: "OFERTA",
      valorCentavos: 100,
      caixaId: caixa.id,
      dataCompetencia: new Date(now.getFullYear(), now.getMonth(), 15),
      descricao: "Este mês",
    }, userWith("ADMIN"));

    const result = await listarPorCaixa(caixa.id, { periodo: "mes_atual" }, userWith("ADMIN"));

    expect(result).not.toBeNull();
    expect(result!.lancamentos.length).toBeGreaterThan(0);
  });

  it("Filtro por categoria: retorna apenas lançamentos da categoria", async () => {
    const caixa = await makeCaixa({ nome: "Geral", saldoCentavos: 0 });
    await criarLancamento({
      tipo: "ENTRADA",
      categoria: "DIZIMO",
      valorCentavos: 1000,
      caixaId: caixa.id,
      membroId: (await makeMembro()).id,
      dataCompetencia: new Date("2026-06-01"),
      descricao: "Dízimo",
    }, userWith("ADMIN"));
    await criarLancamento({
      tipo: "ENTRADA",
      categoria: "OFERTA",
      valorCentavos: 500,
      caixaId: caixa.id,
      dataCompetencia: new Date("2026-06-02"),
      descricao: "Oferta",
    }, userWith("ADMIN"));

    const result = await listarPorCaixa(caixa.id, { categoria: "OFERTA" }, userWith("ADMIN"));

    expect(result).not.toBeNull();
    expect(result!.lancamentos).toHaveLength(1);
    expect(result!.lancamentos[0].categoria).toBe("OFERTA");
  });

  it("Lista vazia retorna []", async () => {
    const caixa = await makeCaixa({ nome: "Vazio", saldoCentavos: 0 });

    const result = await listarPorCaixa(caixa.id, {}, userWith("ADMIN"));

    expect(result).not.toBeNull();
    expect(result!.lancamentos).toHaveLength(0);
    expect(result!.total).toBe(0);
  });

  it("Caixa inexistente retorna null", async () => {
    const result = await listarPorCaixa("00000000-0000-0000-0000-000000000000", {}, userWith("ADMIN"));
    expect(result).toBeNull();
  });

  it("DISCIPULADOR NÃO pode listar → 403", async () => {
    const caixa = await makeCaixa({ nome: "Geral", saldoCentavos: 0 });
    let caught: unknown = null;
    try {
      await listarPorCaixa(caixa.id, {}, userWith("DISCIPULADOR"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(403);
    }
  });
});
