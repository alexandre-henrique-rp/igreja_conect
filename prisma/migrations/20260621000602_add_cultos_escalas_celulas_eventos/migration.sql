-- CreateTable
CREATE TABLE "cultos" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "cultos_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "membros" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "escalas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ministerioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "data" DATETIME NOT NULL,
    "observacao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "escalas_ministerioId_fkey" FOREIGN KEY ("ministerioId") REFERENCES "ministerios" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "escalas_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "membros" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "escala_voluntarios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "escalaId" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "funcao" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMADO',
    "observacao" TEXT,
    CONSTRAINT "escala_voluntarios_escalaId_fkey" FOREIGN KEY ("escalaId") REFERENCES "escalas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "escala_voluntarios_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "celulas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "liderId" TEXT,
    "endereco" TEXT,
    "diaSemana" TEXT,
    "horario" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "celulas_liderId_fkey" FOREIGN KEY ("liderId") REFERENCES "membros" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "membro_celulas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "celulaId" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    CONSTRAINT "membro_celulas_celulaId_fkey" FOREIGN KEY ("celulaId") REFERENCES "celulas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "membro_celulas_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "eventos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'ESPECIAL',
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "dataInicio" DATETIME NOT NULL,
    "dataFim" DATETIME,
    "local" TEXT,
    "responsavelId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "eventos_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "membros" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "eventos_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "membros" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_itens_estoque" ("createdAt", "descricao", "id", "localizacaoFisica", "nome", "numeroSerie", "quantidade", "statusPatrimonio", "tipo", "updatedAt") SELECT "createdAt", "descricao", "id", "localizacaoFisica", "nome", "numeroSerie", "quantidade", "statusPatrimonio", "tipo", "updatedAt" FROM "itens_estoque";
DROP TABLE "itens_estoque";
ALTER TABLE "new_itens_estoque" RENAME TO "itens_estoque";
CREATE UNIQUE INDEX "itens_estoque_numeroSerie_key" ON "itens_estoque"("numeroSerie");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "escalas_ministerioId_idx" ON "escalas"("ministerioId");

-- CreateIndex
CREATE UNIQUE INDEX "escala_voluntarios_escalaId_membroId_funcao_key" ON "escala_voluntarios"("escalaId", "membroId", "funcao");

-- CreateIndex
CREATE UNIQUE INDEX "celulas_nome_key" ON "celulas"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "celulas_liderId_key" ON "celulas"("liderId");

-- CreateIndex
CREATE UNIQUE INDEX "membro_celulas_membroId_celulaId_key" ON "membro_celulas"("membroId", "celulaId");
