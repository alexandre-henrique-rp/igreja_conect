/**
 * Service de Membros — Igreja Conect (S02-T02, estendido S03-T02).
 *
 * **Operações de domínio (server-only):**
 *  - `listMembros` — listagem paginada com filtros e RBAC fina
 *  - `getMembroById` — leitura com escopo
 *  - `createMembro` — criação + captura P2002 → `EmailDuplicadoError`
 *  - `updateMembro` — atualização parcial com escopo
 *  - `deleteMembro` — exclusão com validação de vínculos
 *  - `promoverTipo` — S03-T02: endpoint dedicado para mudar tipo
 *
 * **LGPD (AC-16):** `MEMBRO_SAFE_SELECT` é o único select usado em
 * todas as funções deste módulo — NUNCA inclui `senhaHash` (gate do
 * lgpd-officer).
 *
 * **RBAC fina (RAG `security-rbac-matrix` §3):**
 *  - DISCIPULADOR: força `discipuladorId = user.id` em `listMembros`;
 *    lança **404** (não 403) em `getMembroById`/`updateMembro` para
 *    não vazar existência do recurso.
 *  - `deleteMembro`: apenas ADMIN/PASTOR.
 *  - `promoverTipo`: qualquer autenticado com cargo (RN-MEM-01).
 *  - `assertCanWriteMembers` (camada 3) — qualquer autenticado escreve
 *    (RN-MEM-01).
 *
 * **S04 (cross-module):** `createMembro` será estendido com transação
 * atômica para gerar alerta quando tipo=VISITANTE. Esta sprint S02
 * entrega só o caso base.
 *
 * @see docs/REGRAS_DE_NEGOCIO.md (RN-MEM-01, RN-MEM-04, RN-MEM-06)
 */
import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { z } from "zod";
import { prisma } from "~/db/prisma.server";
import { assertCanWriteMembers } from "./rbac.server";
import { EmailDuplicadoError, NotFoundError, BusinessRuleError } from "./errors";
import { safeLog } from "./audit.server";
import { criarAlertaVisitante } from "./alerts.server";
import type { SessionUser } from "./session.types";
import type { MembroCreateInput, MembroUpdateInput } from "./schemas/membros";

/** Schema Zod para validação de `tipo` em `promoverTipo` (S03-T02). */
const TipoMembroSchema = z.enum(["VISITANTE", "CONGREGADO", "MEMBRO_ATIVO"]);

/**
 * `Prisma.select` canônico para Membro (LGPD AC-16).
 *
 * **REGRA:** toda função deste módulo DEVE usar este select. Nunca
 * retornar `senhaHash` em payload de API. Verificável via `grep
 * "senhaHash" app/lib/members.server.ts` — só pode aparecer em comentário.
 */
export const MEMBRO_SAFE_SELECT = {
  id: true,
  nome: true,
  tipo: true,
  email: true,
  telefone: true,
  profissao: true,
  estadoCivil: true,
  dataConversao: true,
  dataBatismo: true,
  logradouro: true,
  numero: true,
  bairro: true,
  cidade: true,
  estado: true,
  cep: true,
  discipuladorId: true,
  cargo: true,
  createdAt: true,
  updatedAt: true,
  // intencionalmente SEM senhaHash, SEM sessions, SEM ministerios
} satisfies Prisma.MembroSelect;

/** Tipo do select seguro (inferred). */
export type MembroSafe = Prisma.MembroGetPayload<{ select: typeof MEMBRO_SAFE_SELECT }>;

/** Filtros de listagem. */
export type ListMembrosFilter = {
  tipo?: "VISITANTE" | "CONGREGADO" | "MEMBRO_ATIVO";
  q?: string;
  page?: number;
  pageSize?: number;
  discipuladorId?: string;
  ministerioId?: string;
};

/** Resultado paginado. */
export type ListMembrosResult = {
  items: MembroSafe[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Normaliza string de busca: trim, slice 100 chars (anti-DoS).
 * NÃO remove acentos aqui — query usa `contains` do Prisma (SQLite
 * não tem unaccent nativo, mas `contains` é case-insensitive por
 * default em SQLite; lowercase resolve case, acentos ficam literais).
 */
function normalizeQ(q: string | undefined): string | undefined {
  if (!q) return undefined;
  return q.trim().slice(0, 100);
}

/**
 * Lista membros com filtros e paginação. Aplica RBAC fina:
 * se `user.cargo === "DISCIPULADOR"`, força `discipuladorId = user.id`
 * (não permite bypass via query string).
 *
 * @description SELECT via `MEMBRO_SAFE_SELECT` (LGPD AC-16).
 * @param {ListMembrosFilter} filter - Filtros da query string.
 * @param {SessionUser} user - Usuário autenticado (injetado pelo middleware).
 * @returns {Promise<ListMembrosResult>} Items, total, page, pageSize.
 * @example
 *   const { items, total, page, pageSize } = await listMembros(
 *     { tipo: "VISITANTE", q: "maria", page: 1, pageSize: 25 },
 *     user
 *   );
 */
export async function listMembros(
  filter: ListMembrosFilter,
  user: SessionUser
): Promise<ListMembrosResult> {
  const page = Math.max(1, Math.floor(filter.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(filter.pageSize ?? 25)));
  const q = normalizeQ(filter.q);
  const skip = (page - 1) * pageSize;

  // RBAC fina: DISCIPULADOR vê apenas seus discípulos (RN-MEM-01 + matriz §3)
  const where: Prisma.MembroWhereInput = {};
  if (user.cargo === "DISCIPULADOR") {
    where.discipuladorId = user.id;
  } else if (filter.discipuladorId) {
    where.discipuladorId = filter.discipuladorId;
  }
  if (filter.tipo) where.tipo = filter.tipo;
  if (q) {
    where.nome = { contains: q.toLowerCase() };
  }
  if (filter.ministerioId) {
    where.ministerios = { some: { ministerioId: filter.ministerioId } };
  }

  const [items, total] = await Promise.all([
    prisma.membro.findMany({
      where,
      select: MEMBRO_SAFE_SELECT,
      orderBy: { nome: "asc" },
      skip,
      take: pageSize,
    }),
    prisma.membro.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

/**
 * Busca membro por ID com escopo de RBAC fina.
 *
 * **DISCIPULADOR:** se o membro não tem `discipuladorId === user.id`,
 * lança `NotFoundError` (404) — não 403, para não vazar a existência
 * do recurso (RAG §3.3).
 *
 * @description SELECT via `MEMBRO_SAFE_SELECT`.
 * @param {string} id - UUID do membro.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<MembroSafe>} Membro encontrado.
 * @throws {NotFoundError} Quando não existe OU está fora de escopo.
 * @example
 *   const membro = await getMembroById(params.id, user);
 */
export async function getMembroById(
  id: string,
  user: SessionUser
): Promise<MembroSafe> {
  const membro = await prisma.membro.findUnique({
    where: { id },
    select: MEMBRO_SAFE_SELECT,
  });
  if (!membro) {
    throw new NotFoundError("Membro não encontrado.");
  }
  if (
    user.cargo === "DISCIPULADOR" &&
    membro.id !== user.id &&
    membro.discipuladorId !== user.id
  ) {
    // NÃO 403 — proteje contra enumeração (RAG §3.3)
    // Exceção: o próprio usuário pode ver seu próprio registro.
    throw new NotFoundError("Membro não encontrado.");
  }
  return membro;
}

/**
 * Cria um membro.
 *
 * **RBAC:** `assertCanWriteMembers` (camada 3) — qualquer autenticado
 * com cargo pode criar (RN-MEM-01). Lança `Response(403)` se cargo null.
 *
 * **Email duplicado:** captura `P2002` do Prisma (unique constraint em
 * `email`) e relança como `EmailDuplicadoError` semântico.
 *
 * **S04-T04 (alerta atômico):** se `tipo === "VISITANTE"`, busca a
 * config de acolhimento. Se config existe com responsável válido, cria
 * alerta notificando o(s) responsável(is). Tudo dentro de
 * `prisma.$transaction` — falha em qualquer etapa desfaz o INSERT.
 * Se não há config ou responsável, loga warning mas NÃO bloqueia a
 * criação (RN-MEM-05).
 *
 * @description INSERT em `membros` com captura de P2002 + alerta opcional.
 * @param {MembroCreateInput} input - Dados validados por `MembroCreateSchema`.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<MembroSafe>} Membro criado (com `id`).
 * @throws {Response} 403 se usuário sem cargo (assertCanWriteMembers).
 * @throws {EmailDuplicadoError} 409 se email já existe.
 * @example
 *   const novo = await createMembro({ nome: "Maria", tipo: "VISITANTE" }, user);
 */
export async function createMembro(
  input: MembroCreateInput,
  user: SessionUser
): Promise<MembroSafe> {
  assertCanWriteMembers(user);

  try {
    // S04-T04: lê a config dentro da transação para usar um snapshot consistente.
    const created = await prisma.$transaction(async (tx) => {
      const txClient = tx as typeof prisma;
      let config: {
        responsavelVisitanteTipo: string;
        responsavelMembroId?: string | null;
        responsavelMinisterioId?: string | null;
      } | null = null;
      let logConfigWarning = false;

      if (input.tipo === "VISITANTE") {
        const cfg = await txClient.configuracaoGeral.findFirst({
          where: { id: "singleton" },
        });
        if (cfg && cfg.responsavelVisitanteTipo) {
          config = {
            responsavelVisitanteTipo: cfg.responsavelVisitanteTipo,
            responsavelMembroId: cfg.responsavelMembroId,
            responsavelMinisterioId: cfg.responsavelMinisterioId,
          };
        } else {
          logConfigWarning = true;
        }
      }

      const membro = await txClient.membro.create({
        data: {
          nome: input.nome,
          tipo: input.tipo,
          email: input.email ?? null,
          telefone: input.telefone ?? null,
          profissao: input.profissao ?? null,
          estadoCivil: input.estadoCivil ?? null,
          dataConversao: input.dataConversao ?? null,
          dataBatismo: input.dataBatismo ?? null,
          logradouro: input.logradouro ?? null,
          numero: input.numero ?? null,
          bairro: input.bairro ?? null,
          cidade: input.cidade ?? null,
          estado: input.estado ?? null,
          cep: input.cep ?? null,
        },
        select: MEMBRO_SAFE_SELECT,
      });

      if (logConfigWarning) {
        safeLog({
          userId: user.id,
          action: "create_membro_sem_config",
          resource: "membro",
          result: "warning",
          timestamp: Date.now(),
        });
      }

      // Se é visitante com config válida, cria alerta atômico
      if (config) {
        const temResponsavel =
          (config.responsavelVisitanteTipo === "MEMBRO" && config.responsavelMembroId) ||
          (config.responsavelVisitanteTipo === "MINISTERIO" && config.responsavelMinisterioId);

        if (temResponsavel) {
          const alerta = await criarAlertaVisitante(txClient, membro, config);
          if (!alerta) {
            safeLog({
              userId: user.id,
              action: "create_membro_config_invalida",
              resource: "membro",
              result: "warning",
              timestamp: Date.now(),
            });
          }
        } else {
          safeLog({
            userId: user.id,
            action: "create_membro_sem_responsavel",
            resource: "membro",
            result: "warning",
            timestamp: Date.now(),
          });
        }
      }

      return membro;
    });

    return created;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new EmailDuplicadoError("Este e-mail já está cadastrado.");
    }
    throw e;
  }
}

/**
 * Atualiza um membro (parcial).
 *
 * **RBAC:** `assertCanWriteMembers` + `getMembroById` (escopo). Se
 * DISCIPULADOR tentando editar membro fora de escopo → 404.
 *
 * **Filtra campos undefined:** Prisma ignora `undefined` em `data`,
 * então spread direto funciona — mas explicitamos cada campo para
 * clareza (e para garantir que `null` apaga o campo se vier do update).
 *
 * @description UPDATE parcial com escopo.
 * @param {string} id - UUID do membro.
 * @param {MembroUpdateInput} input - Campos a atualizar.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<MembroSafe>} Membro atualizado.
 * @throws {NotFoundError} 404 se não existe ou fora de escopo.
 * @throws {Response} 403 se usuário sem cargo.
 * @example
 *   const updated = await updateMembro(id, { telefone: "11..." }, user);
 */
export async function updateMembro(
  id: string,
  input: MembroUpdateInput,
  user: SessionUser
): Promise<MembroSafe> {
  assertCanWriteMembers(user);
  // getMembroById já aplica escopo + 404 para DISCIPULADOR fora
  await getMembroById(id, user);

  const data: Prisma.MembroUpdateInput = {};
  if (input.nome !== undefined) data.nome = input.nome;
  if (input.tipo !== undefined) data.tipo = input.tipo;
  if (input.email !== undefined) data.email = input.email;
  if (input.telefone !== undefined) data.telefone = input.telefone;
  if (input.profissao !== undefined) data.profissao = input.profissao;
  if (input.estadoCivil !== undefined) data.estadoCivil = input.estadoCivil;
  if (input.dataConversao !== undefined) data.dataConversao = input.dataConversao;
  if (input.dataBatismo !== undefined) data.dataBatismo = input.dataBatismo;
  if (input.logradouro !== undefined) data.logradouro = input.logradouro;
  if (input.numero !== undefined) data.numero = input.numero;
  if (input.bairro !== undefined) data.bairro = input.bairro;
  if (input.cidade !== undefined) data.cidade = input.cidade;
  if (input.estado !== undefined) data.estado = input.estado;
  if (input.cep !== undefined) data.cep = input.cep;

  return prisma.membro.update({
    where: { id },
    data,
    select: MEMBRO_SAFE_SELECT,
  });
}

/**
 * Exclui um membro. Apenas ADMIN ou PASTOR (RN-MEM-04).
 *
 * **RN-MEM-04:** se o membro tem discípulos vinculados
 * (`discipulos.length > 0`), lança `BusinessRuleError` (409) com
 * mensagem clara. O schema.prisma tem `onDelete: Restrict` no
 * `discipuladorId`, então o Prisma já bloqueia — capturamos aqui
 * para devolver uma mensagem semântica em PT-BR.
 *
 * @description DELETE com checagem de discípulos.
 * @param {string} id - UUID do membro.
 * @param {SessionUser} user - Apenas ADMIN/PASTOR.
 * @returns {Promise<void>}
 * @throws {Response} 403 se não é ADMIN/PASTOR.
 * @throws {NotFoundError} 404 se não existe.
 * @throws {BusinessRuleError} 409 se tem discípulos vinculados.
 * @example
 *   await deleteMembro(id, adminUser);
 */
export async function deleteMembro(id: string, user: SessionUser): Promise<void> {
  if (user.cargo !== "ADMIN" && user.cargo !== "PASTOR") {
    throw new Response("Apenas ADMIN ou PASTOR podem excluir membros.", { status: 403 });
  }

  // Verifica existência + discípulos em uma query
  const existing = await prisma.membro.findUnique({
    where: { id },
    select: {
      id: true,
      _count: { select: { discipulos: true } },
    },
  });
  if (!existing) {
    throw new NotFoundError("Membro não encontrado.");
  }
  if (existing._count.discipulos > 0) {
    throw new BusinessRuleError(
      "Desvincule os discípulos antes de excluir este membro."
    );
  }

  await prisma.membro.delete({ where: { id } });
}

/**
 * Promove (ou rebaixa) o `tipo` de um membro (S03-T02, RN-MEM-06).
 *
 * **RN-MEM-06:** promoção é SEMPRE manual via este endpoint dedicado
 * — NUNCA há scanner/cron/auto-promove (verificável por
 * `grep setTimeout|setInterval|node-cron|bull app/`).
 *
 * **RBAC:** `assertCanWriteMembers` cobre qualquer autenticado com
 * cargo (RN-MEM-01). A camada 2 (rota) pode restringir se necessário.
 *
 * **Validação:** `novoTipo` é validado com Zod enum — tipo inválido
 * lança `ZodError` (que a rota converte em 422).
 *
 * **LGPD:** loga `userId, action, membroId, novoTipo, result` via
 * `safeLog` (sem PII).
 *
 * @description UPDATE em `membros.tipo` com validação Zod.
 * @param {string} id - UUID do membro.
 * @param {"VISITANTE" | "CONGREGADO" | "MEMBRO_ATIVO"} novoTipo - Novo tipo.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<MembroSafe>} Membro atualizado.
 * @throws {ZodError} Se `novoTipo` é inválido.
 * @throws {NotFoundError} 404 se não existe.
 * @throws {Response} 403 se usuário sem cargo (assertCanWriteMembers).
 * @example
 *   const updated = await promoverTipo(id, "CONGREGADO", adminUser);
 */
export async function promoverTipo(
  id: string,
  novoTipo: "VISITANTE" | "CONGREGADO" | "MEMBRO_ATIVO",
  user: SessionUser
): Promise<MembroSafe> {
  assertCanWriteMembers(user);
  // Zod enum (lança ZodError se inválido)
  const validated = TipoMembroSchema.parse(novoTipo);

  // getMembroById aplica escopo (DISCIPULADOR fora de escopo → 404)
  await getMembroById(id, user);

  const updated = await prisma.membro.update({
    where: { id },
    data: { tipo: validated },
    select: MEMBRO_SAFE_SELECT,
  });

  // Auditoria (sem PII)
  safeLog({
    userId: user.id,
    action: "promover_tipo",
    resource: "membro",
    result: "ok",
    timestamp: Date.now(),
  });

  return updated;
}

/**
 * Helper type-only exportado para permitir `import { type MembroSafe }`
 * de outros módulos sem precisar importar o `Prisma` namespace.
 * (Re-exporta o tipo do service para a UI.)
 */
export type { PrismaClient };

// -------------------- SEC-004: listarMembrosParaSelect --------------------

/**
 * @description Retorna membros ativos para uso em selects (top 50, apenas id e nome).
 *   Usado em formulários de lançamento financeiro.
 * @param {SessionUser} user - Usuário autenticado (RBAC via assertCanSeeFinancialModule).
 * @returns {Promise<Array<{id: string, nome: string}>>} Lista de membros.
 * @throws {Response} 403 se cargo não está em FINANCIAL_MODULE_CARGOS.
 */
export async function listarMembrosParaSelect(
  user: SessionUser
): Promise<Array<{ id: string; nome: string }>> {
  const { assertCanSeeFinancialModule } = await import("./rbac.server");
  assertCanSeeFinancialModule(user);

  return prisma.membro.findMany({
    where: { tipo: { in: ["MEMBRO_ATIVO", "CONGREGADO"] } },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
    take: 50,
  });
}
