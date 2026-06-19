/**
 * Service de Alertas — Igreja Conect (S04-T03).
 *
 * **Central de Alertas:** gerencia notificações internas do sistema
 * (ex.: novo visitante cadastrado, manutenção em ativo sem prazo).
 *
 * **LGPD:** safeLog nunca loga `mensagem` do alerta (pode conter
 * nome+telefone). NUNCA logar PII de visitantes.
 *
 * @see app/lib/schemas/alertas.ts
 * @see app/lib/alerts.server.test.ts
 */
import { prisma } from "~/db/prisma.server";
import { safeLog } from "./audit.server";
import { NotFoundError } from "./errors";
import type { SessionUser } from "./session.types";
import type { PrismaClient, Prisma } from "../../generated/prisma/client";

/** Filtros de listagem de alertas. */
export type AlertaFilter = "todos" | "nao_lidos" | "resolvidos";

/** Item de alerta retornado ao cliente. */
export type AlertaItem = {
  id: string;
  titulo: string;
  mensagem: string;
  lido: boolean;
  resolvido: boolean;
  createdAt: Date;
  destinatario?: {
    lido: boolean;
    resolvido: boolean;
  };
};

/** Counts agregados. */
export type AlertaCounts = {
  total: number;
  naoLidos: number;
  naoResolvidos: number;
};

/** Resultado de listAlertas. */
export type ListAlertasResult = {
  items: AlertaItem[];
  counts: AlertaCounts;
  activeFilter: AlertaFilter;
};

/**
 * Lista alertas do usuário autenticado com filtro e counts.
 *
 * O `where` principal garante que o usuário vê APENAS alertas onde
 * ele é destinatário (`destinatarios.some`).
 *
 * @description SELECT com filtro por destinatário e estado.
 * @param {SessionUser} user - Usuário autenticado.
 * @param {AlertaFilter} filter - 'todos' | 'nao_lidos' | 'resolvidos'.
 * @returns {Promise<ListAlertasResult>} Items + counts + activeFilter.
 * @example
 *   const { items, counts } = await listAlertas(user, "nao_lidos");
 */
export async function listAlertas(
  user: SessionUser,
  filter: AlertaFilter = "todos"
): Promise<ListAlertasResult> {
  const baseWhere: Prisma.AlertaWhereInput = {
    destinatarios: { some: { membroId: user.id } },
  };

  if (filter === "nao_lidos") {
    baseWhere.destinatarios = {
      some: { membroId: user.id, lido: false },
    };
  } else if (filter === "resolvidos") {
    baseWhere.destinatarios = { some: { membroId: user.id, resolvido: true } };
  }

  const [items, total, naoLidos, naoResolvidos] = await Promise.all([
    prisma.alerta.findMany({
      where: baseWhere,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        titulo: true,
        mensagem: true,
        createdAt: true,
        destinatarios: {
          where: { membroId: user.id },
          select: { lido: true, resolvido: true },
        },
      },
    }),
    prisma.alerta.count({ where: baseWhere }),
    prisma.alerta.count({
      where: {
        destinatarios: { some: { membroId: user.id, lido: false } },
      },
    }),
    prisma.alerta.count({
      where: {
        destinatarios: { some: { membroId: user.id, resolvido: false } },
      },
    }),
  ]);

  return {
    items: items.map((item) => {
      const destinatario = item.destinatarios[0];
      return {
        id: item.id,
        titulo: item.titulo,
        mensagem: item.mensagem,
        lido: destinatario?.lido ?? false,
        resolvido: destinatario?.resolvido ?? false,
        createdAt: item.createdAt,
        destinatario,
      };
    }),
    counts: { total, naoLidos, naoResolvidos },
    activeFilter: filter,
  };
}

/**
 * Marca um alerta como lido para o usuário atual.
 *
 * Idempotente: marcar 2x = no-op. Só lança 404 se o alerta não existe
 * ou o usuário não é destinatário.
 *
 * @description UPDATE em `alerta_destinatarios` onde alertaId + membroId.
 * @param {string} alertaId - UUID do alerta.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<void>}
 * @throws {NotFoundError} 404 se alerta não encontrado para este usuário.
 * @example
 *   await marcarLido(alertaId, user); // 1ª vez: marca como lido
 *   await marcarLido(alertaId, user); // 2ª vez: no-op
 */
export async function marcarLido(
  alertaId: string,
  user: SessionUser
): Promise<void> {
  // Verifica existência antes (idempotente)
  const ad = await prisma.alertaDestinatario.findFirst({
    where: { alertaId, membroId: user.id },
  });
  if (!ad) {
    throw new NotFoundError("Alerta não encontrado para este usuário.");
  }

  // Só atualiza o estado do destinatário, sem mudar Alerta global
  await prisma.alertaDestinatario.updateMany({
    where: { alertaId, membroId: user.id, lido: false },
    data: { lido: true },
  });

  safeLog({
    userId: user.id,
    action: "marcar_lido",
    resource: "alerta",
    result: "ok",
    timestamp: Date.now(),
  });
}

/**
 * Marca um alerta como resolvido + lido para o usuário atual.
 *
 * Idempotente: marcar 2x = no-op. Só lança 404 se o alerta não existe
 * ou o usuário não é destinatário.
 *
 * @description UPDATE em `alertas` e `alerta_destinatarios`.
 * @param {string} alertaId - UUID do alerta.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<void>}
 * @throws {NotFoundError} 404 se alerta não encontrado para este usuário.
 * @example
 *   await marcarResolvido(alertaId, user);
 */
export async function marcarResolvido(
  alertaId: string,
  user: SessionUser
): Promise<void> {
  // Verifica se o usuário é destinatário
  const ad = await prisma.alertaDestinatario.findFirst({
    where: { alertaId, membroId: user.id },
  });
  if (!ad) {
    throw new NotFoundError("Alerta não encontrado para este usuário.");
  }

  // Resolve somente o estado do destinatário; não usa estado global
  await prisma.alertaDestinatario.updateMany({
    where: { alertaId, membroId: user.id, resolvido: false },
    data: { lido: true, resolvido: true },
  });

  safeLog({
    userId: user.id,
    action: "marcar_resolvido",
    resource: "alerta",
    result: "ok",
    timestamp: Date.now(),
  });
}

/**
 * Helper transacional para criar alerta de novo visitante.
 *
 * Usado dentro de `prisma.$transaction` para atomicidade.
 * Cria Alerta + AlertaDestinatario(s) conforme config.
 *
 * **LGPD:** mensagem contém apenas nome+telefone (NUNCA email, endereço).
 *
 * @description INSERT em `alertas` + `alerta_destinatarios`.
 * @param {PrismaClient | Prisma.TransactionClient} tx - Prisma client ou transaction.
 * @param {{ id: string; nome: string; telefone?: string | null }} visitante - Dados do visitante.
 * @param {{ responsavelVisitanteTipo: string; responsavelMembroId?: string | null; responsavelMinisterioId?: string | null }} config -
 *   Configuração de acolhimento.
 * @returns {Promise<{ id: string; titulo: string; mensagem: string } | null>} Alerta criado ou null quando responsável é inválido.
 * @example
 *   const alerta = await prisma.$transaction((tx) =>
 *     criarAlertaVisitante(tx, visitante, config)
 *   );
 */
export async function criarAlertaVisitante(
  tx: PrismaClient | Prisma.TransactionClient,
  visitante: { id: string; nome: string; telefone?: string | null },
  config: {
    responsavelVisitanteTipo: string;
    responsavelMembroId?: string | null;
    responsavelMinisterioId?: string | null;
  }
): Promise<{ id: string; titulo: string; mensagem: string } | null> {
  const mensagem = `Novo visitante cadastrado: ${visitante.nome}${visitante.telefone ? ` - Tel: ${visitante.telefone}` : ""}`;

  let destinatarioIds: string[] = [];

  if (config.responsavelVisitanteTipo === "MEMBRO" && config.responsavelMembroId) {
    const responsavel = await (tx as Prisma.TransactionClient).membro.findUnique({
      where: { id: config.responsavelMembroId },
      select: { id: true },
    });
    if (!responsavel) return null;
    destinatarioIds = [config.responsavelMembroId];
  } else if (
    config.responsavelVisitanteTipo === "MINISTERIO" &&
    config.responsavelMinisterioId
  ) {
    const ministerio = await (tx as Prisma.TransactionClient).ministerio.findUnique({
      where: { id: config.responsavelMinisterioId },
      select: { id: true },
    });
    if (!ministerio) return null;
    const membros = await (tx as Prisma.TransactionClient).ministerioMembro.findMany({
      where: { ministerioId: config.responsavelMinisterioId },
      select: { membroId: true },
    });
    destinatarioIds = membros.map((m) => m.membroId);
  }

  if (destinatarioIds.length === 0) {
    return null;
  }

  const alerta = await (tx as Prisma.TransactionClient).alerta.create({
    data: {
      titulo: "Novo visitante cadastrado",
      mensagem,
      destinatarios: {
        create: destinatarioIds.map((membroId) => ({ membroId })),
      },
    },
  });

  return { id: alerta.id, titulo: alerta.titulo, mensagem: alerta.mensagem };
}
