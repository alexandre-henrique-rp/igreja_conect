/**
 * Componente <TabFidelidadeFinanceira /> — aba de fidelidade financeira (S08-T04).
 *
 * Recebe `fidelidadeFinanceira` via `useLoaderData()` do loader de
 * `membros.$id.tsx`. Se `data === null`, exibe fallback amigável (cadeado).
 * Se `data !== null`, exibe KPIs + tabela de dízimos.
 *
 * **GATE LGPD (RN-MEM-03) — defesa em 3 camadas:**
 * 1. **UI (camada 1):** fallback amigável para SECRETARIO/DISCIPULADOR/LIDER.
 *    O componente renderiza, mas `data === null` → card com cadeado.
 * 2. **Loader (camada 2):** `getFidelidadeFinanceira` retorna null para
 *    perfis não autorizados.
 * 3. **Service (camada 3):** `canSeeFinancials` filtra no nível service.
 *
 * @example
 *   // Na rota membros.$id.tsx (dentro da tab):
 *   <TabFidelidadeFinanceira />
 *
 * @returns Elemento JSX da aba de fidelidade.
 */
import { useLoaderData } from "react-router";
import { CardFidelidade } from "~/components/fidelidade/CardFidelidade";
import type { FidelidadeFinanceiraData } from "~/components/fidelidade/CardFidelidade";

type LoaderData = {
  fidelidadeFinanceira: FidelidadeFinanceiraData | null;
};

/**
 * @description Aba de fidelidade financeira — consome loaderData.
 * @returns {JSX.Element} CardFidelidade com dados do loader.
 */
export function TabFidelidadeFinanceira() {
  const loaderData = useLoaderData<LoaderData>();

  return (
    <div
      data-testid="tab-fidelidade"
      className="space-y-4"
    >
      <CardFidelidade data={loaderData.fidelidadeFinanceira} />
    </div>
  );
}
