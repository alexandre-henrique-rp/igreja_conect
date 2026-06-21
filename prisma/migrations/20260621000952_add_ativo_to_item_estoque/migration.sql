-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_itens_estoque" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'CONSUMO',
    "quantidade" INTEGER NOT NULL DEFAULT 0,
    "quantidadeMinima" INTEGER NOT NULL DEFAULT 5,
    "numeroSerie" TEXT,
    "statusPatrimonio" TEXT DEFAULT 'DISPONIVEL',
    "localizacaoFisica" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_itens_estoque" ("createdAt", "descricao", "id", "localizacaoFisica", "nome", "numeroSerie", "quantidade", "quantidadeMinima", "statusPatrimonio", "tipo", "updatedAt") SELECT "createdAt", "descricao", "id", "localizacaoFisica", "nome", "numeroSerie", "quantidade", "quantidadeMinima", "statusPatrimonio", "tipo", "updatedAt" FROM "itens_estoque";
DROP TABLE "itens_estoque";
ALTER TABLE "new_itens_estoque" RENAME TO "itens_estoque";
CREATE UNIQUE INDEX "itens_estoque_numeroSerie_key" ON "itens_estoque"("numeroSerie");
CREATE INDEX "itens_estoque_tipo_ativo_idx" ON "itens_estoque"("tipo", "ativo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
