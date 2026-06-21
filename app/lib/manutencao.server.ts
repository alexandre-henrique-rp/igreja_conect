/**
 * Service de Manutenção de Ativos Patrimoniais (S11-T04).
 *
 * **enviarParaManutencao:** Fluxo completo de envio de item patrimoniado
 *   para assistência técnica, com validação em 3 camadas (RBAC + Zod +
 *   regras de negócio) e transação atômica.
 *
 * Pipeline:
 * 1. Camada 3 RBAC — `assertCanSendToMaintenance(user)` (3 perfis)
 * 2. Zod — `ManutencaoCreateSchema.parse(input)`
 * 3. `findUniqueOrThrow` — busca item no banco
 * 4. `assertItemIsPatrimonio` — 400 se CONSUMO
 * 5. `assertTransicaoPatrimonioValida` — 409 se status inválido
 * 6. `$transaction` atômica — cria ManutencaoAtivo + atualiza status
 * 7. Log de auditoria via `safeLog`
 *
 * @see docs/REGRAS_DE_NEGOCIO.md (RN-EST-03, RN-EST-04)
 */
import { prisma } from "~/db/prisma.server";
import { safeLog } from "./audit.server";
import { assertCanBaixarPerda, assertCanSendToMaintenance } from "./rbac.server";
import { BaixaPerdaSchema, ManutencaoCreateSchema } from "./schemas/estoque";
import {
  assertItemIsPatrimonio,
  assertTransicaoPatrimonioValida,
} from "./patrimonio.server";
import type { SessionUser } from "./session.server";

/**
 * Envia um item patrimoniado para manutenção externa.
 *
 * **Pipeline de validação (defense in depth):**
 * 1. Camada 3 RBAC: `assertCanSendToMaintenance(user)` — 3 perfis.
 * 2. Zod: `ManutencaoCreateSchema.parse(input)` — valida estrutura.
 * 3. Busca o item no banco (`findUniqueOrThrow`).
 * 4. `assertItemIsPatrimonio(item)` — 400 se CONSUMO.
 * 5. `assertTransicaoPatrimonioValida(item.statusPatrimonio, 'EM_MANUTENCAO', ...)`.
 * 6. `$transaction` atômica:
 *    a. Cria registro em `ManutencaoAtivo`.
 *    b. Atualiza `statusPatrimonio` para `EM_MANUTENCAO`.
 * 7. Log de auditoria.
 *
 * @param {any & { itemId: string }} input - Dados da manutenção + ID do item.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<any>} Registro de manutenção criado.
 * @throws {Response} 403 se sem permissão (RBAC).
 * @throws {ZodError} 422 se input inválido (Zod).
 * @throws {Response} 404 se item não encontrado.
 * @throws {Response} 400 se item não é patrimônio.
 * @throws {Response} 409 se transição de status inválida.
 * @example
 *   const manutencao = await enviarParaManutencao(
 *     {
 *       itemId: "uuid-do-item",
 *       assistenciaTecnica: "Tech Assist Ltda",
 *       enderecoAssistencia: "Rua X, 123",
 *     },
 *     user
 *   );
 *   // manutencao.id // "uuid-da-manutencao"
 */
export async function enviarParaManutencao(
  input: any & { itemId: string },
  user: SessionUser
): Promise<any> {
  // 1. Camada 3 RBAC
  assertCanSendToMaintenance(user);

  // 2. Zod — parse valida e transforma (throws se inválido)
  const parsed = ManutencaoCreateSchema.parse(input);

  // 3. Busca item (404 se não existir)
  const item = await prisma.itemEstoque.findUniqueOrThrow({
    where: { id: input.itemId },
    select: { id: true, tipo: true, statusPatrimonio: true, ativo: true },
  });

  // 4. Assert PATRIMONIO (400 se CONSUMO)
  assertItemIsPatrimonio(item);

  // 5. Assert transição de status (409 se inválida)
  assertTransicaoPatrimonioValida(
    item.statusPatrimonio!,
    "EM_MANUTENCAO",
    "enviarParaManutencao"
  );

  // 6. Transação atômica
  const manutencao = await prisma.$transaction(async (tx) => {
    const created = await tx.manutencaoAtivo.create({
      data: {
        itemEstoqueId: input.itemId,
        assistenciaTecnica: parsed.assistenciaTecnica,
        enderecoAssistencia: parsed.enderecoAssistencia,
        numeroOs: parsed.numeroOs ?? null,
        prazoTermino: parsed.prazoTermino
          ? new Date(parsed.prazoTermino)
          : null,

      },
    });

    await tx.itemEstoque.update({
      where: { id: input.itemId },
      data: { statusPatrimonio: "EM_MANUTENCAO" },
    });

    return created;
  });

  // 7. Log de auditoria
  safeLog({
    userId: user.id,
    action: "enviar_para_manutencao",
    resource: `manutencao:${manutencao.id}`,
    result: "success",
  });

  return manutencao;
}

/**
 * Retorna um item da manutenção externa, reativando seu status patrimonial
 * para **DISPONIVEL**.
 *
 * **Pipeline de validação (defense in depth):**
 * 1. Camada 3 RBAC: `assertCanSendToMaintenance(user)` — 3 perfis.
 * 2. Busca o registro de manutenção (`findUniqueOrThrow`).
 * 3. Se `dataRetorno` já preenchida → 409 (manutenção já finalizada).
 * 4. `assertTransicaoPatrimonioValida(statusAtual, 'DISPONIVEL', ...)`.
 * 5. `$transaction` atômica:
 *    a. Preenche `dataRetorno` em `ManutencaoAtivo`.
 *    b. Atualiza `statusPatrimonio` para `DISPONIVEL`.
 * 6. Log de auditoria.
 *
 * @param {string} manutencaoId - ID do registro de manutenção.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<any>} Registro de manutenção atualizado.
 * @throws {Response} 403 se sem permissão (RBAC).
 * @throws {Response} 404 se manutenção não encontrada.
 * @throws {Response} 409 se manutenção já retornada.
 * @throws {Response} 409 se transição de status inválida.
 * @example
 *   const manutencao = await retornarDeManutencao(
 *     "uuid-da-manutencao",
 *     user
 *   );
 *   // manutencao.dataRetorno // Date
 */
export async function retornarDeManutencao(
  manutencaoId: string,
  user: SessionUser
): Promise<any> {
  // 1. Camada 3 RBAC
  assertCanSendToMaintenance(user);

  // 2. Busca manutenção (404 se não existir)
  const manutencao = await prisma.manutencaoAtivo.findUniqueOrThrow({
    where: { id: manutencaoId },
    select: {
      id: true,
      itemEstoqueId: true,
      dataEnvio: true,
      dataRetorno: true,
    },
    include: {
      itemEstoque: {
        select: { id: true, statusPatrimonio: true },
      },
    },
  });

  // 3. Assert manutenção ainda não retornada (409 se já finalizada)
  if (manutencao.dataRetorno !== null) {
    throw new Response(
      `Manutenção já foi retornada em ${manutencao.dataRetorno.toISOString()}.`,
      { status: 409 }
    );
  }

  // 4. Assert transição de status (409 se inválida)
  assertTransicaoPatrimonioValida(
    manutencao.itemEstoque.statusPatrimonio,
    "DISPONIVEL",
    "retornarDeManutencao"
  );

  // 5. Transação atômica
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.manutencaoAtivo.update({
      where: { id: manutencaoId },
      data: { dataRetorno: new Date() },
    });

    await tx.itemEstoque.update({
      where: { id: manutencao.itemEstoqueId },
      data: { statusPatrimonio: "DISPONIVEL" },
    });

    return result;
  });

  // 6. Log de auditoria
  safeLog({
    action: "retornar_manutencao",
    resource: `item_estoque:${manutencao.itemEstoqueId}+manutencao:${manutencaoId}`,
    userId: user.id,
    result: "ok",
  });

  // 7. Retorna registro atualizado
  return updated;
}

/**
 * Realiza a baixa de um item patrimoniado por perda total (RN-EST-05).
 *
 * **Pipeline de validação (defense in depth):**
 * 1. Camada 3 RBAC: `assertCanBaixarPerda(user)` — APENAS ADMIN.
 * 2. Zod: `BaixaPerdaSchema.parse(input)` — valida `motivo` (10–500 chars).
 * 3. Busca o item no banco (`findUniqueOrThrow`).
 * 4. `assertItemIsPatrimonio(item)` — 400 se CONSUMO.
 * 5. `assertTransicaoPatrimonioValida(item, 'BAIXADO_PERDA', ...)`.
 * 6. `$transaction` atômica com 2 casos:
 *    a. **DISPONIVEL** — cria ManutencaoAtivo com `foiPerdaTotal` + baixa item.
 *    b. **EM_MANUTENCAO** — atualiza ManutencaoAtivo existente + baixa item.
 * 7. Log de auditoria (sem `motivo` — LGPD).
 *
 * @param {string} itemId - ID do item patrimoniado.
 * @param {{ motivo: string }} input - Dados da baixa (apenas motivo).
 * @param {SessionUser} user - Usuário autenticado (ADMIN).
 * @returns {Promise<{ manutencao: any; item: any }>} Manutenção e item atualizados.
 * @throws {Response} 403 se sem permissão (RBAC).
 * @throws {ZodError} 422 se input inválido (Zod).
 * @throws {Response} 404 se item não encontrado.
 * @throws {Response} 400 se item não é patrimônio.
 * @throws {Response} 409 se transição de status inválida.
 * @example
 *   const { manutencao, item } = await baixaPorPerda(
 *     "uuid-do-item",
 *     { motivo: "Item danificado em incêndio no galpão X." },
 *     user
 *   );
 *   // manutencao.foiPerdaTotal === true
 *   // item.statusPatrimonio === "BAIXADO_PERDA"
 */
export async function baixaPorPerda(
  itemId: string,
  input: { motivo: string },
  user: SessionUser
): Promise<{ manutencao: any; item: any }> {
  // 1. Camada 3 RBAC — APENAS ADMIN
  assertCanBaixarPerda(user);

  // 2. Zod
  const parsed = BaixaPerdaSchema.parse(input);

  // 3. Busca item (404 se não existir)
  const item = await prisma.itemEstoque.findUniqueOrThrow({
    where: { id: itemId },
    select: { id: true, tipo: true, statusPatrimonio: true, ativo: true },
  });

  // 4. Assert PATRIMONIO (400 se CONSUMO)
  assertItemIsPatrimonio(item);

  // 5. Assert transição de status (409 se inválida)
  assertTransicaoPatrimonioValida(
    item.statusPatrimonio!,
    "BAIXADO_PERDA",
    "baixaPorPerda"
  );

  // 6. Transação atômica — 2 casos
  const { manutencao, item: updatedItem } = await prisma.$transaction(
    async (tx) => {
      const manutencaoExistente = await tx.manutencaoAtivo.findFirst({
        where: { itemEstoqueId: itemId, dataRetorno: null },
      });

      if (manutencaoExistente) {
        // Caso 2 — EM_MANUTENCAO: atualiza registro existente
        const m = await tx.manutencaoAtivo.update({
          where: { id: manutencaoExistente.id },
          data: {
            foiPerdaTotal: true,
            dataRetorno: new Date(),
            motivo: parsed.motivo,
          },
        });

        const i = await tx.itemEstoque.update({
          where: { id: itemId },
          data: { statusPatrimonio: "BAIXADO_PERDA", ativo: false },
        });

        return { manutencao: m, item: i };
      }

      // Caso 1 — DISPONIVEL (sem manutenção prévia)
      const m = await tx.manutencaoAtivo.create({
        data: {
          itemEstoqueId: itemId,
          foiPerdaTotal: true,
          dataEnvio: new Date(),
          dataRetorno: new Date(),
          assistenciaTecnica: "N/A — baixa direta",
          enderecoAssistencia: "N/A — baixa direta",
          motivo: parsed.motivo,
        },
      });

      const i = await tx.itemEstoque.update({
        where: { id: itemId },
        data: { statusPatrimonio: "BAIXADO_PERDA", ativo: false },
      });

      return { manutencao: m, item: i };
    }
  );

  // 7. Log de auditoria (sem motivo — LGPD)
  safeLog({
    action: "baixa_perda",
    resource: `item_estoque:${itemId}+manutencao:${manutencao.id}`,
    userId: user.id,
    result: "ok",
  });

  return { manutencao, item: updatedItem };
}
