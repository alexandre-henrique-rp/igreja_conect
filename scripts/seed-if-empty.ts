import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { runSeed } from "../prisma/seed";

const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const count = await prisma.membro.count();

  if (count === 0) {
    console.log("[seed-if-empty] Banco vazio. Executando seed...");
    await runSeed();
  } else {
    console.log(`[seed-if-empty] Banco já possui ${count} membros. Pulando seed.`);
  }
}

main()
  .catch((e) => {
    console.error("[seed-if-empty] Erro:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
