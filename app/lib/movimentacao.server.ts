/**
 * Service de Movimentação de Estoque — Igreja Conect (S11).
 *
 * **RN-EST-02:** Movimentação de saída (quantidade < 0) exige nomeRetirante.
 * **RN-EST-01:** Itens PATRIMONIO não são movimentados por estoque.
 *
 * **Camada 3 (defense in depth):** `assertCanMovimentarConsumo` barra com
 * Response(403) ANTES de qualquer query no banco.
 *
 * @see docs/REGRAS_DE_NEGOCIO.md (RN-EST-01, RN-EST-02)
 * @see .harness/RAG/security-rbac-matrix.md §4 (camada 3 exemplo)
 */
import { prisma } from "~/db/prisma.server";
import { ZodError } from "zod";
import { assertCanMovimentarConsumo } from "./rbac.server";
import { assertSaldoQuantidade } from "./itemEstoque.server";
import {
  MovimentacaoCreateSchema,
  type MovimentacaoCreateInput,
} from "./schemas/estoque";
import { safeLog } from "./audit.server";
import type { SessionUser } from "./session.server";

/**
 * Cria uma movimentação de entrada ou saída no estoque de um item.
 *
 * **Camada 3 RBAC:** `assertCanMovimentarConsumo(user)` PRIMEIRO.
 *
 * **Proteção anti-TOCTOU:** faz um pre-check com `assertSaldoQuantidade`
 * (fora da transação) e re-valida saldo/tipo/ativo dentro da `$transaction`
 * antes de mutar.
 *
 * **Convenção de sinais:**
 * - `quantidade > 0` → entrada (adiciona ao estoque)
 * - `quantidade < 0` → saída (remove do estoque)
 *
 * @param {MovimentacaoCreateInput & { itemId: string }} input - Dados da
 *   movimentação mais o ID do item de estoque.
 * @param {SessionUser} user - Usuário autenticado (ADMIN/PASTOR/SECRETARIO).
 * @returns {Promise<any>} A movimentação recém-criada.
 * @throws {Response} 400 se quantidade === 0 ou item é PATRIMONIO.
 * @throws {Response} 403 se cargo não tem permissão.
 * @throws {Response} 404 se item não encontrado.
 * @throws {Response} 409 se saldo insuficiente ou item arquivado.
 * @throws {Response} 422 se `input` não passa na validação Zod.
 * @example
 *   const mov = await criarMovimentacao(
 *     { itemId: "uuid", quantidade: -3, nomeRetirante: "João" },
 *     user,
 *   );
 *   // → { id: "...", quantidade: -3, nomeRetirante: "João", ... }
 */
export async function criarMovimentacao(
  input: MovimentacaoCreateInput & { itemId: string },
  user: SessionUser
): Promise<any> {
  assertCanMovimentarConsumo(user);

  let parsed: MovimentacaoCreateInput;
  try {
    parsed = MovimentacaoCreateSchema.parse(input);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new Response(err.message, { status: 422 });
    }
    throw err;
  }

  await assertSaldoQuantidade(input.itemId, parsed.quantidade, "Movimentação");

  const movimentacao = await prisma.$transaction(async (tx) => {
    const item = await tx.itemEstoque.findUnique({
      where: { id: input.itemId },
      select: { id: true, quantidade: true, ativo: true, tipo: true },
    });

    if (!item) {
      throw new Response("Item não encontrado.", { status: 404 });
    }

    if (item.ativo === false) {
      throw new Response("Item arquivado não aceita movimentações.", {
        status: 409,
      });
    }

    if (item.tipo === "PATRIMONIO") {
      throw new Response(
        "Patrimônio não é movimentado por estoque. Use manutenção.",
        { status: 400 }
      );
    }

    if (item.quantidade + parsed.quantidade < 0) {
      throw new Response(
        `Saldo insuficiente. Disponível: ${item.quantidade} un. Saída solicitada: ${Math.abs(parsed.quantidade)} un.`,
        { status: 409 }
      );
    }

    const mov = await tx.movimentacaoEstoque.create({
      data: {
        itemEstoqueId: input.itemId,
        quantidade: parsed.quantidade,
        nomeRetirante: parsed.nomeRetirante ?? "",
        justificativa: parsed.justificativa ?? null,
        autorizadoPorId: user.id,
      },
    });

    await tx.itemEstoque.update({
      where: { id: input.itemId },
      data: { quantidade: { increment: parsed.quantidade } },
    });

    return mov;
  });

  safeLog({
    action: "movimentar_estoque",
    resource: `item_estoque:${input.itemId}+movimentacao:${movimentacao.id}`,
    userId: user.id,
    result: "ok",
  });

  return movimentacao;
}
