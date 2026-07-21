/**
 * Teste de app/api/auth/login.ts (S00-T09).
 *
 * Cobre: payload inválido, rate limit, credenciais inválidas, login OK.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest";
import { prismaTest, setupTestDb } from "../../../tests/helpers/db";
import { hashPassword } from "~/lib/auth.server";

let cleanup: () => Promise<void>;
let action: typeof import("./login").action;
let resetRateLimit: () => void;

beforeAll(async () => {
  cleanup = await setupTestDb();
  await prismaTest.membro.create({
    data: {
      nome: "Test",
      email: "test@igreja.local",
      tipo: "MEMBRO_ATIVO",
      cargo: "ADMIN",
      senhaHash: await hashPassword("senha-correta-123"),
    },
  });
  vi.resetModules();
  const rlMod = await import("~/lib/rate-limit.server");
  resetRateLimit = rlMod.resetRateLimit;
  ({ action } = await import("./login"));
});

afterAll(async () => { await cleanup(); });
afterEach(() => { resetRateLimit(); });

function makeRequest(body: unknown, method = "POST", ip = "ip-1"): Request {
  return new Request("http://localhost/api/auth/login", {
    method,
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(body),
  });
}

describe("login — action", () => {
  it("rejeita método não-POST com 405", async () => {
    const res = await action({ request: makeRequest({}, "GET") } as Parameters<typeof action>[0]);
    expect(res.status).toBe(405);
  });

  it("retorna 400 com payload inválido (sem email)", async () => {
    const res = await action({ request: makeRequest({ senha: "12345678" }) } as Parameters<typeof action>[0]);
    expect(res.status).toBe(400);
  });

  it("retorna 400 com senha < 8 chars", async () => {
    const res = await action({ request: makeRequest({ email: "test@igreja.local", senha: "123" }) } as Parameters<typeof action>[0]);
    expect(res.status).toBe(400);
  });

  it("retorna 401 com email inexistente (mensagem genérica)", async () => {
    const res = await action({ request: makeRequest({ email: "nao-existe@x.com", senha: "12345678" }) } as Parameters<typeof action>[0]);
    expect(res.status).toBe(401);
  });

  it("retorna 401 com senha errada", async () => {
    const res = await action({ request: makeRequest({ email: "test@igreja.local", senha: "errada-123" }) } as Parameters<typeof action>[0]);
    expect(res.status).toBe(401);
  });

  it("retorna 204 + Set-Cookie com credenciais corretas", async () => {
    const res = await action({ request: makeRequest({ email: "test@igreja.local", senha: "senha-correta-123" }) } as Parameters<typeof action>[0]);
    expect(res.status).toBe(204);
    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toContain("__session=");
    expect(setCookie).toContain("HttpOnly");
  });

  it("retorna 429 após 3 falhas do mesmo IP", async () => {
    for (let i = 0; i < 3; i++) {
      const r = await action({ request: makeRequest({ email: "x@x.com", senha: "errada-123" }, "POST", "ip-rate") } as Parameters<typeof action>[0]);
      expect(r.status).toBe(401);
    }
    const blocked = await action({ request: makeRequest({ email: "test@igreja.local", senha: "senha-correta-123" }, "POST", "ip-rate") } as Parameters<typeof action>[0]);
    expect(blocked.status).toBe(429);
  });
});
