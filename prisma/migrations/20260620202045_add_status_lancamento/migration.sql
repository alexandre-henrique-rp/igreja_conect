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
CREATE TABLE "new_configuracoes_gerais" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "responsavelVisitanteTipo" TEXT NOT NULL,
    "responsavelMembroId" TEXT,
    "responsavelMinisterioId" TEXT,
    CONSTRAINT "configuracoes_gerais_responsavelMembroId_fkey" FOREIGN KEY ("responsavelMembroId") REFERENCES "membros" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "configuracoes_gerais_responsavelMinisterioId_fkey" FOREIGN KEY ("responsavelMinisterioId") REFERENCES "ministerios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_configuracoes_gerais" ("id", "responsavelMembroId", "responsavelMinisterioId", "responsavelVisitanteTipo") SELECT "id", "responsavelMembroId", "responsavelMinisterioId", "responsavelVisitanteTipo" FROM "configuracoes_gerais";
DROP TABLE "configuracoes_gerais";
ALTER TABLE "new_configuracoes_gerais" RENAME TO "configuracoes_gerais";
CREATE TABLE "new_lancamentos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "valorCentavos" INTEGER NOT NULL,
    "descricao" TEXT,
    "dataCompetencia" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caixaId" TEXT NOT NULL,
    "membroId" TEXT,
    "transferenciaGrupoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "lancamentos_caixaId_fkey" FOREIGN KEY ("caixaId") REFERENCES "caixas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "lancamentos_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_lancamentos" ("caixaId", "categoria", "createdAt", "dataCompetencia", "descricao", "id", "membroId", "tipo", "transferenciaGrupoId", "updatedAt", "valorCentavos") SELECT "caixaId", "categoria", "createdAt", "dataCompetencia", "descricao", "id", "membroId", "tipo", "transferenciaGrupoId", "updatedAt", "valorCentavos" FROM "lancamentos";
DROP TABLE "lancamentos";
ALTER TABLE "new_lancamentos" RENAME TO "lancamentos";
CREATE INDEX "lancamentos_transferenciaGrupoId_idx" ON "lancamentos"("transferenciaGrupoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- RedefineIndex
DROP INDEX "transferencias_caixa_idempotencyKey_idx";
CREATE UNIQUE INDEX "transferencias_caixa_idempotencyKey_key" ON "transferencias_caixa"("idempotencyKey");
