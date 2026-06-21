/**
 * Schemas Zod para o domínio de Estoque/Patrimônio (S11-T04).
 *
 * **RN-EST-01:** Patrimônio requer `numeroSerie` obrigatório — validado via
 * discriminatedUnion no schema de criação (`ItemEstoqueCreateSchema`).
 * Itens do tipo CONSUMO não aceitam `numeroSerie` nem `statusPatrimonio`.
 *
 * **RN-EST-05:** Baixa por perda exige motivo com mínimo de 10 caracteres.
 *
 * @see docs/REGRAS_DE_NEGOCIO.md (RN-EST-01, RN-EST-05)
 */
import { z } from "zod";

/**
 * Schema de criação de Item de Estoque/Patrimônio.
 *
 * - `CONSUMO`: sem `numeroSerie` nem `statusPatrimonio`.
 * - `PATRIMONIO`: `numeroSerie` obrigatório, `statusPatrimonio` default DISPONIVEL.
 * - Todos os campos numéricos usam `z.coerce.number()` para conversão de inputs
 *   de formulário HTML.
 * - `.strict()`: rejeita campos não declarados (gate LGPD).
 */
export const ItemEstoqueCreateSchema = z.discriminatedUnion("tipo", [
  z
    .object({
      nome: z
        .string()
        .min(2, "Nome deve ter pelo menos 2 caracteres.")
        .max(120),
      tipo: z.literal("CONSUMO"),
      quantidade: z.coerce.number().int().min(0).default(0),
      quantidadeMinima: z.coerce.number().int().min(0).default(5),
      descricao: z.string().max(500).optional(),
      localizacaoFisica: z.string().max(120).optional(),
    })
    .strict(),
  z
    .object({
      nome: z
        .string()
        .min(2, "Nome deve ter pelo menos 2 caracteres.")
        .max(120),
      tipo: z.literal("PATRIMONIO"),
      quantidade: z.coerce.number().int().min(0).default(1),
      quantidadeMinima: z.coerce.number().int().min(0).default(5),
      descricao: z.string().max(500).optional(),
      numeroSerie: z
        .string()
        .min(1, "Número de série é obrigatório para patrimônio.")
        .max(60),
      statusPatrimonio: z.literal("DISPONIVEL").default("DISPONIVEL"),
      localizacaoFisica: z.string().max(120).optional(),
    })
    .strict(),
]);

/**
 * Schema de atualização de Item de Estoque/Patrimônio.
 * Todos os campos são opcionais (partial do create).
 * Tipo, numeroSerie e statusPatrimonio não são alteráveis via update.
 */
export const ItemEstoqueUpdateSchema = z
  .object({
    nome: z.string().min(2).max(120).optional(),
    descricao: z.string().max(500).optional(),
    quantidade: z.coerce.number().int().min(0).optional(),
    quantidadeMinima: z.coerce.number().int().min(0).optional(),
    localizacaoFisica: z.string().max(120).optional(),
  })
  .strict();

/**
 * Schema de criação de Movimentação de Estoque.
 *
 * Convenção de sinais:
 * - `quantidade > 0` → entrada (adiciona ao estoque)
 * - `quantidade < 0` → saída (remove do estoque)
 *
 * **RN-EST-02:** Movimentação de saída (`quantidade < 0`) exige
 * `nomeRetirante`.
 *
 * @see docs/REGRAS_DE_NEGOCIO.md (RN-EST-02)
 */
export const MovimentacaoCreateSchema = z
  .object({
    quantidade: z.number().int("Quantidade deve ser inteiro."),
    nomeRetirante: z.string().max(120).optional(),
    justificativa: z.string().max(500).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.quantidade < 0 && !data.nomeRetirante) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nomeRetirante"],
        message: "Movimentação de saída exige o nome do retirante (RN-EST-02).",
      });
    }
    if (data.quantidade === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Quantidade deve ser diferente de zero.",
      });
    }
  });

/**
 * Schema de criação de Ordem de Manutenção para item patrimoniado.
 */
export const ManutencaoCreateSchema = z
  .object({
    assistenciaTecnica: z
      .string()
      .min(3, "Nome da assistência técnica obrigatório.")
      .max(120),
    enderecoAssistencia: z
      .string()
      .min(5, "Endereço da assistência obrigatório.")
      .max(200),
    numeroOs: z.string().max(60).optional(),
    prazoTermino: z.coerce.date().optional(),
    custoCentavos: z.number().int().min(0).optional(),
  })
  .strict();

/**
 * Schema de baixa por perda de item patrimoniado (RN-EST-05).
 */
export const BaixaPerdaSchema = z
  .object({
    motivo: z
      .string()
      .min(
        10,
        "Motivo obrigatório (mínimo 10 caracteres). RN-EST-05."
      )
      .max(500),
  })
  .strict();

export type ItemEstoqueCreateInput = z.infer<typeof ItemEstoqueCreateSchema>;
export type ItemEstoqueUpdateInput = z.infer<typeof ItemEstoqueUpdateSchema>;
export type MovimentacaoCreateInput = z.infer<typeof MovimentacaoCreateSchema>;
export type ManutencaoCreateInput = z.infer<typeof ManutencaoCreateSchema>;
export type BaixaPerdaInput = z.infer<typeof BaixaPerdaSchema>;
