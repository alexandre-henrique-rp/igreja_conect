import { PrismaClient } from "../../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Side-effect: garante que o worker de storage (processa uploads async)
// está rodando. Idempotente — chama uma vez por processo (globalThis flag).
// Carregado aqui porque `prisma.server.ts` é importado por TODA rota
// server-side, então o worker inicia no primeiro request.
import "./../lib/storage/startup.server";

/**
 * Singleton do Prisma Client (S00-T01).
 *
 * Reaproveita a instância entre HMR via `globalThis.__prisma` em dev
 * (não em prod). Sufixo `.server.ts` impede bundling no cliente.
 *
 * IMPORTANTE: a URL é lida na primeira importação. Se `process.env.DATABASE_URL`
 * mudar depois (caso de testes), o helper `tests/helpers/db.ts` reseta
 * `globalThis.__prisma` para forçar recriação.
 *
 * @see .harness/RAG/convention-prisma-sqlite.md §2.2
 */
const KEY = "__prisma" as const;
const globalForPrisma = globalThis as unknown as { [KEY]?: PrismaClient };

const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

export const prisma: PrismaClient =
  globalForPrisma[KEY] ??
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: databaseUrl }),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma[KEY] = prisma;
}
