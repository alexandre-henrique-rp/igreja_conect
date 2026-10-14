import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const u = await prisma.membro.findUnique({
    where: { email: "admin@igreja.local" },
    select: { id: true, email: true, cargo: true, status: true, tipo: true },
  });
  console.log(JSON.stringify(u, null, 2));
}

main().finally(() => prisma.$disconnect());