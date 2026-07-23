import { z } from "zod";

export const CriarAtividadeSchema = z
  .object({
    ministerioId: z.string().uuid("Ministério inválido."),
    membroId: z.string().uuid("Membro inválido.").optional(),
    tipo: z.enum(["ENSAIO", "ATIVIDADE_EXTRA"]),
    data: z.string().min(1, "Data é obrigatória."),
    horario: z
      .string()
      .min(1, "Horário é obrigatório.")
      .max(10, "Horário deve ter no máximo 10 caracteres."),
    descricao: z.string().max(500).optional(),
  })
  .strict();

export type CriarAtividadeInput = z.infer<typeof CriarAtividadeSchema>;

export const CriarIndisponibilidadeSchema = z
  .object({
    ministerioId: z.string().uuid("Ministério inválido."),
    membroId: z.string().uuid("Membro inválido."),
    dataInicio: z.string().min(1, "Data de início é obrigatória."),
    dataFim: z.string().min(1, "Data de fim é obrigatória."),
    motivo: z.string().max(500).optional(),
  })
  .strict()
  .refine((data) => new Date(data.dataFim) >= new Date(data.dataInicio), {
    message: "Data de fim deve ser maior ou igual à data de início.",
    path: ["dataFim"],
  });

export type CriarIndisponibilidadeInput = z.infer<typeof CriarIndisponibilidadeSchema>;
