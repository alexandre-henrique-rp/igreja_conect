import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const now = new Date().toISOString();

  // Remove sessões cujo expiresAt ou absoluteExpiresAt já passou
  const result = await prisma.$executeRaw`
    DELETE FROM "sessions"
    WHERE "expiresAt" < ${now} OR "absoluteExpiresAt" < ${now}
  `;

  console.log(`Sessões expiradas removidas. Linhas afetadas: ${result}`);
}

main()
  .catch((e) => {
    console.error("Erro ao limpar sessões:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
