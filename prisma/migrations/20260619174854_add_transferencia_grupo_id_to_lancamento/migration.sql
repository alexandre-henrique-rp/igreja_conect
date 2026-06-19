/*
  Warnings:

  - You are about to drop the `config_acolhimento` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `resolvido` on the `alerta_destinatarios` table. All the data in the column will be lost.
  - You are about to drop the column `lido` on the `alertas` table. All the data in the column will be lost.
  - You are about to drop the column `membroId` on the `alertas` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `alertas` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "lancamentos" ADD COLUMN "transferenciaGrupoId" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "config_acolhimento";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_alerta_destinatarios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alertaId" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "lido" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "alerta_destinatarios_alertaId_fkey" FOREIGN KEY ("alertaId") REFERENCES "alertas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "alerta_destinatarios_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_alerta_destinatarios" ("alertaId", "id", "lido", "membroId") SELECT "alertaId", "id", "lido", "membroId" FROM "alerta_destinatarios";
DROP TABLE "alerta_destinatarios";
ALTER TABLE "new_alerta_destinatarios" RENAME TO "alerta_destinatarios";
CREATE UNIQUE INDEX "alerta_destinatarios_alertaId_membroId_key" ON "alerta_destinatarios"("alertaId", "membroId");
CREATE TABLE "new_alertas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "resolvido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_alertas" ("createdAt", "id", "mensagem", "resolvido", "titulo") SELECT "createdAt", "id", "mensagem", "resolvido", "titulo" FROM "alertas";
DROP TABLE "alertas";
ALTER TABLE "new_alertas" RENAME TO "alertas";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "lancamentos_transferenciaGrupoId_idx" ON "lancamentos"("transferenciaGrupoId");
