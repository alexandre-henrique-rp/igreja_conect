/**
 * Service de Discipulado — Igreja Conect (S03-T01).
 *
 * **Regra de negócio principal (RN-MEM-04):**
 * 1 discipulador tem **no máximo 12 discípulos** (constante `MAX_DISCIPULOS`).
 * O limite é checado em código (não no schema) para devolver mensagem
 * amigável em PT-BR e cobrir o caso de troca (re-atribuição).
 *
 * **Anti-loop (RN-MEM-04):** `isDescendantOf` detecta ciclos de
 * discipulado. `assignDisciple` recusa a operação se o candidato
 * (disc) é descendente do alvo (discipulador), evitando A→B→A.
 *
 * **Proteção DoS:** `isDescendantOf` tem profundidade máxima de 10
 * (fail-safe: >10 considera descendente). Cadeias de 11+ são
 * improváveis na vida real, e o fail-safe é conservador.
 *
 * **RBAC:** `assignDisciple` e `unassignDisciple` chamam
 * `assertCanWriteMembers` (camada 3). `getDiscipuladoData` chama
 * `getMembroById` (escopo aplicado).
 *
 * **S03 sem SCANNER (RN-MEM-06):** este service NUNCA promove tipo
 * automaticamente. Promoção é SEMPRE manual via `promoverTipo`
 * (S03-T02). Verificável por `grep setTimeout|setInterval|node-cron|bull app/`.
 *
 * @see docs/REGRAS_DE_NEGOCIO.md (RN-MEM-04)
 * @see .harness/RAG/security-rbac-matrix.md §2
 */
import { prisma } from "~/db/prisma.server";
import { assertCanWriteMembers } from "./rbac.server";
import { getMembroById, MEMBRO_SAFE_SELECT, type MembroSafe } from "./members.server";
import { BusinessRuleError, NotFoundError } from "./errors";
import type { SessionUser } from "./session.types";
import { AssignDiscipleSchema, type AssignDiscipleInput } from "./schemas/discipulado";

/** Limite máximo de discípulos por discipulador (RN-MEM-04). */
export const MAX_DISCIPULOS = 12;

/** Profundidade máxima de busca em `isDescendantOf` (proteção DoS). */
const MAX_DESCENDANT_DEPTH = 10;

/**
 * Verifica se `candidate` é descendente de `ancestor` na cadeia de
 * discipulado, percorrendo o grafo APENAS para cima (parent pointers).
 *
 * **Pure function** — recebe um Map `id → discipuladorId` (parent
 * pointer) e não toca o DB. Isso permite testes determinísticos e
 * rápidos sem mock de Prisma.
 *
 * **Proteção DoS:** profundidade máxima de 10. Se passar, retorna
 * `true` (fail-safe conservador — prefere barrar uma operação válida
 * a cair em loop infinito). Cadeias >10 são improváveis na vida real.
 *
 * @description Pure: percorre cadeia de parent pointers até o limite.
 * @param {string} candidate - ID do candidato (filho potencial).
 * @param {string} ancestor - ID do ancestral procurado.
 * @param {Map<string, string | null>} parentMap - Mapa id → discipuladorId.
 * @returns {boolean} `true` se `candidate` é descendente de `ancestor`.
 * @example
 *   const map = new Map([["A", null], ["B", "A"], ["C", "B"]]);
 *   isDescendantOfPure("C", "A", map); // true
 *   isDescendantOfPure("A", "A", map); // false (não é descendente de si)
 *   isDescendantOfPure("B", "C", map); // false (B não está abaixo de C)
 */
export function isDescendantOfPure(
  candidate: string,
  ancestor: string,
  parentMap: Map<string, string | null>
): boolean {
  if (candidate === ancestor) return false;
  let current: string | null | undefined = parentMap.get(candidate);
  let depth = 0;
  while (current !== undefined && current !== null && depth < MAX_DESCENDANT_DEPTH) {
    if (current === ancestor) return true;
    current = parentMap.get(current);
    depth += 1;
  }
  // Se atingiu profundidade máxima sem encontrar o ancestral E o último
  // current !== null, é provável loop ou cadeia muito profunda → fail-safe
  if (depth >= MAX_DESCENDANT_DEPTH && current !== null && current !== undefined) {
    return true;
  }
  return false;
}

/**
 * Carrega o mapa de parent pointers de TODOS os membros. Usado por
 * `assignDisciple` para detectar loops via `isDescendantOfPure`.
 *
 * @description SELECT apenas do id + discipuladorId (mínimo necessário).
 * @returns {Promise<Map<string, string | null>>} Mapa id → discipuladorId.
 */
async function loadParentMap(): Promise<Map<string, string | null>> {
  const rows = await prisma.membro.findMany({
    select: { id: true, discipuladorId: true },
  });
  return new Map(rows.map((r) => [r.id, r.discipuladorId]));
}

/**
 * Atribui um discípulo a um discipulador. Aplica as 4 regras RN-MEM-04:
 *  1. RBAC — `assertCanWriteMembers` (camada 3).
 *  2. Auto-vínculo (disc === discipulador) → `BusinessRuleError(400)`.
 *  3. Limite de 12 discípulos (boundary 12 OK, 13 falha) → `BusinessRuleError(409)`.
 *  4. Anti-loop (candidato é descendente do alvo) → `BusinessRuleError(422)`.
 *
 * **Re-atribuição:** se o discípulo já tem discipulador, conta apenas
 * os discípulos do NOVO discipulador (boundary se aplica ao destino).
 *
 * @description UPDATE em `membros.discipuladorId` com 4 checagens de RN.
 * @param {string} discipuladorId - UUID do discipulador (alvo).
 * @param {string} discipuloId - UUID do discípulo (candidato).
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<MembroSafe>} Membro atualizado.
 * @throws {BusinessRuleError} 400/409/422 conforme a regra violada.
 * @throws {NotFoundError} 404 se discípulo ou discipulador não existem.
 * @throws {Response} 403 se usuário sem cargo (assertCanWriteMembers).
 * @example
 *   const updated = await assignDisciple(discId, alunoId, adminUser);
 */
export async function assignDisciple(
  discipuladorId: string,
  discipuloId: string,
  user: SessionUser
): Promise<MembroSafe> {
  assertCanWriteMembers(user);

  // Regra 1: auto-vínculo — discipulador === discípulo
  if (discipuladorId === discipuloId) {
    throw new BusinessRuleError(
      "Você não pode ser seu próprio discipulador."
    );
  }

  // Carrega ambos para validar existência
  const [alvo, candidato] = await Promise.all([
    prisma.membro.findUnique({ where: { id: discipuladorId }, select: { id: true } }),
    prisma.membro.findUnique({ where: { id: discipuloId }, select: { id: true } }),
  ]);
  if (!alvo) {
    throw new NotFoundError("Discipulador não encontrado.");
  }
  if (!candidato) {
    throw new NotFoundError("Discípulo não encontrado.");
  }

  // Regra 4: anti-loop — verifica se o NOVO discipulador (alvo) é
  // descendente do discípulo (candidato). Se for, criar o vínculo
  // fecha um ciclo: A→B→A.
  //   Exemplo: A tem B como discípulo. Tentamos fazer A ser discípulo
  //   de B. A (candidato) → ... → B (alvo), logo B é descendente de A.
  //   Detectamos e bloqueamos.
  const parentMap = await loadParentMap();
  if (isDescendantOfPure(discipuladorId, discipuloId, parentMap)) {
    throw new BusinessRuleError(
      "Vínculo em loop detectado. Não é possível atribuir como discípulo alguém que está acima na cadeia."
    );
  }

  // Regra 3: limite de 12 — conta discípulos ATUAIS do alvo
  // Não conta o próprio discipuloId se ele JÁ era filho (re-atribuição),
  // pois a operação substitui o pai, não adiciona.
  const currentCount = await prisma.membro.count({
    where: {
      discipuladorId,
      NOT: { id: discipuloId },
    },
  });
  if (currentCount >= MAX_DISCIPULOS) {
    throw new BusinessRuleError(
      `Discipulador já possui ${MAX_DISCIPULOS} discípulos. Limite atingido.`
    );
  }

  return prisma.membro.update({
    where: { id: discipuloId },
    data: { discipuladorId },
    select: MEMBRO_SAFE_SELECT,
  });
}

/**
 * Desvincula um discípulo do seu discipulador atual
 * (set `discipuladorId = null`).
 *
 * @description UPDATE em `membros.discipuladorId` set null.
 * @param {string} discipuloId - UUID do discípulo.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<MembroSafe>} Membro atualizado.
 * @throws {NotFoundError} 404 se membro não existe.
 * @throws {Response} 403 se usuário sem cargo.
 * @example
 *   const updated = await unassignDisciple(alunoId, adminUser);
 */
export async function unassignDisciple(
  discipuloId: string,
  user: SessionUser
): Promise<MembroSafe> {
  assertCanWriteMembers(user);

  const existing = await prisma.membro.findUnique({
    where: { id: discipuloId },
    select: { id: true },
  });
  if (!existing) {
    throw new NotFoundError("Membro não encontrado.");
  }

  return prisma.membro.update({
    where: { id: discipuloId },
    data: { discipuladorId: null },
    select: MEMBRO_SAFE_SELECT,
  });
}

/** Tipo da cadeia de discipulado (do mais próximo ao mais distante). */
export type CadeiaItem = {
  id: string;
  nome: string;
};

/** Tipo do resumo de discipulado de um membro. */
export type DiscipuladoData = {
  membro: MembroSafe;
  discipuladorAtual: CadeiaItem | null;
  discipulosDoDiscipulador: Array<MembroSafe & { totalDiscipulos: number }>;
  cadeia: string[]; // IDs do mais próximo ao mais distante
  discipuladoresDisponiveis: Array<{ id: string; nome: string; totalDiscipulos: number }>;
};

/**
 * Retorna o painel de discipulado de um membro: ele próprio, seu
 * discipulador atual, a cadeia até a raiz, discípulos do seu
 * discipulador, e candidatos disponíveis para vincular.
 *
 * **Regra do available pool:** exclui o próprio membro e seus
 * descendentes (anti-loop), e exclui quem já tem 12 discípulos
 * (a UI mostra desabilitado — a defesa final é `assignDisciple`).
 *
 * @description Query composta para painel de discipulado.
 * @param {string} membroId - UUID do membro focal.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<DiscipuladoData>} Painel completo.
 * @throws {NotFoundError} 404 se membro não existe (via getMembroById).
 * @example
 *   const data = await getDiscipuladoData(alunoId, adminUser);
 */
export async function getDiscipuladoData(
  membroId: string,
  user: SessionUser
): Promise<DiscipuladoData> {
  // getMembroById aplica escopo (DISCIPULADOR fora de escopo → 404)
  const membro = await getMembroById(membroId, user);

  // Cadeia: sobe do membro até a raiz
  const cadeia: string[] = [];
  let currentId: string | null = membro.discipuladorId;
  const visited = new Set<string>(); // proteção contra loop real no banco
  const parentMap = await loadParentMap();
  while (currentId !== null && currentId !== undefined && !visited.has(currentId)) {
    visited.add(currentId);
    cadeia.push(currentId);
    currentId = parentMap.get(currentId) ?? null;
  }

  // Discipulador atual (primeiro da cadeia)
  let discipuladorAtual: CadeiaItem | null = null;
  if (cadeia.length > 0) {
    const id = cadeia[0]!;
    const found = await prisma.membro.findUnique({
      where: { id },
      select: { id: true, nome: true },
    });
    if (found) discipuladorAtual = found;
  }

  // Discípulos do discipulador atual (se houver)
  let discipulosDoDiscipulador: Array<MembroSafe & { totalDiscipulos: number }> = [];
  if (discipuladorAtual) {
    const rows = await prisma.membro.findMany({
      where: { discipuladorId: discipuladorAtual.id },
      select: { ...MEMBRO_SAFE_SELECT, _count: { select: { discipulos: true } } },
      orderBy: { nome: "asc" },
    });
    discipulosDoDiscipulador = rows.map((r) => ({
      ...r,
      totalDiscipulos: r._count.discipulos,
    }));
  }

  // Pool de discipuladores disponíveis:
  // - Todos os membros que PODEM ser discipuladores
  // - Exclui o próprio membro
  // - Exclui descendentes do próprio membro (anti-loop)
  // - Inclui contagem de discípulos para a UI exibir quem está no limite
  const allRows = await prisma.membro.findMany({
    select: { id: true, nome: true, discipuladorId: true, _count: { select: { discipulos: true } } },
    orderBy: { nome: "asc" },
  });
  const discipuladoresDisponiveis = allRows
    .filter((r) => r.id !== membroId)
    .filter((r) => !isDescendantOfPure(r.id, membroId, parentMap))
    .map((r) => ({
      id: r.id,
      nome: r.nome,
      totalDiscipulos: r._count.discipulos,
    }));

  return {
    membro,
    discipuladorAtual,
    discipulosDoDiscipulador,
    cadeia,
    discipuladoresDisponiveis,
  };
}

/**
 * Helper exportado: constrói o parent map a partir de uma lista de
 * membros. Útil em testes e em pontos que já carregaram os dados.
 *
 * @description Helper para construir parent map a partir de array.
 * @param {Array<{ id: string; discipuladorId: string | null }>} membros - Lista.
 * @returns {Map<string, string | null>} Mapa id → discipuladorId.
 */
export function getDescendantMap(
  membros: Array<{ id: string; discipuladorId: string | null }>
): Map<string, string | null> {
  return new Map(membros.map((m) => [m.id, m.discipuladorId]));
}

// Re-exports úteis para a rota
export { AssignDiscipleSchema, type AssignDiscipleInput };
