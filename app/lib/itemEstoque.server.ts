/**
 * Service de Estoque/Patrimônio — Igreja Conect (S11-T02+T05+T06+T07).
 *
 * **RN-EST-01:** Patrimônio requer `numeroSerie` obrigatório — validado no schema.
 * Itens CONSUMO não aceitam `numeroSerie` nem `statusPatrimonio`.
 *
 * **RN-EST-05:** Baixa por perda exige motivo com mínimo de 10 caracteres.
 *
 * **Camada 3 (defense in depth):** toda função pública barra com `Response(403)`
 * no RBAC ANTES de qualquer query no banco.
 *
 * @see .harness/RAG/security-rbac-matrix.md §4 (camada 3 exemplo)
 * @see docs/REGRAS_DE_NEGOCIO.md (RN-EST-01, RN-EST-05)
 */
import { prisma } from "~/db/prisma.server";
import { z } from "zod";
import { assertCanSeeEstoque, assertCanManageEstoque } from "./rbac.server";
import {
  ItemEstoqueCreateSchema,
  ItemEstoqueUpdateSchema,
} from "./schemas/estoque";
import type {
  ItemEstoqueCreateInput,
  ItemEstoqueUpdateInput,
} from "./schemas/estoque";
import type { SessionUser } from "./session.server";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type ItemEstoqueResumo = {
  id: string;
  nome: string;
  tipo: string;
  quantidade: number;
  statusPatrimonio: string | null;
  ativo: boolean;
  localizacaoFisica: string | null;
  createdAt: Date;
};

export type ItemEstoqueDetalhe = {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: string;
  quantidade: number;
  quantidadeMinima: number;
  numeroSerie: string | null;
  statusPatrimonio: string | null;
  localizacaoFisica: string | null;
  ativo: boolean;
  createdAt: Date;
  updatedAt: Date;
  movimentacoes: Array<{
    id: string;
    quantidade: number;
    justificativa: string | null;
    nomeRetirante: string;
    createdAt: Date;
    autorizadoPor: { id: string; nome: string } | null;
  }>;
  manutencoes: Array<{
    id: string;
    assistenciaTecnica: string;
    enderecoAssistencia: string;
    numeroOs: string | null;
    dataEnvio: Date;
    prazoTermino: Date | null;
    dataRetorno: Date | null;
    foiPerdaTotal: boolean;
  }>;
  quantidadeCalculada: number;
  estoqueBaixo: boolean;
};

export type DashboardEstoqueData = {
  kpis: {
    total: number;
    consumo: number;
    patrimonio: number;
    estoqueBaixo: number;
  };
  ultimosItens: ItemEstoqueResumo[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extrai campos comuns de resumo de um registro do banco.
 *
 * @param raw - Registro bruto do Prisma (ItemEstoque).
 * @returns {ItemEstoqueResumo} Objeto resumo padronizado.
 */
function toResumo(raw: {
  id: string;
  nome: string;
  tipo: string;
  quantidade: number;
  statusPatrimonio: string | null;
  ativo: boolean;
  localizacaoFisica: string | null;
  createdAt: Date;
}): ItemEstoqueResumo {
  return {
    id: raw.id,
    nome: raw.nome,
    tipo: raw.tipo,
    quantidade: raw.quantidade,
    statusPatrimonio: raw.statusPatrimonio,
    ativo: raw.ativo,
    localizacaoFisica: raw.localizacaoFisica,
    createdAt: raw.createdAt,
  };
}

// ─── Funções públicas ─────────────────────────────────────────────────────────

/**
 * Valida saldo disponível para movimentação de estoque (Camada 3, RN-EST-02).
 *
 * **Re-leitura anti-TOCTOU** — busca o item no banco imediatamente antes de
 * validar, garantindo que a decisão use o estado mais recente.
 *
 * **Esta função apenas VALIDA.** O caller é responsável por efetuar a mutação
 * dentro de uma `$transaction`.
 *
 * @param {string} itemId - UUID do item de estoque.
 * @param {number} delta - Quantidade a movimentar (positivo = entrada, negativo = saída).
 * @param {string} context - Descrição do contexto de chamada (para rastreio em logs/erros).
 * @returns {Promise<void>}
 * @throws {Response} 400 se `delta === 0`.
 * @throws {Response} 404 se item não encontrado.
 * @throws {Response} 400 se item é PATRIMONIO (RN-EST-01 — movimentado por manutenção).
 * @throws {Response} 409 se item arquivado.
 * @throws {Response} 409 se saldo insuficiente (RN-EST-02).
 * @example
 * await assertSaldoQuantidade("uuid-do-item", -5, "saída para evento");
 * // → void se saldo ≥ 5
 */
export async function assertSaldoQuantidade(
  itemId: string,
  delta: number,
  context: string
): Promise<void> {
  if (delta === 0) {
    throw new Response(
      "A quantidade deve ser diferente de zero.",
      { status: 400 }
    );
  }

  const item = await prisma.itemEstoque.findUnique({
    where: { id: itemId },
    select: { id: true, nome: true, quantidade: true, tipo: true, ativo: true },
  });

  if (!item) {
    throw new Response("Item não encontrado.", { status: 404 });
  }

  if (item.tipo === "PATRIMONIO") {
    throw new Response(
      "Patrimônio não é movimentado por estoque. Use manutenção.",
      { status: 400 }
    );
  }

  if (item.ativo === false) {
    throw new Response(
      `Item "${item.nome}" está arquivado e não aceita movimentações.`,
      { status: 409 }
    );
  }

  if (delta < 0 && item.quantidade + delta < 0) {
    throw new Response(
      `Saldo insuficiente. Disponível: ${item.quantidade} un. Saída solicitada: ${Math.abs(delta)} un.`,
      { status: 409 }
    );
  }
}

// ─── Funções públicas ─────────────────────────────────────────────────────────

/**
 * Lista itens de estoque com paginação, filtros e busca textual.
 *
 * **Camada 3 RBAC:** `assertCanSeeEstoque(user)` PRIMEIRO.
 *
 * **Edge cases:**
 * - 0 itens: `{ items: [], total: 0, page: 1, pageSize: 25 }`.
 * - `pageSize` é limitado a 100 (clamping).
 * - `apenasAtivos !== false` filtra `ativo: true` (padrão).
 * - `q` (search) aplica OR entre `nome` e `descricao` com `contains`.
 *
 * @param {Object} options - Opções de filtro e paginação.
 * @param {boolean} [options.apenasAtivos] - Se true (padrão), só itens ativos.
 * @param {'CONSUMO' | 'PATRIMONIO'} [options.tipo] - Filtro por tipo.
 * @param {string} [options.status] - Filtro por statusPatrimonio.
 * @param {string} [options.q] - Busca textual (nome ou descricao).
 * @param {number} [options.page] - Página atual (default 1).
 * @param {number} [options.pageSize] - Itens por página (default 25, max 100).
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<{ items: ItemEstoqueResumo[]; total: number; page: number; pageSize: number }>}
 * @throws {Response} 403 se sem permissão de leitura.
 */
export async function listarItensEstoque(
  options: {
    apenasAtivos?: boolean;
    tipo?: "CONSUMO" | "PATRIMONIO";
    status?: string;
    q?: string;
    filtro?: "critico";
    page?: number;
    pageSize?: number;
  },
  user: SessionUser
): Promise<{
  items: ItemEstoqueResumo[];
  total: number;
  page: number;
  pageSize: number;
}> {
  assertCanSeeEstoque(user);

  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 25));

  const where: Record<string, unknown> = {};
  if (typeof options.apenasAtivos === "boolean") {
    where.ativo = options.apenasAtivos;
  }
  if (options.tipo) {
    where.tipo = options.tipo;
  }
  if (options.status) {
    where.statusPatrimonio = options.status;
  }
  if (options.q) {
    where.OR = [
      { nome: { contains: options.q } },
      { descricao: { contains: options.q } },
    ];
  }
  if (options.filtro === "critico") {
    where.tipo = "CONSUMO";
    where.quantidade = { lte: 5 };
  }

  const select = {
    id: true,
    nome: true,
    tipo: true,
    quantidade: true,
    statusPatrimonio: true,
    ativo: true,
    localizacaoFisica: true,
    createdAt: true,
  } as const;

  const [total, rows] = await Promise.all([
    prisma.itemEstoque.count({ where }),
    prisma.itemEstoque.findMany({
      where,
      select,
      orderBy: [{ tipo: "asc" }, { nome: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: rows.map(toResumo),
    total,
    page,
    pageSize,
  };
}

/**
 * Cria um novo item de estoque/patrimônio.
 *
 * **Camada 3 RBAC:** `assertCanManageEstoque(user)` PRIMEIRO.
 *
 * **RN-EST-01:** Se `tipo === 'PATRIMONIO'`, verifica unicidade de
 * `numeroSerie` ANTES de criar. Se já existir, retorna 409.
 *
 * @param {ItemEstoqueCreateInput} input - Dados validados do item.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<any>} O item criado.
 * @throws {Response} 403 se sem permissão de gerenciamento.
 * @throws {Response} 422 se `input` não passa na validação Zod.
 * @throws {Response} 409 se `numeroSerie` já está cadastrado.
 */
export async function criarItem(
  input: ItemEstoqueCreateInput,
  user: SessionUser
): Promise<any> {
  assertCanManageEstoque(user);

  const parsed = ItemEstoqueCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new Response(parsed.error.message, { status: 422 });
  }

  if (parsed.data.tipo === "PATRIMONIO" && parsed.data.numeroSerie) {
    const existente = await prisma.itemEstoque.findFirst({
      where: { numeroSerie: parsed.data.numeroSerie },
      select: { id: true },
    });
    if (existente) {
      throw new Response("Número de série já cadastrado.", { status: 409 });
    }
  }

  const item = await prisma.itemEstoque.create({
    data: { ...parsed.data, ativo: true },
  });

  return item;
}

/**
 * Atualiza um item de estoque/patrimônio existente.
 *
 * **Camada 3 RBAC:** `assertCanManageEstoque(user)` PRIMEIRO.
 *
 * **Regra:** tipo, numeroSerie e statusPatrimonio não são alteráveis via update.
 *
 * @param {string} id - UUID do item.
 * @param {ItemEstoqueUpdateInput} input - Dados parciais para atualizar.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<any>} O item atualizado.
 * @throws {Response} 403 se sem permissão de gerenciamento.
 * @throws {Response} 422 se `input` não passa na validação Zod.
 * @throws {Response} 404 se item não encontrado.
 */
export async function editarItem(
  id: string,
  input: ItemEstoqueUpdateInput,
  user: SessionUser
): Promise<any> {
  assertCanManageEstoque(user);

  const parsed = ItemEstoqueUpdateSchema.safeParse(input);
  if (!parsed.success) {
    throw new Response(parsed.error.message, { status: 422 });
  }

  const existente = await prisma.itemEstoque.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existente) {
    throw new Response("Item não encontrado.", { status: 404 });
  }

  const item = await prisma.itemEstoque.update({
    where: { id },
    data: parsed.data,
  });

  return item;
}

/**
 * Arquivar (soft-delete) um item de estoque.
 *
 * **Camada 3 RBAC:** `assertCanManageEstoque(user)` PRIMEIRO.
 *
 * **Idempotência:** se `ativo === false`, retorna 409.
 * **Bloqueio EM_MANUTENCAO:** se `statusPatrimonio === 'EM_MANUTENCAO'`,
 * retorna 409 — item precisa ter baixa ou retorno antes.
 *
 * @param {string} id - UUID do item.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<{ success: true }>}
 * @throws {Response} 403 se sem permissão de gerenciamento.
 * @throws {Response} 404 se item não encontrado.
 * @throws {Response} 409 se já arquivado ou em manutenção.
 */
export async function arquivarItem(
  id: string,
  user: SessionUser
): Promise<{ success: true }> {
  assertCanManageEstoque(user);

  const item = await prisma.itemEstoque.findUnique({
    where: { id },
    select: { id: true, ativo: true, statusPatrimonio: true },
  });
  if (!item) {
    throw new Response("Item não encontrado.", { status: 404 });
  }
  if (item.ativo === false) {
    throw new Response("Item já está arquivado.", { status: 409 });
  }
  if (item.statusPatrimonio === "EM_MANUTENCAO") {
    throw new Response(
      "Item em manutenção. Aguarde retorno/baixa para arquivar.",
      { status: 409 }
    );
  }

  await prisma.itemEstoque.update({
    where: { id },
    data: { ativo: false },
  });

  return { success: true };
}

/**
 * Reabrir (restaurar) um item de estoque arquivado.
 *
 * **Camada 3 RBAC:** `assertCanManageEstoque(user)` PRIMEIRO.
 *
 * **Idempotência:** se `ativo === true`, retorna 409.
 *
 * @param {string} id - UUID do item.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<{ success: true }>}
 * @throws {Response} 403 se sem permissão de gerenciamento.
 * @throws {Response} 404 se item não encontrado.
 * @throws {Response} 409 se item já está ativo.
 */
export async function reabrirItem(
  id: string,
  user: SessionUser
): Promise<{ success: true }> {
  assertCanManageEstoque(user);

  const item = await prisma.itemEstoque.findUnique({
    where: { id },
    select: { id: true, ativo: true },
  });
  if (!item) {
    throw new Response("Item não encontrado.", { status: 404 });
  }
  if (item.ativo === true) {
    throw new Response("Item já está ativo.", { status: 409 });
  }

  await prisma.itemEstoque.update({
    where: { id },
    data: { ativo: true },
  });

  return { success: true };
}

/**
 * Exclui permanentemente um item de estoque (apenas se arquivado).
 * Remove também movimentações e manutenções relacionadas.
 *
 * * @param {string} id - UUID do item.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<{ success: true }>}
 * @throws {Response} 403 se sem permissão.
 * @throws {Response} 404 se item não encontrado.
 * @throws {Response} 409 se item ainda está ativo (não arquivado).
 */
export async function excluirItem(
  id: string,
  user: SessionUser
): Promise<{ success: true }> {
  assertCanManageEstoque(user);

  const item = await prisma.itemEstoque.findUnique({
    where: { id },
    select: { id: true, ativo: true },
  });
  if (!item) {
    throw new Response("Item não encontrado.", { status: 404 });
  }
  if (item.ativo) {
    throw new Response("Arquive o item antes de excluí-lo permanentemente.", { status: 409 });
  }

  await prisma.$transaction([
    prisma.movimentacaoEstoque.deleteMany({ where: { itemEstoqueId: id } }),
    prisma.manutencaoAtivo.deleteMany({ where: { itemEstoqueId: id } }),
    prisma.itemEstoque.delete({ where: { id } }),
  ]);

  return { success: true };
}

/**
 * Retorna detalhes completos de um item (com movimentações e manutenções).
 *
 * **Camada 3 RBAC:** `assertCanSeeEstoque(user)` PRIMEIRO.
 *
 * **Cálculos derivados:**
 * - `quantidadeCalculada` = valor atual de `quantidade`.
 * - `estoqueBaixo` = true se `tipo === 'CONSUMO'` e `quantidade <= 5`.
 *
 * @param {string} id - UUID do item.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<ItemEstoqueDetalhe | null>} Detalhes do item ou null.
 * @throws {Response} 403 se sem permissão de leitura.
 */
export async function getItemEstoqueDetalhe(
  id: string,
  user: SessionUser
): Promise<ItemEstoqueDetalhe | null> {
  assertCanSeeEstoque(user);

  const item = await prisma.itemEstoque.findUnique({
    where: { id },
    include: {
      movimentacoes: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          autorizadoPor: { select: { id: true, nome: true } },
        },
      },
      manutencoes: {
        orderBy: { dataEnvio: "desc" },
        take: 5,
      },
    },
  });

  if (!item) return null;

  return {
    id: item.id,
    nome: item.nome,
    descricao: item.descricao,
    tipo: item.tipo,
    quantidade: item.quantidade,
    quantidadeMinima: item.quantidadeMinima,
    numeroSerie: item.numeroSerie,
    statusPatrimonio: item.statusPatrimonio,
    localizacaoFisica: item.localizacaoFisica,
    ativo: item.ativo,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    movimentacoes: item.movimentacoes.map((m) => ({
      id: m.id,
      quantidade: m.quantidade,
      justificativa: m.justificativa,
      nomeRetirante: m.nomeRetirante,
      createdAt: m.createdAt,
      autorizadoPor: m.autorizadoPor,
    })),
    manutencoes: item.manutencoes.map((m) => ({
      id: m.id,
      assistenciaTecnica: m.assistenciaTecnica,
      enderecoAssistencia: m.enderecoAssistencia,
      numeroOs: m.numeroOs,
      dataEnvio: m.dataEnvio,
      prazoTermino: m.prazoTermino,
      dataRetorno: m.dataRetorno,
      foiPerdaTotal: m.foiPerdaTotal,
    })),
    quantidadeCalculada: item.quantidade,
    estoqueBaixo: item.tipo === "CONSUMO" && item.quantidade <= 5,
  };
}

/**
 * Agrega dados do dashboard de Estoque/Patrimônio.
 *
 * **Camada 3 RBAC:** `assertCanSeeEstoque(user)` PRIMEIRO.
 *
 * **KPIs calculados (4 queries em Promise.all):**
 * - `total`: Total de itens ativos.
 * - `consumo`: Itens CONSUMO ativos.
 * - `patrimonio`: Itens PATRIMONIO ativos.
 * - `estoqueBaixo`: Itens CONSUMO ativos com `quantidade <= 5`.
 *
 * **Edge cases:**
 * - 0 itens: `kpis: { total: 0, consumo: 0, patrimonio: 0, estoqueBaixo: 0 }`.
 * - 0 itens recentes: `ultimosItens: []`.
 *
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<DashboardEstoqueData>} Dados para o dashboard.
 * @throws {Response} 403 se sem permissão de leitura.
 */
export async function getDashboardEstoque(
  user: SessionUser
): Promise<DashboardEstoqueData> {
  assertCanSeeEstoque(user);

  const whereAtivo = { ativo: true } as const;

  const [total, consumo, patrimonio, estoqueBaixo, ultimosItens] =
    await Promise.all([
      prisma.itemEstoque.count({ where: whereAtivo }),
      prisma.itemEstoque.count({ where: { ...whereAtivo, tipo: "CONSUMO" } }),
      prisma.itemEstoque.count({
        where: { ...whereAtivo, tipo: "PATRIMONIO" },
      }),
      prisma.itemEstoque.count({
        where: {
          ...whereAtivo,
          tipo: "CONSUMO",
          quantidade: { lte: 5 },
        },
      }),
      prisma.itemEstoque.findMany({
        where: whereAtivo,
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          nome: true,
          tipo: true,
          quantidade: true,
          statusPatrimonio: true,
          ativo: true,
          localizacaoFisica: true,
          createdAt: true,
        },
      }),
    ]);

  return {
    kpis: { total, consumo, patrimonio, estoqueBaixo },
    ultimosItens: ultimosItens.map(toResumo),
  };
}
