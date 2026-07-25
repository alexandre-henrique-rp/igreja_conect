/**
 * Teste de integração de app/routes/app/eventos.novo.tsx.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prismaTest, setupTestDb } from "../../../tests/helpers/db";
import { hashPassword } from "~/lib/auth.server";

let cleanup: () => Promise<void>;
let loader: typeof import("./eventos.novo").loader;
let action: typeof import("./eventos.novo").action;

beforeAll(async () => {
  cleanup = await setupTestDb("eventos_novo");
  vi.resetModules();
  const mod = await import("./eventos.novo");
  loader = mod.loader;
  action = mod.action;
});

afterAll(async () => {
  await cleanup();
});

beforeEach(async () => {
  await prismaTest.escalaVoluntario.deleteMany();
  await prismaTest.escala.deleteMany();
  await prismaTest.evento.deleteMany();
  await prismaTest.membro.deleteMany();
});

function makePostRequest(data: Record<string, string>): Request {
  const formData = new FormData();
  for (const [k, v] of Object.entries(data)) {
    formData.append(k, v);
  }
  return new Request("http://localhost/app/eventos/novo", {
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

async function makeAuthUser(cargo: "ADMIN" | "PASTOR" | "SECRETARIO" | null = "ADMIN"): Promise<{
  id: string;
  nome: string;
  cargo: typeof cargo;
}> {
  const m = await prismaTest.membro.create({
    data: {
      nome: "Test User Evento",
      email: `auth-${Date.now()}-${Math.random()}@igreja.local`,
      tipo: "MEMBRO_ATIVO",
      cargo,
      senhaHash: await hashPassword("senha-123"),
    },
  });
  return { id: m.id, nome: m.nome, cargo };
}

describe("eventos.novo — loader", () => {
  it("carrega a lista de membros com sucesso", async () => {
    const user = await makeAuthUser("ADMIN");
    const context = getMockContext(user);

    const m1 = await prismaTest.membro.create({
      data: { nome: "Líder de Eventos", cargo: "SECRETARIO", tipo: "MEMBRO_ATIVO" },
    });

    const res = await loader({
      request: new Request("http://localhost/app/eventos/novo"),
      params: {},
      context,
    } as any);

    expect(res.membros.length).toBeGreaterThanOrEqual(2); // O auth user e o m1
    expect(res.membros.some((m) => m.id === m1.id)).toBe(true);
  });
});

describe("eventos.novo — action", () => {
  it("sucesso: cria um novo evento", async () => {
    const user = await makeAuthUser("ADMIN");
    const context = getMockContext(user);

    const responsavel = await prismaTest.membro.create({
      data: { nome: "Responsável Técnico", cargo: "SECRETARIO", tipo: "MEMBRO_ATIVO" },
    });

    const payload = {
      titulo: "Retiro de Jovens",
      descricao: "Um retiro espetacular no final de semana",
      tipo: "RETIRO",
      status: "PUBLICADO",
      dataInicio: "2026-08-15",
      horaInicio: "08:00",
      dataFim: "2026-08-17",
      horaFim: "18:00",
      local: "Recanto das Palmeiras",
      responsavelId: responsavel.id,
    };

    const request = makePostRequest(payload);
    const response = await action({ request, params: {}, context } as any);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/app/eventos");

    const eventos = await prismaTest.evento.findMany({
      where: { titulo: "Retiro de Jovens" },
    });

    expect(eventos.length).toBe(1);
    expect(eventos[0].tipo).toBe("RETIRO");
    expect(eventos[0].status).toBe("PUBLICADO");
    expect(eventos[0].local).toBe("Recanto das Palmeiras");
    expect(eventos[0].responsavelId).toBe(responsavel.id);
  });

  it("erro: impede criação se faltar título ou data de início (validação Zod)", async () => {
    const user = await makeAuthUser("ADMIN");
    const context = getMockContext(user);

    const payload = {
      titulo: "",
      tipo: "ESPECIAL",
      status: "RASCUNHO",
      dataInicio: "",
      horaInicio: "09:00",
    };

    const request = makePostRequest(payload);
    const response = await action({ request, params: {}, context } as any);

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.errors.titulo).toBeTruthy();
    expect(body.errors.dataInicio).toBeTruthy();
  });
});
