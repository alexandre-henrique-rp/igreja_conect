/**
 * Teste de app/lib/session.server.ts (S00-T04).
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { prismaTest, setupTestDb, resetTestDb } from "../../tests/helpers/db";
import { hashPassword } from "./auth.server";

let cleanup: () => Promise<void>;
let membroId: string;
let createSession: typeof import("./session.server").createSession;
let getUserFromRequest: typeof import("./session.server").getUserFromRequest;
let deleteSession: typeof import("./session.server").deleteSession;
let sessionCookie: typeof import("./session.server").sessionCookie;

beforeAll(async () => {
  cleanup = await setupTestDb();
  const m = await prismaTest.membro.create({
    data: {
      nome: "Test User",
      email: "session-test@igreja.local",
      tipo: "MEMBRO_ATIVO",
      cargo: "ADMIN",
      senhaHash: await hashPassword("senha-123"),
    },
  });
  membroId = m.id;

  vi.resetModules();
  const mod = await import("./session.server");
  createSession = mod.createSession;
  getUserFromRequest = mod.getUserFromRequest;
  deleteSession = mod.deleteSession;
  sessionCookie = mod.sessionCookie;
});

afterAll(async () => { await cleanup(); });

beforeEach(async () => { await prismaTest.session.deleteMany(); });

/** Gera um cookie válido (assinado) com o sid fornecido. */
async function makeCookieHeader(sid: string): Promise<string> {
  return sessionCookie.serialize(sid);
}

describe("session.server — createSession", () => {
  it("persiste registro em Session com expiresAt e absoluteExpiresAt", async () => {
    const before = Date.now();
    const sid = await createSession(membroId, prismaTest);
    const after = Date.now();

    const sess = await prismaTest.session.findUnique({ where: { id: sid } });
    expect(sess).not.toBeNull();
    expect(sess!.membroId).toBe(membroId);
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(sess!.expiresAt.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(sess!.expiresAt.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(sess!.absoluteExpiresAt.getTime()).toBeGreaterThanOrEqual(before + thirtyDaysMs - 1000);
  });
});

describe("session.server — getUserFromRequest", () => {
  it("retorna {id, nome, cargo} quando o cookie bate com sessão válida", async () => {
    const sid = await createSession(membroId, prismaTest);
    const cookie = await makeCookieHeader(sid);
    const req = new Request("http://localhost/dashboard", { headers: { Cookie: cookie } });
    const user = await getUserFromRequest(req, prismaTest);
    expect(user).not.toBeNull();
    expect(user!.id).toBe(membroId);
    expect(user!.nome).toBe("Test User");
    expect(user!.cargo).toBe("ADMIN");
  });

  it("retorna null quando o cookie não existe", async () => {
    const req = new Request("http://localhost/dashboard");
    expect(await getUserFromRequest(req, prismaTest)).toBeNull();
  });

  it("retorna null quando o cookie é inválido (asssintatura não confere)", async () => {
    const req = new Request("http://localhost/dashboard", {
      headers: { Cookie: "__session=uuid-invalido-sem-assinatura" },
    });
    expect(await getUserFromRequest(req, prismaTest)).toBeNull();
  });

  it("faz sliding renewal: atualiza expiresAt para ~7d no futuro", async () => {
    const sid = await createSession(membroId, prismaTest);
    await prismaTest.session.update({
      where: { id: sid },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const cookie = await makeCookieHeader(sid);
    const req = new Request("http://localhost/dashboard", { headers: { Cookie: cookie } });
    await getUserFromRequest(req, prismaTest);
    const after = await prismaTest.session.findUnique({ where: { id: sid } });
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(after!.expiresAt.getTime()).toBeGreaterThanOrEqual(Date.now() + sevenDays - 2000);
  });

  it("retorna null quando absoluteExpiresAt já passou", async () => {
    const sid = await createSession(membroId, prismaTest);
    await prismaTest.session.update({
      where: { id: sid },
      data: { absoluteExpiresAt: new Date(Date.now() - 1000) },
    });
    const cookie = await makeCookieHeader(sid);
    const req = new Request("http://localhost/dashboard", { headers: { Cookie: cookie } });
    expect(await getUserFromRequest(req, prismaTest)).toBeNull();
  });
});

describe("session.server — deleteSession", () => {
  it("remove o registro da tabela sessions", async () => {
    const sid = await createSession(membroId, prismaTest);
    await deleteSession(sid, prismaTest);
    const sess = await prismaTest.session.findUnique({ where: { id: sid } });
    expect(sess).toBeNull();
  });

  it("após deleteSession, getUserFromRequest retorna null", async () => {
    const sid = await createSession(membroId, prismaTest);
    const cookie = await makeCookieHeader(sid);
    const req = new Request("http://localhost/dashboard", { headers: { Cookie: cookie } });
    await deleteSession(sid, prismaTest);
    expect(await getUserFromRequest(req, prismaTest)).toBeNull();
  });

  it("deleteSession com sid inexistente é no-op", async () => {
    await expect(deleteSession("nope")).resolves.not.toThrow();
  });
});

// ==================== SEC-003: SESSION_SECRET startup validation ====================

describe("session.server — SESSION_SECRET startup validation (SEC-003)", () => {
  it("deve jogar Error se NODE_ENV=production e SESSION_SECRET não está definido", async () => {
    // Salva env original
    const origNodeEnv = process.env.NODE_ENV;
    const origSecret = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    process.env.NODE_ENV = "production";

    // Precisa re-importar o módulo para disparar a validação
    vi.resetModules();
    let threw = false;
    let errorMsg = "";
    try {
      await import("./session.server");
    } catch (e: unknown) {
      if (e instanceof Error) {
        threw = true;
        errorMsg = e.message;
      }
    } finally {
      process.env.NODE_ENV = origNodeEnv;
      if (origSecret !== undefined) process.env.SESSION_SECRET = origSecret;
    }

    expect(threw).toBe(true);
    expect(errorMsg).toMatch(/SESSION_SECRET.*obrigat/);
  });

  it("deve jogar Error se SESSION_SECRET tem menos de 32 caracteres", async () => {
    const origNodeEnv = process.env.NODE_ENV;
    const origSecret = process.env.SESSION_SECRET;
    process.env.NODE_ENV = "production";
    process.env.SESSION_SECRET = "curto";

    vi.resetModules();
    let threw = false;
    let errorMsg = "";
    try {
      await import("./session.server");
    } catch (e: unknown) {
      if (e instanceof Error) {
        threw = true;
        errorMsg = e.message;
      }
    } finally {
      process.env.NODE_ENV = origNodeEnv;
      if (origSecret !== undefined) process.env.SESSION_SECRET = origSecret;
    }

    expect(threw).toBe(true);
    expect(errorMsg).toMatch(/32 caracteres/);
  });
});
