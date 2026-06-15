/**
 * Componente <AcoesMembro /> — botões de ação do detalhe (S03-T07).
 *
 * Agrupa os botões de ação do header da página de detalhe:
 * - **Editar** (sempre): link para `/app/membros/:id/editar`.
 * - **Excluir** (só ADMIN/PASTOR): form method=post com `intent=delete`.
 *
 * **RN-MEM-04:** o botão Excluir é bloqueado pelo backend se há
 * discípulos vinculados (BusinessRuleError → 409). O form atual
 * apenas submete — a action mostra a mensagem.
 *
 * **RBAC (camada 1 UI):** `canDelete=false` esconde o botão. O
 * backend revalida (camada 3).
 *
 * **Por que `<Can>` não é usado aqui:** o componente é específico
 * para o header de detalhe — não vale o overhead do helper.
 * Componente mais "fechado" intencionalmente.
 *
 * @example
 *   <AcoesMembro membro={membro} canDelete={canDelete} />
 *
 * @param props - Props do componente.
 * @returns Elemento JSX com os botões de ação.
 */
import { Form, Link } from "react-router";
import { Button } from "~/components/Button";

/**
 * Subset de Membro.
 */
export type AcoesMembroProps = {
  membro: { id: string; nome: string };
  /** Se `true`, renderiza botão Excluir (ADMIN/PASTOR). */
  canDelete: boolean;
};

/**
 * @description Botões Editar (sempre) + Excluir (se canDelete) para o detalhe do membro.
 * @param {AcoesMembroProps} props - membro, canDelete.
 * @returns {JSX.Element} Elemento JSX das ações.
 */
export function AcoesMembro({ membro, canDelete }: AcoesMembroProps) {
  return (
    <div
      className="flex flex-col sm:flex-row gap-2"
      data-testid="acoes-membro"
    >
      <Button
        as={Link}
        to={`/app/membros/${membro.id}/editar`}
        variant="primary"
      >
        Editar
      </Button>
      {canDelete && (
        <Form method="post" className="inline">
          <input type="hidden" name="intent" value="delete" />
          <Button
            type="submit"
            variant="danger"
            aria-label={`Excluir ${membro.nome}`}
          >
            Excluir
          </Button>
        </Form>
      )}
    </div>
  );
}
