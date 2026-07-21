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
  discipulador: { email: "discipulador@igreja.local", cargo: "LIDER_MINISTERIO" as const, nome: "Discipulador" },
  financeiro: { email: "financeiro@igreja.local", cargo: "FINANCEIRO" as const, nome: "Financeiro" },
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

test.describe.serial("Estoque básico — S11", () => {

  test("Chain 1: SECRETARIO cria item CONSUMO via /novo e vê badge Consumo", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-STQ-CHAIN-1";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "secretario", "10.11.1");
    let itemId = "";

    try {
      const response = await login.page.goto("/app/estoque");
      await recordPage(chainId, 1, login.page, response, "dashboard");
      expect(response?.status(), "SECRETARIO acessa dashboard").toBe(200);

      await login.page.getByRole("link", { name: "Novo Produto" }).click();
      await expect(login.page).toHaveURL(/\/app\/estoque\/novo$/);
      await recordPage(chainId, 2, login.page, null, "novo-produto-form");

      await login.page.getByLabel("Nome do Produto").fill("Papel A4");
      await login.page.getByLabel("Tipo de Item").selectOption("CONSUMO");
      await login.page.getByLabel(/Quantidade Inicial/i).fill("100");
      await login.page.getByRole("button", { name: "Salvar Produto" }).click();

      await expect(login.page).toHaveURL(/\/app\/estoque\/[0-9a-f-]{36}$/);
      itemId = login.page.url().split("/").pop() ?? "";
      await recordPage(chainId, 3, login.page, null, "detalhe-item-criado");
      await expect(login.page.getByText("Papel A4")).toBeVisible();
      await expect(login.page.getByText("Consumo")).toBeVisible();

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
        id: chainId,
        status: state.failedReason ? "failed" : "passed",
        itemId,
        durationMs: Date.now() - startedAt,
        ...state,
      });
      await disposeLogin(login);
    }
  });

  test("Chain 2: ADMIN cria PATRIMONIO com numeroSerie e vê badges", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-STQ-CHAIN-2";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "admin", "10.11.2");
    let itemId = "";

    try {
      const response = await login.page.goto("/app/estoque/novo");
      await recordPage(chainId, 1, login.page, response, "novo-produto-admin");
      expect(response?.status(), "ADMIN acessa /novo").toBe(200);

      await login.page.getByLabel("Nome do Produto").fill("Projetor BenQ");
      await login.page.getByLabel("Tipo de Item").selectOption("PATRIMONIO");
      await login.page.getByLabel(/Quantidade/i).fill("1");

      const serieInput = login.page.getByLabel("Número de Série");
      await expect(serieInput).toBeVisible();
      await serieInput.fill("PJ-001");

      await login.page.getByRole("button", { name: "Salvar Produto" }).click();
      await expect(login.page).toHaveURL(/\/app\/estoque\/[0-9a-f-]{36}$/);
      itemId = login.page.url().split("/").pop() ?? "";
      await recordPage(chainId, 2, login.page, null, "detalhe-patrimonio");
      await expect(login.page.getByText("Projetor BenQ")).toBeVisible();
      await expect(login.page.getByText("Patrimônio")).toBeVisible();
      await expect(login.page.getByText("Disponível")).toBeVisible();

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
        id: chainId,
        status: state.failedReason ? "failed" : "passed",
        itemId,
        durationMs: Date.now() - startedAt,
        ...state,
      });
      await disposeLogin(login);
    }
  });

  test("Chain 3: DISCIPULADOR vê lista mas NÃO vê botão Novo Produto", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-STQ-CHAIN-3";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "discipulador", "10.11.3");

    try {
      const response = await login.page.goto("/app/estoque");
      await recordPage(chainId, 1, login.page, response, "dashboard-discipulador");
      expect(response?.status(), "DISCIPULADOR acessa dashboard").toBe(200);
      await expect(login.page.getByRole("heading", { name: "Estoque" })).toBeVisible();

      const itensNaTabela = login.page.locator("table tbody tr");
      const count = await itensNaTabela.count();
      expect(count, "DISCIPULADOR vê itens na lista").toBeGreaterThan(0);

      await expect(login.page.getByRole("link", { name: "Novo Produto" })).toHaveCount(0);
      const cadastroRapido = login.page.getByRole("button", { name: /Cadastro Rápido/i });
      await expect(cadastroRapido).toHaveCount(0);
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

  test("Chain 4: FINANCEIRO recebe 403 ao acessar /app/estoque/novo", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-STQ-CHAIN-4";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "financeiro", "10.11.4");

    try {
      const response = await login.page.goto("/app/estoque/novo");
      await recordPage(chainId, 1, login.page, response, "novo-403");
      expect(response?.status(), "FINANCEIRO em /novo").toBe(403);
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

  test("Chain 5: FINANCEIRO POST /app/estoque com intent=criar → 403", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-STQ-CHAIN-5";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "financeiro", "10.11.5");

    try {
      const post = await login.request.post("/app/estoque", {
        headers: { cookie: cookieHeader(login.cookies) },
        form: {
          intent: "criar",
          nome: "Item Proibido",
          tipo: "CONSUMO",
          quantidade: "10",
          quantidadeMinima: "2",
          localizacaoFisica: "Cozinha",
        },
      });
      const body = await post.text();
      await recordResponse(chainId, 1, {
        status: post.status(),
        headers: post.headers(),
        body: body.slice(0, 2000),
      });
      expect(post.status(), "FINANCEIRO cria item → 403").toBe(403);
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

  test("Chain 6: SECRETARIO POST PATRIMONIO sem numeroSerie → 422", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-STQ-CHAIN-6";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "secretario", "10.11.6");

    try {
      const post = await login.request.post("/app/estoque/novo", {
        headers: { cookie: cookieHeader(login.cookies) },
        form: {
          nome: "Item Sem Serie",
          tipo: "PATRIMONIO",
          quantidade: "1",
          quantidadeMinima: "1",
        },
      });
      const body = await post.text();
      await recordResponse(chainId, 1, {
        status: post.status(),
        headers: post.headers(),
        body: body.slice(0, 2000),
      });
      expect(post.status(), "PATRIMONIO sem numeroSerie → 422").toBe(422);
      expect(body, "mensagem de erro validação").toMatch(/série|serie|obrigatório/i);
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

  test("Chain 7: ADMIN cria PATRIMONIO com numeroSerie duplicado → 409", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-STQ-CHAIN-7";
    const startedAt = Date.now();
    const state: ChainState = {};
    const login = await loginAs(browser, playwright, "admin", "10.11.7");
    let primeiroId = "";

    try {
      const post1 = await login.request.post("/app/estoque/novo", {
        headers: { cookie: cookieHeader(login.cookies) },
        form: {
          nome: "Projetor Duplicado",
          tipo: "PATRIMONIO",
          quantidade: "1",
          numeroSerie: "SN-DUP-777",
          localizacaoFisica: "Escritório",
        },
      });
      const body1 = await post1.text();
      await recordResponse(chainId, 1, {
        status: post1.status(),
        headers: post1.headers(),
        body: body1.slice(0, 1000),
      });
      if (post1.status() >= 200 && post1.status() < 400) {
        primeiroId = body1.match(/\/app\/estoque\/([0-9a-f-]{36})/)?.[1] ?? "";
      }

      const post2 = await login.request.post("/app/estoque/novo", {
        headers: { cookie: cookieHeader(login.cookies) },
        form: {
          nome: "Projetor Duplicado 2",
          tipo: "PATRIMONIO",
          quantidade: "1",
          numeroSerie: "SN-DUP-777",
          localizacaoFisica: "Escritório",
        },
      });
      const body2 = await post2.text();
      await recordResponse(chainId, 2, {
        status: post2.status(),
        headers: post2.headers(),
        body: body2.slice(0, 2000),
      });
      expect(post2.status(), "duplicata numeroSerie → 409").toBe(409);
      expect(body2, "mensagem de duplicidade").toMatch(/já cadastrado|número de série|duplicado/i);
    } catch (error) {
      state.failedAtStep = 1;
      state.failedReason = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      try {
        if (primeiroId) {
          await prisma.itemEstoque.deleteMany({ where: { id: primeiroId } }).catch(() => {});
          await dbSettle(50);
        }
        state.cleanedUp = true;
      } catch (cleanupError) {
        state.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      }
      await recordResult(chainId, {
        id: chainId,
        status: state.failedReason ? "failed" : "passed",
        primeiroId,
        durationMs: Date.now() - startedAt,
        ...state,
      });
      await disposeLogin(login);
    }
  });

  test("Chain 8: SECRETARIO cria 5 itens → ADMIN verifica dashboard", async ({
    browser,
    playwright,
  }) => {
    const chainId = "E2E-STQ-CHAIN-8";
    const startedAt = Date.now();
    const state: ChainState = {};
    const loginSec = await loginAs(browser, playwright, "secretario", "10.11.8-sec");
    const itemIds: string[] = [];

    try {
      for (let i = 1; i <= 5; i++) {
        const post = await loginSec.request.post("/app/estoque/novo", {
          headers: { cookie: cookieHeader(loginSec.cookies) },
          form: {
            nome: `Item E2E Chain8 #${i}`,
            tipo: "CONSUMO",
            quantidade: String(i * 10),
            localizacaoFisica: "Cozinha",
          },
        });
        const body = await post.text();
        await recordResponse(chainId, i, {
          status: post.status(),
          headers: post.headers(),
          body: body.slice(0, 500),
        });
        const id = body.match(/\/app\/estoque\/([0-9a-f-]{36})/)?.[1];
        if (id) itemIds.push(id);
      }
      expect(itemIds.length, "5 itens criados com sucesso").toBe(5);

      await disposeLogin(loginSec);

      const loginAdmin = await loginAs(browser, playwright, "admin", "10.11.8-admin");
      try {
        const response = await loginAdmin.page.goto("/app/estoque");
        await recordPage(chainId, 6, loginAdmin.page, response, "dashboard-admin-pos-criacao");
        expect(response?.status(), "ADMIN acessa dashboard").toBe(200);

        await expect(
          loginAdmin.page.getByText("Item E2E Chain8 #1")
        ).toBeVisible();
        await expect(
          loginAdmin.page.getByText("Item E2E Chain8 #5")
        ).toBeVisible();

        const totalItens = await loginAdmin.page.locator("table tbody tr").count();
        expect(totalItens, "dash contém todos os itens").toBeGreaterThanOrEqual(5);
      } finally {
        await disposeLogin(loginAdmin);
      }
    } catch (error) {
      state.failedAtStep = 1;
      state.failedReason = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      try {
        if (itemIds.length > 0) {
          await prisma.itemEstoque.deleteMany({ where: { id: { in: itemIds } } }).catch(() => {});
          await dbSettle(50);
        }
        state.cleanedUp = true;
      } catch (cleanupError) {
        state.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      }
      await recordResult(chainId, {
        id: chainId,
        status: state.failedReason ? "failed" : "passed",
        itemCount: itemIds.length,
        durationMs: Date.now() - startedAt,
        ...state,
      });
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
  const ip = `10.11.${ipSuffix}`;
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
