/**
 * E2E: Módulo Financeiro básico — Igreja Conect (S06-T14).
 *
 * Cobre 7 chains Playwright:
 * 1. FINANCEIRO registra DÍZIMO de R$ 50,00 e vê no extrato.
 * 2. SECRETARIO vê dashboard/extrato sem DÍZIMOS.
 * 3. SECRETARIO recebe 403 ao criar caixa.
 * 4. DISCIPULADOR recebe 403 no financeiro.
 * 5. DISCIPULADOR recebe 403 no detalhe do caixa.
 * 6. Caixa arquivado rejeita lançamento e é reaberto no cleanup.
 * 7. ADMIN cria caixa e valida duplicidade de nome.
 *
 * Cada `test()` é 1 chain. O bloco `finally` registra response/result e
 * executa cleanup mesmo quando uma assertion falha. Resultados ficam em
 * `e2e/results/` para cumprir o path allowlist desta task.
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
  financeiro: { email: "financeiro+e2e@igreja.local", cargo: "FINANCEIRO" as const, nome: "Financeiro E2E" },
  secretario: { email: "secretario+e2e@igreja.local", cargo: "SECRETARIO" as const, nome: "Secretario E2E" },
  discipulador: { email: "discipulador+e2e@igreja.local", cargo: "LIDER_MINISTERIO" as const, nome: "Discipulador E2E" },
} as const;

test.beforeAll(async () => {
  const caixa = await prisma.caixa.upsert({
    where: { nome: "Caixa Geral" },
    update: { ativo: true, saldoCentavos: 0 },
    create: {
      nome: "Caixa Geral",
      ativo: true,
      saldoCentavos: 0,
    },
  });
  await prisma.lancamento.deleteMany({ where: { caixaId: caixa.id } });
  await prisma.membro.upsert({
    where: { email: USERS.discipulador.email },
    update: {},
    create: {
      email: USERS.discipulador.email,
      nome: USERS.discipulador.nome,
      cargo: USERS.discipulador.cargo,
      tipo: "MEMBRO_ATIVO",
    },
  });
  await prisma.membro.upsert({
    where: { email: "maria+e2e@igreja.local" },
    update: {},
    create: {
      email: "maria+e2e@igreja.local",
      nome: "Maria",
      tipo: "MEMBRO_ATIVO",
    },
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe.serial("Financeiro básico — S06", () => {
  test("Chain 1: FINANCEIRO registra DÍZIMO e vê +R$ 50,00 no extrato", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-FIN-CHAIN-1";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "financeiro", "10.6.1");
    let caixaId = "";
    let caixaArquivadoNoCleanup = false;

    try {
      const response = await login.page.goto("/app/financeiro");
      await recordPage(chainId, 1, login.page, response, "dashboard");
      expect(response?.status(), "FINANCEIRO acessa dashboard").toBe(200);
      await expect(login.page.getByRole("heading", { name: "Financeiro" })).toBeVisible();
      await expect(login.page.getByTestId("card-saldo-caixa").filter({ hasText: "Caixa Geral" })).toContainText("R$ 0,00");
      caixaId = await caixaIdByName(login.page, "Caixa Geral");
      expect(caixaId, "Caixa Geral id extraído").toBeTruthy();

      await login.page.getByRole("link", { name: "+ Lançar" }).first().click();
      await expect(login.page).toHaveURL(/\/app\/financeiro\/lancamentos\/novo\?caixaId=/);
      await expect(login.page.getByLabel("Caixa")).toHaveValue(caixaId);

      await login.page.getByLabel("Tipo").selectOption("ENTRADA");
      await login.page.getByLabel("Categoria").selectOption("Dízimo");
      await login.page.getByLabel("Valor").fill("50,00");
      await login.page.getByLabel("Membro").selectOption({ label: "Maria" });
      await login.page.getByLabel("Data de Competência").fill(todayIsoDate());
      await login.page.getByLabel("Descrição").fill(`Dízimo E2E Chain 1 ${Date.now()}`);
      await login.page.getByRole("button", { name: "Criar Lançamento" }).click();
      await expect(login.page).toHaveURL(new RegExp(`/app/financeiro/caixas/${caixaId}$`));
      await expect(login.page.getByText("+ R$ 50,00")).toBeVisible();
      await expect(login.page.getByText("Dízimo")).toBeVisible();
      await recordPage(chainId, 2, login.page, null, "extrato-pos-dizimo");

      await dbSettle(100);
    } catch (error) {
      state.failedAtStep = 1;
      state.failedReason = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      try {
        if (caixaId) {
          await createLancamentoViaRequest(login.request, login.cookies, {
            tipo: "SAIDA",
            categoria: "DESPESA_OPERACIONAL",
            valorDisplay: "50,00",
            caixaId,
            membroId: "",
            descricao: `Cleanup reverso Chain 1 ${Date.now()}`,
          });
          await dbSettle(100);
        }
        if (caixaArquivadoNoCleanup) {
          await reabrirCaixaViaUi(login.page, "Caixa Geral");
        }
        state.cleanedUp = true;
      } catch (cleanupError) {
        state.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      }
      await recordResult(chainId, {
        id: chainId,
        status: state.failedReason ? "failed" : "passed",
        caixaId,
        durationMs: Date.now() - startedAt,
        ...state,
      });
      await disposeLogin(login);
    }
  });

  test("Chain 2: SECRETARIO vê financeiro sem DÍZIMOS", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-FIN-CHAIN-2";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "secretario", "10.6.2");

    try {
      const dashboard = await login.page.goto("/app/financeiro");
      await recordPage(chainId, 1, login.page, dashboard, "dashboard-secretario");
      expect(dashboard?.status(), "SECRETARIO acessa dashboard").toBe(200);
      const dashboardBody = await login.page.locator("body").innerText();
      expect(dashboardBody, "dashboard sem DÍZIMO para SECRETARIO").not.toContain("Dízimo");

      await login.page.getByRole("link", { name: "Caixas" }).click();
      await expect(login.page).toHaveURL(/\/app\/financeiro\/caixas$/);
      await expect(login.page.getByText("Caixas", { exact: true })).toBeVisible();

      const caixaId = await caixaIdByName(login.page, "Caixa Geral");
      await login.page.goto(`/app/financeiro/caixas/${caixaId}`);
      const extratoBody = await login.page.locator("body").innerText();
      await recordPage(chainId, 2, login.page, null, "extrato-secretario");
      expect(extratoBody, "extrato sem DÍZIMO para SECRETARIO").not.toContain("Dízimo");
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

  test("Chain 3: SECRETARIO recebe 403 ao criar caixa", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-FIN-CHAIN-3";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "secretario", "10.6.3");

    try {
      const response = await login.page.goto("/app/financeiro/caixas/novo");
      await recordPage(chainId, 1, login.page, response, "nova-caixa-403");
      expect(response?.status(), "SECRETARIO em /caixas/novo").toBe(403);
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

  test("Chain 4: DISCIPULADOR recebe 403 no financeiro", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-FIN-CHAIN-4";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "discipulador", "10.6.4");

    try {
      const response = await login.page.goto("/app/financeiro");
      await recordPage(chainId, 1, login.page, response, "financeiro-403");
      expect(response?.status(), "DISCIPULADOR em /financeiro").toBe(403);
      await expect(login.page.getByText(/Acesso restrito/i)).toBeVisible();
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

  test("Chain 5: DISCIPULADOR recebe 403 no detalhe do caixa", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-FIN-CHAIN-5";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "discipulador", "10.6.5");
    const caixaId = await caixaIdByNameWithLogin(browser, playwright, "admin", "Caixa Geral", "10.6.5-admin");

    try {
      const response = await login.page.goto(`/app/financeiro/caixas/${caixaId}`);
      await recordPage(chainId, 1, login.page, response, "detalhe-caixa-403");
      expect(response?.status(), "DISCIPULADOR em /caixas/:id").toBe(403);
      await expect(login.page.getByText(/Acesso restrito/i)).toBeVisible();
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
        caixaId,
        durationMs: Date.now() - startedAt,
        ...state,
      });
      await disposeLogin(login);
    }
  });

  test("Chain 6: Caixa arquivado rejeita lançamento e é reaberto", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-FIN-CHAIN-6";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "admin", "10.6.6");
    let caixaId = "";
    let caixaJaArquivado = false;

    try {
      caixaId = await caixaIdByName(login.page, "Caixa Geral");
      caixaJaArquivado = await isCaixaArchived(login.page, "Caixa Geral");
      if (!caixaJaArquivado) {
        await archiveCaixaViaUi(login.page, "Caixa Geral");
      }

      const formResponse = await login.page.goto(`/app/financeiro/lancamentos/novo?caixaId=${caixaId}`);
      await recordPage(chainId, 2, login.page, formResponse, "form-com-caixa-arquivado");
      expect(formResponse?.status(), "form de lançamento carrega").toBe(200);

      await login.page.getByLabel("Tipo").selectOption("ENTRADA");
      await login.page.getByLabel("Categoria").selectOption("Oferta");
      await login.page.getByLabel("Valor").fill("10,00");
      await login.page.getByLabel("Data de Competência").fill(todayIsoDate());
      await login.page.getByLabel("Descrição").fill(`Tentativa em caixa arquivado ${Date.now()}`);

      const post = await login.request.post("/app/financeiro/lancamentos/novo", {
        headers: { cookie: cookieHeader(login.cookies) },
        form: {
          tipo: "ENTRADA",
          categoria: "OFERTA",
          valorDisplay: "10,00",
          caixaId,
          membroId: "",
          dataCompetencia: todayIsoDate(),
          descricao: `Tentativa em caixa arquivado ${Date.now()}`,
        },
      });
      const body = await post.text();
      await recordResponse(chainId, 3, {
        status: post.status(),
        headers: post.headers(),
        body: body.slice(0, 2000),
      });
      expect(post.status(), "lançamento em caixa arquivado rejeitado").toBe(409);
      expect(body, "mensagem de caixa arquivado").toMatch(/arquivado/i);
    } catch (error) {
      state.failedAtStep = 1;
      state.failedReason = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      try {
        await reabrirCaixaViaUi(login.page, "Caixa Geral");
        state.cleanedUp = true;
      } catch (cleanupError) {
        state.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      }
      await recordResult(chainId, {
        id: chainId,
        status: state.failedReason ? "failed" : "passed",
        caixaId,
        caixaJaArquivado,
        durationMs: Date.now() - startedAt,
        ...state,
      });
      await disposeLogin(login);
    }
  });

  test("Chain 7: ADMIN cria caixa e valida duplicidade", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-FIN-CHAIN-7";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "admin", "10.6.7");
    const caixaNome = `Teste E2E ${Date.now().toString().slice(-6)}`;
    let caixaCriadoId = "";

    try {
      await login.page.goto("/app/financeiro/caixas/novo");
      await recordPage(chainId, 1, login.page, null, "nova-caixa-form");
      await expect(login.page.getByLabel("Nome do Caixa")).toBeVisible();
      await login.page.getByLabel("Nome do Caixa").fill(caixaNome);
      await login.page.getByRole("button", { name: "Criar Caixa" }).click();
      await expect(login.page).toHaveURL(/\/app\/financeiro\/caixas\/[0-9a-f-]{36}$/);
      caixaCriadoId = new URL(login.page.url()).pathname.split("/").pop() ?? "";
      await recordPage(chainId, 2, login.page, null, "detalhe-caixa-criado");

      await login.page.goto("/app/financeiro/caixas");
      await expect(login.page.getByText(caixaNome)).toBeVisible();

      await login.page.goto("/app/financeiro/caixas/novo");
      await login.page.getByLabel("Nome do Caixa").fill("Caixa Geral");
      await login.page.getByRole("button", { name: "Criar Caixa" }).click();
      await expect(login.page.getByText(/Já existe um caixa com este nome/i)).toBeVisible();
      await recordPage(chainId, 3, login.page, null, "duplicidade-caixa-geral");
    } catch (error) {
      state.failedAtStep = 1;
      state.failedReason = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      try {
        if (caixaCriadoId) {
          await archiveCaixaViaApi(login.request, login.cookies, caixaCriadoId);
        }
        state.cleanedUp = true;
      } catch (cleanupError) {
        state.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      }
      await recordResult(chainId, {
        id: chainId,
        status: state.failedReason ? "failed" : "passed",
        caixaCriadoId,
        caixaNome,
        durationMs: Date.now() - startedAt,
        ...state,
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
  const ip = `10.6.${ipSuffix}`;
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

async function caixaIdByNameWithLogin(
  browser: Browser,
  playwright: any,
  userKey: keyof typeof USERS,
  caixaNome: string,
  ipSuffix: string
): Promise<string> {
  const login = await loginAs(browser, playwright, userKey, ipSuffix);
  try {
    await login.page.goto("/app/financeiro");
    return await caixaIdByName(login.page, caixaNome);
  } finally {
    await disposeLogin(login);
  }
}

async function caixaIdByName(page: Page, caixaNome: string): Promise<string> {
  await page.goto("/app/financeiro");
  const href = await page
    .getByTestId("card-saldo-caixa")
    .filter({ hasText: caixaNome })
    .locator("a")
    .first()
    .getAttribute("href");
  expect(href, `href do card ${caixaNome}`).toMatch(/\/app\/financeiro\/caixas\/[0-9a-f-]{36}/);
  return href!.split("/").pop()!;
}

async function isCaixaArchived(page: Page, caixaNome: string): Promise<boolean> {
  await page.goto("/app/financeiro/caixas?mostrarArquivados=true");
  const body = await page.locator("body").innerText();
  return body.includes("Caixas Arquivados") && body.includes(caixaNome);
}

async function archiveCaixaViaUi(page: Page, caixaNome: string): Promise<void> {
  await page.goto("/app/financeiro/caixas");
  await page.getByRole("button", { name: new RegExp(`Arquivar ${caixaNome}`) }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Arquivar" }).click();
  await expect(page.getByText("Caixas Arquivados")).toBeVisible();
  await dbSettle(100);
}

async function reabrirCaixaViaUi(page: Page, caixaNome: string): Promise<void> {
  await page.goto("/app/financeiro/caixas?mostrarArquivados=true");
  const reabrir = page.getByRole("button", { name: new RegExp(`Reabrir ${caixaNome}`) });
  if ((await reabrir.count()) === 0) return;
  await reabrir.first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Reabrir" }).click();
  await expect(page.getByText("Caixas Ativos")).toBeVisible();
  await dbSettle(100);
}

async function archiveCaixaViaApi(
  request: APIRequestContext,
  cookies: Awaited<ReturnType<BrowserContext["cookies"]>>,
  caixaId: string
): Promise<void> {
  const res = await request.post("/app/financeiro/caixas", {
    headers: { cookie: cookieHeader(cookies) },
    form: { _action: "arquivar", caixaId },
  });
  await res.body().catch(() => undefined);
  if (![200, 409].includes(res.status())) {
    throw new Error(`archiveCaixaViaApi status ${res.status()}`);
  }
}

async function createLancamentoViaRequest(
  request: APIRequestContext,
  cookies: Awaited<ReturnType<BrowserContext["cookies"]>>,
  payload: {
    tipo: "ENTRADA" | "SAIDA";
    categoria: string;
    valorDisplay: string;
    caixaId: string;
    membroId: string;
    descricao: string;
  }
): Promise<void> {
  const res = await request.post("/app/financeiro/lancamentos/novo", {
    headers: { cookie: cookieHeader(cookies) },
    form: {
      tipo: payload.tipo,
      categoria: payload.categoria,
      valorDisplay: payload.valorDisplay,
      caixaId: payload.caixaId,
      membroId: payload.membroId,
      dataCompetencia: todayIsoDate(),
      descricao: payload.descricao,
    },
  });
  const body = await res.text();
  if (res.status() >= 400) {
    throw new Error(`createLancamentoViaRequest ${res.status()}: ${body.slice(0, 200)}`);
  }
}

async function disposeLogin(login: LoginResult): Promise<void> {
  try {
    await login.request.post("/logout", { headers: { cookie: cookieHeader(login.cookies) } });
  } catch {
    // Logout idempotente: falha de limpeza não deve mascarar o resultado da chain.
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

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
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
