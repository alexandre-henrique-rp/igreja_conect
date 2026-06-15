/**
 * Schemas Zod para o formulário de login (S01-T02).
 *
 * Diferem de `app/lib/validators/auth.ts` (que serve a API `/api/auth/login`
 * via JSON). Aqui o input vem de um `<form>` HTML — `manterConectado` é uma
 * string de checkbox que precisa ser coagida para boolean, e a senha não
 * precisa de mínimo de 8 chars (validação defensiva: a UX do form
 * não deve forçar complexidade no reset; regras de complexidade são
 * responsabilidade do ADMIN ao criar o membro).
 */
import { z } from "zod";

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
