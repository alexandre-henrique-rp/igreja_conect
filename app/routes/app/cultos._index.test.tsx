/**
 * Teste de integração de app/routes/app/cultos._index.tsx.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prismaTest, setupTestDb } from "../../../tests/helpers/db";
import { hashPassword } from "~/lib/auth.server";

let cleanup: () => Promise<void>;
let loader: typeof import("./cultos._index").loader;
let action: typeof import("./cultos._index").action;

beforeAll(async () => {
  cleanup = await setupTestDb("cultos_index");
  vi.resetModules();
  const mod = await import("./cultos._index");
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
      nome: "Test User Culto Index",
      email: `auth-${Date.now()}-${Math.random()}@igreja.local`,
      tipo: "MEMBRO_ATIVO",
      cargo,
      senhaHash: await hashPassword("senha-123"),
    },
  });
  return { id: m.id, nome: m.nome, cargo };
}

describe("cultos.index — loader", () => {
  it("carrega a listagem de cultos cadastrados e filtra cultos já executados", async () => {
    const user = await makeAuthUser("ADMIN");
    const context = getMockContext(user);

    // Criar um culto no banco
    const min = await prismaTest.ministerio.create({
      data: { nome: "Louvor Geral", status: "ATIVO" },
    });

    await prismaTest.culto.create({
      data: {
        titulo: "Culto de Domingo",
        tipo: "PRESENCIAL",
        data: new Date("2026-08-02T19:00:00"),
        horario: "19:00",
        status: "AGENDADO",
        ministerioId: min.id,
        createdById: user.id,
        executado: false,
      },
    });

    // Criar um culto executado no banco (não deve vir no loader)
    await prismaTest.culto.create({
      data: {
        titulo: "Culto Executado",
        tipo: "PRESENCIAL",
        data: new Date("2026-08-02T19:00:00"),
        horario: "19:00",
        status: "REALIZADO",
        ministerioId: min.id,
        createdById: user.id,
        executado: true,
      },
    });

    const res = await loader({
      request: new Request("http://localhost/app/cultos"),
      params: {},
      context,
    } as any);

    expect(res.cultos.length).toBe(1);
    expect(res.cultos[0].titulo).toBe("Culto de Domingo");
    expect(res.cultos[0].ministerio.nome).toBe("Louvor Geral");
  });
});

describe("cultos.index — action (excluir)", () => {
  it("sucesso: exclui um culto existente", async () => {
    const user = await makeAuthUser("ADMIN");
    const context = getMockContext(user);

    const culto = await prismaTest.culto.create({
      data: {
        titulo: "Culto a deletar",
        tipo: "PRESENCIAL",
        data: new Date("2026-08-02T19:00:00"),
        horario: "19:00",
        status: "AGENDADO",
        createdById: user.id,
      },
    });

    const formData = new FormData();
    formData.append("intent", "deletar");
    formData.append("id", culto.id);

    const request = new Request("http://localhost/app/cultos", {
      method: "POST",
      body: formData,
    });

    const res = await action({ request, params: {}, context } as any) as Response;
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const dbCulto = await prismaTest.culto.findUnique({
      where: { id: culto.id },
    });
    expect(dbCulto).toBeNull();
  });

  it("erro: impede exclusão de culto com status REALIZADO", async () => {
    const user = await makeAuthUser("ADMIN");
    const context = getMockContext(user);

    const culto = await prismaTest.culto.create({
      data: {
        titulo: "Culto Realizado",
        tipo: "PRESENCIAL",
        data: new Date("2026-08-02T19:00:00"),
        horario: "19:00",
        status: "REALIZADO",
        createdById: user.id,
      },
    });

    const formData = new FormData();
    formData.append("intent", "deletar");
    formData.append("id", culto.id);

    const request = new Request("http://localhost/app/cultos", {
      method: "POST",
      body: formData,
    });

    const res = await action({ request, params: {}, context } as any) as Response;
    
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("realizados não podem ser excluídos");

    const dbCulto = await prismaTest.culto.findUnique({
      where: { id: culto.id },
    });
    expect(dbCulto).not.toBeNull();
  });
});

describe("cultos.index — action (executar)", () => {
  it("sucesso: marca um culto como executado", async () => {
    const user = await makeAuthUser("ADMIN");
    const context = getMockContext(user);

    const culto = await prismaTest.culto.create({
      data: {
        titulo: "Culto a executar",
        tipo: "PRESENCIAL",
        data: new Date("2026-08-02T19:00:00"),
        horario: "19:00",
        status: "AGENDADO",
        createdById: user.id,
        executado: false,
      },
    });

    const formData = new FormData();
    formData.append("intent", "executar");
    formData.append("id", culto.id);

    const request = new Request("http://localhost/app/cultos", {
      method: "POST",
      body: formData,
    });

    const res = await action({ request, params: {}, context } as any) as Response;
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const dbCulto = await prismaTest.culto.findUnique({
      where: { id: culto.id },
    });
    expect(dbCulto?.executado).toBe(true);
  });
});
