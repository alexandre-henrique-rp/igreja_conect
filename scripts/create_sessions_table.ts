import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });

const prisma = new PrismaClient({ adapter });

async function main() {
  // Criar a tabela sessions manualmente
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "sessions" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "membroId" TEXT NOT NULL,
      "expiresAt" DATETIME NOT NULL,
      "absoluteExpiresAt" DATETIME NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "sessions_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `;

  // Criar índices
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "sessions_membroId_idx" ON "sessions"("membroId")
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "sessions_expiresAt_idx" ON "sessions"("expiresAt")
  `;

  console.log("Tabela sessions criada com sucesso!");
}

main()
  .catch((e) => {
    console.error("Erro:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
