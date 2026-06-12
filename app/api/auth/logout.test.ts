/**
 * Teste de app/api/auth/logout.ts (S00-T10).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prismaTest, setupTestDb } from "../../../tests/helpers/db";
import { hashPassword } from "~/lib/auth.server";

let cleanup: () => Promise<void>;
let action: typeof import("./logout").action;
let createSession: (membroId: string) => Promise<string>;

beforeAll(async () => {
  cleanup = await setupTestDb();
  // Reset modules para que ~/db/prisma.server reimporte apontando para test.db
  vi.resetModules();
  ({ action } = await import("./logout"));
  const sess = await import("~/lib/session.server");
  createSession = sess.createSession;
});

afterAll(async () => { await cleanup(); });

describe("logout — action", () => {
  it("rejeita método não-POST com 405", async () => {
    const res = await action({ request: new Request("http://localhost/x", { method: "GET" }) } as Parameters<typeof action>[0]);
    expect(res.status).toBe(405);
  });

  it("retorna 204 + Set-Cookie expirando, mesmo sem cookie", async () => {
    const res = await action({ request: new Request("http://localhost/x", { method: "POST" }) } as Parameters<typeof action>[0]);
    expect(res.status).toBe(204);
    expect(res.headers.get("Set-Cookie")).toContain("__session=");
  });

  it("com cookie válido, deleta a sessão do DB", async () => {
    const m = await prismaTest.membro.create({
      data: {
        nome: "Logout User",
        email: "logout@x.com",
        tipo: "MEMBRO_ATIVO",
        cargo: "ADMIN",
        senhaHash: await hashPassword("x12345678"),
      },
    });
    const sid = await createSession(m.id);
    expect(await prismaTest.session.findUnique({ where: { id: sid } })).not.toBeNull();

    // Cria um cookie assinado válido usando a sessionCookie
    const { sessionCookie } = await import("~/lib/session.server");
    const cookieHeader = await sessionCookie.serialize(sid);

    const res = await action({
      request: new Request("http://localhost/x", {
        method: "POST",
        headers: { Cookie: cookieHeader },
      }),
    } as Parameters<typeof action>[0]);

    expect(res.status).toBe(204);
    expect(await prismaTest.session.findUnique({ where: { id: sid } })).toBeNull();
  });
});
