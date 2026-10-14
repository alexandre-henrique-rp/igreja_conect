/**
 * Service de Acolhimento de Visitantes — Igreja Conect.
 *
 * Visitante = `Membro` com `tipo = VISITANTE`. Este service guarda o que é
 * específico do acolhimento (origem, preferência de contato, responsável,
 * consentimento LGPD e a linha do tempo de contatos) sobre o cadastro básico
 * criado por `createMembro` (que também dispara o alerta de acolhimento).
 *
 * **Operações:**
 *  - `criarVisitante` — cadastro + consentimento + registro "primeira visita"
 *  - `obterAcolhimento` — dados de acolhimento e linha do tempo
 *  - `registrarAcolhimento` — adiciona contato/próxima ação
 *  - `concluirAcao` — marca uma "próxima ação" como concluída
 *  - `converterVisitante` — promove a Congregado/Membro e registra a conversão
 *  - `resumoAcolhimento` — status e KPIs para a listagem
 *
 * **RBAC:** qualquer usuário com cargo escreve (`assertCanWriteMembers`);
 * o escopo de leitura segue `getMembroById` (DISCIPULADOR/LIDER só os seus).
 *
 * **LGPD:** `consentimentoContatoEm` registra QUANDO a pessoa autorizou o
 * contato; sem ele o visitante não deve ser contatado. Logs não carregam PII.
 */
import { prisma } from "~/db/prisma.server";
import { logAction } from "./audit.server";
import { NotFoundError } from "./errors";
import { createMembro, getMembroById, promoverTipo } from "./members.server";
import {
  ORIGEM_LABEL,
  TIPOS_REGISTRO,
  type OrigemVisita,
  type PreferenciaContato,
  type StatusAcolhimento,
} from "./schemas/acolhimento";
import type { MembroCreateInput } from "./schemas/membros";
import { assertCanWriteMembers } from "./rbac.server";
import type { SessionUser } from "./session.types";

/** Dados para criar um visitante. */
export type CriarVisitanteInput = {
  /** Campos básicos (validados por `MembroCreateSchema`). */
  base: MembroCreateInput;
  dataPrimeiraVisita?: Date;
  origemVisita?: OrigemVisita;
  preferenciaContato?: PreferenciaContato;
  responsavelAcolhimentoId?: string;
  observacoesVisita?: string;
  /** Deve ser `true`: a pessoa autorizou o contato. Sem isso o cadastro é recusado. */
  consentimentoContato: boolean;
};

/**
 * Cria um visitante com consentimento e registra a primeira visita.
 *
 * @throws {Response} 403 sem cargo; 422 sem consentimento.
 * @throws {NotFoundError} 404 se o responsável não existe.
 * @throws {EmailDuplicadoError} 409 (vinda de `createMembro`).
 */
export async function criarVisitante(input: CriarVisitanteInput, user: SessionUser) {
  assertCanWriteMembers(user);
  if (!input.consentimentoContato) {
    throw new Response("É necessário registrar a autorização de contato da pessoa.", { status: 422 });
  }
  if (input.responsavelAcolhimentoId) {
    const resp = await prisma.membro.findUnique({
      where: { id: input.responsavelAcolhimentoId },
      select: { id: true },
    });
    if (!resp) throw new NotFoundError("Responsável pelo acolhimento não encontrado.");
  }

  const criado = await createMembro({ ...input.base, tipo: "VISITANTE" }, user);
  const agora = new Date();
  const dataVisita = input.dataPrimeiraVisita ?? agora;

  await prisma.$transaction([
    prisma.membro.update({
      where: { id: criado.id },
      data: {
        dataPrimeiraVisita: dataVisita,
        origemVisita: input.origemVisita ?? null,
        preferenciaContato: input.preferenciaContato ?? null,
        responsavelAcolhimentoId: input.responsavelAcolhimentoId ?? null,
        observacoesVisita: input.observacoesVisita ?? null,
        consentimentoContatoEm: agora,
      },
    }),
    prisma.registroAcolhimento.create({
      data: {
        membroId: criado.id,
        tipo: "PRIMEIRA_VISITA",
        descricao: input.origemVisita ? `Origem: ${ORIGEM_LABEL[input.origemVisita]}` : "Primeira visita registrada",
        autorId: user.id,
        createdAt: dataVisita,
      },
    }),
  ]);

  await logAction({
    membroId: criado.id,
    event: "visitante.create",
    actorId: user.id,
    actorRole: user.cargo,
    details: JSON.stringify({ consentimento: true }),
  });

  return criado;
}

/** Deriva o status a partir dos registros (ordem irrelevante). */
export function derivarStatus(registros: Array<{ tipo: string; concluido: boolean }>): StatusAcolhimento {
  if (registros.some((r) => r.tipo === "RETORNO")) return "RETORNOU";
  if (registros.some((r) => r.tipo === "PROXIMA_ACAO" && !r.concluido)) return "ACOMPANHAR";
  return "NOVO";
}

/**
 * Dados de acolhimento de um visitante (respeita o escopo de `getMembroById`).
 *
 * @throws {NotFoundError} 404 se o membro não existe/está fora do escopo.
 */
export async function obterAcolhimento(id: string, user: SessionUser) {
  await getMembroById(id, user);
  const m = await prisma.membro.findUnique({
    where: { id },
    select: {
      dataPrimeiraVisita: true,
      origemVisita: true,
      preferenciaContato: true,
      observacoesVisita: true,
      consentimentoContatoEm: true,
      createdAt: true,
      responsavelAcolhimento: { select: { id: true, nome: true } },
      registrosAcolhimento: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          tipo: true,
          descricao: true,
          prazo: true,
          concluido: true,
          createdAt: true,
          autor: { select: { nome: true } },
        },
        take: 100,
      },
    },
  });
  if (!m) throw new NotFoundError("Visitante não encontrado.");

  const ultimoContato =
    m.registrosAcolhimento.find((r) => ["MENSAGEM", "LIGACAO", "RETORNO"].includes(r.tipo)) ?? null;
  const proximaAcao =
    [...m.registrosAcolhimento]
      .filter((r) => r.tipo === "PROXIMA_ACAO" && !r.concluido)
      .sort((a, b) => (a.prazo?.getTime() ?? Infinity) - (b.prazo?.getTime() ?? Infinity))[0] ?? null;

  return {
    ...m,
    status: derivarStatus(m.registrosAcolhimento),
    ultimoContato,
    proximaAcao,
  };
}

/** Dados para um novo registro na linha do tempo. */
export type RegistrarAcolhimentoInput = {
  tipo: (typeof TIPOS_REGISTRO)[number];
  descricao: string;
  prazo?: Date;
};

/**
 * Adiciona um registro à linha do tempo do visitante.
 *
 * @throws {NotFoundError} 404 se o visitante está fora do escopo/não existe.
 */
export async function registrarAcolhimento(id: string, input: RegistrarAcolhimentoInput, user: SessionUser) {
  assertCanWriteMembers(user);
  await getMembroById(id, user);
  return prisma.registroAcolhimento.create({
    data: {
      membroId: id,
      tipo: input.tipo,
      descricao: input.descricao,
      prazo: input.prazo ?? null,
      autorId: user.id,
    },
  });
}

/**
 * Marca uma "próxima ação" como concluída.
 *
 * @throws {NotFoundError} 404 se o registro não pertence ao visitante.
 */
export async function concluirAcao(membroId: string, registroId: string, user: SessionUser) {
  assertCanWriteMembers(user);
  await getMembroById(membroId, user);
  const r = await prisma.registroAcolhimento.findFirst({
    where: { id: registroId, membroId },
    select: { id: true },
  });
  if (!r) throw new NotFoundError("Registro não encontrado.");
  await prisma.registroAcolhimento.update({ where: { id: registroId }, data: { concluido: true } });
}

/**
 * Converte o visitante em Congregado/Membro e registra a conversão na linha
 * do tempo (usada no KPI "viraram membros").
 */
export async function converterVisitante(
  id: string,
  novoTipo: "CONGREGADO" | "MEMBRO_ATIVO",
  user: SessionUser,
) {
  await promoverTipo(id, novoTipo, user);
  await prisma.registroAcolhimento.create({
    data: {
      membroId: id,
      tipo: "CONVERSAO",
      descricao: novoTipo === "MEMBRO_ATIVO" ? "Convertido em membro efetivo" : "Convertido em congregado",
      autorId: user.id,
      concluido: true,
    },
  });
}

/**
 * Status e KPIs de acolhimento para a listagem de visitantes.
 *
 * Os KPIs consideram todos os visitantes (sem filtro de busca); `porMembro`
 * traz origem, responsável e status só dos ids pedidos.
 */
export async function resumoAcolhimento(ids: string[]) {
  const agora = Date.now();
  const ha30dias = new Date(agora - 30 * 24 * 3600 * 1000);
  const ha90dias = new Date(agora - 90 * 24 * 3600 * 1000);

  const [detalhes, regs, acompanhando, retornaram, convertidos] = await Promise.all([
    prisma.membro.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        dataPrimeiraVisita: true,
        origemVisita: true,
        responsavelAcolhimento: { select: { nome: true } },
      },
    }),
    prisma.registroAcolhimento.findMany({
      where: { membroId: { in: ids } },
      select: { membroId: true, tipo: true, concluido: true },
    }),
    prisma.membro.count({
      where: {
        tipo: "VISITANTE",
        registrosAcolhimento: { some: { tipo: "PROXIMA_ACAO", concluido: false } },
      },
    }),
    prisma.membro.count({
      where: {
        tipo: "VISITANTE",
        registrosAcolhimento: { some: { tipo: "RETORNO", createdAt: { gte: ha30dias } } },
      },
    }),
    prisma.registroAcolhimento.count({ where: { tipo: "CONVERSAO", createdAt: { gte: ha90dias } } }),
  ]);

  const porMembro = new Map(
    detalhes.map((d) => [
      d.id,
      {
        dataPrimeiraVisita: d.dataPrimeiraVisita,
        origemVisita: d.origemVisita as OrigemVisita | null,
        responsavel: d.responsavelAcolhimento?.nome ?? null,
        status: derivarStatus(regs.filter((r) => r.membroId === d.id)),
      },
    ]),
  );

  return { porMembro, kpis: { acompanhando, retornaram, convertidos } };
}
