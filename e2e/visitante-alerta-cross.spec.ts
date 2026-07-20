/**
 * E2E: Visitante→Alerta cross-module — Igreja Conect (S04-T11).
 *
 * Cobre a chain crítica declarada em `qa/S04/e2e-chains.json`: ADMIN
 * configura acolhimento, SECRETARIO cadastra visitante e o responsável
 * recebe/marca o alerta como lido.
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = "http://127.0.0.1:5173";
const QA_DIR = path.resolve(__dirname, "..", "qa", "S04");
const ADMIN_EMAIL = "admin@igreja.local";
const ADMIN_PASSWORD = "admin123";
const SESSION_COOKIE = "__session";
const LOCK_FILE = "/tmp/igreja-conect-e2e-s04.lock";
const TEST_PASSWORD = "s04-e2e-12345";
const SUFFIX = `s04-cross-${randomUUID().slice(0, 8)}`;

let prisma: PrismaClient;

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
  // Usamos slice(1).join("=") para juntar o payload+assinatura de volta.
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
  request: APIRequestContext,
  ip: string,
  email: string,
  password: string,
  chainId: string,
  step: string | number
): Promise<string> {
  const res = await request.post("/login", {
    headers: { "x-forwarded-for": ip },
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

async function createMember(input: {
  nome: string;
  email: string;
  cargo: "SECRETARIO" | null;
}): Promise<{ id: string; email: string }> {
  const created = await prisma.membro.create({
    data: {
      nome: input.nome,
      email: input.email,
      senhaHash: await bcrypt.hash(TEST_PASSWORD, 10),
      tipo: "MEMBRO_ATIVO",
      cargo: input.cargo,
    },
    select: { id: true, email: true },
  });
  return { id: created.id, email: created.email as string };
}

async function cleanupData(ids: { responsavelId?: string; secretarioId?: string; visitanteId?: string }): Promise<void> {
  const memberIds = [ids.responsavelId, ids.secretarioId, ids.visitanteId].filter(Boolean) as string[];
  await prisma.configuracaoGeral.deleteMany({ where: { id: "singleton" } });
  if (memberIds.length > 0) {
    await prisma.alerta.deleteMany({
      where: { OR: [{ destinatarios: { some: { membroId: { in: memberIds } } } }] },
    });
    await prisma.membro.deleteMany({ where: { id: { in: memberIds } } });
  }
}

test.beforeAll(async () => {
  prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: process.env.DATABASE_URL ?? "file:./dev.db",
    }),
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("Chain 1: visitante com config ativa gera alerta e responsável marca lido", async ({ playwright, page }) => {
  const chainId = "E2E-S04-CROSS-1";
  const ip = "10.0.40.13";
  const ctx = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const r = ipRequest(ctx, ip);
  const ids: { responsavelId?: string; secretarioId?: string; visitanteId?: string } = {};
  const releaseLock = await acquireLock(chainId);
  let failed = false;
  let failedAtStep: string | number | null = null;

  try {
    failedAtStep = "setup_responsavel_secretario";
    const responsavel = await createMember({
      nome: `Responsável Cross ${SUFFIX}`,
      email: `responsavel-cross-${SUFFIX}@igreja.local`,
      cargo: null,
    });
    const secretario = await createMember({
      nome: `Secretario Cross ${SUFFIX}`,
      email: `secretario-cross-${SUFFIX}@igreja.local`,
      cargo: "SECRETARIO",
    });
    ids.responsavelId = responsavel.id;
    ids.secretarioId = secretario.id;

    failedAtStep = 1;
    const adminCookie = await loginViaApi(ctx, ip, ADMIN_EMAIL, ADMIN_PASSWORD, chainId, 1);

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
    expect(resConfig.status(), "ADMIN configura responsável").toBe(302);

    failedAtStep = 3;
    const secretarioCookie = await loginViaApi(
      ctx,
      ip,
      secretario.email,
      TEST_PASSWORD,
      chainId,
      3
    );

    failedAtStep = 4;
    const visitanteNome = `Visitante Cross ${SUFFIX}`;
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
    await addSessionToPage(page, await loginViaApi(ctx, ip, responsavel.email, TEST_PASSWORD, chainId, "5-login-responsavel"));
    let body = await gotoAndRecord(page, chainId, 5, "/app/alertas");
    expect(body).toContain("Novo visitante cadastrado");
    expect(body).toContain(visitanteNome);
    expect(body).toContain(visitanteTelefone);

    failedAtStep = 6;
    // Aguarda navegação que o POST/Redirect dispara; clica depois para
    // evitar race entre o navigation e o content() no gotoAndRecord anterior.
    const navPromise = page.waitForURL(/\/app\/alertas(\?|$)/, { timeout: 10000 });
    await page.getByRole("button", { name: "Marcar lido" }).click();
    await navPromise;
    await page.waitForLoadState("networkidle");
    body = await page.content();
    await recordResponse(chainId, 6, { status: 200, headers: {}, body });
    expect(body).not.toContain("Marcar lido");
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
