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

/** Cargos que podem ler dados financeiros (RN-MEM-03). */
export const FINANCIAL_CARGOS = ["ADMIN", "PASTOR", "FINANCEIRO"] as const;

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
 * @throws {Response} 403 se cargo não está em FINANCIAL_CARGOS.
 * @example
 *   try {
 *     assertCanSeeFinancials(user);
 *     dizimos = await getDizimosByMembro(membroId);
 *   } catch (e) {
 *     if (e instanceof Response) return { membro }; // não renderiza aba
 *   }
 */
export function assertCanSeeFinancials(user: SessionUser): void {
  if (!user.cargo || !(FINANCIAL_CARGOS as readonly string[]).includes(user.cargo)) {
    throw new Response("Acesso restrito a perfis financeiros.", { status: 403 });
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
