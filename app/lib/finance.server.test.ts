/**
 * Testes de app/lib/finance.server.ts — extensão S06-T07 (assertSaldoSuficiente)
 * + S06-T10 (getDashboardFinanceiro) + S08-T01/T05 (Fidelidade Financeira).
 *
 * Cobre:
 * - T007 — assertSaldoSuficiente (RAG pattern-trava-saldo-service §2.1):
 *   valor inválido, caixa inexistente, caixa arquivado, saldo < valor, borda
 *   exata (saldo = valor), happy path.
 * - T010 — getDashboardFinanceiro: 3 caixas, SECRETARIO SEM DIZIMO,
 *   DISCIPULADOR 403, 0 caixas, caixa arquivado não conta no agregado.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prismaTest, setupTestDb } from "../../tests/helpers/db";
import type { SessionUser } from "./session.types";

let cleanup: () => Promise<void>;
let assertSaldoSuficiente: typeof import("./finance.server").assertSaldoSuficiente;
let getDashboardFinanceiro: typeof import("./finance.server").getDashboardFinanceiro;
let getDizimosByMembro: typeof import("./finance.server").getDizimosByMembro;

beforeAll(async () => {
  cleanup = await setupTestDb();
  vi.resetModules();
  const mod = await import("./finance.server");
  assertSaldoSuficiente = mod.assertSaldoSuficiente;
  getDashboardFinanceiro = mod.getDashboardFinanceiro;
  getDizimosByMembro = mod.getDizimosByMembro;
});

afterAll(async () => { await cleanup(); });

beforeEach(async () => {
  await prismaTest.alertaDestinatario.deleteMany();
  await prismaTest.alerta.deleteMany();
  await prismaTest.ministerioMembro.deleteMany();
  await prismaTest.movimentacaoEstoque.deleteMany();
  await prismaTest.manutencaoAtivo.deleteMany();
  await prismaTest.lancamento.deleteMany();
  await prismaTest.transferenciaCaixa.deleteMany();
  await prismaTest.session.deleteMany();
  await prismaTest.membro.updateMany({ data: { discipuladorId: null } });
  await prismaTest.membro.deleteMany();
  await prismaTest.caixa.deleteMany();
});

function userWith(cargo: string | null, id = "u-" + cargo): SessionUser {
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

async function makeMembro(nome: string): Promise<{ id: string }> {
  const m = await prismaTest.membro.create({ data: { nome, tipo: "MEMBRO_ATIVO" } });
  return { id: m.id };
}

// ----------------- T007 — assertSaldoSuficiente (RN-FIN-04) -----------------

describe("finance.server — assertSaldoSuficiente (RN-FIN-04, S06-T07)", () => {
  it("happy path: caixa com saldo suficiente → silent return", async () => {
    const caixa = await makeCaixa({ nome: "Geral", saldoCentavos: 10000 });
    await expect(
      assertSaldoSuficiente(caixa.id, 5000, "Teste ctx")
    ).resolves.toBeUndefined();
  });

  it("valor=0 lança Response 400 (valor deve ser inteiro > 0)", async () => {
    const caixa = await makeCaixa({ nome: "Geral", saldoCentavos: 1000 });
    let caught: unknown = null;
    try {
      await assertSaldoSuficiente(caixa.id, 0, "Lançamento");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(400);
    }
  });

  it("valor negativo lança Response 400", async () => {
    const caixa = await makeCaixa({ nome: "Geral", saldoCentavos: 1000 });
    let caught: unknown = null;
    try {
      await assertSaldoSuficiente(caixa.id, -100, "Lançamento");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(400);
    }
  });

  it("valor float lança Response 400 (não é Int)", async () => {
    const caixa = await makeCaixa({ nome: "Geral", saldoCentavos: 1000 });
    let caught: unknown = null;
    try {
      await assertSaldoSuficiente(caixa.id, 1.5, "Lançamento");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(400);
    }
  });

  it("caixa inexistente lança Response 404", async () => {
    let caught: unknown = null;
    try {
      await assertSaldoSuficiente("00000000-0000-0000-0000-000000000000", 100, "Lançamento");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(404);
    }
  });

  it("caixa arquivado lança Response 409 (movimentações bloqueadas)", async () => {
    const caixa = await makeCaixa({ nome: "Arquivado", saldoCentavos: 5000, ativo: false });
    let caught: unknown = null;
    try {
      await assertSaldoSuficiente(caixa.id, 100, "Lançamento");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(409);
    }
  });

  it("saldo=0 + valor 1 centavo lança Response 409 (BLOQUEADOR sprint §7.3 #3)", async () => {
    const caixa = await makeCaixa({ nome: "Vazio", saldoCentavos: 0 });
    let caught: unknown = null;
    try {
      await assertSaldoSuficiente(caixa.id, 1, "Lançamento de saída");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(409);
    }
  });

  it("saldo<valor lança Response 409 (Saldo insuficiente)", async () => {
    const caixa = await makeCaixa({ nome: "Baixo", saldoCentavos: 100 });
    let caught: unknown = null;
    try {
      await assertSaldoSuficiente(caixa.id, 500, "Lançamento de saída");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(409);
    }
  });

  it("borda exata: saldo=valor → silent return (RN-FIN-04 não permite negativo, mas zera)", async () => {
    const caixa = await makeCaixa({ nome: "Borda", saldoCentavos: 1000 });
    await expect(
      assertSaldoSuficiente(caixa.id, 1000, "Lançamento de saída")
    ).resolves.toBeUndefined();
  });
});

// ----------------- T010 — getDashboardFinanceiro (S06-T10) -----------------

describe("finance.server — getDashboardFinanceiro (S06-T10)", () => {
  it("ADMIN: retorna caixas ativos, últimos 5, saldo agregado correto", async () => {
    const c1 = await makeCaixa({ nome: "Geral", saldoCentavos: 100000 });
    const c2 = await makeCaixa({ nome: "Cantina", saldoCentavos: 50000 });
    const c3 = await makeCaixa({ nome: "Missões", saldoCentavos: 25000 });
    // Cria 7 lançamentos variados
    const membro = await makeMembro("Maria");
    for (let i = 0; i < 7; i++) {
      await prismaTest.lancamento.create({
        data: {
          tipo: i % 2 === 0 ? "ENTRADA" : "SAIDA",
          categoria: i === 0 ? "DIZIMO" : "OFERTA",
          valorCentavos: 1000,
          caixaId: c1.id,
          membroId: i === 0 ? membro.id : null,
          descricao: `Lançamento ${i}`,
        },
      });
    }

    const data = await getDashboardFinanceiro(userWith("ADMIN"));
    expect(data.caixas).toHaveLength(3);
    expect(data.caixas[0].nome).toBe("Cantina"); // ordem alfabética
    expect(data.totalCaixasAtivos).toBe(3);
    expect(data.saldoAgregadoCentavos).toBe(175000); // 100k + 50k + 25k
    expect(data.ultimosLancamentos).toHaveLength(5); // take: 5
    expect(data.ultimosLancamentos[0].categoria).toBe("OFERTA"); // último criado primeiro
  });

  it("SECRETARIO: 403 (assertCanSeeFinancials bloqueia SECRETARIO)", async () => {
    let caught: unknown = null;
    try {
      await getDashboardFinanceiro(userWith("SECRETARIO"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(403);
    }
  });

  it("DISCIPULADOR: lança Response 403 (Camada 3 bloqueia)", async () => {
    let caught: unknown = null;
    try {
      await getDashboardFinanceiro(userWith("DISCIPULADOR"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(403);
    }
  });

  it("0 caixas: retorna arrays vazios + saldoAgregado=0", async () => {
    const data = await getDashboardFinanceiro(userWith("ADMIN"));
    expect(data.caixas).toEqual([]);
    expect(data.totalCaixasAtivos).toBe(0);
    expect(data.saldoAgregadoCentavos).toBe(0);
    expect(data.ultimosLancamentos).toEqual([]);
  });

  it("caixa arquivado NÃO conta em saldoAgregado nem em caixas", async () => {
    await makeCaixa({ nome: "Ativo", saldoCentavos: 10000, ativo: true });
    await makeCaixa({ nome: "Arquivado", saldoCentavos: 5000, ativo: false });

    const data = await getDashboardFinanceiro(userWith("ADMIN"));
    expect(data.caixas).toHaveLength(1);
    expect(data.caixas[0].nome).toBe("Ativo");
    expect(data.totalCaixasAtivos).toBe(1);
    expect(data.saldoAgregadoCentavos).toBe(10000);
  });

  it("getDizimosByMembro existente continua funcionando (regressão)", async () => {
    const membro = await makeMembro("Alvo");
    const result = await getDizimosByMembro(membro.id, userWith("ADMIN"));
    expect(result).toHaveProperty("dizimos"); expect(result).toHaveProperty("totalCentavos"); expect(result).toHaveProperty("mesesComDizimo"); expect(Array.isArray(result.dizimos)).toBe(true);
  });

// ==================== S08-T01/T05: getDizimosByMembro + getFidelidadeFinanceira ====================

describe("finance.server — getDizimosByMembro (S08-T01)", () => {
  it("ADMIN: retorna 3 dízimos com totalCentavos e mesesComDizimo corretos", async () => {
    const membro = await makeMembro("Dizimista");
    const caixa = await makeCaixa({ nome: "Geral", saldoCentavos: 100000 });
    // Cria 3 dízimos no mesmo mês
    const baseDate = new Date("2024-03-15");
    for (let i = 0; i < 3; i++) {
      await prismaTest.lancamento.create({
        data: {
          tipo: "ENTRADA",
          categoria: "DIZIMO",
          valorCentavos: 5000 + i * 1000,
          caixaId: caixa.id,
          membroId: membro.id,
          descricao: `Dizimo ${i + 1}`,
          dataCompetencia: new Date(baseDate.getFullYear(), baseDate.getMonth(), 10 + i),
        },
      });
    }

    const result = await getDizimosByMembro(membro.id, userWith("ADMIN"));
    expect(result.dizimos).toHaveLength(3);
    expect(result.totalCentavos).toBe(18000); // 5000 + 6000 + 7000
    expect(result.mesesComDizimo).toBe(1); // todos no mesmo mês
    expect(result.dizimos[0]).toHaveProperty("id");
    expect(result.dizimos[0]).toHaveProperty("valorCentavos");
    expect(result.dizimos[0]).toHaveProperty("dataCompetencia");
    expect(result.dizimos[0]).toHaveProperty("caixaId");
    expect(result.dizimos[0]).toHaveProperty("caixaNome");
  });

  it("PASTOR: busca dízimos com sucesso", async () => {
    const membro = await makeMembro("Dizimista Pastor");
    const caixa = await makeCaixa({ nome: "Geral" });
    await prismaTest.lancamento.create({
      data: {
        tipo: "ENTRADA", categoria: "DIZIMO", valorCentavos: 3000,
        caixaId: caixa.id, membroId: membro.id, descricao: "Dizimo pastor",
      },
    });
    const result = await getDizimosByMembro(membro.id, userWith("PASTOR"));
    expect(result.dizimos).toHaveLength(1);
    expect(result.totalCentavos).toBe(3000);
  });

  it("FINANCEIRO: busca dízimos com sucesso", async () => {
    const membro = await makeMembro("Dizimista Financeiro");
    const caixa = await makeCaixa({ nome: "Geral" });
    await prismaTest.lancamento.create({
      data: {
        tipo: "ENTRADA", categoria: "DIZIMO", valorCentavos: 7000,
        caixaId: caixa.id, membroId: membro.id, descricao: "Dizimo financeiro",
      },
    });
    const result = await getDizimosByMembro(membro.id, userWith("FINANCEIRO"));
    expect(result.dizimos).toHaveLength(1);
    expect(result.totalCentavos).toBe(7000);
  });

  it("SECRETARIO: lança Response 403", async () => {
    const membro = await makeMembro("Dizimista Sec");
    let caught: unknown = null;
    try {
      await getDizimosByMembro(membro.id, userWith("SECRETARIO"));
    } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) expect(caught.status).toBe(403);
  });

  it("DISCIPULADOR: lança Response 403", async () => {
    const membro = await makeMembro("Dizimista Disc");
    let caught: unknown = null;
    try {
      await getDizimosByMembro(membro.id, userWith("DISCIPULADOR"));
    } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) expect(caught.status).toBe(403);
  });

  it("LIDER_MINISTERIO: lança Response 403", async () => {
    const membro = await makeMembro("Dizimista Lider");
    let caught: unknown = null;
    try {
      await getDizimosByMembro(membro.id, userWith("LIDER_MINISTERIO"));
    } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) expect(caught.status).toBe(403);
  });

  it("membro sem dízimos: retorna array vazio + total 0 + meses 0", async () => {
    const membro = await makeMembro("Sem Dizimo");
    const result = await getDizimosByMembro(membro.id, userWith("ADMIN"));
    expect(result.dizimos).toEqual([]);
    expect(result.totalCentavos).toBe(0);
    expect(result.mesesComDizimo).toBe(0);
  });

  it("filtro dataInicio/dataFim funciona", async () => {
    const membro = await makeMembro("Dizimista Filtro");
    const caixa = await makeCaixa({ nome: "Geral" });
    // Dízimos em jan e mar 2024
    await prismaTest.lancamento.create({
      data: {
        tipo: "ENTRADA", categoria: "DIZIMO", valorCentavos: 1000,
        caixaId: caixa.id, membroId: membro.id, descricao: "Jan",
        dataCompetencia: new Date("2024-01-15"),
      },
    });
    await prismaTest.lancamento.create({
      data: {
        tipo: "ENTRADA", categoria: "DIZIMO", valorCentavos: 2000,
        caixaId: caixa.id, membroId: membro.id, descricao: "Mar",
        dataCompetencia: new Date("2024-03-15"),
      },
    });

    // Filtra apenas jan-fev
    const result = await getDizimosByMembro(membro.id, userWith("ADMIN"), {
      dataInicio: new Date("2024-01-01"),
      dataFim: new Date("2024-02-29"),
    });
    expect(result.dizimos).toHaveLength(1);
    expect(result.dizimos[0].valorCentavos).toBe(1000);
    expect(result.totalCentavos).toBe(1000);
    expect(result.mesesComDizimo).toBe(1);
  });

  it("mesesComDizimo conta meses distintos corretamente", async () => {
    const membro = await makeMembro("Dizimista MultiMes");
    const caixa = await makeCaixa({ nome: "Geral" });
    // 2 dízimos em jan, 1 em mar
    for (const [mes, dia] of [[0, 10], [0, 20], [2, 5]] as [number, number][]) {
      await prismaTest.lancamento.create({
        data: {
          tipo: "ENTRADA", categoria: "DIZIMO", valorCentavos: 1000,
          caixaId: caixa.id, membroId: membro.id, descricao: `Mes ${mes}`,
          dataCompetencia: new Date(2024, mes, dia),
        },
      });
    }
    const result = await getDizimosByMembro(membro.id, userWith("ADMIN"));
    expect(result.mesesComDizimo).toBe(2); // jan e mar = 2 meses distintos
  });
});

describe("finance.server — getFidelidadeFinanceira (S08-T05)", () => {
  it("ADMIN: retorna objeto com dados", async () => {
    const { getFidelidadeFinanceira } = await import("./finance.server");
    const membro = await makeMembro("Admin Fidelity");
    const result = await getFidelidadeFinanceira(membro.id, userWith("ADMIN"));
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("dizimos");
  });

  it("SECRETARIO: retorna null (sem lançamento)", async () => {
    const { getFidelidadeFinanceira } = await import("./finance.server");
    const membro = await makeMembro("Sec Fidelity");
    const result = await getFidelidadeFinanceira(membro.id, userWith("SECRETARIO"));
    expect(result).toBeNull();
  });
});
});
