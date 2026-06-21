import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";
import { sessionCookie } from "../app/lib/session.server";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const RESULTS_DIR = path.join(__dirname, "results");
const RESPONSES_DIR = path.join(RESULTS_DIR, "responses");
const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: "file:./dev.db" }),
});

type LoginResult = {
  page: Page;
  context: BrowserContext;
  request: APIRequestContext;
  cookies: Awaited<ReturnType<BrowserContext["cookies"]>>;
  ip: string;
};

type ChainState = {
  failedAtStep?: number;
  failedReason?: string;
  cleanedUp?: boolean;
  cleanupError?: string;
};

const USERS = {
  admin: { email: "admin@igreja.local", cargo: "ADMIN" as const, nome: "Administrador" },
  secretario: { email: "secretario@igreja.local", cargo: "SECRETARIO" as const, nome: "Secretario" },
} as const;

test.beforeAll(async () => {
  for (const user of Object.values(USERS)) {
    await prisma.membro.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        nome: user.nome,
        cargo: user.cargo,
        tipo: "MEMBRO_ATIVO",
      },
    });
  }
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe.serial("Estoque movimentação/manutenção/baixa — S12", () => {

  test("Chain 1: SECRETARIO vê botão Movimentar e navega ao form", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-STQ-MOV-CHAIN-1";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "secretario", "10.12.1");
    let itemId = "";

    try {
      const post = await login.request.post("/app/estoque/novo", {
        headers: { cookie: cookieHeader(login.cookies) },
        form: {
          nome: "Luvas Descartaveis",
          tipo: "CONSUMO",
          quantidade: "50",
          localizacaoFisica: "Enfermaria",
        },
      });
      const body = await post.text();
      await recordResponse(chainId, 1, { status: post.status(), headers: post.headers(), body: body.slice(0, 1000) });
      itemId = body.match(/\/app\/estoque\/([0-9a-f-]{36})/)?.[1] ?? "";
      expect(itemId, "item CONSUMO criado").toBeTruthy();

      const response = await login.page.goto(`/app/estoque/${itemId}`);
      await recordPage(chainId, 2, login.page, response, "detalhe-consumo");
      expect(response?.status()).toBe(200);

      await expect(login.page.getByText("Luvas Descartaveis")).toBeVisible();
      await expect(login.page.getByText("Consumo")).toBeVisible();
      await expect(login.page.getByText("Ativo")).toBeVisible();

      const btnMovimentar = login.page.getByRole("link", { name: "Movimentar" });
      await expect(btnMovimentar).toBeVisible();
      await btnMovimentar.click();
      await expect(login.page).toHaveURL(/\/app\/estoque\/[0-9a-f-]{36}\/movimentar$/);

      await expect(login.page.getByLabel("Quantidade *")).toBeVisible();
      await expect(login.page.getByLabel("Nome do Retirante")).toBeVisible();

      await dbSettle(100);
    } catch (error) {
      state.failedAtStep = 1;
      state.failedReason = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      try {
        if (itemId) {
          await prisma.itemEstoque.deleteMany({ where: { id: itemId } }).catch(() => {});
          await dbSettle(50);
        }
        state.cleanedUp = true;
      } catch (cleanupError) {
        state.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      }
      await recordResult(chainId, {
        id: chainId, status: state.failedReason ? "failed" : "passed",
        itemId, durationMs: Date.now() - startedAt, ...state,
      });
      await disposeLogin(login);
    }
  });

  test("Chain 2: SECRETARIO registra SAIDA e vê na tabela de movimentações", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-STQ-MOV-CHAIN-2";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "secretario", "10.12.2");
    let itemId = "";

    try {
      const post = await login.request.post("/app/estoque/novo", {
        headers: { cookie: cookieHeader(login.cookies) },
        form: {
          nome: "Papel Sulfite",
          tipo: "CONSUMO",
          quantidade: "30",
          localizacaoFisica: "Escritorio",
        },
      });
      const body = await post.text();
      await recordResponse(chainId, 1, { status: post.status(), headers: post.headers(), body: body.slice(0, 1000) });
      itemId = body.match(/\/app\/estoque\/([0-9a-f-]{36})/)?.[1] ?? "";
      expect(itemId, "item CONSUMO criado").toBeTruthy();

      await login.page.goto(`/app/estoque/${itemId}/movimentar`);
      await recordPage(chainId, 2, login.page, null, "form-movimentar");
      await expect(login.page.getByLabel("Quantidade *")).toBeVisible();

      await login.page.getByLabel("Quantidade *").fill("-5");
      await login.page.getByLabel("Nome do Retirante").fill("João Silva");
      await login.page.getByRole("button", { name: "Registrar Movimentação" }).click();

      await expect(login.page).toHaveURL(/\/app\/estoque\/[0-9a-f-]{36}($|\?)/);
      await recordPage(chainId, 3, login.page, null, "detalhe-pos-saida");

      const url = login.page.url();
      expect(url, "redirect contém toast").toContain("toast=movimentacao-registrada");

      await expect(login.page.getByText("Papel Sulfite")).toBeVisible();
      await expect(login.page.getByText("Movimentações")).toBeVisible();

      const tabela = login.page.locator("table");
      await expect(tabela).toBeVisible();
      await expect(tabela.getByText("SAÍDA")).toBeVisible();
      await expect(tabela.getByText("-5")).toBeVisible();
      await expect(tabela.getByText("João Silva")).toBeVisible();

      await dbSettle(100);
    } catch (error) {
      state.failedAtStep = 1;
      state.failedReason = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      try {
        if (itemId) {
          await prisma.itemEstoque.deleteMany({ where: { id: itemId } }).catch(() => {});
          await dbSettle(50);
        }
        state.cleanedUp = true;
      } catch (cleanupError) {
        state.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      }
      await recordResult(chainId, {
        id: chainId, status: state.failedReason ? "failed" : "passed",
        itemId, durationMs: Date.now() - startedAt, ...state,
      });
      await disposeLogin(login);
    }
  });

  test("Chain 3: SECRETARIO registra ENTRADA e quantidade é incrementada", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-STQ-MOV-CHAIN-3";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "secretario", "10.12.3");
    let itemId = "";

    try {
      const post = await login.request.post("/app/estoque/novo", {
        headers: { cookie: cookieHeader(login.cookies) },
        form: {
          nome: "Canetas Azuis",
          tipo: "CONSUMO",
          quantidade: "10",
          localizacaoFisica: "Recepção",
        },
      });
      const body = await post.text();
      await recordResponse(chainId, 1, { status: post.status(), headers: post.headers(), body: body.slice(0, 1000) });
      itemId = body.match(/\/app\/estoque\/([0-9a-f-]{36})/)?.[1] ?? "";
      expect(itemId, "item CONSUMO criado").toBeTruthy();

      await login.page.goto(`/app/estoque/${itemId}/movimentar`);
      await recordPage(chainId, 2, login.page, null, "form-movimentar-entrada");

      await login.page.getByLabel("Quantidade *").fill("20");
      await login.page.getByRole("button", { name: "Registrar Movimentação" }).click();

      await expect(login.page).toHaveURL(/\/app\/estoque\/[0-9a-f-]{36}($|\?)/);
      await recordPage(chainId, 3, login.page, null, "detalhe-pos-entrada");

      await expect(login.page.getByText("Canetas Azuis")).toBeVisible();
      await expect(login.page.getByText("30")).toBeVisible();

      await dbSettle(100);
    } catch (error) {
      state.failedAtStep = 1;
      state.failedReason = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      try {
        if (itemId) {
          await prisma.itemEstoque.deleteMany({ where: { id: itemId } }).catch(() => {});
          await dbSettle(50);
        }
        state.cleanedUp = true;
      } catch (cleanupError) {
        state.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      }
      await recordResult(chainId, {
        id: chainId, status: state.failedReason ? "failed" : "passed",
        itemId, durationMs: Date.now() - startedAt, ...state,
      });
      await disposeLogin(login);
    }
  });

  test("Chain 4: SECRETARIO tenta SAIDA sem saldo → 409 saldo insuficiente", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-STQ-MOV-CHAIN-4";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "secretario", "10.12.4");
    let itemId = "";

    try {
      const post = await login.request.post("/app/estoque/novo", {
        headers: { cookie: cookieHeader(login.cookies) },
        form: {
          nome: "Cafe em Po",
          tipo: "CONSUMO",
          quantidade: "5",
          localizacaoFisica: "Copa",
        },
      });
      const body = await post.text();
      await recordResponse(chainId, 1, { status: post.status(), headers: post.headers(), body: body.slice(0, 1000) });
      itemId = body.match(/\/app\/estoque\/([0-9a-f-]{36})/)?.[1] ?? "";
      expect(itemId, "item CONSUMO criado").toBeTruthy();

      const postMov = await login.request.post(`/app/estoque/${itemId}/movimentar`, {
        headers: { cookie: cookieHeader(login.cookies) },
        form: {
          quantidade: "-10",
          nomeRetirante: "Maria Souza",
        },
      });
      const movBody = await postMov.text();
      await recordResponse(chainId, 2, {
        status: postMov.status(),
        headers: postMov.headers(),
        body: movBody.slice(0, 2000),
      });
      expect(postMov.status(), "saída sem saldo → 409").toBe(409);
      expect(movBody, "mensagem saldo insuficiente").toMatch(/saldo insuficiente|insuficiente/i);

      await dbSettle(100);
    } catch (error) {
      state.failedAtStep = 1;
      state.failedReason = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      try {
        if (itemId) {
          await prisma.itemEstoque.deleteMany({ where: { id: itemId } }).catch(() => {});
          await dbSettle(50);
        }
        state.cleanedUp = true;
      } catch (cleanupError) {
        state.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      }
      await recordResult(chainId, {
        id: chainId, status: state.failedReason ? "failed" : "passed",
        itemId, durationMs: Date.now() - startedAt, ...state,
      });
      await disposeLogin(login);
    }
  });

  test("Chain 5: ADMIN vê botão Enviar para manutenção em PATRIMONIO", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-STQ-MOV-CHAIN-5";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "admin", "10.12.5");
    let itemId = "";

    try {
      const post = await login.request.post("/app/estoque/novo", {
        headers: { cookie: cookieHeader(login.cookies) },
        form: {
          nome: "Microfone Sem Fio",
          tipo: "PATRIMONIO",
          quantidade: "1",
          numeroSerie: "MIC-S12-001",
          localizacaoFisica: "Templo",
        },
      });
      const body = await post.text();
      await recordResponse(chainId, 1, { status: post.status(), headers: post.headers(), body: body.slice(0, 1000) });
      itemId = body.match(/\/app\/estoque\/([0-9a-f-]{36})/)?.[1] ?? "";
      expect(itemId, "item PATRIMONIO criado").toBeTruthy();

      const response = await login.page.goto(`/app/estoque/${itemId}`);
      await recordPage(chainId, 2, login.page, response, "detalhe-patrimonio");
      expect(response?.status(), "ADMIN acessa detalhe").toBe(200);

      await expect(login.page.getByText("Microfone Sem Fio")).toBeVisible();
      await expect(login.page.getByText("Patrimônio")).toBeVisible();
      await expect(login.page.getByText("Disponível")).toBeVisible();

      await expect(
        login.page.getByRole("link", { name: /Enviar para manutenção/i })
      ).toBeVisible();

      await dbSettle(100);
    } catch (error) {
      state.failedAtStep = 1;
      state.failedReason = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      try {
        if (itemId) {
          await prisma.itemEstoque.deleteMany({ where: { id: itemId } }).catch(() => {});
          await dbSettle(50);
        }
        state.cleanedUp = true;
      } catch (cleanupError) {
        state.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      }
      await recordResult(chainId, {
        id: chainId, status: state.failedReason ? "failed" : "passed",
        itemId, durationMs: Date.now() - startedAt, ...state,
      });
      await disposeLogin(login);
    }
  });

  test("Chain 6: ADMIN envia para manutenção e status muda para EM_MANUTENCAO", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-STQ-MOV-CHAIN-6";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "admin", "10.12.6");
    let itemId = "";

    try {
      const post = await login.request.post("/app/estoque/novo", {
        headers: { cookie: cookieHeader(login.cookies) },
        form: {
          nome: "Caixa de Som",
          tipo: "PATRIMONIO",
          quantidade: "1",
          numeroSerie: "CS-S12-002",
          localizacaoFisica: "Salão",
        },
      });
      const body = await post.text();
      await recordResponse(chainId, 1, { status: post.status(), headers: post.headers(), body: body.slice(0, 1000) });
      itemId = body.match(/\/app\/estoque\/([0-9a-f-]{36})/)?.[1] ?? "";
      expect(itemId, "item PATRIMONIO criado").toBeTruthy();

      await login.page.goto(`/app/estoque/${itemId}/manutencao`);
      await recordPage(chainId, 2, login.page, null, "form-manutencao");
      await expect(login.page.getByRole("heading", { name: /Enviar para Manutenção/i })).toBeVisible();

      await login.page.getByLabel("Assistência Técnica *").fill("Som Pro Ltda");
      await login.page.getByLabel("Endereço da Assistência *").fill("Rua das Acácias, 456");
      await login.page.getByLabel("Nº OS").fill("OS-2026-042");
      await login.page.getByRole("button", { name: "Enviar para Manutenção" }).click();

      await expect(login.page).toHaveURL(/\/app\/estoque\/[0-9a-f-]{36}($|\?)/);
      await recordPage(chainId, 3, login.page, null, "detalhe-em-manutencao");

      const url = login.page.url();
      expect(url, "redirect contém toast").toContain("toast=enviado-manutencao");

      await expect(login.page.getByText("Caixa de Som")).toBeVisible();
      await expect(login.page.getByText("Em manutenção")).toBeVisible();
      await expect(login.page.getByText("Registrar retorno")).toBeVisible();

      await dbSettle(100);
    } catch (error) {
      state.failedAtStep = 1;
      state.failedReason = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      try {
        if (itemId) {
          await prisma.itemEstoque.deleteMany({ where: { id: itemId } }).catch(() => {});
          await dbSettle(50);
        }
        state.cleanedUp = true;
      } catch (cleanupError) {
        state.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      }
      await recordResult(chainId, {
        id: chainId, status: state.failedReason ? "failed" : "passed",
        itemId, durationMs: Date.now() - startedAt, ...state,
      });
      await disposeLogin(login);
    }
  });

  test("Chain 7: ADMIN registra retorno e status volta para DISPONIVEL", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-STQ-MOV-CHAIN-7";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "admin", "10.12.7");
    let itemId = "";
    let manutencaoId = "";

    try {
      const post = await login.request.post("/app/estoque/novo", {
        headers: { cookie: cookieHeader(login.cookies) },
        form: {
          nome: "Mesa de Som",
          tipo: "PATRIMONIO",
          quantidade: "1",
          numeroSerie: "MS-S12-003",
          localizacaoFisica: "Palco",
        },
      });
      const body = await post.text();
      await recordResponse(chainId, 1, { status: post.status(), headers: post.headers(), body: body.slice(0, 1000) });
      itemId = body.match(/\/app\/estoque\/([0-9a-f-]{36})/)?.[1] ?? "";
      expect(itemId, "item PATRIMONIO criado").toBeTruthy();

      const postMnt = await login.request.post(`/app/estoque/${itemId}/manutencao`, {
        headers: { cookie: cookieHeader(login.cookies) },
        form: {
          assistenciaTecnica: "Audio Fix Ltda",
          enderecoAssistencia: "Av Central, 789",
        },
      });
      expect(postMnt.status(), "manutenção criada via API").toBeGreaterThanOrEqual(200);
      expect(postMnt.status(), "manutenção criada via API").toBeLessThan(400);
      const mntRecord = await prisma.manutencaoAtivo.findFirst({
        where: { itemEstoqueId: itemId },
      });
      manutencaoId = mntRecord?.id ?? "";
      expect(manutencaoId, "manutencaoId encontrado").toBeTruthy();

      const itemDb = await prisma.itemEstoque.findUnique({ where: { id: itemId } });
      expect(itemDb?.statusPatrimonio, "status = EM_MANUTENCAO no banco").toBe("EM_MANUTENCAO");

      await login.page.goto(`/app/estoque/${itemId}/retorno`);
      await recordPage(chainId, 2, login.page, null, "form-retorno");
      await expect(login.page.getByRole("heading", { name: /Retorno de Manutenção/i })).toBeVisible();
      await expect(login.page.getByText("Audio Fix Ltda")).toBeVisible();

      await login.page.getByRole("button", { name: "Confirmar Retorno" }).click();
      await expect(login.page).toHaveURL(/\/app\/estoque\/[0-9a-f-]{36}($|\?)/);
      await recordPage(chainId, 3, login.page, null, "detalhe-retornado");

      const url = login.page.url();
      expect(url, "redirect contém toast").toContain("toast=retorno-manutencao");

      await expect(login.page.getByText("Mesa de Som")).toBeVisible();
      await expect(login.page.getByText("Disponível")).toBeVisible();
      await expect(login.page.getByRole("link", { name: /Enviar para manutenção/i })).toBeVisible();

      await dbSettle(100);
    } catch (error) {
      state.failedAtStep = 1;
      state.failedReason = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      try {
        if (itemId) {
          await prisma.itemEstoque.deleteMany({ where: { id: itemId } }).catch(() => {});
          await dbSettle(50);
        }
        state.cleanedUp = true;
      } catch (cleanupError) {
        state.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      }
      await recordResult(chainId, {
        id: chainId, status: state.failedReason ? "failed" : "passed",
        itemId, manutencaoId, durationMs: Date.now() - startedAt, ...state,
      });
      await disposeLogin(login);
    }
  });

  test("Chain 8: ADMIN envia p/ manutenção e baixa por perda → BAIXADO_PERDA", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-STQ-MOV-CHAIN-8";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "admin", "10.12.8");
    let itemId = "";

    try {
      const post = await login.request.post("/app/estoque/novo", {
        headers: { cookie: cookieHeader(login.cookies) },
        form: {
          nome: "Projetor Epson",
          tipo: "PATRIMONIO",
          quantidade: "1",
          numeroSerie: "PE-S12-004",
          localizacaoFisica: "Sala 2",
        },
      });
      const body = await post.text();
      await recordResponse(chainId, 1, { status: post.status(), headers: post.headers(), body: body.slice(0, 1000) });
      itemId = body.match(/\/app\/estoque\/([0-9a-f-]{36})/)?.[1] ?? "";
      expect(itemId, "item PATRIMONIO criado").toBeTruthy();

      const postMnt = await login.request.post(`/app/estoque/${itemId}/manutencao`, {
        headers: { cookie: cookieHeader(login.cookies) },
        form: {
          assistenciaTecnica: "Epson Autorizada",
          enderecoAssistencia: "Rua Tech, 100",
        },
      });
      expect(postMnt.status(), "manutenção via API").toBeGreaterThanOrEqual(200);
      expect(postMnt.status(), "manutenção via API").toBeLessThan(400);

      await login.page.goto(`/app/estoque/${itemId}/baixa`);
      await recordPage(chainId, 2, login.page, null, "form-baixa");
      await expect(login.page.getByRole("heading", { name: /Baixa por Perda/i })).toBeVisible();

      await login.page.getByLabel("Motivo da Perda *").fill("Equipamento danificado após queda. Placa-mãe queimada.");
      await login.page.getByRole("button", { name: "Confirmar Baixa por Perda" }).click();

      await expect(login.page).toHaveURL(/\/app\/estoque($|\?)/);
      await recordPage(chainId, 3, login.page, null, "lista-pos-baixa");

      const url = login.page.url();
      expect(url, "redirect contém toast").toContain("toast=item-baixado");

      const itemDb = await prisma.itemEstoque.findUnique({ where: { id: itemId } });
      expect(itemDb?.statusPatrimonio, "status = BAIXADO_PERDA").toBe("BAIXADO_PERDA");
      expect(itemDb?.ativo, "ativo = false").toBe(false);

      await dbSettle(100);
    } catch (error) {
      state.failedAtStep = 1;
      state.failedReason = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      try {
        if (itemId) {
          await prisma.itemEstoque.deleteMany({ where: { id: itemId } }).catch(() => {});
          await dbSettle(50);
        }
        state.cleanedUp = true;
      } catch (cleanupError) {
        state.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      }
      await recordResult(chainId, {
        id: chainId, status: state.failedReason ? "failed" : "passed",
        itemId, durationMs: Date.now() - startedAt, ...state,
      });
      await disposeLogin(login);
    }
  });

  test("Chain 9: ADMIN vê badge BAIXADO_PERDA e Arquivado no detalhe", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-STQ-MOV-CHAIN-9";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "admin", "10.12.9");
    let itemId = "";

    try {
      const post = await login.request.post("/app/estoque/novo", {
        headers: { cookie: cookieHeader(login.cookies) },
        form: {
          nome: "Notebook Dell",
          tipo: "PATRIMONIO",
          quantidade: "1",
          numeroSerie: "NB-S12-005",
          localizacaoFisica: "Escritório",
        },
      });
      const body = await post.text();
      await recordResponse(chainId, 1, { status: post.status(), headers: post.headers(), body: body.slice(0, 1000) });
      itemId = body.match(/\/app\/estoque\/([0-9a-f-]{36})/)?.[1] ?? "";
      expect(itemId, "item PATRIMONIO criado").toBeTruthy();

      await prisma.itemEstoque.update({
        where: { id: itemId },
        data: { statusPatrimonio: "BAIXADO_PERDA", ativo: false },
      });
      await dbSettle(50);

      const response = await login.page.goto(`/app/estoque/${itemId}`);
      await recordPage(chainId, 2, login.page, response, "detalhe-baixado");
      expect(response?.status(), "detalhe item baixado").toBe(200);

      await expect(login.page.getByText("Notebook Dell")).toBeVisible();
      await expect(login.page.getByText("Baixado (perda)")).toBeVisible();
      await expect(login.page.getByText("Arquivado")).toBeVisible();

      await dbSettle(100);
    } catch (error) {
      state.failedAtStep = 1;
      state.failedReason = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      try {
        if (itemId) {
          await prisma.itemEstoque.deleteMany({ where: { id: itemId } }).catch(() => {});
          await dbSettle(50);
        }
        state.cleanedUp = true;
      } catch (cleanupError) {
        state.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      }
      await recordResult(chainId, {
        id: chainId, status: state.failedReason ? "failed" : "passed",
        itemId, durationMs: Date.now() - startedAt, ...state,
      });
      await disposeLogin(login);
    }
  });

  test("Chain 10: ADMIN acessa rota de baixa com item válido → 200", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-STQ-MOV-CHAIN-10";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "admin", "10.12.10");
    let itemId = "";

    try {
      const post = await login.request.post("/app/estoque/novo", {
        headers: { cookie: cookieHeader(login.cookies) },
        form: {
          nome: "Teclado Musical",
          tipo: "PATRIMONIO",
          quantidade: "1",
          numeroSerie: "TM-S12-006",
          localizacaoFisica: "Sala de Música",
        },
      });
      const body = await post.text();
      await recordResponse(chainId, 1, { status: post.status(), headers: post.headers(), body: body.slice(0, 1000) });
      itemId = body.match(/\/app\/estoque\/([0-9a-f-]{36})/)?.[1] ?? "";
      expect(itemId, "item PATRIMONIO criado").toBeTruthy();

      const response = await login.page.goto(`/app/estoque/${itemId}/baixa`);
      await recordPage(chainId, 2, login.page, response, "rota-baixa-admin");
      expect(response?.status(), "ADMIN acessa /baixa").toBe(200);

      await expect(login.page.getByRole("heading", { name: /Baixa por Perda/i })).toBeVisible();
      await expect(login.page.getByLabel("Motivo da Perda *")).toBeVisible();

      await dbSettle(100);
    } catch (error) {
      state.failedAtStep = 1;
      state.failedReason = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      try {
        if (itemId) {
          await prisma.itemEstoque.deleteMany({ where: { id: itemId } }).catch(() => {});
          await dbSettle(50);
        }
        state.cleanedUp = true;
      } catch (cleanupError) {
        state.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      }
      await recordResult(chainId, {
        id: chainId, status: state.failedReason ? "failed" : "passed",
        itemId, durationMs: Date.now() - startedAt, ...state,
      });
      await disposeLogin(login);
    }
  });

  test("Chain 11: SECRETARIO tenta movimentar item arquivado → 409", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-STQ-MOV-CHAIN-11";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "secretario", "10.12.11");
    let itemId = "";

    try {
      const post = await login.request.post("/app/estoque/novo", {
        headers: { cookie: cookieHeader(login.cookies) },
        form: {
          nome: "Copos Descartaveis",
          tipo: "CONSUMO",
          quantidade: "100",
          localizacaoFisica: "Copa",
        },
      });
      const body = await post.text();
      await recordResponse(chainId, 1, { status: post.status(), headers: post.headers(), body: body.slice(0, 1000) });
      itemId = body.match(/\/app\/estoque\/([0-9a-f-]{36})/)?.[1] ?? "";
      expect(itemId, "item CONSUMO criado").toBeTruthy();

      const arquivar = await login.request.post(`/app/estoque/${itemId}`, {
        headers: { cookie: cookieHeader(login.cookies) },
        form: { _op: "arquivar" },
      });
      expect(arquivar.status(), "arquivar item").toBeGreaterThanOrEqual(200);
      expect(arquivar.status(), "arquivar item").toBeLessThan(400);

      const postMov = await login.request.post(`/app/estoque/${itemId}/movimentar`, {
        headers: { cookie: cookieHeader(login.cookies) },
        form: {
          quantidade: "-5",
          nomeRetirante: "Teste",
        },
      });
      const movBody = await postMov.text();
      await recordResponse(chainId, 2, {
        status: postMov.status(),
        headers: postMov.headers(),
        body: movBody.slice(0, 2000),
      });
      expect(postMov.status(), "mov arquivado → 409").toBe(409);
      expect(movBody, "mensagem arquivado").toMatch(/arquivado|não aceita/i);

      await dbSettle(100);
    } catch (error) {
      state.failedAtStep = 1;
      state.failedReason = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      try {
        if (itemId) {
          await prisma.itemEstoque.deleteMany({ where: { id: itemId } }).catch(() => {});
          await dbSettle(50);
        }
        state.cleanedUp = true;
      } catch (cleanupError) {
        state.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      }
      await recordResult(chainId, {
        id: chainId, status: state.failedReason ? "failed" : "passed",
        itemId, durationMs: Date.now() - startedAt, ...state,
      });
      await disposeLogin(login);
    }
  });
});

async function loginAs(
  browser: Browser,
  playwright: any,
  userKey: keyof typeof USERS,
  ipSuffix: string
): Promise<LoginResult> {
  const user = USERS[userKey];
  const ip = `10.12.${ipSuffix}`;
  const request = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const context = await browser.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const page = await context.newPage();

  const member = await prisma.membro.upsert({
    where: { email: user.email },
    update: {},
    create: {
      email: user.email,
      nome: user.nome,
      cargo: user.cargo,
      tipo: "MEMBRO_ATIVO",
    },
  });
  const sid = randomUUID();
  await prisma.session.create({
    data: {
      id: sid,
      membroId: member.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      absoluteExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  const setCookie = await sessionCookie.serialize(sid);
  const cookies = parseSetCookies(setCookie);
  await context.addCookies(cookies);

  return { page, context, request, cookies: await context.cookies(), ip };
}

async function disposeLogin(login: LoginResult): Promise<void> {
  try {
    await login.request.post("/logout", { headers: { cookie: cookieHeader(login.cookies) } });
  } catch {
  }
  await login.context.close().catch(() => undefined);
  await login.request.dispose().catch(() => undefined);
}

function parseSetCookies(setCookie: string) {
  return setCookie.split(/,(?=\s*[^;,]+=)/).map((raw) => {
    const [nameValue, ...parts] = raw.split(";").map((part) => part.trim());
    const [name, ...valueParts] = nameValue.split("=");
    const attrs = parts.map((part) => part.toLowerCase());
    return {
      name,
      value: valueParts.join("="),
      domain: "127.0.0.1",
      path: "/",
      expires: -1,
      httpOnly: attrs.some((attr) => attr === "httponly"),
      secure: false,
      sameSite: "Lax" as const,
    };
  });
}

function cookieHeader(cookies: Awaited<ReturnType<BrowserContext["cookies"]>>): string {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

function dbSettle(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function recordPage(
  chainId: string,
  step: number,
  page: Page,
  response: Awaited<ReturnType<Page["goto"]>> | null,
  label: string
): Promise<void> {
  const body = await page.locator("body").innerText().catch(() => "");
  await recordResponse(chainId, step, {
    status: response?.status() ?? 0,
    headers: {},
    body: `${label}\n${body.slice(0, 4000)}`,
  });
}

async function recordResponse(
  chainId: string,
  step: number,
  data: { status: number; headers: Record<string, string>; body: string }
): Promise<void> {
  await fs.mkdir(RESPONSES_DIR, { recursive: true });
  const file = path.join(RESPONSES_DIR, `${chainId}-${String(step).padStart(2, "0")}.json`);
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

async function recordResult(chainId: string, data: unknown): Promise<void> {
  await fs.mkdir(RESULTS_DIR, { recursive: true });
  const file = path.join(RESULTS_DIR, `${chainId}.json`);
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}
