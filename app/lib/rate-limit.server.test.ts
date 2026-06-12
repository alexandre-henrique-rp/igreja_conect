/**
 * Teste de app/lib/rate-limit.server.ts (S00 — rate limit).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkRateLimit, resetRateLimit } from "./rate-limit.server";

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

  it("5 falhas ainda não bloqueiam (count=5 < MAX=5? não, é igual)", () => {
    // A 5ª falha completa count=5. A próxima chamada é que deve bloquear.
    for (let i = 0; i < 4; i++) {
      expect(checkRateLimit("ip-1", "fail").allowed).toBe(true);
    }
    // 5ª falha: count=5, mas allowed=true ainda
    expect(checkRateLimit("ip-1", "fail").allowed).toBe(true);
  });

  it("6ª chamada após 5 falhas é bloqueada", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("ip-1", "fail");
    const r = checkRateLimit("ip-1");
    expect(r.allowed).toBe(false);
    expect(r.retryAfter).toBeGreaterThan(0);
  });

  it("reseta contador ao receber 'success'", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("ip-1", "fail");
    expect(checkRateLimit("ip-1").allowed).toBe(false);
    expect(checkRateLimit("ip-1", "success").allowed).toBe(true);
    expect(checkRateLimit("ip-1")).toEqual({ allowed: true });
  });

  it("após 15min da primeira falha, libera", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("ip-1", "fail");
    expect(checkRateLimit("ip-1").allowed).toBe(false);
    vi.advanceTimersByTime(15 * 60 * 1000 + 1000);
    expect(checkRateLimit("ip-1")).toEqual({ allowed: true });
  });

  it("IPs diferentes têm buckets independentes", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("ip-1", "fail");
    expect(checkRateLimit("ip-1").allowed).toBe(false);
    expect(checkRateLimit("ip-2")).toEqual({ allowed: true });
  });
});
