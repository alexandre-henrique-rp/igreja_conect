-- Add idempotencyKey column to TransferenciaCaixa (SEC-S07-003)
-- Prevents double-submit / race condition in transferências
ALTER TABLE "transferencias_caixa" ADD COLUMN "idempotencyKey" TEXT;

-- Add unique constraint to prevent duplicate processing
CREATE UNIQUE INDEX "transferencias_caixa_idempotencyKey_idx"
  ON "transferencias_caixa"("idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;

-- Add descricao column (was declared in schema but never migrated)
ALTER TABLE "transferencias_caixa" ADD COLUMN "descricao" TEXT;
