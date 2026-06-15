/**
 * Teste de app/routes/logout.tsx (S01-T04).
 *
 * Cobre: idempotência (sem cookie = ainda redireciona), com cookie válido
 * deleta sessão no DB, sempre seta Set-Cookie expirando.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prismaTest, setupTestDb } from "../../tests/helpers/db";
import { hashPassword } from "~/lib/auth.server";

let cleanup: () => Promise<void>;
let action: typeof import("./logout").action;
let createSession: typeof import("~/lib/session.server").createSession;
let sessionCookie: typeof import("~/lib/session.server").sessionCookie;

beforeAll(async () => {
  cleanup = await setupTestDb("routes_logout");
  vi.resetModules();
  const mod = await import("./logout");
  action = mod.action;
  const sess = await import("~/lib/session.server");
  createSession = sess.createSession;
  sessionCookie = sess.sessionCookie;
});

afterAll(async () => { await cleanup(); });

describe("logout — action", () => {
  it("POST sem cookie: ainda redireciona para /login (idempotente)", async () => {
    const res = await action({
      request: new Request("http://localhost/logout", { method: "POST" }),
    } as Parameters<typeof action>[0]);
    // redirect() → Response 302
    expect(res).toBeInstanceOf(Response);
    const response = res as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/login");
    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toContain("__session=");
    expect(setCookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });

  it("POST com cookie válido: deleta sessão do DB e redireciona", async () => {
    const m = await prismaTest.membro.create({
      data: {
        nome: "Logout Test",
        email: "logout-test@igreja.local",
        tipo: "MEMBRO_ATIVO",
        cargo: "ADMIN",
        senhaHash: await hashPassword("senha-123"),
      },
    });
    const sid = await createSession(m.id);
    expect(await prismaTest.session.findUnique({ where: { id: sid } })).not.toBeNull();

    const cookieHeader = await sessionCookie.serialize(sid);
    const res = await action({
      request: new Request("http://localhost/logout", {
        method: "POST",
        headers: { Cookie: cookieHeader },
      }),
    } as Parameters<typeof action>[0]);
    expect(res).toBeInstanceOf(Response);
    const response = res as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/login");
    // Sessão deletada do DB
    expect(await prismaTest.session.findUnique({ where: { id: sid } })).toBeNull();
  });

  it("POST com cookie inválido: redireciona sem erro", async () => {
    const res = await action({
      request: new Request("http://localhost/logout", {
        method: "POST",
        headers: { Cookie: "__session=invalido-sem-assinatura" },
      }),
    } as Parameters<typeof action>[0]);
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(302);
  });
});
