/**
 * @deprecated Importar de `~/components/ds` (re-export para compatibilidade).
 *
 * **Migração:** troque `import { Button } from "~/components/Button"` por
 * `import { Button } from "~/components/ds"`.
 *
 * Mantido como re-export fino para não quebrar imports existentes durante
 * a migração. Será removido em uma próxima sprint.
 */
export { Button } from "./ds/Button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./ds/Button";
