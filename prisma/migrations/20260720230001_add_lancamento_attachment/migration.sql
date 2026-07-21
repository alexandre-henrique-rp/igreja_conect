-- Adiciona anexo (comprovante) 1:1 em Lancamento.
-- Upload.contextType='lancamento.comprovante', contextId=<lancamentoId>.
ALTER TABLE "lancamentos" ADD COLUMN "attachmentUploadId" TEXT;
CREATE INDEX "lancamentos_attachmentUploadId_idx" ON "lancamentos"("attachmentUploadId");
