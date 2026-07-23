import { prisma } from "~/db/prisma.server";
import { assertCanManageMinisterios } from "./rbac.server";
import { NotFoundError } from "./errors";
import { logAction } from "./audit.server";
import type { SessionUser } from "./session.types";
import {
  CriarAtividadeSchema,
  CriarIndisponibilidadeSchema,
} from "./schemas/disponibilidades";

const DIAS_MAP: Record<string, number> = {
  DOM: 0,
  SEG: 1,
  TER: 2,
  QUA: 3,
  QUI: 4,
  SEX: 5,
  SAB: 6,
};

export async function listarAtividades(
  ministerioId: string,
  membroId: string | undefined,
  mes: number,
  ano: number,
) {
  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 0, 23, 59, 59);

  const where: Record<string, unknown> = {
    ministerioId,
    data: { gte: inicio, lte: fim },
  };
  if (membroId) {
    where.OR = [
      { membroId },
      { membroId: null },
    ];
  }

  return prisma.atividadeMinisterio.findMany({
    where,
    orderBy: { data: "asc" },
  });
}

export async function criarAtividade(
  input: unknown,
  user: SessionUser,
) {
  assertCanManageMinisterios(user);
  const parsed = CriarAtividadeSchema.parse(input);

  const atividade = await prisma.atividadeMinisterio.create({
    data: {
      ministerioId: parsed.ministerioId,
      membroId: parsed.membroId ?? null,
      tipo: parsed.tipo,
      data: new Date(parsed.data + "T00:00:00"),
      horario: parsed.horario,
      descricao: parsed.descricao ?? null,
      criadoPorId: user.id,
    },
  });

  await logAction({
    membroId: user.id,
    event: "atividade_ministerio.create",
    actorId: user.id,
    actorRole: user.cargo,
    details: JSON.stringify({
      atividadeId: atividade.id,
      ministerioId: parsed.ministerioId,
      tipo: parsed.tipo,
    }),
  });

  return atividade;
}

export async function removerAtividade(id: string, user: SessionUser) {
  assertCanManageMinisterios(user);

  const atividade = await prisma.atividadeMinisterio.findUnique({
    where: { id },
    select: { id: true, ministerioId: true },
  });
  if (!atividade) {
    throw new NotFoundError("Atividade não encontrada.");
  }

  await prisma.atividadeMinisterio.delete({ where: { id } });
  await logAction({
    membroId: user.id,
    event: "atividade_ministerio.delete",
    actorId: user.id,
    actorRole: user.cargo,
    details: JSON.stringify({ atividadeId: id, ministerioId: atividade.ministerioId }),
  });
}

export async function listarIndisponibilidades(
  ministerioId: string,
  membroId: string,
  mes: number,
  ano: number,
) {
  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 0, 23, 59, 59);

  return prisma.indisponibilidadeMembro.findMany({
    where: {
      ministerioId,
      membroId,
      OR: [
        { dataInicio: { gte: inicio, lte: fim } },
        { dataFim: { gte: inicio, lte: fim } },
        { AND: [{ dataInicio: { lte: inicio } }, { dataFim: { gte: fim } }] },
      ],
    },
    orderBy: { dataInicio: "asc" },
  });
}

export async function criarIndisponibilidade(
  input: unknown,
  user: SessionUser,
) {
  assertCanManageMinisterios(user);
  const parsed = CriarIndisponibilidadeSchema.parse(input);

  const indisp = await prisma.indisponibilidadeMembro.create({
    data: {
      ministerioId: parsed.ministerioId,
      membroId: parsed.membroId,
      dataInicio: new Date(parsed.dataInicio + "T00:00:00"),
      dataFim: new Date(parsed.dataFim + "T23:59:59"),
      motivo: parsed.motivo ?? null,
    },
  });

  await logAction({
    membroId: user.id,
    event: "indisponibilidade.create",
    actorId: user.id,
    actorRole: user.cargo,
    details: JSON.stringify({
      indisponibilidadeId: indisp.id,
      ministerioId: parsed.ministerioId,
      membroId: parsed.membroId,
    }),
  });

  return indisp;
}

export async function removerIndisponibilidade(id: string, user: SessionUser) {
  assertCanManageMinisterios(user);

  const indisp = await prisma.indisponibilidadeMembro.findUnique({
    where: { id },
    select: { id: true, ministerioId: true, membroId: true },
  });
  if (!indisp) {
    throw new NotFoundError("Indisponibilidade não encontrada.");
  }

  await prisma.indisponibilidadeMembro.delete({ where: { id } });
  await logAction({
    membroId: user.id,
    event: "indisponibilidade.delete",
    actorId: user.id,
    actorRole: user.cargo,
    details: JSON.stringify({ indisponibilidadeId: id }),
  });
}

export async function gerarCultosRecorrentes(
  ministerioId: string,
  mes: number,
  ano: number,
  user: SessionUser,
) {
  assertCanManageMinisterios(user);

  const ministerio = await prisma.ministerio.findUnique({
    where: { id: ministerioId },
    select: { diasEncontro: true, horarioPadrao: true },
  });
  if (!ministerio) {
    throw new NotFoundError("Ministério não encontrado.");
  }

  const dias = ministerio.diasEncontro?.split(",").filter(Boolean) ?? [];
  const horario = ministerio.horarioPadrao ?? "19:30";

  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 0);
  const atividadesCriadas: string[] = [];

  for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
    const diaSemana = d.getDay();
    const diaKey = Object.entries(DIAS_MAP).find(([, v]) => v === diaSemana)?.[0];
    if (diaKey && dias.includes(diaKey)) {
      const dataStr = d.toISOString().slice(0, 10);

      const existe = await prisma.atividadeMinisterio.findFirst({
        where: {
          ministerioId,
          tipo: "CULTO",
          data: new Date(dataStr + "T00:00:00"),
        },
        select: { id: true },
      });

      if (!existe) {
        const atividade = await prisma.atividadeMinisterio.create({
          data: {
            ministerioId,
            tipo: "CULTO",
            data: new Date(dataStr + "T00:00:00"),
            horario,
            criadoPorId: user.id,
          },
        });
        atividadesCriadas.push(atividade.id);
      }
    }
  }

  return atividadesCriadas;
}
