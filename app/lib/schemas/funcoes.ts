import { z } from "zod";

export const CriarFuncaoSchema = z
  .object({
    nome: z
      .string()
      .min(2, "Nome da função deve ter ao menos 2 caracteres.")
      .max(50, "Nome da função deve ter no máximo 50 caracteres."),
    cor: z
      .string()
      .max(20)
      .optional(),
  })
  .strict();

export type CriarFuncaoInput = z.infer<typeof CriarFuncaoSchema>;

export const AtribuirFuncaoSchema = z
  .object({
    vinculoId: z.string().uuid("Vínculo inválido."),
    funcaoId: z.string().uuid("Função inválida.").nullable().optional(),
  })
  .strict();

export type AtribuirFuncaoInput = z.infer<typeof AtribuirFuncaoSchema>;
