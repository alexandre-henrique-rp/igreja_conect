import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const now = new Date();

  const result = await prisma.session.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: now } }, { absoluteExpiresAt: { lt: now } }],
    },
  });

  console.log(`Sessões expiradas removidas: ${result.count}`);
}

main()
  .catch((e) => {
    console.error("Erro ao limpar sessões:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
