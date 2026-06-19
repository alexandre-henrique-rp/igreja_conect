/**
 * RBAC — Matriz canônica Igreja Conect (S00-T05).
 *
 * Helpers `assertCan*` lançam `Response(403)` (NÃO retornam boolean) para
 * que o ErrorBoundary do React Router 7 capture e renderize 403 sem
 * precisar de try/catch no loader.
 *
 * Fonte da verdade: `.harness/RAG/security-rbac-matrix.md` §2.
 *
 * @see docs/REGRAS_DE_NEGOCIO.md (RN-MEM-01, RN-MEM-03)
 * @see docs/DESCRIÇÃO_DOS_MODULOS.md (matriz)
 */
import type { SessionUser } from "./session.server";

/** Cargos que podem ler dados financeiros (RN-MEM-03) — 3 perfis (dízimos vinculados a membro). */
export const DIZIMO_CARGOS = ["ADMIN", "PASTOR", "FINANCEIRO"] as const;

/** Cargos que podem ver o módulo financeiro completo — 4 perfis (inclui SECRETARIO). */
export const FINANCIAL_MODULE_CARGOS = ["ADMIN", "PASTOR", "FINANCEIRO", "SECRETARIO"] as const;

/** Cargos que podem criar lançamentos financeiros — 4 perfis. */
export const WRITE_LANCAMENTO_CARGOS = ["ADMIN", "PASTOR", "FINANCEIRO", "SECRETARIO"] as const;

/** Cargos administrativos (qualquer um com `cargo` não-null). */
export const ALL_ADMIN_CARGOS = [
  "ADMIN",
  "PASTOR",
  "SECRETARIO",
  "DISCIPULADOR",
  "FINANCEIRO",
  "LIDER_MINISTERIO",
] as const;

/** Tipo discriminado do enum Cargo (subset usado por RBAC). */
export type AdminCargo = (typeof ALL_ADMIN_CARGOS)[number];

/**
 * Lança Response(403) se o usuário não pode ver dados financeiros
 * (dízimos, lançamentos, saldos de caixa).
 *
 * @param {SessionUser} user - Usuário autenticado com `cargo`.
 * @throws {Response} 403 se cargo não está em DIZIMO_CARGOS.
 * @deprecated Use assertCanSeeFinancialModule ou assertCanSeeDizimos conforme escopo.
 */
export function assertCanSeeFinancials(user: SessionUser): void {
  if (!user.cargo || !(DIZIMO_CARGOS as readonly string[]).includes(user.cargo)) {
    throw new Response("Acesso restrito a perfis financeiros.", { status: 403 });
  }
}

/**
 * Lança Response(403) se o usuário não pode ver o módulo financeiro completo
 * (Dashboard, Caixas, Lançamentos, Transferências, Extrato).
 *
 * @description 4 perfis: ADMIN, PASTOR, FINANCEIRO, SECRETARIO (SEC-001/002).
 * @param {SessionUser} user - Usuário autenticado com `cargo`.
 * @throws {Response} 403 se cargo não está em FINANCIAL_MODULE_CARGOS.
 * @example
 *   assertCanSeeFinancialModule(user); // SECRETARIO OK
 */
export function assertCanSeeFinancialModule(user: SessionUser): void {
  if (!user.cargo || !(FINANCIAL_MODULE_CARGOS as readonly string[]).includes(user.cargo)) {
    throw new Response("Acesso restrito ao módulo financeiro.", { status: 403 });
  }
}

/**
 * Lança Response(403) se o usuário não pode ver dízimos vinculados a membro.
 * RN-MEM-03: SECRETARIO filtra DIZIMO na service layer (não vê nome do membro).
 *
 * @description 3 perfis: ADMIN, PASTOR, FINANCEIRO (RN-MEM-03).
 * @param {SessionUser} user - Usuário autenticado com `cargo`.
 * @throws {Response} 403 se cargo não está em DIZIMO_CARGOS.
 */
export function assertCanSeeDizimos(user: SessionUser): void {
  if (!user.cargo || !(DIZIMO_CARGOS as readonly string[]).includes(user.cargo)) {
    throw new Response("Acesso restrito a perfis financeiros para dízimos.", { status: 403 });
  }
}

/**
 * Lança Response(403) se o usuário não pode criar lançamentos financeiros.
 *
 * @description 4 perfis: ADMIN, PASTOR, FINANCEIRO, SECRETARIO (SEC-005).
 * @param {SessionUser} user - Usuário autenticado com `cargo`.
 * @throws {Response} 403 se cargo não está em WRITE_LANCAMENTO_CARGOS.
 */
export function assertCanWriteLancamento(user: SessionUser): void {
  if (!user.cargo || !(WRITE_LANCAMENTO_CARGOS as readonly string[]).includes(user.cargo)) {
    throw new Response("Acesso restrito a perfis financeiros para lançamentos.", { status: 403 });
  }
}

/**
 * Lança Response(403) se o usuário não tem cargo administrativo
 * (RN-MEM-01: qualquer perfil autenticado pode escrever membros).
 *
 * @param {SessionUser} user
 * @throws {Response} 403 se `cargo` é null.
 */
export function assertCanWriteMembers(user: SessionUser): void {
  if (!user.cargo) {
    throw new Response("Usuário sem permissão administrativa.", { status: 403 });
  }
}

/**
 * Lança Response(403) se o usuário não é ADMIN.
 *
 * @param {SessionUser} user
 * @throws {Response} 403 se cargo !== "ADMIN".
 */
export function assertIsAdmin(user: SessionUser): void {
  if (user.cargo !== "ADMIN") {
    throw new Response("Acesso restrito a ADMIN.", { status: 403 });
  }
}

/**
 * Lança Response(403) se o usuário não pode editar ConfiguracaoGeral
 * (RN-MEM-05: acolhimento de visitantes é responsabilidade do ADMIN).
 *
 * @param {SessionUser} user
 * @throws {Response} 403 se cargo !== "ADMIN".
 */
export function assertCanManageConfiguracaoGeral(user: SessionUser): void {
  if (user.cargo !== "ADMIN") {
    throw new Response("Apenas ADMIN gerencia configurações gerais.", { status: 403 });
  }
}

/** Cargos que podem gerenciar caixas (criar, arquivar, reabrir). */
export const MANAGE_CAIXA_CARGOS = ["ADMIN", "PASTOR", "FINANCEIRO"] as const;

/**
 * Lança Response(403) se o usuário não pode criar, arquivar ou reabrir caixas.
 *
 * @description Permissão para gerenciar caixas (S06-T03).
 * @param {SessionUser} user - Usuário autenticado.
 * @throws {Response} 403 se cargo não está em MANAGE_CAIXA_CARGOS.
 * @example
 *   assertCanManageCaixa(user);
 *   await criarCaixa(input); // só chega aqui se passou
 */
export function assertCanManageCaixa(user: SessionUser): void {
  if (!user.cargo || !(MANAGE_CAIXA_CARGOS as readonly string[]).includes(user.cargo)) {
    throw new Response("Você não tem permissão para criar ou arquivar caixas.", { status: 403 });
  }
}

/** Cargos que podem realizar transferências entre caixas (RN-FIN-02). */
export const TRANSFERENCIA_CARGOS = ["ADMIN", "PASTOR", "FINANCEIRO"] as const;

/**
 * Lança Response(403) se o usuário não pode realizar transferências entre caixas.
 *
 * @description 3 perfis: ADMIN, PASTOR, FINANCEIRO (RN-FIN-02). SECRETARIO é
 *   bloqueado mesmo podendo fazer lançamentos — é regra de produto.
 * @param {SessionUser} user - Usuário autenticado.
 * @throws {Response} 403 se cargo não está em TRANSFERENCIA_CARGOS.
 * @example
 *   assertCanTransferir(user);
 *   await transferirEntreCaixas(input, user); // só chega aqui se passou
 */
export function assertCanTransferir(user: SessionUser): void {
  if (!user.cargo || !(TRANSFERENCIA_CARGOS as readonly string[]).includes(user.cargo)) {
    throw new Response("Você não tem permissão para realizar transferências entre caixas.", { status: 403 });
  }
}
