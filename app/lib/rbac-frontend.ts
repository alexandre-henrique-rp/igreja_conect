/**
 * Helpers booleanos de RBAC para a Camada 1 (UI) (S06-T09).
 *
 * **Por que este arquivo é separado de `rbac.server.ts`:**
 * `rbac.server.ts` lança `Response(403)` para uso em loaders/actions
 * (Camada 2/3). A UI precisa de helpers **booleanos** para
 * `<Can allow={...}>` e para condicionais JSX. Não podemos importar
 * `rbac.server.ts` em componentes porque o sufixo `.server` impede
 * tree-shaking correto no client bundle (RR7 bloqueia import de
 * `.server.ts` em código que vai pro cliente).
 *
 * **Camada 1 — UI condicional:** use estes helpers para decidir
 * se renderiza ou não um controle. NÃO é segurança (comentário
 * `// SECURITY: este <Can> é UX, não segurança` é obrigatório).
 *
 * @see .harness/RAG/pattern-3-layer-rbac.md §2.1
 * @see .harness/RAG/security-rbac-matrix.md
 */

/** Perfis com `canSeeFinancials` (RN-MEM-03). Mesmo do RAG §2. */
const FINANCIAL_CARGOS = ["ADMIN", "PASTOR", "FINANCEIRO", "SECRETARIO"] as const;

/** Perfis com `canManageCaixa` (brief §4.8 — gestão de estrutura). */
const CAIXA_MANAGER_CARGOS = ["ADMIN", "PASTOR", "FINANCEIRO"] as const;

/**
 * @description Retorna `true` se o usuário pode ver o módulo financeiro
 *   (Dashboard, Caixas, Lançamentos, Transferências).
 * @param {object} user - Usuário com `cargo`.
 * @param {string | null} user.cargo - Cargo do membro.
 * @returns {boolean} `true` se cargo está em FINANCIAL_CARGOS.
 * @example
 *   if (canSeeFinancials(user)) { ... }
 */
export function canSeeFinancials(user: { cargo: string | null }): boolean {
  if (!user.cargo) return false;
  return (FINANCIAL_CARGOS as readonly string[]).includes(user.cargo);
}

/**
 * @description Retorna `true` se o usuário pode gerenciar estrutura
 *   de caixas (criar, arquivar, reabrir). SECRETARIO **não** está
 *   incluído — opera dentro dos caixas existentes, não estrutura.
 * @param {object} user - Usuário com `cargo`.
 * @param {string | null} user.cargo - Cargo do membro.
 * @returns {boolean} `true` se cargo está em CAIXA_MANAGER_CARGOS.
 * @example
 *   if (canManageCaixa(user)) { ... }
 */
export function canManageCaixa(user: { cargo: string | null }): boolean {
  if (!user.cargo) return false;
  return (CAIXA_MANAGER_CARGOS as readonly string[]).includes(user.cargo);
}

/**
 * @description Retorna `true` se o usuário pode ver o nome do membro
 *   em dízimos (RN-MEM-03). Requer `canSeeFinancials` E não ser
 *   SECRETARIO (que filtra dízimos vinculados).
 * @param {object} user - Usuário com `cargo`.
 * @param {string | null} user.cargo - Cargo do membro.
 * @returns {boolean} `true` apenas para ADMIN, PASTOR, FINANCEIRO.
 */
export function canViewDizimoMembro(user: { cargo: string | null }): boolean {
  if (!canSeeFinancials(user)) return false;
  return user.cargo !== "SECRETARIO";
}
