/**
 * Teste de app/lib/dashboard.server.ts (S04-T09).
 *
 * Cobre:
 *  - getDashboardData: ADMIN vê todos os counts
 *  - getDashboardData: DISCIPULADOR vê apenas seus discípulos (exceto alertas)
 *  - Últimos 5 visitantes
 *  - Membros ativos, visitantes do mês, alertas não lidos
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prismaTest, setupTestDb } from "../../tests/helpers/db";
import type { SessionUser } from "./session.types";

let cleanup: () => Promise<void>;
let getDashboardData: typeof import("./dashboard.server").getDashboardData;

beforeAll(async () => {
  cleanup = await setupTestDb("dashboard.server");
  vi.resetModules();
  const mod = await import("./dashboard.server");
  getDashboardData = mod.getDashboardData;
});

afterAll(async () => { await cleanup(); });

beforeEach(async () => {
  await prismaTest.alertaDestinatario.deleteMany();
  await prismaTest.alerta.deleteMany();
  await prismaTest.configuracaoGeral.deleteMany();
  await prismaTest.ministerioMembro.deleteMany();
  await prismaTest.ministerio.deleteMany();
  await prismaTest.membro.updateMany({ data: { discipuladorId: null } });
  await prismaTest.membro.deleteMany();
});

// ----------------- helpers -----------------

function adminUser(): SessionUser {
  return { id: "u-admin", nome: "Admin", cargo: "ADMIN" };
}

function discipuladorUser(id: string): SessionUser {
  return { id, nome: "Discipulador", cargo: "LIDER_MINISTERIO" };
}

async function makeMembro(
  nome: string,
  opts: {
    tipo?: "VISITANTE" | "CONGREGADO" | "MEMBRO_ATIVO";
    discipuladorId?: string | null;
    createdAt?: Date;
  } = {}
): Promise<{ id: string; nome: string; tipo: string; createdAt: Date }> {
  const m = await prismaTest.membro.create({
    data: {
      nome,
      tipo: opts.tipo ?? "MEMBRO_ATIVO",
      discipuladorId: opts.discipuladorId ?? null,
      createdAt: opts.createdAt ?? new Date(),
    },
  });
  return m;
}

// ----------------- getDashboardData -----------------

describe("dashboard.server — getDashboardData", () => {
  it("ADMIN: retorna counts + últimos visitantes + saldo total + alertas estoque + contribuições", async () => {
    // 2 membros ativos
    await makeMembro("Ativo 1", { tipo: "MEMBRO_ATIVO" });
    await makeMembro("Ativo 2", { tipo: "MEMBRO_ATIVO" });
    // 1 visitante do mês
    const visitante = await makeMembro("Visitante 1", {
      tipo: "VISITANTE",
      createdAt: new Date(),
    });
    // 1 alerta não lido para admin
    const admin = await makeMembro("Admin", { tipo: "MEMBRO_ATIVO" });
    await prismaTest.alerta.create({
      data: {
        titulo: "Alerta",
        mensagem: "Teste",
        destinatarios: { create: { membroId: admin.id } },
      },
    });

    // Criar caixas ativos
    const caixa = await prismaTest.caixa.create({
      data: { nome: "Caixa Geral", saldoCentavos: 150000, ativo: true },
    });
    await prismaTest.caixa.create({
      data: { nome: "Caixa Cantina", saldoCentavos: 50000, ativo: true },
    });
    // Caixa inativo (não deve contar)
    await prismaTest.caixa.create({
      data: { nome: "Caixa Antigo", saldoCentavos: 90000, ativo: false },
    });

    // Criar item estoque baixo (quantidade <= 5)
    await prismaTest.itemEstoque.create({
      data: { nome: "Papel", tipo: "CONSUMO", quantidade: 3 },
    });
    // Criar item estoque normal (não deve contar)
    await prismaTest.itemEstoque.create({
      data: { nome: "Copo", tipo: "CONSUMO", quantidade: 10 },
    });

    // Criar lançamentos (contribuições)
    await prismaTest.lancamento.create({
      data: {
        tipo: "ENTRADA",
        categoria: "DIZIMO",
        valorCentavos: 10000,
        descricao: "Dízimo Teste",
        caixaId: caixa.id,
        membroId: admin.id,
      },
    });

    const data = await getDashboardData({
      id: admin.id,
      nome: "Admin",
      cargo: "ADMIN",
    });

    expect(data.membrosAtivos).toBe(4); // total members in the system
    expect(data.visitantesMes).toBe(1);
    expect(data.alertasNaoLidos).toBe(1);
    expect(data.ultimosVisitantes).toHaveLength(1);
    expect(data.ultimosVisitantes[0].id).toBe(visitante.id);

    // Novos campos
    expect(data.saldoTotalCentavos).toBe(200000); // 150000 + 50000
    expect(data.alertasEstoque).toBe(1); // Papel
    expect(data.ultimasContribuicoes).toHaveLength(1);
    expect(data.ultimasContribuicoes[0].valorCentavos).toBe(10000);
    expect(data.ultimasContribuicoes[0].contribuinte).toBe("Admin");
    expect(data.ultimasContribuicoes[0].tipo).toBe("DÍZIMO");
  });

  it("DISCIPULADOR: filtra membros por discipuladorId", async () => {
    const disc = await makeMembro("Disc", { tipo: "MEMBRO_ATIVO" });
    await makeMembro("Discípulo 1", { discipuladorId: disc.id });
    await makeMembro("Discípulo 2", { discipuladorId: disc.id });
    await makeMembro("Fora de Escopo", { tipo: "MEMBRO_ATIVO" }); // não vê

    const data = await getDashboardData(discipuladorUser(disc.id));

    expect(data.membrosAtivos).toBe(3); // disc + 2 discípulos
    expect(data.ultimosVisitantes).toHaveLength(0); // nenhum visitante dos seus discípulos
  });

  it("DISCIPULADOR: alertasNaoLidos NÃO filtra por discipuladorId (é por destinatário)", async () => {
    const disc = await makeMembro("Disc", { tipo: "MEMBRO_ATIVO" });
    // Alerta para o discipulador
    await prismaTest.alerta.create({
      data: {
        titulo: "Alerta do disc",
        mensagem: "Teste",
        destinatarios: { create: { membroId: disc.id } },
      },
    });

    const data = await getDashboardData({ id: disc.id, nome: "Disc", cargo: "LIDER_MINISTERIO" });

    expect(data.alertasNaoLidos).toBe(1);
  });

  it("últimos 5 visitantes: ordenado por createdAt desc, take 5", async () => {
    // Cria 7 visitantes
    const ids: string[] = [];
    for (let i = 0; i < 7; i++) {
      const m = await makeMembro(`Visitante ${i}`, {
        tipo: "VISITANTE",
        createdAt: new Date(Date.now() + i * 1000),
      });
      ids.push(m.id);
    }

    const data = await getDashboardData(adminUser());

    expect(data.ultimosVisitantes).toHaveLength(5);
    // Últimos 5 → os últimos criados (índices 2..6)
    expect(data.ultimosVisitantes[0].id).toBe(ids[6]);
    expect(data.ultimosVisitantes[4].id).toBe(ids[2]);
  });

  it("sem visitantes no mês → 0", async () => {
    const data = await getDashboardData(adminUser());
    expect(data.visitantesMes).toBe(0);
  });

  it("sem alertas → 0", async () => {
    await makeMembro("Só Membro", { tipo: "MEMBRO_ATIVO" });
    const data = await getDashboardData(adminUser());
    expect(data.alertasNaoLidos).toBe(0);
  });
});
