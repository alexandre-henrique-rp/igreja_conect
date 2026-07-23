/**
 * Schemas Zod para Ministérios (S03-T03).
 *
 * - `MinisterioCreateSchema`: criar ministério.
 * - `MinisterioUpdateSchema`: atualizar (parcial).
 * - `VincularMembroSchema`: vincular membro a um ministério.
 *
 * @see prisma/schema.prisma (model Ministerio, MinisterioMembro)
 */
import { z } from "zod";

/**
 * Schema de criação de Ministério.
 *
 * - `nome`: obrigatório, 2-80 chars.
 * - `descricao`: opcional, max 500 chars.
 * - `.strict()`: bloqueia campos não declarados.
 */
export const MinisterioCreateSchema = z
  .object({
    nome: z
      .string()
      .min(2, "Nome deve ter pelo menos 2 caracteres.")
      .max(80, "Nome deve ter no máximo 80 caracteres."),
    descricao: z
      .string()
      .max(500, "Descrição deve ter no máximo 500 caracteres.")
      .optional(),
    status: z.enum(["ATIVO", "INATIVO", "SUSPENSO"]).optional(),
    corDestaque: z.string().max(20).optional(),
    liderNome: z.string().max(120).optional(),
    capacidadeMaxima: z.number().int().positive().optional(),
    diasEncontro: z.string().max(50).optional(),
    horarioPadrao: z.string().max(10).optional(),
    turnoPrincipal: z.enum(["MANHA", "TARDE", "NOITE"]).optional(),
  })
  .strict();

/** Tipo inferido do MinisterioCreateSchema. */
export type MinisterioCreateInput = z.infer<typeof MinisterioCreateSchema>;

/**
 * Schema de atualização de Ministério.
 * - Todos os campos opcionais.
 * - NUNCA inclui `membros` direto (a relação é gerenciada por VincularMembroSchema).
 */
export const MinisterioUpdateSchema = MinisterioCreateSchema.partial();

/** Tipo inferido do MinisterioUpdateSchema. */
export type MinisterioUpdateInput = z.infer<typeof MinisterioUpdateSchema>;

/**
 * Schema de vinculação de Membro a Ministério.
 * - O `ministerioId` vem do path param, então só validamos `membroId` no body.
 */
export const VincularMembroSchema = z
  .object({
    membroId: z
      .string()
      .uuid("Membro inválido. Verifique o UUID."),
  })
  .strict();

/** Tipo inferido do VincularMembroSchema. */
export type VincularMembroInput = z.infer<typeof VincularMembroSchema>;
