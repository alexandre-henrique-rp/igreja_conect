/**
 * Teste de app/lib/cn.ts (S00-T15).
 */
import { describe, it, expect } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("combina strings truthy", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });
  it("ignora false, undefined, null, 0, ''", () => {
    expect(cn("a", false && "b", undefined, null, 0, "", "c")).toBe("a c");
  });
  it("aceita array de strings", () => {
    expect(cn(["a", "b"], "c")).toBe("a b c");
  });
  it("aceita objeto (chave: boolean)", () => {
    expect(cn({ a: true, b: false, c: true })).toBe("a c");
  });
  it("mix de tipos", () => {
    expect(cn("base", { cond: true, off: false }, undefined, "extra")).toBe("base cond extra");
  });
});
