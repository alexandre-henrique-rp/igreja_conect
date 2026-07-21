/**
 * Teste de integração de app/routes/app/membros.novo.tsx (S02-T06).
 *
 * Cobre o action da rota:
 *  - Sucesso: 302 → /app/membros/:id (membro criado)
 *  - Email duplicado: 422 com fieldError.email em PT-BR
 *  - Validação Zod falha: 422 com fieldErrors e defaultValues preservados
 *
 * **Por que testamos só o action:** o loader é trivial (retorna null
 * para o form renderizar vazio) e o componente é puramente UI
 * (delegado ao frontend S02-T05).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prismaTest, setupTestDb } from "../../../tests/helpers/db";
import { hashPassword } from "~/lib/auth.server";

// Re-importados DEPOIS de setupTestDb para usar o DB de teste.
let cleanup: () => Promise<void>;
let action: typeof import("./membros.novo").action;

beforeAll(async () => {
  cleanup = await setupTestDb("membros_novo");
  vi.resetModules();
  const mod = await import("./membros.novo");
  action = mod.action;
});

afterAll(async () => { await cleanup(); });

beforeEach(async () => {
  await prismaTest.alertaDestinatario.deleteMany();
  await prismaTest.alerta.deleteMany();
  await prismaTest.ministerioMembro.deleteMany();
  await prismaTest.movimentacaoEstoque.deleteMany();
  await prismaTest.manutencaoAtivo.deleteMany();
  await prismaTest.lancamento.deleteMany();
  await prismaTest.transferenciaCaixa.deleteMany();
  await prismaTest.session.deleteMany();
  await prismaTest.membro.updateMany({ data: { discipuladorId: null } });
  await prismaTest.membro.deleteMany();
});

/**
 * Helper: cria um Request simulando POST de form HTML.
 * `data` é um Record que vira FormData.
 */
function makePostRequest(data: Record<string, string>): Request {
  const formData = new FormData();
  for (const [k, v] of Object.entries(data)) {
    formData.append(k, v);
  }
  return new Request("http://localhost/app/membros/novo", {
    method: "POST",
    body: formData,
  });
}

/** Helper: cria args para o action (request + context com user injetado). */
function actionArgs(
  request: Request,
  user: { id: string; nome: string; cargo: "ADMIN" | "PASTOR" | "SECRETARIO" | "LIDER_MINISTERIO" | "FINANCEIRO" | "LIDER_MINISTERIO" | null } | null
) {
  return {
    request,
    params: {},
    context: {
      get: (key: { defaultValue: unknown }) => {
        if ((key as { defaultValue?: unknown }).defaultValue === null) return user;
        return undefined;
      },
    },
  } as unknown as Parameters<typeof action>[0];
}

async function makeAuthUser(cargo: "ADMIN" | "LIDER_MINISTERIO" = "ADMIN"): Promise<{
  id: string;
  nome: string;
  cargo: "ADMIN" | "LIDER_MINISTERIO";
}> {
  const m = await prismaTest.membro.create({
    data: {
      nome: "Test User",
      email: `auth-${Date.now()}-${Math.random()}@igreja.local`,
      tipo: "MEMBRO_ATIVO",
      cargo,
      senhaHash: await hashPassword("senha-123"),
    },
  });
  return { id: m.id, nome: m.nome, cargo };
}

describe("membros.novo — action (S02-T06)", () => {
  it("sucesso: cria membro VISITANTE e redireciona 302 para /app/membros/:id", async () => {
    const user = await makeAuthUser();
    const request = makePostRequest({
      nome: "Maria Nova",
      tipo: "VISITANTE",
      email: "maria.nova@igreja.local",
    });

    const res = await action(actionArgs(request, user));
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(302);
    const location = (res as Response).headers.get("Location");
    expect(location).toMatch(/^\/app\/membros\/[a-f0-9-]+$/);

    // Confirma persistência
    const created = await prismaTest.membro.findFirst({
      where: { nome: "Maria Nova" },
    });
    expect(created).not.toBeNull();
    expect(created?.tipo).toBe("VISITANTE");
    expect(created?.email).toBe("maria.nova@igreja.local");
  });

  it("email duplicado: 422 com fieldError.email em PT-BR", async () => {
    await prismaTest.membro.create({
      data: { nome: "Existente", email: "duplicado@x.com" },
    });
    const user = await makeAuthUser();
    const request = makePostRequest({
      nome: "Outro",
      tipo: "VISITANTE",
      email: "duplicado@x.com",
    });

    try {
      await action(actionArgs(request, user));
      expect.fail("deveria ter lançado");
    } catch (e) {
      expect(e).toBeInstanceOf(Response);
      const res = e as Response;
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.fieldErrors?.email).toBe("Este e-mail já está cadastrado.");
    }
  });

  it("validação Zod falha (nome < 2 chars): 422 com fieldErrors", async () => {
    const user = await makeAuthUser();
    const request = makePostRequest({ nome: "A", tipo: "VISITANTE" });

    try {
      await action(actionArgs(request, user));
      expect.fail("deveria ter lançado");
    } catch (e) {
      expect(e).toBeInstanceOf(Response);
      const res = e as Response;
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.fieldErrors?.nome).toBeTruthy();
    }
  });

  it("validação Zod falha (CEP inválido): 422 com mensagem PT-BR", async () => {
    const user = await makeAuthUser();
    const request = makePostRequest({
      nome: "Maria",
      tipo: "VISITANTE",
      cep: "123",
    });

    try {
      await action(actionArgs(request, user));
      expect.fail("deveria ter lançado");
    } catch (e) {
      const body = await (e as Response).json();
      expect(body.fieldErrors?.cep).toBe("CEP inválido. Use o formato 00000-000.");
    }
  });

  it("dataBatismo < dataConversao: 422 com fieldError.dataBatismo", async () => {
    const user = await makeAuthUser();
    const request = makePostRequest({
      nome: "Maria",
      tipo: "VISITANTE",
      dataConversao: "2020-06-15",
      dataBatismo: "2020-05-10",
    });

    try {
      await action(actionArgs(request, user));
      expect.fail("deveria ter lançado");
    } catch (e) {
      const body = await (e as Response).json();
      expect(body.fieldErrors?.dataBatismo).toBe(
        "Data de batismo não pode ser anterior à data de conversão."
      );
    }
  });

  it("GATE LGPD: rejeita cpf no payload via Zod .strict()", async () => {
    const user = await makeAuthUser();
    const request = makePostRequest({
      nome: "Maria",
      tipo: "VISITANTE",
      cpf: "529.982.247-25",
    });

    try {
      await action(actionArgs(request, user));
      expect.fail("deveria ter lançado");
    } catch (e) {
      // .strict() gera issue com code "unrecognized_keys"
      expect(e).toBeInstanceOf(Response);
      expect((e as Response).status).toBe(422);
    }
  });
});
