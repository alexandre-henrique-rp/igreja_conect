/**
 * Teste de app/lib/audit.server.ts (S00-T06).
 *
 * Verifica que safeLog filtra campos sensíveis (email, senhaHash, etc.)
 * e mantém apenas os da allowlist (RAG `lgpd-igreja-conect` §2.5).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { safeLog, ALLOWED_FIELDS } from "./audit.server";

describe("audit.server — safeLog", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { logSpy = vi.spyOn(console, "log").mockImplementation(() => {}); });
  afterEach(() => { logSpy.mockRestore(); });

  it("ALLOWED_FIELDS contém os campos seguros esperados", () => {
    expect(ALLOWED_FIELDS.has("userId")).toBe(true);
    expect(ALLOWED_FIELDS.has("action")).toBe(true);
    expect(ALLOWED_FIELDS.has("resource")).toBe(true);
    expect(ALLOWED_FIELDS.has("result")).toBe(true);
    expect(ALLOWED_FIELDS.has("timestamp")).toBe(true);
    expect(ALLOWED_FIELDS.has("ip")).toBe(true);
  });

  it("ALLOWED_FIELDS NÃO contém campos sensíveis", () => {
    expect(ALLOWED_FIELDS.has("email")).toBe(false);
    expect(ALLOWED_FIELDS.has("senhaHash")).toBe(false);
    expect(ALLOWED_FIELDS.has("password")).toBe(false);
    expect(ALLOWED_FIELDS.has("telefone")).toBe(false);
    expect(ALLOWED_FIELDS.has("valorCentavos")).toBe(false);
  });

  it("imprime apenas os campos permitidos via console.log", () => {
    safeLog({ userId: "u1", action: "login", email: "x@x.com", senhaHash: "hash" });
    expect(logSpy).toHaveBeenCalledTimes(1);
    const arg = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(arg);
    expect(parsed.audit.userId).toBe("u1");
    expect(parsed.audit.action).toBe("login");
    expect(parsed.audit.email).toBeUndefined();
    expect(parsed.audit.senhaHash).toBeUndefined();
  });

  it("não imprime nada se o evento é vazio", () => {
    safeLog({});
    expect(logSpy).toHaveBeenCalledTimes(1);
    const arg = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(arg);
    expect(parsed.audit).toEqual({});
  });
});
