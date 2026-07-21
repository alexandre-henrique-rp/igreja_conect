-- Adiciona coluna `discipuladorNome` (separada da relation `discipulador`
-- que é FK no Prisma). Migração separada porque o nome anterior `discipulador`
-- colidia com o campo de relation e foi ignorado pelo Prisma.
ALTER TABLE "membros" ADD COLUMN "discipuladorNome" TEXT;
