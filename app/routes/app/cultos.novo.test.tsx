/**
 * Teste de integração de app/routes/app/cultos.novo.tsx.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prismaTest, setupTestDb } from "../../../tests/helpers/db";
import { hashPassword } from "~/lib/auth.server";

let cleanup: () => Promise<void>;
let loader: typeof import("./cultos.novo").loader;
let action: typeof import("./cultos.novo").action;

beforeAll(async () => {
  cleanup = await setupTestDb("cultos_novo");
  vi.resetModules();
  const mod = await import("./cultos.novo");
  loader = mod.loader;
  action = mod.action;
});

afterAll(async () => {
  await cleanup();
});

beforeEach(async () => {
  await prismaTest.escalaVoluntario.deleteMany();
  await prismaTest.escala.deleteMany();
  await prismaTest.culto.deleteMany();
  await prismaTest.ministerio.deleteMany();
  await prismaTest.membro.deleteMany();
});

function makePostRequest(data: Record<string, string>): Request {
  const formData = new FormData();
  for (const [k, v] of Object.entries(data)) {
    formData.append(k, v);
  }
  return new Request("http://localhost/app/cultos/novo", {
    method: "POST",
    body: formData,
  });
}

function getMockContext(user: any) {
  return {
    get: (key: any) => {
      return user;
    },
  };
}

async function makeAuthUser(cargo: "ADMIN" | "PASTOR" | null = "ADMIN"): Promise<{
  id: string;
  nome: string;
  cargo: typeof cargo;
}> {
  const m = await prismaTest.membro.create({
    data: {
      nome: "Test User Culto",
      email: `auth-${Date.now()}-${Math.random()}@igreja.local`,
      tipo: "MEMBRO_ATIVO",
      cargo,
      senhaHash: await hashPassword("senha-123"),
    },
  });
  return { id: m.id, nome: m.nome, cargo };
}

describe("cultos.novo — loader", () => {
  it("carrega pastores e ministérios com sucesso", async () => {
    const user = await makeAuthUser("ADMIN");
    const context = getMockContext(user);

    // Criar um pastor no banco
    const pastor = await prismaTest.membro.create({
      data: { nome: "Pr. Marcos", cargo: "PASTOR", tipo: "MEMBRO_ATIVO" },
    });
    // Criar um ministério no banco
    const min = await prismaTest.ministerio.create({
      data: { nome: "Louvor Culto", status: "ATIVO" },
    });

    const res = await loader({
      request: new Request("http://localhost/app/cultos/novo"),
      params: {},
      context,
    } as any);

    expect(res.pastores.length).toBeGreaterThanOrEqual(1);
    expect(res.pastores.some((p) => p.id === pastor.id)).toBe(true);
    expect(res.ministerios.length).toBeGreaterThanOrEqual(1);
    expect(res.ministerios.some((m) => m.id === min.id)).toBe(true);
  });
});

describe("cultos.novo — action", () => {
  it("sucesso: cria um culto único e resolve pastor padrão se não informado", async () => {
    const user = await makeAuthUser("ADMIN");
    const context = getMockContext(user);

    // Cria o pastor padrão no banco
    const pastorPadrao = await prismaTest.membro.create({
      data: { nome: "Pr. Principal da Igreja", cargo: "PASTOR", tipo: "MEMBRO_ATIVO" },
    });

    const payload = {
      nome: "Culto de Quinta",
      data: "2026-08-06",
      horario: "20:00",
      tipo: "Presencial",
      status: "Agendado",
      preletorOpcao: "", // Pastor Cadastrado (Automático)
    };

    const request = makePostRequest(payload);
    const response = await action({ request, params: {}, context } as any);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/app/cultos");

    // Verifica se criou e resolveu o preletor
    const cultos = await prismaTest.culto.findMany({
      where: { titulo: "Culto de Quinta" },
    });

    expect(cultos.length).toBe(1);
    expect(cultos[0].preletor).toBe(pastorPadrao.nome);
    expect(cultos[0].horario).toBe("20:00");
  });

  it("sucesso: cria um culto único associado a um ministério e pregador específico", async () => {
    const user = await makeAuthUser("ADMIN");
    const context = getMockContext(user);

    const min = await prismaTest.ministerio.create({
      data: { nome: "Ministério Geral", status: "ATIVO" },
    });

    const payload = {
      nome: "Culto de Jovens",
      data: "2026-08-08",
      horario: "19:00",
      tipo: "Presencial",
      status: "Confirmado",
      preletorOpcao: "outro",
      preletorOutro: "Pregador Convidado VIP",
      ministerioId: min.id,
    };

    const request = makePostRequest(payload);
    const response = await action({ request, params: {}, context } as any);

    expect(response.status).toBe(302);

    const cultos = await prismaTest.culto.findMany({
      where: { titulo: "Culto de Jovens" },
    });

    expect(cultos.length).toBe(1);
    expect(cultos[0].preletor).toBe("Pregador Convidado VIP");
    expect(cultos[0].ministerioId).toBe(min.id);
  });

  it("sucesso: cria cultos recorrentes (fixos) de 7 em 7 dias", async () => {
    const user = await makeAuthUser("ADMIN");
    const context = getMockContext(user);

    const payload = {
      nome: "Culto de Domingo Recorrente",
      data: "2026-08-02", // Primeiro domingo
      horario: "19:00",
      tipo: "Presencial",
      status: "Agendado",
      preletorOpcao: "outro",
      preletorOutro: "Pr. Local",
      recorrente: "true",
      dataLimite: "2026-08-23", // Deve gerar para 02, 09, 16 e 23 (4 cultos)
    };

    const request = makePostRequest(payload);
    const response = await action({ request, params: {}, context } as any);

    expect(response.status).toBe(302);

    const cultos = await prismaTest.culto.findMany({
      where: { titulo: "Culto de Domingo Recorrente" },
      orderBy: { data: "asc" },
    });

    expect(cultos.length).toBe(4);
    expect(cultos[0].data.toISOString().slice(0, 10)).toBe("2026-08-02");
    expect(cultos[1].data.toISOString().slice(0, 10)).toBe("2026-08-09");
    expect(cultos[2].data.toISOString().slice(0, 10)).toBe("2026-08-16");
    expect(cultos[3].data.toISOString().slice(0, 10)).toBe("2026-08-23");
  });

  it("sucesso: cria cultos recorrentes nos dias da semana selecionados (ex: Domingo=0 e Quarta=3)", async () => {
    const user = await makeAuthUser("ADMIN");
    const context = getMockContext(user);

    const payload = {
      nome: "Culto Especial Recorrente",
      data: "2026-08-02",
      horario: "19:30",
      tipo: "Presencial",
      status: "Agendado",
      preletorOpcao: "outro",
      preletorOutro: "Pregador Convidado",
      recorrente: "true",
      dataLimite: "2026-08-09",
    };

    const formData = new FormData();
    for (const [k, v] of Object.entries(payload)) {
      formData.append(k, v);
    }
    formData.append("diasSemana", "0"); // Domingo
    formData.append("diasSemana", "3"); // Quarta

    const request = new Request("http://localhost/app/cultos/novo", {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context } as any);
    expect(response.status).toBe(302);

    const cultos = await prismaTest.culto.findMany({
      where: { titulo: "Culto Especial Recorrente" },
      orderBy: { data: "asc" },
    });

    expect(cultos.length).toBe(3);
    expect(cultos[0].data.toISOString().slice(0, 10)).toBe("2026-08-02");
    expect(cultos[1].data.toISOString().slice(0, 10)).toBe("2026-08-05");
    expect(cultos[2].data.toISOString().slice(0, 10)).toBe("2026-08-09");
  });
});
