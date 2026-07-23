-- CreateTable
CREATE TABLE "requisicoes_compra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemEstoqueId" TEXT,
    "nomeItem" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "justificativa" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SOLICITADA',
    "valorCentavos" INTEGER,
    "observacao" TEXT,
    "solicitadoPorId" TEXT NOT NULL,
    "aprovadoPorId" TEXT,
    "compradoPorId" TEXT,
    "lancamentoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "requisicoes_compra_itemEstoqueId_fkey" FOREIGN KEY ("itemEstoqueId") REFERENCES "itens_estoque" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "requisicoes_compra_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "membros" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "requisicoes_compra_aprovadoPorId_fkey" FOREIGN KEY ("aprovadoPorId") REFERENCES "membros" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "requisicoes_compra_compradoPorId_fkey" FOREIGN KEY ("compradoPorId") REFERENCES "membros" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "requisicoes_compra_status_idx" ON "requisicoes_compra"("status");

-- CreateIndex
CREATE INDEX "requisicoes_compra_solicitadoPorId_idx" ON "requisicoes_compra"("solicitadoPorId");
