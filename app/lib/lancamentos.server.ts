/**
 * Service de Lançamentos Financeiros — Igreja Conect (S06-T07, T08).
 *
 * **RN-FIN-04 (trava de saldo):** `assertSaldoSuficiente` é chamada ANTES
 * da transação para SAÍDAS. Dentro da transação, re-valida o saldo
 * (anti-TOCTOU) antes de mutar.
 *
 * **RN-FIN-05 (DÍZIMO exige membro):** `LancamentoCreateSchema` valida com
 * superRefine — DIZIMO exige `membroId`; DESPESA/COMPRA/MANUTENCAO/TRANSFERENCIA
 * NÃO pode ter `membroId`.
 *
 * **Bloqueio TRANSFERENCIA:** `criarLancamento` REJEITA categoria TRANSFERENCIA
 * (exclusiva do sistema de transferências — S07).
 *
 * **Camada 3 RBAC:**
 * - `criarLancamento` → `assertCanWriteLancamento` (ADMIN, PASTOR, FINANCEIRO, SECRETARIO)
 * - `listarPorCaixa` → `assertCanWriteLancamento`
 *
 * **GATE LGPD:** `safeLog` com allowlist (sem valorCentavos, descricao, membroId).
 *
 * @see .harness/RAG/pattern-trava-saldo-service.md (referência canônica)
 * @see .harness/RAG/security-rbac-matrix.md §4
 * @see .harness/RAG/lgpd-igreja-conect.md §2.5
 */
import { prisma } from "~/db/prisma.server";
import { LancamentoCreateSchema } from "./schemas/lancamentos";
import { assertSaldoSuficiente } from "./finance.server";
import { assertCanWriteLancamento } from "./rbac.server";
import { safeLog } from "./audit.server";
import type { SessionUser } from "./session.types";
import type { LancamentoCreateInput } from "./schemas/lancamentos";

// -------------------- T07 — criarLancamento --------------------

/**
 * Cria um lançamento financeiro (entrada ou saída).
 *
 * **Camada 3 RBAC PRIMEIRO:** `assertCanWriteLancamento(user)`.
 *
 * **Bloqueio TRANSFERENCIA:** categoria TRANSFERENCIA é exclusiva do sistema
 * de transferências (S07). Este service rejeita com 400.
 *
 * **Validação Zod:** `LancamentoCreateSchema.parse(input)` — propaga ZodError
 * (action captura → 422).
 *
 * **Trava de saldo (RN-FIN-04):**
 * - Para SAÍDAS: `assertSaldoSuficiente` é chamada ANTES da transação.
 * - Dentro de `$transaction`: re-leitura anti-TOCTOU do caixa, re-valida
 *   saldo para SAÍDA, cria lançamento, atualiza saldo.
 *
 * @description Camada 3 — cria lançamento com atomicidade e trava de saldo.
 * @param {LancamentoCreateInput} input - Dados validados do lançamento.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<Object>} Lançamento criado.
 * @throws {ZodError} Se input inválido (propagado, action → 422).
 * @throws {Response} 400 se categoria TRANSFERENCIA.
 * @throws {Response} 403 se usuário não tem perfil financeiro.
 * @throws {Response} 409 se saldo insuficiente ou caixa arquivado.
 * @throws {Response} 404 se caixa não existe.
 * @example
 *   const lanc = await criarLancamento({
 *     tipo: "ENTRADA",
 *     categoria: "OFERTA",
 *     valorCentavos: 1000,
 *     caixaId: caixa.id,
 *     dataCompetencia: "2026-06-01",
 *     descricao: "Oferta do culto",
 *   }, adminUser);
 */
export async function criarLancamento(
  input: LancamentoCreateInput,
  user: SessionUser,
): Promise<unknown> {
  // 1) CAMADA 3 — RBAC PRIMEIRO (SEC-005: assertCanWriteLancamento)
  assertCanWriteLancamento(user);

  // 2) Bloqueio explícito: TRANSFERENCIA é exclusiva de transferirEntreCaixas
  if (input.categoria === "TRANSFERENCIA") {
    throw new Response(
      "Categoria TRANSFERENCIA é exclusiva do sistema de transferências. Use a página /app/financeiro/transferencias/nova.",
      { status: 400 },
    );
  }

  // 3) Validação Zod (propaga ZodError — action captura → 422)
  const parsed = LancamentoCreateSchema.parse(input);

  // 4) Trava de saldo para SAÍDAS (ANTES da transação — validação rápida)
  if (parsed.tipo === "SAIDA") {
    await assertSaldoSuficiente(
      parsed.caixaId,
      parsed.valorCentavos,
      `Lançamento de saída (${parsed.categoria})`,
    );
  }

  // 5) Transação atômica: re-leitura anti-TOCTOU + create + update
  return prisma.$transaction(async (tx) => {
    // Re-leitura do caixa dentro da transação
    const caixa = await tx.caixa.findUniqueOrThrow({
      where: { id: parsed.caixaId },
      select: { id: true, ativo: true, saldoCentavos: true, nome: true },
    });

    // Re-checagem: caixa arquivado
    if (caixa.ativo === false) {
      throw new Response(
        `Caixa "${caixa.nome}" está arquivado e não aceita movimentações.`,
        { status: 409 },
      );
    }

    // Re-checagem TOCTOU: saldo para SAÍDA
    if (parsed.tipo === "SAIDA" && caixa.saldoCentavos < parsed.valorCentavos) {
      throw new Response(
        `Saldo insuficiente no caixa de origem. Disponível: R$ ${(caixa.saldoCentavos / 100).toFixed(2)}.`,
        { status: 409 },
      );
    }

    // Cria o lançamento
    const lancamento = await tx.lancamento.create({
      data: {
        tipo: parsed.tipo,
        categoria: parsed.categoria,
        status: parsed.status,
        valorCentavos: parsed.valorCentavos,
        caixaId: parsed.caixaId,
        membroId: parsed.membroId ?? null,
        dataCompetencia: parsed.dataCompetencia,
        descricao: parsed.descricao,
      },
    });

    // Atualiza saldo do caixa
    await tx.caixa.update({
      where: { id: parsed.caixaId },
      data: {
        saldoCentavos:
          parsed.tipo === "ENTRADA"
            ? { increment: parsed.valorCentavos }
            : { decrement: parsed.valorCentavos },
      },
    });

    safeLog({
      action: "create_lancamento",
      resource: `lancamento:${lancamento.id}`,
      userId: user.id,
      result: "ok",
    });

    return lancamento;
  });
}

// -------------------- T08 — listarPorCaixa --------------------

/**
 * @description Lista lançamentos de um caixa com filtros, paginação e RBAC fina.
 * @param {string} caixaId - UUID do caixa.
 * @param {Object} filtros - Filtros (periodo?, categoria?, page?, pageSize?).
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<Object|null>} Dados paginados ou null se caixa não existe.
 * @throws {Response} 403 se perfil não autorizado.
 */
export async function listarPorCaixa(
  caixaId: string,
  filtros: {
    periodo?: string;
    categoria?: string;
    page?: number;
    pageSize?: number;
  },
  user: SessionUser,
): Promise<{
  caixa: {
    id: string;
    nome: string;
    saldoCentavos: number;
    ativo: boolean;
    createdAt: Date;
  };
  lancamentos: Array<{
    id: string;
    tipo: string;
    categoria: string;
    valorCentavos: number;
    dataCompetencia: Date;
    descricao: string | null;
    caixa: { id: string; nome: string };
    membro: { id: string; nome: string } | null;
    attachmentUploadId: string | null;
    attachmentUpload: {
      id: string;
      status: string;
      bucket: string;
      storageKeyPrefix: string;
      ext: string | null;
      detectedMime: string | null;
      deletedAt: Date | null;
    } | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
} | null> {
  // Camada 3 RBAC (SEC-005: assertCanWriteLancamento)
  assertCanWriteLancamento(user);

  // Verifica se caixa existe
  const caixa = await prisma.caixa.findUnique({
    where: { id: caixaId },
    select: {
      id: true,
      nome: true,
      saldoCentavos: true,
      ativo: true,
      createdAt: true,
    },
  });
  if (!caixa) return null;

  // Monta where
  const where: Record<string, unknown> = { caixaId };

  // Filtro período
  if (filtros.periodo && filtros.periodo !== "todos") {
    const now = new Date();
    let startDate: Date;
    switch (filtros.periodo) {
      case "mes_atual":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "mes_passado":
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        break;
      case "trimestre":
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        break;
      case "ano_atual":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(0);
    }
    where.dataCompetencia = { gte: startDate };
  }

  // Filtro categoria
  if (filtros.categoria && filtros.categoria !== "todas") {
    where.categoria = filtros.categoria;
  }

  // Filtro DIZIMO para SECRETARIO (RBAC fina service-side)
  if (user.cargo === "SECRETARIO") {
    where.categoria = { not: "DIZIMO" };
  }

  const page = filtros.page ?? 1;
  const pageSize = filtros.pageSize ?? 25;

  const [total, lancamentosRaw] = await Promise.all([
    prisma.lancamento.count({ where: where as any }),
    prisma.lancamento.findMany({
      where: where as any,
      orderBy: [{ dataCompetencia: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        caixa: { select: { id: true, nome: true } },
        membro: { select: { id: true, nome: true } },
        attachmentUpload: {
          select: {
            id: true,
            status: true,
            bucket: true,
            storageKeyPrefix: true,
            ext: true,
            detectedMime: true,
            deletedAt: true,
          },
        },
      },
    }),
  ]);

  safeLog({
    action: "view_extrato",
    resource: `caixa:${caixaId}`,
    userId: user.id,
    result: "ok",
  });

  return {
    caixa,
    lancamentos: lancamentosRaw.map((l) => ({
      id: l.id,
      tipo: l.tipo,
      categoria: l.categoria,
      valorCentavos: l.valorCentavos,
      dataCompetencia: l.dataCompetencia,
      descricao: l.descricao,
      caixa: l.caixa,
      membro: l.membro,
      attachmentUploadId: l.attachmentUploadId,
      attachmentUpload: l.attachmentUpload,
    })),
    total,
    page,
    pageSize,
  };
}
