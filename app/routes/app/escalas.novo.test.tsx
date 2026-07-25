/**
 * Teste de integração de app/routes/app/escalas.novo.tsx.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prismaTest, setupTestDb } from "../../../tests/helpers/db";
import { hashPassword } from "~/lib/auth.server";

let cleanup: () => Promise<void>;
let loader: typeof import("./escalas.novo").loader;
let action: typeof import("./escalas.novo").action;

beforeAll(async () => {
  cleanup = await setupTestDb("escalas_novo");
  vi.resetModules();
  const mod = await import("./escalas.novo");
  loader = mod.loader;
  action = mod.action;
});

afterAll(async () => {
  await cleanup();
});

beforeEach(async () => {
  await prismaTest.escalaVoluntario.deleteMany();
  await prismaTest.escala.deleteMany();
  await prismaTest.atividadeMinisterio.deleteMany();
  await prismaTest.ministerioMembro.deleteMany();
  await prismaTest.funcaoMinisterio.deleteMany();
  await prismaTest.ministerio.deleteMany();
  await prismaTest.culto.deleteMany();
  await prismaTest.evento.deleteMany();
  await prismaTest.membro.deleteMany();
});

function makePostRequest(data: Record<string, string>): Request {
  const formData = new FormData();
  for (const [k, v] of Object.entries(data)) {
    formData.append(k, v);
  }
  return new Request("http://localhost/app/escalas/novo", {
    method: "POST",
    body: formData,
  });
}

function getMockContext(user: any) {
  return {
    get: (key: any) => {
      // Mock do userContext
      return user;
    },
  };
}

async function makeAuthUser(cargo: "ADMIN" | "PASTOR" | "SECRETARIO" | "LIDER_MINISTERIO" | null = "ADMIN"): Promise<{
  id: string;
  nome: string;
  cargo: typeof cargo;
}> {
  const m = await prismaTest.membro.create({
    data: {
      nome: "Test User Scales",
      email: `auth-${Date.now()}-${Math.random()}@igreja.local`,
      tipo: "MEMBRO_ATIVO",
      cargo,
      senhaHash: await hashPassword("senha-123"),
    },
  });
  return { id: m.id, nome: m.nome, cargo };
}

describe("escalas.novo — loader", () => {
  it("rejeita usuário não autenticado (401)", async () => {
    const context = getMockContext(null);
    await expect(loader({ request: new Request("http://localhost/app/escalas/novo"), params: {}, context } as any))
      .rejects.toThrow();
  });

  it("rejeita usuário sem permissão de escrita (403)", async () => {
    const user = await makeAuthUser(null); // Membro comum
    const context = getMockContext(user);
    await expect(loader({ request: new Request("http://localhost/app/escalas/novo"), params: {}, context } as any))
      .rejects.toThrow();
  });

  it("carrega dados com sucesso para cargos autorizados", async () => {
    const user = await makeAuthUser("ADMIN");
    const context = getMockContext(user);

    // Criar dados para carregar
    const min = await prismaTest.ministerio.create({
      data: { nome: "Louvor Teste", status: "ATIVO" },
    });
    const cult = await prismaTest.culto.create({
      data: {
        titulo: "Culto de Domingo",
        tipo: "PRESENCIAL",
        data: new Date("2026-08-10T18:00:00Z"),
        horario: "18:00",
      },
    });
    const ev = await prismaTest.evento.create({
      data: {
        titulo: "Retiro de Jovens",
        tipo: "RETIRO",
        dataInicio: new Date("2026-09-01T08:00:00Z"),
      },
    });

    const res = await loader({
      request: new Request("http://localhost/app/escalas/novo"),
      params: {},
      context,
    } as any);

    expect(res.canEdit).toBe(true);
    expect(res.ministerios.length).toBeGreaterThanOrEqual(1);
    expect(res.ministerios.some((m) => m.id === min.id)).toBe(true);
    expect(res.cultos.some((c) => c.id === cult.id)).toBe(true);
    expect(res.eventos.some((e) => e.id === ev.id)).toBe(true);
  });
});

describe("escalas.novo — action", () => {
  it("sucesso: cria escala livre (sem vincular culto/evento) e adiciona voluntários", async () => {
    const user = await makeAuthUser("ADMIN");
    const context = getMockContext(user);

    const min = await prismaTest.ministerio.create({
      data: { nome: "Recepção Teste", status: "ATIVO" },
    });
    const voluntarioMembro = await prismaTest.membro.create({
      data: { nome: "Voluntario 1", tipo: "MEMBRO_ATIVO" },
    });

    const payload = {
      ministerioId: min.id,
      culto: "Escala Livre de Recepção",
      data: "2026-08-15",
      voluntarios: JSON.stringify([
        { membroId: voluntarioMembro.id, funcao: "Recepcionista" },
      ]),
    };

    const request = makePostRequest(payload);
    const response = await action({ request, params: {}, context } as any);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/app/escalas");

    // Verificar no banco
    const escala = await prismaTest.escala.findFirst({
      where: { ministerioId: min.id },
      include: { voluntarios: true },
    });

    expect(escala).toBeTruthy();
    expect(escala?.titulo).toBe("Escala Livre de Recepção");
    expect(escala?.cultoId).toBeNull();
    expect(escala?.eventoId).toBeNull();
    expect(escala?.voluntarios.length).toBe(1);
    expect(escala?.voluntarios[0].membroId).toBe(voluntarioMembro.id);
    expect(escala?.voluntarios[0].funcao).toBe("Recepcionista");
  });

  it("sucesso: cria escala vinculada a um culto", async () => {
    const user = await makeAuthUser("ADMIN");
    const context = getMockContext(user);

    const min = await prismaTest.ministerio.create({
      data: { nome: "Louvor Som", status: "ATIVO" },
    });
    const cult = await prismaTest.culto.create({
      data: {
        titulo: "Culto de Quinta",
        tipo: "PRESENCIAL",
        data: new Date("2026-08-20T19:30:00Z"),
        horario: "19:30",
      },
    });

    const payload = {
      ministerioId: min.id,
      culto: "Escala Culto de Quinta",
      data: "2026-08-20",
      cultoId: cult.id,
      voluntarios: "[]",
    };

    const request = makePostRequest(payload);
    const response = await action({ request, params: {}, context } as any);

    expect(response.status).toBe(302);

    const escala = await prismaTest.escala.findFirst({
      where: { cultoId: cult.id },
    });
    expect(escala).toBeTruthy();
    expect(escala?.titulo).toBe("Escala Culto de Quinta");
    expect(escala?.eventoId).toBeNull();
  });

  it("sucesso: cria escala vinculada a um evento", async () => {
    const user = await makeAuthUser("ADMIN");
    const context = getMockContext(user);

    const min = await prismaTest.ministerio.create({
      data: { nome: "Kids", status: "ATIVO" },
    });
    const ev = await prismaTest.evento.create({
      data: {
        titulo: "EBF Infantil",
        tipo: "ESPECIAL",
        dataInicio: new Date("2026-10-12T09:00:00Z"),
      },
    });

    const payload = {
      ministerioId: min.id,
      culto: "Escala EBF Infantil",
      data: "2026-10-12",
      eventoId: ev.id,
      voluntarios: "[]",
    };

    const request = makePostRequest(payload);
    const response = await action({ request, params: {}, context } as any);

    expect(response.status).toBe(302);

    const escala = await prismaTest.escala.findFirst({
      where: { eventoId: ev.id },
    });
    expect(escala).toBeTruthy();
    expect(escala?.titulo).toBe("Escala EBF Infantil");
    expect(escala?.cultoId).toBeNull();
  });

  it("rejeita campos inválidos (validação Zod 422)", async () => {
    const user = await makeAuthUser("ADMIN");
    const context = getMockContext(user);

    // Ministério ID vazio
    const payload = {
      ministerioId: "",
      culto: "Título",
      data: "2026-08-15",
    };

    const request = makePostRequest(payload);
    const response = await action({ request, params: {}, context } as any) as any;

    expect(response.init?.status).toBe(422);
    expect(response.data?.errors?.ministerioId).toBeDefined();
  });
});
