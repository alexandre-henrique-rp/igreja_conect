import bcrypt from "bcryptjs";
import { prisma } from "~/db/prisma.server";
import type { PrismaClient } from "../../generated/prisma/client";
import type { SessionUser } from "./session.types";

/**
 * Verifica credenciais de login e retorna um `SessionUser` seguro.
 *
 * Mantém mensagem unificada no caller: retorna `null` tanto para e-mail
 * inexistente quanto para senha incorreta.
 *
 * @description Valida e-mail/senha e retorna usuário sem dados sensíveis.
 * @param {string} email - E-mail do membro.
 * @param {string} senha - Senha em texto puro.
 * @returns {Promise<SessionUser | null>} Usuário seguro ou `null` se inválido.
 * @example
 *   const user = await verifyCredentials("admin@igreja.local", "senha");
 */
export async function verifyCredentials(
  email: string,
  senha: string,
  prismaClient: PrismaClient = prisma
): Promise<SessionUser | null> {
  const membro = await prismaClient.membro.findUnique({
    where: { email },
    select: { id: true, nome: true, cargo: true, senhaHash: true },
  });

  if (!membro || !membro.senhaHash) return null;

  const ok = await verifyPassword(senha, membro.senhaHash);
  if (!ok) return null;

  return {
    id: membro.id,
    nome: membro.nome,
    cargo: membro.cargo,
  };
}

/**
 * Cost factor do bcrypt. 10 = ~50ms por hash em hardware comum (ADR-002).
 * Aumentar para 12 se virar gargalo de performance no login — não agora.
 */
const BCRYPT_COST = 10;

/**
 * Gera hash bcrypt de uma senha em texto puro.
 *
 * Salt é gerado aleatoriamente pelo bcryptjs (cada chamada produz hash
 * diferente para a mesma senha). Cost 10 conforme ADR-002.
 *
 * @description Hash bcrypt de uma senha plain-text para persistir em `Membro.senhaHash`.
 * @param {string} plain - Senha em texto puro (mínimo 8 chars por convenção do projeto).
 * @returns {Promise<string>} Hash bcrypt no formato `$2a$10$...`.
 * @throws {Error} Se `plain` for vazio ou undefined.
 * @example
 *   const hash = await hashPassword("minha-senha-123");
 *   // hash === "$2a$10$abc..."
 */
export async function hashPassword(plain: string): Promise<string> {
  if (!plain) throw new Error("Senha não pode ser vazia.");
  return bcrypt.hash(plain, BCRYPT_COST);
}

/**
 * Verifica se uma senha plain-text bate com um hash bcrypt.
 *
 * Retorna `false` (nunca lança) para hash inválido ou senha incorreta —
 * o caller decide se loga/audita a falha.
 *
 * @description Compara senha plain com hash bcrypt previamente gerado.
 * @param {string} plain - Senha plain-text informada no login.
 * @param {string} hash - Hash armazenado em `Membro.senhaHash`.
 * @returns {Promise<boolean>} `true` se a senha confere, `false` caso contrário.
 * @example
 *   const ok = await verifyPassword(input, membro.senhaHash);
 *   if (!ok) throw new Response("Credenciais inválidas", { status: 401 });
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!plain || !hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
