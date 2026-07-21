/**
 * Testes dos helpers booleanos de RBAC (S06-T09 — Camada 1 UI).
 */
import { describe, it, expect } from "vitest";
import {
  canSeeFinancials,
  canManageCaixa,
  canViewDizimoMembro,
} from "./rbac-frontend";

describe("canSeeFinancials", () => {
  it("ADMIN pode ver módulo financeiro", () => {
    expect(canSeeFinancials({ cargo: "ADMIN" })).toBe(true);
  });

  it("PASTOR pode ver módulo financeiro", () => {
    expect(canSeeFinancials({ cargo: "PASTOR" })).toBe(true);
  });

  it("FINANCEIRO pode ver módulo financeiro", () => {
    expect(canSeeFinancials({ cargo: "FINANCEIRO" })).toBe(true);
  });

  it("SECRETARIO pode ver módulo financeiro (dashboard filtrado)", () => {
    expect(canSeeFinancials({ cargo: "SECRETARIO" })).toBe(true);
  });

  it("DISCIPULADOR NÃO pode ver módulo financeiro", () => {
    expect(canSeeFinancials({ cargo: "LIDER_MINISTERIO" })).toBe(false);
  });

  it("LIDER_MINISTERIO NÃO pode ver módulo financeiro", () => {
    expect(canSeeFinancials({ cargo: "LIDER_MINISTERIO" })).toBe(false);
  });

  it("cargo null retorna false", () => {
    expect(canSeeFinancials({ cargo: null })).toBe(false);
  });
});

describe("canManageCaixa", () => {
  it("ADMIN pode gerenciar caixas", () => {
    expect(canManageCaixa({ cargo: "ADMIN" })).toBe(true);
  });

  it("PASTOR pode gerenciar caixas", () => {
    expect(canManageCaixa({ cargo: "PASTOR" })).toBe(true);
  });

  it("FINANCEIRO pode gerenciar caixas", () => {
    expect(canManageCaixa({ cargo: "FINANCEIRO" })).toBe(true);
  });

  it("SECRETARIO NÃO pode gerenciar caixas (RN-FIN-01)", () => {
    expect(canManageCaixa({ cargo: "SECRETARIO" })).toBe(false);
  });

  it("DISCIPULADOR NÃO pode gerenciar caixas", () => {
    expect(canManageCaixa({ cargo: "LIDER_MINISTERIO" })).toBe(false);
  });

  it("LIDER_MINISTERIO NÃO pode gerenciar caixas", () => {
    expect(canManageCaixa({ cargo: "LIDER_MINISTERIO" })).toBe(false);
  });

  it("cargo null retorna false", () => {
    expect(canManageCaixa({ cargo: null })).toBe(false);
  });
});

describe("canViewDizimoMembro", () => {
  it("ADMIN vê dízimo com nome do membro", () => {
    expect(canViewDizimoMembro({ cargo: "ADMIN" })).toBe(true);
  });

  it("PASTOR vê dízimo com nome do membro", () => {
    expect(canViewDizimoMembro({ cargo: "PASTOR" })).toBe(true);
  });

  it("FINANCEIRO vê dízimo com nome do membro", () => {
    expect(canViewDizimoMembro({ cargo: "FINANCEIRO" })).toBe(true);
  });

  it("SECRETARIO NÃO vê dízimo com nome (RN-MEM-03)", () => {
    expect(canViewDizimoMembro({ cargo: "SECRETARIO" })).toBe(false);
  });

  it("DISCIPULADOR NÃO vê dízimo (fora do escopo)", () => {
    expect(canViewDizimoMembro({ cargo: "LIDER_MINISTERIO" })).toBe(false);
  });

  it("LIDER_MINISTERIO NÃO vê dízimo (fora do escopo)", () => {
    expect(canViewDizimoMembro({ cargo: "LIDER_MINISTERIO" })).toBe(false);
  });

  it("cargo null retorna false", () => {
    expect(canViewDizimoMembro({ cargo: null })).toBe(false);
  });
});
