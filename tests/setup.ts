/**
 * Setup global do Vitest.
 *
 * - Carrega .env.
 * - Define NODE_ENV=test (singleton do Prisma usa test.db em vez de dev.db).
 * - Cada arquivo de teste que tocar DB deve chamar setupTestDb() em
 *   beforeAll (ver tests/helpers/db.ts) para aplicar migrations.
 */
import "dotenv/config";

process.env.NODE_ENV = "test";
