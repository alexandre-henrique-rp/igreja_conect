/**
 * Smoke test de Zod (S00-T14).
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

describe("zod smoke", () => {
  it("z.string().email() está disponível e funciona", () => {
    const schema = z.string().email();
    expect(schema.safeParse("valid@x.com").success).toBe(true);
    expect(schema.safeParse("invalid").success).toBe(false);
  });
});
