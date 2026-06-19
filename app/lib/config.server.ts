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

/**
 * Busca a configuração de acolhimento atual.
 *
 * @description SELECT na tabela `config_acolhimento` onde id='singleton'.
 * @returns {Promise<Prisma.ConfigAcolhimentoGetPayload<{ include: { responsavelMembro: true; responsavelMinisterio: true } }> | null>}
 *   Configuração encontrada ou null se não existir.
 * @example
 *   const config = await getConfigAcolhimento();
 *   if (config) { /* usa config.responsavelMembroId *\/ }
 */
export async function getConfigAcolhimento() {
  const config = await prisma.configuracaoGeral.findFirst({
    where: { id: "singleton" },
    include: {
      responsavelMembro: true,
      responsavelMinisterio: true,
    },
  });
  return config;
}

/**
 * Atualiza (ou cria) a configuração singleton de acolhimento.
 *
 * Apenas ADMIN (assertIsAdmin). Valida input com ConfigAcolhimentoSchema.
 * Aplica exclusividade: se tipo=MEMBRO, seta responsavelMembroId e zera
 * responsavelMinisterioId. Vice-versa.
 *
 * @description UPSERT em `config_acolhimento` com id='singleton'.
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

  // Usar Unchecked*Input para poder passar as scalar FK diretamente
  // (ConfigAcolhimentoUpdateInput só aceita relation objects).
  const data: Prisma.ConfiguracaoGeralUncheckedUpdateInput = {
    responsavelVisitanteTipo: validated.responsavelVisitanteTipo ?? null,
  };

  // Exclusividade: seta um campo, zera o outro
  if (validated.responsavelVisitanteTipo === "MEMBRO") {
    data.responsavelMembroId = validated.responsavelId;
    data.responsavelMinisterioId = null;
  } else {
    data.responsavelMinisterioId = validated.responsavelId;
    data.responsavelMembroId = null;
  }

  const config = await prisma.configuracaoGeral.upsert({
    where: { id: "singleton" },
    update: data,
    create: {
      id: "singleton",
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
