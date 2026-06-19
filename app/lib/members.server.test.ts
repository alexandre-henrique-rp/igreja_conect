/**
 * Teste de integração de app/lib/members.server.ts (S02-T02).
 *
 * Cobre:
 *  - listMembros com filtros (tipo, q, paginação)
 *  - RBAC fina: DISCIPULADOR vê APENAS seus discípulos
 *  - getMembroById: ADMIN/PASTOR/SECRETARIO vê; DISCIPULADOR fora de escopo → 404
 *  - createMembro: happy path, email duplicado → EmailDuplicadoError, assertCanWriteMembers
 *  - updateMembro: happy path, escopo
 *  - deleteMembro: happy path, com discípulos vinculados → BusinessRuleError, só ADMIN/PASTOR
 *  - MEMBRO_SAFE_SELECT não inclui senhaHash (LGPD AC-16)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prismaTest, setupTestDb } from "../../tests/helpers/db";
import type { SessionUser } from "./session.types";

// Re-importados DEPOIS de setupTestDb (via vi.resetModules) para garantir
// que o singleton de `~/db/prisma.server` seja criado com a URL de teste.
// IMPORTANTE: as classes de erro e os services DEVEM ser da MESMA versão
// de módulo — `vi.resetModules` cria novas instâncias de classe, então
// importar `NotFoundError` no topo (estaticamente) e usar `instanceof`
// na cópia re-importada FALHA.
let cleanup: () => Promise<void>;
let listMembros: typeof import("./members.server").listMembros;
let getMembroById: typeof import("./members.server").getMembroById;
let createMembro: typeof import("./members.server").createMembro;
let updateMembro: typeof import("./members.server").updateMembro;
let deleteMembro: typeof import("./members.server").deleteMembro;
let promoverTipo: typeof import("./members.server").promoverTipo;
let MEMBRO_SAFE_SELECT: typeof import("./members.server").MEMBRO_SAFE_SELECT;
let EmailDuplicadoError: typeof import("./errors").EmailDuplicadoError;
let BusinessRuleError: typeof import("./errors").BusinessRuleError;
let NotFoundError: typeof import("./errors").NotFoundError;
let ZodError: typeof import("zod").ZodError;

beforeAll(async () => {
  cleanup = await setupTestDb("members.server");
  vi.resetModules();
  const mod = await import("./members.server");
  listMembros = mod.listMembros;
  getMembroById = mod.getMembroById;
  createMembro = mod.createMembro;
  updateMembro = mod.updateMembro;
  deleteMembro = mod.deleteMembro;
  MEMBRO_SAFE_SELECT = mod.MEMBRO_SAFE_SELECT;
  if (mod.promoverTipo) {
    promoverTipo = mod.promoverTipo;
  }
  // Importa as classes de erro DO MESMO módulo reimportado (mesma instância)
  const errMod = await import("./errors");
  EmailDuplicadoError = errMod.EmailDuplicadoError;
  BusinessRuleError = errMod.BusinessRuleError;
  NotFoundError = errMod.NotFoundError;
  const zodMod = await import("zod");
  ZodError = zodMod.ZodError;
});

afterAll(async () => { await cleanup(); });

beforeEach(async () => {
  // Apaga dependentes antes do membro (FKs do schema)
  await prismaTest.alertaDestinatario.deleteMany();
  await prismaTest.alerta.deleteMany();
  await prismaTest.configuracaoGeral.deleteMany();
  await prismaTest.ministerioMembro.deleteMany();
  await prismaTest.ministerio.deleteMany();
  await prismaTest.movimentacaoEstoque.deleteMany();
  await prismaTest.manutencaoAtivo.deleteMany();
  await prismaTest.lancamento.deleteMany();
  await prismaTest.transferenciaCaixa.deleteMany();
  await prismaTest.session.deleteMany();
  // Membro tem auto-FK discipulador (Restrict) — primeiro desatrelar filhos
  await prismaTest.membro.updateMany({ data: { discipuladorId: null } });
  await prismaTest.membro.deleteMany();
});

// ----------------- helpers -----------------

function adminUser(): SessionUser {
  return { id: "u-admin", nome: "Admin", cargo: "ADMIN" };
}
function pastorUser(): SessionUser {
  return { id: "u-pastor", nome: "Pastor", cargo: "PASTOR" };
}
function secretarioUser(): SessionUser {
  return { id: "u-secretario", nome: "Secretário", cargo: "SECRETARIO" };
}
function discipuladorUser(): SessionUser {
  return { id: "u-disc", nome: "Discipulador", cargo: "DISCIPULADOR" };
}
function liderUser(): SessionUser {
  return { id: "u-lider", nome: "Líder", cargo: "LIDER_MINISTERIO" };
}

async function makeMembro(opts: {
  nome: string;
  tipo?: "VISITANTE" | "CONGREGADO" | "MEMBRO_ATIVO";
  cargo?: "ADMIN" | "PASTOR" | "SECRETARIO" | "DISCIPULADOR" | "FINANCEIRO" | "LIDER_MINISTERIO" | null;
  email?: string;
  discipuladorId?: string | null;
}): Promise<{ id: string }> {
  const m = await prismaTest.membro.create({
    data: {
      nome: opts.nome,
      tipo: opts.tipo ?? "VISITANTE",
      cargo: opts.cargo ?? null,
      email: opts.email ?? null,
      discipuladorId: opts.discipuladorId ?? null,
    },
  });
  return { id: m.id };
}

// ----------------- MEMBRO_SAFE_SELECT -----------------

describe("members.server — MEMBRO_SAFE_SELECT (LGPD AC-16)", () => {
  it("não inclui senhaHash", () => {
    expect("senhaHash" in MEMBRO_SAFE_SELECT).toBe(false);
  });

  it("inclui campos básicos de listagem", () => {
    expect(MEMBRO_SAFE_SELECT.id).toBe(true);
    expect(MEMBRO_SAFE_SELECT.nome).toBe(true);
    expect(MEMBRO_SAFE_SELECT.tipo).toBe(true);
    expect(MEMBRO_SAFE_SELECT.email).toBe(true);
  });
});

// ----------------- listMembros -----------------

describe("members.server — listMembros", () => {
  it("retorna lista paginada (25/pág) para ADMIN sem filtros", async () => {
    await makeMembro({ nome: "Visitante 1" });
    await makeMembro({ nome: "Visitante 2" });
    await makeMembro({ nome: "Membro 1", tipo: "MEMBRO_ATIVO" });

    const res = await listMembros({}, adminUser());
    expect(res.items.length).toBe(3);
    expect(res.page).toBe(1);
    expect(res.pageSize).toBe(25);
    expect(res.total).toBe(3);
  });

  it("filtra por tipo (VISITANTE)", async () => {
    await makeMembro({ nome: "V1" });
    await makeMembro({ nome: "V2" });
    await makeMembro({ nome: "M1", tipo: "MEMBRO_ATIVO" });

    const res = await listMembros({ tipo: "VISITANTE" }, adminUser());
    expect(res.items.length).toBe(2);
    expect(res.items.every((m) => m.tipo === "VISITANTE")).toBe(true);
  });

  it("filtra por texto (q) — match em nome, case-insensitive", async () => {
    await makeMembro({ nome: "Maria Silva" });
    await makeMembro({ nome: "João Pereira" });
    await makeMembro({ nome: "MARIAna Souza" });

    const res = await listMembros({ q: "maria" }, adminUser());
    expect(res.items.length).toBe(2);
    expect(res.items.map((m) => m.nome).sort()).toEqual(["MARIAna Souza", "Maria Silva"]);
  });

  it("normaliza q (trim + slice 100 chars)", async () => {
    const longQ = "  " + "a".repeat(150) + "  ";
    const res = await listMembros({ q: longQ }, adminUser());
    expect(res.items.length).toBe(0); // só normalizou, sem match
  });

  it("paginação: ?page=2&pageSize=10", async () => {
    for (let i = 0; i < 15; i++) {
      await makeMembro({ nome: `Membro ${i}` });
    }
    const res = await listMembros({ page: 2, pageSize: 10 }, adminUser());
    expect(res.items.length).toBe(5);
    expect(res.page).toBe(2);
    expect(res.pageSize).toBe(10);
    expect(res.total).toBe(15);
  });

  it("RBAC fina: DISCIPULADOR vê APENAS seus discípulos", async () => {
    const disc = await makeMembro({ nome: "Discipulador X", cargo: "DISCIPULADOR" });
    await makeMembro({ nome: "Discípulo A", discipuladorId: disc.id });
    await makeMembro({ nome: "Discípulo B", discipuladorId: disc.id });
    await makeMembro({ nome: "Outro Sem Vínculo" });

    const res = await listMembros(
      {},
      { id: disc.id, nome: "Discipulador X", cargo: "DISCIPULADOR" }
    );
    expect(res.items.length).toBe(2);
    expect(res.items.every((m) => m.discipuladorId === disc.id)).toBe(true);
  });

  it("RBAC fina: DISCIPULADOR com filtro tipo — escopo continua restrito", async () => {
    const disc = await makeMembro({ nome: "Discipulador Y", cargo: "DISCIPULADOR" });
    await makeMembro({ nome: "Discípulo V", discipuladorId: disc.id, tipo: "VISITANTE" });
    await makeMembro({ nome: "Discípulo M", discipuladorId: disc.id, tipo: "MEMBRO_ATIVO" });

    const res = await listMembros(
      { tipo: "MEMBRO_ATIVO" },
      { id: disc.id, nome: "Discipulador Y", cargo: "DISCIPULADOR" }
    );
    expect(res.items.length).toBe(1);
    expect(res.items[0].nome).toBe("Discípulo M");
  });
});

// ----------------- getMembroById -----------------

describe("members.server — getMembroById", () => {
  it("ADMIN pode ver qualquer membro", async () => {
    const m = await makeMembro({ nome: "Qualquer" });
    const found = await getMembroById(m.id, adminUser());
    expect(found.id).toBe(m.id);
  });

  it("DISCIPULADOR: 404 (não 403) para membro fora de escopo (não vaza existência)", async () => {
    const m = await makeMembro({ nome: "Fora de Escopo" });
    await expect(getMembroById(m.id, discipuladorUser())).rejects.toThrow(NotFoundError);
  });

  it("DISCIPULADOR: pode ver seu próprio registro", async () => {
    const disc = await makeMembro({ nome: "Eu", cargo: "DISCIPULADOR" });
    const found = await getMembroById(disc.id, {
      id: disc.id,
      nome: "Eu",
      cargo: "DISCIPULADOR",
    });
    expect(found.id).toBe(disc.id);
  });

  it("DISCIPULADOR: pode ver discípulo vinculado", async () => {
    const disc = await makeMembro({ nome: "Disc", cargo: "DISCIPULADOR" });
    const filho = await makeMembro({ nome: "Filho", discipuladorId: disc.id });
    const found = await getMembroById(filho.id, {
      id: disc.id,
      nome: "Disc",
      cargo: "DISCIPULADOR",
    });
    expect(found.id).toBe(filho.id);
  });

  it("membro inexistente → 404", async () => {
    await expect(
      getMembroById("00000000-0000-0000-0000-000000000000", adminUser())
    ).rejects.toThrow(NotFoundError);
  });

  it("SECRETARIO pode ver qualquer membro (RBAC fina: leitura ampla)", async () => {
    const m = await makeMembro({ nome: "Qualquer 2" });
    const found = await getMembroById(m.id, secretarioUser());
    expect(found.id).toBe(m.id);
  });
});

// ----------------- createMembro -----------------

describe("members.server — createMembro", () => {
  it("happy path: ADMIN cria membro VISITANTE", async () => {
    const created = await createMembro(
      { nome: "Maria", tipo: "VISITANTE", email: "maria@x.com" },
      adminUser()
    );
    expect(created.id).toBeTruthy();
    expect(created.nome).toBe("Maria");
    expect(created.tipo).toBe("VISITANTE");
  });

  it("VISITANTE sem config de acolhimento: cria membro sem alerta (warning log)", async () => {
    const created = await createMembro({ nome: "Visitante Sem Config", tipo: "VISITANTE" }, adminUser());
    expect(created.id).toBeTruthy();
    const alertas = await prismaTest.alerta.count();
    expect(alertas).toBe(0);
  });

  it("VISITANTE com config sem responsável: cria membro sem alerta", async () => {
    await prismaTest.configuracaoGeral.create({
      data: {
        id: "singleton",
        responsavelVisitanteTipo: "MEMBRO",
        responsavelMembroId: null,
      },
    });

    const created = await createMembro({ nome: "Visitante Config Inválida", tipo: "VISITANTE" }, adminUser());

    expect(created.id).toBeTruthy();
    const alertas = await prismaTest.alerta.count();
    expect(alertas).toBe(0);
  });

  it("VISITANTE com config MINISTERIO: cria alerta + N destinatários", async () => {
    const ministerio = await prismaTest.ministerio.create({ data: { nome: "Acolhimento" } });
    const m1 = await prismaTest.membro.create({ data: { nome: "M1", tipo: "MEMBRO_ATIVO", cargo: "ADMIN" } });
    const m2 = await prismaTest.membro.create({ data: { nome: "M2", tipo: "MEMBRO_ATIVO", cargo: "ADMIN" } });
    await prismaTest.ministerioMembro.createMany({
      data: [
        { ministerioId: ministerio.id, membroId: m1.id },
        { ministerioId: ministerio.id, membroId: m2.id },
      ],
    });
    await prismaTest.configuracaoGeral.create({
      data: {
        id: "singleton",
        responsavelVisitanteTipo: "MINISTERIO",
        responsavelMinisterioId: ministerio.id,
      },
    });

    const created = await createMembro({ nome: "Visitante Min", tipo: "VISITANTE" }, adminUser());

    const alertas = await prismaTest.alerta.findMany({
      where: { destinatarios: { some: { membroId: created.id } } },
      include: { destinatarios: true },
    });
    expect(alertas).toHaveLength(1);
    expect(alertas[0].destinatarios).toHaveLength(2);
  });

  it("MEMBRO_ATIVO (não VISITANTE): não cria alerta mesmo com config", async () => {
    const responsavel = await prismaTest.membro.create({
      data: { nome: "Resp", tipo: "MEMBRO_ATIVO", cargo: "ADMIN" },
    });
    await prismaTest.configuracaoGeral.create({
      data: {
        id: "singleton",
        responsavelVisitanteTipo: "MEMBRO",
        responsavelMembroId: responsavel.id,
      },
    });

    const created = await createMembro({ nome: "Membro Ativo", tipo: "MEMBRO_ATIVO" }, adminUser());

    const alertas = await prismaTest.alerta.findMany({
      where: { destinatarios: { some: { membroId: created.id } } },
    });
    expect(alertas).toHaveLength(0);
  });

  it("atomicidade: email duplicado → rollback total (nem membro nem alerta)", async () => {
    // Cria um membro para ocupar o email
    await prismaTest.membro.create({
      data: { nome: "Existente", email: "duplicado@x.com", tipo: "MEMBRO_ATIVO" },
    });
    // Configura acolhimento
    const responsavel = await prismaTest.membro.create({
      data: { nome: "Resp", tipo: "MEMBRO_ATIVO", cargo: "ADMIN" },
    });
    await prismaTest.configuracaoGeral.create({
      data: {
        id: "singleton",
        responsavelVisitanteTipo: "MEMBRO",
        responsavelMembroId: responsavel.id,
      },
    });

    // Tenta criar com email duplicado
    await expect(
      createMembro(
        { nome: "Duplicado", tipo: "VISITANTE", email: "duplicado@x.com" },
        adminUser()
      )
    ).rejects.toThrow(EmailDuplicadoError);

    // Verifica que nenhum alerta foi criado (rollback completo)
    const alertas = await prismaTest.alerta.count();
    expect(alertas).toBe(0);
  });

  it("email duplicado → EmailDuplicadoError (P2002)", async () => {
    await prismaTest.membro.create({
      data: { nome: "Primeiro", email: "duplicado@x.com" },
    });
    await expect(
      createMembro(
        { nome: "Segundo", tipo: "VISITANTE", email: "duplicado@x.com" },
        adminUser()
      )
    ).rejects.toThrow(EmailDuplicadoError);
  });

  it("RBAC: usuário sem cargo (não autenticado-admin) → ForbiddenError", async () => {
    await expect(
      createMembro(
        { nome: "Qualquer", tipo: "VISITANTE" },
        { id: "u-anon", nome: "Anônimo", cargo: null }
      )
    ).rejects.toThrow();
  });

  it("DISCIPULADOR pode criar (RN-MEM-01: qualquer autenticado escreve)", async () => {
    const disc = await makeMembro({ nome: "Disc", cargo: "DISCIPULADOR" });
    const created = await createMembro(
      { nome: "Discípulo Novo", tipo: "VISITANTE" },
      { id: disc.id, nome: "Disc", cargo: "DISCIPULADOR" }
    );
    expect(created.nome).toBe("Discípulo Novo");
  });
});

// ----------------- updateMembro -----------------

describe("members.server — updateMembro", () => {
  it("happy path: atualiza nome e telefone", async () => {
    const m = await makeMembro({ nome: "Antigo" });
    const updated = await updateMembro(
      m.id,
      { nome: "Novo", telefone: "11988887777" },
      adminUser()
    );
    expect(updated.nome).toBe("Novo");
    expect(updated.telefone).toBe("11988887777");
  });

  it("DISCIPULADOR pode editar discípulo vinculado", async () => {
    const disc = await makeMembro({ nome: "Disc", cargo: "DISCIPULADOR" });
    const filho = await makeMembro({ nome: "Filho", discipuladorId: disc.id });
    const updated = await updateMembro(
      filho.id,
      { nome: "Filho Atualizado" },
      { id: disc.id, nome: "Disc", cargo: "DISCIPULADOR" }
    );
    expect(updated.nome).toBe("Filho Atualizado");
  });

  it("DISCIPULADOR tentando editar membro fora de escopo → NotFoundError", async () => {
    const m = await makeMembro({ nome: "Fora" });
    await expect(
      updateMembro(m.id, { nome: "Hacked" }, discipuladorUser())
    ).rejects.toThrow(NotFoundError);
  });

  it("membro inexistente → NotFoundError", async () => {
    await expect(
      updateMembro("00000000-0000-0000-0000-000000000000", { nome: "X" }, adminUser())
    ).rejects.toThrow(NotFoundError);
  });
});

// ----------------- deleteMembro -----------------

describe("members.server — deleteMembro", () => {
  it("ADMIN pode deletar membro sem discípulos", async () => {
    const m = await makeMembro({ nome: "Apagável" });
    await deleteMembro(m.id, adminUser());
    const found = await prismaTest.membro.findUnique({ where: { id: m.id } });
    expect(found).toBeNull();
  });

  it("PASTOR pode deletar membro sem discípulos", async () => {
    const m = await makeMembro({ nome: "Apagável P" });
    await deleteMembro(m.id, pastorUser());
    const found = await prismaTest.membro.findUnique({ where: { id: m.id } });
    expect(found).toBeNull();
  });

  it("SECRETARIO NÃO pode deletar (RN-MEM-04 + S02: só ADMIN/PASTOR)", async () => {
    const m = await makeMembro({ nome: "Apagável S" });
    await expect(deleteMembro(m.id, secretarioUser())).rejects.toThrow();
  });

  it("DISCIPULADOR NÃO pode deletar (RN-MEM-04 + S02: só ADMIN/PASTOR)", async () => {
    const m = await makeMembro({ nome: "Apagável D" });
    await expect(deleteMembro(m.id, discipuladorUser())).rejects.toThrow();
  });

  it("LIDER_MINISTERIO NÃO pode deletar", async () => {
    const m = await makeMembro({ nome: "Apagável L" });
    await expect(deleteMembro(m.id, liderUser())).rejects.toThrow();
  });

  it("com discípulos vinculados → BusinessRuleError 409 (RN-MEM-04)", async () => {
    const pai = await makeMembro({ nome: "Pai Com Filhos" });
    await makeMembro({ nome: "Filho 1", discipuladorId: pai.id });
    await makeMembro({ nome: "Filho 2", discipuladorId: pai.id });

    await expect(deleteMembro(pai.id, adminUser())).rejects.toThrow(BusinessRuleError);
  });

  it("membro inexistente → NotFoundError", async () => {
    await expect(
      deleteMembro("00000000-0000-0000-0000-000000000000", adminUser())
    ).rejects.toThrow(NotFoundError);
  });
});

// ----------------- promoverTipo (S03-T02, RN-MEM-06) -----------------

describe("members.server — promoverTipo (RN-MEM-06)", () => {
  it("ADMIN promove VISITANTE → CONGREGADO", async () => {
    const m = await makeMembro({ nome: "Maria Visitante", tipo: "VISITANTE" });
    const updated = await promoverTipo(m.id, "CONGREGADO", adminUser());
    expect(updated.tipo).toBe("CONGREGADO");
  });

  it("ADMIN promove CONGREGADO → MEMBRO_ATIVO", async () => {
    const m = await makeMembro({ nome: "João Congregado", tipo: "CONGREGADO" });
    const updated = await promoverTipo(m.id, "MEMBRO_ATIVO", adminUser());
    expect(updated.tipo).toBe("MEMBRO_ATIVO");
  });

  it("PASTOR pode promover", async () => {
    const m = await makeMembro({ nome: "Ana", tipo: "VISITANTE" });
    const updated = await promoverTipo(m.id, "CONGREGADO", pastorUser());
    expect(updated.tipo).toBe("CONGREGADO");
  });

  it("SECRETARIO pode promover (qualquer autenticado, RN-MEM-01)", async () => {
    const m = await makeMembro({ nome: "Ana S", tipo: "VISITANTE" });
    const updated = await promoverTipo(m.id, "CONGREGADO", secretarioUser());
    expect(updated.tipo).toBe("CONGREGADO");
  });

  it("DISCIPULADOR pode promover (RN-MEM-01: qualquer autenticado escreve)", async () => {
    // Membro precisa estar no escopo do DISCIPULADOR (ser filho dele OU ser ele próprio)
    const disc = await makeMembro({ nome: "Disc Master", cargo: "DISCIPULADOR" });
    const m = await makeMembro({
      nome: "Ana D",
      tipo: "VISITANTE",
      discipuladorId: disc.id,
    });
    const updated = await promoverTipo(m.id, "CONGREGADO", {
      id: disc.id,
      nome: "Disc Master",
      cargo: "DISCIPULADOR",
    });
    expect(updated.tipo).toBe("CONGREGADO");
  });

  it("tipo inválido → ZodError (enum)", async () => {
    const m = await makeMembro({ nome: "X" });
    await expect(
      (promoverTipo as any)(m.id, "INVALIDO", adminUser())
    ).rejects.toThrow(ZodError);
  });

  it("membro inexistente → NotFoundError", async () => {
    await expect(
      promoverTipo("00000000-0000-0000-0000-000000000000", "CONGREGADO", adminUser())
    ).rejects.toThrow(NotFoundError);
  });

  it("DISCIPULADOR tentando promover membro fora de escopo → 404", async () => {
    const m = await makeMembro({ nome: "Fora" });
    await expect(
      promoverTipo(m.id, "CONGREGADO", discipuladorUser())
    ).rejects.toThrow(NotFoundError);
  });

  it("RN-MEM-06: retorna membro sem `senhaHash` (LGPD AC-16)", async () => {
    const m = await makeMembro({ nome: "Y" });
    const updated = await promoverTipo(m.id, "CONGREGADO", adminUser());
    expect((updated as any).senhaHash).toBeUndefined();
  });
});

// ==================== SEC-004: listarMembrosParaSelect coverage (S06-REWORK) ====================

describe("members.server — listarMembrosParaSelect (SEC-004)", () => {
  let listarMembrosParaSelect: typeof import("./members.server").listarMembrosParaSelect;

  beforeAll(async () => {
    vi.resetModules();
    const mod = await import("./members.server");
    listarMembrosParaSelect = mod.listarMembrosParaSelect;
  });

  it("ADMIN pode listar membros para select", async () => {
    await prismaTest.membro.create({
      data: { nome: "Maria", email: "maria@test.com", tipo: "MEMBRO_ATIVO" },
    });
    const result = await listarMembrosParaSelect(adminUser());
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("id");
    expect(result[0]).toHaveProperty("nome");
  });

  it("SECRETARIO pode listar membros para select (assertCanWriteLancamento)", async () => {
    let caught: unknown = null;
    try {
      await listarMembrosParaSelect(secretarioUser());
    } catch (e) {
      caught = e;
    }
    // SECRETARIO is in FINANCIAL_MODULE_CARGOS, should NOT throw
    expect(caught).toBeNull();
  });
});
