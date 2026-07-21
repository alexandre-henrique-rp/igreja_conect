/*
  Warnings:

  - You are about to drop the `upload_audit_log` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "upload_audit_log_event_createdAt_idx";

-- DropIndex
DROP INDEX "upload_audit_log_uploadId_idx";

-- AlterTable
ALTER TABLE "manutencoes_ativo" ADD COLUMN "motivo" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "upload_audit_log";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "membroId" TEXT,
    "event" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "details" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_log_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "attachmentUploadId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "lancamentos_caixaId_fkey" FOREIGN KEY ("caixaId") REFERENCES "caixas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "lancamentos_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "lancamentos_attachmentUploadId_fkey" FOREIGN KEY ("attachmentUploadId") REFERENCES "uploads" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_lancamentos" ("attachmentUploadId", "caixaId", "categoria", "createdAt", "dataCompetencia", "descricao", "id", "membroId", "status", "tipo", "transferenciaGrupoId", "updatedAt", "valorCentavos") SELECT "attachmentUploadId", "caixaId", "categoria", "createdAt", "dataCompetencia", "descricao", "id", "membroId", "status", "tipo", "transferenciaGrupoId", "updatedAt", "valorCentavos" FROM "lancamentos";
DROP TABLE "lancamentos";
ALTER TABLE "new_lancamentos" RENAME TO "lancamentos";
CREATE INDEX "lancamentos_transferenciaGrupoId_idx" ON "lancamentos"("transferenciaGrupoId");
CREATE TABLE "new_membros" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'VISITANTE',
    "cargo" TEXT,
    "email" TEXT,
    "senhaHash" TEXT,
    "telefone" TEXT,
    "profissao" TEXT,
    "estadoCivil" TEXT,
    "dataConversao" DATETIME,
    "dataBatismo" DATETIME,
    "dataNascimento" DATETIME,
    "sexo" TEXT,
    "status" TEXT,
    "grupo" TEXT,
    "discipuladorNome" TEXT,
    "complemento" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "cep" TEXT,
    "isDiscipulador" BOOLEAN NOT NULL DEFAULT false,
    "discipuladorId" TEXT,
    "avatarUploadId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "membros_discipuladorId_fkey" FOREIGN KEY ("discipuladorId") REFERENCES "membros" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "membros_avatarUploadId_fkey" FOREIGN KEY ("avatarUploadId") REFERENCES "uploads" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_membros" ("avatarUploadId", "bairro", "cargo", "cep", "cidade", "complemento", "createdAt", "dataBatismo", "dataConversao", "dataNascimento", "discipuladorId", "discipuladorNome", "email", "estado", "estadoCivil", "grupo", "id", "logradouro", "nome", "numero", "profissao", "senhaHash", "sexo", "status", "telefone", "tipo", "updatedAt") SELECT "avatarUploadId", "bairro", "cargo", "cep", "cidade", "complemento", "createdAt", "dataBatismo", "dataConversao", "dataNascimento", "discipuladorId", "discipuladorNome", "email", "estado", "estadoCivil", "grupo", "id", "logradouro", "nome", "numero", "profissao", "senhaHash", "sexo", "status", "telefone", "tipo", "updatedAt" FROM "membros";
DROP TABLE "membros";
ALTER TABLE "new_membros" RENAME TO "membros";
CREATE UNIQUE INDEX "membros_email_key" ON "membros"("email");
CREATE TABLE "new_ministerio_membros" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "membroId" TEXT NOT NULL,
    "ministerioId" TEXT NOT NULL,
    "lider" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ministerio_membros_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ministerio_membros_ministerioId_fkey" FOREIGN KEY ("ministerioId") REFERENCES "ministerios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ministerio_membros" ("id", "membroId", "ministerioId") SELECT "id", "membroId", "ministerioId" FROM "ministerio_membros";
DROP TABLE "ministerio_membros";
ALTER TABLE "new_ministerio_membros" RENAME TO "ministerio_membros";
CREATE UNIQUE INDEX "ministerio_membros_membroId_ministerioId_key" ON "ministerio_membros"("membroId", "ministerioId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "audit_log_membroId_idx" ON "audit_log"("membroId");

-- CreateIndex
CREATE INDEX "audit_log_event_createdAt_idx" ON "audit_log"("event", "createdAt");

-- CreateIndex
CREATE INDEX "uploads_sha256_kind_idx" ON "uploads"("sha256", "kind");
