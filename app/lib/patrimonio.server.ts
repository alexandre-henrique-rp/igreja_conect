/**
 * Helpers de validação para o domínio de Patrimônio (S11-T04).
 *
 * **assertItemIsPatrimonio:** Garante que o item é do tipo PATRIMONIO.
 * **assertTransicaoPatrimonioValida:** Valida transições de status
 *   conforme a máquina de estados do patrimônio (RN-EST-03/04/05).
 *
 * Matriz de transições (StatusItemPatrimonio):
 * - `DISPONIVEL` ↔ `EM_MANUTENCAO`
 * - `EM_MANUTENCAO` → `BAIXADO_PERDA`
 * - `DISPONIVEL` → `BAIXADO_PERDA`
 * - `BAIXADO_PERDA` é terminal — nenhuma transição de saída.
 *
 * @see docs/REGRAS_DE_NEGOCIO.md (RN-EST-03, RN-EST-04, RN-EST-05)
 */

/**
 * Lança Response(400) se o item não é do tipo PATRIMONIO.
 *
 * @param {{ tipo: string }} item - Objeto com campo `tipo`.
 * @throws {Response} 400 se `tipo !== 'PATRIMONIO'`.
 * @example
 *   assertItemIsPatrimonio({ tipo: "CONSUMO" }); // throws 400
 */
export function assertItemIsPatrimonio(item: { tipo: string }): void {
  if (item.tipo !== "PATRIMONIO") {
    throw new Response(
      "Apenas itens de patrimônio podem ir para manutenção externa.",
      { status: 400 }
    );
  }
}

/**
 * Lança Response(409) se a transição de status patrimônio é inválida.
 *
 * Matriz de transições permitidas:
 * - `DISPONIVEL → EM_MANUTENCAO`: OK
 * - `EM_MANUTENCAO → DISPONIVEL`: OK
 * - `EM_MANUTENCAO → BAIXADO_PERDA`: OK
 * - `DISPONIVEL → BAIXADO_PERDA`: OK
 * - `BAIXADO_PERDA → *`: 409 (item baixado, não pode voltar ao estoque)
 * - Demais combinações: 409 (transição inválida)
 *
 * @param {string} origem - Status atual do item (ex: "DISPONIVEL").
 * @param {string} destino - Status desejado (ex: "EM_MANUTENCAO").
 * @param {string} _context - Contexto de chamada para rastreio em logs (não usado na mensagem de erro).
 * @throws {Response} 409 se transição não está na matriz.
 * @example
 *   assertTransicaoPatrimonioValida("DISPONIVEL", "EM_MANUTENCAO", "enviarParaManutencao");
 *   // → void
 */
export function assertTransicaoPatrimonioValida(
  origem: string,
  destino: string,
  _context: string
): void {
  if (origem === "BAIXADO_PERDA") {
    throw new Response(
      "Item baixado. Não pode voltar ao estoque.",
      { status: 409 }
    );
  }

  const permitidas: Record<string, string[]> = {
    DISPONIVEL: ["EM_MANUTENCAO", "BAIXADO_PERDA"],
    EM_MANUTENCAO: ["DISPONIVEL", "BAIXADO_PERDA"],
  };

  const allowed = permitidas[origem];
  if (!allowed || !allowed.includes(destino)) {
    throw new Response(
      `Transição inválida: ${origem} → ${destino}`,
      { status: 409 }
    );
  }
}
