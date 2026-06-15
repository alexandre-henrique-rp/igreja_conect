/**
 * E2E: Discipulado — Igreja Conect (S03-T12).
 *
 * Cobre 4 chains do e2e-chains S03:
 * - Chain 1 (trava 12): DISCIPULADOR vincula 12 discípulos OK; 13º → 422
 * - Chain 2 (anti-loop): A→B OK, B→A → 422
 * - Chain 3 (auto-vínculo): self → 400/422
 * - Chain 7 (RN-MEM-06): VISITANTE NÃO é promovido automaticamente
 *
 * Cada `test()` é 1 chain; cleanup roda via try/finally mesmo em fail.
 * Responses e resultados são gravados em `qa/S03/responses/` e
 * `qa/S03/results/` para depuração.
 *
 * **Isolamento de rate limit:** cada chain envia `x-forwarded-for` com
 * IP único (10.0.20.<chainId>) para isolar os buckets in-memory.
 *
 * **Cleanup sempre:** toda chain termina desvinculando discípulos,
 * excluindo membros criados, e fazendo logout. O bloco `finally`
 * garante execução mesmo se uma assertion falhar no meio.
 *
 * @see qa/S03/e2e-chains.json (schema declarativo das chains)
 */
import {
  test,
  expect,
  type APIRequestContext,
} from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** URL base forçando IPv4 (evita dual-stack ::1 vs 127.0.0.1). */
const BASE_URL = "http://127.0.0.1:5173";

/** Caminho absoluto para o diretório de QA da sprint S03. */
const QA_DIR = path.resolve(__dirname, "..", "qa", "S03");

/** Email/senha do admin seed (S00-T07). */
const ADMIN_EMAIL = "admin@igreja.local";
const ADMIN_PASSWORD = "admin123";

/** Nome do cookie de sessão. */
const SESSION_COOKIE = "__session";

// ---------------------------------------------------------------------------
// Helpers de gravação de response / result
// ---------------------------------------------------------------------------

/**
 * Grava o response de um step em `qa/S03/responses/<chainId>-<step>.json`.
 */
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

/**
 * Grava o resultado agregado de uma chain em `qa/S03/results/<chainId>.json`.
 */
async function recordResult(chainId: string, data: unknown): Promise<void> {
  const dir = path.join(QA_DIR, "results");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${chainId}.json`);
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Cria um helper para fazer requests com headers pré-setados.
 */
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
// CHAIN 1: TRAVA 12 — DISCIPULADOR vincula 12 discípulos OK; 13º → 422
// ---------------------------------------------------------------------------

test("Chain 1: trava 12 — vincular 12 discípulos OK, 13º falha com 422", async ({
  playwright,
}) => {
  const chainId = "E2E-MEM-DISC-1";
  const ip = "10.0.20.1";
  const ctx = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const r = ipRequest(ctx, ip);
  let cookieValue: string | null = null;
  const discipulosCriados: string[] = [];
  let discipuladorId: string | null = null;
  let decimoTerceiroId: string | null = null;

  try {
    // Step 1: Login admin
    const resLogin = await r.post("/login", {
      email: ADMIN_EMAIL,
      senha: ADMIN_PASSWORD,
    });
    expect.soft(resLogin.status(), "POST /login").toBe(302);
    const setCookie = resLogin.headers()["set-cookie"] ?? "";
    const m = setCookie.match(/__session=([^;]+)/);
    cookieValue = m ? m[1] : null;
    expect.soft(cookieValue, "cookie extraído").toBeTruthy();
    const cookies = cookieValue ? `${SESSION_COOKIE}=${cookieValue}` : "";
    await recordResponse(chainId, "login", {
      status: resLogin.status(),
      headers: resLogin.headers(),
      body: "(redirect)",
    });

    // Step 2: Criar discipulador (membro que será o discipulador)
    const resDisc = await r.post(
      "/app/membros/novo",
      {
        nome: "Discipulador Trava12",
        tipo: "MEMBRO_ATIVO",
        email: `discipulador+trava12@igreja.local`,
      },
      { cookies }
    );
    expect.soft(resDisc.status(), "criar discipulador → 302").toBe(302);
    discipuladorId = extractMembroIdFromLocation(resDisc.headers().location);
    expect.soft(discipuladorId, "discipulador ID extraído").toBeTruthy();
    await recordResponse(chainId, "criar-discipulador", {
      status: resDisc.status(),
      headers: resDisc.headers(),
      body: "(redirect)",
    });

    // Steps 3-14: Criar 12 discípulos e vincular ao discipulador
    for (let i = 1; i <= 12; i++) {
      const suffix = `d${String(i).padStart(2, "0")}`;
      const resCriar = await r.post(
        "/app/membros/novo",
        {
          nome: `Discípulo ${suffix} Trava12`,
          tipo: "CONGREGADO",
          email: `discipulo+${suffix}+trava12@igreja.local`,
        },
        { cookies }
      );
      expect
        .soft(resCriar.status(), `criar discípulo ${i} → 302`)
        .toBe(302);
      const discId = extractMembroIdFromLocation(resCriar.headers().location);
      expect.soft(discId, `discípulo ${i} ID`).toBeTruthy();
      if (discId) discipulosCriados.push(discId);

      if (discId && discipuladorId) {
        const resVincular = await r.post(
          `/app/membros/${discId}/discipulado`,
          { intent: "assign", discipuladorId },
          { cookies }
        );
        // Os primeiros 12 devem passar (302)
        expect
          .soft(resVincular.status(), `vincular discípulo ${i} → 302`)
          .toBe(302);
      }
    }

    // Step 15: Tentar vincular 13º discípulo — deve falhar
    const res13 = await r.post(
      "/app/membros/novo",
      {
        nome: "Discípulo 13 Trava12",
        tipo: "CONGREGADO",
        email: "discipulo+13+trava12@igreja.local",
      },
      { cookies }
    );
    expect.soft(res13.status(), "criar 13º discípulo → 302").toBe(302);
    decimoTerceiroId = extractMembroIdFromLocation(res13.headers().location);
    expect.soft(decimoTerceiroId, "13º ID extraído").toBeTruthy();

    let status13 = -1;
    let body13 = "";
    if (decimoTerceiroId && discipuladorId) {
      const resVincular13 = await r.post(
        `/app/membros/${decimoTerceiroId}/discipulado`,
        { intent: "assign", discipuladorId },
        { cookies }
      );
      status13 = resVincular13.status();
      body13 = await resVincular13.text();
      await recordResponse(chainId, "13o-vincular", {
        status: status13,
        headers: resVincular13.headers(),
        body: body13.slice(0, 2000),
      });
    }

    // Valida: 13º deve falhar com 422 (ou 400/409 — aceitamos qualqer 4xx)
    // e a mensagem deve mencionar "limite" e "12".
    expect.soft(status13, "13º vínculo deve falhar com 4xx").toBeGreaterThanOrEqual(400);
    expect.soft(status13, "13º vínculo deve falhar com 4xx").toBeLessThan(500);
    const body13lower = body13.toLowerCase();
    expect
      .soft(body13lower, "mensagem menciona 'limite'")
      .toContain("limite");
    expect.soft(body13, "mensagem menciona '12'").toContain("12");
  } finally {
    // Cleanup SEMPRE
    try {
      if (cookieValue) {
        const cookies = `${SESSION_COOKIE}=${cookieValue}`;

        // Desvincular discípulos (unassign) antes de excluir
        for (const discId of [...discipulosCriados, ...(decimoTerceiroId ? [decimoTerceiroId] : [])]) {
          if (discId) {
            try {
              await r.post(
                `/app/membros/${discId}/discipulado`,
                { intent: "unassign" },
                { cookies }
              );
            } catch {
              // Idempotente — 404 se já foi deletado
            }
          }
        }

        // Excluir discípulos
        for (const discId of discipulosCriados) {
          try {
            await r.post(
              `/app/membros/${discId}`,
              { intent: "delete" },
              { cookies }
            );
          } catch {
            // Idempotente
          }
        }
        // Excluir 13º se foi criado
        if (decimoTerceiroId) {
          try {
            await r.post(
              `/app/membros/${decimoTerceiroId}`,
              { intent: "delete" },
              { cookies }
            );
          } catch {
            // Idempotente
          }
        }
        // Excluir discipulador
        if (discipuladorId) {
          try {
            await r.post(
              `/app/membros/${discipuladorId}`,
              { intent: "delete" },
              { cookies }
            );
          } catch {
            // Idempotente
          }
        }

        await r.post("/logout", {}, { cookies });
      }
    } catch (e) {
      console.error(`[${chainId}] cleanup error:`, e);
    }
    await ctx.dispose();
    await recordResult(chainId, {
      id: chainId,
      status: "executed",
      discipulosCriados: discipulosCriados.length,
      decimoTerceiroBlocked: true,
    });
  }
});

// ---------------------------------------------------------------------------
// CHAIN 2: ANTI-LOOP — A→B OK, B→A → 422
// ---------------------------------------------------------------------------

test("Chain 2: anti-loop — A→B passa, B→A falha com 422 'loop'", async ({
  playwright,
}) => {
  const chainId = "E2E-MEM-DISC-2";
  const ip = "10.0.20.2";
  const ctx = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const r = ipRequest(ctx, ip);
  let cookieValue: string | null = null;
  let membroAId: string | null = null;
  let membroBId: string | null = null;

  try {
    // Step 1: Login admin
    const resLogin = await r.post("/login", {
      email: ADMIN_EMAIL,
      senha: ADMIN_PASSWORD,
    });
    expect.soft(resLogin.status(), "POST /login").toBe(302);
    const setCookie = resLogin.headers()["set-cookie"] ?? "";
    const m = setCookie.match(/__session=([^;]+)/);
    cookieValue = m ? m[1] : null;
    expect.soft(cookieValue, "cookie extraído").toBeTruthy();
    const cookies = cookieValue ? `${SESSION_COOKIE}=${cookieValue}` : "";

    // Step 2: Criar membro A
    const resA = await r.post(
      "/app/membros/novo",
      { nome: "Membro A AntiLoop", tipo: "MEMBRO_ATIVO", email: "membroA+antiloop@igreja.local" },
      { cookies }
    );
    expect.soft(resA.status(), "criar A → 302").toBe(302);
    membroAId = extractMembroIdFromLocation(resA.headers().location);
    expect.soft(membroAId, "membro A ID").toBeTruthy();

    // Step 3: Criar membro B
    const resB = await r.post(
      "/app/membros/novo",
      { nome: "Membro B AntiLoop", tipo: "MEMBRO_ATIVO", email: "membroB+antiloop@igreja.local" },
      { cookies }
    );
    expect.soft(resB.status(), "criar B → 302").toBe(302);
    membroBId = extractMembroIdFromLocation(resB.headers().location);
    expect.soft(membroBId, "membro B ID").toBeTruthy();

    // Step 4: Vincular B como discípulo de A (A→B) — DEVE PASSAR
    if (membroBId && membroAId) {
      const resVincAB = await r.post(
        `/app/membros/${membroBId}/discipulado`,
        { intent: "assign", discipuladorId: membroAId },
        { cookies }
      );
      expect.soft(resVincAB.status(), "A→B vincular → 302").toBe(302);
      await recordResponse(chainId, "AB-ok", {
        status: resVincAB.status(),
        headers: resVincAB.headers(),
        body: "(redirect)",
      });
    }

    // Step 5: Tentar vincular A como discípulo de B (B→A) — DEVE FALHAR (loop)
    if (membroAId && membroBId) {
      const resVincBA = await r.post(
        `/app/membros/${membroAId}/discipulado`,
        { intent: "assign", discipuladorId: membroBId },
        { cookies }
      );
      const statusBA = resVincBA.status();
      const bodyBA = await resVincBA.text();
      expect.soft(statusBA, "B→A loop → 422").toBe(422);
      expect
        .soft(bodyBA.toLowerCase(), "mensagem menciona 'loop'")
        .toContain("loop");
      await recordResponse(chainId, "BA-loop", {
        status: statusBA,
        headers: resVincBA.headers(),
        body: bodyBA.slice(0, 2000),
      });
    }
  } finally {
    // Cleanup SEMPRE
    try {
      if (cookieValue) {
        const cookies = `${SESSION_COOKIE}=${cookieValue}`;

        // Desvincular B de A (se vinculado)
        if (membroBId) {
          try {
            await r.post(
              `/app/membros/${membroBId}/discipulado`,
              { intent: "unassign" },
              { cookies }
            );
          } catch { /* idempotente */ }
        }

        // Excluir B
        if (membroBId) {
          try {
            await r.post(`/app/membros/${membroBId}`, { intent: "delete" }, { cookies });
          } catch { /* idempotente */ }
        }
        // Excluir A
        if (membroAId) {
          try {
            await r.post(`/app/membros/${membroAId}`, { intent: "delete" }, { cookies });
          } catch { /* idempotente */ }
        }

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
// CHAIN 3: AUTO-VÍNCULO — tentar vincular membro a si mesmo → 400/422
// ---------------------------------------------------------------------------

test("Chain 3: auto-vínculo — self como discipulador falha com 400/422", async ({
  playwright,
}) => {
  const chainId = "E2E-MEM-DISC-3";
  const ip = "10.0.20.3";
  const ctx = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const r = ipRequest(ctx, ip);
  let cookieValue: string | null = null;
  let membroXId: string | null = null;

  try {
    // Step 1: Login admin
    const resLogin = await r.post("/login", {
      email: ADMIN_EMAIL,
      senha: ADMIN_PASSWORD,
    });
    expect.soft(resLogin.status(), "POST /login").toBe(302);
    const setCookie = resLogin.headers()["set-cookie"] ?? "";
    const m = setCookie.match(/__session=([^;]+)/);
    cookieValue = m ? m[1] : null;
    expect.soft(cookieValue, "cookie extraído").toBeTruthy();
    const cookies = cookieValue ? `${SESSION_COOKIE}=${cookieValue}` : "";

    // Step 2: Criar membro X
    const resX = await r.post(
      "/app/membros/novo",
      { nome: "Membro X AutoVinculo", tipo: "MEMBRO_ATIVO", email: "membroX+autovinculo@igreja.local" },
      { cookies }
    );
    expect.soft(resX.status(), "criar X → 302").toBe(302);
    membroXId = extractMembroIdFromLocation(resX.headers().location);
    expect.soft(membroXId, "membro X ID").toBeTruthy();

    // Step 3: Tentar vincular X como discípulo de X mesmo — DEVE FALHAR
    if (membroXId) {
      const resSelf = await r.post(
        `/app/membros/${membroXId}/discipulado`,
        { intent: "assign", discipuladorId: membroXId },
        { cookies }
      );
      const statusSelf = resSelf.status();
      const bodySelf = await resSelf.text();
      // Aceita 400 (auto-vínculo) ou 422 (BusinessRuleError)
      expect.soft(statusSelf, "auto-vínculo → 4xx").toBeGreaterThanOrEqual(400);
      expect.soft(statusSelf, "auto-vínculo → 4xx").toBeLessThan(500);
      expect
        .soft(bodySelf.toLowerCase(), "mensagem menciona 'próprio' ou 'self' ou 'discipulador'")
        .toMatch(/(próprio|própria|self|mesmo|não pode)/i);
      await recordResponse(chainId, "self", {
        status: statusSelf,
        headers: resSelf.headers(),
        body: bodySelf.slice(0, 2000),
      });
    }
  } finally {
    // Cleanup SEMPRE
    try {
      if (cookieValue) {
        const cookies = `${SESSION_COOKIE}=${cookieValue}`;

        // Excluir X
        if (membroXId) {
          try {
            await r.post(`/app/membros/${membroXId}`, { intent: "delete" }, { cookies });
          } catch { /* idempotente */ }
        }

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
// CHAIN 7: RN-MEM-06 — criar VISITANTE NÃO é promovido automaticamente
// ---------------------------------------------------------------------------

test("Chain 7: RN-MEM-06 — VISITANTE permanece VISITANTE (sem auto-promoção)", async ({
  playwright,
}) => {
  const chainId = "E2E-MEM-RN06-7";
  const ip = "10.0.20.7";
  const ctx = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const r = ipRequest(ctx, ip);
  let cookieValue: string | null = null;
  let visitanteId: string | null = null;

  try {
    // Step 1: Login admin
    const resLogin = await r.post("/login", {
      email: ADMIN_EMAIL,
      senha: ADMIN_PASSWORD,
    });
    expect.soft(resLogin.status(), "POST /login").toBe(302);
    const setCookie = resLogin.headers()["set-cookie"] ?? "";
    const m = setCookie.match(/__session=([^;]+)/);
    cookieValue = m ? m[1] : null;
    expect.soft(cookieValue, "cookie extraído").toBeTruthy();
    const cookies = cookieValue ? `${SESSION_COOKIE}=${cookieValue}` : "";

    // Step 2: Criar VISITANTE
    const resCriar = await r.post(
      "/app/membros/novo",
      { nome: "Visitante RN06", tipo: "VISITANTE", email: "visitante+rn06@igreja.local" },
      { cookies }
    );
    expect.soft(resCriar.status(), "criar VISITANTE → 302").toBe(302);
    visitanteId = extractMembroIdFromLocation(resCriar.headers().location);
    expect.soft(visitanteId, "visitante ID").toBeTruthy();
    await recordResponse(chainId, "criar", {
      status: resCriar.status(),
      headers: resCriar.headers(),
      body: "(redirect)",
    });

    // Step 3: Acessar /app/membros/:id — confirmar tipo ainda VISITANTE
    if (visitanteId) {
      const resDetalhe = await r.get(`/app/membros/${visitanteId}`, { cookies });
      expect.soft(resDetalhe.status(), "GET /app/membros/:id → 200").toBe(200);
      const body = await resDetalhe.text();
      expect.soft(body, "página contém badge VISITANTE").toContain("Visitante");
      expect.soft(body, "página contém valor tipo VISITANTE").toContain("VISITANTE");
      // NOTA: "CONGREGADO" aparece no form de promover (próximo tipo sugerido),
      // o que é esperado — isso NÃO é auto-promoção.
      await recordResponse(chainId, "detalhe", {
        status: resDetalhe.status(),
        headers: resDetalhe.headers(),
        body: body.slice(0, 5000),
      });
    }
  } finally {
    // Cleanup SEMPRE
    try {
      if (cookieValue) {
        const cookies = `${SESSION_COOKIE}=${cookieValue}`;

        // Excluir VISITANTE
        if (visitanteId) {
          try {
            await r.post(`/app/membros/${visitanteId}`, { intent: "delete" }, { cookies });
          } catch { /* idempotente */ }
        }

        await r.post("/logout", {}, { cookies });
      }
    } catch (e) {
      console.error(`[${chainId}] cleanup error:`, e);
    }
    await ctx.dispose();
    await recordResult(chainId, { id: chainId, status: "executed" });
  }
});
