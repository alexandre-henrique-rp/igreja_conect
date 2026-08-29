/**
 * Teste de app/lib/rate-limit.server.ts (rate limit: 3 tentativas/1h).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkRateLimit, resetRateLimit, unblockIP, getBlockedIPs } from "./rate-limit.server";
import { prisma } from "~/db/prisma.server";

// Mock do prisma para que logAction (que persiste no DB) não quebre em test.
// Os testes de unblockIP com user verificam a chamada via spy.
vi.mock("~/db/prisma.server", async () => {
  const actual = await vi.importActual<typeof import("~/db/prisma.server")>("~/db/prisma.server");
  return {
    ...actual,
    prisma: {
      ...actual.prisma,
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    },
  };
});

describe("rate-limit.server — checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-12T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    resetRateLimit();
  });

  it("permite primeira tentativa", () => {
    expect(checkRateLimit("ip-1")).toEqual({ allowed: true });
  });

  it("3 falhas bloqueiam na 4ª chamada", () => {
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit("ip-1", "fail").allowed).toBe(true);
    }
    expect(checkRateLimit("ip-1").allowed).toBe(false);
  });

  it("reseta contador ao receber 'success'", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("ip-1", "fail");
    expect(checkRateLimit("ip-1").allowed).toBe(false);
    expect(checkRateLimit("ip-1", "success").allowed).toBe(true);
    expect(checkRateLimit("ip-1")).toEqual({ allowed: true });
  });

  it("após 1h da primeira falha, libera", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("ip-1", "fail");
    expect(checkRateLimit("ip-1").allowed).toBe(false);
    vi.advanceTimersByTime(60 * 60 * 1000 + 1000);
    expect(checkRateLimit("ip-1")).toEqual({ allowed: true });
  });

  it("IPs diferentes têm buckets independentes", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("ip-1", "fail");
    expect(checkRateLimit("ip-1").allowed).toBe(false);
    expect(checkRateLimit("ip-2")).toEqual({ allowed: true });
  });
});

describe("rate-limit.server — unblockIP", () => {
  afterEach(() => {
    vi.useRealTimers();
    resetRateLimit();
    vi.mocked(prisma.auditLog.create).mockClear();
  });

  const admin = { id: "u-1", nome: "Admin", cargo: "ADMIN" as const };
  const nonAdmin = { id: "u-2", nome: "X", cargo: "SECRETARIO" as const };

  it("desbloqueia IP bloqueado", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("10.0.0.1", "fail");
    expect(checkRateLimit("10.0.0.1").allowed).toBe(false);
    unblockIP("10.0.0.1");
    expect(checkRateLimit("10.0.0.1")).toEqual({ allowed: true });
  });

  it("ignora silenciosamente IPs inválidos (regex/length)", () => {
    const valid = ["10.0.0.1", "2001:db8::1", "[::1]", "fe80::1%eth0", "192.168.1.255"];
    for (const ip of valid) {
      expect(() => unblockIP(ip, admin)).not.toThrow();
    }
    const invalid = [
      "",
      " ",
      "; rm -rf /",
      "<script>alert(1)</script>",
      "x".repeat(65), // > IP_MAX_LEN
      "10.0.0.1; DROP TABLE",
      "10.0.0.1\nX-Forwarded-For: 1.2.3.4",
      "ip-1", // test fixture antigo (não-IP)
    ];
    for (const ip of invalid) {
      expect(() => unblockIP(ip, admin)).not.toThrow();
    }
  });

  it("loga auditoria com ipHash (SHA-256) quando user ADMIN é fornecido", async () => {
    for (let i = 0; i < 3; i++) checkRateLimit("203.0.113.5", "fail");
    unblockIP("203.0.113.5", admin);

    // logAction é async (fire-and-forget); aguardar flush
    await new Promise((r) => setTimeout(r, 50));

    expect(prisma.auditLog.create).toHaveBeenCalledOnce();
    const arg = vi.mocked(prisma.auditLog.create).mock.calls[0][0] as { data: Record<string, unknown> };
    const data = arg.data;
    expect(data.event).toBe("ratelimit.unblock");
    expect(data.actorId).toBe("u-1");
    expect(data.actorRole).toBe("ADMIN");
    // ipHash presente (SHA-256), raw IP NUNCA persistido
    expect(data.ipHash).toMatch(/^[0-9a-f]{64}$/);
    // raw IP NUNCA persistido — só o hash (LGPD art. 46)
    expect(JSON.stringify(arg)).not.toContain("203.0.113.5");
    // reason está em `details` (serializado como string JSON) — esperado
    expect(JSON.parse(data.details as string)).toEqual({ reason: "admin_manual_override" });
  });

  it("NÃO chama audit log se user omitido (compat tests)", async () => {
    unblockIP("10.0.0.1");
    await new Promise((r) => setTimeout(r, 10));
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("lança Response(403) se user não-ADMIN for passado (camada 3)", () => {
    expect(() => unblockIP("10.0.0.1", nonAdmin)).toThrow();
    // buckets.delete NÃO deve ter sido chamado
    for (let i = 0; i < 3; i++) checkRateLimit("10.0.0.1", "fail");
    expect(() => unblockIP("10.0.0.1", nonAdmin)).toThrow();
    expect(checkRateLimit("10.0.0.1").allowed).toBe(false);
  });
});

describe("rate-limit.server — getBlockedIPs", () => {
  afterEach(() => {
    vi.useRealTimers();
    resetRateLimit();
  });

  it("retorna IPs bloqueados com contagem", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("ip-1", "fail");
    checkRateLimit("ip-2", "fail");
    const blocked = getBlockedIPs();
    expect(blocked).toHaveLength(1);
    expect(blocked[0].ip).toBe("ip-1");
    expect(blocked[0].count).toBe(3);
  });
});
