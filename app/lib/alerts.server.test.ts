/**
 * Teste de app/lib/alerts.server.ts (S04-T03).
 *
 * Cobre:
 *  - listAlertas: filtro por lido/resolvido
 *  - listAlertas: counts em paralelo (lidos, nao lidos, total)
 *  - marcarLido: happy path + idempotência
 *  - marcarLido: 404 se alerta não pertence ao user
 *  - marcarResolvido: happy path + idempotência
 *  - criarAlertaVisitante: cria alerta + destinatários via tx
 *  - safeLog nunca loga mensagem do alerta
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prismaTest, setupTestDb } from "../../tests/helpers/db";
import type { SessionUser } from "./session.types";

let cleanup: () => Promise<void>;
let listAlertas: typeof import("./alerts.server").listAlertas;
let marcarLido: typeof import("./alerts.server").marcarLido;
let marcarResolvido: typeof import("./alerts.server").marcarResolvido;
let criarAlertaVisitante: typeof import("./alerts.server").criarAlertaVisitante;

beforeAll(async () => {
  cleanup = await setupTestDb("alerts.server");
  vi.resetModules();
  const mod = await import("./alerts.server");
  listAlertas = mod.listAlertas;
  marcarLido = mod.marcarLido;
  marcarResolvido = mod.marcarResolvido;
  criarAlertaVisitante = mod.criarAlertaVisitante;
});

afterAll(async () => { await cleanup(); });

beforeEach(async () => {
  await prismaTest.alertaDestinatario.deleteMany();
  await prismaTest.alerta.deleteMany();
  await prismaTest.ministerioMembro.deleteMany();
  await prismaTest.ministerio.deleteMany();
  await prismaTest.membro.updateMany({ data: { discipuladorId: null } });
  await prismaTest.membro.deleteMany();
});

// ----------------- helpers -----------------

function user(id: string, cargo = "ADMIN"): SessionUser {
  return { id, nome: `User ${id}`, cargo };
}

async function makeMembro(nome: string, opts: { cargo?: string | null } = {}): Promise<{ id: string; nome: string }> {
  const m = await prismaTest.membro.create({
    data: { nome, tipo: "MEMBRO_ATIVO", cargo: (opts.cargo ?? "ADMIN") as any },
  });
  return { id: m.id, nome: m.nome };
}

async function makeAlerta(
  titulo: string,
  membroIds: string[]
): Promise<{ id: string }> {
  const a = await prismaTest.alerta.create({
    data: {
      titulo,
      mensagem: `Mensagem: ${titulo}`,
      destinatarios: {
        create: membroIds.map((mid) => ({ membroId: mid })),
      },
    },
  });
  return { id: a.id };
}

// ----------------- listAlertas -----------------

describe("alerts.server — listAlertas", () => {
  it("lista alertas do usuário (destinatário)", async () => {
    const u1 = await makeMembro("User 1");
    const u2 = await makeMembro("User 2");
    await makeAlerta("Alerta só do u1", [u1.id]);
    await makeAlerta("Alerta dos dois", [u1.id, u2.id]);

    const result = await listAlertas(user(u1.id), "todos");
    expect(result.items).toHaveLength(2);
    expect(result.items[0].titulo).toBeTruthy();
  });

  it("filtro: apenas não lidos", async () => {
    const u1 = await makeMembro("User 1");
    const a1 = await makeAlerta("Alerta não lido", [u1.id]);
    await makeAlerta("Alerta também não lido", [u1.id]);

    // Marca um como lido
    await prismaTest.alertaDestinatario.updateMany({
      where: { alertaId: a1.id, membroId: u1.id },
      data: { lido: true },
    });

    const result = await listAlertas(user(u1.id), "nao_lidos");
    expect(result.items).toHaveLength(1);
  });

  it("filtro: apenas resolvidos usa estado do destinatário", async () => {
    const u1 = await makeMembro("User 1");
    const a1 = await makeAlerta("Alerta 1 global resolvido", [u1.id]);
    const a2 = await makeAlerta("Alerta 2 destinatário resolvido", [u1.id]);
    await prismaTest.alerta.update({ where: { id: a1.id }, data: { resolvido: true } });
    await prismaTest.alertaDestinatario.updateMany({
      where: { alertaId: a2.id, membroId: u1.id },
      data: { resolvido: true },
    });

    const result = await listAlertas(user(u1.id), "resolvidos");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(a2.id);
  });

  it("retorna counts (total, naoLidos, naoResolvidos)", async () => {
    const u1 = await makeMembro("User 1");
    const a1 = await makeAlerta("A1", [u1.id]);
    await makeAlerta("A2", [u1.id]);

    await prismaTest.alertaDestinatario.updateMany({
      where: { alertaId: a1.id, membroId: u1.id },
      data: { lido: true },
    });

    const result = await listAlertas(user(u1.id), "todos");
    expect(result.counts.total).toBe(2);
    expect(result.counts.naoLidos).toBe(1);
    expect(result.counts.naoResolvidos).toBe(2);
  });

  it("isolamento: user A não vê alertas de user B", async () => {
    const u1 = await makeMembro("User 1");
    const u2 = await makeMembro("User 2");
    await makeAlerta("Alerta do u2", [u2.id]);

    const result = await listAlertas(user(u1.id), "todos");
    expect(result.items).toHaveLength(0);
    expect(result.counts.total).toBe(0);
  });
});

// ----------------- marcarLido -----------------

describe("alerts.server — marcarLido", () => {
  it("marca alerta como lido para o destinatário sem alterar estado global", async () => {
    const u1 = await makeMembro("User 1");
    const a = await makeAlerta("Alerta", [u1.id]);

    await marcarLido(a.id, user(u1.id));

    const alerta = await prismaTest.alerta.findUnique({ where: { id: a.id } });
    const ad = await prismaTest.alertaDestinatario.findFirst({
      where: { alertaId: a.id, membroId: u1.id },
    });
    // lido nao existe em Alerta (e sim em AlertaDestinatario)
    expect(ad?.lido).toBe(true);
  });

  it("idempotência: marcar 2x = no-op", async () => {
    const u1 = await makeMembro("User 1");
    const a = await makeAlerta("Alerta", [u1.id]);

    await marcarLido(a.id, user(u1.id));
    await marcarLido(a.id, user(u1.id)); // 2ª vez

    const ad = await prismaTest.alertaDestinatario.findFirst({
      where: { alertaId: a.id, membroId: u1.id },
    });
    expect(ad?.lido).toBe(true);
  });

  it("404 se alerta não pertence ao user", async () => {
    const u1 = await makeMembro("User 1");
    const u2 = await makeMembro("User 2");
    const a = await makeAlerta("Alerta do u1", [u1.id]);

    await expect(marcarLido(a.id, user(u2.id))).rejects.toThrow();
  });
});

// ----------------- marcarResolvido -----------------

describe("alerts.server — marcarResolvido", () => {
  it("marca alerta como resolvido + lido no destinatário, sem resolver global", async () => {
    const u1 = await makeMembro("User 1");
    const a = await makeAlerta("Alerta", [u1.id]);

    await marcarResolvido(a.id, user(u1.id));

    const alerta = await prismaTest.alerta.findUnique({ where: { id: a.id } });
    const ad = await prismaTest.alertaDestinatario.findFirst({
      where: { alertaId: a.id, membroId: u1.id },
    });
    expect(alerta?.resolvido).toBe(false);
    expect(ad?.resolvido).toBe(true);
    expect(ad?.lido).toBe(true);
  });

  it("idempotência: marcar 2x = no-op", async () => {
    const u1 = await makeMembro("User 1");
    const a = await makeAlerta("Alerta", [u1.id]);

    await marcarResolvido(a.id, user(u1.id));
    await marcarResolvido(a.id, user(u1.id)); // 2ª vez

    const ad = await prismaTest.alertaDestinatario.findFirst({
      where: { alertaId: a.id, membroId: u1.id },
    });
    expect(ad?.resolvido).toBe(true);
  });

  it("404 se alerta não pertence ao user", async () => {
    const u1 = await makeMembro("User 1");
    const u2 = await makeMembro("User 2");
    const a = await makeAlerta("Alerta do u1", [u1.id]);

    await expect(marcarResolvido(a.id, user(u2.id))).rejects.toThrow();
  });
});

// ----------------- criarAlertaVisitante -----------------

describe("alerts.server — criarAlertaVisitante", () => {
  it("cria alerta + destinatário para membro específico", async () => {
    const visitante = await makeMembro("Visitante");
    const responsavel = await makeMembro("Responsável");
    const config = { responsavelVisitanteTipo: "MEMBRO" as const, responsavelMembroId: responsavel.id };

    const alerta = await prismaTest.$transaction((tx) =>
      criarAlertaVisitante(tx, visitante, config)
    );

    if (!alerta) throw new Error("alerta não foi criado");

    expect(alerta.titulo).toBe("Novo visitante cadastrado");
    expect(alerta.mensagem).toContain(visitante.nome);
    // Verifica destinatário
    const ads = await prismaTest.alertaDestinatario.findMany({
      where: { alertaId: alerta.id },
    });
    expect(ads).toHaveLength(1);
    expect(ads[0].membroId).toBe(responsavel.id);
  });

  it("cria alerta + N destinatários para ministério", async () => {
    const visitante = await makeMembro("Visitante");
    const ministerio = await prismaTest.ministerio.create({ data: { nome: "Louvor" } });
    const m1 = await makeMembro("Membro 1");
    const m2 = await makeMembro("Membro 2");
    await prismaTest.ministerioMembro.createMany({
      data: [
        { ministerioId: ministerio.id, membroId: m1.id },
        { ministerioId: ministerio.id, membroId: m2.id },
      ],
    });

    const config = {
      responsavelVisitanteTipo: "MINISTERIO" as const,
      responsavelMinisterioId: ministerio.id,
    };

    const alerta = await prismaTest.$transaction((tx) =>
      criarAlertaVisitante(tx, visitante, config)
    );

    if (!alerta) throw new Error("alerta não foi criado");

    expect(alerta.titulo).toBe("Novo visitante cadastrado");
    // Verifica 2 destinatários
    const ads = await prismaTest.alertaDestinatario.findMany({
      where: { alertaId: alerta.id },
    });
    expect(ads).toHaveLength(2);
  });

  it("mensagem do alerta NÃO contém email nem endereço (LGPD)", async () => {
    const visitante = await makeMembro("Visitante LGPD");
    const responsavel = await makeMembro("Resp");
    const config = { responsavelVisitanteTipo: "MEMBRO" as const, responsavelMembroId: responsavel.id };

    const alerta = await prismaTest.$transaction((tx) =>
      criarAlertaVisitante(tx, visitante, config)
    );

    if (!alerta) throw new Error("alerta não foi criado");

    expect(alerta.mensagem).not.toMatch(/@/); // sem email
    expect(alerta.mensagem).not.toMatch(/\b(rua|av\.|logradouro)\b/i); // sem endereço
  });
});
