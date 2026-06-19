/**
 * Service de Transferencias entre Caixas — Igreja Conect (S07-T02, rework S07).
 *
 * **Arquitetura de helpers (refactor S07-REWORK):**
 * - `validarTransferencia(input, user)` — RBAC + Zod + buscar caixas (约30L)
 * - `executarTransferenciaAtomica(tx, input, user, transferenciaId, idempotencyKey)` — 6 mutacoes na $transaction (约40L)
 * - `transferirEntreCaixas(input, user)` — orquestrador (~20L)
 *
 * **RN-FIN-02:** Transferencia atomica entre dois caixas. Tres mutacoes
 * (TransferenciaCaixa + Lancamento SAIDA + Lancamento ENTRADA) em uma unica
 * $transaction Prisma. Se qualquer parte falhar, ROLLBACK total.
 *
 * **Idempotency (SEC-S07-003):**
 *   - Cliente pode enviar `idempotencyKey` (UUID v4). Se ja existe no DB,
 *     retorna resultado cacheado sem criar duplicatas.
 *
 * **Camada 3 RBAC:**
 *   - `assertCanTransferir(user)` — ADMIN, PASTOR, FINANCEIRO.
 *
 * @see docs/REGRAS_DE_NEGOCIO.md (RN-FIN-02)
 */
import { randomUUID } from "node:crypto";
import { prisma } from "~/db/prisma.server";
import { TransferenciaCreateSchema } from "./schemas/transferencias";
import type { TransferenciaCreate } from "./schemas/transferencias";
import { assertSaldoSuficiente } from "./finance.server";
import { assertCanTransferir } from "./rbac.server";
import { safeLog } from "./audit.server";
import type { SessionUser } from "./session.types";

/** Retorno de transferirEntreCaixas. */
export type TransferenciaResult = {
  grupoId: string;
  transferenciaId: string;
  saida: { id: string; tipo: "SAIDA"; categoria: "TRANSFERENCIA"; valorCentavos: number; caixaId: string; transferenciaGrupoId: string; dataCompetencia: Date; descricao: string | null };
  entrada: { id: string; tipo: "ENTRADA"; categoria: "TRANSFERENCIA"; valorCentavos: number; caixaId: string; transferenciaGrupoId: string; dataCompetencia: Date; descricao: string | null };
};

// ===================== HELPERS =====================

/**
 * Helper 1/3 — Valida input e busca caixas (executa FORA da $transaction).
 * Responsabilidades: RBAC + Zod + buscar caixas + verificar ativo.
 */
async function validarTransferencia(input: TransferenciaCreate, user: SessionUser) {
  assertCanTransferir(user);
  const parsed = TransferenciaCreateSchema.safeParse(input);
  if (!parsed.success) throw new Response(JSON.stringify(parsed.error.issues), { status: 400 });
  const [caixaOrigem, caixaDestino] = await Promise.all([
    prisma.caixa.findUnique({ where: { id: parsed.data.origemId }, select: { id: true, nome: true, ativo: true, saldoCentavos: true } }),
    prisma.caixa.findUnique({ where: { id: parsed.data.destinoId }, select: { id: true, nome: true, ativo: true, saldoCentavos: true } }),
  ]);
  if (!caixaOrigem) throw new Response("Caixa de origem nao encontrado.", { status: 404 });
  if (!caixaDestino) throw new Response("Caixa de destino nao encontrado.", { status: 404 });
  if (!caixaOrigem.ativo) throw new Response(`Caixa de origem "${caixaOrigem.nome}" esta arquivado.`, { status: 409 });
  if (!caixaDestino.ativo) throw new Response(`Caixa de destino "${caixaDestino.nome}" esta arquivado.`, { status: 409 });
  return { parsed: parsed.data };
}

/**
 * Helper 2/3 — Executa as 6 mutacoes dentro da $transaction.
 * Ordens: TransferenciaCaixa → lock → saldo → SAIDA → ENTRADA → atualizar saldos.
 * Idempotency: se key ja existe, retorna resultado cacheado.
 */
async function executarTransferenciaAtomica(
  tx: Parameters<Exclude<Parameters<typeof prisma.$transaction>[0], undefined>>,
  input: { origemId: string; destinoId: string; valorCentavos: number; descricao?: string; data: Date },
  user: SessionUser,
  transferenciaId: string,
  idempotencyKey?: string
) {
  // Idempotency check
  if (idempotencyKey) {
    const existente = await tx.transferenciaCaixa.findUnique({ where: { idempotencyKey } });
    if (existente) {
      const lancamentos = await tx.lancamento.findMany({ where: { transferenciaGrupoId: existente.id } });
      const s = lancamentos.find(l => l.tipo === "SAIDA")!;
      const e = lancamentos.find(l => l.tipo === "ENTRADA")!;
      return {
        transferenciaId: existente.id,
        saida: { id: s.id, tipo: "SAIDA" as const, categoria: "TRANSFERENCIA" as const, valorCentavos: s.valorCentavos, caixaId: s.caixaId, transferenciaGrupoId: s.transferenciaGrupoId!, dataCompetencia: s.dataCompetencia, descricao: s.descricao },
        entrada: { id: e.id, tipo: "ENTRADA" as const, categoria: "TRANSFERENCIA" as const, valorCentavos: e.valorCentavos, caixaId: e.caixaId, transferenciaGrupoId: e.transferenciaGrupoId!, dataCompetencia: e.dataCompetencia, descricao: e.descricao }
      };
    }
  }
  // 1) TransferenciaCaixa (RN-FIN-02 — carimbo operador)
  const transferencia = await tx.transferenciaCaixa.create({ data: { id: transferenciaId, caixaOrigemId: input.origemId, caixaDestinoId: input.destinoId, valorCentavos: input.valorCentavos, executadoPorId: user.id, descricao: input.descricao ?? null, dataHora: input.data, idempotencyKey: idempotencyKey ?? null } });
  // 2) Lock + re-leitura
  const [origem, destino] = await Promise.all([tx.caixa.findUniqueOrThrow({ where: { id: input.origemId }, select: { id: true, ativo: true, saldoCentavos: true, nome: true } }), tx.caixa.findUniqueOrThrow({ where: { id: input.destinoId }, select: { id: true, ativo: true, saldoCentavos: true, nome: true } })]);
  if (!origem.ativo) throw new Response(`Caixa de origem "${origem.nome}" esta arquivado.`, { status: 409 });
  if (!destino.ativo) throw new Response(`Caixa de destino "${destino.nome}" esta arquivado.`, { status: 409 });
  // 3) Saldo (SEC-S07-004: helper canonico)
  await assertSaldoSuficiente(origem.id, input.valorCentavos, "Transferencia entre caixas");
  // 4) + 5) Lancamentos
  const saidaLanc = await tx.lancamento.create({ data: { tipo: "SAIDA", categoria: "TRANSFERENCIA", valorCentavos: input.valorCentavos, caixaId: origem.id, transferenciaGrupoId: transferencia.id, dataCompetencia: input.data, descricao: input.descricao ?? `Transferencia para ${destino.nome}` } });
  const entradaLanc = await tx.lancamento.create({ data: { tipo: "ENTRADA", categoria: "TRANSFERENCIA", valorCentavos: input.valorCentavos, caixaId: destino.id, transferenciaGrupoId: transferencia.id, dataCompetencia: input.data, descricao: input.descricao ?? `Transferencia de ${origem.nome}` } });
  // 6) Atualizar saldos
  await Promise.all([tx.caixa.update({ where: { id: origem.id }, data: { saldoCentavos: { decrement: input.valorCentavos } } }), tx.caixa.update({ where: { id: destino.id }, data: { saldoCentavos: { increment: input.valorCentavos } } })]);
  return { transferenciaId: transferencia.id, saida: { id: saidaLanc.id, tipo: saidaLanc.tipo as "SAIDA", categoria: saidaLanc.categoria as "TRANSFERENCIA", valorCentavos: saidaLanc.valorCentavos, caixaId: saidaLanc.caixaId, transferenciaGrupoId: saidaLanc.transferenciaGrupoId!, dataCompetencia: saidaLanc.dataCompetencia, descricao: saidaLanc.descricao }, entrada: { id: entradaLanc.id, tipo: entradaLanc.tipo as "ENTRADA", categoria: entradaLanc.categoria as "TRANSFERENCIA", valorCentavos: entradaLanc.valorCentavos, caixaId: entradaLanc.caixaId, transferenciaGrupoId: entradaLanc.transferenciaGrupoId!, dataCompetencia: entradaLanc.dataCompetencia, descricao: entradaLanc.descricao } };
}

// ===================== MAIN EXPORT =====================

/**
 * Realiza transferencia atomica entre dois caixas (orquestrador ~20L).
 * @throws {Response} 400/403/404/409 conforme validacao.
 */
export async function transferirEntreCaixas(input: TransferenciaCreate, user: SessionUser): Promise<TransferenciaResult> {
  const { parsed } = await validarTransferencia(input, user);
  const transferenciaId = randomUUID();
  const resultado = await prisma.$transaction(async (tx) => executarTransferenciaAtomica(tx, { origemId: parsed.origemId, destinoId: parsed.destinoId, valorCentavos: parsed.valorCentavos, descricao: parsed.descricao, data: parsed.data }, user, transferenciaId, parsed.idempotencyKey));
  // SEC-S07-003: grupoId deve ser estável em double-submit (idempotency). Se a transferencia
  // retornada é a cacheada (mesmo id que o existente), usa ela; senão, usa o novo gerado.
  const grupoId = parsed.idempotencyKey ? resultado.transferenciaId : transferenciaId;
  safeLog({ action: "transferencia", resource: `transferencia:${grupoId}`, userId: user.id, result: "ok" });
  return { grupoId, transferenciaId: resultado.transferenciaId, saida: resultado.saida, entrada: resultado.entrada };
}
