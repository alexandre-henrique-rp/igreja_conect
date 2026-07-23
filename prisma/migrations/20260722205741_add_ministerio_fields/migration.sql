-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ministerios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "corDestaque" TEXT,
    "liderNome" TEXT,
    "capacidadeMaxima" INTEGER,
    "diasEncontro" TEXT,
    "horarioPadrao" TEXT,
    "turnoPrincipal" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ministerios" ("createdAt", "descricao", "id", "nome", "updatedAt") SELECT "createdAt", "descricao", "id", "nome", "updatedAt" FROM "ministerios";
DROP TABLE "ministerios";
ALTER TABLE "new_ministerios" RENAME TO "ministerios";
CREATE UNIQUE INDEX "ministerios_nome_key" ON "ministerios"("nome");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
