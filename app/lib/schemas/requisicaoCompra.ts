import { z } from "zod";

export const STATUS_REQUISICAO = [
  "SOLICITADA",
  "APROVADA",
  "REJEITADA",
  "COMPRADA",
] as const;

export const RequisicaoCompraCreateSchema = z.object({
  itemEstoqueId: z.string().uuid().optional().nullable(),
  nomeItem: z.string().min(2, "O nome do item deve ter pelo menos 2 caracteres."),
  quantidade: z.coerce.number().int().positive("A quantidade deve ser maior que zero."),
  justificativa: z.string().min(5, "A justificativa deve ter pelo menos 5 caracteres.").max(500),
});

export type RequisicaoCompraCreateInput = z.infer<typeof RequisicaoCompraCreateSchema>;

export const AprovarRequisicaoSchema = z.object({
  id: z.string().uuid(),
  observacao: z.string().max(500).optional(),
});

export const RejeitarRequisicaoSchema = z.object({
  id: z.string().uuid(),
  observacao: z.string().min(5, "Informe o motivo da rejeição.").max(500),
});

export const ComprarRequisicaoSchema = z.object({
  id: z.string().uuid(),
  valorCentavos: z.coerce.number().int().positive("O valor deve ser maior que zero."),
  observacao: z.string().max(500).optional(),
});
