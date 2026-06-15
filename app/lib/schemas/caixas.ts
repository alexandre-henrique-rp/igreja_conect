/**
 * Schemas Zod para o domínio de Caixas (S06-T02).
 *
 * **RN-FIN-01:** Caixa tem apenas nome (saldo é derivado de lançamentos).
 * NUNCA aceitar `saldoCentavos` no input (consistência financeira).
 *
 * @see docs/REGRAS_DE_NEGOCIO.md (RN-FIN-01)
 */
import { z } from "zod";

/**
 * Schema de criação de Caixa.
 *
 * - `nome`: 2-80 chars, alfanumérico + acentos + hífen + espaço.
 * - `.strict()`: bloqueia campos não declarados (gate LGPD).
 *
 * @description Valida payload de criação de caixa.
 */
export const CaixaCreateSchema = z
  .object({
    nome: z
      .string()
      .min(2, "Nome deve ter pelo menos 2 caracteres.")
      .max(80, "Nome deve ter no máximo 80 caracteres.")
      .regex(/^[\w\sÀ-ÿ-]+$/, "Nome inválido."),
  })
  .strict();

/** Tipo inferido do CaixaCreateSchema (OUTPUT). */
export type CaixaCreateInput = z.infer<typeof CaixaCreateSchema>;
