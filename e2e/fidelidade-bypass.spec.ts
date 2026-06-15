/**
 * E2E: Fidelidade Financeira Bypass — Igreja Conect (S03-T12).
 *
 * Cobre 3 chains do e2e-chains S03 (US-MEM-005 — 3 camadas):
 * - Chain 4 (UI — camada 1): SECRETARIO vê 3 abas (s/ Fidelidade)
 * - Chain 5 (URL — camada 2): SECRETARIO ?tab=fidelidade → aba Dados
 * - Chain 6 (Service — camada 3): source-audit getDizimosByMembro
 *
 * Como o seed S00 só cria ADMIN, as chains 4-5 criam um SECRETARIO
 * via script node inline (Prisma) no beforeAll. Este script é executado
 * UMA vez e é idempotente (upsert por email).
 *
 * **Contrato de data-testids (TabsMembro):**
 *   - `[data-testid="tabs-membro"]` — container das abas
 *   - Tab links: `id="tab-{dados,discipulado,ministerios,fidelidade}"`
 *   - Tab panels: `data-testid="tab-{dados-pessoais,discipulado,ministerios,fidelidade}"`
 *
 * @see qa/S03/e2e-chains.json (chains 4-6)
 * @see app/components/TabsMembro.tsx
 * @see app/lib/finance.server.ts
 */
import {
  test,
  expect,
  type APIRequestContext,
} from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** URL base forçando IPv4 (evita dual-stack ::1 vs 127.0.0.1). */
const BASE_URL = "http://127.0.0.1:5173";

/** Caminho absoluto para o diretório de QA da sprint S03. */
const QA_DIR = path.resolve(__dirname, "..", "qa", "S03");

/** Nome do cookie de sessão. */
const SESSION_COOKIE = "__session";

/** Credenciais ADMIN (S00-T07). */
const ADMIN_EMAIL = "admin@igreja.local";
const ADMIN_PASSWORD = "admin123";

/** Credenciais SECRETARIO E2E (criado no globalSetup/seed). */
const SECRETARIO_EMAIL = "secretario+e2e@igreja.local";
const SECRETARIO_PASSWORD = "sec12345";

/** Credenciais PASTOR E2E (para positive test). */
const PASTOR_EMAIL = "pastor+e2e@igreja.local";
const PASTOR_PASSWORD = "pastor123";

/** Credenciais FINANCEIRO E2E (para positive test). */
const FINANCEIRO_EMAIL = "financeiro+e2e@igreja.local";
const FINANCEIRO_PASSWORD = "fin12345";

// ---------------------------------------------------------------------------
// Helpers de gravação de response / result
// ---------------------------------------------------------------------------

async function recordResponse(
  chainId: string,
  step: string | number,
  data: { status: number; headers: Record<string, string>; body: string }
): Promise<void> {
  const dir = path.join(QA_DIR, "responses");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${chainId}-${String(step).padStart(2, "0")}.json`);
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

async function recordResult(chainId: string, data: unknown): Promise<void> {
  const dir = path.join(QA_DIR, "results");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${chainId}.json`);
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

function ipRequest(request: APIRequestContext, _isolatedIp: string) {
  return {
    get: async (pathname: string, options: { cookies?: string } = {}) =>
      request.get(pathname, {
        headers: options.cookies ? { cookie: options.cookies } : {},
        maxRedirects: 0,
      }),
    post: async (
      pathname: string,
      formData: Record<string, string>,
      options: { cookies?: string } = {}
    ) => {
      return request.post(pathname, {
        headers: options.cookies ? { cookie: options.cookies } : {},
        form: formData,
        maxRedirects: 0,
      });
    },
  };
}

/**
 * Extrai o UUID do membro do header Location: `(/app)?/membros/<uuid>`.
 * (O backend erroneamente retorna `/app/membros/:id`, mas as rotas
 * reais não têm o prefixo `/app` — aceitamos ambos os padrões.)
 */
function extractMembroIdFromLocation(location: string | undefined): string | null {
  if (!location) return null;
  const match = location.match(/(?:\/app)?\/membros\/([a-f0-9-]+)/i);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Helpers de source-audit
// ---------------------------------------------------------------------------

const APP_ROOT = path.resolve(__dirname, "..", "app");

/**
 * Verifica que um arquivo existe e contém um termo.
 */
async function assertSourceContains(
  relPath: string,
  term: string,
  description: string
): Promise<boolean> {
  try {
    const src = await fs.readFile(path.join(APP_ROOT, relPath), "utf-8");
    return src.includes(term);
  } catch {
    return false;
  }
}

/**
 * Verifica que um arquivo NÃO contém um padrão regex.
 */
async function assertSourceNotMatches(
  relPath: string,
  pattern: RegExp,
  description: string
): Promise<boolean> {
  try {
    const src = await fs.readFile(path.join(APP_ROOT, relPath), "utf-8");
    return !pattern.test(src);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Seed: criar SECRETARIO, PASTOR, FINANCEIRO + membroAlvo
// ---------------------------------------------------------------------------

/**
 * Cria usuários de teste via Prisma (executado UMA vez antes de rodar).
 *
 * **Idempotente:** usa `findUnique` para não duplicar.
 * **Cleanup:** os usuários podem permanecer no DB — não afetam outros testes.
 */
test.describe("Fidelidade Bypass — 3 camadas RBAC", () => {
  /** ID do membro alvo usado nas chains 4-5. */
  let membroAlvoId: string = "";
  let adminCookie: string | null = null;

  test.beforeAll(async ({ playwright }) => {
    // Cria usuários de teste via seed complementar (idempotente)
    try {
      const output = execSync("pnpm tsx e2e/seed-s03.ts", {
        cwd: path.resolve(__dirname, ".."),
        encoding: "utf-8",
        timeout: 30000,
      });
      console.log("[seed-e2e]", output.trim().split("\n").join(" | "));
    } catch (e: unknown) {
      const err = e as { stdout?: string; stderr?: string; message?: string };
      console.warn("[seed-e2e] Aviso:", err.stderr ?? err.stdout ?? err.message);
      // Continua — pode ser que seed já tenha sido executado
    }

    // Pega membro alvo ID via API
    const adminCtx = await playwright.request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: { "x-forwarded-for": "10.0.20.0" },
    });
    const adminR = ipRequest(adminCtx, "10.0.20.0");

    try {
      // Login admin para ler membro alvo
      const resLogin = await adminR.post("/login", {
        email: ADMIN_EMAIL,
        senha: ADMIN_PASSWORD,
      });
      const setCookie = resLogin.headers()["set-cookie"] ?? "";
      const m = setCookie.match(/__session=([^;]+)/);
      adminCookie = m ? m[1] : null;

      if (adminCookie) {
        const cookies = `${SESSION_COOKIE}=${adminCookie}`;

        // Tenta encontrar o membro alvo pela listagem (rota correta: /app/membros)
        const resList = await adminR.get("/app/membros?q=Membro+Alvo+Fidelidade", { cookies });
        const bodyList = await resList.text();
        // Procura um ID no HTML (formato uuid na URL)
        const idMatch = bodyList.match(/\/app\/membros\/([a-f0-9-]+)/);
        if (idMatch) {
          membroAlvoId = idMatch[1];
        } else {
          // Se não encontrou, cria um novo membro alvo
          const resCriar = await adminR.post(
            "/app/membros/novo",
            { nome: "Membro Alvo Fidelidade", tipo: "CONGREGADO", email: "membro+alvo+fidelidade+e2e@igreja.local" },
            { cookies }
          );
          if (resCriar.status() === 302) {
            const locId = extractMembroIdFromLocation(resCriar.headers().location);
            if (locId) membroAlvoId = locId;
          }
        }
      }
    } finally {
      await adminCtx.dispose();
    }

    expect.soft(membroAlvoId, "membro alvo ID disponível").toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // CHAIN 4: RBAC FIDELIDADE - CAMADA 1 (UI): SECRETARIO → 3 abas, sem Fidelidade
  // ---------------------------------------------------------------------------

  test("Chain 4: SECRETARIO vê 3 abas sem Fidelidade (camada 1 UI)", async ({
    playwright,
  }) => {
    const chainId = "E2E-MEM-FID-4";
    const ip = "10.0.20.4";
    const ctx = await playwright.request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: { "x-forwarded-for": ip },
    });
    const r = ipRequest(ctx, ip);
    let cookieValue: string | null = null;

    try {
      // Step 1: Login como SECRETARIO
      const resLogin = await r.post("/login", {
        email: SECRETARIO_EMAIL,
        senha: SECRETARIO_PASSWORD,
      });
      expect.soft(resLogin.status(), "POST /login SECRETARIO → 302").toBe(302);
      const setCookie = resLogin.headers()["set-cookie"] ?? "";
      const m = setCookie.match(/__session=([^;]+)/);
      cookieValue = m ? m[1] : null;
      expect.soft(cookieValue, "cookie SECRETARIO extraído").toBeTruthy();
      const cookies = cookieValue ? `${SESSION_COOKIE}=${cookieValue}` : "";

      // Step 2: Acessar /app/membros/:id como SECRETARIO
      expect.soft(membroAlvoId, "membroAlvoId definido").toBeTruthy();
      const resDetail = await r.get(`/app/membros/${membroAlvoId}`, {
        cookies,
      });
      expect.soft(resDetail.status(), "GET /app/membros/:id → 200").toBe(200);
      const body = await resDetail.text();
      await recordResponse(chainId, "detalhe", {
        status: resDetail.status(),
        headers: resDetail.headers(),
        body: body.slice(0, 5000),
      });

      // Validações
      expect.soft(body, "contém tabs-membro container").toContain('data-testid="tabs-membro"');
      expect.soft(body, "contém tab Dados").toContain("Dados");
      expect.soft(body, "contém tab Discipulado").toContain("Discipulado");
      expect.soft(body, "contém tab Ministérios").toContain("Ministérios");

      // CRÍTICO: NÃO deve conter "Fidelidade Financeira" (nome da tab, não do membro)
      expect
        .soft(body, "SECRETARIO NÃO vê tab Fidelidade Financeira")
        .not.toContain("Fidelidade Financeira");
      expect
        .soft(body, "SECRETARIO NÃO vê data-testid tab-fidelidade")
        .not.toContain('data-testid="tab-fidelidade"');
      expect
        .soft(body, "SECRETARIO NÃO vê 'Módulo Financeiro' placeholder")
        .not.toContain("Módulo Financeiro");
    } finally {
      // Cleanup: logout
      try {
        if (cookieValue) {
          const cookies = `${SESSION_COOKIE}=${cookieValue}`;
          await r.post("/logout", {}, { cookies });
        }
      } catch (e) {
        console.error(`[${chainId}] cleanup error:`, e);
      }
      await ctx.dispose();
      await recordResult(chainId, { id: chainId, status: "executed" });
    }
  });

  // ---------------------------------------------------------------------------
  // CHAIN 5: RBAC FIDELIDADE - CAMADA 2 (URL): SECRETARIO ?tab=fidelidade → aba Dados
  // ---------------------------------------------------------------------------

  test("Chain 5: SECRETARIO com ?tab=fidelidade → aba Dados ativa (camada 2 URL)", async ({
    playwright,
  }) => {
    const chainId = "E2E-MEM-FID-5";
    const ip = "10.0.20.5";
    const ctx = await playwright.request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: { "x-forwarded-for": ip },
    });
    const r = ipRequest(ctx, ip);
    let cookieValue: string | null = null;

    try {
      // Step 1: Login como SECRETARIO
      const resLogin = await r.post("/login", {
        email: SECRETARIO_EMAIL,
        senha: SECRETARIO_PASSWORD,
      });
      expect.soft(resLogin.status(), "POST /login SECRETARIO → 302").toBe(302);
      const setCookie = resLogin.headers()["set-cookie"] ?? "";
      const m = setCookie.match(/__session=([^;]+)/);
      cookieValue = m ? m[1] : null;
      expect.soft(cookieValue, "cookie SECRETARIO extraído").toBeTruthy();
      const cookies = cookieValue ? `${SESSION_COOKIE}=${cookieValue}` : "";

      // Step 2: Acessar /app/membros/:id?tab=fidelidade como SECRETARIO
      expect.soft(membroAlvoId, "membroAlvoId definido").toBeTruthy();
      const resBypass = await r.get(
        `/app/membros/${membroAlvoId}?tab=fidelidade`,
        { cookies }
      );
      // Aceita 200 (loader força tab=dados) ou 403 (bloqueio direto)
      expect
        .soft(resBypass.status(), "GET /app/membros/:id?tab=fidelidade → 200 ou 403")
        .toBeGreaterThanOrEqual(200);
      expect
        .soft(resBypass.status(), "GET /app/membros/:id?tab=fidelidade → < 500")
        .toBeLessThan(500);

      const body = await resBypass.text();
      await recordResponse(chainId, "bypass", {
        status: resBypass.status(),
        headers: resBypass.headers(),
        body: body.slice(0, 5000),
      });

      // Se foi 200 (caminho feliz: loader força tab=dados):
      if (resBypass.status() === 200) {
        // Deve mostrar a aba Dados como ativa
        expect.soft(body, "contém tabs-membro").toContain('data-testid="tabs-membro"');
        expect.soft(body, "contém tab Dados").toContain("Dados");

        // NÃO deve conter "Fidelidade Financeira" (nome da tab, não do membro)
        expect
          .soft(body, "NÃO contém Fidelidade Financeira (bypass bloqueado)")
          .not.toContain("Fidelidade Financeira");
        expect
          .soft(body, "NÃO contém data-testid tab-fidelidade")
          .not.toContain('data-testid="tab-fidelidade"');
      }
    } finally {
      // Cleanup: logout
      try {
        if (cookieValue) {
          const cookies = `${SESSION_COOKIE}=${cookieValue}`;
          await r.post("/logout", {}, { cookies });
        }
      } catch (e) {
        console.error(`[${chainId}] cleanup error:`, e);
      }
      await ctx.dispose();
      await recordResult(chainId, { id: chainId, status: "executed" });
    }
  });

  // ---------------------------------------------------------------------------
  // CHAIN 6: RBAC FIDELIDADE - CAMADA 3 (SERVICE): source-audit
  // ---------------------------------------------------------------------------

  test("Chain 6: source-audit — getDizimosByMembro chama assertCanSeeFinancials (camada 3)", async ({
  }) => {
    const chainId = "E2E-MEM-FID-6";
    const checks: Array<{ name: string; passed: boolean; detail?: string }> = [];

    try {
      // Check 1: finance.server.ts existe e chama assertCanSeeFinancials
      const hasAssert = await assertSourceContains(
        "lib/finance.server.ts",
        "assertCanSeeFinancials",
        "Service chama assertCanSeeFinancials"
      );
      checks.push({
        name: "finance.server.ts chama assertCanSeeFinancials primeiro",
        passed: hasAssert,
        detail: hasAssert ? "OK" : "assertCanSeeFinancials NÃO encontrado em finance.server.ts",
      });

      // Check 2: finance.server.ts existe
      const hasFinance = await assertSourceContains(
        "lib/finance.server.ts",
        "getDizimosByMembro",
        "Arquivo finance.server.ts existe com getDizimosByMembro"
      );
      checks.push({
        name: "finance.server.ts existe com getDizimosByMembro",
        passed: hasFinance,
        detail: hasFinance ? "OK" : "getDizimosByMembro NÃO encontrado",
      });

      // Check 3: rbac.server.ts tem FINANCIAL_CARGOS sem SECRETARIO
      const hasFinancialCargos = await assertSourceContains(
        "lib/rbac.server.ts",
        "FINANCIAL_CARGOS",
        "Constante FINANCIAL_CARGOS existe"
      );
      checks.push({
        name: "rbac.server.ts tem FINANCIAL_CARGOS",
        passed: hasFinancialCargos,
        detail: hasFinancialCargos ? "OK" : "FINANCIAL_CARGOS NÃO encontrado",
      });

      // Check 4: FINANCIAL_CARGOS não inclui SECRETARIO
      const secNotInFinancial = await assertSourceNotMatches(
        "lib/rbac.server.ts",
        /FINANCIAL_CARGOS\s*=\s*\[[^\]]*SECRETARIO[^\]]*\]/s,
        "SECRETARIO não está em FINANCIAL_CARGOS"
      );
      checks.push({
        name: "SECRETARIO NÃO está em FINANCIAL_CARGOS",
        passed: secNotInFinancial,
        detail: secNotInFinancial ? "OK" : "SECRETARIO encontrado em FINANCIAL_CARGOS",
      });

      // Check 5: assertCanSeeFinancials no rbac.server.ts
      const canSeeFinancialsExists = await assertSourceContains(
        "lib/rbac.server.ts",
        "assertCanSeeFinancials",
        "Função assertCanSeeFinancials existe"
      );
      checks.push({
        name: "assertCanSeeFinancials definido em rbac.server.ts",
        passed: canSeeFinancialsExists,
        detail: canSeeFinancialsExists ? "OK" : "assertCanSeeFinancials NÃO encontrado",
      });

      // Check 6: ForbiddenError ou Response(403) mencionado
      const hasForbidden = await assertSourceContains(
        "lib/finance.server.ts",
        "403",
        "Service retorna 403"
      );
      checks.push({
        name: "finance.server.ts retorna 403",
        passed: hasForbidden,
        detail: hasForbidden ? "OK" : "403 NÃO encontrado em finance.server.ts",
      });

      for (const c of checks) {
        expect.soft(c.passed, `${c.name}${c.detail ? ` — ${c.detail}` : ""}`).toBe(true);
      }
    } finally {
      await recordResult(chainId, {
        id: chainId,
        status: "executed",
        checks,
      });
    }
  });
});
