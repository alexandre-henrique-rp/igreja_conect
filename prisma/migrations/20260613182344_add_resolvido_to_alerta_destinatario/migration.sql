-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_alerta_destinatarios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alertaId" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "lido" BOOLEAN NOT NULL DEFAULT false,
    "resolvido" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "alerta_destinatarios_alertaId_fkey" FOREIGN KEY ("alertaId") REFERENCES "alertas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "alerta_destinatarios_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_alerta_destinatarios" ("alertaId", "id", "lido", "membroId") SELECT "alertaId", "id", "lido", "membroId" FROM "alerta_destinatarios";
DROP TABLE "alerta_destinatarios";
ALTER TABLE "new_alerta_destinatarios" RENAME TO "alerta_destinatarios";
CREATE UNIQUE INDEX "alerta_destinatarios_alertaId_membroId_key" ON "alerta_destinatarios"("alertaId", "membroId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
