/**
 * Schemas Zod para Central de Alertas (S04-T01).
 *
 * - `MarcarLidoSchema`: marca um alerta como lido.
 * - `MarcarResolvidoSchema`: marca um alerta como resolvido.
 * - `.strict()`: bloqueia campos não declarados.
 *
 * @see app/lib/alerts.server.ts
 */
import { z } from "zod";

/**
 * Schema para marcar um alerta como lido.
 *
 * @description Valida o `alertaId` como UUID obrigatório.
 */
export const MarcarLidoSchema = z
  .object({
    alertaId: z.string().uuid("ID do alerta inválido."),
  })
  .strict();

/** Tipo inferido do MarcarLidoSchema. */
export type MarcarLidoInput = z.infer<typeof MarcarLidoSchema>;

/**
 * Schema para marcar um alerta como resolvido.
 *
 * @description Valida o `alertaId` como UUID obrigatório.
 */
export const MarcarResolvidoSchema = z
  .object({
    alertaId: z.string().uuid("ID do alerta inválido."),
  })
  .strict();

/** Tipo inferido do MarcarResolvidoSchema. */
export type MarcarResolvidoInput = z.infer<typeof MarcarResolvidoSchema>;
