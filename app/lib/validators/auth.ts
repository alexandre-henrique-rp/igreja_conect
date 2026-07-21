/**
 * Schemas Zod para o domínio de autenticação.
 *
 * Política de senha: ≥ 8 chars, 1 maiúscula, 1 número, 1 caractere especial.
 */
import { z } from "zod";

const SENHA_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,128}$/;
const SENHA_ERRO = "A senha deve ter no mínimo 8 caracteres, incluindo 1 letra maiúscula, 1 número e 1 caractere especial (!@#$%^&*...).";

/** Schema do payload de login. */
export const LoginInputSchema = z.object({
  email: z.string().email("Email inválido").max(120),
  senha: z.string().min(8, "Senha deve ter pelo menos 8 caracteres").max(128),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

/** Schema para criação de senha (fluxo de convite). Valida complexidade. */
export const SenhaSchema = z.object({
  senha: z.string().regex(SENHA_REGEX, SENHA_ERRO),
});

/** Schema para confirmação de senha. */
export const ConfirmarSenhaSchema = z
  .object({
    senha: z.string().regex(SENHA_REGEX, SENHA_ERRO),
    confirmarSenha: z.string().min(1, "Confirmação de senha obrigatória."),
  })
  .refine((data) => data.senha === data.confirmarSenha, {
    message: "As senhas não conferem.",
    path: ["confirmarSenha"],
  });

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
