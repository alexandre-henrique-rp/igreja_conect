/**
 * Schemas Zod para Configuração de Acolhimento (S04-T01).
 *
 * - `ConfigAcolhimentoSchema`: define responsável por visitantes.
 *   `responsavelVisitanteTipo` é "MEMBRO" ou "MINISTERIO".
 *   `responsavelId` é o UUID do membro ou ministério responsável.
 * - `.strict()`: bloqueia campos não declarados (gate LGPD).
 *
 * @see app/lib/config.server.ts
 */
import { z } from "zod";

/**
 * Schema de configuração de acolhimento de visitantes (RN-MEM-05).
 *
 * @description Validação de input para configurar responsável por visitantes.
 *  - `responsavelVisitanteTipo`: "MEMBRO" (membro específico) ou "MINISTERIO"
 *    (todos os membros do ministério).
 *  - `responsavelId`: UUID do membro ou ministério.
 */
export const ConfigAcolhimentoSchema = z
  .object({
    responsavelVisitanteTipo: z.enum(["MEMBRO", "MINISTERIO"], {
      message: "Tipo deve ser MEMBRO ou MINISTERIO.",
    }),
    responsavelId: z.string().uuid("ID do responsável inválido."),
  })
  .strict();

/** Tipo inferido do ConfigAcolhimentoSchema (input após parse). */
export type ConfigAcolhimentoInput = z.infer<typeof ConfigAcolhimentoSchema>;

// Re-export do tipo do Zod schema para uso em tests
export type ConfigAcolhimentoSchemaType = typeof ConfigAcolhimentoSchema;
