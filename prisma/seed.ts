/**
 * Seed idempotente — Igreja Conect (S00-T13).
 *
 * Cria o ADMIN inicial (`admin@igreja.local` / `admin123`). Pode ser
 * rodado múltiplas vezes: na 2ª execução detecta via `findUnique` e
 * imprime "ADMIN já existe" sem duplicar.
 *
 * **ATENÇÃO:** a senha `admin123` é APENAS para o ambiente de
 * desenvolvimento. Trocar imediatamente em produção.
 */
import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const ADMIN_EMAIL =
  process.env.NODE_ENV === "production"
    ? (process.env.ADMIN_EMAIL ?? "")
    : (process.env.ADMIN_EMAIL ?? "admin@igreja.local");
const ADMIN_PASSWORD =
  process.env.NODE_ENV === "production"
    ? (process.env.ADMIN_PASSWORD ?? "")
    : (process.env.ADMIN_PASSWORD ?? "admin123"); // TROCAR EM PRODUÇÃO
const BCRYPT_COST = 10;

/**
 * Cria o ADMIN inicial. Idempotente.
 *
 * @description Singleton lazy do Prisma dentro do seed — instancia o
 *   client na hora da chamada (não no import) para que `DATABASE_URL`
 *   já esteja definido pelo chamador.
 */
export async function runSeed(): Promise<void> {
  if (process.env.NODE_ENV === "production" && (!ADMIN_EMAIL || !ADMIN_PASSWORD)) {
    throw new Error(
      "ADMIN_EMAIL e ADMIN_PASSWORD são obrigatórias em produção. Defina as variáveis de ambiente antes de rodar a seed.",
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
    }),
  });
  try {
    const existente = await prisma.membro.findUnique({
      where: { email: ADMIN_EMAIL },
    });
    if (!existente) {
      const senhaHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_COST);
      const admin = await prisma.membro.create({
        data: {
          nome: "Administrador",
          email: ADMIN_EMAIL,
          senhaHash,
          tipo: "MEMBRO_ATIVO",
          cargo: "ADMIN",
        },
      });
      console.log(`[seed] ADMIN criado: ${admin.email} (id: ${admin.id})`);
      console.log(
        `[seed] Senha inicial: "${ADMIN_PASSWORD}" — TROCAR EM PRODUÇÃO.`,
      );
    } else {
      console.log(
        `[seed] ADMIN já existe (${ADMIN_EMAIL}). Seed de ADMIN OK.`,
      );
    }

    // Mock members apenas para desenvolvimento
    if (process.env.NODE_ENV !== "production") {
      const mockMembros = [
        {
          nome: "Ricardo Oliveira",
          email: "ricardo.o@email.com",
          tipo: "MEMBRO_ATIVO" as const,
          createdAt: new Date("2022-03-12T12:00:00Z"),
        },
        {
          nome: "Ana Beatriz Costa",
          email: "ana.beatriz@email.com",
          tipo: "VISITANTE" as const,
          createdAt: new Date("2023-11-05T12:00:00Z"),
        },
        {
          nome: "Marcos Vinícius",
          email: "m.vinicius@email.com",
          tipo: "CONGREGADO" as const,
          createdAt: new Date("2021-01-18T12:00:00Z"),
        },
        {
          nome: "Juliana Santos",
          email: "juliana.s@email.com",
          tipo: "MEMBRO_ATIVO" as const,
          createdAt: new Date("2020-08-30T12:00:00Z"),
        },
      ];

      for (const m of mockMembros) {
        const existeMembro = await prisma.membro.findUnique({
          where: { email: m.email },
        });
        if (!existeMembro) {
          await prisma.membro.create({
            data: {
              nome: m.nome,
              email: m.email,
              tipo: m.tipo,
              createdAt: m.createdAt,
            },
          });
          console.log(`[seed] Membro criado: ${m.nome}`);
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Executa ao rodar `tsx prisma/seed.ts` (não em test).
if (
  process.env.NODE_ENV !== "test" &&
  import.meta.url === `file://${process.argv[1]}`
) {
  runSeed().catch((e) => {
    console.error("[seed] Erro:", e);
    process.exit(1);
  });
}
