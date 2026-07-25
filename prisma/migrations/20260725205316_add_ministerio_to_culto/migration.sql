-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_cultos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'PRESENCIAL',
    "status" TEXT NOT NULL DEFAULT 'AGENDADO',
    "data" DATETIME NOT NULL,
    "horario" TEXT NOT NULL,
    "local" TEXT,
    "preletor" TEXT,
    "createdById" TEXT,
    "ministerioId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "cultos_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "membros" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cultos_ministerioId_fkey" FOREIGN KEY ("ministerioId") REFERENCES "ministerios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_cultos" ("createdAt", "createdById", "data", "descricao", "horario", "id", "local", "preletor", "status", "tipo", "titulo", "updatedAt") SELECT "createdAt", "createdById", "data", "descricao", "horario", "id", "local", "preletor", "status", "tipo", "titulo", "updatedAt" FROM "cultos";
DROP TABLE "cultos";
ALTER TABLE "new_cultos" RENAME TO "cultos";
CREATE INDEX "cultos_ministerioId_idx" ON "cultos"("ministerioId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
