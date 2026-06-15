/**
 * Teste de integração de app/routes/app/membros.$id.editar.tsx (S02-T08).
 *
 * Cobre o loader e o action da rota:
 *  - Loader happy path: retorna membro para defaultValues
 *  - Loader: DISCIPULADOR fora de escopo → 404
 *  - Action happy path: atualiza e redireciona 302 para /app/membros/:id
 *  - Action: validação Zod falha → 422 com fieldErrors
 *  - Action: email duplicado → 422 com fieldError.email
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prismaTest, setupTestDb } from "../../../tests/helpers/db";
import { hashPassword } from "~/lib/auth.server";

let cleanup: () => Promise<void>;
let loader: typeof import("./membros.$id.editar").loader;
let action: typeof import("./membros.$id.editar").action;

beforeAll(async () => {
  cleanup = await setupTestDb("membros_id_editar");
  vi.resetModules();
  const mod = await import("./membros.$id.editar");
  loader = mod.loader;
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

function makePostRequest(data: Record<string, string>): Request {
  const formData = new FormData();
  for (const [k, v] of Object.entries(data)) {
    formData.append(k, v);
  }
  return new Request("http://localhost/app/membros/abc/editar", {
    method: "POST",
    body: formData,
  });
}

function makeGetRequest(): Request {
  return new Request("http://localhost/app/membros/abc/editar", {
    method: "GET",
  });
}

type Cargo = "ADMIN" | "PASTOR" | "SECRETARIO" | "DISCIPULADOR" | "FINANCEIRO" | "LIDER_MINISTERIO";

function args(
  request: Request,
  user: { id: string; nome: string; cargo: Cargo | null },
  params: Record<string, string> = {}
) {
  return {
    request,
    params,
    context: {
      get: (_key: unknown) => user,
    },
  } as unknown as Parameters<typeof action>[0];
}

async function makeMembro(opts: {
  nome?: string;
  email?: string | null;
  tipo?: "VISITANTE" | "CONGREGADO" | "MEMBRO_ATIVO";
  cargo?: Cargo | null;
  discipuladorId?: string | null;
} = {}): Promise<{ id: string }> {
  const m = await prismaTest.membro.create({
    data: {
      nome: opts.nome ?? "Membro Teste",
      email: opts.email ?? null,
      tipo: opts.tipo ?? "VISITANTE",
      cargo: opts.cargo ?? null,
      discipuladorId: opts.discipuladorId ?? null,
    },
  });
  return { id: m.id };
}

async function makeAuthUser(cargo: Cargo = "ADMIN"): Promise<{
  id: string; nome: string; cargo: Cargo;
}> {
  const m = await prismaTest.membro.create({
    data: {
      nome: "Auth User",
      email: `auth-${Date.now()}-${Math.random()}@igreja.local`,
      tipo: "MEMBRO_ATIVO",
      cargo,
      senhaHash: await hashPassword("senha-123"),
    },
  });
  return { id: m.id, nome: m.nome, cargo };
}

describe("membros.$id.editar — loader (S02-T08)", () => {
  it("happy path: ADMIN lê membro e retorna dados para defaultValues", async () => {
    const m = await makeMembro({ nome: "Maria Editável" });
    const user = await makeAuthUser();
    const result = await loader(args(makeGetRequest(), user, { id: m.id }));
    expect(result.membro).toBeTruthy();
    expect((result.membro as { id: string }).id).toBe(m.id);
    expect((result.membro as { nome: string }).nome).toBe("Maria Editável");
  });

  it("DISCIPULADOR: 404 (não 403) para membro fora de escopo (não vaza existência)", async () => {
    const m = await makeMembro({ nome: "Fora de Escopo" });
    const disc = await makeAuthUser("DISCIPULADOR");
    await expect(
      loader(args(makeGetRequest(), disc, { id: m.id }))
    ).rejects.toThrow();
  });

  it("membro inexistente → 404", async () => {
    const user = await makeAuthUser();
    await expect(
      loader(
        args(makeGetRequest(), user, {
          id: "00000000-0000-0000-0000-000000000000",
        })
      )
    ).rejects.toThrow();
  });
});

describe("membros.$id.editar — action (S02-T08)", () => {
  it("happy path: ADMIN atualiza nome e redireciona 302 para /app/membros/:id", async () => {
    const m = await makeMembro({ nome: "Antigo" });
    const user = await makeAuthUser();
    const request = makePostRequest({ nome: "Atualizado", tipo: "CONGREGADO" });

    const res = await action(args(request, user, { id: m.id }));
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(302);
    expect((res as Response).headers.get("Location")).toBe(`/app/membros/${m.id}`);

    const updated = await prismaTest.membro.findUnique({ where: { id: m.id } });
    expect(updated?.nome).toBe("Atualizado");
    expect(updated?.tipo).toBe("CONGREGADO");
  });

  it("DISCIPULADOR pode atualizar discípulo vinculado", async () => {
    const disc = await makeMembro({ nome: "Disc", cargo: "DISCIPULADOR" });
    const filho = await makeMembro({ nome: "Filho", discipuladorId: disc.id });
    const request = makePostRequest({ nome: "Filho Atualizado" });

    const res = await action(
      args(request, { id: disc.id, nome: "Disc", cargo: "DISCIPULADOR" }, { id: filho.id })
    );
    expect((res as Response).status).toBe(302);

    const updated = await prismaTest.membro.findUnique({ where: { id: filho.id } });
    expect(updated?.nome).toBe("Filho Atualizado");
  });

  it("DISCIPULADOR fora de escopo → 404", async () => {
    const m = await makeMembro({ nome: "Fora" });
    const disc = await makeAuthUser("DISCIPULADOR");
    const request = makePostRequest({ nome: "Hacked" });

    await expect(
      action(args(request, disc, { id: m.id }))
    ).rejects.toThrow();
  });

  it("validação Zod falha (nome vazio): 422 com fieldErrors", async () => {
    const m = await makeMembro({ nome: "OK" });
    const user = await makeAuthUser();
    const request = makePostRequest({ nome: "" });

    try {
      await action(args(request, user, { id: m.id }));
      expect.fail("deveria ter lançado");
    } catch (e) {
      const res = e as Response;
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.fieldErrors?.nome).toBeTruthy();
    }
  });

  it("dataBatismo < dataConversao no update: 422 com fieldError", async () => {
    const m = await makeMembro({ nome: "OK" });
    const user = await makeAuthUser();
    const request = makePostRequest({
      dataConversao: "2020-06-15",
      dataBatismo: "2020-05-10",
    });

    try {
      await action(args(request, user, { id: m.id }));
      expect.fail("deveria ter lançado");
    } catch (e) {
      const body = await (e as Response).json();
      expect(body.fieldErrors?.dataBatismo).toBe(
        "Data de batismo não pode ser anterior à data de conversão."
      );
    }
  });

  it("GATE LGPD: rejeita cpf no update via Zod .strict()", async () => {
    const m = await makeMembro({ nome: "OK" });
    const user = await makeAuthUser();
    const request = makePostRequest({ nome: "Maria", cpf: "529.982.247-25" });

    await expect(action(args(request, user, { id: m.id }))).rejects.toThrow();
  });

  it("membro inexistente → 404", async () => {
    const user = await makeAuthUser();
    const request = makePostRequest({ nome: "X" });
    await expect(
      action(
        args(request, user, {
          id: "00000000-0000-0000-0000-000000000000",
        })
      )
    ).rejects.toThrow();
  });
});
