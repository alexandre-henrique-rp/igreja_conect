/**
 * E2E: Transferências entre Caixas — Igreja Conect (S07-T05).
 *
 * Cobre 7 chains Playwright:
 * 1. ADMIN transfere R$ 100 entre 2 caixas ativos → sucesso, saldos atualizados, transferenciaGrupoId
 * 2. PASTOR transfere R$ 50 → sucesso (ADMIN/PASTOR/FINANCEIRO podem)
 * 3. FINANCEIRO transfere R$ 25 → sucesso
 * 4. SECRETARIO tenta transferir → 403 (assertCanTransferir bloqueia)
 * 5. Borda #2 — transferir DE caixa arquivado → 409
 * 6. Borda #5 — valor > saldo origem → 409
 * 7. Borda #6 — origem = destino → 400 (Zod superRefine)
 *
 * Cada `test()` é 1 chain. O bloco `finally` executa cleanup mesmo quando
 * uma assertion falha.
 */
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
  pastor: { email: "pastor@igreja.local", cargo: "PASTOR" as const, nome: "Pastor" },
  financeiro: { email: "financeiro+e2e@igreja.local", cargo: "FINANCEIRO" as const, nome: "Financeiro E2E" },
  secretario: { email: "secretario+e2e@igreja.local", cargo: "SECRETARIO" as const, nome: "Secretario E2E" },
} as const;

test.beforeAll(async () => {
  // Setup users
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

test.describe.serial("Transferências entre Caixas — S07", () => {

  // Chain 1: ADMIN transfere R$ 100 → sucesso com atomicidade
  test("Chain 1: ADMIN transfere R$ 100 entre 2 caixas ativos, saldos atualizados, grupo ID compartilhado", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-TRANSF-CHAIN-1";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "admin", "10.7.1");
    let caixaOrigemId = "";
    let caixaDestinoId = "";
    let transferenciaGrupoId = "";

    try {
      // Setup: criar dois caixas com saldos
      const caixaOrigem = await prisma.caixa.create({
        data: { nome: `Origem E2E ${Date.now()}`, ativo: true, saldoCentavos: 10000 },
      });
      const caixaDestino = await prisma.caixa.create({
        data: { nome: `Destino E2E ${Date.now()}`, ativo: true, saldoCentavos: 0 },
      });
      caixaOrigemId = caixaOrigem.id;
      caixaDestinoId = caixaDestino.id;

      // Navegar para nova transferência
      const response = await login.page.goto("/app/financeiro/transferencias/nova");
      await recordPage(chainId, 1, login.page, response, "form-transferencia");
      expect(response?.status(), "form de transferência carrega").toBe(200);

      // Selecionar caixas e valor
      await login.page.getByLabel(/origem/i).selectOption({ index: 1 }); // first option after placeholder
      await login.page.getByLabel(/destino/i).selectOption({ index: 2 });
      await login.page.getByLabel(/valor/i).fill("100,00");
      await login.page.getByLabel(/descrição/i).fill(`Transferência E2E Chain 1 ${Date.now()}`);

      // Submeter
      await login.page.getByRole("button", { name: /transferir/i }).click();
      await expect(login.page).toHaveURL(/\/app\/financeiro/);
      await dbSettle(200);

      // Verificar saldo origem decrementado
      await login.page.goto(`/app/financeiro/caixas/${caixaOrigemId}`);
      await expect(login.page.getByText(/R\$ 0,00|0,00/).first()).toBeVisible({ timeout: 5000 });

      // Verificar saldo destino incrementado
      await login.page.goto(`/app/financeiro/caixas/${caixaDestinoId}`);
      await expect(login.page.getByText(/R\$ 100,00/).first()).toBeVisible({ timeout: 5000 });

      // Verificar que os dois lançamentos compartilham o mesmo transferenciaGrupoId
      const lancamentos = await prisma.lancamento.findMany({
        where: {
          caixaId: { in: [caixaOrigemId, caixaDestinoId] },
          categoria: "TRANSFERENCIA",
        },
        orderBy: { createdAt: "desc" },
        take: 2,
      });
      expect(lancamentos.length, "dois lançamentos TRANSFERENCIA criados").toBe(2);
      transferenciaGrupoId = lancamentos[0].transferenciaGrupoId!;
      expect(
        lancamentos.every((l) => l.transferenciaGrupoId === transferenciaGrupoId),
        "ambos lançamentos compartilham mesmo transferenciaGrupoId"
      ).toBe(true);

      await recordPage(chainId, 2, login.page, null, "extrato-verificado");
      await dbSettle(100);
    } catch (error) {
      state.failedAtStep = 1;
      state.failedReason = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      try {
        if (caixaOrigemId) {
          await prisma.lancamento.deleteMany({ where: { caixaId: caixaOrigemId } });
          await prisma.lancamento.deleteMany({ where: { caixaId: caixaDestinoId } });
          await prisma.caixa.deleteMany({ where: { id: { in: [caixaOrigemId, caixaDestinoId] } } });
          await dbSettle(100);
        }
        state.cleanedUp = true;
      } catch (cleanupError) {
        state.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      }
      await recordResult(chainId, {
        id: chainId,
        status: state.failedReason ? "failed" : "passed",
        caixaOrigemId,
        caixaDestinoId,
        transferenciaGrupoId,
        durationMs: Date.now() - startedAt,
        ...state,
      });
      await disposeLogin(login);
    }
  });

  // Chain 2: PASTOR transfere R$ 50 → sucesso
  test("Chain 2: PASTOR transfere R$ 50 entre caixas → sucesso", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-TRANSF-CHAIN-2";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "pastor", "10.7.2");
    let caixaOrigemId = "";
    let caixaDestinoId = "";

    try {
      const caixaOrigem = await prisma.caixa.create({
        data: { nome: `Origem Pastor E2E ${Date.now()}`, ativo: true, saldoCentavos: 5000 },
      });
      const caixaDestino = await prisma.caixa.create({
        data: { nome: `Destino Pastor E2E ${Date.now()}`, ativo: true, saldoCentavos: 0 },
      });
      caixaOrigemId = caixaOrigem.id;
      caixaDestinoId = caixaDestino.id;

      await login.page.goto("/app/financeiro/transferencias/nova");
      await login.page.getByLabel(/valor/i).fill("50,00");
      await login.page.getByRole("button", { name: /transferir/i }).click();
      await expect(login.page).toHaveURL(/\/app\/financeiro/, { timeout: 8000 });

      // Verificar saldo incrementado no destino
      await login.page.goto(`/app/financeiro/caixas/${caixaDestinoId}`);
      await expect(login.page.getByText(/R\$ 50,00/).first()).toBeVisible({ timeout: 5000 });

      await dbSettle(100);
    } catch (error) {
      state.failedAtStep = 1;
      state.failedReason = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      try {
        if (caixaOrigemId) {
          await prisma.lancamento.deleteMany({ where: { caixaId: { in: [caixaOrigemId, caixaDestinoId] } } });
          await prisma.caixa.deleteMany({ where: { id: { in: [caixaOrigemId, caixaDestinoId] } } });
          await dbSettle(100);
        }
        state.cleanedUp = true;
      } catch (cleanupError) {
        state.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      }
      await recordResult(chainId, {
        id: chainId,
        status: state.failedReason ? "failed" : "passed",
        durationMs: Date.now() - startedAt,
        ...state,
      });
      await disposeLogin(login);
    }
  });

  // Chain 3: FINANCEIRO transfere R$ 25 → sucesso
  test("Chain 3: FINANCEIRO transfere R$ 25 → sucesso", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-TRANSF-CHAIN-3";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "financeiro", "10.7.3");
    let caixaOrigemId = "";
    let caixaDestinoId = "";

    try {
      const caixaOrigem = await prisma.caixa.create({
        data: { nome: `Origem Fin E2E ${Date.now()}`, ativo: true, saldoCentavos: 2500 },
      });
      const caixaDestino = await prisma.caixa.create({
        data: { nome: `Destino Fin E2E ${Date.now()}`, ativo: true, saldoCentavos: 0 },
      });
      caixaOrigemId = caixaOrigem.id;
      caixaDestinoId = caixaDestino.id;

      await login.page.goto("/app/financeiro/transferencias/nova");
      await login.page.getByLabel(/valor/i).fill("25,00");
      await login.page.getByRole("button", { name: /transferir/i }).click();
      await expect(login.page).toHaveURL(/\/app\/financeiro/, { timeout: 8000 });

      await login.page.goto(`/app/financeiro/caixas/${caixaDestinoId}`);
      await expect(login.page.getByText(/R\$ 25,00/).first()).toBeVisible({ timeout: 5000 });

      await dbSettle(100);
    } catch (error) {
      state.failedAtStep = 1;
      state.failedReason = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      try {
        if (caixaOrigemId) {
          await prisma.lancamento.deleteMany({ where: { caixaId: { in: [caixaOrigemId, caixaDestinoId] } } });
          await prisma.caixa.deleteMany({ where: { id: { in: [caixaOrigemId, caixaDestinoId] } } });
          await dbSettle(100);
        }
        state.cleanedUp = true;
      } catch (cleanupError) {
        state.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      }
      await recordResult(chainId, {
        id: chainId,
        status: state.failedReason ? "failed" : "passed",
        durationMs: Date.now() - startedAt,
        ...state,
      });
      await disposeLogin(login);
    }
  });

  // Chain 4: SECRETARIO tenta transferir → 403
  test("Chain 4: SECRETARIO tenta transferir → 403 (assertCanTransferir bloqueia)", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-TRANSF-CHAIN-4";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "secretario", "10.7.4");

    try {
      const response = await login.page.goto("/app/financeiro/transferencias/nova");
      await recordPage(chainId, 1, login.page, response, "transferencia-403");
      expect(response?.status(), "SECRETARIO em /transferencias/nova").toBe(403);
      await expect(login.page.getByText(/Acesso restrito|permissão/i)).toBeVisible();
    } catch (error) {
      state.failedAtStep = 1;
      state.failedReason = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      try {
        state.cleanedUp = true;
      } catch (cleanupError) {
        state.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      }
      await recordResult(chainId, {
        id: chainId,
        status: state.failedReason ? "failed" : "passed",
        durationMs: Date.now() - startedAt,
        ...state,
      });
      await disposeLogin(login);
    }
  });

  // Chain 5: Borda #2 — transferir DE caixa arquivado → 409
  test("Chain 5: Borda #2 — transferir de caixa arquivado → 409", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-TRANSF-CHAIN-5";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "admin", "10.7.5");
    let caixaOrigemId = "";
    let caixaDestinoId = "";

    try {
      // Criar caixa arquivado
      const caixaOrigem = await prisma.caixa.create({
        data: { nome: `Origem Arq E2E ${Date.now()}`, ativo: false, saldoCentavos: 10000 },
      });
      const caixaDestino = await prisma.caixa.create({
        data: { nome: `Destino Arq E2E ${Date.now()}`, ativo: true, saldoCentavos: 0 },
      });
      caixaOrigemId = caixaOrigem.id;
      caixaDestinoId = caixaDestino.id;

      await login.page.goto("/app/financeiro/transferencias/nova");
      await login.page.getByLabel(/valor/i).fill("50,00");
      await login.page.getByRole("button", { name: /transferir/i }).click();

      // Esperar erro 409 na mesma página (sem redirect)
      await expect(login.page.getByText(/arquivado/i)).toBeVisible({ timeout: 5000 });
      await recordPage(chainId, 2, login.page, null, "erro-arquivado");
    } catch (error) {
      state.failedAtStep = 1;
      state.failedReason = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      try {
        if (caixaOrigemId) {
          await prisma.lancamento.deleteMany({ where: { caixaId: { in: [caixaOrigemId, caixaDestinoId] } } });
          await prisma.caixa.deleteMany({ where: { id: { in: [caixaOrigemId, caixaDestinoId] } } });
          await dbSettle(100);
        }
        state.cleanedUp = true;
      } catch (cleanupError) {
        state.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      }
      await recordResult(chainId, {
        id: chainId,
        status: state.failedReason ? "failed" : "passed",
        durationMs: Date.now() - startedAt,
        ...state,
      });
      await disposeLogin(login);
    }
  });

  // Chain 6: Borda #5 — valor > saldo origem → 409
  test("Chain 6: Borda #5 — transferir valor > saldo → 409", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-TRANSF-CHAIN-6";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "admin", "10.7.6");
    let caixaOrigemId = "";
    let caixaDestinoId = "";

    try {
      const caixaOrigem = await prisma.caixa.create({
        data: { nome: `Origem Baixo E2E ${Date.now()}`, ativo: true, saldoCentavos: 1000 },
      });
      const caixaDestino = await prisma.caixa.create({
        data: { nome: `Destino Baixo E2E ${Date.now()}`, ativo: true, saldoCentavos: 0 },
      });
      caixaOrigemId = caixaOrigem.id;
      caixaDestinoId = caixaDestino.id;

      await login.page.goto("/app/financeiro/transferencias/nova");
      await login.page.getByLabel(/valor/i).fill("50,00");
      await dbSettle(300);

      // Submit direta via POST para forçar validação server-side
      const post = await login.request.post("/app/financeiro/transferencias/nova", {
        headers: { cookie: cookieHeader(login.cookies) },
        form: {
          origemId: caixaOrigemId,
          destinoId: caixaDestinoId,
          valorCentavos: 5000,
          descricao: "E2E saldo insuficiente",
        },
      });
      const body = await post.text();
      await recordResponse(chainId, 1, {
        status: post.status(),
        headers: post.headers(),
        body: body.slice(0, 2000),
      });
      expect(post.status(), "transferência com saldo insuficiente").toBe(409);
      expect(body, "mensagem de saldo insuficiente").toMatch(/saldo insuficiente/i);

      // Verificar que saldo origem não mudou
      const saldo = await prisma.caixa.findUnique({ where: { id: caixaOrigemId }, select: { saldoCentavos: true } });
      expect(saldo?.saldoCentavos, "saldo intacto após rejeição").toBe(1000);
    } catch (error) {
      state.failedAtStep = 1;
      state.failedReason = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      try {
        if (caixaOrigemId) {
          await prisma.lancamento.deleteMany({ where: { caixaId: { in: [caixaOrigemId, caixaDestinoId] } } });
          await prisma.caixa.deleteMany({ where: { id: { in: [caixaOrigemId, caixaDestinoId] } } });
          await dbSettle(100);
        }
        state.cleanedUp = true;
      } catch (cleanupError) {
        state.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      }
      await recordResult(chainId, {
        id: chainId,
        status: state.failedReason ? "failed" : "passed",
        durationMs: Date.now() - startedAt,
        ...state,
      });
      await disposeLogin(login);
    }
  });

  // Chain 7: Borda #6 — origem = destino → 400 (Zod)
  test("Chain 7: Borda #6 — origem = destino → 400 (Zod superRefine)", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-TRANSF-CHAIN-7";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "admin", "10.7.7");
    let caixaId = "";

    try {
      const caixa = await prisma.caixa.create({
        data: { nome: `Unico E2E ${Date.now()}`, ativo: true, saldoCentavos: 10000 },
      });
      caixaId = caixa.id;

      await login.page.goto("/app/financeiro/transferencias/nova");
      await login.page.getByLabel(/valor/i).fill("50,00");
      await dbSettle(300);

      // Selecionar o mesmo caixa nas duas selects (via DevTools bypass do UI)
      const post = await login.request.post("/app/financeiro/transferencias/nova", {
        headers: { cookie: cookieHeader(login.cookies) },
        form: {
          origemId: caixaId,
          destinoId: caixaId,
          valorCentavos: 5000,
          descricao: "E2E origem=destino",
        },
      });
      const body = await post.text();
      await recordResponse(chainId, 1, {
        status: post.status(),
        headers: post.headers(),
        body: body.slice(0, 2000),
      });
      expect(post.status(), "origem=destino rejeitado com 400").toBe(400);
      expect(body, "mensagem de caixas iguais").toMatch(/mesmo|igual|origem.*destino/i);
    } catch (error) {
      state.failedAtStep = 1;
      state.failedReason = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      try {
        if (caixaId) {
          await prisma.lancamento.deleteMany({ where: { caixaId } });
          await prisma.caixa.delete({ where: { id: caixaId } });
          await dbSettle(100);
        }
        state.cleanedUp = true;
      } catch (cleanupError) {
        state.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      }
      await recordResult(chainId, {
        id: chainId,
        status: state.failedReason ? "failed" : "passed",
        durationMs: Date.now() - startedAt,
        ...state,
      });
      await disposeLogin(login);
    }
  });
});

// ===================== Helpers =====================

async function loginAs(
  browser: Browser,
  playwright: any,
  userKey: keyof typeof USERS,
  ipSuffix: string
): Promise<LoginResult> {
  const user = USERS[userKey];
  const ip = `10.7.${ipSuffix}`;
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
    // Logout idempotente
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
