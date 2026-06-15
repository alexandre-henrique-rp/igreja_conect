/**
 * E2E: Configuração de Acolhimento — Igreja Conect (S04-T11).
 *
 * Cobre 5 chains declaradas em `qa/S04/e2e-chains.json`: ADMIN vê form,
 * ADMIN salva Membro, ADMIN troca para Ministério, SECRETARIO vê bloqueio
 * e SECRETARIO POST direto retorna 403.
 */
import {
  test,
  expect,
  type APIRequestContext,
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
const SUFFIX = `s04-config-${randomUUID().slice(0, 8)}`;

type SeedIds = {
  secretarioId: string;
  responsavelId: string;
  ministerioId: string;
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
  cargo: "ADMIN" | "SECRETARIO" | null;
}): Promise<{ id: string }> {
  return prisma.membro.create({
    data: {
      nome: input.nome,
      email: input.email,
      senhaHash: await bcrypt.hash(TEST_PASSWORD, 10),
      tipo: "MEMBRO_ATIVO",
      cargo: input.cargo,
    },
  });
}

async function resetConfig(): Promise<void> {
  await prisma.configAcolhimento.deleteMany({ where: { id: "singleton" } });
}

async function cleanupSeed(): Promise<void> {
  const memberIds = [seed.secretarioId, seed.responsavelId].filter(Boolean) as string[];
  if (memberIds.length > 0) {
    await prisma.membro.deleteMany({ where: { id: { in: memberIds } } });
  }
  if (seed.ministerioId) {
    await prisma.ministerio.deleteMany({ where: { id: seed.ministerioId } });
  }
}

test.beforeAll(async () => {
  prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: process.env.DATABASE_URL ?? "file:./dev.db",
    }),
  });
  seed = {
    secretarioId: (await createMember({
      nome: `Secretario Config ${SUFFIX}`,
      email: `secretario-config-${SUFFIX}@igreja.local`,
      cargo: "SECRETARIO",
    })).id,
    responsavelId: (await createMember({
      nome: `Responsável Config ${SUFFIX}`,
      email: `responsavel-config-${SUFFIX}@igreja.local`,
      cargo: null,
    })).id,
    ministerioId: (await prisma.ministerio.create({
      data: { nome: `Ministério Config ${SUFFIX}` },
    })).id,
  };
});

test.afterAll(async () => {
  await cleanupSeed();
  await prisma.$disconnect();
});

test("Chain 1: ADMIN GET /app/config/acolhimento vê formulário habilitado", async ({ playwright }) => {
  const chainId = "E2E-S04-CONFIG-1";
  const ip = "10.0.40.8";
  const ctx = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const r = ipRequest(ctx, ip);
  const releaseLock = await acquireLock(chainId);
  let failed = false;
  let failedAtStep: string | number | null = null;

  try {
    failedAtStep = 1;
    const cookie = await loginViaApi(ctx, ip, ADMIN_EMAIL, ADMIN_PASSWORD, chainId, 1);
    failedAtStep = 2;
    const res = await r.get("/app/config/acolhimento", cookiesFromSession(cookie));
    const body = await res.text();
    await recordResponse(chainId, 2, { status: res.status(), headers: res.headers(), body });
    expect(res.status(), "ADMIN GET config").toBe(200);
    expect(body).toContain('name="responsavelVisitanteTipo"');
    expect(body).not.toContain("Apenas ADMIN pode alterar");
  } catch (error) {
    failed = true;
    await recordResult(chainId, { id: chainId, status: "failed", failedAtStep, error: (error as Error).message });
    throw error;
  } finally {
    await resetConfig();
    await releaseLock();
    await ctx.dispose();
    await recordResult(chainId, { id: chainId, status: failed ? "failed" : "passed", cleanup: "executed" });
  }
});

test("Chain 2: ADMIN POST salva com Membro → redirect com sucesso", async ({ playwright }) => {
  const chainId = "E2E-S04-CONFIG-2";
  const ip = "10.0.40.9";
  const ctx = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const r = ipRequest(ctx, ip);
  const releaseLock = await acquireLock(chainId);
  let failed = false;
  let failedAtStep: string | number | null = null;

  try {
    failedAtStep = 1;
    const cookie = await loginViaApi(ctx, ip, ADMIN_EMAIL, ADMIN_PASSWORD, chainId, 1);

    failedAtStep = 2;
    const resPost = await r.post(
      "/app/config/acolhimento",
      { responsavelVisitanteTipo: "MEMBRO", responsavelId: seed.responsavelId },
      cookiesFromSession(cookie)
    );
    await recordResponse(chainId, 2, {
      status: resPost.status(),
      headers: resPost.headers(),
      body: await resPost.text(),
    });
    expect(resPost.status(), "ADMIN POST config membro").toBe(302);
    expect(resPost.headers().location).toBe("/app/config/acolhimento");

    failedAtStep = 3;
    const resGet = await r.get("/app/config/acolhimento", cookiesFromSession(cookie));
    const body = await resGet.text();
    await recordResponse(chainId, 3, { status: resGet.status(), headers: resGet.headers(), body });
    expect(resGet.status(), "GET após salvar").toBe(200);
    expect(body).toContain(`Responsável Config ${SUFFIX}`);
  } catch (error) {
    failed = true;
    await recordResult(chainId, { id: chainId, status: "failed", failedAtStep, error: (error as Error).message });
    throw error;
  } finally {
    await resetConfig();
    await releaseLock();
    await ctx.dispose();
    await recordResult(chainId, { id: chainId, status: failed ? "failed" : "passed", cleanup: "executed" });
  }
});

test("Chain 3: ADMIN troca para Ministério → limpa Membro e seta Ministério", async ({ playwright }) => {
  const chainId = "E2E-S04-CONFIG-3";
  const ip = "10.0.40.10";
  const ctx = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const r = ipRequest(ctx, ip);
  const releaseLock = await acquireLock(chainId);
  let failed = false;
  let failedAtStep: string | number | null = null;

  try {
    failedAtStep = 1;
    const cookie = await loginViaApi(ctx, ip, ADMIN_EMAIL, ADMIN_PASSWORD, chainId, 1);

    failedAtStep = 2;
    const resMembro = await r.post(
      "/app/config/acolhimento",
      { responsavelVisitanteTipo: "MEMBRO", responsavelId: seed.responsavelId },
      cookiesFromSession(cookie)
    );
    await recordResponse(chainId, 2, {
      status: resMembro.status(),
      headers: resMembro.headers(),
      body: await resMembro.text(),
    });
    expect(resMembro.status(), "config membro inicial").toBe(302);

    failedAtStep = 3;
    const resMinisterio = await r.post(
      "/app/config/acolhimento",
      { responsavelVisitanteTipo: "MINISTERIO", responsavelId: seed.ministerioId },
      cookiesFromSession(cookie)
    );
    await recordResponse(chainId, 3, {
      status: resMinisterio.status(),
      headers: resMinisterio.headers(),
      body: await resMinisterio.text(),
    });
    expect(resMinisterio.status(), "config ministério").toBe(302);

    failedAtStep = 4;
    const resGet = await r.get("/app/config/acolhimento", cookiesFromSession(cookie));
    const body = await resGet.text();
    await recordResponse(chainId, 4, { status: resGet.status(), headers: resGet.headers(), body });
    expect(resGet.status(), "GET após troca").toBe(200);
    expect(body).toContain(`Ministério Config ${SUFFIX}`);
    expect(body).not.toContain(`Responsável Config ${SUFFIX}`);
  } catch (error) {
    failed = true;
    await recordResult(chainId, { id: chainId, status: "failed", failedAtStep, error: (error as Error).message });
    throw error;
  } finally {
    await resetConfig();
    await releaseLock();
    await ctx.dispose();
    await recordResult(chainId, { id: chainId, status: failed ? "failed" : "passed", cleanup: "executed" });
  }
});

test("Chain 4: SECRETARIO GET vê form desabilitado", async ({ playwright }) => {
  const chainId = "E2E-S04-CONFIG-4";
  const ip = "10.0.40.11";
  const ctx = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const r = ipRequest(ctx, ip);
  const releaseLock = await acquireLock(chainId);
  let failed = false;
  let failedAtStep: string | number | null = null;

  try {
    failedAtStep = 1;
    const cookie = await loginViaApi(
      ctx,
      ip,
      `secretario-config-${SUFFIX}@igreja.local`,
      TEST_PASSWORD,
      chainId,
      1
    );

    failedAtStep = 2;
    const res = await r.get("/app/config/acolhimento", cookiesFromSession(cookie));
    const body = await res.text();
    await recordResponse(chainId, 2, { status: res.status(), headers: res.headers(), body });
    expect(res.status(), "SECRETARIO GET config").toBe(200);
    // Componente InfoBox mostra "Apenas o Admin pode alterar" (linha 142 config.acolhimento.tsx)
    expect(body).toContain("Apenas o Admin pode alterar");
    expect(body).not.toContain('name="responsavelVisitanteTipo"');
  } catch (error) {
    failed = true;
    await recordResult(chainId, { id: chainId, status: "failed", failedAtStep, error: (error as Error).message });
    throw error;
  } finally {
    await resetConfig();
    await releaseLock();
    await ctx.dispose();
    await recordResult(chainId, { id: chainId, status: failed ? "failed" : "passed", cleanup: "executed" });
  }
});

test("Chain 5: SECRETARIO POST direto → 403", async ({ playwright }) => {
  const chainId = "E2E-S04-CONFIG-5";
  const ip = "10.0.40.12";
  const ctx = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const r = ipRequest(ctx, ip);
  const releaseLock = await acquireLock(chainId);
  let failed = false;
  let failedAtStep: string | number | null = null;

  try {
    failedAtStep = 1;
    const cookie = await loginViaApi(
      ctx,
      ip,
      `secretario-config-${SUFFIX}@igreja.local`,
      TEST_PASSWORD,
      chainId,
      1
    );

    failedAtStep = 2;
    const res = await r.post(
      "/app/config/acolhimento",
      { responsavelVisitanteTipo: "MEMBRO", responsavelId: seed.responsavelId },
      cookiesFromSession(cookie)
    );
    await recordResponse(chainId, 2, {
      status: res.status(),
      headers: res.headers(),
      body: await res.text(),
    });
    expect(res.status(), "SECRETARIO POST config").toBe(403);
  } catch (error) {
    failed = true;
    await recordResult(chainId, { id: chainId, status: "failed", failedAtStep, error: (error as Error).message });
    throw error;
  } finally {
    await resetConfig();
    await releaseLock();
    await ctx.dispose();
    await recordResult(chainId, { id: chainId, status: failed ? "failed" : "passed", cleanup: "executed" });
  }
});
