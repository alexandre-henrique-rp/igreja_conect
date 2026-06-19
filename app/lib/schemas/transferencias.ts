/**
 * Schemas Zod para o dominio de Transferencias entre Caixas (S07-T01, rework S07).
 *
 * **RN-FIN-02:** Transferencia atomica entre dois caixas — dois lancamentos
 * (SAIDA na origem + ENTRADA no destino) compartilhando `transferenciaGrupoId`.
 *
 * **Idempotency (SEC-S07-003):**
 * - `idempotencyKey`: UUID v4 opcional. Se fornecido, previne double-submit.
 *   O service verifica se ja existe `TransferenciaCaixa` com essa key e retorna
 *   resultado cacheado em vez de criar duplicatas.
 *
 * **Validacoes:**
 * - `origemId !== destinoId` (superRefine)
 * - `valorCentavos` positivo e inteiro
 * - `descricao` opcional, maximo 200 caracteres
 * - `data` opcional com default agora
 * - `idempotencyKey` opcional, UUID v4 se fornecido
 * - `.strict()` bloqueia campos nao documentados
 *
 * @see docs/REGRAS_DE_NEGOCIO.md (RN-FIN-02)
 */
import { z } from "zod";

/**
 * Schema de criacao de Transferencia entre Caixas.
 *
 * - `origemId`: UUID do caixa de origem (debito).
 * - `destinoId`: UUID do caixa de destino (credito).
 * - `valorCentavos`: valor inteiro > 0 (em centavos).
 * - `descricao`: opcional, 0-200 caracteres.
 * - `data`: data da competencia, default agora.
 * - `idempotencyKey`: UUID v4 opcional (SEC-S07-003 — previne double-submit).
 * - `.strict()`: bloqueia campos extras (gate LGPD).
 *
 * @description Valida payload de criacao de transferencia.
 */
export const TransferenciaCreateSchema = z
  .object({
    origemId: z.string().uuid("origemId deve ser UUID valido."),
    destinoId: z.string().uuid("destinoId deve ser UUID valido."),
    valorCentavos: z.number().int("valorCentavos deve ser inteiro.").positive("valorCentavos deve ser positivo."),
    descricao: z.string().min(0).max(200, "Descricao deve ter no maximo 200 caracteres.").optional(),
    data: z.coerce.date().default(() => new Date()),
    /** UUID v4 — evita double-submit/race (SEC-S07-003). */
    idempotencyKey: z.string().uuid("idempotencyKey deve ser UUID v4.").optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.origemId === data.destinoId) {
      ctx.addIssue({
        code: "custom",
        path: ["origemId"],
        message: "Origem e destino nao podem ser o mesmo caixa.",
      });
    }
  });

/** Tipo inferido do TransferenciaCreateSchema (OUTPUT). */
export type TransferenciaCreate = z.infer<typeof TransferenciaCreateSchema>;
