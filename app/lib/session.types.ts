/**
 * Tipos compartilhados do domínio de sessão (LGPD §2.4).
 *
 * **Por que este arquivo existe separado de `session.server.ts`:** o tipo
 * `SessionUser` é referenciado em arquivos de rota que exportam `createContext`
 * e outros helpers type-safe (ex.: `app/routes/app/_middleware.tsx`). Esses
 * exports vazam para o client bundle, e o React Router bloqueia a build
 * quando um arquivo `*.server.ts` é importado por código que vai pro cliente.
 *
 * Manter tipos puros (sem implementação, sem imports server-only) em
 * `*.types.ts` garante tree-shaking correto e type-safety compartilhada.
 *
 * @see https://reactrouter.com/explanation/code-splitting#removal-of-server-code
 */

/**
 * Subset de `Membro` que vai para a sessão — nunca inclui `senhaHash`,
 * `email`, `telefone` ou qualquer PII sensível (LGPD art. 6, III — necessidade).
 */
export type SessionUser = {
  id: string;
  nome: string;
  cargo: string | null;
};
