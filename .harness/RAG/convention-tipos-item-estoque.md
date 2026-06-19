---
title: Convenção — Tipos de Item de Estoque (CONSUMO vs PATRIMONIO) — Diferenciação Semântica
category: convention
applies_to:
  - prisma/schema.prisma (TipoItemEstoque enum, ItemEstoque.tipo)
  - app/lib/estoque.server.ts
  - app/lib/patrimonio.server.ts
  - app/lib/manutencao.server.ts
  - app/lib/movimentacao.server.ts
  - app/routes/app/estoque/** (formulários com campos condicionais)
created: 2026-06-19
updated: 2026-06-19
version: 1.0
status: approved
priority: medium
sources:
  - brief.md §4.1, §4.2 (CRUD ItemEstoque + Escopo Dual Consumo vs Patrimônio)
  - docs/REGRAS_DE_NEGOCIO.md §3 (RN-EST-01 a 05)
  - .harness/RAG/pattern-patrimonio-status-state-machine.md
  - .harness/RAG/pattern-estoque-trava-quantidade.md
tags: [convention, estoque, consumo, patrimonio, tipo, rn-est-01, semantica, modelagem]
owner: rag-curator
---

## 1. Contexto

O **schema Prisma** define `TipoItemEstoque` como enum com 2 valores:

```prisma
enum TipoItemEstoque {
  CONSUMO
  PATRIMONIO
}
```

Esta enum distingue **duas naturezas físicas de item** que exigem **fluxos de negócio completamente diferentes**:

- **CONSUMO** = material descartável ou de uso contínuo (papel A4, produtos de limpeza, tinta de impressora, materiais de ceia, pilhas). Tem `quantidade` que **incrementa/decrementa** via `MovimentacaoEstoque`. Não tem número de série (uma caixa de papel A4 é indistinguível da próxima).
- **PATRIMONIO** = bem permanente, físico e identificável (cadeiras, projetor, microfone, instrumento, caixa de som). Tem `quantidade` geralmente **1** (uma unidade física). Tem `numeroSerie` **único** (obrigatório), `localizacaoFisica` textual, `statusPatrimonio` (state machine). Movimentação é por **Manutenção** ou **Baixa por Perda**, não por estoque.

Misturar os dois conceitos leva a bugs sérios: tentar "movimentar" um projetor em manutenção como se fosse caixa de papel gera histórico confuso, e tentar "enviar para manutenção" um pacote de papel gera 400 (trava de tipo).

## 2. Decisão / Regra

**A diferenciação semântica `CONSUMO` vs `PATRIMONIO` é feita em 3 lugares canônicos:**

1. **Schema Prisma:** campo `ItemEstoque.tipo: TipoItemEstoque` (obrigatório).
2. **Formulários (UI):** campos condicionais por tipo — `numeroSerie` aparece só para PATRIMONIO; `quantidade` em input numérico livre só para CONSUMO.
3. **Service (Camada 3):** helpers `assertCanManageEstoque` / `assertCanMovimentarConsumo` / `assertCanManagePatrimonio` validam tipo antes de qualquer operação.

### 2.1 Tabela de diferenças semânticas

| Aspecto | `CONSUMO` | `PATRIMONIO` |
|---|---|---|
| **Natureza** | Material descartável ou de uso contínuo | Bem permanente, físico, identificável |
| **Exemplos** | Papel A4, produtos de limpeza, pilhas, fitas, materiais de ceia | Cadeiras, projetor, microfone, instrumentos, caixas de som |
| **`quantidade`** | Estoque atual (incrementa/decrementa) | Geralmente **1** (uma unidade física) |
| **`numeroSerie`** | ❌ Não se aplica | ✅ **Obrigatório** e **único** (`@unique` no schema) |
| **`localizacaoFisica`** | Opcional ("Almoxarifado A", "Sala da limpeza") | **Recomendado** ("Sala de som", "Galpão do louvor", "Cozinha") |
| **`statusPatrimonio`** | ❌ Não se aplica | ✅ **Obrigatório** (default `DISPONIVEL`) |
| **Movimentação de estoque** | ✅ `MovimentacaoEstoque` (ENTRADA/SAIDA) | ❌ **Não usa** — patrimônio não vai para "estoque" |
| **Manutenção externa** | ❌ **Não se aplica** — trava de tipo (RN-EST-03) | ✅ `ManutencaoAtivo` (envio/retorno) |
| **Baixa por perda** | ❌ Não se aplica | ✅ `baixaPorPerda` (item entra em `BAIXADO_PERDA`) |
| **Operação principal** | `criarMovimentacao({ delta })` | `enviarParaManutencao` / `retornarDeManutencao` / `baixaPorPerda` |
| **Quem opera** | Almoxarife, Secretário, Pastor (RN-EST-02) | ADMIN, PASTOR, SECRETARIO (RN-EST-01/03/05) |
| **Quem lê** | Todos os 6 perfis autenticados | Todos os 6 perfis autenticados |
| **Soft-delete** | `ativo = false` (decisão pendente Fase 2) | `ativo = false` (decisão pendente Fase 2) |

### 2.2 Schema Zod do input (`itemEstoque.server.ts`)

A diferenciação mora no schema via **`discriminatedUnion`** (Zod) ou **`superRefine` condicional**:

```ts
// app/lib/schemas/estoque.ts
import { z } from "zod";

const BaseItemSchema = z.object({
  nome: z.string().min(2).max(120),
  descricao: z.string().max(500).optional(),
  localizacaoFisica: z.string().max(120).optional(),
}).strict();

export const ItemConsumoCreateSchema = BaseItemSchema.extend({
  tipo: z.literal("CONSUMO"),
  quantidade: z.number().int().min(0).default(0), // estoque inicial
  // numeroSerie: NÃO permitido (rejeita explicitamente).
  // statusPatrimonio: NÃO permitido.
}).strict();

export const ItemPatrimonioCreateSchema = BaseItemSchema.extend({
  tipo: z.literal("PATRIMONIO"),
  quantidade: z.literal(1).default(1), // sempre 1 unidade física
  numeroSerie: z.string().min(1).max(80), // OBRIGATÓRIO e ÚNICO
  statusPatrimonio: z.enum(["DISPONIVEL"]).default("DISPONIVEL"), // só DISPONIVEL na criação
}).strict();

export const ItemCreateSchema = z.discriminatedUnion("tipo", [
  ItemConsumoCreateSchema,
  ItemPatrimonioCreateSchema,
]);
```

> **Vantagem do `discriminatedUnion`:** Zod valida o tipo **antes** do service. Se `tipo: PATRIMONIO` mas falta `numeroSerie`, o Zod rejeita com 400 antes de chegar no DB. Idem para `tipo: CONSUMO` com `numeroSerie` (rejeitado).

### 2.3 Formulário UI — campos condicionais por tipo

```tsx
// app/routes/app/estoque/novo.tsx (esboço)
export default function ItemNovoForm() {
  const [tipo, setTipo] = useState<"CONSUMO" | "PATRIMONIO">("CONSUMO");
  return (
    <Form method="post">
      <label>
        Tipo:
        <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
          <option value="CONSUMO">Consumo (papel, limpeza, etc.)</option>
          <option value="PATRIMONIO">Patrimônio (cadeira, projetor, etc.)</option>
        </select>
      </label>

      {/* Campos comuns */}
      <input name="nome" placeholder="Nome do item" required minLength={2} />

      {/* Campos só para CONSUMO */}
      {tipo === "CONSUMO" && (
        <input name="quantidade" type="number" min={0} defaultValue={0} placeholder="Quantidade inicial" />
      )}

      {/* Campos só para PATRIMONIO */}
      {tipo === "PATRIMONIO" && (
        <>
          <input name="numeroSerie" required minLength={1} placeholder="Número de série" />
          <input name="localizacaoFisica" placeholder="Localização física" />
        </>
      )}

      <button type="submit">Cadastrar</button>
    </Form>
  );
}
```

> **Camada 1 (UX):** esconder campos irrelevantes evita erro do usuário. **Camada 2 (Zod):** schema `discriminatedUnion` rejeita payload inconsistente. **Camada 3 (service):** helpers validam tipo + transição.

### 2.4 Helpers de validação por tipo no service

| Helper | Tipo esperado | Operação | Erro |
|---|---|---|---|
| `assertCanMovimentarConsumo(user)` | n/a (RBAC puro) | Valida que user pode criar movimentação | 403 |
| `assertItemIsConsumo(item)` | `CONSUMO` | `criarMovimentacao` rejeita se `item.tipo !== "CONSUMO"` | 400 |
| `assertCanManagePatrimonio(user)` | n/a (RBAC puro) | Valida que user pode enviar/retornar manutenção | 403 |
| `assertItemIsPatrimonio(item)` | `PATRIMONIO` | `enviarParaManutencao` / `baixaPorPerda` rejeitam se `item.tipo !== "PATRIMONIO"` | 400 |
| `assertItemHasNumeroSerie(item)` | `PATRIMONIO` | Helper redundante (Zod já garante), mas documenta invariante | 400 |
| `assertItemHasLocalizacaoFisica(item)` | `PATRIMONIO` | Helper opcional (recomendação, não obrigatório) | n/a (warning) |

```ts
// app/lib/patrimonio.server.ts
export function assertItemIsPatrimonio(item: { tipo: TipoItemEstoque; nome: string }): void {
  if (item.tipo !== "PATRIMONIO") {
    throw new Response(
      `Operação exclusiva de patrimônio. Item "${item.nome}" é do tipo ${item.tipo}.`,
      { status: 400 }
    );
  }
}

export function assertItemHasNumeroSerie(item: { numeroSerie: string | null; nome: string }): void {
  if (!item.numeroSerie || item.numeroSerie.trim().length === 0) {
    throw new Response(
      `Item de patrimônio "${item.nome}" exige número de série.`,
      { status: 400 }
    );
  }
}
```

## 3. Consequências

### Positivas

- **Diferenciação explícita** desde o schema elimina ambiguidade. `tipo = PATRIMONIO` carrega semântica, não é só label.
- **`discriminatedUnion` no Zod** rejeita payload inconsistente em tempo de validação (Camada 2), antes do DB.
- **Camada 3 (service) tem helpers dedicados por tipo** (`assertItemIsConsumo`, `assertItemIsPatrimonio`), documentando claramente quais operações aceitam quais tipos.
- **UI com campos condicionais** evita erro humano (não mostra campo `numeroSerie` para consumo).
- **Testes de borda explícitos** por tipo (brief §7.3):
  - "Enviar para manutenção item CONSUMO → 400 (trava de tipo)"
  - "Movimentação em item PATRIMONIO → 400 (trava de tipo)"
  - "PATRIMONIO sem numeroSerie → 400"
  - "PATRIMONIO com numeroSerie duplicado → 409 (unique)"
- **Manutenção futura simplificada:** se algum dia precisar de um 3º tipo (ex: `DOACAO_RECEBIDA` com lifecycle próprio), basta adicionar valor ao enum + schema discriminado. Migração aditiva no Prisma.

### Negativas

- **Mais 1 if no service** (validação de tipo). Aceitável: helper é 1 linha.
- **Duplicação de schema** (`ItemConsumoCreateSchema` vs `ItemPatrimonioCreateSchema`). Mitigada por `BaseItemSchema.extend()`.
- **UX mais complexa** no formulário (campos aparecem/desaparecem por tipo). Mitigada por `useState` simples + render condicional.
- **Enum enxuto (2 valores)** — adicionar 3º tipo no futuro exige migration aditiva. Aceitável: 2 valores cobrem 100% do escopo do ciclo 3.

### Trade-offs aceitos

- **Não criar `ItemEstoque` polimórfico** (single-table inheritance com campo `tipo` discriminador + JSON para campos específicos). Razão: schema relacional explícito é mais type-safe e mais fácil de auditar.
- **Não normalizar `ItemEstoque` em 2 tabelas** (`ItemConsumo` + `ItemPatrimonio`). Razão: 90% dos campos são compartilhados; 1 tabela + discriminador é mais simples. Overhead de JOIN vs simplicidade de schema — simplicidade ganha.
- **`quantidade` em PATRIMONIO sempre 1** (não 0..N para "várias unidades idênticas"). Razão: na prática, "várias cadeiras iguais" = vários `ItemEstoque` (cada um com seu `numeroSerie`). Modelo multi-unidade poluiria auditoria de manutenção.
- **`numeroSerie` é texto livre, não validado por regex** (ex: aceitar `PJ-001-BenQ-MX535`). Razão: cada fabricante tem convenção própria; regex rígida quebraria casos reais.

## 4. Exemplos

### Exemplo 1 — `criarItem` com diferenciação

```ts
// app/lib/estoque.server.ts
export async function criarItem(input: z.infer<typeof ItemCreateSchema>, user: SessionUser) {
  assertCanManageEstoque(user);

  if (input.tipo === "CONSUMO") {
    // Sem trava de tipo: consumo pode ser criado direto.
    return prisma.itemEstoque.create({
      data: {
        nome: input.nome,
        descricao: input.descricao,
        tipo: "CONSUMO",
        quantidade: input.quantidade,
        localizacaoFisica: input.localizacaoFisica,
        ativo: true,
      },
    });
  }

  // PATRIMONIO: valida numeroSerie único.
  const existing = await prisma.itemEstoque.findUnique({
    where: { numeroSerie: input.numeroSerie },
    select: { id: true },
  });
  if (existing) {
    throw new Response(
      `Já existe item de patrimônio com número de série "${input.numeroSerie}".`,
      { status: 409 }
    );
  }

  return prisma.itemEstoque.create({
    data: {
      nome: input.nome,
      descricao: input.descricao,
      tipo: "PATRIMONIO",
      quantidade: 1,
      numeroSerie: input.numeroSerie,
      localizacaoFisica: input.localizacaoFisica,
      statusPatrimonio: "DISPONIVEL",
      ativo: true,
    },
  });
}
```

### Exemplo 2 — `criarMovimentacao` rejeita PATRIMONIO

```ts
// app/lib/movimentacao.server.ts
export async function criarMovimentacao(input, user) {
  assertCanMovimentarConsumo(user);

  // Validação de tipo (Camada 3): só CONSUMO pode ser movimentado por estoque.
  const item = await prisma.itemEstoque.findUnique({
    where: { id: input.itemId },
    select: { id: true, nome: true, tipo: true, quantidade: true, ativo: true },
  });
  if (!item) throw new Response("Item não encontrado.", { status: 404 });
  assertItemIsConsumo(item); // 400 se PATRIMONIO

  // ... validações de trava (RN-EST-02) ...
  await assertSaldoQuantidade(item.id, input.delta, "Movimentação");

  // ... mutação ...
}
```

### Exemplo 3 — `enviarParaManutencao` rejeita CONSUMO

```ts
// app/lib/manutencao.server.ts
export async function enviarParaManutencao(input, user) {
  assertCanManagePatrimonio(user);

  const item = await prisma.itemEstoque.findUnique({
    where: { id: input.itemEstoqueId },
    select: { id: true, nome: true, tipo: true, statusPatrimonio: true, numeroSerie: true },
  });
  if (!item) throw new Response("Item não encontrado.", { status: 404 });
  assertItemIsPatrimonio(item); // 400 se CONSUMO
  assertItemHasNumeroSerie(item); // 400 se numeroSerie vazio (paranoia, Zod já garante)

  // ... validações de transição (state machine) ...
  assertTransicaoPatrimonioValida(item.statusPatrimonio, "EM_MANUTENCAO", "Envio");

  // ... mutação atômica ...
}
```

### Exemplo 4 — Teste de borda (TDD)

```ts
describe("TipoItemEstoque — diferenciação semântica", () => {
  let cleanup: () => Promise<void>;
  beforeAll(async () => { cleanup = await setupTestDb("tipo-item"); });
  afterEach(async () => { await resetTestDb(); });
  afterAll(async () => { cleanup = cleanup; await cleanup(); });

  it("rejeita criar PATRIMONIO sem numeroSerie (400)", async () => {
    await expect(criarItem({
      tipo: "PATRIMONIO",
      nome: "Cadeira sem série",
      // numeroSerie: omitido
    } as any, adminUser)).rejects.toMatchObject({ status: 400 });
  });

  it("rejeita criar PATRIMONIO com numeroSerie duplicado (409)", async () => {
    await criarItem({
      tipo: "PATRIMONIO",
      nome: "Cadeira A",
      numeroSerie: "C-001",
    }, adminUser);

    await expect(criarItem({
      tipo: "PATRIMONIO",
      nome: "Cadeira B",
      numeroSerie: "C-001", // mesmo
    }, adminUser)).rejects.toMatchObject({ status: 409 });
  });

  it("rejeita criarMovimentacao em PATRIMONIO (400, trava de tipo)", async () => {
    const item = await criarItem({
      tipo: "PATRIMONIO",
      nome: "Projetor",
      numeroSerie: "PJ-001",
    }, adminUser);

    await expect(criarMovimentacao({
      itemId: item.id,
      delta: -1,
      justificativa: "Saída de patrimônio",
      nomeRetirante: "João",
    }, adminUser)).rejects.toMatchObject({ status: 400 });
  });

  it("rejeita enviarParaManutencao em CONSUMO (400, trava de tipo)", async () => {
    const item = await criarItem({
      tipo: "CONSUMO",
      nome: "Papel A4",
      quantidade: 100,
    }, adminUser);

    await expect(enviarParaManutencao({
      itemEstoqueId: item.id,
      assistenciaTecnica: "X",
      enderecoAssistencia: "Y",
    }, adminUser)).rejects.toMatchObject({ status: 400 });
  });

  it("PATRIMONIO aceita numeroSerie alfanumérico (sem regex rígida)", async () => {
    const item = await criarItem({
      tipo: "PATRIMONIO",
      nome: "Projetor",
      numeroSerie: "PJ-001-BenQ-MX535",
    }, adminUser);
    expect(item.numeroSerie).toBe("PJ-001-BenQ-MX535");
  });
});
```

## 5. Anti-exemplos

- ❌ **Criar item sem `tipo`** ou com `tipo = null`. Schema rejeita (campo obrigatório com default `CONSUMO`, mas service deve validar explícito).
- ❌ **Criar item PATRIMONIO com `quantidade: 5`** (interpretar como "5 unidades"). Decisão consciente: cada unidade física é 1 item separado com seu próprio `numeroSerie`. Multi-unidade polui auditoria de manutenção.
- ❌ **Aceitar `numeroSerie` em item CONSUMO**. Decisão consciente: consumo é indistinguível (uma caixa de papel A4 == próxima). Campo não se aplica; schema rejeita via `discriminatedUnion`.
- ❌ **Validar tipo apenas na UI** (`if (tipo === "PATRIMONIO") showNumeroSerie()`). Bypass trivial via DevTools (remover `if`, submeter form). Service valida (Camada 3).
- ❌ **Validar `numeroSerie` único apenas via `@unique` no schema** sem try/catch no service. Erro do Prisma vira 500 genérico; melhor lançar 409 com mensagem amigável.
- ❌ **Aceitar `statusPatrimonio: EM_MANUTENCAO` na criação de item**. Item só pode ser criado como `DISPONIVEL`; transições para `EM_MANUTENCAO` passam por `enviarParaManutencao`. Schema Zod via `z.literal("DISPONIVEL")` rejeita.
- ❌ **Mover `localizacaoFisica` para tabela separada** (`ItemLocalizacao` histórico). YAGNI: histórico de localização é fora do escopo do ciclo 3. Campo `String?` cobre.
- ❌ **Criar tabela `ItemFoto`** para foto do patrimônio. Brief §8 — sem upload no MVP. Quando entrar S3/MinIO, criar tabela.
- ❌ **Tratar `PATRIMONIO` como `CONSUMO` com `numeroSerie` opcional** em código (e.g., `if (numeroSerie) ... else tratarComoConsumo()`). Viola o invariante semântico.

## 6. RAGs relacionados

- [`.harness/RAG/pattern-estoque-trava-quantidade.md`](./pattern-estoque-trava-quantidade.md) — RN-EST-02 trava de quantidade; helper rejeita PATRIMONIO (não movimentado por estoque).
- [`.harness/RAG/pattern-patrimonio-status-state-machine.md`](./pattern-patrimonio-status-state-machine.md) — state machine de `statusPatrimonio`; depende do tipo `PATRIMONIO`.
- [`.harness/RAG/pattern-manutencao-alerta-manual.md`](./pattern-manutencao-alerta-manual.md) — RN-EST-04 alerta; detecta itens `PATRIMONIO` em `EM_MANUTENCAO`.
- [`.harness/RAG/security-rbac-matrix.md`](./security-rbac-matrix.md) — matriz 6 perfis; este RAG é a **diferenciação semântica** por tipo, complementar à matriz.
- [`.harness/RAG/architecture-estoque.md`](./architecture-estoque.md) — visão macro do módulo; este RAG é a **convenção de tipos**.
- [`.harness/RAG/convention-prisma-sqlite.md`](./convention-prisma-sqlite.md) — `@unique` constraint no `numeroSerie`, enum workflow.
- [`.harness/RAG/lgpd-igreja-conect.md`](./lgpd-igreja-conect.md) — `localizacaoFisica` é texto livre, sem PII; `numeroSerie` é identificador de fabricante, sem PII.

## 7. Notas de aplicação

### Checklist de PR que toca `ItemEstoque.tipo`

- [ ] Schema Zod usa `discriminatedUnion("tipo", [...])` em vez de `union` genérico?
- [ ] Formulário UI tem campos condicionais por tipo (`tipo === "PATRIMONIO" && <NumeroSerie />`)?
- [ ] Service tem helper `assertItemIsConsumo` ou `assertItemIsPatrimonio` antes de cada operação que diferencia?
- [ ] PATRIMONIO com `numeroSerie` duplicado → 409 (try/catch em torno de `prisma.itemEstoque.create`)?
- [ ] PATRIMONIO criado com `statusPatrimonio = DISPONIVEL` (não outro estado)?
- [ ] PATRIMONIO criado com `quantidade = 1` (não >1)?
- [ ] CONSUMO rejeita `numeroSerie` no schema (cam fora do `BaseItemSchema`)?
- [ ] Teste cobre "PATRIMONIO sem numeroSerie → 400" e "PATRIMONIO com numeroSerie duplicado → 409"?

### Sinal de code review (recusar PR se aparecer)

- Schema Zod sem `discriminatedUnion` (rejeita inconsistência só no service, mais lento).
- Service de `criarMovimentacao` sem `assertItemIsConsumo` (PATRIMONIO pode vazar).
- Service de `enviarParaManutencao` sem `assertItemIsPatrimonio` (CONSUMO pode vazar).
- PATRIMONIO criado com `quantidade > 1` (multi-unidade proíbido por convenção).
- PATRIMONIO criado com `statusPatrimonio !== DISPONIVEL` (transição direta proíbida).
- `numeroSerie` validado só por `@unique` do schema sem 409 explícito no catch.

### Testes obrigatórios por sprint que entrega o ciclo 3

- ✅ PATRIMONIO sem `numeroSerie` → 400.
- ✅ PATRIMONIO com `numeroSerie` duplicado → 409.
- ✅ PATRIMONIO com `quantidade: 5` → 400 (multi-unidade proíbido).
- ✅ PATRIMONIO criado com `statusPatrimonio: EM_MANUTENCAO` → 400.
- ✅ CONSUMO com `numeroSerie` → 400 (campo não se aplica).
- ✅ `criarMovimentacao` em PATRIMONIO → 400 (trava de tipo).
- ✅ `enviarParaManutencao` em CONSUMO → 400 (trava de tipo).
- ✅ PATRIMONIO aceita `numeroSerie` alfanumérico (sem regex rígida).
- ✅ E2E: SECRETARIO cria 5 pacotes de papel A4 (CONSUMO), ADMIN cria cadeira com `numeroSerie: C-001` (PATRIMONIO), ambos persistidos corretamente (métrica macro do brief §7.1).

### Quando reconsiderar esta convenção

- **Se entrar 3º tipo** (ex: `DOACAO_RECEBIDA` com lifecycle próprio: entra como DOACAO, vira PATRIMONIO ao ser cadastrado). Aí enum ganha valor + schema `discriminatedUnion` ganha entrada. **Não é o caso do ciclo 3.**
- **Se algum dia precisar de "várias unidades idênticas"** (ex: 10 cadeiras iguais sem `numeroSerie` individual). Aí entra conceito de `Lote` + `ItemEstoque.loteId`. **Fora do escopo do ciclo 3** (igrejas pequenas não têm demanda).
- **Se o upload de foto de patrimônio entrar** (S3/MinIO futuro). Aí cria tabela `ItemFoto` com FK para `ItemEstoque`. **Não é o caso do ciclo 3.**
- **Se precisar histórico de localização** ("cadeira estava na sala A em 2024, foi para galpão em 2025"). Aí normaliza `ItemLocalizacao` em tabela própria. **Fora do escopo do ciclo 3.**

### Próximos passos para o ciclo 3 (S11+)

1. **Sprint de hardening:** teste E2E que valida fluxo completo — SECRETARIO cria papel A4 (CONSUMO), ADMIN cria cadeira (PATRIMONIO), SECRETARIO registra movimentação no papel, ADMIN envia cadeira para manutenção. Verifica que cada tipo respeita seu fluxo.
2. **Métrica de cobertura:** script `pnpm audit:tipos-estoque` que garante 100% dos `ItemEstoque` têm `tipo` válido (sanity check após migration).
3. **Feature futura (não ciclo 3):** enum `TipoItemEstoque` ganha valor `DOACAO` se entrada de doações precisar lifecycle próprio. Migration aditiva.