/**
 * Componente <TabFidelidadeFinanceira /> — placeholder do Fidelidade (S03-T07).
 *
 * **GATE LGPD (RN-MEM-03) — defesa em 3 camadas:**
 * 1. **UI (camada 1):** este componente SÓ é renderizado se
 *    `canSeeFinancials(user) === true` (loader aplica). Perfis não
 *    autorizados (SECRETARIO, DISCIPULADOR, LIDER_MINISTERIO) não
 *    veem esta tab no DOM.
 * 2. **Loader (camada 2):** se `tab=fidelidade` na URL mas o usuário
 *    não tem permissão, loader força `tab=dados` e nem monta este
 *    componente.
 * 3. **Service (camada 3):** `getDizimosByMembro` lança
 *    `ForbiddenError` (RN-MEM-03).
 *
 * **No MVP:** este é apenas um placeholder. Quando o módulo Financeiro
 * for implementado (Sprint 1+), este componente será estendido para
 * listar dízimos e ofertas do membro. **Até lá, NUNCA exibe dados
 * financeiros.**
 *
 * **Por que `role="status"` (não `role="alert"`):** é uma mensagem
 * informativa, não urgente. Screen reader anuncia após o elemento
 * aparecer, mas não interrompe.
 *
 * **Ícone de cadeado:** reforça visualmente que é área restrita.
 * `aria-hidden` (a mensagem no `<h3>` é o anúncio real).
 *
 * @example
 *   // No TabsMembro (S03-T07):
 *   {canSeeFinancials && <TabFidelidadeFinanceira membroId={membro.id} />}
 *
 * @param props - Props do componente.
 * @returns Elemento JSX do placeholder.
 */
import { InfoBox } from "~/components/InfoBox";

/**
 * Props aceitas pelo `<TabFidelidadeFinanceira>`.
 */
export type TabFidelidadeFinanceiraProps = {
  /** ID do membro (placeholder — sem uso no MVP). */
  membroId: string;
};

/**
 * @description Placeholder do Fidelidade Financeira (GATE LGPD RN-MEM-03, MVP).
 * @param {TabFidelidadeFinanceiraProps} props - membroId.
 * @returns {JSX.Element} Elemento JSX do placeholder.
 */
export function TabFidelidadeFinanceira({ membroId }: TabFidelidadeFinanceiraProps) {
  // `membroId` fica disponível para a implementação real (Sprint 1+).
  void membroId;
  return (
    <div
      role="status"
      data-testid="tab-fidelidade"
      className="space-y-3"
    >
      <InfoBox
        tone="info"
        title="Módulo Financeiro ainda não disponível"
      >
        Esta aba listará os dízimos e ofertas do membro quando o módulo
        Financeiro for implementado (sprint 1+). Por enquanto, apenas
        perfis autorizados (ADMIN, PASTOR, FINANCEIRO) têm acesso a esta
        seção como preparação para o módulo.
      </InfoBox>
    </div>
  );
}
