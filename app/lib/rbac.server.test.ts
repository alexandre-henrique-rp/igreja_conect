/**
 * Teste de app/lib/rbac.server.ts (S00-T05).
 *
 * Cobre as 6 células da matriz RBAC para cada helper canônico:
 * - assertCanSeeFinancials: ADMIN, PASTOR, FINANCEIRO passam; SECRETARIO, DISCIPULADOR, LIDER_MINISTERIO falham
 * - assertCanWriteMembers: todos os 6 passam; null falha
 * - assertIsAdmin: só ADMIN passa
 * - assertCanManageConfiguracaoGeral: só ADMIN
 */
import { describe, it, expect } from "vitest";
import {
  assertCanSeeFinancials,
  assertCanWriteMembers,
  assertIsAdmin,
  assertCanManageConfiguracaoGeral,
} from "./rbac.server";
import type { SessionUser } from "./session.server";

const u = (cargo: SessionUser["cargo"]): SessionUser => ({ id: "u1", nome: "U", cargo });

describe("rbac.server — assertCanSeeFinancials", () => {
  it.each(["ADMIN", "PASTOR", "FINANCEIRO"] as const)(
    "%s pode ver dados financeiros",
    (cargo) => {
      expect(() => assertCanSeeFinancials(u(cargo))).not.toThrow();
    }
  );

  it.each(["SECRETARIO", "DISCIPULADOR", "LIDER_MINISTERIO", null] as const)(
    "%s NÃO pode ver dados financeiros (lança Response 403)",
    (cargo) => {
      try {
        assertCanSeeFinancials(u(cargo));
        expect.fail("deveria ter lançado");
      } catch (e) {
        expect(e).toBeInstanceOf(Response);
        expect((e as Response).status).toBe(403);
      }
    }
  );
});

describe("rbac.server — assertCanWriteMembers", () => {
  it.each(["ADMIN", "PASTOR", "SECRETARIO", "DISCIPULADOR", "FINANCEIRO", "LIDER_MINISTERIO"] as const)(
    "%s pode escrever membros",
    (cargo) => {
      expect(() => assertCanWriteMembers(u(cargo))).not.toThrow();
    }
  );

  it("membro sem cargo (null) NÃO pode escrever", () => {
    try {
      assertCanWriteMembers(u(null));
      expect.fail("deveria ter lançado");
    } catch (e) {
      expect(e).toBeInstanceOf(Response);
      expect((e as Response).status).toBe(403);
    }
  });
});

describe("rbac.server — assertIsAdmin", () => {
  it("ADMIN pode", () => {
    expect(() => assertIsAdmin(u("ADMIN"))).not.toThrow();
  });

  it.each(["PASTOR", "SECRETARIO", "DISCIPULADOR", "FINANCEIRO", "LIDER_MINISTERIO", null] as const)(
    "%s NÃO pode",
    (cargo) => {
      try {
        assertIsAdmin(u(cargo));
        expect.fail("deveria ter lançado");
      } catch (e) {
        expect(e).toBeInstanceOf(Response);
        expect((e as Response).status).toBe(403);
      }
    }
  );
});

describe("rbac.server — assertCanManageConfiguracaoGeral", () => {
  it("ADMIN pode gerenciar configurações gerais", () => {
    expect(() => assertCanManageConfiguracaoGeral(u("ADMIN"))).not.toThrow();
  });

  it.each(["PASTOR", "SECRETARIO", "DISCIPULADOR", "FINANCEIRO", "LIDER_MINISTERIO", null] as const)(
    "%s NÃO pode",
    (cargo) => {
      try {
        assertCanManageConfiguracaoGeral(u(cargo));
        expect.fail("deveria ter lançado");
      } catch (e) {
        expect(e).toBeInstanceOf(Response);
        expect((e as Response).status).toBe(403);
      }
    }
  );
});
