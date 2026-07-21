/**
 * Teste de app/routes/public/login.tsx (S01-T03).
 *
 * Cobre o action de login integrado: rate limit, validação Zod, verifyCredentials,
 * createSession, set-cookie, redirect.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { prismaTest, setupTestDb } from "../../../tests/helpers/db";
import { hashPassword } from "~/lib/auth.server";
import type { UNSAFE_DataWithResponseInit } from "react-router";

let cleanup: () => Promise<void>;
let action: typeof import("./login").action;
let loader: typeof import("./login").loader;
let resetRateLimit: () => void;

beforeAll(async () => {
  cleanup = await setupTestDb("login");
  await prismaTest.membro.create({
    data: {
      nome: "Admin Test",
      email: "admin-test@igreja.local",
      tipo: "MEMBRO_ATIVO",
      cargo: "ADMIN",
      senhaHash: await hashPassword("senha-correta-123"),
    },
  });
  vi.resetModules();
  const rlMod = await import("~/lib/rate-limit.server");
  resetRateLimit = rlMod.resetRateLimit;
  const mod = await import("./login");
  action = mod.action;
  loader = mod.loader;
});

afterAll(async () => { await cleanup(); });
beforeEach(async () => { await prismaTest.session.deleteMany(); });
afterEach(() => { resetRateLimit(); });

function makeFormRequest(formData: Record<string, string>, url = "http://localhost/login"): Request {
  const body = new URLSearchParams(formData);
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

/**
 * Extrai status e data de um retorno de action. Pode ser:
 * - `DataWithResponseInit` (de `data(...)`)
 * - `Response` (de `redirect(...)` ou `throw redirect(...)`)
 */
function unwrap(res: unknown): { status: number; data: unknown; headers: Headers } {
  // Resposta de redirect do RR7
  if (res instanceof Response) {
    return { status: res.status, data: undefined, headers: res.headers };
  }
  // DataWithResponseInit (de `data(...)`)
  const d = res as UNSAFE_DataWithResponseInit<unknown>;
  return { status: d.init?.status ?? 200, data: d.data, headers: new Headers(d.init?.headers) };
}

describe("login — loader", () => {
  it("GET sem cookie: retorna null (não autenticado)", async () => {
    const res = await loader({
      request: new Request("http://localhost/login"),
    } as Parameters<typeof loader>[0]);
    expect(res).toBeNull();
  });
});

describe("login — action", () => {
  it("senha errada → retorna 401 com formError unificado", async () => {
    const res = await action({
      request: makeFormRequest({
        email: "admin-test@igreja.local",
        senha: "senha-errada-999",
      }),
    } as Parameters<typeof action>[0]);
    const { status, data } = unwrap(res);
    expect(status).toBe(401);
    expect((data as { formError?: string }).formError).toBe("E-mail ou senha incorretos.");
  });

  it("email inexistente → 401 com mesma mensagem (anti-enumeração)", async () => {
    const res = await action({
      request: makeFormRequest({
        email: "nao-existe@igreja.local",
        senha: "qualquer-senha",
      }),
    } as Parameters<typeof action>[0]);
    const { status, data } = unwrap(res);
    expect(status).toBe(401);
    expect((data as { formError?: string }).formError).toBe("E-mail ou senha incorretos.");
  });

  it("email malformado → 422 com fieldErrors no campo email", async () => {
    const res = await action({
      request: makeFormRequest({
        email: "nao-eh-email",
        senha: "qualquer",
      }),
    } as Parameters<typeof action>[0]);
    const { status, data } = unwrap(res);
    expect(status).toBe(422);
    expect((data as { fieldErrors?: Record<string, string> }).fieldErrors?.email).toBeDefined();
  });

  it("senha vazia → 422 com fieldErrors no campo senha", async () => {
    const res = await action({
      request: makeFormRequest({
        email: "admin-test@igreja.local",
        senha: "",
      }),
    } as Parameters<typeof action>[0]);
    const { status, data } = unwrap(res);
    expect(status).toBe(422);
    expect((data as { fieldErrors?: Record<string, string> }).fieldErrors?.senha).toBeDefined();
  });

  it("credenciais válidas → 302 redirect para /app + Set-Cookie", async () => {
    const res = await action({
      request: makeFormRequest({
        email: "admin-test@igreja.local",
        senha: "senha-correta-123",
      }),
    } as Parameters<typeof action>[0]);
    // redirect() retorna Response 302
    const { status, headers } = unwrap(res);
    expect(status).toBe(302);
    expect(headers.get("Location")).toBe("/app");
    const setCookie = headers.get("Set-Cookie");
    expect(setCookie).toContain("__session=");
    expect(setCookie).toContain("HttpOnly");
  });

  it("?next=/app/membros redireciona para lá após login", async () => {
    const res = await action({
      request: makeFormRequest(
        {
          email: "admin-test@igreja.local",
          senha: "senha-correta-123",
        },
        "http://localhost/login?next=%2Fapp%2Fmembros"
      ),
    } as Parameters<typeof action>[0]);
    const { status, headers } = unwrap(res);
    expect(status).toBe(302);
    expect(headers.get("Location")).toBe("/app/membros");
  });

  it("?next=//evil.com é bloqueado (open-redirect), redireciona para /app", async () => {
    const res = await action({
      request: makeFormRequest(
        {
          email: "admin-test@igreja.local",
          senha: "senha-correta-123",
        },
        "http://localhost/login?next=%2F%2Fevil.com"
      ),
    } as Parameters<typeof action>[0]);
    const { status, headers } = unwrap(res);
    expect(status).toBe(302);
    expect(headers.get("Location")).toBe("/app");
  });

  it("3 falhas do mesmo IP → 4ª chamada retorna 429", async () => {
    for (let i = 0; i < 3; i++) {
      const body = new URLSearchParams({ email: "x@x.com", senha: "errada-999" });
      const req = new Request("http://localhost/login", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-forwarded-for": "10.0.0.99",
        },
        body: body.toString(),
      });
      const r = await action({ request: req } as Parameters<typeof action>[0]);
      const { status } = unwrap(r);
      expect(status).toBe(401);
    }
    const body = new URLSearchParams({ email: "admin-test@igreja.local", senha: "senha-correta-123" });
    const blockedReq = new Request("http://localhost/login", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-forwarded-for": "10.0.0.99",
      },
      body: body.toString(),
    });
    const blocked = await action({ request: blockedReq } as Parameters<typeof action>[0]);
    const { status } = unwrap(blocked);
    expect(status).toBe(429);
  });
});
