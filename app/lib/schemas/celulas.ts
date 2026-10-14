/**
 * Schemas Zod para Células (formulário de criação/edição).
 *
 * Campos vazios do formulário chegam como `""`; o schema os normaliza para
 * `undefined` para que o service trate como "não informado".
 *
 * @see app/lib/celulas.server.ts
 */
import { z } from "zod";

/** Dias da semana aceitos (mesmos valores já gravados em `Celula.diaSemana`). */
export const DIAS_CELULA = [
  "DOMINGO",
  "SEGUNDA",
  "TERCA",
  "QUARTA",
  "QUINTA",
  "SEXTA",
  "SABADO",
] as const;

/** Labels PT-BR dos dias. */
export const DIAS_CELULA_LABEL: Record<(typeof DIAS_CELULA)[number], string> = {
  DOMINGO: "Domingo",
  SEGUNDA: "Segunda-feira",
  TERCA: "Terça-feira",
  QUARTA: "Quarta-feira",
  QUINTA: "Quinta-feira",
  SEXTA: "Sexta-feira",
  SABADO: "Sábado",
};

/** Status possíveis de uma célula. */
export const STATUS_CELULA = ["ATIVA", "EM_FORMACAO", "INATIVA"] as const;

/** Labels PT-BR dos status. */
export const STATUS_CELULA_LABEL: Record<(typeof STATUS_CELULA)[number], string> = {
  ATIVA: "Ativa",
  EM_FORMACAO: "Em formação",
  INATIVA: "Inativa",
};

/** String opcional: trim e `""` → `undefined`. */
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .optional()
    .transform((v) => (v ? v : undefined));

/**
 * Schema do formulário de célula.
 */
export const CelulaFormSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "O nome deve ter pelo menos 2 caracteres.")
    .max(80, "Use no máximo 80 caracteres."),
  liderId: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.string().uuid("Líder inválido.").optional()),
  endereco: textoOpcional(200),
  diaSemana: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.enum(DIAS_CELULA, { message: "Dia da semana inválido." }).optional()),
  horario: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(
      z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe o horário no formato HH:MM.")
        .optional(),
    ),
  descricao: textoOpcional(1000),
  regiao: textoOpcional(80),
  status: z.enum(STATUS_CELULA, { message: "Status inválido." }).default("ATIVA"),
  capacidade: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? Number(v) : undefined))
    .pipe(
      z
        .number({ message: "Informe um número." })
        .int("Use um número inteiro.")
        .min(1, "A capacidade deve ser de pelo menos 1.")
        .max(500, "Capacidade máxima: 500.")
        .optional(),
    ),
});

/** Tipo inferido do formulário de célula. */
export type CelulaFormInput = z.infer<typeof CelulaFormSchema>;
