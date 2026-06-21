import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prismaTest, setupTestDb } from "../../../tests/helpers/db";
import { hashPassword } from "~/lib/auth.server";

let cleanup: () => Promise<void>;
let loader: typeof import("./estoque._index").loader;
let action: typeof import("./estoque._index").action;

beforeAll(async () => {
  // Setup isolated test database instance
  cleanup = await setupTestDb();
  vi.resetModules();
  const mod = await import("./estoque._index");
  loader = mod.loader;
  action = mod.action;
});

afterAll(async () => {
  await cleanup();
});

beforeEach(async () => {
  // Clear tables
  await prismaTest.alertaDestinatario.deleteMany();
  await prismaTest.alerta.deleteMany();
  await prismaTest.ministerioMembro.deleteMany();
  await prismaTest.movimentacaoEstoque.deleteMany();
  await prismaTest.manutencaoAtivo.deleteMany();
  await prismaTest.lancamento.deleteMany();
  await prismaTest.transferenciaCaixa.deleteMany();
  await prismaTest.session.deleteMany();
  await prismaTest.itemEstoque.deleteMany();
  await prismaTest.membro.updateMany({ data: { discipuladorId: null } });
  await prismaTest.membro.deleteMany();
});

// Helper to construct request objects
function makeRequest(url: string, method: string = "GET", data?: Record<string, string>): Request {
  if (method === "POST" && data) {
    const formData = new FormData();
    for (const [k, v] of Object.entries(data)) {
      formData.append(k, v);
    }
    return new Request(url, { method: "POST", body: formData });
  }
  return new Request(url, { method });
}

// Helper to construct route arguments
function routeArgs(request: Request, user: any) {
  return {
    request,
    params: {},
    context: {
      get: (key: any) => {
        return user;
      },
    },
  } as any;
}

async function createAdminUser() {
  return await prismaTest.membro.create({
    data: {
      nome: "Admin Test",
      email: `admin-${Date.now()}@igreja.local`,
      tipo: "MEMBRO_ATIVO",
      cargo: "ADMIN",
      senhaHash: await hashPassword("admin123"),
    },
  });
}

describe("estoque page — loader & actions tests", () => {
  it("loader: auto-seeds mock items when database is empty", async () => {
    const admin = await createAdminUser();
    const req = makeRequest("http://localhost/app/estoque");
    const args = routeArgs(req, admin);

    const res = await loader(args);
    expect(res.items.length).toBe(4);
    expect(res.kpis.total).toBe(4);
    expect(res.kpis.estoqueBaixo).toBe(2); // Café (3) and Detergente (2) are <= 5
  });

  it("loader: filters items by name query (q)", async () => {
    const admin = await createAdminUser();
    
    // Seed database manually or let it auto-seed
    const reqSeed = makeRequest("http://localhost/app/estoque");
    await loader(routeArgs(reqSeed, admin));

    // Request with search query
    const reqFilter = makeRequest("http://localhost/app/estoque?q=Papel");
    const res = await loader(routeArgs(reqFilter, admin));

    expect(res.items.length).toBe(1);
    expect(res.items[0].nome).toContain("Papel");
  });

  it("loader: filters items by tipo", async () => {
    const admin = await createAdminUser();
    const reqSeed = makeRequest("http://localhost/app/estoque");
    await loader(routeArgs(reqSeed, admin));

    // Request with tipo filter (PATRIMONIO = only Cabo XLR)
    const reqFilter = makeRequest("http://localhost/app/estoque?tipo=PATRIMONIO");
    const res = await loader(routeArgs(reqFilter, admin));

    expect(res.items.length).toBe(1);
    expect(res.items[0].tipo).toBe("PATRIMONIO");
  });

  it("action: cria um novo produto no estoque", async () => {
    const admin = await createAdminUser();
    const request = makeRequest("http://localhost/app/estoque", "POST", {
      intent: "criar",
      nome: "Biscoito Cream Cracker (Pct)",
      tipo: "CONSUMO",
      quantidade: "15",
      quantidadeMinima: "8",
      localizacaoFisica: "Cozinha",
      descricao: "Lanche para a escola bíblica dominical",
    });

    const res = await action(routeArgs(request, admin));
    expect(res?.success).toBe(true);

    const item = await prismaTest.itemEstoque.findFirst({
      where: { nome: "Biscoito Cream Cracker (Pct)" },
    });
    expect(item).not.toBeNull();
    expect(item?.quantidade).toBe(15);
    expect(item?.quantidadeMinima).toBe(8);
  });

  it("action: edita um produto no estoque", async () => {
    const admin = await createAdminUser();
    const item = await prismaTest.itemEstoque.create({
      data: {
        nome: "Refri Lata",
        tipo: "CONSUMO",
        quantidade: 20,
        quantidadeMinima: 5,
        localizacaoFisica: "Copa",
      },
    });

    const request = makeRequest("http://localhost/app/estoque", "POST", {
      intent: "editar",
      id: item.id,
      nome: "Refri Lata (Alterado)",
      tipo: "CONSUMO",
      quantidade: "18",
      quantidadeMinima: "12",
      localizacaoFisica: "Cozinha",
      descricao: "Refrigerante lata para eventos",
    });

    const res = await action(routeArgs(request, admin));
    expect(res?.success).toBe(true);

    const updatedItem = await prismaTest.itemEstoque.findUnique({
      where: { id: item.id },
    });
    expect(updatedItem).not.toBeNull();
    expect(updatedItem?.nome).toBe("Refri Lata (Alterado)");
    expect(updatedItem?.quantidade).toBe(18);
    expect(updatedItem?.quantidadeMinima).toBe(12);
    expect(updatedItem?.localizacaoFisica).toBe("Cozinha");
  });

  it("action: registra uma movimentação de ENTRADA no estoque", async () => {
    const admin = await createAdminUser();
    const item = await prismaTest.itemEstoque.create({
      data: {
        nome: "Caderno Pequeno",
        tipo: "CONSUMO",
        quantidade: 10,
        localizacaoFisica: "Escritório",
      },
    });

    const request = makeRequest("http://localhost/app/estoque", "POST", {
      intent: "movimentacao",
      itemEstoqueId: item.id,
      tipo: "ENTRADA",
      quantidade: "5",
      data: "2026-06-20",
      nomeRetirante: "Secretário Teste",
      observacao: "Doação recebida de papelaria local",
    });

    const res = await action(routeArgs(request, admin));
    expect(res?.success).toBe(true);

    const updatedItem = await prismaTest.itemEstoque.findUnique({
      where: { id: item.id },
    });
    expect(updatedItem?.quantidade).toBe(15); // 10 + 5
  });

  it("action: registra uma movimentação de SAÍDA no estoque", async () => {
    const admin = await createAdminUser();
    const item = await prismaTest.itemEstoque.create({
      data: {
        nome: "Vassoura de Nylon",
        tipo: "CONSUMO",
        quantidade: 8,
        localizacaoFisica: "Limpeza",
      },
    });

    const request = makeRequest("http://localhost/app/estoque", "POST", {
      intent: "movimentacao",
      itemEstoqueId: item.id,
      tipo: "SAIDA",
      quantidade: "3",
      data: "2026-06-20",
      nomeRetirante: "Equipe de Limpeza",
      observacao: "Uso no templo sede",
    });

    const res = await action(routeArgs(request, admin));
    expect(res?.success).toBe(true);

    const updatedItem = await prismaTest.itemEstoque.findUnique({
      where: { id: item.id },
    });
    expect(updatedItem?.quantidade).toBe(5); // 8 - 3
  });

  it("action: rejeita SAÍDA caso o estoque seja insuficiente", async () => {
    const admin = await createAdminUser();
    const item = await prismaTest.itemEstoque.create({
      data: {
        nome: "Cafeteira Elétrica",
        tipo: "PATRIMONIO",
        quantidade: 1,
        localizacaoFisica: "Cozinha",
      },
    });

    const request = makeRequest("http://localhost/app/estoque", "POST", {
      intent: "movimentacao",
      itemEstoqueId: item.id,
      tipo: "SAIDA",
      quantidade: "3", // Exceeds stock (1)
      data: "2026-06-20",
      nomeRetirante: "Pr Ricardo Silva",
      observacao: "Uso no gabinete",
    });

    const res = await action(routeArgs(request, admin));
    expect(res?.success).toBe(false);
    expect(res?.error).toContain("Quantidade insuficiente em estoque");

    // Quantity should remain 1
    const unchangedItem = await prismaTest.itemEstoque.findUnique({
      where: { id: item.id },
    });
    expect(unchangedItem?.quantidade).toBe(1);
  });

  it("action: arquiva um produto do estoque (soft-delete)", async () => {
    const admin = await createAdminUser();
    const item = await prismaTest.itemEstoque.create({
      data: {
        nome: "Lápis de Escrever",
        tipo: "CONSUMO",
        quantidade: 30,
        localizacaoFisica: "Escritório",
      },
    });

    const request = makeRequest("http://localhost/app/estoque", "POST", {
      intent: "excluir",
      id: item.id,
    });

    const res = await action(routeArgs(request, admin));
    expect(res?.success).toBe(true);

    // Soft-delete: item deve existir com ativo=false
    const arquivadoItem = await prismaTest.itemEstoque.findUnique({
      where: { id: item.id },
    });
    expect(arquivadoItem).not.toBeNull();
    expect(arquivadoItem?.ativo).toBe(false);
  });
});
