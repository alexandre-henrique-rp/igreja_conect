import { describe, it, expect, beforeAll } from "vitest";
import { PrismaClient } from "../generated/prisma/client";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }),
});

describe("debug MINISTERIO", () => {
  beforeAll(async () => {
    await prisma.$executeRaw`TRUNCATE TABLE "membro" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "ministerio" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "ministerio_membro" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "configuracoes_gerais" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "alerta" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "alerta_destinatario" CASCADE`;
  });

  it("debug MINISTERIO alert creation", async () => {
    const ministerio = await prisma.ministerio.create({ data: { nome: "Acolhimento" } });
    const m1 = await prisma.membro.create({ data: { nome: "M1", tipo: "MEMBRO_ATIVO", cargo: "ADMIN" } });
    const m2 = await prisma.membro.create({ data: { nome: "M2", tipo: "MEMBRO_ATIVO", cargo: "ADMIN" } });
    await prisma.ministerioMembro.createMany({
      data: [
        { ministerioId: ministerio.id, membroId: m1.id },
        { ministerioId: ministerio.id, membroId: m2.id },
      ],
    });
    await prisma.configuracaoGeral.create({
      data: {
        id: "singleton",
        responsavelVisitanteTipo: "MINISTERIO",
        responsavelMinisterioId: ministerio.id,
      },
    });

    const membros = await prisma.ministerioMembro.findMany({
      where: { ministerioId: ministerio.id },
      select: { membroId: true },
    });
    console.log("ministerioMembro count:", membros.length);

    const result = await prisma.$transaction(async (tx: typeof prisma) => {
      const visitante = await tx.membro.create({
        data: { nome: "Visitante Min", tipo: "VISITANTE" },
        select: { id: true, nome: true },
      });

      const cfg = await tx.configuracaoGeral.findFirst({ where: { id: "singleton" } });
      console.log("Config:", cfg?.responsavelVisitanteTipo, cfg?.responsavelMinisterioId);

      if (cfg && cfg.responsavelVisitanteTipo === "MINISTERIO" && cfg.responsavelMinisterioId) {
        const ministryMembers = await tx.ministerioMembro.findMany({
          where: { ministerioId: cfg.responsavelMinisterioId },
          select: { membroId: true },
        });
        console.log("Members in ministry:", ministryMembers.length);

        const ids = ministryMembers.map(m => m.membroId);
        if (ids.length > 0) {
          const alerta = await tx.alerta.create({
            data: {
              titulo: "Novo visitante",
              mensagem: "test",
              destinatarios: { create: ids.map(mid => ({ membroId: mid })) },
            },
          });
          console.log("Alert created with id:", alerta.id);
          return { visitanteId: visitante.id, alertaId: alerta.id, memberIds: ids };
        }
      }
      return { visitanteId: null };
    });

    console.log("Transaction result:", JSON.stringify(result));

    const alertasByVisitante = await prisma.alerta.findMany({
      where: { destinatarios: { some: { membroId: result.visitanteId! } } },
    });
    console.log("Alertas by visitante as destinatario:", alertasByVisitante.length);

    const alertasByMembers = await prisma.alerta.findMany({
      where: { destinatarios: { some: { membroId: { in: result.memberIds } } } },
    });
    console.log("Alertas by members as destinatarios:", alertasByMembers.length);

    expect(alertasByMembers.length).toBe(1);
  });
});
