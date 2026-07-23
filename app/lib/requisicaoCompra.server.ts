import { prisma } from "~/db/prisma.server";
import { assertCanSeeEstoque, assertCanManageEstoque } from "./rbac.server";
import { safeLog } from "./audit.server";
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

  safeLog({
    action: "create_requisicao_compra",
    resource: `requisicao:${req.id}`,
    userId: user.id,
    result: "ok",
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

  const req = await prisma.requisicaoCompra.findUnique({
    where: { id: parsed.id },
    select: { id: true, status: true },
  });

  if (!req) {
    throw new Response("Requisição não encontrada.", { status: 404 });
  }
  if (req.status !== "SOLICITADA") {
    throw new Response("Apenas requisições com status SOLICITADA podem ser aprovadas.", {
      status: 409,
    });
  }

  await prisma.requisicaoCompra.update({
    where: { id: parsed.id },
    data: {
      status: "APROVADA",
      aprovadoPorId: user.id,
      observacao: parsed.observacao || null,
    },
  });

  safeLog({
    action: "approve_requisicao_compra",
    resource: `requisicao:${parsed.id}`,
    userId: user.id,
    result: "ok",
  });

  return { success: true };
}

export async function rejeitarRequisicao(
  input: unknown,
  user: SessionUser,
): Promise<{ success: true }> {
  assertCanManageEstoque(user);

  const parsed = RejeitarRequisicaoSchema.parse(input);

  const req = await prisma.requisicaoCompra.findUnique({
    where: { id: parsed.id },
    select: { id: true, status: true },
  });

  if (!req) {
    throw new Response("Requisição não encontrada.", { status: 404 });
  }
  if (req.status !== "SOLICITADA") {
    throw new Response("Apenas requisições com status SOLICITADA podem ser rejeitadas.", {
      status: 409,
    });
  }

  await prisma.requisicaoCompra.update({
    where: { id: parsed.id },
    data: {
      status: "REJEITADA",
      aprovadoPorId: user.id,
      observacao: parsed.observacao,
    },
  });

  safeLog({
    action: "reject_requisicao_compra",
    resource: `requisicao:${parsed.id}`,
    userId: user.id,
    result: "ok",
  });

  return { success: true };
}

export async function comprarRequisicao(
  input: unknown,
  user: SessionUser,
): Promise<{ success: true }> {
  assertCanManageEstoque(user);

  const parsed = ComprarRequisicaoSchema.parse(input);

  const req = await prisma.requisicaoCompra.findUnique({
    where: { id: parsed.id },
    select: { id: true, status: true, itemEstoqueId: true, nomeItem: true, quantidade: true },
  });

  if (!req) {
    throw new Response("Requisição não encontrada.", { status: 404 });
  }
  if (req.status !== "APROVADA") {
    throw new Response("Apenas requisições APROVADAS podem ser marcadas como compradas.", {
      status: 409,
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.requisicaoCompra.update({
      where: { id: parsed.id },
      data: {
        status: "COMPRADA",
        compradoPorId: user.id,
        valorCentavos: parsed.valorCentavos,
        observacao: parsed.observacao || null,
      },
    });

    if (req.itemEstoqueId) {
      await tx.itemEstoque.update({
        where: { id: req.itemEstoqueId },
        data: { quantidade: { increment: req.quantidade } },
      });

      await tx.movimentacaoEstoque.create({
        data: {
          itemEstoqueId: req.itemEstoqueId,
          quantidade: req.quantidade,
          justificativa: `Reposição via requisição de compra`,
          autorizadoPorId: user.id,
          nomeRetirante: user.nome,
        },
      });
    }
  });

  safeLog({
    action: "buy_requisicao_compra",
    resource: `requisicao:${parsed.id}`,
    userId: user.id,
    result: "ok",
  });

  return { success: true };
}
