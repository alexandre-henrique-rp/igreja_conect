/**
 * Schemas Zod para Discipulado (S03-T03).
 *
 * - `AssignDiscipleSchema`: payload de vincular um discípulo a um discipulador.
 *
 * @see docs/REGRAS_DE_NEGOCIO.md (RN-MEM-04)
 */
import { z } from "zod";

/**
 * Schema para vincular um membro como discípulo de outro.
 *
 * O ID do discípulo vem do path param (`:id` da rota), então só
 * precisamos validar o `discipuladorId` no body.
 */
export const AssignDiscipleSchema = z
  .object({
    discipuladorId: z
      .string()
      .uuid("Discipulador inválido. Verifique o UUID."),
  })
  .strict();

/** Tipo inferido do AssignDiscipleSchema. */
export type AssignDiscipleInput = z.infer<typeof AssignDiscipleSchema>;
