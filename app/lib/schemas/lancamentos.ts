/**
 * Schemas Zod para o domínio de Lançamentos Financeiros (S06-T06).
 *
 * **RN-FIN-05:** DÍZIMO exige membroId; DESPESA/COMPRA/MANUTENCAO/TRANSFERENCIA
 *   não pode ter membroId. OFERTA pode ser anônima.
 *
 * **Money:** valores em centavos (Int), NUNCA Float.
 *
 * @see docs/REGRAS_DE_NEGOCIO.md (RN-FIN-05)
 * @see .harness/RAG/convention-monetary-values.md
 */
import { z } from "zod";

/** Categorias de lançamento financeiro (mesmo enum do schema Prisma). */
export const CATEGORIAS_LANCAMENTO = [
  "DIZIMO",
  "OFERTA",
  "CAMPANHA",
  "DESPESA_OPERACIONAL",
  "COMPRA_ESTOQUE",
  "MANUTENCAO",
  "TRANSFERENCIA",
] as const;

/** Tipos de lançamento financeiro. */
export const TIPOS_LANCAMENTO = ["ENTRADA", "SAIDA"] as const;

/**
 * Schema de criação de Lançamento Financeiro.
 *
 * **RN-FIN-05:**
 * - `DIZIMO` → `membroId` obrigatório.
 * - `DESPESA_OPERACIONAL`, `COMPRA_ESTOQUE`, `MANUTENCAO`, `TRANSFERENCIA`
 *   → `membroId` NÃO pode ser informado.
 * - `OFERTA` e `CAMPANHA` → `membroId` opcional.
 *
 * `.strict()`: bloqueia campos não documentados (gate LGPD).
 *
 * @description Valida payload de criação de lançamento.
 */
export const LancamentoCreateSchema = z
  .object({
    tipo: z.enum(TIPOS_LANCAMENTO),
    categoria: z.enum(CATEGORIAS_LANCAMENTO),
    valorCentavos: z.number().int("Valor deve ser inteiro.").positive("Valor deve ser positivo."),
    caixaId: z.string().uuid("caixaId deve ser um UUID válido."),
    membroId: z.string().uuid("membroId deve ser um UUID válido.").optional().nullable(),
    dataCompetencia: z.coerce.date({ message: "Data de competência inválida." }),
    descricao: z.string().min(1, "Descrição é obrigatória.").max(500, "Descrição deve ter no máximo 500 caracteres."),
  })
  .strict()
  .superRefine((data, ctx) => {
    // RN-FIN-05: DIZIMO exige membroId
    if (data.categoria === "DIZIMO" && !data.membroId) {
      ctx.addIssue({
        code: "custom",
        path: ["membroId"],
        message: "Dízimo exige membro.",
      });
    }
    // DESPESA/COMPRA/MANUTENCAO/TRANSFERENCIA não pode ter membroId
    if (!["DIZIMO", "OFERTA", "CAMPANHA"].includes(data.categoria) && data.membroId) {
      ctx.addIssue({
        code: "custom",
        path: ["membroId"],
        message: "Apenas DÍZIMO, OFERTA e CAMPANHA podem ter membro vinculado.",
      });
    }
  });

/** Tipo inferido do LancamentoCreateSchema (OUTPUT). */
export type LancamentoCreateInput = z.infer<typeof LancamentoCreateSchema>;

/** Períodos pré-definidos para filtro de extrato. */
export const PERIODOS_FILTRO = ["", "mes_atual", "mes_passado", "ano_atual"] as const;

/**
 * Schema de filtros para extrato de caixa.
 *
 * @description Valida query params de listagem de lançamentos.
 */
export const ExtratoFiltrosSchema = z.object({
  periodo: z.enum(PERIODOS_FILTRO).optional(),
  categoria: z.enum(CATEGORIAS_LANCAMENTO).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/** Tipo inferido do ExtratoFiltrosSchema. */
export type ExtratoFiltros = z.infer<typeof ExtratoFiltrosSchema>;
