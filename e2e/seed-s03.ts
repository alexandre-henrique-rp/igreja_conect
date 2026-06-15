/**
 * Seed complementar para E2E S03 — cria SECRETARIO, PASTOR, FINANCEIRO + membro alvo.
 *
 * **Idempotente:** usa `findUnique` para não duplicar.
 * **Uso:** `tsx e2e/seed-s03.ts` (executado inline pelo beforeAll).
 *
 * @see e2e/fidelidade-bypass.spec.ts (dependente)
 */
import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const BCRYPT_COST = 10;

async function run() {
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: process.env.DATABASE_URL ?? "file:./dev.db",
    }),
  });

  try {
    const users = [
      {
        email: "secretario+e2e@igreja.local",
        nome: "Secretario E2E",
        senha: "sec12345",
        cargo: "SECRETARIO" as const,
      },
      {
        email: "pastor+e2e@igreja.local",
        nome: "Pastor E2E",
        senha: "pastor123",
        cargo: "PASTOR" as const,
      },
      {
        email: "financeiro+e2e@igreja.local",
        nome: "Financeiro E2E",
        senha: "fin12345",
        cargo: "FINANCEIRO" as const,
      },
      {
        email: "membro+alvo+fidelidade@igreja.local",
        nome: "Membro Alvo Fidelidade",
        senha: "", // sem senha = sem login
        cargo: null,
      },
    ];

    for (const u of users) {
      const existing = await prisma.membro.findUnique({ where: { email: u.email } });
      if (existing) {
        console.log(`[seed-e2e] SKIP ${u.email} — já existe (id=${existing.id})`);
        continue;
      }

      const senhaHash = u.senha ? await bcrypt.hash(u.senha, BCRYPT_COST) : undefined;

      const created = await prisma.membro.create({
        data: {
          nome: u.nome,
          email: u.email,
          senhaHash: senhaHash ?? null,
          tipo: "MEMBRO_ATIVO",
          cargo: u.cargo ?? undefined,
        },
      });
      console.log(`[seed-e2e] CRIADO ${u.email} (id=${created.id})`);
    }

    console.log("[seed-e2e] Seed E2E S03 concluído com sucesso.");
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((e) => {
  console.error("[seed-e2e] Erro:", e);
  process.exit(1);
});
