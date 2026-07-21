/**
 * Testes de app/lib/caixas.server.ts (S06-T02, T03, T04).
 *
 * Cobre:
 * - T02: listarCaixas (filtros ativo, q, RBAC, 0 caixas)
 * - T03: assertCanManageCaixa (rbac.server.ts) + criarCaixa
 * - T04: arquivarCaixa + reabrirCaixa
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prismaTest, setupTestDb } from "../../tests/helpers/db";
import type { SessionUser } from "./session.types";

let cleanup: () => Promise<void>;
let listarCaixas: typeof import("./caixas.server").listarCaixas;
let criarCaixa: typeof import("./caixas.server").criarCaixa;
let arquivarCaixa: typeof import("./caixas.server").arquivarCaixa;
let reabrirCaixa: typeof import("./caixas.server").reabrirCaixa;

beforeAll(async () => {
  cleanup = await setupTestDb();
  vi.resetModules();
  const mod = await import("./caixas.server");
  listarCaixas = mod.listarCaixas;
  criarCaixa = mod.criarCaixa;
  arquivarCaixa = mod.arquivarCaixa;
  reabrirCaixa = mod.reabrirCaixa;
});

afterAll(async () => { await cleanup(); });

beforeEach(async () => {
  // Limpa tabelas na ordem correta
  await prismaTest.lancamento.deleteMany();
  await prismaTest.transferenciaCaixa.deleteMany();
  await prismaTest.caixa.deleteMany();
});

function userWith(cargo: string | null, id = "u-" + (cargo ?? "none")): SessionUser {
  return { id, nome: `User ${cargo ?? "none"}`, cargo };
}

async function makeCaixa(opts: {
  nome: string;
  saldoCentavos?: number;
  ativo?: boolean;
}): Promise<{ id: string; nome: string; saldoCentavos: number; ativo: boolean; createdAt: Date }> {
  return prismaTest.caixa.create({
    data: {
      nome: opts.nome,
      saldoCentavos: opts.saldoCentavos ?? 0,
      ativo: opts.ativo ?? true,
    },
  });
}

// ===================== T02 — listarCaixas =====================

describe("caixas.server — listarCaixas (T02)", () => {
  it("apenasAtivos=true: retorna só caixas ativos", async () => {
    await makeCaixa({ nome: "Ativo", ativo: true });
    await makeCaixa({ nome: "Arquivado", ativo: false });

    const result = await listarCaixas({ apenasAtivos: true }, userWith("ADMIN"));
    expect(result.ativos).toHaveLength(1);
    expect(result.ativos[0].nome).toBe("Ativo");
    expect(result.arquivados).toHaveLength(0);
  });

  it("apenasAtivos=false: retorna todos (inclui arquivados)", async () => {
    await makeCaixa({ nome: "Geral", ativo: true });
    await makeCaixa({ nome: "Antigo", ativo: false });

    const result = await listarCaixas({ apenasAtivos: false }, userWith("ADMIN"));
    expect(result.ativos).toHaveLength(1);
    expect(result.arquivados).toHaveLength(1);
  });

  it("apenasAtivos omitido (default): retorna apenas ativos", async () => {
    await makeCaixa({ nome: "Geral", ativo: true });
    await makeCaixa({ nome: "Antigo", ativo: false });

    const result = await listarCaixas({}, userWith("ADMIN"));
    expect(result.ativos).toHaveLength(1);
    expect(result.ativos[0].nome).toBe("Geral");
    expect(result.arquivados).toHaveLength(0);
  });

  it("filtro q: busca textual por nome (case-insensitive)", async () => {
    await makeCaixa({ nome: "Caixa Geral", ativo: true });
    await makeCaixa({ nome: "Cantina", ativo: true });

    const result = await listarCaixas({ q: "Geral" }, userWith("ADMIN"));
    expect(result.ativos).toHaveLength(1);
    expect(result.ativos[0].nome).toBe("Caixa Geral");
  });

  it("SECRETARIO: listarCaixas OK (assertCanSeeFinancialModule aceita 4 perfis)", async () => {
    // Após SEC-001/SEC-002 (S06-REWORK): SECRETARIO pode listar caixas (não dízimos)
    await makeCaixa({ nome: "Geral SECRETARIO", saldoCentavos: 0 });
    const result = await listarCaixas({}, userWith("SECRETARIO"));
    expect(result.ativos.length).toBeGreaterThanOrEqual(1);
  });

  it("DISCIPULADOR: 403 (assertCanSeeFinancials bloqueia)", async () => {
    let caught: unknown = null;
    try {
      await listarCaixas({}, userWith("LIDER_MINISTERIO"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(403);
    }
  });

  it("0 caixas: retorna { ativos: [], arquivados: [] }", async () => {
    const result = await listarCaixas({}, userWith("ADMIN"));
    expect(result).toEqual({ ativos: [], arquivados: [] });
  });

  it("ordem alfabética por nome", async () => {
    await makeCaixa({ nome: "Zzz", ativo: true });
    await makeCaixa({ nome: "Aaa", ativo: true });

    const result = await listarCaixas({}, userWith("ADMIN"));
    expect(result.ativos[0].nome).toBe("Aaa");
    expect(result.ativos[1].nome).toBe("Zzz");
  });
});

// ===================== T03 — criarCaixa =====================

describe("caixas.server — criarCaixa (T03)", () => {
  it("ADMIN cria caixa com ativo=true, saldo=0", async () => {
    const caixa = await criarCaixa({ nome: "Cantina" }, userWith("ADMIN")) as { nome: string; ativo: boolean; saldoCentavos: number };
    expect(caixa.nome).toBe("Cantina");
    expect(caixa.ativo).toBe(true);
    expect(caixa.saldoCentavos).toBe(0);
  });

  it("SECRETARIO NÃO pode criar caixa (403)", async () => {
    let caught: unknown = null;
    try {
      await criarCaixa({ nome: "Cantina" }, userWith("SECRETARIO"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(403);
    }
  });

  it("DISCIPULADOR NÃO pode criar caixa (403)", async () => {
    let caught: unknown = null;
    try {
      await criarCaixa({ nome: "Cantina" }, userWith("LIDER_MINISTERIO"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(403);
    }
  });

  it("nome duplicado: 409 (unique constraint)", async () => {
    await makeCaixa({ nome: "Caixa Geral" });
    let caught: unknown = null;
    try {
      await criarCaixa({ nome: "Caixa Geral" }, userWith("ADMIN"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(409);
    }
  });

  it("nome < 2 chars: 422 (Zod min)", async () => {
    let caught: unknown = null;
    try {
      await criarCaixa({ nome: "X" }, userWith("ADMIN"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(422);
    }
  });

  it("campo extra rejeitado: 422 (Zod strict)", async () => {
    let caught: unknown = null;
    try {
      await criarCaixa({ nome: "Cantina", nomeExtra: "x" } as any, userWith("ADMIN"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(422);
    }
  });
});

// ===================== T04 — arquivarCaixa + reabrirCaixa =====================

describe("caixas.server — arquivarCaixa (T04)", () => {
  it("arquivar caixa ativo → ativo=false, saldo preservado", async () => {
    const caixa = await makeCaixa({ nome: "Geral", saldoCentavos: 5000 });
    const result = await arquivarCaixa(caixa.id, userWith("ADMIN")) as { ativo: boolean; saldoCentavos: number };
    expect(result.ativo).toBe(false);
    expect(result.saldoCentavos).toBe(5000);
  });

  it("arquivar caixa já arquivado → 409 (idempotência)", async () => {
    const caixa = await makeCaixa({ nome: "Geral", ativo: false });
    let caught: unknown = null;
    try {
      await arquivarCaixa(caixa.id, userWith("ADMIN"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(409);
    }
  });

  it("SECRETARIO não pode arquivar (403)", async () => {
    const caixa = await makeCaixa({ nome: "Geral" });
    let caught: unknown = null;
    try {
      await arquivarCaixa(caixa.id, userWith("SECRETARIO"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(403);
    }
  });

  it("id inexistente → 404", async () => {
    let caught: unknown = null;
    try {
      await arquivarCaixa("00000000-0000-0000-0000-000000000000", userWith("ADMIN"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(404);
    }
  });
});

describe("caixas.server — reabrirCaixa (T04)", () => {
  it("reabrir caixa arquivado → ativo=true, saldo preservado", async () => {
    const caixa = await makeCaixa({ nome: "Arquivado", ativo: false, saldoCentavos: 3000 });
    const result = await reabrirCaixa(caixa.id, userWith("ADMIN")) as { ativo: boolean; saldoCentavos: number };
    expect(result.ativo).toBe(true);
    expect(result.saldoCentavos).toBe(3000);
  });

  it("reabrir caixa já ativo → 409 (idempotência)", async () => {
    const caixa = await makeCaixa({ nome: "Ativo" });
    let caught: unknown = null;
    try {
      await reabrirCaixa(caixa.id, userWith("ADMIN"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(409);
    }
  });

  it("SECRETARIO não pode reabrir (403)", async () => {
    const caixa = await makeCaixa({ nome: "Arquivado", ativo: false });
    let caught: unknown = null;
    try {
      await reabrirCaixa(caixa.id, userWith("SECRETARIO"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(403);
    }
  });

  it("id inexistente → 404", async () => {
    let caught: unknown = null;
    try {
      await reabrirCaixa("00000000-0000-0000-0000-000000000000", userWith("ADMIN"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    if (caught instanceof Response) {
      expect(caught.status).toBe(404);
    }
  });
});

// ==================== T08: getCaixaDetalhe coverage gaps (S06-REWORK) ====================

describe("caixas.server — getCaixaDetalhe (T08 coverage gaps)", () => {
  let getCaixaDetalhe: typeof import("./caixas.server").getCaixaDetalhe;

  beforeAll(async () => {
    vi.resetModules();
    const mod = await import("./caixas.server");
    getCaixaDetalhe = mod.getCaixaDetalhe;
  });

  it("Caixa inexistente → null (route retorna 404)", async () => {
    const result = await getCaixaDetalhe(
      "00000000-0000-0000-0000-000000000000",
      {},
      userWith("ADMIN")
    );
    expect(result).toBeNull();
  });

  it("getCaixaDetalhe com SECRETARIO → OK (assertCanSeeFinancialModule)", async () => {
    // Após SEC-001/SEC-002: SECRETARIO pode ver detalhe de caixa (não dízimos)
    const caixa = await makeCaixa({ nome: "Geral Detalhe SECRETARIO", saldoCentavos: 1000 });
    const result = await getCaixaDetalhe(caixa.id, {}, userWith("SECRETARIO"));
    expect(result).not.toBeNull();
    expect(result!.caixa.nome).toBe("Geral Detalhe SECRETARIO");
  });
});

// ==================== listarCaixas paraSelect coverage (S06-REWORK) ====================

describe("caixas.server — listarCaixas para select (coverage)", () => {
  let listarCaixasParaSelect: typeof import("./caixas.server").listarCaixasParaSelect;

  beforeAll(async () => {
    vi.resetModules();
    const mod = await import("./caixas.server");
    listarCaixasParaSelect = mod.listarCaixasParaSelect;
  });

  it("SECRETARIO pode usar listarCaixasParaSelect (4 perfis)", async () => {
    const result = await listarCaixasParaSelect(userWith("SECRETARIO"));
    expect(Array.isArray(result)).toBe(true);
  });

  it("listarCaixas com apenasAtivos=false retorna arquivados (cobertura)", async () => {
    await makeCaixa({ nome: "Ativo", ativo: true });
    await makeCaixa({ nome: "Arquivado", ativo: false });
    const { listarCaixas } = await import("./caixas.server");
    const result = await listarCaixas({ apenasAtivos: false }, userWith("ADMIN"));
    expect(result.arquivados).toHaveLength(1);
  });
});

// ==================== S07-T07: listarCaixasParaTransferencia ====================

describe("caixas.server — listarCaixasParaTransferencia (S07-T07)", () => {
  let listarCaixasParaTransferencia: typeof import("./caixas.server").listarCaixasParaTransferencia;

  beforeAll(async () => {
    vi.resetModules();
    const mod = await import("./caixas.server");
    listarCaixasParaTransferencia = mod.listarCaixasParaTransferencia;
  });

  it("ADMIN lista caixas ativos para transferencia", async () => {
    await makeCaixa({ nome: "Caixa Ativo", saldoCentavos: 1000, ativo: true });
    await makeCaixa({ nome: "Caixa Inativo", saldoCentavos: 2000, ativo: false });

    const result = await listarCaixasParaTransferencia(userWith("ADMIN"));
    expect(result).toHaveLength(1);
    expect(result[0].nome).toBe("Caixa Ativo");
  });

  it("PASTOR lista caixas ativos para transferencia", async () => {
    await makeCaixa({ nome: "Caixa Pastor", saldoCentavos: 1000 });
    const result = await listarCaixasParaTransferencia(userWith("PASTOR"));
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("FINANCEIRO lista caixas ativos para transferencia", async () => {
    await makeCaixa({ nome: "Caixa Fin", saldoCentavos: 1000 });
    const result = await listarCaixasParaTransferencia(userWith("FINANCEIRO"));
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("SECRETARIO NAO pode listar caixas para transferencia (403)", async () => {
    let caught: unknown = null;
    try {
      await listarCaixasParaTransferencia(userWith("SECRETARIO"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    expect((caught as Response).status).toBe(403);
  });

  it("DISCIPULADOR NAO pode listar caixas para transferencia (403)", async () => {
    let caught: unknown = null;
    try {
      await listarCaixasParaTransferencia(userWith("LIDER_MINISTERIO"));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Response);
    expect((caught as Response).status).toBe(403);
  });

  it("retorna saldoCentavos dos caixas", async () => {
    await makeCaixa({ nome: "Caixa Com Saldo", saldoCentavos: 5432 });
    const result = await listarCaixasParaTransferencia(userWith("ADMIN"));
    expect(result[0].saldoCentavos).toBe(5432);
  });

  it("0 caixas: retorna array vazio", async () => {
    const result = await listarCaixasParaTransferencia(userWith("ADMIN"));
    expect(result).toEqual([]);
  });
});
