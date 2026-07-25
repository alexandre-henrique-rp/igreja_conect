-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_escalas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ministerioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "data" DATETIME NOT NULL,
    "observacao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "geradaAutomaticamente" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "cultoId" TEXT,
    "eventoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "escalas_ministerioId_fkey" FOREIGN KEY ("ministerioId") REFERENCES "ministerios" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "escalas_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "membros" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "escalas_cultoId_fkey" FOREIGN KEY ("cultoId") REFERENCES "cultos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "escalas_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "eventos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_escalas" ("createdAt", "createdById", "data", "geradaAutomaticamente", "id", "ministerioId", "observacao", "status", "titulo", "updatedAt") SELECT "createdAt", "createdById", "data", "geradaAutomaticamente", "id", "ministerioId", "observacao", "status", "titulo", "updatedAt" FROM "escalas";
DROP TABLE "escalas";
ALTER TABLE "new_escalas" RENAME TO "escalas";
CREATE INDEX "escalas_ministerioId_idx" ON "escalas"("ministerioId");
CREATE INDEX "escalas_cultoId_idx" ON "escalas"("cultoId");
CREATE INDEX "escalas_eventoId_idx" ON "escalas"("eventoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
