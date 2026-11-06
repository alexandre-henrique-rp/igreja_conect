/**
 * Testes para a rota /app/financeiro/lancamentos/novo.
 *
 * Cobre:
 * - Saída que deixa o caixa no negativo: operação permitida com sucesso (302) e saldo negativo persistido.
 * - Fallback ideal de erro: quando o caixa está arquivado ou ocorre erro, action retorna formError
 *   em vez de quebrar a aplicação (sem unhandled exception).
 * - Validação Zod: 422 com fieldErrors e defaultValues.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prismaTest, setupTestDb } from "../../../tests/helpers/db";
import { userContext } from "~/lib/user-context";
import type { SessionUser } from "~/lib/session.types";

let cleanup: () => Promise<void>;
let action: typeof import("./financeiro.lancamentos.novo").action;

beforeAll(async () => {
  cleanup = await setupTestDb("financeiro_lancamentos_novo");
  vi.resetModules();
  const mod = await import("./financeiro.lancamentos.novo");
  action = mod.action;
});

afterAll(async () => {
  await cleanup();
});

beforeEach(async () => {
  await prismaTest.alertaDestinatario.deleteMany();
  await prismaTest.alerta.deleteMany();
  await prismaTest.lancamento.deleteMany();
  await prismaTest.transferenciaCaixa.deleteMany();
  await prismaTest.caixa.deleteMany();
});

function makePostRequest(data: Record<string, string>): Request {
  const formData = new FormData();
  for (const [k, v] of Object.entries(data)) {
    formData.append(k, v);
  }
  return new Request("http://localhost/app/financeiro/lancamentos/novo", {
    method: "POST",
    body: formData,
  });
}

function makeContext(user: SessionUser) {
  return {
    get: () => user,
  } as unknown as { get: (key: unknown) => unknown };
}

const adminUser: SessionUser = {
  id: "u-admin",
  email: "admin@igreja.test",
  nome: "Admin",
  cargo: "ADMIN",
};

describe("financeiro.lancamentos.novo — action", () => {
  it("permite saída que deixa o caixa com saldo negativo e redireciona", async () => {
    // Caixa com R$ 100,00 de saldo (10000 centavos)
    const caixa = await prismaTest.caixa.create({
      data: {
        nome: "Caixa Operacional",
        saldoCentavos: 10000,
        ativo: true,
      },
    });

    // Saída de R$ 150,00 (15000 centavos) — antes bloqueava com 409
    const req = makePostRequest({
      tipo: "SAIDA",
      categoria: "DESPESA_OPERACIONAL",
      status: "PAGO",
      valorDisplay: "150,00",
      caixaId: caixa.id,
      dataCompetencia: "2026-11-06",
      descricao: "Conta urgente maior que saldo",
    });

    const response = await action({
      request: req,
      context: makeContext(adminUser),
      params: {},
    } as any);

    // Sucesso gera redirect para /app/financeiro com feedback
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
    expect((response as Response).headers.get("Location")).toBe("/app/financeiro?sucesso=lancamento_criado");

    // Verifica que o saldo agora é negativo: 10000 - 15000 = -5000 centavos (-R$ 50,00)
    const caixaAtualizado = await prismaTest.caixa.findUnique({
      where: { id: caixa.id },
    });
    expect(caixaAtualizado?.saldoCentavos).toBe(-5000);

    // Verifica que o lançamento foi criado
    const lancamento = await prismaTest.lancamento.findFirst({
      where: { caixaId: caixa.id },
    });
    expect(lancamento).not.toBeNull();
    expect(lancamento?.tipo).toBe("SAIDA");
    expect(lancamento?.valorCentavos).toBe(15000);
  });

  it("retorna fallback ideal com formError em vez de quebrar quando caixa está arquivado", async () => {
    const caixaArquivado = await prismaTest.caixa.create({
      data: {
        nome: "Caixa Inativo",
        saldoCentavos: 5000,
        ativo: false,
      },
    });

    const req = makePostRequest({
      tipo: "SAIDA",
      categoria: "DESPESA_OPERACIONAL",
      status: "PAGO",
      valorDisplay: "20,00",
      caixaId: caixaArquivado.id,
      dataCompetencia: "2026-11-06",
      descricao: "Tentativa em caixa arquivado",
    });

    const response = await action({
      request: req,
      context: makeContext(adminUser),
      params: {},
    } as any);

    // Deve retornar 409 com formError e defaultValues, sem estourar exceção não tratada
    expect(response).toBeDefined();
    const result = response as any;
    expect(result.init?.status ?? result.status).toBe(409);
    expect(result.data?.formError).toMatch(/está arquivado/);
    expect(result.data?.defaultValues?.valorDisplay).toBe("20,00");
  });

  it("retorna 422 com fieldErrors se dados forem inválidos", async () => {
    const req = makePostRequest({
      tipo: "SAIDA",
      categoria: "DESPESA_OPERACIONAL",
      status: "PAGO",
      valorDisplay: "invalido",
      caixaId: "",
      dataCompetencia: "",
    });

    const response = await action({
      request: req,
      context: makeContext(adminUser),
      params: {},
    } as any);

    expect(response).toBeDefined();
    const result = response as any;
    expect(result.init?.status ?? result.status).toBe(422);
    expect(result.data?.fieldErrors).toBeDefined();
  });
});
