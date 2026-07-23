-- CreateTable
CREATE TABLE "funcoes_ministerio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ministerioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT,
    CONSTRAINT "funcoes_ministerio_ministerioId_fkey" FOREIGN KEY ("ministerioId") REFERENCES "ministerios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "atividades_ministerio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ministerioId" TEXT NOT NULL,
    "membroId" TEXT,
    "tipo" TEXT NOT NULL,
    "data" DATETIME NOT NULL,
    "horario" TEXT NOT NULL,
    "descricao" TEXT,
    "criadoPorId" TEXT,
    CONSTRAINT "atividades_ministerio_ministerioId_fkey" FOREIGN KEY ("ministerioId") REFERENCES "ministerios" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "atividades_ministerio_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "atividades_ministerio_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "membros" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "indisponibilidades_membro" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ministerioId" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "dataInicio" DATETIME NOT NULL,
    "dataFim" DATETIME NOT NULL,
    "motivo" TEXT,
    CONSTRAINT "indisponibilidades_membro_ministerioId_fkey" FOREIGN KEY ("ministerioId") REFERENCES "ministerios" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "indisponibilidades_membro_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_escala_voluntarios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "escalaId" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "funcao" TEXT NOT NULL,
    "funcaoId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMADO',
    "observacao" TEXT,
    CONSTRAINT "escala_voluntarios_escalaId_fkey" FOREIGN KEY ("escalaId") REFERENCES "escalas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "escala_voluntarios_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "escala_voluntarios_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "funcoes_ministerio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_escala_voluntarios" ("escalaId", "funcao", "id", "membroId", "observacao", "status") SELECT "escalaId", "funcao", "id", "membroId", "observacao", "status" FROM "escala_voluntarios";
DROP TABLE "escala_voluntarios";
ALTER TABLE "new_escala_voluntarios" RENAME TO "escala_voluntarios";
CREATE UNIQUE INDEX "escala_voluntarios_escalaId_membroId_funcao_key" ON "escala_voluntarios"("escalaId", "membroId", "funcao");
CREATE TABLE "new_escalas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ministerioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "data" DATETIME NOT NULL,
    "observacao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "geradaAutomaticamente" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "escalas_ministerioId_fkey" FOREIGN KEY ("ministerioId") REFERENCES "ministerios" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "escalas_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "membros" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_escalas" ("createdAt", "createdById", "data", "id", "ministerioId", "observacao", "status", "titulo", "updatedAt") SELECT "createdAt", "createdById", "data", "id", "ministerioId", "observacao", "status", "titulo", "updatedAt" FROM "escalas";
DROP TABLE "escalas";
ALTER TABLE "new_escalas" RENAME TO "escalas";
CREATE INDEX "escalas_ministerioId_idx" ON "escalas"("ministerioId");
CREATE TABLE "new_ministerio_membros" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "membroId" TEXT NOT NULL,
    "ministerioId" TEXT NOT NULL,
    "lider" BOOLEAN NOT NULL DEFAULT false,
    "funcaoId" TEXT,
    CONSTRAINT "ministerio_membros_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "funcoes_ministerio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ministerio_membros_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ministerio_membros_ministerioId_fkey" FOREIGN KEY ("ministerioId") REFERENCES "ministerios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ministerio_membros" ("id", "lider", "membroId", "ministerioId") SELECT "id", "lider", "membroId", "ministerioId" FROM "ministerio_membros";
DROP TABLE "ministerio_membros";
ALTER TABLE "new_ministerio_membros" RENAME TO "ministerio_membros";
CREATE UNIQUE INDEX "ministerio_membros_membroId_ministerioId_key" ON "ministerio_membros"("membroId", "ministerioId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "funcoes_ministerio_ministerioId_nome_key" ON "funcoes_ministerio"("ministerioId", "nome");

-- CreateIndex
CREATE INDEX "atividades_ministerio_ministerioId_data_idx" ON "atividades_ministerio"("ministerioId", "data");

-- CreateIndex
CREATE INDEX "indisponibilidades_membro_ministerioId_membroId_dataInicio_idx" ON "indisponibilidades_membro"("ministerioId", "membroId", "dataInicio");
