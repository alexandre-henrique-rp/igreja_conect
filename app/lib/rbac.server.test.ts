/**
 * Teste de app/lib/rbac.server.ts (S00-T05).
 *
 * Cobre as 6 células da matriz RBAC para cada helper canônico:
 * - assertCanSeeFinancials: ADMIN, PASTOR, FINANCEIRO passam; SECRETARIO, DISCIPULADOR, LIDER_MINISTERIO falham
 * - assertCanWriteMembers: todos os 6 passam; null falha
 * - assertIsAdmin: só ADMIN passa
 * - assertCanManageConfiguracaoGeral: só ADMIN
 *
 * SEC-001/002 (S06-REWORK):
 * - assertCanSeeFinancialModule: ADMIN, PASTOR, FINANCEIRO, SECRETARIO passam (4 perfis)
 * - assertCanSeeDizimos: ADMIN, PASTOR, FINANCEIRO passam (3 perfis — dízimos vinculados a membro)
 * - assertCanWriteLancamento: ADMIN, PASTOR, FINANCEIRO, SECRETARIO passam (4 perfis)
 */
import { describe, it, expect } from "vitest";
import {
  canSeeFinancials,
  assertCanSeeFinancials,
  assertCanSeeFinancialModule,
  assertCanSeeDizimos,
  assertCanWriteMembers,
  assertCanWriteLancamento,
  assertIsAdmin,
  assertCanManageConfiguracaoGeral,
  assertCanTransferir,
} from "./rbac.server";
import type { SessionUser } from "./session.server";

const u = (cargo: SessionUser["cargo"]): SessionUser => ({ id: "u1", nome: "U", cargo });

// ==================== assertCanSeeFinancials (legado, 3 perfis) ====================

describe("rbac.server — assertCanSeeFinancials (legado)", () => {
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

// ==================== SEC-001/002: assertCanSeeFinancialModule (4 perfis) ====================

describe("rbac.server — assertCanSeeFinancialModule (SEC-001/002)", () => {
  it.each(["ADMIN", "PASTOR", "FINANCEIRO", "SECRETARIO"] as const)(
    "%s pode ver módulo financeiro",
    (cargo) => {
      expect(() => assertCanSeeFinancialModule(u(cargo))).not.toThrow();
    }
  );

  it.each(["DISCIPULADOR", "LIDER_MINISTERIO", null] as const)(
    "%s NÃO pode ver módulo financeiro (lança Response 403)",
    (cargo) => {
      try {
        assertCanSeeFinancialModule(u(cargo));
        expect.fail("deveria ter lançado");
      } catch (e) {
        expect(e).toBeInstanceOf(Response);
        expect((e as Response).status).toBe(403);
      }
    }
  );
});

// ==================== SEC-001/002: assertCanSeeDizimos (3 perfis) ====================

describe("rbac.server — assertCanSeeDizimos (SEC-001/002)", () => {
  it.each(["ADMIN", "PASTOR", "FINANCEIRO"] as const)(
    "%s pode ver dízimos vinculados a membro (RN-MEM-03)",
    (cargo) => {
      expect(() => assertCanSeeDizimos(u(cargo))).not.toThrow();
    }
  );

  it.each(["SECRETARIO", "DISCIPULADOR", "LIDER_MINISTERIO", null] as const)(
    "%s NÃO pode ver dízimos (lança Response 403)",
    (cargo) => {
      try {
        assertCanSeeDizimos(u(cargo));
        expect.fail("deveria ter lançado");
      } catch (e) {
        expect(e).toBeInstanceOf(Response);
        expect((e as Response).status).toBe(403);
      }
    }
  );
});

// ==================== SEC-005: assertCanWriteLancamento (4 perfis) ====================

describe("rbac.server — assertCanWriteLancamento (SEC-005)", () => {
  it.each(["ADMIN", "PASTOR", "FINANCEIRO", "SECRETARIO"] as const)(
    "%s pode criar lançamentos",
    (cargo) => {
      expect(() => assertCanWriteLancamento(u(cargo))).not.toThrow();
    }
  );

  it.each(["DISCIPULADOR", "LIDER_MINISTERIO", null] as const)(
    "%s NÃO pode criar lançamentos (lança Response 403)",
    (cargo) => {
      try {
        assertCanWriteLancamento(u(cargo));
        expect.fail("deveria ter lançado");
      } catch (e) {
        expect(e).toBeInstanceOf(Response);
        expect((e as Response).status).toBe(403);
      }
    }
  );
});

// ==================== assertCanWriteMembers ====================

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

// ==================== assertIsAdmin ====================

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

// ==================== assertCanManageConfiguracaoGeral ====================

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

// ==================== S07-T07: assertCanTransferir ====================
// ==================== S08-T02: canSeeFinancials (boolean helper) ====================

describe("rbac.server — canSeeFinancials (S08-T02)", () => {
  it.each(["ADMIN", "PASTOR", "FINANCEIRO"] as const)(
    "%s pode ver dados financeiros → true",
    (cargo) => {
      expect(canSeeFinancials(u(cargo))).toBe(true);
    }
  );

  it.each(["SECRETARIO", "DISCIPULADOR", "LIDER_MINISTERIO", null] as const)(
    "%s NÃO pode ver dados financeiros → false",
    (cargo) => {
      expect(canSeeFinancials(u(cargo))).toBe(false);
    }
  );
});


describe("rbac.server — assertCanTransferir (S07-T07)", () => {
  it.each(["ADMIN", "PASTOR", "FINANCEIRO"] as const)(
    "%s pode realizar transferencias",
    (cargo) => {
      expect(() => assertCanTransferir(u(cargo))).not.toThrow();
    }
  );

  it.each(["SECRETARIO", "DISCIPULADOR", "LIDER_MINISTERIO", null] as const)(
    "%s NAO pode realizar transferencias (lança Response 403)",
    (cargo) => {
      try {
        assertCanTransferir(u(cargo));
        expect.fail("deveria ter lancado");
      } catch (e) {
        expect(e).toBeInstanceOf(Response);
        expect((e as Response).status).toBe(403);
      }
    }
  );
});
