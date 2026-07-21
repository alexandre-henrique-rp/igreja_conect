-- Adiciona campos pessoais ao membro (wire-up dos _dummy placeholders do form).
-- Todos nullable para não quebrar dados existentes (sem backfill necessário).
-- `discipuladorNome` (não `discipulador`) para evitar colisão com a relation FK existente.
ALTER TABLE "membros" ADD COLUMN "dataNascimento" DATETIME;
ALTER TABLE "membros" ADD COLUMN "sexo" TEXT;
ALTER TABLE "membros" ADD COLUMN "status" TEXT;
ALTER TABLE "membros" ADD COLUMN "grupo" TEXT;
-- discipuladorNome adicionado na migration 20260720220100_add_discipulador_nome
ALTER TABLE "membros" ADD COLUMN "complemento" TEXT;
