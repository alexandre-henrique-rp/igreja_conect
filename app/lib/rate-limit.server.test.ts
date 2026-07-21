/**
 * Teste de app/lib/rate-limit.server.ts (rate limit: 3 tentativas/1h).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkRateLimit, resetRateLimit, unblockIP, getBlockedIPs } from "./rate-limit.server";

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
  });

  it("desbloqueia IP bloqueado", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("ip-1", "fail");
    expect(checkRateLimit("ip-1").allowed).toBe(false);
    unblockIP("ip-1");
    expect(checkRateLimit("ip-1")).toEqual({ allowed: true });
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
