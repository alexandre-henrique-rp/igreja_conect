/**
 * Schemas Zod para o formulário de login (S01-T02).
 *
 * Diferem de `app/lib/validators/auth.ts` (que serve a API `/api/auth/login`
 * via JSON). Aqui o input vem de um `<form>` HTML — `manterConectado` é uma
 * string de checkbox que precisa ser coagida para boolean.
 */
import { z } from "zod";

const SENHA_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,128}$/;
const SENHA_ERRO = "A senha deve ter no mínimo 8 caracteres, incluindo 1 letra maiúscula, 1 número e 1 caractere especial (!@#$%^&*...).";

/**
 * Schema do payload de login (form HTML).
 *
 * - `email`: obrigatório, formato de e-mail.
 * - `senha`: obrigatória, 1 a 200 chars (limite anti-DoS).
 * - `manterConectado`: opcional, coerced de string ("on"/"true"/"false")
 *   ou boolean nativo.
 */
export const LoginSchema = z.object({
  email: z
    .string()
    .min(1, "E-mail obrigatório.")
    .max(120, "E-mail muito longo.")
    .email("E-mail inválido. Verifique o formato."),
  senha: z
    .string()
    .min(1, "Senha obrigatória.")
    .max(200, "Senha muito longa."),
  manterConectado: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => {
      if (typeof v === "boolean") return v;
      if (v === "on" || v === "true" || v === "1") return true;
      if (v === "off" || v === "false" || v === "0" || v === "") return false;
      return undefined;
    }),
});

/**
 * Tipo inferido do LoginSchema (exportado para uso em action/loader).
 * Renomeado para `LoginFormInput` para não colidir com `LoginInput` do
 * `validators/auth.ts` (usado pela API JSON `/api/auth/login`).
 */
export type LoginFormInput = z.infer<typeof LoginSchema>;

/**
 * Schema para criação de senha via convite (form HTML).
 * Valida complexidade: 1 maiúscula, 1 número, 1 especial, ≥ 8 chars.
 */
export const SenhaConviteSchema = z
  .object({
    senha: z.string().regex(SENHA_REGEX, SENHA_ERRO),
    confirmarSenha: z.string().min(1, "Confirmação de senha obrigatória."),
  })
  .refine((data) => data.senha === data.confirmarSenha, {
    message: "As senhas não conferem.",
    path: ["confirmarSenha"],
  });

export type SenhaConviteInput = z.infer<typeof SenhaConviteSchema>;

/**
 * Schema da etapa 1 de recuperação de senha (verificar identidade).
 * Valida email + nome para confirmar que o usuário é quem diz ser.
 */
export const RecuperarSenhaStep1Schema = z.object({
  email: z
    .string()
    .min(1, "E-mail obrigatório.")
    .max(120, "E-mail muito longo.")
    .email("E-mail inválido. Verifique o formato."),
  nome: z
    .string()
    .min(2, "Nome obrigatório.")
    .max(120, "Nome muito longo."),
});

export type RecuperarSenhaStep1Input = z.infer<typeof RecuperarSenhaStep1Schema>;

/**
 * Schema da etapa 2 de recuperação de senha (redefinir).
 * Reutiliza a mesma política de complexidade do convite.
 */
export const RecuperarSenhaStep2Schema = z
  .object({
    email: z.string().email(),
    senha: z.string().regex(SENHA_REGEX, SENHA_ERRO),
    confirmarSenha: z.string().min(1, "Confirmação de senha obrigatória."),
  })
  .refine((d) => d.senha === d.confirmarSenha, {
    message: "As senhas não conferem.",
    path: ["confirmarSenha"],
  });

export type RecuperarSenhaStep2Input = z.infer<typeof RecuperarSenhaStep2Schema>;
