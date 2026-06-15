-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_caixas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "saldoCentavos" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_caixas" ("createdAt", "id", "nome", "saldoCentavos", "updatedAt") SELECT "createdAt", "id", "nome", "saldoCentavos", "updatedAt" FROM "caixas";
DROP TABLE "caixas";
ALTER TABLE "new_caixas" RENAME TO "caixas";
CREATE UNIQUE INDEX "caixas_nome_key" ON "caixas"("nome");
CREATE INDEX "caixas_ativo_idx" ON "caixas"("ativo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
