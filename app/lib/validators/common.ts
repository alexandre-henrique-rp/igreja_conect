/**
 * Helpers Zod compartilhados entre validadores (S00-T08).
 *
 * Schemas reutilizáveis (email, telefone, uuid, etc.) para evitar duplicação.
 */
import { z } from "zod";

/** Email normalizado, lowercase, ≤ 120 chars. */
export const emailSchema = z
  .string()
  .max(120)
  .transform((v) => v.toLowerCase().trim())
  .pipe(z.string().email("Email inválido"));

/** Telefone livre (com ou sem máscara), ≥ 8 dígitos, ≤ 20 chars. */
export const telefoneSchema = z
  .string()
  .max(20)
  .refine((v) => {
    const digits = v.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 20;
  }, "Telefone inválido");

/** UUID v4. */
export const uuidSchema = z.string().uuid("ID inválido");

/** Senha forte: ≥ 8 chars (decisão §3.1 — sem forçar complexidade). */
export const senhaSchema = z
  .string()
  .min(8, "Senha deve ter pelo menos 8 caracteres")
  .max(128);

/** String não-vazia após trim. */
export const nonEmptyString = z.string().trim().min(1, "Campo obrigatório");

/** Sanitiza objeto removendo undefined/null em chaves opcionais. */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ) as Partial<T>;
}
