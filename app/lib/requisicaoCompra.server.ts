import { prisma } from "~/db/prisma.server";
import { assertCanSeeEstoque, assertCanManageEstoque } from "./rbac.server";
import { logAction } from "./audit.server";
import {
  RequisicaoCompraCreateSchema,
  AprovarRequisicaoSchema,
  RejeitarRequisicaoSchema,
  ComprarRequisicaoSchema,
} from "./schemas/requisicaoCompra";
import type { SessionUser } from "./session.server";

export type RequisicaoCompraResumo = {
  id: string;
  nomeItem: string;
  quantidade: number;
  status: string;
  justificativa: string | null;
  valorCentavos: number | null;
  observacao: string | null;
  createdAt: Date;
  updatedAt: Date;
  itemEstoque: { id: string; nome: string } | null;
  solicitadoPor: { id: string; nome: string };
  aprovadoPor: { id: string; nome: string } | null;
  compradoPor: { id: string; nome: string } | null;
};

export type RequisicaoCompraDetalhe = RequisicaoCompraResumo & {
  lancamentoId: string | null;
};

function toResumo(raw: {
  id: string;
  nomeItem: string;
  quantidade: number;
  status: string;
  justificativa: string | null;
  valorCentavos: number | null;
  observacao: string | null;
  createdAt: Date;
  updatedAt: Date;
  itemEstoque: { id: string; nome: string } | null;
  solicitadoPor: { id: string; nome: string };
  aprovadoPor: { id: string; nome: string } | null;
  compradoPor: { id: string; nome: string } | null;
  lancamentoId: string | null;
}): RequisicaoCompraDetalhe {
  return {
    id: raw.id,
    nomeItem: raw.nomeItem,
    quantidade: raw.quantidade,
    status: raw.status,
    justificativa: raw.justificativa,
    valorCentavos: raw.valorCentavos,
    observacao: raw.observacao,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    itemEstoque: raw.itemEstoque,
    solicitadoPor: raw.solicitadoPor,
    aprovadoPor: raw.aprovadoPor,
    compradoPor: raw.compradoPor,
    lancamentoId: raw.lancamentoId,
  };
}

const INCLUDE = {
  itemEstoque: { select: { id: true, nome: true } },
  solicitadoPor: { select: { id: true, nome: true } },
  aprovadoPor: { select: { id: true, nome: true } },
  compradoPor: { select: { id: true, nome: true } },
};

export async function criarRequisicao(
  input: unknown,
  user: SessionUser,
): Promise<{ id: string }> {
  assertCanSeeEstoque(user);

  const parsed = RequisicaoCompraCreateSchema.parse(input);

  const req = await prisma.requisicaoCompra.create({
    data: {
      itemEstoqueId: parsed.itemEstoqueId ?? null,
      nomeItem: parsed.nomeItem,
      quantidade: parsed.quantidade,
      justificativa: parsed.justificativa,
      solicitadoPorId: user.id,
    },
  });

  logAction({
    actorId: user.id,
    actorRole: user.cargo ?? null,
    event: "requisicao_criada",
    details: JSON.stringify({ requisicaoId: req.id }),
  });

  return { id: req.id };
}

export async function listarRequisicoes(
  filtros: { status?: string; page?: number; pageSize?: number },
  user: SessionUser,
): Promise<{
  requisicoes: RequisicaoCompraResumo[];
  total: number;
  page: number;
  pageSize: number;
}> {
  assertCanSeeEstoque(user);

  const where: Record<string, unknown> = {};
  if (filtros.status && filtros.status !== "todas") {
    where.status = filtros.status;
  }

  const page = Math.max(1, filtros.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filtros.pageSize ?? 25));

  const [total, requisicoesRaw] = await Promise.all([
    prisma.requisicaoCompra.count({ where: where as any }),
    prisma.requisicaoCompra.findMany({
      where: where as any,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: INCLUDE,
    }),
  ]);

  return {
    requisicoes: requisicoesRaw.map((r) => toResumo(r)),
    total,
    page,
    pageSize,
  };
}

export async function obterRequisicao(
  id: string,
  user: SessionUser,
): Promise<RequisicaoCompraDetalhe | null> {
  assertCanSeeEstoque(user);

  const req = await prisma.requisicaoCompra.findUnique({
    where: { id },
    include: INCLUDE,
  });

  if (!req) return null;
  return toResumo(req);
}

export async function aprovarRequisicao(
  input: unknown,
  user: SessionUser,
): Promise<{ success: true }> {
  assertCanManageEstoque(user);

  const parsed = AprovarRequisicaoSchema.parse(input);

  const { count } = await prisma.requisicaoCompra.updateMany({
    where: { id: parsed.id, status: "SOLICITADA" },
    data: {
      status: "APROVADA",
      aprovadoPorId: user.id,
      observacao: parsed.observacao || null,
    },
  });

  if (count === 0) {
    const req = await prisma.requisicaoCompra.findUnique({
      where: { id: parsed.id },
      select: { id: true, status: true },
    });
    if (!req) {
      throw new Response("Requisição não encontrada.", { status: 404 });
    }
    if (req.status === "APROVADA") return { success: true }; // idempotente
    throw new Response(
      `Apenas requisições SOLICITADAS podem ser aprovadas (atual: ${req.status}).`,
      { status: 409 },
    );
  }

  logAction({
    actorId: user.id,
    actorRole: user.cargo ?? null,
    event: "requisicao_aprovada",
    details: JSON.stringify({ requisicaoId: parsed.id }),
  });

  return { success: true };
}

export async function rejeitarRequisicao(
  input: unknown,
  user: SessionUser,
): Promise<{ success: true }> {
  assertCanManageEstoque(user);

  const parsed = RejeitarRequisicaoSchema.parse(input);

  const { count } = await prisma.requisicaoCompra.updateMany({
    where: { id: parsed.id, status: "SOLICITADA" },
    data: {
      status: "REJEITADA",
      aprovadoPorId: user.id,
      observacao: parsed.observacao,
    },
  });

  if (count === 0) {
    const req = await prisma.requisicaoCompra.findUnique({
      where: { id: parsed.id },
      select: { id: true, status: true },
    });
    if (!req) {
      throw new Response("Requisição não encontrada.", { status: 404 });
    }
    if (req.status === "REJEITADA") return { success: true }; // idempotente
    throw new Response(
      `Apenas requisições SOLICITADAS podem ser rejeitadas (atual: ${req.status}).`,
      { status: 409 },
    );
  }

  logAction({
    actorId: user.id,
    actorRole: user.cargo ?? null,
    event: "requisicao_rejeitada",
    details: JSON.stringify({ requisicaoId: parsed.id }),
  });

  return { success: true };
}
export async function comprarRequisicao(
  input: unknown,
  user: SessionUser,
): Promise<{ success: true }> {
  assertCanManageEstoque(user);

  const parsed = ComprarRequisicaoSchema.parse(input);

  // Transição condicional atômica: WHERE inclui status esperado.
  const { count } = await prisma.requisicaoCompra.updateMany({
    where: { id: parsed.id, status: "APROVADA" },
    data: {
      status: "COMPRADA",
      compradoPorId: user.id,
      valorCentavos: parsed.valorCentavos,
      observacao: parsed.observacao || null,
    },
  });

  if (count === 0) {
    const req = await prisma.requisicaoCompra.findUnique({
      where: { id: parsed.id },
      select: { id: true, status: true },
    });
    if (!req) {
      throw new Response("Requisição não encontrada.", { status: 404 });
    }
    if (req.status === "COMPRADA") return { success: true }; // idempotente
    throw new Response(
      `Apenas requisições APROVADAS podem ser compradas (atual: ${req.status}).`,
      { status: 409 },
    );
  }

  // Busca dados da requisição para atualizar estoque e criar lançamento financeiro
  const req = await prisma.requisicaoCompra.findUnique({
    where: { id: parsed.id },
    select: { itemEstoqueId: true, quantidade: true, nomeItem: true },
  });

  if (req?.itemEstoqueId) {
    await prisma.$transaction(async (tx) => {
      await tx.itemEstoque.update({
        where: { id: req.itemEstoqueId! },
        data: { quantidade: { increment: req.quantidade } },
      });

      await tx.movimentacaoEstoque.create({
        data: {
          itemEstoqueId: req.itemEstoqueId!,
          quantidade: req.quantidade,
          justificativa: "Reposição via requisição de compra",
          autorizadoPorId: user.id,
          nomeRetirante: user.nome,
        },
      });

      // Lançamento financeiro vinculado ao caixa (se caixaId informado)
      if (parsed.caixaId && parsed.valorCentavos > 0) {
        const caixa = await tx.caixa.findUnique({
          where: { id: parsed.caixaId },
          select: { id: true, saldoCentavos: true },
        });
        if (!caixa) {
          throw new Response("Caixa não encontrado.", { status: 404 });
        }
        const novoSaldo = caixa.saldoCentavos - parsed.valorCentavos;
        if (novoSaldo < 0) {
          throw new Response(
            "Saldo insuficiente no caixa para esta compra.",
            { status: 400 },
          );
        }

        await tx.lancamento.create({
          data: {
            tipo: "SAIDA",
            categoria: "COMPRA_ESTOQUE",
            descricao: `Compra de estoque: ${req.nomeItem} (qtd: ${req.quantidade})`,
            valorCentavos: parsed.valorCentavos,
            dataCompetencia: new Date(),
            status: "PAGO",
            caixaId: parsed.caixaId,
          },
        });

        await tx.caixa.update({
          where: { id: parsed.caixaId },
          data: { saldoCentavos: novoSaldo },
        });
      }
    });
  }

  logAction({
    actorId: user.id,
    actorRole: user.cargo ?? null,
    event: "requisicao_comprada",
    details: JSON.stringify({ requisicaoId: parsed.id }),
  });

  return { success: true };
}
