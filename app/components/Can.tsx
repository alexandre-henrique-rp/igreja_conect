/**
 * Componente <Can /> — helper client-side de RBAC (S03-T07).
 *
 * **Camada 1 RBAC (UI):** esconde elementos do DOM quando o usuário
 * não tem permissão. O backend revalida (camada 3) — defense in depth.
 *
 * **Por que `cargo` (string) e não `SessionUser` completo:** queremos
 * que o componente seja **stateless** e fácil de usar em qualquer
 * lugar. Aceita um subset de `SessionUser` (apenas `cargo`).
 *
 * **Por que `allow` e não `can()`:** mais explícito, menos abstração
 * prematura. `canSeeFinancials(user)` ficaria encapsulado, mas o
 * time precisa ver quais cargos estão permitidos.
 *
 * **Acessibilidade:** o componente não interfere — só renderiza ou
 * não. Quem chama é responsável por labels/aria apropriados.
 *
 * @example
 *   <Can user={user} allow={["ADMIN", "PASTOR"]}>
 *     <Button variant="danger">Excluir membro</Button>
 *   </Can>
 *
 * @example
 *   // Com fallback explícito
 *   <Can user={user} allow={["ADMIN"]} fallback={<span>—</span>}>
 *     <span>Conteúdo sensível</span>
 *   </Can>
 *
 * @param props - Props do componente.
 * @returns Children se autorizado, ou fallback (default `null`).
 */
import type { ReactNode } from "react";

/**
 * Subset de `SessionUser` aceito pelo `<Can>` — só `cargo`.
 */
export type CanUser = { cargo: string | null };

/**
 * Props aceitas pelo `<Can>`.
 */
export type CanProps = {
  /** Usuário (subset de `SessionUser` — só `cargo` é necessário). */
  user: CanUser;
  /** Lista de cargos permitidos. */
  allow: string[];
  /** Conteúdo a renderizar se autorizado. */
  children: ReactNode;
  /** Conteúdo alternativo (default `null`). */
  fallback?: ReactNode;
};

/**
 * @description Helper de RBAC client-side — renderiza children se `user.cargo` ∈ `allow`.
 * @param {CanProps} props - user, allow, children, fallback.
 * @returns {ReactNode} `children` se autorizado, senão `fallback` (default null).
 */
export function Can({ user, allow, children, fallback = null }: CanProps) {
  const authorized = user.cargo != null && allow.includes(user.cargo);
  return <>{authorized ? children : fallback}</>;
}
