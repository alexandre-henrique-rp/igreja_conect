/**
 * Schemas Zod para o domínio de autenticação (S00-T07).
 *
 * Política de senha: ≥ 8 chars, sem forçar complexidade (decisão §3.1 do design).
 */
import { z } from "zod";

/** Schema do payload de login. */
export const LoginInputSchema = z.object({
  email: z.string().email("Email inválido").max(120),
  senha: z.string().min(8, "Senha deve ter pelo menos 8 caracteres").max(128),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

/** Schema do payload de criação de membro. */
export const MembroCreateSchema = z.object({
  nome: z.string().min(2).max(120),
  tipo: z.enum(["MEMBRO_ATIVO", "CONGREGADO", "VISITANTE"]).default("VISITANTE"),
  email: z.string().email().max(120).optional(),
  telefone: z.string().max(20).optional(),
  profissao: z.string().max(80).optional(),
  estadoCivil: z.string().max(40).optional(),
  // Sem CPF, RG, dados fiscais (RN-MEM-02)
});

export type MembroCreateInput = z.infer<typeof MembroCreateSchema>;
