/**
 * Service de Configuração de Acolhimento — Igreja Conect (S04-T02).
 *
 * Gerencia a configuração singleton de acolhimento de visitantes
 * (responsável por receber alertas de novos visitantes).
 *
 * **RN-MEM-05:** Apenas ADMIN pode configurar.
 * **Exclusividade:** quando tipo=MEMBRO, seta `responsavelMembroId` e
 * zera `responsavelMinisterioId`. Vice-versa.
 *
 * @see app/lib/schemas/config.ts (ConfigAcolhimentoSchema)
 */
import { prisma } from "~/db/prisma.server";
import { assertIsAdmin } from "./rbac.server";
import { ConfigAcolhimentoSchema } from "./schemas/config";
import { safeLog } from "./audit.server";
import type { SessionUser } from "./session.types";
import type { ConfigAcolhimentoInput } from "./schemas/config";
import type { Prisma } from "../../generated/prisma/client";

const CONFIG_ACOLHIMENTO_ID = "singleton";

/**
 * Busca a configuração de acolhimento atual.
 *
 * @description SELECT na primeira linha de `configuracoes_gerais`.
 * @returns {Promise<Prisma.ConfiguracaoGeralGetPayload<{ include: { responsavelMembro: true; responsavelMinisterio: true } }> | null>}
 *   Configuração encontrada ou null se não existir.
 * @example
 *   const config = await getConfigAcolhimento();
 */
export async function getConfigAcolhimento() {
  return prisma.configuracaoGeral.findFirst({
    include: {
      responsavelMembro: true,
      responsavelMinisterio: true,
    },
  });
}

/**
 * Atualiza (ou cria) a configuração singleton de acolhimento.
 *
 * Apenas ADMIN (assertIsAdmin). Valida input com ConfigAcolhimentoSchema.
 * Aplica exclusividade: se tipo=MEMBRO, seta responsavelMembroId e zera
 * responsavelMinisterioId. Vice-versa.
 *
 * @description UPSERT lógico em `configuracoes_gerais`.
 * @param {ConfigAcolhimentoInput} input - Dados validados (tipo + id do responsável).
 * @param {SessionUser} user - Usuário autenticado (ADMIN).
 * @returns {Promise<object>} Configuração atualizada.
 * @throws {Response} 403 se não é ADMIN.
 * @throws {ZodError} Se input inválido.
 * @example
 *   const config = await updateConfigAcolhimento(
 *     { responsavelVisitanteTipo: "MEMBRO", responsavelId: membroId },
 *     adminUser
 *   );
 */
export async function updateConfigAcolhimento(
  input: ConfigAcolhimentoInput,
  user: SessionUser
) {
  assertIsAdmin(user);
  const validated = ConfigAcolhimentoSchema.parse(input);

  const data: Prisma.ConfiguracaoGeralUncheckedUpdateInput = {
    responsavelVisitanteTipo: validated.responsavelVisitanteTipo ?? null,
  };

  if (validated.responsavelVisitanteTipo === "MEMBRO") {
    data.responsavelMembroId = validated.responsavelId;
    data.responsavelMinisterioId = null;
  } else {
    data.responsavelMinisterioId = validated.responsavelId;
    data.responsavelMembroId = null;
  }

  const existing = await getConfigAcolhimento();
  const config = existing
    ? await prisma.configuracaoGeral.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.configuracaoGeral.create({
        data: {
          id: CONFIG_ACOLHIMENTO_ID,
          ...data,
        } as Prisma.ConfiguracaoGeralUncheckedCreateInput,
      });

  safeLog({
    userId: user.id,
    action: "update_config",
    result: "ok",
    timestamp: Date.now(),
  });

  return config;
}
