/**
 * Helper de DB em arquivo temporário para testes de integração.
 *
 * Cada arquivo de teste chama `setupTestDb()` em beforeAll — isso:
 *  1. Cria o diretório `tests/.tmp/`
 *  2. Aplica migrations do prisma em DB de teste (arquivo)
 *  3. Limpa o cache do singleton (globalThis.prisma) para que o próximo
 *     import de `~/db/prisma.server` recrie o client com a URL de teste
 *  4. Retorna cleanup que desconecta e apaga o arquivo
 */
import { execSync } from "node:child_process";
import { unlinkSync, mkdirSync, existsSync } from "node:fs";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const TEST_DB_DIR = "tests/.tmp";
const TEST_DB_PATH = `${TEST_DB_DIR}/test.db`;

let _client: PrismaClient | null = null;

function getClient(): PrismaClient {
  if (_client) return _client;
  _client = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: `file:${TEST_DB_PATH}` }),
  });
  return _client;
}

/** Client de Prisma lazy — só instancia após setupTestDb() rodar. */
export const prismaTest: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const c = getClient() as unknown as Record<string | symbol, unknown>;
    const value = c[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(c) : value;
  },
});

/** Apaga dados de todas as tabelas. Barato. */
export async function resetTestDb(): Promise<void> {
  const tables = [
    "sessions",
    "alerta_destinatarios",
    "alertas",
    "ministerio_membros",
    "ministerios",
    "movimentacoes_estoque",
    "manutencoes_ativo",
    "itens_estoque",
    "transferencias_caixa",
    "lancamentos",
    "caixas",
    "config_acolhimento",
    "membros",
  ];
  for (const t of tables) {
    await getClient().$executeRawUnsafe(`DELETE FROM ${t}`);
  }
}

/**
 * Aplica migrations no DB de teste e retorna cleanup. Use em beforeAll.
 *
 * Reset do singleton é crítico: o `globalThis.prisma` é cacheado
 * em `app/db/prisma.server.ts`. Se ele foi criado durante o import
 * do teste (com DATABASE_URL=file:./dev.db), vai apontar para o
 * banco errado. Limpamos o cache para que o próximo import crie
 * um client novo com a URL de teste.
 */
export async function setupTestDb(): Promise<() => Promise<void>> {
  mkdirSync(TEST_DB_DIR, { recursive: true });
  if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);

  const testUrl = `file:${TEST_DB_PATH}`;
  process.env.DATABASE_URL = testUrl;

  execSync("pnpm prisma db push --force-reset", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: testUrl },
  });

  // Limpa cache do singleton (caso já tenha sido importado com dev.db)
  const g = globalThis as unknown as { prisma?: PrismaClient; __prisma?: PrismaClient };
  if (g.prisma) {
    await g.prisma.$disconnect().catch(() => {});
    g.prisma = undefined;
  }
  if (g.__prisma) {
    await g.__prisma.$disconnect().catch(() => {});
    g.__prisma = undefined;
  }
  if (_client) {
    await _client.$disconnect().catch(() => {});
    _client = null;
  }

  return async () => {
    if (g.prisma) {
      await g.prisma.$disconnect().catch(() => {});
      g.prisma = undefined;
    }
    if (g.__prisma) {
      await g.__prisma.$disconnect().catch(() => {});
      g.__prisma = undefined;
    }
    if (_client) {
      await _client.$disconnect().catch(() => {});
      _client = null;
    }
    try { unlinkSync(TEST_DB_PATH); } catch {}
  };
}

/**
 * Reseta cache de módulos do Vitest e importa `session.server` apontando
 * para o DB de teste. Use em beforeAll de testes de lib que importam
 * o singleton `~/db/prisma.server`.
 */
export async function importSessionLib(): Promise<typeof import("../../app/lib/session.server")> {
  // Reset garante que `~/db/prisma.server` reimporte com o DATABASE_URL
  // atual (definido em setupTestDb), criando PrismaClient com a URL de teste.
  // Nota: o chamador precisa ter importado `vi` de "vitest" para usar
  // esta função. Esta função apenas encapsula o padrão.
  return await import("../../app/lib/session.server");
}
