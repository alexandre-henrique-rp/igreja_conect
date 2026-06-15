/**
 * E2E: Promover tipo (RN-MEM-06 / DEB-MVP-1) — Igreja Conect.
 *
 * Cobre o fluxo completo de promoção de tipo de membro:
 *   1. Login como admin
 *   2. Criar VISITANTE via POST /app/membros/novo
 *   3. GET /app/membros/:id — verifica badge "Visitante" e botão "Promover → CONGREGADO"
 *   4. POST /app/membros/:id/tipo com tipo=CONGREGADO → 302 (rota dedicada S03-T08)
 *   5. GET /app/membros/:id — verifica badge mudou para "Congregado"
 *
 * **Isolamento:** email com SUFFIX único (UUID) evita colisão em reexecução.
 * **Cleanup:** exclui o membro criado e faz logout, mesmo em caso de falha.
 *
 * @see app/routes/app/membros.$id.tipo.tsx (rota dedicada)
 * @see app/lib/members.server.ts (promoverTipo)
 * @see app/components/TabDadosPessoais.tsx (UI do botão)
 */
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** URL base forçando IPv4 (evita dual-stack ::1 vs 127.0.0.1). */
const BASE_URL = "http://127.0.0.1:5173";

/** Credenciais ADMIN (seed S00). */
const ADMIN_EMAIL = "admin@igreja.local";
const ADMIN_PASSWORD = "admin123";

/** Nome do cookie de sessão. */
const SESSION_COOKIE = "__session";

/** Sufixo único para emails — evita colisão em reexecução. */
const SUFFIX = `promover-e2e-${randomUUID().slice(0, 8)}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extrai o UUID do membro do header `Location`.
 * O Location pode ser `/app/membros/<uuid>` (com ou sem prefixo `/app`).
 */
function extractMembroIdFromLocation(location: string | undefined): string | null {
  if (!location) return null;
  const match = location.match(/(?:\/app)?\/membros\/([a-f0-9-]+)/i);
  return match ? match[1] : null;
}

/**
 * Extrai o valor do cookie `__session` do header `Set-Cookie`.
 */
function extractSessionCookie(setCookie: string): string | null {
  const match = setCookie.match(/__session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test("DEB-MVP-1: promover VISITANTE → CONGREGADO via rota dedicada /app/membros/:id/tipo", async ({
  playwright,
}) => {
  const ip = "10.0.99.1";
  const ctx = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });

  let cookieValue: string | null = null;
  let visitanteId: string | null = null;
  let failed = false;
  let failedAt = "";

  try {
    // -----------------------------------------------------------------------
    // Step 1: Login como admin
    // -----------------------------------------------------------------------
    failedAt = "login";
    const resLogin = await ctx.post("/login", {
      form: { email: ADMIN_EMAIL, senha: ADMIN_PASSWORD },
      maxRedirects: 0,
    });
    expect(resLogin.status(), "POST /login → 302").toBe(302);
    const setCookie = resLogin.headers()["set-cookie"] ?? "";
    cookieValue = extractSessionCookie(setCookie);
    expect(cookieValue, "cookie __session extraído").toBeTruthy();
    const cookies = `${SESSION_COOKIE}=${cookieValue}`;

    // -----------------------------------------------------------------------
    // Step 2: Criar VISITANTE via POST /app/membros/novo
    // -----------------------------------------------------------------------
    failedAt = "criar-visitante";
    const visitanteNome = `Visitante Promover ${SUFFIX}`;
    const visitanteTelefone = `119${String(Date.now()).slice(-8)}`;
    const resCriar = await ctx.post("/app/membros/novo", {
      form: {
        nome: visitanteNome,
        tipo: "VISITANTE",
        telefone: visitanteTelefone,
      },
      headers: { cookie: cookies },
      maxRedirects: 0,
    });
    expect(resCriar.status(), "POST /app/membros/novo → 302").toBe(302);
    visitanteId = extractMembroIdFromLocation(resCriar.headers().location);
    expect(visitanteId, "ID do visitante extraído do Location").toBeTruthy();

    // -----------------------------------------------------------------------
    // Step 3: GET /app/membros/:id — verificar badge "Visitante" e botão
    // -----------------------------------------------------------------------
    failedAt = "verificar-antes";
    const resAntes = await ctx.get(`/app/membros/${visitanteId}`, {
      headers: { cookie: cookies },
    });
    expect(resAntes.status(), "GET /app/membros/:id → 200").toBe(200);
    const bodyAntes = await resAntes.text();

    // Badge "Visitante" presente (tipo atual)
    expect(bodyAntes, "badge 'Visitante' visível antes da promoção").toContain("Visitante");
    // O botão "Promover → CONGREGADO" aparece (prove que a UI aponta para o tipo certo)
    expect(bodyAntes, "botão 'Promover → CONGREGADO' visível").toContain("CONGREGADO");
    // O form aponta para a rota dedicada /app/membros/:id/tipo (não para /app/membros/:id)
    expect(bodyAntes, "form action aponta para /tipo (rota dedicada)").toContain(
      `/app/membros/${visitanteId}/tipo`
    );
    // Não deve conter o antigo input intent=promover
    expect(bodyAntes, "NÃO contém intent=promover (rota dedicada)").not.toContain(
      'value="promover"'
    );

    // -----------------------------------------------------------------------
    // Step 4: POST /app/membros/:id/tipo com tipo=CONGREGADO → 302
    // -----------------------------------------------------------------------
    failedAt = "promover";
    expect(visitanteId, "visitanteId não é nulo para promoção").toBeTruthy();
    const resPromover = await ctx.post(`/app/membros/${visitanteId}/tipo`, {
      form: { tipo: "CONGREGADO" },
      headers: { cookie: cookies },
      maxRedirects: 0,
    });
    expect(resPromover.status(), "POST /app/membros/:id/tipo → 302").toBe(302);
    expect(
      resPromover.headers().location,
      "Location redireciona para página do membro"
    ).toBe(`/app/membros/${visitanteId}`);

    // -----------------------------------------------------------------------
    // Step 5: GET /app/membros/:id — verificar badge mudou para "Congregado"
    // -----------------------------------------------------------------------
    failedAt = "verificar-depois";
    const resDepois = await ctx.get(`/app/membros/${visitanteId}`, {
      headers: { cookie: cookies },
    });
    expect(resDepois.status(), "GET /app/membros/:id após promoção → 200").toBe(200);
    const bodyDepois = await resDepois.text();

    // Badge agora é "Congregado"
    expect(bodyDepois, "badge 'Congregado' visível após promoção").toContain("Congregado");
    // E o próximo botão deve sugerir "MEMBRO_ATIVO"
    expect(bodyDepois, "botão 'Promover → MEMBRO_ATIVO' visível (próximo nível)").toContain(
      "MEMBRO_ATIVO"
    );
  } catch (error) {
    failed = true;
    console.error(`[promover-tipo] falhou em: ${failedAt}`, (error as Error).message);
    throw error;
  } finally {
    // Cleanup SEMPRE
    try {
      if (cookieValue && visitanteId) {
        const cookies = `${SESSION_COOKIE}=${cookieValue}`;
        // Exclui o membro criado
        await ctx.post(`/app/membros/${visitanteId}`, {
          form: { intent: "delete" },
          headers: { cookie: cookies },
          maxRedirects: 0,
        });
      }
    } catch (e) {
      console.error("[promover-tipo] cleanup error:", e);
    }
    try {
      if (cookieValue) {
        await ctx.post("/logout", {
          headers: { cookie: `${SESSION_COOKIE}=${cookieValue}` },
          maxRedirects: 0,
        });
      }
    } catch (e) {
      console.error("[promover-tipo] logout error:", e);
    }
    await ctx.dispose();
  }
});
