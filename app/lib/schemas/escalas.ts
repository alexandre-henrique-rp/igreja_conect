/**
 * Schemas Zod para edição de escalas.
 *
 * @see app/lib/escalas.server.ts
 */
import { z } from "zod";

/** Status possíveis de uma escala (espelha `StatusEscala` do Prisma). */
export const STATUS_ESCALA = ["PENDENTE", "CONFIRMADA", "REALIZADA", "CANCELADA"] as const;

/** Labels PT-BR. */
export const STATUS_ESCALA_LABEL: Record<(typeof STATUS_ESCALA)[number], string> = {
  PENDENTE: "Pendente",
  CONFIRMADA: "Confirmada",
  REALIZADA: "Realizada",
  CANCELADA: "Cancelada",
};

/** Hora opcional HH:MM; vazio vira `null`. */
const horaOpcional = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(
    z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe o horário no formato HH:MM.")
      .nullable(),
  );

/** Formulário "dados da escala" (intent=salvar). */
export const EscalaEditarSchema = z
  .object({
  titulo: z.string().trim().min(2, "O título deve ter pelo menos 2 caracteres.").max(120, "Use no máximo 120 caracteres."),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida."),
  status: z.enum(STATUS_ESCALA, { message: "Status inválido." }),
  cultoId: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.string().uuid("Culto inválido.").nullable()),
  observacao: z
    .string()
    .trim()
    .max(500, "Use no máximo 500 caracteres.")
    .optional()
    .transform((v) => (v ? v : null)),
  local: z
    .string()
    .trim()
    .max(120, "Use no máximo 120 caracteres.")
    .optional()
    .transform((v) => (v ? v : null)),
  horaInicio: horaOpcional,
  horaFim: horaOpcional,
  })
  .refine((v) => !v.horaInicio || !v.horaFim || v.horaFim > v.horaInicio, {
    message: "O término deve ser depois do início.",
    path: ["horaFim"],
  });

/** Formulário "adicionar voluntário" (intent=add-voluntario). */
export const EscalaVoluntarioSchema = z.object({
  membroId: z.string().uuid("Selecione um voluntário."),
  funcao: z.string().trim().min(1, "Informe a função.").max(60, "Use no máximo 60 caracteres."),
});
