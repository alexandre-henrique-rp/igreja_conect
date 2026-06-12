/**
 * Seed idempotente — Igreja Conect (S00-T13).
 *
 * Cria o ADMIN inicial (`admin@igreja.local` / `admin123`). Pode ser
 * rodado múltiplas vezes: na 2ª execução detecta via `findUnique` e
 * imprime "ADMIN já existe" sem duplicar.
 *
 * **ATENÇÃO:** a senha `admin123` é APENAS para o ambiente de
 * desenvolvimento. Trocar imediatamente em produção.
 */
import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const ADMIN_EMAIL = "admin@igreja.local";
const ADMIN_PASSWORD = "admin123"; // TROCAR EM PRODUÇÃO
const BCRYPT_COST = 10;

/**
 * Cria o ADMIN inicial. Idempotente.
 *
 * @description Singleton lazy do Prisma dentro do seed — instancia o
 *   client na hora da chamada (não no import) para que `DATABASE_URL`
 *   já esteja definido pelo chamador.
 */
export async function runSeed(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: process.env.DATABASE_URL ?? "file:./dev.db",
    }),
  });
  try {
    const existente = await prisma.membro.findUnique({ where: { email: ADMIN_EMAIL } });
    if (existente) {
      console.log(`[seed] ADMIN já existe (${ADMIN_EMAIL}). Seed idempotente OK.`);
      return;
    }

    const senhaHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_COST);

    const admin = await prisma.membro.create({
      data: {
        nome: "Administrador",
        email: ADMIN_EMAIL,
        senhaHash,
        tipo: "MEMBRO_ATIVO",
        cargo: "ADMIN",
      },
    });

    console.log(`[seed] ADMIN criado: ${admin.email} (id: ${admin.id})`);
    console.log(`[seed] Senha inicial: "${ADMIN_PASSWORD}" — TROCAR EM PRODUÇÃO.`);
  } finally {
    await prisma.$disconnect();
  }
}

// Executa ao rodar `tsx prisma/seed.ts` (não em test).
if (process.env.NODE_ENV !== "test" && import.meta.url === `file://${process.argv[1]}`) {
  runSeed().catch((e) => {
    console.error("[seed] Erro:", e);
    process.exit(1);
  });
}
