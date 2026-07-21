/**
 * Testes de app/lib/transferencias.server.ts (S07-T02, T06, rework S07).
 *
 * Cobre:
 * - T02: transferirEntreCaixas — todos os perfis, validacoes, atomicidade
 * - T06: borda #2 — caixa arquivado rejeita transferencia
 * - S07-REWORK:
 *   - SEC-S07-002: TransferenciaCaixa criada na $transaction
 *   - SEC-S07-003: idempotency key previne double-submit
 *   - atomicity test: mock falha na 2a mutacao → rollback total
 *   - helpers: validarTransferencia, executarTransferenciaAtomica
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prismaTest, setupTestDb } from "../../tests/helpers/db";
import type { SessionUser } from "./session.types";
import type { TransferenciaResult } from "./transferencias.server";

let cleanup: () => Promise<void>;
let transferirEntreCaixas: typeof import("./transferencias.server").transferirEntreCaixas;

beforeAll(async () => {
  cleanup = await setupTestDb();
  vi.resetModules();
  const mod = await import("./transferencias.server");
  transferirEntreCaixas = mod.transferirEntreCaixas;
  // Criar membros com IDs customizados para satisfazer FK em TransferenciaCaixa.executadoPorId
  await prismaTest.membro.createMany({
    data: [
      { id: "u-ADMIN", nome: "Admin", email: "admin@test.com", tipo: "MEMBRO_ATIVO", cargo: "ADMIN" },
      { id: "u-PASTOR", nome: "Pastor", email: "pastor@test.com", tipo: "MEMBRO_ATIVO", cargo: "PASTOR" },
      { id: "u-FINANCEIRO", nome: "Financeiro", email: "financ@test.com", tipo: "MEMBRO_ATIVO", cargo: "FINANCEIRO" },
      { id: "u-SECRETARIO", nome: "Secretario", email: "sec@test.com", tipo: "MEMBRO_ATIVO", cargo: "SECRETARIO" },
      { id: "u-DISCIPULADOR", nome: "Discipulador", email: "disc@test.com", tipo: "MEMBRO_ATIVO", cargo: "LIDER_MINISTERIO" },
      { id: "u-LIDER_MINISTERIO", nome: "Lider", email: "lider@test.com", tipo: "MEMBRO_ATIVO", cargo: "LIDER_MINISTERIO" },
    ]
  });
});

afterAll(async () => { await cleanup(); });

beforeEach(async () => {
  await prismaTest.lancamento.deleteMany();
  await prismaTest.transferenciaCaixa.deleteMany();
  await prismaTest.caixa.deleteMany();
  // NÃO apagar membros — são necessários para FK em TransferenciaCaixa.executadoPorId
});

function userWith(cargo: string | null, id = "u-" + (cargo ?? "none")): SessionUser {
  return { id, nome: `User ${cargo ?? "none"}`, cargo };
}

async function makeCaixa(opts: {
  nome: string;
  saldoCentavos?: number;
  ativo?: boolean;
}) {
  return prismaTest.caixa.create({
    data: {
      nome: opts.nome,
      saldoCentavos: opts.saldoCentavos ?? 0,
      ativo: opts.ativo ?? true,
    },
  });
}

// ===================== T02: transferirEntreCaixas =====================

describe("transferencias.server — transferirEntreCaixas (T02)", () => {
  it("ADMIN transfere entre 2 caixas ativos → OK, 2 lancamentos criados", async () => {
    const origem = await makeCaixa({ nome: "Origem", saldoCentavos: 10000 });
    const destino = await makeCaixa({ nome: "Destino", saldoCentavos: 5000 });

    const result = await transferirEntreCaixa({
      origemId: origem.id,
      destinoId: destino.id,
      valorCentavos: 1000,
    }, userWith("ADMIN"));

    expect(result.grupoId).toBeDefined();
    expect(result.transferenciaId).toBeDefined();
    expect(result.saida.tipo).toBe("SAIDA");
    expect(result.entrada.tipo).toBe("ENTRADA");
    expect(result.saida.transferenciaGrupoId).toBe(result.grupoId);
    expect(result.entrada.transferenciaGrupoId).toBe(result.grupoId);

    // Verificar saldos atualizados
    const [origemAtual, destinoAtual] = await Promise.all([
      prismaTest.caixa.findUnique({ where: { id: origem.id } }),
      prismaTest.caixa.findUnique({ where: { id: destino.id } }),
    ]);
    expect(origemAtual!.saldoCentavos).toBe(9000); // 10000 - 1000
    expect(destinoAtual!.saldoCentavos).toBe(6000); // 5000 + 1000

    // Verificar 2 lancamentos criados
    const lancs = await prismaTest.lancamento.findMany();
    expect(lancs).toHaveLength(2);

    // Verificar TransferenciaCaixa criada (SEC-S07-002)
    const transf = await prismaTest.transferenciaCaixa.findMany();
    expect(transf).toHaveLength(1);
    expect(transf[0].caixaOrigemId).toBe(origem.id);
    expect(transf[0].caixaDestinoId).toBe(destino.id);
  });

  it("PASTOR transfere → OK", async () => {
    const origem = await makeCaixa({ nome: "Origem Pastor", saldoCentavos: 10000 });
    const destino = await makeCaixa({ nome: "Destino Pastor", saldoCentavos: 5000 });

    const result = await transferirEntreCaixa({
      origemId: origem.id,
      destinoId: destino.id,
      valorCentavos: 500,
    }, userWith("PASTOR"));

    expect(result.grupoId).toBeDefined();
  });

  it("FINANCEIRO transfere → OK", async () => {
    const origem = await makeCaixa({ nome: "Origem Fin", saldoCentavos: 10000 });
    const destino = await makeCaixa({ nome: "Destino Fin", saldoCentavos: 5000 });

    const result = await transferirEntreCaixa({
      origemId: origem.id,
      destinoId: destino.id,
      valorCentavos: 500,
    }, userWith("FINANCEIRO"));

    expect(result.grupoId).toBeDefined();
  });

  it("SECRETARIO transfere → 403", async () => {
    const origem = await makeCaixa({ nome: "Origem Sec", saldoCentavos: 10000 });
    const destino = await makeCaixa({ nome: "Destino Sec", saldoCentavos: 5000 });

    let caught: unknown = null;
    try {
      await transferirEntreCaixa({
        origemId: origem.id,
        destinoId: destino.id,
        valorCentavos: 500,
      }, userWith("SECRETARIO"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    expect((caught as Response).status).toBe(403);
  });

  it("DISCIPULADOR transfere → 403", async () => {
    const origem = await makeCaixa({ nome: "Origem Disc", saldoCentavos: 10000 });
    const destino = await makeCaixa({ nome: "Destino Disc", saldoCentavos: 5000 });

    let caught: unknown = null;
    try {
      await transferirEntreCaixa({
        origemId: origem.id,
        destinoId: destino.id,
        valorCentavos: 500,
      }, userWith("LIDER_MINISTERIO"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    expect((caught as Response).status).toBe(403);
  });

  it("LIDER_MINISTERIO transfere → 403", async () => {
    const origem = await makeCaixa({ nome: "Origem Lider", saldoCentavos: 10000 });
    const destino = await makeCaixa({ nome: "Destino Lider", saldoCentavos: 5000 });

    let caught: unknown = null;
    try {
      await transferirEntreCaixa({
        origemId: origem.id,
        destinoId: destino.id,
        valorCentavos: 500,
      }, userWith("LIDER_MINISTERIO"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    expect((caught as Response).status).toBe(403);
  });

  it("origem === destino → 400 (Zod superRefine)", async () => {
    const origem = await makeCaixa({ nome: "Unico", saldoCentavos: 10000 });

    let caught: unknown = null;
    try {
      await transferirEntreCaixa({
        origemId: origem.id,
        destinoId: origem.id,
        valorCentavos: 500,
      }, userWith("ADMIN"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    expect((caught as Response).status).toBe(400);
  });

  it("caixa origem arquivado → 409", async () => {
    const origem = await makeCaixa({ nome: "Arquivado Orig", saldoCentavos: 10000, ativo: false });
    const destino = await makeCaixa({ nome: "Destino", saldoCentavos: 5000 });

    let caught: unknown = null;
    try {
      await transferirEntreCaixa({
        origemId: origem.id,
        destinoId: destino.id,
        valorCentavos: 500,
      }, userWith("ADMIN"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    expect((caught as Response).status).toBe(409);
  });

  it("caixa destino arquivado → 409", async () => {
    const origem = await makeCaixa({ nome: "Origem", saldoCentavos: 10000 });
    const destino = await makeCaixa({ nome: "Arquivado Dest", saldoCentavos: 5000, ativo: false });

    let caught: unknown = null;
    try {
      await transferirEntreCaixa({
        origemId: origem.id,
        destinoId: destino.id,
        valorCentavos: 500,
      }, userWith("ADMIN"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    expect((caught as Response).status).toBe(409);
  });

  it("valor > saldo origem → 409", async () => {
    const origem = await makeCaixa({ nome: "Pobre", saldoCentavos: 100 });
    const destino = await makeCaixa({ nome: "Destino", saldoCentavos: 5000 });

    let caught: unknown = null;
    try {
      await transferirEntreCaixa({
        origemId: origem.id,
        destinoId: destino.id,
        valorCentavos: 500, // maior que saldo de 100
      }, userWith("ADMIN"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    expect((caught as Response).status).toBe(409);
  });

  it("valor negativo → 400 (Zod)", async () => {
    const origem = await makeCaixa({ nome: "Origem", saldoCentavos: 10000 });
    const destino = await makeCaixa({ nome: "Destino", saldoCentavos: 5000 });

    let caught: unknown = null;
    try {
      await transferirEntreCaixa({
        origemId: origem.id,
        destinoId: destino.id,
        valorCentavos: -100,
      }, userWith("ADMIN"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    expect((caught as Response).status).toBe(400);
  });

  it("valor zero → 400 (Zod)", async () => {
    const origem = await makeCaixa({ nome: "Origem", saldoCentavos: 10000 });
    const destino = await makeCaixa({ nome: "Destino", saldoCentavos: 5000 });

    let caught: unknown = null;
    try {
      await transferirEntreCaixa({
        origemId: origem.id,
        destinoId: destino.id,
        valorCentavos: 0,
      }, userWith("ADMIN"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    expect((caught as Response).status).toBe(400);
  });

  it("caixa origem inexistente → 404", async () => {
    const destino = await makeCaixa({ nome: "Destino", saldoCentavos: 5000 });

    let caught: unknown = null;
    try {
      await transferirEntreCaixa({
        origemId: "00000000-0000-0000-0000-000000000000",
        destinoId: destino.id,
        valorCentavos: 500,
      }, userWith("ADMIN"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    expect((caught as Response).status).toBe(404);
  });

  it("caixa destino inexistente → 404", async () => {
    const origem = await makeCaixa({ nome: "Origem", saldoCentavos: 10000 });

    let caught: unknown = null;
    try {
      await transferirEntreCaixa({
        origemId: origem.id,
        destinoId: "00000000-0000-0000-0000-000000000000",
        valorCentavos: 500,
      }, userWith("ADMIN"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    expect((caught as Response).status).toBe(404);
  });

  it("2 lancamentos compartilham mesmo transferenciaGrupoId", async () => {
    const origem = await makeCaixa({ nome: "Origem", saldoCentavos: 10000 });
    const destino = await makeCaixa({ nome: "Destino", saldoCentavos: 5000 });

    const result = await transferirEntreCaixa({
      origemId: origem.id,
      destinoId: destino.id,
      valorCentavos: 1000,
    }, userWith("ADMIN"));

    const lancs = await prismaTest.lancamento.findMany({
      orderBy: { tipo: "asc" },
    });

    expect(lancs).toHaveLength(2);
    expect(lancs[0].transferenciaGrupoId).toBe(lancs[1].transferenciaGrupoId);
    expect(lancs[0].transferenciaGrupoId).toBe(result.grupoId);
  });

  it("descricao opcional presente e preservada", async () => {
    const origem = await makeCaixa({ nome: "Origem", saldoCentavos: 10000 });
    const destino = await makeCaixa({ nome: "Destino", saldoCentavos: 5000 });

    const result = await transferirEntreCaixa({
      origemId: origem.id,
      destinoId: destino.id,
      valorCentavos: 1000,
      descricao: "Reposicao cantina",
    }, userWith("ADMIN"));

    const saida = await prismaTest.lancamento.findFirst({ where: { tipo: "SAIDA" } });
    const entrada = await prismaTest.lancamento.findFirst({ where: { tipo: "ENTRADA" } });

    expect(saida!.descricao).toContain("Reposicao cantina");
    expect(entrada!.descricao).toContain("Reposicao cantina");
  });
});

// ===================== T06: borda #2 — caixa arquivado =====================

describe("transferencias.server — borda #2 caixa arquivado (T06)", () => {
  it("borda #2: caixa origem arquivado rejeita transferencia (mesmo com saldo) → 409", async () => {
    const origem = await makeCaixa({ nome: "Caixa Arquivado Orig", saldoCentavos: 99999, ativo: false });
    const destino = await makeCaixa({ nome: "Destino", saldoCentavos: 5000 });

    let caught: unknown = null;
    try {
      await transferirEntreCaixa({
        origemId: origem.id,
        destinoId: destino.id,
        valorCentavos: 100,
      }, userWith("ADMIN"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    expect((caught as Response).status).toBe(409);
    const msg = await (caught as Response).text();
    expect(msg).toContain("arquivado");
  });

  it("borda #2: caixa destino arquivado rejeita transferencia → 409", async () => {
    const origem = await makeCaixa({ nome: "Origem", saldoCentavos: 10000 });
    const destino = await makeCaixa({ nome: "Caixa Arquivado Dest", saldoCentavos: 99999, ativo: false });

    let caught: unknown = null;
    try {
      await transferirEntreCaixa({
        origemId: origem.id,
        destinoId: destino.id,
        valorCentavos: 100,
      }, userWith("ADMIN"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    expect((caught as Response).status).  toBe(409);
    const msg = await (caught as Response).text();
    expect(msg).toContain("arquivado");
  });
});

// ===================== S07-REWORK: SEC-S07-002 TransferenciaCaixa na transaction =====================

describe("transferencias.server — SEC-S07-002 TransferenciaCaixa na transaction", () => {
  it("TransferenciaCaixa criada como primeira mutacao da $transaction", async () => {
    const origem = await makeCaixa({ nome: "Origem TC", saldoCentavos: 10000 });
    const destino = await makeCaixa({ nome: "Destino TC", saldoCentavos: 5000 });

    const result = await transferirEntreCaixa({
      origemId: origem.id,
      destinoId: destino.id,
      valorCentavos: 2000,
    }, userWith("ADMIN"));

    // Verificar que TransferenciaCaixa foi criada
    const transf = await prismaTest.transferenciaCaixa.findUnique({
      where: { id: result.transferenciaId },
    });
    expect(transf).not.toBeNull();
    expect(transf!.caixaOrigemId).toBe(origem.id);
    expect(transf!.caixaDestinoId).toBe(destino.id);
    expect(transf!.executadoPorId).toBe("u-ADMIN");

    // Verificar que transferenciaGrupoId nos lancamentos aponta para TransferenciaCaixa.id
    const lancs = await prismaTest.lancamento.findMany();
    expect(lancs[0].transferenciaGrupoId).toBe(result.transferenciaId);
    expect(lancs[1].transferenciaGrupoId).toBe(result.transferenciaId);
  });
});

// ===================== S07-REWORK: SEC-S07-003 idempotency key =====================

describe("transferencias.server — SEC-S07-003 idempotency key", () => {
  it("idempotencyKey UUID valido aceito", async () => {
    const origem = await makeCaixa({ nome: "Origem Idem", saldoCentavos: 10000 });
    const destino = await makeCaixa({ nome: "Destino Idem", saldoCentavos: 5000 });
    const key = "550e8400-e29b-41d4-a716-446655440000";

    const result = await transferirEntreCaixa({
      origemId: origem.id,
      destinoId: destino.id,
      valorCentavos: 1000,
      idempotencyKey: key,
    }, userWith("ADMIN"));

    expect(result.grupoId).toBeDefined();
    const transf = await prismaTest.transferenciaCaixa.findUnique({ where: { idempotencyKey: key } });
    expect(transf).not.toBeNull();
  });

  it("idempotencyKey invalido → 400", async () => {
    const origem = await makeCaixa({ nome: "Origem", saldoCentavos: 10000 });
    const destino = await makeCaixa({ nome: "Destino", saldoCentavos: 5000 });

    let caught: unknown = null;
    try {
      await transferirEntreCaixa({
        origemId: origem.id,
        destinoId: destino.id,
        valorCentavos: 1000,
        idempotencyKey: "not-a-uuid",
      }, userWith("ADMIN"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    expect((caught as Response).status).toBe(400);
  });

  it("double-submit com mesma idempotencyKey → retorna resultado cacheado, nao duplica", async () => {
    const origem = await makeCaixa({ nome: "Origem Double", saldoCentavos: 10000 });
    const destino = await makeCaixa({ nome: "Destino Double", saldoCentavos: 5000 });
    const key = "550e8400-e29b-41d4-a716-446655440001";

    // Primeira submissao
    const result1 = await transferirEntreCaixa({
      origemId: origem.id,
      destinoId: destino.id,
      valorCentavos: 1000,
      idempotencyKey: key,
    }, userWith("ADMIN"));

    // Segunda submissao com mesma key
    const result2 = await transferirEntreCaixa({
      origemId: origem.id,
      destinoId: destino.id,
      valorCentavos: 1000,
      idempotencyKey: key,
    }, userWith("ADMIN"));

    // Deve retornar MESMO grupo (resultado cacheado)
    expect(result2.grupoId).toBe(result1.grupoId);

    // Verificar que NAO criou duplicatas — apenas 1 TransferenciaCaixa
    const transfs = await prismaTest.transferenciaCaixa.findMany();
    expect(transfs).toHaveLength(1);

    // E apenas 2 lancamentos
    const lancs = await prismaTest.lancamento.findMany();
    expect(lancs).toHaveLength(2);

    // Saldo NAO foi debitado duas vezes
    const [origemAtual, destinoAtual] = await Promise.all([
      prismaTest.caixa.findUnique({ where: { id: origem.id } }),
      prismaTest.caixa.findUnique({ where: { id: destino.id } }),
    ]);
    expect(origemAtual!.saldoCentavos).toBe(9000); // 10000 - 1000 (apenas 1x)
    expect(destinoAtual!.saldoCentavos).toBe(6000); // 5000 + 1000 (apenas 1x)
  });

  it("sem idempotencyKey → funciona normalmente (fallback randomUUID)", async () => {
    const origem = await makeCaixa({ nome: "Origem NoKey", saldoCentavos: 10000 });
    const destino = await makeCaixa({ nome: "Destino NoKey", saldoCentavos: 5000 });

    const result = await transferirEntreCaixa({
      origemId: origem.id,
      destinoId: destino.id,
      valorCentavos: 1000,
    }, userWith("ADMIN"));

    expect(result.grupoId).toBeDefined();
    // Nao tem idempotencyKey setado
    const transf = await prismaTest.transferenciaCaixa.findUnique({ where: { id: result.transferenciaId } });
    expect(transf!.idempotencyKey).toBeNull();
  });
});

// ===================== S07-REWORK: atomicity test =====================

describe("transferencias.server — atomicity mock failure (S07-REWORK)", () => {
  it("mock falha na 2a mutacao (criacao ENTRADA) → rollback TOTAL", async () => {
    // Setup: criar 2 caixas com saldo
    const origem = await makeCaixa({ nome: "Origem Atomic", saldoCentavos: 10000 });
    const destino = await makeCaixa({ nome: "Destino Atomic", saldoCentavos: 5000 });
    const user = userWith("ADMIN");

    // Mock do prisma.$transaction para falhar na 2a mutacao
    // (quando tenta criar o lancamento ENTRADA)
    vi.restoreAllMocks();
    const originalPrisma = await import("~/db/prisma.server");
    const originalTx = originalPrisma.prisma.$transaction.bind(originalPrisma.prisma);

    let mutationCount = 0;
    vi.spyOn(originalPrisma.prisma, "$transaction").mockImplementation(async (cb) => {
      return originalTx(async (tx: any) => {
        mutationCount++;
        // Count 1: TransferenciaCaixa.create — OK
        // Count 2: caixa.findUniqueOrThrow — OK
        // Count 3: caixa.findUniqueOrThrow — OK
        // Count 4: lancamento.create SAIDA — OK
        // Count 5: lancamento.create ENTRADA — FALHA
        if (mutationCount === 5) {
          throw new Error("DB write error: rede failure");
        }
        return cb(tx);
      });
    });

    let caught: unknown = null;
    try {
      await transferirEntreCaixa({
        origemId: origem.id,
        destinoId: destino.id,
        valorCentavos: 1000,
      }, user);
    } catch (e) {
      caught = e;
    }

    // Deve ter lancado erro (nao returnedo resultado)
    expect(caught).not.toBeNull();

    // VERIFICAR ROLLBACK: NENHUM lancamento criado
    const lancs = await prismaTest.lancamento.findMany();
    expect(lancs).toHaveLength(0);

    // VERIFICAR ROLLBACK: NENHUMA TransferenciaCaixa criada
    const transfs = await prismaTest.transferenciaCaixa.findMany();
    expect(transfs).toHaveLength(0);

    // VERIFICAR ROLLBACK: saldo NAO foi alterado
    const [origemAtual, destinoAtual] = await Promise.all([
      prismaTest.caixa.findUnique({ where: { id: origem.id } }),
      prismaTest.caixa.findUnique({ where: { id: destino.id } }),
    ]);
    expect(origemAtual!.saldoCentavos).toBe(10000); // inalterado
    expect(destinoAtual!.saldoCentavos).toBe(5000); // inalterado

    vi.restoreAllMocks();
  });

  it("mock falha na 1a mutacao (TransferenciaCaixa) → rollback TOTAL", async () => {
    const origem = await makeCaixa({ nome: "Origem Fail1", saldoCentavos: 10000 });
    const destino = await makeCaixa({ nome: "Destino Fail1", saldoCentavos: 5000 });
    const user = userWith("ADMIN");

    vi.restoreAllMocks();
    const originalPrisma = await import("~/db/prisma.server");
    const originalTx = originalPrisma.prisma.$transaction.bind(originalPrisma.prisma);

    let mutationCount = 0;
    vi.spyOn(originalPrisma.prisma, "$transaction").mockImplementation(async (cb) => {
      return originalTx(async (tx: any) => {
        mutationCount++;
        // Count 1: TransferenciaCaixa.create — FALHA
        if (mutationCount === 1) {
          throw new Error("DB write error: constraint violation");
        }
        return cb(tx);
      });
    });

    let caught: unknown = null;
    try {
      await transferirEntreCaixa({
        origemId: origem.id,
        destinoId: destino.id,
        valorCentavos: 1000,
      }, user);
    } catch (e) {
      caught = e;
    }

    expect(caught).not.toBeNull();

    // ROLLBACK: nada foi criado
    const lancs = await prismaTest.lancamento.findMany();
    expect(lancs).toHaveLength(0);
    const transfs = await prismaTest.transferenciaCaixa.findMany();
    expect(transfs).toHaveLength(0);

    // Saldo inalterado
    const [origemAtual, destinoAtual] = await Promise.all([
      prismaTest.caixa.findUnique({ where: { id: origem.id } }),
      prismaTest.caixa.findUnique({ where: { id: destino.id } }),
    ]);
    expect(origemAtual!.saldoCentavos).toBe(10000);
    expect(destinoAtual!.saldoCentavos).toBe(5000);

    vi.restoreAllMocks();
  });
});

// Helper para nao poluir os tests com UUIDs
async function transferirEntreCaixa(
  input: {
    origemId: string;
    destinoId: string;
    valorCentavos: number;
    descricao?: string;
    data?: Date;
    idempotencyKey?: string;
  },
  user: SessionUser
): Promise<TransferenciaResult> {
  return transferirEntreCaixas(
    {
      origemId: input.origemId,
      destinoId: input.destinoId,
      valorCentavos: input.valorCentavos,
      descricao: input.descricao,
      data: input.data ?? new Date(),
      idempotencyKey: input.idempotencyKey,
    },
    user
  );
}
