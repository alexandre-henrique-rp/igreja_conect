import { prisma } from "~/db/prisma.server";
import { assertCanManageMinisterios } from "./rbac.server";
import { NotFoundError } from "./errors";
import { logAction } from "./audit.server";
import type { SessionUser } from "./session.types";

type ResumoGeracao = {
  ministerioId: string;
  ministerioNome: string;
  escalasCriadas: number;
  erro?: string;
};

export async function gerarEscalasMes(
  ministerioId: string,
  mes: number,
  ano: number,
  user: SessionUser,
): Promise<{ escalasCriadas: number }> {
  assertCanManageMinisterios(user);

  const ministerio = await prisma.ministerio.findUnique({
    where: { id: ministerioId },
    select: { id: true, nome: true },
  });
  if (!ministerio) {
    throw new NotFoundError("Ministério não encontrado.");
  }

  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 0, 23, 59, 59);

  const [atividades, funcoes, membros] = await Promise.all([
    prisma.atividadeMinisterio.findMany({
      where: {
        ministerioId,
        tipo: { in: ["CULTO", "ENSAIO"] },
        data: { gte: inicio, lte: fim },
      },
      orderBy: { data: "asc" },
    }),
    prisma.funcaoMinisterio.findMany({
      where: { ministerioId },
      orderBy: { nome: "asc" },
    }),
    prisma.ministerioMembro.findMany({
      where: { ministerioId },
      include: { membro: { select: { id: true, nome: true } } },
    }),
  ]);

  if (atividades.length === 0) {
    return { escalasCriadas: 0 };
  }

  if (funcoes.length === 0 || membros.length === 0) {
    return { escalasCriadas: 0 };
  }

  const escalasAutoExistentes = await prisma.escala.findMany({
    where: {
      ministerioId,
      geradaAutomaticamente: true,
      data: { gte: inicio, lte: fim },
    },
    select: { id: true },
  });

  if (escalasAutoExistentes.length > 0) {
    await prisma.escalaVoluntario.deleteMany({
      where: { escalaId: { in: escalasAutoExistentes.map((e) => e.id) } },
    });
    await prisma.escala.deleteMany({
      where: { id: { in: escalasAutoExistentes.map((e) => e.id) } },
    });
  }

  const indisponibilidades = await prisma.indisponibilidadeMembro.findMany({
    where: {
      ministerioId,
      OR: [
        { dataInicio: { gte: inicio, lte: fim } },
        { dataFim: { gte: inicio, lte: fim } },
        { AND: [{ dataInicio: { lte: inicio } }, { dataFim: { gte: fim } }] },
      ],
    },
  });

  function membroDisponivel(membroId: string, dataAtividade: Date): boolean {
    return !indisponibilidades.some(
      (ind) =>
        ind.membroId === membroId &&
        dataAtividade >= ind.dataInicio &&
        dataAtividade <= ind.dataFim,
    );
  }

  const ultimosSorteados = new Map<string, string>();

  let escalasCriadas = 0;

  for (const atividade of atividades) {
    const voluntariosCriados: Array<{
      membroId: string;
      funcao: string;
      funcaoId: string;
    }> = [];

    for (const funcao of funcoes) {
      const candidatos = membros.filter(
        (m) =>
          membroDisponivel(m.membro.id, atividade.data) &&
          m.membro.id !== ultimosSorteados.get(funcao.id),
      );

      const pool = candidatos.length > 0 ? candidatos : membros.filter(
        (m) => membroDisponivel(m.membro.id, atividade.data),
      );

      if (pool.length === 0) continue;

      const sorteado = pool[Math.floor(Math.random() * pool.length)];
      voluntariosCriados.push({
        membroId: sorteado.membro.id,
        funcao: funcao.nome,
        funcaoId: funcao.id,
      });
      ultimosSorteados.set(funcao.id, sorteado.membro.id);
    }

    const titulo = `${atividade.tipo === "CULTO" ? "Culto" : "Ensaio"} — ${ministerio.nome}`;

    const escala = await prisma.escala.create({
      data: {
        ministerioId,
        titulo,
        data: atividade.data,
        status: "PENDENTE",
        geradaAutomaticamente: true,
        createdById: user.id,
        voluntarios: {
          create: voluntariosCriados.map((v) => ({
            membroId: v.membroId,
            funcao: v.funcao,
            funcaoId: v.funcaoId,
            status: "CONFIRMADO",
          })),
        },
      },
    });

    escalasCriadas++;
  }

  await logAction({
    membroId: user.id,
    event: "escalas.gerar_mes",
    actorId: user.id,
    actorRole: user.cargo,
    details: JSON.stringify({ ministerioId, mes, ano, escalasCriadas }),
  });

  return { escalasCriadas };
}

export async function gerarEscalasTodosMinisterios(
  mes: number,
  ano: number,
  user: SessionUser,
): Promise<{ resumo: ResumoGeracao[]; totalEscalas: number }> {
  assertCanManageMinisterios(user);

  const ministerios = await prisma.ministerio.findMany({
    where: { status: "ATIVO" },
    select: { id: true, nome: true },
  });

  const resumo: ResumoGeracao[] = [];
  let totalEscalas = 0;

  for (const min of ministerios) {
    try {
      const result = await gerarEscalasMes(min.id, mes, ano, user);
      resumo.push({
        ministerioId: min.id,
        ministerioNome: min.nome,
        escalasCriadas: result.escalasCriadas,
      });
      totalEscalas += result.escalasCriadas;
    } catch (e) {
      resumo.push({
        ministerioId: min.id,
        ministerioNome: min.nome,
        escalasCriadas: 0,
        erro: e instanceof Error ? e.message : "Erro desconhecido",
      });
    }
  }

  await logAction({
    membroId: user.id,
    event: "escalas.gerar_todos",
    actorId: user.id,
    actorRole: user.cargo,
    details: JSON.stringify({ mes, ano, totalEscalas, ministerios: resumo.length }),
  });

  return { resumo, totalEscalas };
}
