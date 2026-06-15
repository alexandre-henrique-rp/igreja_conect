/*
  Warnings:

  - Added the required column `updatedAt` to the `alertas` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "config_acolhimento" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "responsavelVisitanteTipo" TEXT,
    "responsavelMembroId" TEXT,
    "responsavelMinisterioId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "config_acolhimento_responsavelMembroId_fkey" FOREIGN KEY ("responsavelMembroId") REFERENCES "membros" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "config_acolhimento_responsavelMinisterioId_fkey" FOREIGN KEY ("responsavelMinisterioId") REFERENCES "ministerios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_alertas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "membroId" TEXT,
    "lido" BOOLEAN NOT NULL DEFAULT false,
    "resolvido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "alertas_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_alertas" ("createdAt", "id", "mensagem", "resolvido", "titulo") SELECT "createdAt", "id", "mensagem", "resolvido", "titulo" FROM "alertas";
DROP TABLE "alertas";
ALTER TABLE "new_alertas" RENAME TO "alertas";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
