/**
 * Service de Convites — criação de senha via token temporário.
 *
 * Fluxo:
 * 1. Admin cadastra membro com cargo + email → `criarConvite`
 * 2. Retorna URL + texto formatado para WhatsApp/Telegram
 * 3. Membro acessa URL → `validarConvite` → cria senha → `usarConvite`
 *
 * Token: UUID v4, expira em 2 horas, uso único.
 */
// Garante que `process.env.BASE_URL` esteja populado a partir de `.env`
// antes da constante de módulo ser avaliada. Vite/RR7 não injetam
// vars sem prefixo `VITE_` em `process.env` por padrão — só em
// `import.meta.env` — então sem este import o fallback
// `http://localhost:5173` vence em qualquer ambiente.
import "dotenv/config";
import { prisma } from "~/db/prisma.server";
import { hashPassword } from "./auth.server";

const CONVITE_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 horas

/**
 * Resolve a URL base do convite em tempo de chamada.
 *
 * Lê `process.env.BASE_URL` dinamicamente (em vez de cachear em
 * constante de módulo) para garantir que o valor de `.env` esteja
 * disponível mesmo em cenários onde o módulo é importado antes do
 * carregamento do dotenv por outro entrypoint.
 *
 * @returns URL base sem barra final (ex: `https://app.example.com`).
 */
function getBaseUrl(): string {
  return process.env.BASE_URL ?? "http://localhost:5173";
}

const CARGO_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  PASTOR: "Pastor(a)",
  SECRETARIO: "Secretário(a)",
  DISCIPULADOR: "Discipulador(a)",
  FINANCEIRO: "Financeiro",
  LIDER_MINISTERIO: "Líder de Ministério",
};

/**
 * Gera um token de convite para o membro criar sua senha.
 *
 * @param membroId - UUID do membro.
 * @param membroNome - Nome do membro (para o texto do convite).
 * @param cargo - Cargo do membro (para o texto do convite).
 * @returns Token, URL completa e texto formatado para cópia.
 */
export async function criarConvite(
  membroId: string,
  membroNome: string,
  cargo: string
): Promise<{ token: string; url: string; textoConvite: string }> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + CONVITE_EXPIRY_MS);

  await prisma.conviteToken.create({
    data: {
      membroId,
      token,
      expiresAt,
    },
  });

  const url = `${getBaseUrl()}/convite/${token}`;
  const cargoFormatado = CARGO_LABELS[cargo] ?? cargo;

  const textoConvite = [
    `Olá ${membroNome}!`,
    ``,
    `Você foi convidado(a) para fazer parte do sistema *Igreja Connect* como *${cargoFormatado}*.`,
    ``,
    `Para criar sua senha e acessar o sistema, clique no link abaixo (válido por 2 horas):`,
    ``,
    url,
    ``,
    `Se tiver dúvidas, entre em contato com a administração da igreja.`,
  ].join("\n");

  return { token, url, textoConvite };
}

/**
 * Valida um token de convite.
 *
 * @param token - Token UUID da URL.
 * @returns Dados do membro se válido, null se inválido/expirado/já usado.
 */
export async function validarConvite(
  token: string
): Promise<{ membroId: string; membroNome: string } | null> {
  const convite = await prisma.conviteToken.findUnique({
    where: { token },
    include: { membro: { select: { id: true, nome: true } } },
  });

  if (!convite) return null;
  if (convite.usedAt) return null;
  if (convite.expiresAt.getTime() < Date.now()) return null;

  return { membroId: convite.membro.id, membroNome: convite.membro.nome };
}

/**
 * Marca um token como usado e define a senha do membro.
 *
 * @param token - Token UUID.
 * @param senha - Senha em texto puro (será hasheada).
 */
export async function usarConvite(token: string, senha: string): Promise<void> {
  const convite = await prisma.conviteToken.findUnique({
    where: { token },
    select: { id: true, membroId: true },
  });

  if (!convite) throw new Error("Convite não encontrado.");

  const senhaHash = await hashPassword(senha);

  await prisma.$transaction([
    prisma.membro.update({
      where: { id: convite.membroId },
      data: { senhaHash },
    }),
    prisma.conviteToken.update({
      where: { id: convite.id },
      data: { usedAt: new Date() },
    }),
  ]);
}
