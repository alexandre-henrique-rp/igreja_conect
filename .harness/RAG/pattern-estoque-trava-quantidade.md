---
title: Pattern — Trava de Quantidade no Estoque (RN-EST-02) — assertSaldoQuantidade Antes do I/O + $transaction
category: pattern
applies_to:
  - app/lib/estoque.server.ts
  - app/lib/movimentacao.server.ts
  - app/lib/patrimonio.server.ts
  - app/lib/rbac.server.ts
  - prisma/schema.prisma (ItemEstoque.quantidade, MovimentacaoEstoque)
  - app/routes/app/estoque/**
created: 2026-06-19
updated: 2026-06-19
version: 1.0
status: approved
priority: high
sources:
  - brief.md §4.3 (Movimentação de Consumo — RN-EST-02)
  - docs/REGRAS_DE_NEGOCIO.md §3 (RN-EST-02 e RN-EST-03)
  - .harness/RAG/convention-prisma-sqlite.md §2 (transações Prisma)
  - .harness/RAG/pattern-3-layer-rbac.md §2.2 (assertCan* PRIMEIRO no service)
  - .harness/RAG/pattern-trava-saldo-service.md (paralelo conceitual do Módulo Financeiro)
tags: [pattern, estoque, quantidade, trava, rn-est-02, rn-est-03, prisma, transaction, defense-in-depth, atomicidade]
owner: rag-curator
---

## 1. Contexto

A Igreja Conect trata **material físico** (consumo) e **bens patrimoniais** (cadeiras, som, projetores, instrumentos). A **RN-EST-02** é a regra não-negociável do consumo:

> *"O controle de estoque deve registrar entradas e saídas, mantendo o saldo da quantidade sempre não-negativo. Saídas que coloquem o saldo negativo devem ser bloqueadas com erro de regra de negócio."* — `docs/REGRAS_DE_NEGOCIO.md §3` (RN-EST-02)

O paralelo com a trava de saldo do módulo Financeiro (RAG `pattern-trava-saldo-service`) é intencional: ambos lidam com **integridade de quantidade sob mutação concorrente**. A diferença é que aqui a "moeda" é `ItemEstoque.quantidade: Int` (não `saldoCentavos`), e a operação é `MovimentacaoEstoque.quantidade` (positiva para entrada, negativa para saída — convenção do schema).

O domínio tem **2 operações** que mutam `ItemEstoque.quantidade` e DEVEM aplicar a trava:

1. **`criarMovimentacao` com `quantidade < 0` (saída)** — subtrai do `ItemEstoque.quantidade` (RN-EST-01, RN-EST-02).
2. **`criarMovimentacao` com `quantidade > 0` (entrada)** — soma ao `ItemEstoque.quantidade` (sem trava de não-negatividade, mas passa pelo mesmo helper para garantir consistência).

Toda movimentação exige também **validação de `nomeRetirante`** (RN-EST-02): se for saída (`quantidade < 0`), `nomeRetirante` é **obrigatório** e **não pode ser vazio**. Esta validação é **semântica**, não de trava de quantidade — mas mora no mesmo service (`assertCanMovimentarConsumo` + schema Zod `.min(1)` condicional).

A trava NUNCA pode residir só na UI (botão desabilitado quando quantidade visível < saída desejada). Atacante pode modificar DOM e submeter form com valor maior. Defesa em **Camada 3 (service)**, antes do `prisma.*` escrever.

## 2. Decisão / Regra

**Toda mutação de `ItemEstoque.quantidade` passa por `assertSaldoQuantidade(itemId, delta, context)` ANTES do `prisma.*` que altera o saldo. A função helper é `void` e lança `Response(409, "Saldo insuficiente no item.")` se a regra falha.**

### 2.1 Helper canônico em `app/lib/estoque.server.ts`

```ts
import { prisma } from "~/db/prisma.server";

/**
 * Camada 3 de defesa para RN-EST-02 (trava de quantidade no estoque).
 *
 * Lança Response(409) se o item NÃO tem quantidade suficiente para a
 * operação de saída. Deve ser a PRIMEIRA chamada antes de qualquer
 * `prisma.itemEstoque.update({ data: { quantidade: { decrement: X } } })`.
 *
 * **NÃO altera a quantidade aqui** — apenas valida. A mutação real é
 * feita pelo service chamador, dentro de `prisma.$transaction`.
 *
 * @param {string} itemId - UUID do item de estoque.
 * @param {number} delta - Variação desejada. Positivo = entrada, Negativo = saída.
 * @param {string} context - Descrição do contexto (ex: "Saída para retiro").
 * @returns {Promise<void>}
 * @throws {Response} 409 se (quantidade_atual + delta) < 0.
 * @throws {Response} 404 se item não existe.
 * @throws {Response} 400 se item está arquivado (ativo === false).
 * @example
 *   await assertSaldoQuantidade(itemId, -3, "Saída para retiro de jovens");
 *   // Se quantidade < 3, throws 409
 */
export async function assertSaldoQuantidade(
  itemId: string,
  delta: number,
  context: string
): Promise<void> {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Response(
      `${context}: delta deve ser inteiro não-zero.`,
      { status: 400 }
    );
  }
  const item = await prisma.itemEstoque.findUnique({
    where: { id: itemId },
    select: { id: true, nome: true, quantidade: true, ativo: true, tipo: true },
  });
  if (!item) {
    throw new Response(`${context}: item não encontrado.`, { status: 404 });
  }
  if (item.ativo === false) {
    throw new Response(
      `${context}: item "${item.nome}" está arquivado e não aceita movimentações.`,
      { status: 409 }
    );
  }
  if (item.tipo === "PATRIMONIO" && delta !== 0) {
    // Patrimônio tem quantidade geralmente 1 — não deve ser movimentado por estoque.
    // Movimentação de patrimônio é exclusivamente via Manutenção/Baixa.
    throw new Response(
      `${context}: itens de patrimônio não são movimentados por estoque. Use manutenção.`,
      { status: 400 }
    );
  }
  const quantidadeResultante = item.quantidade + delta;
  if (quantidadeResultante < 0) {
    throw new Response(
      `Saldo insuficiente no item "${item.nome}". Disponível: ${item.quantidade}, solicitado: ${Math.abs(delta)}.`,
      { status: 409 }
    );
  }
}
```

### 2.2 Ordem inegociável no service

```ts
// ✅ CERTO — assertCan* (RBAC) PRIMEIRO, depois trava, depois $transaction
export async function criarMovimentacao(input, user) {
  assertCanMovimentarConsumo(user);                  // RBAC
  // ... validações Zod (nomeRetirante obrigatório para delta<0) ...
  await assertSaldoQuantidade(input.itemId, input.delta, "Movimentação"); // RN-EST-02
  return prisma.$transaction(async (tx) => { /* ... */ });
}

// ❌ ERRADO — service que toca Prisma antes de validar saldo
await prisma.itemEstoque.update({ data: { quantidade: { decrement: 3 } } });
if (quantidade < 0) throw ...  // TOCTOU + saldo já corrompido
```

### 2.3 Onde mora cada trava (mapa mental)

| Operação | Service | Trava aplica? | Helper |
|---|---|---|---|
| `criarMovimentacao({ delta > 0 })` (entrada de Consumo) | `movimentacao.server.ts` | ❌ (entrada soma) | `assertCanMovimentarConsumo` (RBAC) + schema (nomeRetirante opcional) |
| `criarMovimentacao({ delta < 0 })` (saída de Consumo) | `movimentacao.server.ts` | ✅ | `assertSaldoQuantidade` + `nomeRetirante` obrigatório |
| `enviarParaManutencao(itemId)` | `manutencao.server.ts` | ❌ (não muta quantidade) | `assertCanManagePatrimonio` (RBAC) + trava de tipo (PATRIMONIO) |
| `retornarDeManutencao(manutencaoId)` | `manutencao.server.ts` | ❌ (não muta quantidade) | `assertCanManagePatrimonio` (RBAC) |
| `baixaPorPerda(manutencaoId, motivo)` | `manutencao.server.ts` | ❌ (apenas flip de statusPatrimonio + ativo) | `assertCanBaixarPerda` (RBAC — apenas ADMIN) |
| `criarItem(input)` | `itemEstoque.server.ts` | ❌ (item novo, quantidade inicial) | `assertCanManageEstoque` (RBAC) |
| `arquivarItem(id)` | `itemEstoque.server.ts` | ❌ (apenas flip do flag) | `assertCanManageEstoque` (RBAC) |

### 2.4 Onde mora a Camada 1 (UI) e Camada 2 (Loader)

**Camada 1 (UI):** o input de quantidade no form pode ter `max={quantidadeAtual}` em SAÍDA (UX). Isso é **UX**, não segurança:

```tsx
<input
  type="number"
  name="quantidade"
  min={1}
  max={item.quantidade}  // UX apenas
  data-testid="input-quantidade-saida"
/>
{/* Não confiar neste max — Camada 3 é a real. */}
```

**Camada 2 (Loader/Action):** o loader que renderiza o form **não** precisa checar quantidade (carga é dinâmica, vem do DB). O `action` que recebe o POST chama o service, que chama `assertSaldoQuantidade` antes do I/O:

```ts
// app/routes/app/estoque/$id/movimentacao/nova.tsx
export async function action({ request, params, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  const form = await request.formData();
  const parsed = MovimentacaoCreateSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  // Camada 3 (service) trata trava de quantidade + RBAC + nomeRetirante.
  await criarMovimentacao({ ...parsed.data, itemId: params.id }, user);
  return redirect(`/app/estoque/${params.id}`);
}
```

### 2.5 Atomicidade obrigatória em movimentações

`criarMovimentacao` **sempre** roda em `prisma.$transaction` porque a operação toca 2 tabelas (`ItemEstoque` + `MovimentacaoEstoque`). Se qualquer parte falhar, todas revertem. A trava fica **antes** do `$transaction` para evitar lock desnecessário; as mutações ficam **dentro** da transação.

## 3. Consequências

### Positivas

- **Impossível gerar saldo negativo por bug de aplicação** (helper é a única porta de entrada para mutação de quantidade).
- **Teste de borda trivial:** "quantidade = 0, saída de 1 unidade → 409" cobre 100% da regra. 1 teste por service que muta quantidade.
- **Audit-friendly:** o helper loga estruturado (`assertSaldoQuantidade failed: itemId=X, disponivel=Y, requerido=Z, context=...`) **sem expor `nomeRetirante` em log** (RAG `lgpd-igreja-conect` §2.5 — `nomeRetirante` é texto livre, não é PII cadastrada, mas ainda assim optou-se por não logar).
- **Refatoração segura:** se uma operação nova precisar mutar quantidade, o caminho é adicionar 1 chamada a `assertSaldoQuantidade` — esqueceu, o typecheck não pega, mas a suíte de testes pega (TDD obrigatório).
- **Prevenção de mutação em tipo errado:** o helper rejeita movimentação em item `tipo = PATRIMONIO` (400). Patrimônio só muda quantidade via Manutenção (envio/retorno).

### Negativas

- **Mais 1 query ao DB** por operação (o `findUnique` do helper). Aceitável: é o mesmo DB que será tocado depois na transação; sem custo mensurável.
- **Item arquivado (`ativo: false`) também é barrado** — feature consistente com `Caixa.ativo` do ciclo 2 (RAG `decision-caixa-soft-delete`).
- **TOCTOU residual:** entre o `assertSaldoQuantidade` e o `decrement`, outra transação pode ter consumido o saldo. Mitigação: a checagem **final** de `quantidade >= abs(delta)` acontece DENTRO do `$transaction` (re-leitura). Ver §4 Exemplo 2.

### Trade-offs aceitos

- **Não usar `CHECK (quantidade >= 0)` no SQLite** (seria a defesa em camada 4). Razão: regra precisa de mensagem amigável e tratamento por item (RN-EST-02 fala em "saída", não regra global). Helper no service é mais expressivo.
- **Não usar lock pessimista** (`SELECT ... FOR UPDATE`). SQLite single-writer já serializa; Postgres futuro herdaria o mesmo padrão via `$transaction` com `Serializable` isolation.
- **Logs sem `nomeRetirante`** (RAG `lgpd-igreja-conect` §2.5): o contexto da operação é logado, mas o nome não. Em caso de incidente, auditoria tem que correlacionar por `movimentacaoId` no DB.
- **`MovimentacaoEstoque.quantidade` aceita negativo no schema** (convenção: positivo=entrada, negativo=saída). Alternativa era separar em `tipo: ENTRADA|SAIDA` + `quantidade: Int (sempre positivo)`. **Decisão do ciclo 1 (schema):** manter negativo no schema é mais simples para cálculo de saldo (`SUM(movimentacoes.quantidade) = estoque_atual`). Helper `assertSaldoQuantidade` valida a transição sem precisar de campo `tipo`.

## 4. Exemplos

### Exemplo 1 — `criarMovimentacao` (RN-EST-02 + nomeRetirante obrigatório)

```ts
// app/lib/movimentacao.server.ts
import { z } from "zod";
import { prisma } from "~/db/prisma.server";
import { assertCanMovimentarConsumo } from "~/lib/rbac.server";
import { assertSaldoQuantidade } from "~/lib/estoque.server";

export const MovimentacaoCreateSchema = z.object({
  delta: z.coerce.number().int().refine((n) => n !== 0, "Quantidade não pode ser zero."),
  justificativa: z.string().min(3).max(500),
  nomeRetirante: z.string().min(1).max(120),
}).strict().superRefine((val, ctx) => {
  // RN-EST-02: nomeRetirante obrigatório APENAS para saída (delta<0).
  // Para entrada (delta>0), é tolerado vazio (ex: "Doação sem identificação").
  if (val.delta < 0 && !val.nomeRetirante.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Saída exige nome do retirante.",
      path: ["nomeRetirante"],
    });
  }
});

export async function criarMovimentacao(
  input: z.infer<typeof MovimentacaoCreateSchema> & { itemId: string },
  user: SessionUser
) {
  // CAMADA 3 (RBAC) — PRIMEIRO.
  assertCanMovimentarConsumo(user);

  // CAMADA 3 (RN-EST-02) — trava de quantidade ANTES do I/O.
  const contexto = input.delta < 0
    ? `Saída de ${Math.abs(input.delta)} un.`
    : `Entrada de ${input.delta} un.`;
  await assertSaldoQuantidade(input.itemId, input.delta, contexto);

  // Mutação atômica: criar movimentação + atualizar quantidade.
  return prisma.$transaction(async (tx) => {
    const movimentacao = await tx.movimentacaoEstoque.create({
      data: {
        itemEstoqueId: input.itemId,
        quantidade: input.delta,
        justificativa: input.justificativa,
        nomeRetirante: input.nomeRetirante,
        autorizadoPorId: user.id,
      },
    });
    await tx.itemEstoque.update({
      where: { id: input.itemId },
      data: { quantidade: { increment: input.delta } },
    });
    return movimentacao;
  });
}
```

### Exemplo 2 — `criarMovimentacao` com re-leitura anti-TOCTOU (concorrência)

```ts
// Versão com anti-TOCTOU explícito (re-leitura dentro do $transaction)
export async function criarMovimentacao(
  input: z.infer<typeof MovimentacaoCreateSchema> & { itemId: string },
  user: SessionUser
) {
  assertCanMovimentarConsumo(user);
  await assertSaldoQuantidade(input.itemId, input.delta, "Movimentação");

  return prisma.$transaction(async (tx) => {
    // Re-leitura DENTRO da transação (anti-TOCTOU).
    const item = await tx.itemEstoque.findUniqueOrThrow({
      where: { id: input.itemId },
      select: { quantidade: true, ativo: true, tipo: true },
    });
    if (item.ativo === false) {
      throw new Response("Item arquivado.", { status: 409 });
    }
    if (item.tipo === "PATRIMONIO" && input.delta !== 0) {
      throw new Response("Patrimônio não é movimentado por estoque.", { status: 400 });
    }
    const resultante = item.quantidade + input.delta;
    if (resultante < 0) {
      throw new Response(
        `Saldo insuficiente (validado dentro da transação). Disponível: ${item.quantidade}.`,
        { status: 409 }
      );
    }

    const movimentacao = await tx.movimentacaoEstoque.create({
      data: {
        itemEstoqueId: input.itemId,
        quantidade: input.delta,
        justificativa: input.justificativa,
        nomeRetirante: input.nomeRetirante,
        autorizadoPorId: user.id,
      },
    });
    await tx.itemEstoque.update({
      where: { id: input.itemId },
      data: { quantidade: { increment: input.delta } },
    });
    return movimentacao;
  });
}
```

### Exemplo 3 — Teste de borda (TDD, bloqueador)

```ts
// app/lib/movimentacao.server.test.ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupTestDb, prismaTest, resetTestDb } from "../../tests/helpers/db";
import { criarMovimentacao } from "./movimentacao.server";

describe("RN-EST-02 — Trava de quantidade", () => {
  let cleanup: () => Promise<void>;

  beforeAll(async () => { cleanup = await setupTestDb("trava-quantidade"); });
  afterEach(async () => { await resetTestDb(); });
  afterAll(async () => { cleanup = cleanup; await cleanup(); });

  it("bloqueia SAIDA de 1 un. quando quantidade é 0 (409)", async () => {
    const item = await prismaTest.itemEstoque.create({
      data: { nome: "Papel A4", tipo: "CONSUMO", quantidade: 0 },
    });

    await expect(criarMovimentacao({
      itemId: item.id,
      delta: -1,
      justificativa: "Teste de borda",
      nomeRetirante: "João",
    }, adminUser)).rejects.toMatchObject({ status: 409 });

    const updated = await prismaTest.itemEstoque.findUnique({ where: { id: item.id } });
    expect(updated?.quantidade).toBe(0); // atomicidade — nenhum efeito colateral
  });

  it("permite SAIDA quando quantidade é EXATAMENTE igual ao delta", async () => {
    const item = await prismaTest.itemEstoque.create({
      data: { nome: "Caderno", tipo: "CONSUMO", quantidade: 5 },
    });

    const mov = await criarMovimentacao({
      itemId: item.id,
      delta: -5,
      justificativa: "Borda exata",
      nomeRetirante: "Maria",
    }, adminUser);

    expect(mov.id).toBeDefined();
    const updated = await prismaTest.itemEstoque.findUnique({ where: { id: item.id } });
    expect(updated?.quantidade).toBe(0); // zera, não vira negativo
  });

  it("bloqueia movimentação em item PATRIMONIO (400)", async () => {
    const item = await prismaTest.itemEstoque.create({
      data: { nome: "Projetor BenQ", tipo: "PATRIMONIO", quantidade: 1, numeroSerie: "PJ-001" },
    });

    await expect(criarMovimentacao({
      itemId: item.id,
      delta: -1,
      justificativa: "Saída de patrimônio",
      nomeRetirante: "João",
    }, adminUser)).rejects.toMatchObject({ status: 400 });
  });

  it("rejeita SAIDA sem nomeRetirante (400)", async () => {
    const item = await prismaTest.itemEstoque.create({
      data: { nome: "Caneta", tipo: "CONSUMO", quantidade: 10 },
    });

    await expect(criarMovimentacao({
      itemId: item.id,
      delta: -3,
      justificativa: "Saída sem nome",
      nomeRetirante: "",
    }, adminUser)).rejects.toMatchObject({ status: 400 });
  });
});
```

## 5. Anti-exemplos

- ❌ **Trava de quantidade apenas na UI** (`max={quantidadeAtual}` no input). Bypass trivial via DevTools (`element.removeAttribute("max")` e submit). Viola §2 e expõe a igreja a saídas não autorizadas.
- ❌ **Validar quantidade DEPOIS de `prisma.itemEstoque.update({ decrement })`.** TOCTOU: a quantidade já foi decrementada; rollback em catch é frágil. A trava é **antes** do I/O.
- ❌ **Permitir movimentação em item `PATRIMONIO`** pelo mesmo service de consumo. Patrimônio é gerenciado por Manutenção/Baixa; mistura os 2 fluxos e quebra auditoria.
- ❌ **Aceitar `delta = 0`** no schema Zod. Movimentação "fantasma" polui histórico sem efeito. Schema precisa `refine((n) => n !== 0)`.
- ❌ **Aceitar `nomeRetirante` vazio em saída.** Viola RN-EST-02 (`nomeRetirante` é **obrigatório** para saída). Schema precisa `.superRefine` ou `.min(1)` condicional.
- ❌ **Salvar `nomeRetirante` em log de auditoria** (`safeLog({ acao: "saida", nomeRetirante: "João" })`). Viola RAG `lgpd-igreja-conect` §2.5 — minimização. O carimbo de quem autorizou (`autorizadoPorId`) é o `user.id` do sistema, não precisa do nome.
- ❌ **Múltiplas chamadas a `prisma.itemEstoque.update` fora de `$transaction`** (ex: criar movimentação em 1 update e quantidade em outro sem `$transaction`). Se o segundo update falhar, sistema fica inconsistente. Movimentação **sempre** em `$transaction`.
- ❌ **Confiar em `quantidade` cacheada no loader** para validar no client. O cache é UX; o service SEMPRE re-lê do DB dentro do `$transaction` (anti-TOCTOU).
- ❌ **Criar movimentação espelhada para `PATRIMONIO`** (1 registro SAIDA no item + 1 registro de Manutenção aberta). Use apenas `ManutencaoAtivo` — não duplique auditoria.
- ❌ **Validar `nomeRetirante` apenas no client (HTML `required`)**. Bypass trivial. Schema Zod no service é a única segurança real.

## 6. RAGs relacionados

- [`.harness/RAG/convention-prisma-sqlite.md`](./convention-prisma-sqlite.md) — `prisma.$transaction` é o mecanismo de atomicidade; cuidado com commit assíncrono em E2E (`lesson-prisma-7-commit-settle-e2e`).
- [`.harness/RAG/pattern-3-layer-rbac.md`](./pattern-3-layer-rbac.md) — princípio "Camada 3 é a única que importa"; `assertSaldoQuantidade` é Camada 3 do **negócio**, complementar ao `assertCan*` (RBAC).
- [`.harness/RAG/security-rbac-matrix.md`](./security-rbac-matrix.md) — `SECRETARIO` e `ADMIN` autorizam movimentações; demais perfis só leem.
- [`.harness/RAG/pattern-trava-saldo-service.md`](./pattern-trava-saldo-service.md) — pattern paralelo conceitual (Módulo Financeiro); mesma estrutura (assertHelper + $transaction + anti-TOCTOU).
- [`.harness/RAG/lgpd-igreja-conect.md`](./lgpd-igreja-conect.md) — §2.5 proíbe logar `nomeRetirante`; §2.2 obriga Camada 3.
- [`.harness/RAG/architecture-estoque.md`](./architecture-estoque.md) — visão macro do módulo; este RAG é a **peça de código** (helper + service), o outro é o **fluxo** entre camadas.
- [`.harness/RAG/convention-tipos-item-estoque.md`](./convention-tipos-item-estoque.md) — quando usar `CONSUMO` vs `PATRIMONIO`; este RAG depende da diferenciação semântica.
- [`.harness/RAG/decision-itemEstoque-soft-delete.md`](./decision-itemEstoque-soft-delete.md) — campo `ItemEstoque.ativo` (proposta pendente Fase 2) implica em checar `ativo === true` antes de mutar quantidade.

## 7. Notas de aplicação

### Checklist de PR que toca quantidade (qualquer um dos caminhos)

- [ ] Helper `assertSaldoQuantidade` chamado **antes** de qualquer `prisma.itemEstoque.update` que decrementa? (`grep` confirma ordem.)
- [ ] Helper é a **primeira chamada** dentro do service, **depois** de `assertCan*` (RBAC) e **antes** de `prisma.$transaction`?
- [ ] Schema Zod do input rejeita `delta = 0` e valida `nomeRetirante` obrigatório para `delta < 0`?
- [ ] `prisma.$transaction` envolve **todas** as mutações (movimentação + quantidade)? Sem mutação fora de transação?
- [ ] Re-leitura da quantidade dentro do `$transaction` (anti-TOCTOU)?
- [ ] Helper rejeita movimentação em item `tipo = PATRIMONIO`? (Patrimônio só via Manutenção.)
- [ ] Helper rejeita item com `ativo === false`? (soft-delete honrado)
- [ ] Teste de borda cobre "quantidade = 0, saída de 1 un. → 409"? É o gate de sprint — sem este teste, sprint não fecha.
- [ ] `safeLog` aplicado em vez de `console.log`? E sem `nomeRetirante` no payload?

### Sinal de code review (recusar PR se aparecer)

- `prisma.itemEstoque.update` sem `assertSaldoQuantidade` antes.
- `prisma.$transaction` faltando em caminho de movimentação.
- `nomeRetirante` validado só no client (`required` HTML).
- Movimentação em item `tipo = PATRIMONIO` sem validação de tipo.
- `console.log` com `quantidade`/`nomeRetirante` (RAG `lgpd-igreja-conect` §2.5).
- `default export` em service (RAG `architecture-monolith-modular` §5).
- `prisma.*` direto em loader de rota (RAG `lesson-route-service-bypass`).

### Testes obrigatórios por sprint que entrega o ciclo 3

- ✅ Quantidade = 0 + SAIDA de 1 un. → 409 (RN-EST-02).
- ✅ Quantidade = valor exato + SAIDA → quantidade zera, lança OK.
- ✅ Movimentação em item PATRIMONIO → 400 (trava de tipo).
- ✅ SAIDA sem nomeRetirante → 400 (RN-EST-02).
- ✅ ENTRADA sem nomeRetirante → OK (opcional para entrada).
- ✅ Item arquivado (ativo=false) → 409 em qualquer movimentação.
- ✅ SECRETARIO criando movimentação → OK (RBAC).
- ✅ DISCIPULADOR tentando criar movimentação → 403 (RBAC).
- ✅ Concorrência: 2 SAIDAs simultâneas que somam mais que quantidade → 1 passa, 1 bloqueia com 409 (anti-TOCTOU documenta garantia).
- ✅ E2E: SECRETARIO registra 5 pacotes de papel A4, depois retira 2 com nomeRetirante, ADMIN abre detalhe e vê histórico completo (métrica macro do brief §7.1).

### Quando reconsiderar este pattern

- Se algum dia o sistema operar com **multi-unidade** (ex: kg, litros, unidades). Aí a trava tem que ser **por unidade de medida** (não pode debitar kg de estoque em litros). Helper vira `assertSaldoQuantidade(itemId, delta, unidade)`. Não é o caso do ciclo 3.
- Se entrar **inventário físico com contagem** (RN futura). A trava passa a comparar `quantidade_atual` com `quantidade_contada`; divergência vira alerta. Não muda o pattern base.
- Se entrar **concorrência multi-processo** (Postgres futuro). O `$transaction` com `Serializable` isolation é mandatório; o helper já lê dentro da transação, então o pattern escala.

### Próximos passos para o ciclo 3 (S11+)

1. **Sprint de hardening:** adicionar teste de **concorrência simulada** — 2 SAIDAs simultâneas que somam mais que a quantidade. SQLite serializa, então não é problema real, mas o teste documenta a garantia.
2. **Auditoria:** script `pnpm audit:estoque` que percorre `MovimentacaoEstoque` e reconcilia com `ItemEstoque.quantidade` atual. Se `SUM(movimentacoes.quantidade WHERE itemId=X) != item.quantidade`, reporta. Roda semanalmente em CI.
3. **Feature futura (não ciclo 3):** inventário físico com checklist mobile. A trava continua valendo — contagem atualiza a quantidade inicial, e o service aplica a trava antes de criar movimentações.