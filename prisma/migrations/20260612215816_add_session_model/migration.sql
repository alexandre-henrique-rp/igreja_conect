-- CreateTable
CREATE TABLE "membros" (
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
    "logradouro" TEXT,
    "numero" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "cep" TEXT,
    "discipuladorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "membros_discipuladorId_fkey" FOREIGN KEY ("discipuladorId") REFERENCES "membros" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "membroId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "absoluteExpiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "sessions_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ministerios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ministerio_membros" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "membroId" TEXT NOT NULL,
    "ministerioId" TEXT NOT NULL,
    CONSTRAINT "ministerio_membros_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ministerio_membros_ministerioId_fkey" FOREIGN KEY ("ministerioId") REFERENCES "ministerios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "caixas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "saldoCentavos" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "transferencias_caixa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "valorCentavos" INTEGER NOT NULL,
    "caixaOrigemId" TEXT NOT NULL,
    "caixaDestinoId" TEXT NOT NULL,
    "executadoPorId" TEXT NOT NULL,
    "dataHora" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transferencias_caixa_caixaOrigemId_fkey" FOREIGN KEY ("caixaOrigemId") REFERENCES "caixas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transferencias_caixa_caixaDestinoId_fkey" FOREIGN KEY ("caixaDestinoId") REFERENCES "caixas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transferencias_caixa_executadoPorId_fkey" FOREIGN KEY ("executadoPorId") REFERENCES "membros" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lancamentos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "dataCompetencia" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caixaId" TEXT NOT NULL,
    "membroId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "lancamentos_caixaId_fkey" FOREIGN KEY ("caixaId") REFERENCES "caixas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "lancamentos_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "itens_estoque" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'CONSUMO',
    "quantidade" INTEGER NOT NULL DEFAULT 0,
    "numeroSerie" TEXT,
    "statusPatrimonio" TEXT DEFAULT 'DISPONIVEL',
    "localizacaoFisica" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "movimentacoes_estoque" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemEstoqueId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "justificativa" TEXT,
    "autorizadoPorId" TEXT NOT NULL,
    "nomeRetirante" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "movimentacoes_estoque_itemEstoqueId_fkey" FOREIGN KEY ("itemEstoqueId") REFERENCES "itens_estoque" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "movimentacoes_estoque_autorizadoPorId_fkey" FOREIGN KEY ("autorizadoPorId") REFERENCES "membros" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "manutencoes_ativo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemEstoqueId" TEXT NOT NULL,
    "assistenciaTecnica" TEXT NOT NULL,
    "enderecoAssistencia" TEXT NOT NULL,
    "numeroOs" TEXT,
    "dataEnvio" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prazoTermino" DATETIME,
    "dataRetorno" DATETIME,
    "foiPerdaTotal" BOOLEAN NOT NULL DEFAULT false,
    "urlLaudoTecnico" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "manutencoes_ativo_itemEstoqueId_fkey" FOREIGN KEY ("itemEstoqueId") REFERENCES "itens_estoque" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "alertas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "resolvido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "alerta_destinatarios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alertaId" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "lido" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "alerta_destinatarios_alertaId_fkey" FOREIGN KEY ("alertaId") REFERENCES "alertas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "alerta_destinatarios_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "configuracoes_gerais" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "responsavelVisitanteTipo" TEXT NOT NULL,
    "responsavelMembroId" TEXT,
    "responsavelMinisterioId" TEXT,
    CONSTRAINT "configuracoes_gerais_responsavelMinisterioId_fkey" FOREIGN KEY ("responsavelMinisterioId") REFERENCES "ministerios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "membros_email_key" ON "membros"("email");

-- CreateIndex
CREATE INDEX "sessions_membroId_idx" ON "sessions"("membroId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ministerios_nome_key" ON "ministerios"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "ministerio_membros_membroId_ministerioId_key" ON "ministerio_membros"("membroId", "ministerioId");

-- CreateIndex
CREATE UNIQUE INDEX "caixas_nome_key" ON "caixas"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "itens_estoque_numeroSerie_key" ON "itens_estoque"("numeroSerie");

-- CreateIndex
CREATE UNIQUE INDEX "alerta_destinatarios_alertaId_membroId_key" ON "alerta_destinatarios"("alertaId", "membroId");
