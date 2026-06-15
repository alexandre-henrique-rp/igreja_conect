/**
 * E2E: Central de Alertas — Igreja Conect (S04-T11).
 *
 * Cobre 7 chains declaradas em `qa/S04/e2e-chains.json`: visitante→alerta,
 * rollback observável, marcar lido, marcar resolvido, privacidade LGPD,
 * escopo por destinatário e filtros Todos/Não lidos/Resolvidos.
 */
import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";

test.describe.configure({ mode: "serial" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = "http://127.0.0.1:5173";
const QA_DIR = path.resolve(__dirname, "..", "qa", "S04");
const ADMIN_EMAIL = "admin@igreja.local";
const ADMIN_PASSWORD = "admin123";
const SESSION_COOKIE = "__session";
const LOCK_FILE = "/tmp/igreja-conect-e2e-s04.lock";
const TEST_PASSWORD = "s04-e2e-12345";
const SUFFIX = `s04-alert-${randomUUID().slice(0, 8)}`;

type RequestContext = {
  request: APIRequestContext;
  ip: string;
};

type SeedIds = {
  adminTestId?: string;
  secretarioId?: string;
  responsavelId?: string;
  userAId?: string;
  userBId?: string;
  visitanteId?: string;
  existenteId?: string;
  alertaIds: string[];
};

let prisma: PrismaClient;
let seed: SeedIds;

async function recordResponse(
  chainId: string,
  step: string | number,
  data: { status: number; headers: Record<string, string>; body: string }
): Promise<void> {
  const dir = path.join(QA_DIR, "responses");
  await fs.mkdir(dir, { recursive: true });
  const label = typeof step === "number" ? String(step).padStart(2, "0") : step;
  await fs.writeFile(
    path.join(dir, `${chainId}-${label}.json`),
    JSON.stringify(data, null, 2),
    "utf-8"
  );
}

async function recordResult(chainId: string, data: unknown): Promise<void> {
  const dir = path.join(QA_DIR, "results");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, `${chainId}.json`),
    JSON.stringify(data, null, 2),
    "utf-8"
  );
}

function ipRequest(request: APIRequestContext, isolatedIp: string) {
  const headers = { "x-forwarded-for": isolatedIp };
  return {
    get: async (pathname: string, cookies?: string) =>
      request.get(pathname, {
        headers: { ...headers, ...(cookies ? { cookie: cookies } : {}) },
        maxRedirects: 0,
      }),
    post: async (pathname: string, formData: Record<string, string>, cookies?: string) =>
      request.post(pathname, {
        headers: { ...headers, ...(cookies ? { cookie: cookies } : {}) },
        form: formData,
        maxRedirects: 0,
      }),
  };
}

function cookiesFromSession(cookieValue: string) {
  return `${SESSION_COOKIE}=${cookieValue}`;
}

function extractSessionCookie(setCookie: string): string | null {
  const match = setCookie.match(/__session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function toPlaywrightCookie(setCookie: string) {
  const parts = setCookie.split(";").map((part) => part.trim());
  const [nameValue] = parts;
  // O cookie tem formato "name=<base64>.<sig>". O split("=") padrão
  // descarta a parte depois do segundo "=", perdendo a assinatura HMAC.
  // Usamos slice para juntar o payload+assinatura de volta.
  const eqIdx = nameValue.indexOf("=");
  const name = nameValue.slice(0, eqIdx);
  const value = nameValue.slice(eqIdx + 1);
  const expiresPart = parts.find((part) => part.toLowerCase().startsWith("expires="));
  const expires = expiresPart
    ? Math.floor(new Date(expiresPart.slice("expires=".length)).getTime() / 1000)
    : Math.floor((Date.now() + 7 * 24 * 60 * 60 * 1000) / 1000);

  return {
    name,
    value,
    domain: "127.0.0.1",
    path: "/",
    expires,
    httpOnly: parts.some((part) => part.toLowerCase() === "httponly"),
    secure: false,
    sameSite: "Lax" as const,
  };
}

async function loginViaApi(
  ctx: RequestContext,
  email: string,
  password: string,
  chainId: string,
  step: string | number
): Promise<string> {
  const res = await ctx.request.post("/login", {
    headers: { "x-forwarded-for": ctx.ip },
    form: { email, senha: password },
    maxRedirects: 0,
  });
  const setCookie = res.headers()["set-cookie"] ?? "";
  await recordResponse(chainId, step, {
    status: res.status(),
    headers: res.headers(),
    body: setCookie,
  });
  expect(res.status(), `${chainId} login ${email}`).toBe(302);
  const cookieValue = extractSessionCookie(setCookie);
  expect(cookieValue, `${chainId} cookie extraído`).toBeTruthy();
  return cookieValue as string;
}

async function addSessionToPage(page: Page, cookieValue: string): Promise<void> {
  await page.context().addCookies([toPlaywrightCookie(`${SESSION_COOKIE}=${cookieValue}`)]);
}

async function gotoAndRecord(
  page: Page,
  chainId: string,
  step: string | number,
  urlPath: string
): Promise<string> {
  const response = await page.goto(`${BASE_URL}${urlPath}`, { waitUntil: "networkidle" });
  const body = await page.content();
  await recordResponse(chainId, step, {
    status: response?.status() ?? 0,
    headers: response?.headers() ?? {},
    body,
  });
  expect(response?.status(), `${chainId} GET ${urlPath}`).toBe(200);
  return body;
}

async function acquireLock(chainId: string): Promise<() => Promise<void>> {
  const started = Date.now();
  while (true) {
    try {
      const handle = await fs.open(LOCK_FILE, "wx");
      await handle.writeFile(`${chainId}\n`);
      await handle.close();
      return async () => {
        await fs.rm(LOCK_FILE, { force: true });
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;
      const stat = await fs.stat(LOCK_FILE).catch(() => null);
      const stale = stat && Date.now() - stat.mtimeMs > 60_000;
      if (stale) {
        await fs.rm(LOCK_FILE, { force: true });
        continue;
      }
      if (Date.now() - started > 90_000) {
        throw new Error(`Timeout aguardando lock E2E S04: ${chainId}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
}

async function cleanupData(ids: SeedIds): Promise<void> {
  const memberIds = [
    ids.adminTestId,
    ids.secretarioId,
    ids.responsavelId,
    ids.userAId,
    ids.userBId,
    ids.visitanteId,
    ids.existenteId,
  ].filter(Boolean) as string[];

  if (ids.alertaIds.length > 0) {
    await prisma.alerta.deleteMany({ where: { id: { in: ids.alertaIds } } });
  }
  await prisma.configAcolhimento.deleteMany({ where: { id: "singleton" } });
  if (memberIds.length > 0) {
    await prisma.membro.deleteMany({ where: { id: { in: memberIds } } });
  }
}

async function createMember(input: {
  nome: string;
  email: string;
  cargo?: "ADMIN" | "SECRETARIO" | null;
  senha?: boolean;
}): Promise<{ id: string; email: string }> {
  const created = await prisma.membro.create({
    data: {
      nome: input.nome,
      email: input.email,
      senhaHash: input.senha ? await bcrypt.hash(TEST_PASSWORD, 10) : null,
      tipo: input.cargo ? "MEMBRO_ATIVO" : "VISITANTE",
      cargo: input.cargo ?? null,
    },
    select: { id: true, email: true },
  });
  return { id: created.id, email: created.email as string };
}

async function createAlerta(destinatarioId: string, opts: { titulo?: string; mensagem?: string; lido?: boolean; resolvido?: boolean } = {}) {
  // O estado `lido`/`resolvido` é por destinatário (RN §3.2 — security), então
  // o helper deve atualizar o `AlertaDestinatario` (e não `Alerta` global).
  const alerta = await prisma.alerta.create({
    data: {
      titulo: opts.titulo ?? "Alerta E2E",
      mensagem: opts.mensagem ?? "Mensagem do alerta E2E",
      destinatarios: {
        create: {
          membroId: destinatarioId,
          lido: opts.lido ?? false,
          resolvido: opts.resolvido ?? false,
        },
      },
    },
  });
  if (opts.resolvido) {
    await prisma.alertaDestinatario.updateMany({
      where: { alertaId: alerta.id, membroId: destinatarioId },
      data: { lido: true, resolvido: true },
    });
  } else if (opts.lido) {
    await prisma.alertaDestinatario.updateMany({
      where: { alertaId: alerta.id, membroId: destinatarioId },
      data: { lido: true },
    });
  }
  return alerta;
}

test.beforeAll(async () => {
  prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: process.env.DATABASE_URL ?? "file:./dev.db",
    }),
  });
  const hash = await bcrypt.hash(TEST_PASSWORD, 10);
  seed = { alertaIds: [] };
  const common = { senhaHash: hash, tipo: "MEMBRO_ATIVO" as const };
  seed.secretarioId = (
    await prisma.membro.upsert({
      where: { email: `secretario+${SUFFIX}@igreja.local` },
      update: common,
      create: { ...common, nome: `Secretario S04 ${SUFFIX}`, email: `secretario+${SUFFIX}@igreja.local`, cargo: "SECRETARIO" },
      select: { id: true },
    })
  ).id;
  seed.userAId = (
    await prisma.membro.upsert({
      where: { email: `userA+${SUFFIX}@igreja.local` },
      update: common,
      create: { ...common, nome: `User A S04 ${SUFFIX}`, email: `userA+${SUFFIX}@igreja.local`, cargo: null },
      select: { id: true },
    })
  ).id;
  seed.userBId = (
    await prisma.membro.upsert({
      where: { email: `userB+${SUFFIX}@igreja.local` },
      update: common,
      create: { ...common, nome: `User B S04 ${SUFFIX}`, email: `userB+${SUFFIX}@igreja.local`, cargo: null },
      select: { id: true },
    })
  ).id;
});

test.afterAll(async () => {
  await cleanupData(seed);
  await prisma.$disconnect();
});

test("Chain 1: visitante→alerta — responsável vê nome e telefone", async ({ playwright, page }) => {
  const chainId = "E2E-S04-ALERT-1";
  const ip = "10.0.40.1";
  const ctx = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const r = ipRequest(ctx, ip);
  const ids: SeedIds = { alertaIds: [] };
  const releaseLock = await acquireLock(chainId);
  let failedAtStep: string | number | null = null;
  let failed = false;

  try {
    failedAtStep = "setup_responsavel";
    const responsavel = await createMember({
      nome: `Responsável Alerta ${SUFFIX}`,
      email: `responsavel-alert-${SUFFIX}@igreja.local`,
      cargo: null,
      senha: true,
    });
    ids.responsavelId = responsavel.id;

    failedAtStep = 1;
    const adminCookie = await loginViaApi({ request: ctx, ip }, ADMIN_EMAIL, ADMIN_PASSWORD, chainId, 1);

    failedAtStep = 2;
    const resConfig = await r.post(
      "/app/config/acolhimento",
      { responsavelVisitanteTipo: "MEMBRO", responsavelId: responsavel.id },
      cookiesFromSession(adminCookie)
    );
    await recordResponse(chainId, 2, {
      status: resConfig.status(),
      headers: resConfig.headers(),
      body: await resConfig.text(),
    });
    expect(resConfig.status(), "ADMIN configura acolhimento").toBe(302);

    failedAtStep = 3;
    const secretarioCookie = await loginViaApi(
      { request: ctx, ip },
      `secretario+${SUFFIX}@igreja.local`,
      TEST_PASSWORD,
      chainId,
      3
    );

    failedAtStep = 4;
    const visitanteNome = `Visitante Alerta ${SUFFIX}`;
    const visitanteTelefone = `119${String(Date.now()).slice(-8)}`;
    const resVisitante = await r.post(
      "/app/membros/novo",
      { nome: visitanteNome, tipo: "VISITANTE", telefone: visitanteTelefone },
      cookiesFromSession(secretarioCookie)
    );
    await recordResponse(chainId, 4, {
      status: resVisitante.status(),
      headers: resVisitante.headers(),
      body: await resVisitante.text(),
    });
    expect(resVisitante.status(), "SECRETARIO cadastra visitante").toBe(302);
    const location = resVisitante.headers().location ?? "";
    const visitanteId = location.match(/\/membros\/([a-f0-9-]+)/i)?.[1];
    expect(visitanteId, "visitanteId extraído").toBeTruthy();
    ids.visitanteId = visitanteId as string;

    failedAtStep = 5;
    await addSessionToPage(page, await loginViaApi({ request: ctx, ip }, responsavel.email as string, TEST_PASSWORD, chainId, "5-login-responsavel"));
    const body = await gotoAndRecord(page, chainId, 5, "/app/alertas");
    expect(body).toContain("Novo visitante cadastrado");
    expect(body).toContain(visitanteNome);
    expect(body).toContain(visitanteTelefone);
  } catch (error) {
    failed = true;
    await recordResult(chainId, { id: chainId, status: "failed", failedAtStep, error: (error as Error).message });
    throw error;
  } finally {
    await cleanupData(ids);
    await releaseLock();
    await ctx.dispose();
    await recordResult(chainId, { id: chainId, status: failed ? "failed" : "passed", cleanup: "executed" });
  }
});

test("Chain 2: atomicidade — falha observável não deixa visitante nem alerta", async ({ playwright }) => {
  const chainId = "E2E-S04-ALERT-2";
  const ip = "10.0.40.2";
  const ctx = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const r = ipRequest(ctx, ip);
  const ids: SeedIds = { alertaIds: [] };
  const releaseLock = await acquireLock(chainId);
  let failedAtStep: string | number | null = null;
  let failed = false;

  try {
    failedAtStep = "setup_responsavel";
    const responsavel = await createMember({
      nome: `Responsável Atomicidade ${SUFFIX}`,
      email: `responsavel-atomic-${SUFFIX}@igreja.local`,
      cargo: null,
      senha: true,
    });
    ids.responsavelId = responsavel.id;

    failedAtStep = 1;
    const adminCookie = await loginViaApi({ request: ctx, ip }, ADMIN_EMAIL, ADMIN_PASSWORD, chainId, 1);
    failedAtStep = 2;
    const resConfig = await r.post(
      "/app/config/acolhimento",
      { responsavelVisitanteTipo: "MEMBRO", responsavelId: responsavel.id },
      cookiesFromSession(adminCookie)
    );
    await recordResponse(chainId, 2, {
      status: resConfig.status(),
      headers: resConfig.headers(),
      body: await resConfig.text(),
    });
    expect(resConfig.status(), "config ativa").toBe(302);

    failedAtStep = 3;
    const secretarioCookie = await loginViaApi(
      { request: ctx, ip },
      `secretario+${SUFFIX}@igreja.local`,
      TEST_PASSWORD,
      chainId,
      3
    );

    failedAtStep = 4;
    const emailDuplicado = `duplicado-atomic-${SUFFIX}@igreja.local`;
    const resExistente = await r.post(
      "/app/membros/novo",
      { nome: "Existente Atomicidade", tipo: "CONGREGADO", email: emailDuplicado },
      cookiesFromSession(secretarioCookie)
    );
    await recordResponse(chainId, 4, {
      status: resExistente.status(),
      headers: resExistente.headers(),
      body: await resExistente.text(),
    });
    expect(resExistente.status(), "cria membro existente").toBe(302);
    const existenteId = (resExistente.headers().location ?? "").match(/\/membros\/([a-f0-9-]+)/i)?.[1];
    expect(existenteId).toBeTruthy();
    ids.existenteId = existenteId as string;

    failedAtStep = 5;
    const resDuplicado = await r.post(
      "/app/membros/novo",
      { nome: "Duplicado Atomicidade", tipo: "VISITANTE", email: emailDuplicado, telefone: "11912345678" },
      cookiesFromSession(secretarioCookie)
    );
    const bodyDuplicado = await resDuplicado.text();
    await recordResponse(chainId, 5, {
      status: resDuplicado.status(),
      headers: resDuplicado.headers(),
      body: bodyDuplicado,
    });
    expect([422, 500], "falha esperada no cadastro duplicado").toContain(resDuplicado.status());

    const countMembros = await prisma.membro.count({ where: { email: emailDuplicado } });
    const countAlertas = await prisma.alerta.count({ where: { mensagem: { contains: "Duplicado Atomicidade" } } });
    expect(countMembros, "apenas membro existente permanece").toBe(1);
    expect(countAlertas, "nenhum alerta parcial").toBe(0);
  } catch (error) {
    failed = true;
    await recordResult(chainId, { id: chainId, status: "failed", failedAtStep, error: (error as Error).message });
    throw error;
  } finally {
    await cleanupData(ids);
    await releaseLock();
    await ctx.dispose();
    await recordResult(chainId, { id: chainId, status: failed ? "failed" : "passed", cleanup: "executed" });
  }
});

test("Chain 3: marcar lido — botão some após ação", async ({ playwright, page }) => {
  const chainId = "E2E-S04-ALERT-3";
  const ip = "10.0.40.3";
  const ctx = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const ids: SeedIds = { alertaIds: [] };
  let failedAtStep: string | number | null = null;
  let failed = false;

  try {
    failedAtStep = "setup_destinatario_alerta";
    const destinatario = await createMember({
      nome: `Destinatário Lido ${SUFFIX}`,
      email: `dest-lido-${SUFFIX}@igreja.local`,
      cargo: null,
      senha: true,
    });
    ids.responsavelId = destinatario.id;
    const alerta = await createAlerta(destinatario.id, { titulo: "Alerta Lido E2E", mensagem: "Clique em marcar lido" });
    ids.alertaIds.push(alerta.id);

    failedAtStep = 2;
    const cookie = await loginViaApi(
      { request: ctx, ip },
      destinatario.email as string,
      TEST_PASSWORD,
      chainId,
      2
    );
    await addSessionToPage(page, cookie);
    failedAtStep = 3;
    let body = await gotoAndRecord(page, chainId, 3, "/app/alertas");
    expect(body).toContain("Alerta Lido E2E");
    expect(body).toContain("Marcar lido");

    failedAtStep = 4;
    // Captura navegação em paralelo com o click (evita ERR_ABORTED e race
    // com page.content() durante a transição)
    const navPromiseChain3 = page.waitForURL(/\/app\/alertas(\?|$)/, { timeout: 10000 });
    await page.getByRole("button", { name: "Marcar lido" }).click();
    await navPromiseChain3;
    await page.waitForLoadState("networkidle");
    body = await page.content();
    await recordResponse(chainId, 4, { status: 200, headers: {}, body });
    // Valida pelos <h3> renderizados (não pelo body inteiro, que inclui JSON
    // encoded do RR7 com todos os alertas)
    const titulosAposLido = await page
      .getByTestId("card-alerta")
      .locator("h3")
      .allInnerTexts();
    expect(
      titulosAposLido.some((t) => t.includes("Alerta Lido E2E")) && titulosAposLido.length === 1,
      "Alerta continua mas botão Marcar lido sumiu"
    ).toBe(true);
  } catch (error) {
    failed = true;
    await recordResult(chainId, { id: chainId, status: "failed", failedAtStep, error: (error as Error).message });
    throw error;
  } finally {
    await cleanupData(ids);
    await ctx.dispose();
    await recordResult(chainId, { id: chainId, status: failed ? "failed" : "passed", cleanup: "executed" });
  }
});

test("Chain 4: marcar resolvido — card some do filtro Não lidos", async ({ playwright, page }) => {
  const chainId = "E2E-S04-ALERT-4";
  const ip = "10.0.40.4";
  const ctx = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const ids: SeedIds = { alertaIds: [] };
  let failedAtStep: string | number | null = null;
  let failed = false;

  try {
    failedAtStep = "setup_admin_alerta";
    const adminTeste = await createMember({
      nome: `Admin Resolve ${SUFFIX}`,
      email: `admin-resolve-${SUFFIX}@igreja.local`,
      cargo: "ADMIN",
      senha: true,
    });
    ids.adminTestId = adminTeste.id;
    const alerta = await createAlerta(adminTeste.id, { titulo: "Alerta Resolver E2E", mensagem: "Clique em resolver" });
    ids.alertaIds.push(alerta.id);

    failedAtStep = 2;
    const cookie = await loginViaApi({ request: ctx, ip }, adminTeste.email as string, TEST_PASSWORD, chainId, 2);
    await addSessionToPage(page, cookie);
    failedAtStep = 3;
    let body = await gotoAndRecord(page, chainId, 3, "/app/alertas");
    expect(body).toContain("Alerta Resolver E2E");
    // Botão "Resolver" só aparece quando `lido && !resolvido`. Marcamos
    // como lido primeiro.
    expect(body).toContain("Marcar lido");

    failedAtStep = "step-marcar-lido";
    const navMarcarLido = page.waitForURL(/\/app\/alertas(\?|$)/, { timeout: 10000 });
    await page.getByRole("button", { name: "Marcar lido" }).click();
    await navMarcarLido;
    await page.waitForLoadState("networkidle");

    failedAtStep = 4;
    body = await gotoAndRecord(page, chainId, 4, "/app/alertas");
    expect(body).toContain("Resolver");
    // Aguarda navegação que o POST/Redirect dispara; clica depois para
    // evitar race entre o navigation e o content() no gotoAndRecord anterior.
    const navResolve = page.waitForURL(/\/app\/alertas(\?|$)/, { timeout: 10000 });
    await page.getByRole("button", { name: "Resolver" }).click();
    await navResolve;
    await page.waitForLoadState("networkidle");
    body = await page.content();
    await recordResponse(chainId, 4, { status: 200, headers: {}, body });

    failedAtStep = 5;
    // Pequeno delay para garantir que o POST anterior terminou antes de navegar
    await page.waitForTimeout(500);
    body = await gotoAndRecord(page, chainId, 5, "/app/alertas?filter=naoLidos");
    expect(body).not.toContain("Alerta Resolver E2E");
  } catch (error) {
    failed = true;
    await recordResult(chainId, { id: chainId, status: "failed", failedAtStep, error: (error as Error).message });
    throw error;
  } finally {
    await cleanupData(ids);
    await ctx.dispose();
    await recordResult(chainId, { id: chainId, status: failed ? "failed" : "passed", cleanup: "executed" });
  }
});

test("Chain 5: privacidade LGPD — body não contém email nem senhaHash", async ({ playwright }) => {
  const chainId = "E2E-S04-ALERT-5";
  const ip = "10.0.40.5";
  const ctx = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const r = ipRequest(ctx, ip);
  const ids: SeedIds = { alertaIds: [] };
  let failedAtStep: string | number | null = null;
  let failed = false;

  try {
    failedAtStep = "setup_destinatario_privacidade";
    const destinatario = await createMember({
      nome: `Destinatário LGPD ${SUFFIX}`,
      email: `dest-lgpd-${SUFFIX}@igreja.local`,
      cargo: null,
      senha: true,
    });
    ids.responsavelId = destinatario.id;
    const alerta = await createAlerta(destinatario.id, {
      titulo: "Alerta LGPD",
      mensagem: `Visitante ${SUFFIX} - Tel: 11912345678`,
    });
    ids.alertaIds.push(alerta.id);

    failedAtStep = 2;
    const cookie = await loginViaApi(
      { request: ctx, ip },
      destinatario.email as string,
      TEST_PASSWORD,
      chainId,
      2
    );
    failedAtStep = 3;
    const res = await r.get("/app/alertas", cookiesFromSession(cookie));
    const body = await res.text();
    await recordResponse(chainId, 3, { status: res.status(), headers: res.headers(), body });
    expect(res.status(), "GET /app/alertas").toBe(200);
    expect(body).not.toContain("email");
    expect(body).not.toContain("senhaHash");
  } catch (error) {
    failed = true;
    await recordResult(chainId, { id: chainId, status: "failed", failedAtStep, error: (error as Error).message });
    throw error;
  } finally {
    await cleanupData(ids);
    await ctx.dispose();
    await recordResult(chainId, { id: chainId, status: failed ? "failed" : "passed", cleanup: "executed" });
  }
});

test("Chain 6: escopo — user A não vê alertas de user B", async ({ playwright }) => {
  const chainId = "E2E-S04-ALERT-6";
  const ip = "10.0.40.6";
  const ctx = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const r = ipRequest(ctx, ip);
  const ids: SeedIds = { alertaIds: [] };
  let failedAtStep: string | number | null = null;
  let failed = false;

  try {
    failedAtStep = "setup_userB_alerta";
    const alerta = await createAlerta(seed.userBId as string, {
      titulo: "Alerta Exclusivo User B",
      mensagem: "User B somente",
    });
    ids.alertaIds.push(alerta.id);

    failedAtStep = 2;
    const cookie = await loginViaApi(
      { request: ctx, ip },
      `userA+${SUFFIX}@igreja.local`,
      TEST_PASSWORD,
      chainId,
      2
    );
    failedAtStep = 3;
    const res = await r.get("/app/alertas", cookiesFromSession(cookie));
    const body = await res.text();
    await recordResponse(chainId, 3, { status: res.status(), headers: res.headers(), body });
    expect(res.status(), "GET alertas como user A").toBe(200);
    expect(body).not.toContain("Alerta Exclusivo User B");
  } catch (error) {
    failed = true;
    await recordResult(chainId, { id: chainId, status: "failed", failedAtStep, error: (error as Error).message });
    throw error;
  } finally {
    await cleanupData(ids);
    await ctx.dispose();
    await recordResult(chainId, { id: chainId, status: failed ? "failed" : "passed", cleanup: "executed" });
  }
});

test("Chain 7: filtros — abas Todos/Não lidos/Resolvidos alteram a lista", async ({ playwright, page }) => {
  const chainId = "E2E-S04-ALERT-7";
  const ip = "10.0.40.7";
  const ctx = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const ids: SeedIds = { alertaIds: [] };
  let failedAtStep: string | number | null = null;
  let failed = false;

  try {
    failedAtStep = "setup_alertas_filtro";
    const destinatario = await createMember({
      nome: `Destinatário Filtro ${SUFFIX}`,
      email: `dest-filtro-${SUFFIX}@igreja.local`,
      cargo: null,
      senha: true,
    });
    ids.responsavelId = destinatario.id;
    const naoLido = await createAlerta(destinatario.id, { titulo: "Não Lido Filtro", mensagem: "Apenas não lido" });
    const resolvido = await createAlerta(destinatario.id, { titulo: "Resolvido Filtro", mensagem: "Apenas resolvido", lido: true, resolvido: true });
    ids.alertaIds.push(naoLido.id, resolvido.id);

    failedAtStep = 2;
    const cookie = await loginViaApi(
      { request: ctx, ip },
      destinatario.email as string,
      TEST_PASSWORD,
      chainId,
      2
    );
    await addSessionToPage(page, cookie);

    failedAtStep = 3;
    let body = await gotoAndRecord(page, chainId, 3, "/app/alertas");
    expect(body).toContain('data-testid="tabs-filtro-alertas"');
    expect(body).toContain("Todos");
    expect(body).toContain("Não lidos");
    expect(body).toContain("Resolvidos");

    failedAtStep = 4;
    // A topbar também tem um link com nome "Não lidos" (badge).
    // Filtra pelo testid das abas para evitar ambiguidade.
    await page
      .getByTestId("tabs-filtro-alertas")
      .getByRole("link", { name: "Não lidos" })
      .click();
    await page.waitForURL(/filter=naoLidos/);
    await page.waitForLoadState("networkidle");
    body = await page.content();
    await recordResponse(chainId, 4, { status: 200, headers: {}, body });
    // Validar contra os títulos renderizados (<h3> dentro de card-alerta)
    // e não contra o body inteiro, porque o body inclui o JSON serializado
    // do RR7 com todos os itens mesmo os filtrados.
    const titulosNaoLidos = await page
      .getByTestId("card-alerta")
      .locator("h3")
      .allInnerTexts();
    expect(titulosNaoLidos, "filtro Não lidos mostra só não lido").toEqual([
      "Não Lido Filtro",
    ]);

    failedAtStep = 5;
    await page
      .getByTestId("tabs-filtro-alertas")
      .getByRole("link", { name: "Resolvidos" })
      .click();
    await page.waitForURL(/filter=resolvidos/);
    await page.waitForLoadState("networkidle");
    body = await page.content();
    await recordResponse(chainId, 5, { status: 200, headers: {}, body });
    const titulosResolvidos = await page
      .getByTestId("card-alerta")
      .locator("h3")
      .allInnerTexts();
    expect(titulosResolvidos, "filtro Resolvidos mostra só resolvido").toEqual([
      "Resolvido Filtro",
    ]);
  } catch (error) {
    failed = true;
    await recordResult(chainId, { id: chainId, status: "failed", failedAtStep, error: (error as Error).message });
    throw error;
  } finally {
    await cleanupData(ids);
    await ctx.dispose();
    await recordResult(chainId, { id: chainId, status: failed ? "failed" : "passed", cleanup: "executed" });
  }
});
