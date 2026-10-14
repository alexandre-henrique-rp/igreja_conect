-- AlterTable
ALTER TABLE "itens_estoque" ADD COLUMN "categoria" TEXT;
ALTER TABLE "itens_estoque" ADD COLUMN "dataAquisicao" DATETIME;
ALTER TABLE "itens_estoque" ADD COLUMN "fimGarantia" DATETIME;
ALTER TABLE "itens_estoque" ADD COLUMN "notaFiscal" TEXT;
ALTER TABLE "itens_estoque" ADD COLUMN "responsavelPatrimonio" TEXT;
ALTER TABLE "itens_estoque" ADD COLUMN "valorAquisicaoCentavos" INTEGER;
ALTER TABLE "itens_estoque" ADD COLUMN "vidaUtilAnos" INTEGER;

-- AlterTable
ALTER TABLE "escalas" ADD COLUMN "horaFim" TEXT;
ALTER TABLE "escalas" ADD COLUMN "horaInicio" TEXT;
ALTER TABLE "escalas" ADD COLUMN "local" TEXT;

-- CreateTable
CREATE TABLE "registros_acolhimento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "membroId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "prazo" DATETIME,
    "concluido" BOOLEAN NOT NULL DEFAULT false,
    "autorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "registros_acolhimento_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "registros_acolhimento_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "membros" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "dataPrimeiraVisita" DATETIME,
    "origemVisita" TEXT,
    "preferenciaContato" TEXT,
    "observacoesVisita" TEXT,
    "responsavelAcolhimentoId" TEXT,
    "consentimentoContatoEm" DATETIME,
    "isDiscipulador" BOOLEAN NOT NULL DEFAULT false,
    "discipuladorId" TEXT,
    "avatarUploadId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "membros_responsavelAcolhimentoId_fkey" FOREIGN KEY ("responsavelAcolhimentoId") REFERENCES "membros" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "membros_discipuladorId_fkey" FOREIGN KEY ("discipuladorId") REFERENCES "membros" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "membros_avatarUploadId_fkey" FOREIGN KEY ("avatarUploadId") REFERENCES "uploads" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_membros" ("avatarUploadId", "bairro", "cargo", "cep", "cidade", "complemento", "createdAt", "dataBatismo", "dataConversao", "dataNascimento", "discipuladorId", "discipuladorNome", "email", "estado", "estadoCivil", "grupo", "id", "isDiscipulador", "logradouro", "nome", "numero", "profissao", "senhaHash", "sexo", "status", "telefone", "tipo", "updatedAt") SELECT "avatarUploadId", "bairro", "cargo", "cep", "cidade", "complemento", "createdAt", "dataBatismo", "dataConversao", "dataNascimento", "discipuladorId", "discipuladorNome", "email", "estado", "estadoCivil", "grupo", "id", "isDiscipulador", "logradouro", "nome", "numero", "profissao", "senhaHash", "sexo", "status", "telefone", "tipo", "updatedAt" FROM "membros";
DROP TABLE "membros";
ALTER TABLE "new_membros" RENAME TO "membros";
CREATE UNIQUE INDEX "membros_email_key" ON "membros"("email");
CREATE TABLE "new_celulas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "liderId" TEXT,
    "endereco" TEXT,
    "diaSemana" TEXT,
    "horario" TEXT,
    "regiao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVA',
    "capacidade" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "celulas_liderId_fkey" FOREIGN KEY ("liderId") REFERENCES "membros" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_celulas" ("createdAt", "descricao", "diaSemana", "endereco", "horario", "id", "liderId", "nome", "updatedAt") SELECT "createdAt", "descricao", "diaSemana", "endereco", "horario", "id", "liderId", "nome", "updatedAt" FROM "celulas";
DROP TABLE "celulas";
ALTER TABLE "new_celulas" RENAME TO "celulas";
CREATE UNIQUE INDEX "celulas_nome_key" ON "celulas"("nome");
CREATE UNIQUE INDEX "celulas_liderId_key" ON "celulas"("liderId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "registros_acolhimento_membroId_createdAt_idx" ON "registros_acolhimento"("membroId", "createdAt");

