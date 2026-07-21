/**
 * Seed idempotente — Igreja Conect (S00-T13).
 *
 * Cria o ADMIN inicial (`admin@igreja.local` / `admin123`) + membros
 * completos, ministérios com líderes, caixas, lançamentos financeiros
 * com 18+ meses de histórico, itens de estoque com movimentações, e
 * logs de auditoria. Pode ser rodado múltiplas vezes (idempotente via
 * findUnique/upsert).
 *
 * **ATENÇÃO:** a senha `admin123` é APENAS para o ambiente de
 * desenvolvimento. Trocar imediatamente em produção.
 */
import "dotenv/config";
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

// ─── Helpers ───────────────────────────────────────────

/** Cria data no passado a partir de string ISO. */
function d(iso: string): Date {
  return new Date(iso);
}

/** Gera valor em centavos a partir de reais. */
function rs(reais: number): number {
  return Math.round(reais * 100);
}

/** Soma de meses a uma data (para gerar histórico de 18+ meses). */
function addMonths(date: Date, months: number): Date {
  const r = new Date(date);
  r.setMonth(r.getMonth() + months);
  return r;
}

// ─── Dados de Membros (completos) ──────────────────────

type MockMembro = {
  nome: string;
  email: string;
  senha?: string;
  tipo: "VISITANTE" | "CONGREGADO" | "MEMBRO_ATIVO";
  cargo?: "ADMIN" | "PASTOR" | "SECRETARIO" | "FINANCEIRO" | "LIDER_MINISTERIO";
  telefone?: string;
  profissao?: string;
  estadoCivil?: string;
  dataConversao?: Date;
  dataBatismo?: Date;
  dataNascimento?: Date;
  sexo?: string;
  status?: string;
  grupo?: string;
  isDiscipulador?: boolean;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  complemento?: string;
  createdAt: Date;
};

const MOCK_MEMBROS: MockMembro[] = [
  {
    nome: "Ricardo Oliveira",
    email: "ricardo.o@email.com",
    senha: "ricardo123",
    tipo: "MEMBRO_ATIVO",
    cargo: "PASTOR",
    telefone: "(11) 98765-4321",
    profissao: "Pastor",
    estadoCivil: "Casado",
    dataConversao: d("2005-06-15T00:00:00Z"),
    dataBatismo: d("2005-09-20T00:00:00Z"),
    dataNascimento: d("1980-04-12T00:00:00Z"),
    sexo: "Masculino",
    status: "Ativo",
    grupo: "Liderança",
    isDiscipulador: true,
    logradouro: "Rua das Flores",
    numero: "123",
    bairro: "Centro",
    cidade: "São Paulo",
    estado: "SP",
    cep: "01000-000",
    createdAt: d("2022-03-12T12:00:00Z"),
  },
  {
    nome: "Ana Beatriz Costa",
    email: "ana.beatriz@email.com",
    senha: "ana12345",
    tipo: "MEMBRO_ATIVO",
    cargo: "SECRETARIO",
    telefone: "(11) 98888-7777",
    profissao: "Secretária",
    estadoCivil: "Solteira",
    dataConversao: d("2015-02-10T00:00:00Z"),
    dataBatismo: d("2015-05-15T00:00:00Z"),
    dataNascimento: d("1992-11-03T00:00:00Z"),
    sexo: "Feminino",
    status: "Ativo",
    grupo: "Secretaria",
    isDiscipulador: true,
    logradouro: "Av. Paulista",
    numero: "1000",
    bairro: "Bela Vista",
    cidade: "São Paulo",
    estado: "SP",
    cep: "01310-100",
    createdAt: d("2023-11-05T12:00:00Z"),
  },
  {
    nome: "Marcos Vinícius",
    email: "m.vinicius@email.com",
    senha: "marcos123",
    tipo: "MEMBRO_ATIVO",
    cargo: "FINANCEIRO",
    telefone: "(11) 97777-6666",
    profissao: "Contador",
    estadoCivil: "Casado",
    dataConversao: d("2010-08-01T00:00:00Z"),
    dataBatismo: d("2010-11-10T00:00:00Z"),
    dataNascimento: d("1985-07-22T00:00:00Z"),
    sexo: "Masculino",
    status: "Ativo",
    grupo: "Financeiro",
    logradouro: "Rua dos Pinheiros",
    numero: "456",
    bairro: "Pinheiros",
    cidade: "São Paulo",
    estado: "SP",
    cep: "05422-000",
    createdAt: d("2021-01-18T12:00:00Z"),
  },
  {
    nome: "Juliana Santos",
    email: "juliana.s@email.com",
    senha: "juliana123",
    tipo: "MEMBRO_ATIVO",
    cargo: "LIDER_MINISTERIO",
    telefone: "(11) 96666-5555",
    profissao: "Professora",
    estadoCivil: "Solteira",
    dataConversao: d("2018-03-20T00:00:00Z"),
    dataBatismo: d("2018-06-30T00:00:00Z"),
    dataNascimento: d("1995-01-15T00:00:00Z"),
    sexo: "Feminino",
    status: "Ativo",
    grupo: "Louvor",
    isDiscipulador: true,
    logradouro: "Rua Augusta",
    numero: "789",
    bairro: "Consolação",
    cidade: "São Paulo",
    estado: "SP",
    cep: "01305-100",
    createdAt: d("2020-08-30T12:00:00Z"),
  },
  {
    nome: "Pedro Henrique Alves",
    email: "pedro.h@email.com",
    tipo: "MEMBRO_ATIVO",
    telefone: "(11) 95555-4444",
    profissao: "Engenheiro",
    estadoCivil: "Casado",
    dataConversao: d("2019-05-05T00:00:00Z"),
    dataBatismo: d("2019-08-12T00:00:00Z"),
    dataNascimento: d("1988-09-30T00:00:00Z"),
    sexo: "Masculino",
    status: "Ativo",
    grupo: "Juventude",
    logradouro: "Rua Teodoro Sampaio",
    numero: "321",
    bairro: "Vila Madalena",
    cidade: "São Paulo",
    estado: "SP",
    cep: "05406-000",
    createdAt: d("2021-06-15T12:00:00Z"),
  },
  {
    nome: "Fernanda Lima",
    email: "fernanda.l@email.com",
    tipo: "CONGREGADO",
    telefone: "(11) 94444-3333",
    profissao: "Enfermeira",
    estadoCivil: "Solteira",
    dataConversao: d("2022-01-10T00:00:00Z"),
    dataNascimento: d("1998-12-05T00:00:00Z"),
    sexo: "Feminino",
    status: "Ativo",
    grupo: "Visitantes",
    logradouro: "Rua Haddock Lobo",
    numero: "200",
    bairro: "Cerqueira César",
    cidade: "São Paulo",
    estado: "SP",
    cep: "01414-000",
    createdAt: d("2023-01-10T12:00:00Z"),
  },
  {
    nome: "Lucas Ferreira",
    email: "lucas.f@email.com",
    tipo: "VISITANTE",
    telefone: "(11) 93333-2222",
    dataNascimento: d("2000-03-18T00:00:00Z"),
    sexo: "Masculino",
    status: "Pendente",
    grupo: "Visitantes",
    cidade: "São Paulo",
    estado: "SP",
    createdAt: d("2024-02-01T12:00:00Z"),
  },
  {
    nome: "Beatriz Carvalho",
    email: "bia.carvalho@email.com",
    senha: "bia12345",
    tipo: "MEMBRO_ATIVO",
    telefone: "(11) 92222-1111",
    profissao: "Psicóloga",
    estadoCivil: "Casada",
    dataConversao: d("2013-04-07T00:00:00Z"),
    dataBatismo: d("2013-07-14T00:00:00Z"),
    dataNascimento: d("1990-06-25T00:00:00Z"),
    sexo: "Feminino",
    status: "Ativo",
    grupo: "Discipulado",
    isDiscipulador: true,
    logradouro: "Rua Oscar Freire",
    numero: "150",
    bairro: "Jardins",
    cidade: "São Paulo",
    estado: "SP",
    cep: "01426-001",
    createdAt: d("2022-09-20T12:00:00Z"),
  },
];

// ─── Ministérios ───────────────────────────────────────

const MOCK_MINISTERIOS = [
  { nome: "Louvor", descricao: "Ministério de música e adoração" },
  { nome: "Infantil", descricao: "Ministério infantil — Kids Church" },
  { nome: "Acolhimento", descricao: "Recepção e integração de visitantes" },
  { nome: "Intercessão", descricao: "Cadeia de oração e intercessão" },
];

// ─── Caixas ────────────────────────────────────────────

const MOCK_CAIXAS = [
  { nome: "Caixa Geral", saldoCentavos: rs(15000) },
  { nome: "Caixa Missões", saldoCentavos: rs(3500) },
];

// ─── Itens de Estoque ──────────────────────────────────

const MOCK_ESTOQUE = [
  { nome: "Bíblia Sagrada NVI", tipo: "CONSUMO" as const, quantidade: 30, quantidadeMinima: 10, ativo: true },
  { nome: "Cesta básica (unid.)", tipo: "CONSUMO" as const, quantidade: 15, quantidadeMinima: 5, ativo: true },
  { nome: "Data Show Epson", tipo: "PATRIMONIO" as const, quantidade: 1, quantidadeMinima: 1, ativo: true, numeroSerie: "EP-S2024-001", statusPatrimonio: "DISPONIVEL" as const, localizacaoFisica: "Sala Principal" },
  { nome: "Teclado Yamaha PSR", tipo: "PATRIMONIO" as const, quantidade: 1, quantidadeMinima: 1, ativo: true, numeroSerie: "YAM-PSR-002", statusPatrimonio: "DISPONIVEL" as const, localizacaoFisica: "Palco" },
  { nome: "Cadeira dobrável", tipo: "CONSUMO" as const, quantidade: 50, quantidadeMinima: 20, ativo: true },
  { nome: "Microfone Sem Fio Shure", tipo: "PATRIMONIO" as const, quantidade: 2, quantidadeMinima: 1, ativo: true, numeroSerie: "SH-SLX-003", statusPatrimonio: "DISPONIVEL" as const, localizacaoFisica: "Palco" },
];

// ─── Seed Principal ────────────────────────────────────

/**
 * Cria o ADMIN inicial + dados de desenvolvimento. Idempotente.
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
    // ── 1. ADMIN ──────────────────────────────────────
    const senhaHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_COST);
    const admin = await prisma.membro.upsert({
      where: { email: ADMIN_EMAIL },
      update: {},
      create: {
        nome: "Administrador",
        email: ADMIN_EMAIL,
        senhaHash,
        tipo: "MEMBRO_ATIVO",
        cargo: "ADMIN",
        telefone: "(11) 90000-0000",
        status: "Ativo",
        grupo: "Administracao",
        isDiscipulador: true,
        createdAt: d("2020-01-01T00:00:00Z"),
      },
    });
    console.log(`[seed] ADMIN: ${admin.email} (id: ${admin.id})`);

    if (process.env.NODE_ENV === "production") {
      console.log("[seed] Ambiente de produção — pulando dados de desenvolvimento.");
      return;
    }

    // ── 2. Membros completos ──────────────────────────
    const membroIds: Record<string, string> = {};
    for (const m of MOCK_MEMBROS) {
      const hash = m.senha ? await bcrypt.hash(m.senha, BCRYPT_COST) : null;
      const created = await prisma.membro.upsert({
        where: { email: m.email },
        update: {},
        create: {
          nome: m.nome,
          email: m.email,
          senhaHash: hash,
          tipo: m.tipo,
          cargo: m.cargo ?? null,
          telefone: m.telefone ?? null,
          profissao: m.profissao ?? null,
          estadoCivil: m.estadoCivil ?? null,
          dataConversao: m.dataConversao ?? null,
          dataBatismo: m.dataBatismo ?? null,
          dataNascimento: m.dataNascimento ?? null,
          sexo: m.sexo ?? null,
          status: m.status ?? null,
          grupo: m.grupo ?? null,
          isDiscipulador: m.isDiscipulador ?? false,
          logradouro: m.logradouro ?? null,
          numero: m.numero ?? null,
          bairro: m.bairro ?? null,
          cidade: m.cidade ?? null,
          estado: m.estado ?? null,
          cep: m.cep ?? null,
          complemento: m.complemento ?? null,
          createdAt: m.createdAt,
        },
      });
      membroIds[m.nome] = created.id;
      console.log(`[seed] Membro: ${m.nome} (${m.tipo})`);
    }

    // ── 3. Discipulado (auto-relacionamento) ─────────
    // Ricardo discipula Pedro e Fernanda
    // Beatriz discipula Lucas
    await prisma.membro.update({
      where: { id: membroIds["Pedro Henrique Alves"] },
      data: { discipuladorId: membroIds["Ricardo Oliveira"] },
    }).catch(() => {});
    await prisma.membro.update({
      where: { id: membroIds["Fernanda Lima"] },
      data: { discipuladorId: membroIds["Ricardo Oliveira"] },
    }).catch(() => {});
    await prisma.membro.update({
      where: { id: membroIds["Lucas Ferreira"] },
      data: { discipuladorId: membroIds["Beatriz Carvalho"] },
    }).catch(() => {});
    console.log("[seed] Discipulado: 3 vínculos criados");

    // ── 4. Ministérios + Líderes ─────────────────────
    const ministerioIds: Record<string, string> = {};
    for (const min of MOCK_MINISTERIOS) {
      const created = await prisma.ministerio.upsert({
        where: { nome: min.nome },
        update: {},
        create: { nome: min.nome, descricao: min.descricao },
      });
      ministerioIds[min.nome] = created.id;
      console.log(`[seed] Ministério: ${min.nome}`);
    }

    // Vincular membros a ministérios com flag lider
    const vinculos = [
      { membro: "Juliana Santos", ministerio: "Louvor", lider: true },
      { membro: "Ricardo Oliveira", ministerio: "Louvor", lider: false },
      { membro: "Ana Beatriz Costa", ministerio: "Acolhimento", lider: true },
      { membro: "Fernanda Lima", ministerio: "Acolhimento", lider: false },
      { membro: "Beatriz Carvalho", ministerio: "Intercessão", lider: true },
      { membro: "Pedro Henrique Alves", ministerio: "Infantil", lider: true },
      { membro: "Juliana Santos", ministerio: "Infantil", lider: false },
    ];

    for (const v of vinculos) {
      const mid = membroIds[v.membro];
      const minId = ministerioIds[v.ministerio];
      if (!mid || !minId) continue;
      await prisma.ministerioMembro.upsert({
        where: { membroId_ministerioId: { membroId: mid, ministerioId: minId } },
        update: { lider: v.lider },
        create: { membroId: mid, ministerioId: minId, lider: v.lider },
      }).catch(() => {});
    }
    console.log(`[seed] Ministério-Membro: ${vinculos.length} vínculos`);

    // ── 5. Caixas ────────────────────────────────────
    const caixaIds: Record<string, string> = {};
    for (const c of MOCK_CAIXAS) {
      const created = await prisma.caixa.upsert({
        where: { nome: c.nome },
        update: {},
        create: { nome: c.nome, saldoCentavos: c.saldoCentavos, ativo: true },
      });
      caixaIds[c.nome] = created.id;
      console.log(`[seed] Caixa: ${c.nome}`);
    }

    // ── 6. Lançamentos financeiros (18+ meses) ───────
    // Gera dízimos e ofertas mensais + despesas para 18 meses
    const inicio = d("2024-06-01T00:00:00Z");
    const meses = 19; // 19 meses = junho/2024 a dezembro/2025
    let countLanc = 0;

    const dizimistas = [
      { membro: "Ricardo Oliveira", valor: rs(800) },
      { membro: "Ana Beatriz Costa", valor: rs(400) },
      { membro: "Marcos Vinícius", valor: rs(500) },
      { membro: "Juliana Santos", valor: rs(300) },
      { membro: "Pedro Henrique Alves", valor: rs(250) },
      { membro: "Beatriz Carvalho", valor: rs(350) },
    ];

    const ofertas = [
      { descricao: "Oferta do culto de domingo", valor: rs(1200) },
      { descricao: "Oferta para missões", valor: rs(600) },
    ];

    const despesas = [
      { descricao: "Conta de luz", valor: rs(450), categoria: "DESPESA_OPERACIONAL" as const },
      { descricao: "Conta de água", valor: rs(180), categoria: "DESPESA_OPERACIONAL" as const },
      { descricao: "Internet", valor: rs(120), categoria: "DESPESA_OPERACIONAL" as const },
      { descricao: "Material de limpeza", valor: rs(200), categoria: "DESPESA_OPERACIONAL" as const },
      { descricao: "Manutenção do data show", valor: rs(350), categoria: "MANUTENCAO" as const },
      { descricao: "Compra de Bíblias", valor: rs(400), categoria: "COMPRA_ESTOQUE" as const },
    ];

    for (let i = 0; i < meses; i++) {
      const mes = addMonths(inicio, i);
      const caixaGeral = caixaIds["Caixa Geral"];
      const caixaMissoes = caixaIds["Caixa Missões"];

      // Dízimos (ENTRADA, DIZIMO) — no dia 10 de cada mês
      const dia10 = new Date(mes.getFullYear(), mes.getMonth(), 10);
      for (const diz of dizimistas) {
        const mid = membroIds[diz.membro];
        if (!mid) continue;
        await prisma.lancamento.create({
          data: {
            tipo: "ENTRADA",
            categoria: "DIZIMO",
            status: "PAGO",
            valorCentavos: diz.valor,
            descricao: `Dízimo — ${diz.membro}`,
            dataCompetencia: dia10,
            caixaId: caixaGeral,
            membroId: mid,
          },
        });
        countLanc++;
      }

      // Ofertas (ENTRADA, OFERTA) — no dia 10 e 24
      for (const [idx, ofert] of ofertas.entries()) {
        const dia = idx === 0 ? 10 : 24;
        const dataOferta = new Date(mes.getFullYear(), mes.getMonth(), dia);
        await prisma.lancamento.create({
          data: {
            tipo: "ENTRADA",
            categoria: "OFERTA",
            status: "PAGO",
            valorCentavos: ofert.valor,
            descricao: ofert.descricao,
            dataCompetencia: dataOferta,
            caixaId: idx === 1 ? caixaMissoes : caixaGeral,
          },
        });
        countLanc++;
      }

      // Despesas (SAIDA) — ao longo do mês
      for (const [j, desp] of despesas.entries()) {
        const dia = 5 + j * 3;
        const dataDesp = new Date(mes.getFullYear(), mes.getMonth(), Math.min(dia, 28));
        await prisma.lancamento.create({
          data: {
            tipo: "SAIDA",
            categoria: desp.categoria,
            status: "PAGO",
            valorCentavos: desp.valor,
            descricao: desp.descricao,
            dataCompetencia: dataDesp,
            caixaId: caixaGeral,
          },
        });
        countLanc++;
      }

      // Campanha (a cada 3 meses)
      if (i % 3 === 0) {
        const dataCamp = new Date(mes.getFullYear(), mes.getMonth(), 15);
        await prisma.lancamento.create({
          data: {
            tipo: "ENTRADA",
            categoria: "CAMPANHA",
            status: "PAGO",
            valorCentavos: rs(2000),
            descricao: "Campanha de construção",
            dataCompetencia: dataCamp,
            caixaId: caixaGeral,
          },
        });
        countLanc++;
      }
    }
    console.log(`[seed] Lançamentos: ${countLanc} registros (${meses} meses)`);

    // ── 7. Estoque + Movimentações ───────────────────
    const estoqueIds: Record<string, string> = {};
    for (const item of MOCK_ESTOQUE) {
      let existing: { id: string } | null = null;
      if (item.numeroSerie) {
        existing = await prisma.itemEstoque.findUnique({ where: { numeroSerie: item.numeroSerie } });
      } else {
        existing = await prisma.itemEstoque.findFirst({ where: { nome: item.nome }, select: { id: true } });
      }
      if (existing) {
        estoqueIds[item.nome] = existing.id;
        continue;
      }
      const created = await prisma.itemEstoque.create({
        data: {
          nome: item.nome,
          tipo: item.tipo,
          quantidade: item.quantidade,
          quantidadeMinima: item.quantidadeMinima,
          ativo: item.ativo,
          numeroSerie: item.numeroSerie ?? null,
          statusPatrimonio: item.statusPatrimonio ?? null,
          localizacaoFisica: item.localizacaoFisica ?? null,
        },
      });
      estoqueIds[item.nome] = created.id;
      console.log(`[seed] Estoque: ${item.nome}`);
    }

    // Movimentações de estoque (entradas e saídas)
    const movimentacoes = [
      { item: "Bíblia Sagrada NVI", qtd: 50, justificativa: "Compra inicial", retirante: "Ana Beatriz Costa", data: d("2024-07-01T10:00:00Z") },
      { item: "Bíblia Sagrada NVI", qtd: -20, justificativa: "Distribuição para novos convertidos", retirante: "Pedro Henrique Alves", data: d("2024-09-15T14:00:00Z") },
      { item: "Cesta básica (unid.)", qtd: 30, justificativa: "Doação de parceiros", retirante: "Ricardo Oliveira", data: d("2024-08-10T09:00:00Z") },
      { item: "Cesta básica (unid.)", qtd: -15, justificativa: "Distribuição para famílias carentes", retirante: "Beatriz Carvalho", data: d("2024-12-20T11:00:00Z") },
      { item: "Cadeira dobrável", qtd: 80, justificativa: "Compra para eventos", retirante: "Marcos Vinícius", data: d("2024-06-05T08:00:00Z") },
      { item: "Cadeira dobrável", qtd: -30, justificativa: "Uso em culto ao ar livre", retirante: "Juliana Santos", data: d("2024-10-12T16:00:00Z") },
    ];

    for (const mov of movimentacoes) {
      const itemId = estoqueIds[mov.item];
      if (!itemId) continue;
      const autorizadorId = membroIds["Ana Beatriz Costa"] ?? admin.id;
      await prisma.movimentacaoEstoque.create({
        data: {
          itemEstoqueId: itemId,
          quantidade: mov.qtd,
          justificativa: mov.justificativa,
          autorizadoPorId: autorizadorId,
          nomeRetirante: mov.retirante,
          createdAt: mov.data,
        },
      });
    }
    console.log(`[seed] Movimentações de estoque: ${movimentacoes.length}`);

    // ── 8. Logs de Auditoria ─────────────────────────
    const auditEvents = [
      { membroId: admin.id, event: "login.success", actorId: admin.id, actorRole: "ADMIN", createdAt: d("2025-01-15T08:30:00Z") },
      { membroId: admin.id, event: "login.success", actorId: admin.id, actorRole: "ADMIN", createdAt: d("2025-03-20T14:22:00Z") },
      { membroId: membroIds["Ricardo Oliveira"], event: "login.success", actorId: membroIds["Ricardo Oliveira"], actorRole: "PASTOR", createdAt: d("2025-02-10T09:00:00Z") },
      { membroId: membroIds["Ricardo Oliveira"], event: "logout", actorId: membroIds["Ricardo Oliveira"], actorRole: "PASTOR", createdAt: d("2025-02-10T17:00:00Z") },
      { membroId: membroIds["Ana Beatriz Costa"], event: "login.success", actorId: membroIds["Ana Beatriz Costa"], actorRole: "SECRETARIO", createdAt: d("2025-04-05T10:15:00Z") },
      { membroId: membroIds["Marcos Vinícius"], event: "login.success", actorId: membroIds["Marcos Vinícius"], actorRole: "FINANCEIRO", createdAt: d("2025-05-12T11:00:00Z") },
      { membroId: membroIds["Marcos Vinícius"], event: "membro.update", actorId: membroIds["Marcos Vinícius"], actorRole: "FINANCEIRO", details: JSON.stringify({ campos: ["telefone"] }), createdAt: d("2025-05-12T11:30:00Z") },
      { membroId: membroIds["Juliana Santos"], event: "membro.toggle_discipulador", actorId: admin.id, actorRole: "ADMIN", details: JSON.stringify({ novoValor: true }), createdAt: d("2025-01-20T16:00:00Z") },
      { membroId: membroIds["Ricardo Oliveira"], event: "membro.toggle_discipulador", actorId: admin.id, actorRole: "ADMIN", details: JSON.stringify({ novoValor: true }), createdAt: d("2025-01-20T16:05:00Z") },
      { membroId: membroIds["Pedro Henrique Alves"], event: "membro.create", actorId: admin.id, actorRole: "ADMIN", details: JSON.stringify({ nome: "Pedro Henrique Alves", tipo: "MEMBRO_ATIVO" }), createdAt: d("2021-06-15T12:00:00Z") },
    ];

    for (const log of auditEvents) {
      await prisma.auditLog.create({ data: log });
    }
    console.log(`[seed] Logs de auditoria: ${auditEvents.length}`);

    console.log("[seed] Seed concluído com sucesso!");
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
