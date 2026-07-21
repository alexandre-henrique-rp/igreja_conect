/**
 * E2E Smoke — Igreja Conect (S05-T04)
 *
 * Cobre o **fluxo north star do PRD** de ponta a ponta:
 *   "Visitante cadastrado → alerta atômico → responsável vê/marca como lido."
 *
 * **5 chains** (uma por `test()`), cada uma isolada e com cleanup:
 *   1. Chain 1 — ADMIN login + cria visitante 1 (cadastro base).
 *   2. Chain 2 — ADMIN configura acolhimento (Membro X como responsável) +
 *      cadastra visitante 2 → gera alerta atômico para Membro X.
 *   3. Chain 3 — Membro X (responsável) faz login, vê alerta do visitante 2
 *      e marca como lido.
 *   4. Chain 4 — Fidelidade bypass RBAC 3 camadas: SECRETARIO não vê aba
 *      Fidelidade nem via URL `?tab=fidelidade` (forçado para aba Dados).
 *   5. Chain 5 — Cross-module happy path: ADMIN cadastra visitante 3,
 *      aparece em /app/membros e (se config ativa) gera alerta visível.
 *
 * **Idempotência:** cada chain usa `SUFFIX-<uuid>` único nos emails para
 * permitir reexecução. `afterAll` faz cleanup via Prisma direto
 * (deleta membros, alertas e reset de config acolhimento).
 *
 * **Cleanup sempre:** try/finally em cada chain — mesmo se uma assertion
 * falhar no meio, o `cleanupChainData` é chamado. `afterAll` é
 * segurança extra.
 *
 * **Serialização:** `test.describe.configure({ mode: "serial" })` para
 * evitar race entre chains que compartilham config acolhimento (singleton).
 *
 * @see qa/S05/smoke-report.md
 * @see .harness/sprints/S05/tasks.json (S05-T04, S05-T05)
 * @see docs/PRD.html §7.3 (north star)
 * @see app/lib/alerts.server.ts (criarAlertaVisitante, marcarLido)
 * @see app/lib/rbac.server.ts (FINANCIAL_CARGOS, assertCanSeeFinancials)
 * @see app/components/TabsMembro.tsx (camada 1 RBAC Fidelidade)
 */
import {
  test,
  expect,
  type APIRequestContext,
  type BrowserContext,
} from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** URL base forçando IPv4 (evita dual-stack ::1 vs 127.0.0.1 em alguns SOs). */
const BASE_URL = "http://127.0.0.1:5173";

/** Caminho para QA S05 (responses/, results/, smoke-report.md). */
const QA_DIR = path.resolve(__dirname, "..", "qa", "S05");

/** Credenciais ADMIN (seed S00). */
const ADMIN_EMAIL = "admin@igreja.local";
const ADMIN_PASSWORD = "admin123";

/** Credenciais SECRETARIO (seed e2e/seed-s03.ts). */
const SECRETARIO_EMAIL = "secretario+e2e@igreja.local";
const SECRETARIO_PASSWORD = "sec12345";

/** Nome do cookie de sessão. */
const SESSION_COOKIE = "__session";

/** Lock entre chains (protege config acolhimento singleton). */
const LOCK_FILE = "/tmp/igreja-conect-e2e-s05-smoke.lock";

/** Senha padrão para membros de teste criados pelo smoke. */
const TEST_PASSWORD = "smoke-s05-12345";

/** Sufixo único para emails do smoke (evita colisão em reexecução). */
const SUFFIX = `s05-smoke-${randomUUID().slice(0, 8)}`;

/** Lista cumulativa de IDs criados (limpos no afterAll). */
const createdIds: {
  membros: string[];
  alertas: string[];
} = { membros: [], alertas: [] };

let prisma: PrismaClient;

// ---------------------------------------------------------------------------
// Helpers de gravação de response / result
// ---------------------------------------------------------------------------

/**
 * Grava o response de um step em `.harness/sprints/S05/responses/<chainId>-<step>.json`.
 *
 * @param chainId - ID da chain (ex: E2E-S05-SMOKE-1).
 * @param step - Identificador do step (número ou string).
 * @param data - `{status, headers, body}`.
 */
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

/**
 * Grava o resultado agregado de uma chain em `.harness/sprints/S05/results/<chainId>.json`.
 *
 * @param chainId - ID da chain.
 * @param data - Resultado com status, steps, cleanup, etc.
 */
async function recordResult(chainId: string, data: unknown): Promise<void> {
  const dir = path.join(QA_DIR, "results");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, `${chainId}.json`),
    JSON.stringify(data, null, 2),
    "utf-8"
  );
}

// ---------------------------------------------------------------------------
// Helpers HTTP
// ---------------------------------------------------------------------------

/**
 * Wrapper para requests com `x-forwarded-for` pré-setado (isola bucket
 * do rate-limit por chain).
 */
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

function cookiesFromSession(cookieValue: string): string {
  return `${SESSION_COOKIE}=${cookieValue}`;
}

function extractSessionCookie(setCookie: string): string | null {
  const match = setCookie.match(/__session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Faz login via API e retorna o valor do cookie `__session`.
 *
 * @param ctx - APIRequestContext do Playwright.
 * @param ip - IP isolado para o bucket de rate-limit.
 * @param email - Email do usuário.
 * @param password - Senha do usuário.
 * @param chainId - ID da chain (para logging).
 * @param step - Step atual (para logging).
 * @returns Valor decodificado do cookie `__session`.
 */
async function loginViaApi(
  ctx: APIRequestContext,
  ip: string,
  email: string,
  password: string,
  chainId: string,
  step: string | number
): Promise<string> {
  const res = await ctx.post("/login", {
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

/**
 * Adquire lock inter-chain (protege config acolhimento singleton).
 *
 * @returns Função de release (chamar no `finally`).
 */
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
        throw new Error(`Timeout aguardando lock E2E S05 smoke: ${chainId}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers de criação/cleanup de dados via Prisma
// ---------------------------------------------------------------------------

/**
 * Cria um membro de teste direto via Prisma (mais rápido que POST /membros/novo).
 *
 * @returns ID do membro criado.
 */
async function createTestMember(input: {
  nome: string;
  email: string;
  cargo: "ADMIN" | "SECRETARIO" | "PASTOR" | "FINANCEIRO" | "LIDER_MINISTERIO" | "LIDER_MINISTERIO" | null;
  withPassword?: boolean;
}): Promise<string> {
  const senhaHash = input.withPassword
    ? await bcrypt.hash(TEST_PASSWORD, 10)
    : null;
  const created = await prisma.membro.create({
    data: {
      nome: input.nome,
      email: input.email,
      senhaHash,
      tipo: "MEMBRO_ATIVO",
      cargo: input.cargo,
    },
    select: { id: true },
  });
  createdIds.membros.push(created.id);
  return created.id;
}

/**
 * Reseta config de acolhimento (deleta o singleton).
 */
async function resetConfigAcolhimento(): Promise<void> {
  await prisma.configuracaoGeral.deleteMany({ where: { id: "singleton" } });
}

/**
 * Cleanup chain: deleta o config singleton E os IDs fornecidos.
 * Chamado em `finally` para garantir execução mesmo em fail.
 */
async function cleanupChainData(input: {
  membroIds?: string[];
  resetConfig?: boolean;
}): Promise<void> {
  const memberIds = input.membroIds ?? [];
  if (memberIds.length > 0) {
    // Deleta alertas onde o membro é destinatário
    await prisma.alerta.deleteMany({
      where: {
        OR: [{ destinatarios: { some: { membroId: { in: memberIds } } } },
        ],
      },
    });
    await prisma.alertaDestinatario.deleteMany({
      where: { membroId: { in: memberIds } },
    });
    await prisma.membro.deleteMany({ where: { id: { in: memberIds } } });
  }
  if (input.resetConfig) {
    await resetConfigAcolhimento();
  }
}

/**
 * Extrai o UUID do membro do header `Location: /app/membros/<uuid>`.
 */
function extractMembroIdFromLocation(location: string | undefined): string | null {
  if (!location) return null;
  const match = location.match(/(?:\/app)?\/membros\/([a-f0-9-]+)/i);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Hooks beforeAll / afterAll
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: process.env.DATABASE_URL ?? "file:./dev.db",
    }),
  });
  // Garante seed-s03 (SECRETARIO, PASTOR, FINANCEIRO + Membro Alvo Fidelidade).
  // O seed é idempotente — `findUnique` + skip.
  const { execSync } = await import("node:child_process");
  try {
    const output = execSync("pnpm tsx e2e/seed-s03.ts", {
      cwd: path.resolve(__dirname, ".."),
      encoding: "utf-8",
      timeout: 30000,
    });
    console.log("[smoke] seed-s03:", output.trim().split("\n").join(" | "));
  } catch (e: unknown) {
    const err = e as { stderr?: string; stdout?: string; message?: string };
    console.warn(
      "[smoke] seed-s03 warning:",
      err.stderr ?? err.stdout ?? err.message
    );
  }
});

test.afterAll(async () => {
  // Cleanup final de TODOS os dados criados pelo smoke.
  try {
    if (createdIds.membros.length > 0) {
      await prisma.alerta.deleteMany({
        where: {
          OR: [{ destinatarios: { some: { membroId: { in: createdIds.membros } } } },
          ],
        },
      });
      await prisma.alertaDestinatario.deleteMany({
        where: { membroId: { in: createdIds.membros } },
      });
      await prisma.membro.deleteMany({
        where: { id: { in: createdIds.membros } },
      });
    }
    // Reset final do config acolhimento (deixa sistema limpo).
    await resetConfigAcolhimento();
    await prisma.$disconnect();
  } catch (e) {
    console.error("[smoke] afterAll cleanup error:", e);
  }
});

// ===========================================================================
// CHAIN 1 — ADMIN login + criar visitante
// ===========================================================================

test("Chain 1: ADMIN login + criar visitante 1 (cadastro base)", async ({
  playwright,
}) => {
  const chainId = "E2E-S05-SMOKE-1";
  const ip = "10.0.50.1";
  const ctx = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const r = ipRequest(ctx, ip);
  const releaseLock = await acquireLock(chainId);
  let cookieValue: string | null = null;
  let visitanteId: string | null = null;
  let failed = false;
  let failedAtStep: string | number | null = null;
  const chainMemberIds: string[] = [];

  try {
    // Step 1: POST /login ADMIN
    failedAtStep = 1;
    cookieValue = await loginViaApi(ctx, ip, ADMIN_EMAIL, ADMIN_PASSWORD, chainId, 1);
    const cookies = cookiesFromSession(cookieValue);

    // Step 2: GET /app (verificar que login deu acesso)
    failedAtStep = 2;
    const resApp = await r.get("/app", cookies);
    const bodyApp = await resApp.text();
    await recordResponse(chainId, 2, {
      status: resApp.status(),
      headers: resApp.headers(),
      body: bodyApp.slice(0, 2000),
    });
    expect(resApp.status(), "GET /app com cookie ADMIN").toBe(200);
    // Saudação (Boa tarde/dia/noite) + nome do usuário.
    expect(bodyApp, "/app renderiza saudação").toMatch(/Boa? (dia|tarde|noite)/);

    // Step 3: GET /app/membros/novo (sanity: form existe)
    failedAtStep = 3;
    const resForm = await r.get("/app/membros/novo", cookies);
    await recordResponse(chainId, 3, {
      status: resForm.status(),
      headers: resForm.headers(),
      body: (await resForm.text()).slice(0, 1500),
    });
    expect(resForm.status(), "GET /app/membros/novo").toBe(200);

    // Step 4: POST /app/membros/novo com tipo=VISITANTE
    failedAtStep = 4;
    const visitanteNome = `Visitante Smoke 1 ${SUFFIX}`;
    const visitanteTelefone = `119${String(Date.now()).slice(-8)}`;
    const resPost = await r.post(
      "/app/membros/novo",
      {
        nome: visitanteNome,
        tipo: "VISITANTE",
        telefone: visitanteTelefone,
      },
      cookies
    );
    await recordResponse(chainId, 4, {
      status: resPost.status(),
      headers: resPost.headers(),
      body: (await resPost.text()).slice(0, 1000),
    });
    expect(resPost.status(), "POST /app/membros/novo visitante").toBe(302);
    const location = resPost.headers().location ?? "";
    visitanteId = extractMembroIdFromLocation(location);
    expect(visitanteId, "visitanteId extraído do Location").toBeTruthy();
    chainMemberIds.push(visitanteId as string);

    // Step 5: GET /app/membros/:id → verifica que visitante foi criado
    failedAtStep = 5;
    const resDetail = await r.get(`/app/membros/${visitanteId}`, cookies);
    const bodyDetail = await resDetail.text();
    await recordResponse(chainId, 5, {
      status: resDetail.status(),
      headers: resDetail.headers(),
      body: bodyDetail.slice(0, 2000),
    });
    expect(resDetail.status(), "GET /app/membros/:id").toBe(200);
    expect(bodyDetail, "detalhe contém nome do visitante").toContain(visitanteNome);
    expect(bodyDetail, "detalhe contém tipo VISITANTE").toContain("VISITANTE");
  } catch (error) {
    failed = true;
    await recordResult(chainId, {
      id: chainId,
      status: "failed",
      failedAtStep,
      error: (error as Error).message,
    });
    throw error;
  } finally {
    // Cleanup: visitante criado fica no DB (não interfere em outras chains
    // porque tem ID único e não há config acolhimento ainda). Mas
    // removemos para não acumular lixo em reexecuções.
    try {
      await cleanupChainData({ membroIds: chainMemberIds });
    } catch (e) {
      console.error(`[${chainId}] cleanup error:`, e);
    }
    try {
      if (cookieValue) {
        await r.post("/logout", {}, cookiesFromSession(cookieValue));
      }
    } catch (e) {
      console.error(`[${chainId}] logout error:`, e);
    }
    await ctx.dispose();
    await releaseLock();
    await recordResult(chainId, {
      id: chainId,
      status: failed ? "failed" : "passed",
      failedAtStep: failed ? failedAtStep : null,
      cleanup: "executed",
      visitanteId,
    });
  }
});

// ===========================================================================
// CHAIN 2 — Config acolhimento (Membro X) + visitante 2 gera alerta atômico
// ===========================================================================

test("Chain 2: ADMIN configura acolhimento (Membro X) + visitante 2 → alerta atômico", async ({
  playwright,
}) => {
  const chainId = "E2E-S05-SMOKE-2";
  const ip = "10.0.50.2";
  const ctx = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const r = ipRequest(ctx, ip);
  const releaseLock = await acquireLock(chainId);
  let cookieValue: string | null = null;
  let responsavelId: string | null = null;
  let visitanteId: string | null = null;
  let alertaId: string | null = null;
  let failed = false;
  let failedAtStep: string | number | null = null;
  const chainMemberIds: string[] = [];

  try {
    // Setup: criar Membro X (responsável) direto via Prisma (não tem login,
    // é só alvo do alerta). Também criamos Membro X logado para o chain 3
    // poder logar.
    responsavelId = await createTestMember({
      nome: `Responsável Smoke ${SUFFIX}`,
      email: `responsavel-smoke-${SUFFIX}@igreja.local`,
      cargo: null,
      withPassword: true, // para o chain 3 logar
    });
    chainMemberIds.push(responsavelId);

    // Step 1: ADMIN login
    failedAtStep = 1;
    cookieValue = await loginViaApi(ctx, ip, ADMIN_EMAIL, ADMIN_PASSWORD, chainId, 1);
    const cookies = cookiesFromSession(cookieValue);

    // Step 2: POST /app/config/acolhimento com Membro X
    failedAtStep = 2;
    const resConfig = await r.post(
      "/app/config/acolhimento",
      {
        responsavelVisitanteTipo: "MEMBRO",
        responsavelId: responsavelId,
      },
      cookies
    );
    await recordResponse(chainId, 2, {
      status: resConfig.status(),
      headers: resConfig.headers(),
      body: await resConfig.text(),
    });
    expect(resConfig.status(), "ADMIN POST config acolhimento").toBe(302);

    // Step 3: GET /app/config/acolhimento → verifica que config foi salva
    failedAtStep = 3;
    const resGet = await r.get("/app/config/acolhimento", cookies);
    const bodyConfig = await resGet.text();
    await recordResponse(chainId, 3, {
      status: resGet.status(),
      headers: resGet.headers(),
      body: bodyConfig.slice(0, 2000),
    });
    expect(resGet.status(), "GET /app/config/acolhimento").toBe(200);
    expect(bodyConfig, "config mostra responsável").toContain(`Responsável Smoke ${SUFFIX}`);

    // Step 4: POST /app/membros/novo visitante 2 → deve gerar alerta atômico
    failedAtStep = 4;
    const visitante2Nome = `Visitante Smoke 2 ${SUFFIX}`;
    const visitante2Telefone = `119${String(Date.now() + 1).slice(-8)}`;
    const resPost = await r.post(
      "/app/membros/novo",
      {
        nome: visitante2Nome,
        tipo: "VISITANTE",
        telefone: visitante2Telefone,
      },
      cookies
    );
    await recordResponse(chainId, 4, {
      status: resPost.status(),
      headers: resPost.headers(),
      body: (await resPost.text()).slice(0, 1000),
    });
    expect(resPost.status(), "POST visitante 2").toBe(302);
    visitanteId = extractMembroIdFromLocation(resPost.headers().location);
    expect(visitanteId, "visitante 2 ID extraído").toBeTruthy();
    chainMemberIds.push(visitanteId as string);

    // Step 5: Verificar via Prisma que alerta foi criado (direto no DB,
    // porque a página de alertas é só do destinatário).
    // Pequeno delay para garantir que a transação foi commitada.
    await new Promise((resolve) => setTimeout(resolve, 100));
    const alertas = await prisma.alerta.findMany({
      where: { destinatarios: { some: { membroId: responsavelId } },
      },
      select: { id: true, titulo: true, mensagem: true },
    });
    expect(alertas.length, "alerta atômico criado para o responsável").toBeGreaterThanOrEqual(1);
    alertaId = alertas[0]?.id ?? null;
    expect(alertaId, "alertaId encontrado").toBeTruthy();
    // Mensagem contém nome do visitante (LGPD-safe: nome + telefone, sem CPF/email).
    expect(alertas[0].mensagem, "mensagem contém nome do visitante").toContain(visitante2Nome);
  } catch (error) {
    failed = true;
    await recordResult(chainId, {
      id: chainId,
      status: "failed",
      failedAtStep,
      error: (error as Error).message,
    });
    throw error;
  } finally {
    // Cleanup SEMPRE: config singleton + membros criados.
    try {
      await cleanupChainData({ membroIds: chainMemberIds, resetConfig: true });
    } catch (e) {
      console.error(`[${chainId}] cleanup error:`, e);
    }
    try {
      if (cookieValue) {
        await r.post("/logout", {}, cookiesFromSession(cookieValue));
      }
    } catch (e) {
      console.error(`[${chainId}] logout error:`, e);
    }
    await ctx.dispose();
    await releaseLock();
    await recordResult(chainId, {
      id: chainId,
      status: failed ? "failed" : "passed",
      failedAtStep: failed ? failedAtStep : null,
      cleanup: "executed (config reset + membros deletados)",
      responsavelId,
      visitanteId,
      alertaId,
    });
  }
});

// ===========================================================================
// CHAIN 3 — Responsável (Membro X) vê alerta e marca como lido
// ===========================================================================

test("Chain 3: Responsável vê alerta do visitante 2 e marca como lido", async ({
  playwright,
}) => {
  const chainId = "E2E-S05-SMOKE-3";
  const ip = "10.0.50.3";
  const ctx = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const r = ipRequest(ctx, ip);
  const releaseLock = await acquireLock(chainId);
  let responsavelCookie: string | null = null;
  let responsavelId: string | null = null;
  let visitanteId: string | null = null;
  let alertaId: string | null = null;
  let failed = false;
  let failedAtStep: string | number | null = null;
  const chainMemberIds: string[] = [];

  try {
    // Setup: criar Responsável + Visitante + Config (alinhado com chain 2)
    responsavelId = await createTestMember({
      nome: `Responsável Smoke ${SUFFIX}`,
      email: `responsavel-smoke-${SUFFIX}@igreja.local`,
      cargo: null,
      withPassword: true,
    });
    chainMemberIds.push(responsavelId);
    await prisma.configuracaoGeral.upsert({
      where: { id: "singleton" },
      update: {
        responsavelVisitanteTipo: "MEMBRO",
        responsavelMembroId: responsavelId,
        responsavelMinisterioId: null,
      },
      create: {
        id: "singleton",
        responsavelVisitanteTipo: "MEMBRO",
        responsavelMembroId: responsavelId,
        responsavelMinisterioId: null,
      },
    });

    // Step 1: ADMIN cria visitante (gera alerta atômico para Responsável)
    failedAtStep = 1;
    const adminCookie = await loginViaApi(ctx, ip, ADMIN_EMAIL, ADMIN_PASSWORD, chainId, 1);
    const adminCookies = cookiesFromSession(adminCookie);
    const visitante3Nome = `Visitante Smoke 3 ${SUFFIX}`;
    const visitante3Telefone = `119${String(Date.now() + 2).slice(-8)}`;
    const resVisitante = await r.post(
      "/app/membros/novo",
      {
        nome: visitante3Nome,
        tipo: "VISITANTE",
        telefone: visitante3Telefone,
      },
      adminCookies
    );
    await recordResponse(chainId, 1, {
      status: resVisitante.status(),
      headers: resVisitante.headers(),
      body: (await resVisitante.text()).slice(0, 1000),
    });
    expect(resVisitante.status(), "ADMIN cadastra visitante 3").toBe(302);
    visitanteId = extractMembroIdFromLocation(resVisitante.headers().location);
    expect(visitanteId, "visitante 3 ID extraído").toBeTruthy();
    chainMemberIds.push(visitanteId as string);

    // Logout ADMIN
    await r.post("/logout", {}, adminCookies);

    // Captura alertaId para assert
    await new Promise((resolve) => setTimeout(resolve, 100));
    const alertas = await prisma.alerta.findMany({
      where: { destinatarios: { some: { membroId: responsavelId } },
      },
      select: { id: true, titulo: true, mensagem: true },
    });
    expect(alertas.length, "alerta atômico criado").toBeGreaterThanOrEqual(1);
    alertaId = alertas[0].id;

    // Step 2: Responsável faz login
    failedAtStep = 2;
    responsavelCookie = await loginViaApi(
      ctx,
      ip,
      `responsavel-smoke-${SUFFIX}@igreja.local`,
      TEST_PASSWORD,
      chainId,
      2
    );
    const cookies = cookiesFromSession(responsavelCookie);

    // Step 3: GET /app/alertas → verifica que alerta do visitante aparece
    failedAtStep = 3;
    const resAlertas = await r.get("/app/alertas", cookies);
    const bodyAlertas = await resAlertas.text();
    await recordResponse(chainId, 3, {
      status: resAlertas.status(),
      headers: resAlertas.headers(),
      body: bodyAlertas.slice(0, 3000),
    });
    expect(resAlertas.status(), "GET /app/alertas").toBe(200);
    expect(bodyAlertas, "alerta visível contém nome do visitante").toContain(visitante3Nome);
    expect(bodyAlertas, "alerta visível contém telefone").toContain(visitante3Telefone);
    // Tabs de filtro devem mostrar contagem > 0 para "Não lidos"
    expect(bodyAlertas, "badge Não lidos > 0").toMatch(/Não lidos\s*<[^>]*>\s*[1-9]/);

    // Step 4: POST /app/alertas com _action=marcarLido + alertaId
    failedAtStep = 4;
    const resMarcar = await r.post(
      "/app/alertas",
      { _action: "marcarLido", alertaId },
      cookies
    );
    await recordResponse(chainId, 4, {
      status: resMarcar.status(),
      headers: resMarcar.headers(),
      body: await resMarcar.text(),
    });
    expect(resMarcar.status(), "POST /app/alertas marcarLido").toBe(302);

    // Step 5: GET /app/alertas?filter=naoLidos → alerta some da lista
    failedAtStep = 5;
    const resApos = await r.get("/app/alertas?filter=naoLidos", cookies);
    const bodyApos = await resApos.text();
    await recordResponse(chainId, 5, {
      status: resApos.status(),
      headers: resApos.headers(),
      body: bodyApos.slice(0, 3000),
    });
    expect(resApos.status(), "GET /app/alertas após marcar lido").toBe(200);
    // Após marcar lido, o visitante 3 não deve mais aparecer nos NÃO LIDOS.
    // Mas pode aparecer em TODOS (com border/opacity indicando lido).
    // Verifica que na aba "Não lidos" o badge zerou (0) OU que o nome sumiu.
    const naoContemNome =
      !bodyApos.includes(visitante3Nome) ||
      bodyApos.includes("Nenhum alerta não lido");
    expect(naoContemNome, "alerta saiu de Não Lidos").toBe(true);

    // Step 6: Verificar via Prisma que lido=true no destinatário
    failedAtStep = 6;
    const destinatario = await prisma.alertaDestinatario.findFirst({
      where: { alertaId, membroId: responsavelId },
      select: { lido: true, resolvido: true },
    });
    expect(destinatario, "destinatário existe").toBeTruthy();
    expect(destinatario?.lido, "destinatário.lido = true").toBe(true);
  } catch (error) {
    failed = true;
    await recordResult(chainId, {
      id: chainId,
      status: "failed",
      failedAtStep,
      error: (error as Error).message,
    });
    throw error;
  } finally {
    // Cleanup SEMPRE
    try {
      await cleanupChainData({ membroIds: chainMemberIds, resetConfig: true });
    } catch (e) {
      console.error(`[${chainId}] cleanup error:`, e);
    }
    try {
      if (responsavelCookie) {
        await r.post("/logout", {}, cookiesFromSession(responsavelCookie));
      }
    } catch (e) {
      console.error(`[${chainId}] logout error:`, e);
    }
    await ctx.dispose();
    await releaseLock();
    await recordResult(chainId, {
      id: chainId,
      status: failed ? "failed" : "passed",
      failedAtStep: failed ? failedAtStep : null,
      cleanup: "executed (config reset + membros deletados)",
      responsavelId,
      visitanteId,
      alertaId,
    });
  }
});

// ===========================================================================
// CHAIN 4 — Fidelidade bypass RBAC 3 camadas (SECRETARIO)
// ===========================================================================

test("Chain 4: SECRETARIO — Fidelidade bypass bloqueado (3 camadas RBAC)", async ({
  playwright,
}) => {
  const chainId = "E2E-S05-SMOKE-4";
  const ip = "10.0.50.4";
  const ctx = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const r = ipRequest(ctx, ip);
  const releaseLock = await acquireLock(chainId);
  let cookieValue: string | null = null;
  let failed = false;
  let failedAtStep: string | number | null = null;
  // Não criamos nenhum membro novo — usamos o Membro Alvo Fidelidade
  // criado pelo seed-s03 (id=8b61d457-6cf4-4d06-b912-ee8d7e5bb8cb).
  // Para evitar hardcode, buscamos por email.

  try {
    // Setup: pegar ID do Membro Alvo Fidelidade
    const membroAlvo = await prisma.membro.findUnique({
      where: { email: "membro+alvo+fidelidade@igreja.local" },
      select: { id: true, nome: true },
    });
    expect(membroAlvo, "Membro Alvo Fidelidade existe (seed-s03)").toBeTruthy();
    const membroAlvoId = membroAlvo!.id;

    // Step 1: SECRETARIO login
    failedAtStep = 1;
    cookieValue = await loginViaApi(
      ctx,
      ip,
      SECRETARIO_EMAIL,
      SECRETARIO_PASSWORD,
      chainId,
      1
    );
    const cookies = cookiesFromSession(cookieValue);

    // Step 2: GET /app/membros/:id → camada 1 (UI): NÃO vê aba Fidelidade
    failedAtStep = 2;
    const resDetail = await r.get(`/app/membros/${membroAlvoId}`, cookies);
    const bodyDetail = await resDetail.text();
    await recordResponse(chainId, 2, {
      status: resDetail.status(),
      headers: resDetail.headers(),
      body: bodyDetail.slice(0, 5000),
    });
    expect(resDetail.status(), "GET /app/membros/:id SECRETARIO").toBe(200);
    expect(bodyDetail, "container tabs-membro presente").toContain(
      'data-testid="tabs-membro"'
    );
    expect(bodyDetail, "aba Dados presente").toContain("Dados");
    expect(bodyDetail, "aba Discipulado presente").toContain("Discipulado");
    expect(bodyDetail, "aba Ministérios presente").toContain("Ministérios");
    // CRÍTICO: NÃO deve ter a aba Fidelidade (camada 1 UI).
    expect
      .soft(bodyDetail, "SECRETARIO NÃO vê aba Fidelidade Financeira (camada 1 UI)")
      .not.toContain("Fidelidade Financeira");
    expect
      .soft(bodyDetail, "SECRETARIO NÃO vê data-testid tab-fidelidade (camada 1 UI)")
      .not.toContain('data-testid="tab-fidelidade"');

    // Step 3: Tentar bypass via URL ?tab=fidelidade → camada 2 (loader):
    // loader força tab=dados, então a aba ativa é "Dados" e Fidelidade
    // continua oculta.
    failedAtStep = 3;
    const resBypass = await r.get(
      `/app/membros/${membroAlvoId}?tab=fidelidade`,
      cookies
    );
    const bodyBypass = await resBypass.text();
    await recordResponse(chainId, 3, {
      status: resBypass.status(),
      headers: resBypass.headers(),
      body: bodyBypass.slice(0, 5000),
    });
    expect(resBypass.status(), "GET ?tab=fidelidade → 200").toBe(200);
    // Camada 2: mesmo tentando pela URL, a aba Fidelidade continua
    // ausente do HTML (loader força tab=dados E UI não renderiza).
    expect
      .soft(bodyBypass, "BYPASS URL: aba Fidelidade continua oculta")
      .not.toContain("Fidelidade Financeira");
    expect
      .soft(bodyBypass, "BYPASS URL: tabpanel-fidelidade ausente")
      .not.toContain('data-testid="tab-fidelidade"');
    // E o painel ativo deve ser o de Dados (camada 2).
    // Como o TabsMembro renderiza o panel correspondente, e o loader
    // força activeTab="dados", o panel "tab-dados-pessoais" deve estar
    // presente.
    expect(bodyBypass, "panel Dados ativo presente").toContain(
      'data-testid="tab-dados-pessoais"'
    );
  } catch (error) {
    failed = true;
    await recordResult(chainId, {
      id: chainId,
      status: "failed",
      failedAtStep,
      error: (error as Error).message,
    });
    throw error;
  } finally {
    // Cleanup: nenhum membro criado, mas logout.
    try {
      if (cookieValue) {
        await r.post("/logout", {}, cookiesFromSession(cookieValue));
      }
    } catch (e) {
      console.error(`[${chainId}] logout error:`, e);
    }
    await ctx.dispose();
    await releaseLock();
    await recordResult(chainId, {
      id: chainId,
      status: failed ? "failed" : "passed",
      failedAtStep: failed ? failedAtStep : null,
      cleanup: "executed (logout, sem novos membros criados)",
    });
  }
});

// ===========================================================================
// CHAIN 5 — Cross-module happy path (visitante aparece em /membros E /alertas)
// ===========================================================================

test("Chain 5: Cross-module — visitante 4 aparece em /membros e (se config) /alertas", async ({
  playwright,
}) => {
  const chainId = "E2E-S05-SMOKE-5";
  const ip = "10.0.50.5";
  const ctx = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const r = ipRequest(ctx, ip);
  const releaseLock = await acquireLock(chainId);
  let cookieValue: string | null = null;
  let visitanteId: string | null = null;
  let responsavelId: string | null = null;
  let failed = false;
  let failedAtStep: string | number | null = null;
  const chainMemberIds: string[] = [];

  try {
    // Setup: criar Responsável + Config (alinhado com chains 2-3).
    responsavelId = await createTestMember({
      nome: `Responsável Smoke ${SUFFIX}`,
      email: `responsavel-smoke-${SUFFIX}@igreja.local`,
      cargo: null,
      withPassword: false, // não precisa logar — só receber alerta
    });
    chainMemberIds.push(responsavelId);
    await prisma.configuracaoGeral.upsert({
      where: { id: "singleton" },
      update: {
        responsavelVisitanteTipo: "MEMBRO",
        responsavelMembroId: responsavelId,
        responsavelMinisterioId: null,
      },
      create: {
        id: "singleton",
        responsavelVisitanteTipo: "MEMBRO",
        responsavelMembroId: responsavelId,
        responsavelMinisterioId: null,
      },
    });

    // Step 1: ADMIN login
    failedAtStep = 1;
    cookieValue = await loginViaApi(ctx, ip, ADMIN_EMAIL, ADMIN_PASSWORD, chainId, 1);
    const cookies = cookiesFromSession(cookieValue);

    // Step 2: POST /app/membros/novo visitante 4
    failedAtStep = 2;
    const visitante4Nome = `Visitante Cross ${SUFFIX}`;
    const visitante4Telefone = `119${String(Date.now() + 3).slice(-8)}`;
    const resPost = await r.post(
      "/app/membros/novo",
      {
        nome: visitante4Nome,
        tipo: "VISITANTE",
        telefone: visitante4Telefone,
      },
      cookies
    );
    await recordResponse(chainId, 2, {
      status: resPost.status(),
      headers: resPost.headers(),
      body: (await resPost.text()).slice(0, 1000),
    });
    expect(resPost.status(), "POST visitante 4").toBe(302);
    visitanteId = extractMembroIdFromLocation(resPost.headers().location);
    expect(visitanteId, "visitante 4 ID extraído").toBeTruthy();
    chainMemberIds.push(visitanteId as string);

    // Step 3: GET /app/membros?q=... → visitante aparece na listagem
    failedAtStep = 3;
    const resList = await r.get(
      `/app/membros?q=${encodeURIComponent(`Visitante Cross ${SUFFIX}`)}&tipo=VISITANTE`,
      cookies
    );
    const bodyList = await resList.text();
    await recordResponse(chainId, 3, {
      status: resList.status(),
      headers: resList.headers(),
      body: bodyList.slice(0, 5000),
    });
    expect(resList.status(), "GET /app/membros?q=... filtro").toBe(200);
    expect(bodyList, "visitante 4 aparece na listagem").toContain(visitante4Nome);

    // Step 4: GET /app/membros/:id → detalhe do visitante
    failedAtStep = 4;
    const resDetail = await r.get(`/app/membros/${visitanteId}`, cookies);
    const bodyDetail = await resDetail.text();
    await recordResponse(chainId, 4, {
      status: resDetail.status(),
      headers: resDetail.headers(),
      body: bodyDetail.slice(0, 3000),
    });
    expect(resDetail.status(), "GET /app/membros/:id visitante").toBe(200);
    expect(bodyDetail, "detalhe contém nome").toContain(visitante4Nome);
    expect(bodyDetail, "detalhe contém telefone").toContain(visitante4Telefone);

    // Step 5: Verificar via Prisma que alerta foi criado (cross-module)
    failedAtStep = 5;
    await new Promise((resolve) => setTimeout(resolve, 100));
    const alertas = await prisma.alerta.findMany({
      where: { destinatarios: { some: { membroId: responsavelId } },
      },
      select: { id: true, mensagem: true },
    });
    expect(alertas.length, "alerta cross-module gerado").toBeGreaterThanOrEqual(1);
    expect(alertas[0].mensagem, "mensagem contém nome").toContain(visitante4Nome);
    expect(alertas[0].mensagem, "mensagem contém telefone").toContain(visitante4Telefone);
  } catch (error) {
    failed = true;
    await recordResult(chainId, {
      id: chainId,
      status: "failed",
      failedAtStep,
      error: (error as Error).message,
    });
    throw error;
  } finally {
    // Cleanup SEMPRE
    try {
      await cleanupChainData({ membroIds: chainMemberIds, resetConfig: true });
    } catch (e) {
      console.error(`[${chainId}] cleanup error:`, e);
    }
    try {
      if (cookieValue) {
        await r.post("/logout", {}, cookiesFromSession(cookieValue));
      }
    } catch (e) {
      console.error(`[${chainId}] logout error:`, e);
    }
    await ctx.dispose();
    await releaseLock();
    await recordResult(chainId, {
      id: chainId,
      status: failed ? "failed" : "passed",
      failedAtStep: failed ? failedAtStep : null,
      cleanup: "executed (config reset + membros deletados)",
      visitanteId,
      responsavelId,
    });
  }
});
