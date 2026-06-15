---
title: Pattern — Trava de Saldo no Service (RN-FIN-04) — assertSaldoSuficiente Antes do I/O
category: pattern
applies_to:
  - app/lib/finance.server.ts
  - app/lib/caixas.server.ts
  - app/lib/lancamentos.server.ts
  - app/lib/transferencias.server.ts
  - app/lib/rbac.server.ts
  - prisma/schema.prisma (Caixa.saldoCentavos, Lancamento, TransferenciaCaixa)
  - app/routes/app/financeiro/**
created: 2026-06-14
updated: 2026-06-14
version: 1.0
status: approved
priority: critical
sources:
  - brief.md §4.5 (Trava de saldo no service — não na UI)
  - docs/REGRAS_DE_NEGOCIO.md §2 (RN-FIN-04 e RN-FIN-03)
  - .harness/RAG/convention-monetary-values.md §2 (helpers de centavos)
  - .harness/RAG/pattern-3-layer-rbac.md §2.2 (assertCan* PRIMEIRO no service)
tags: [pattern, finance, saldo, trava, rnf-fin-04, rnf-fin-03, prisma, transaction, defense-in-depth, centavos]
owner: rag-curator
---

## 1. Contexto

A Igreja Conect trata **dinheiro real** (dízimos, ofertas, transferências entre caixas, despesas operacionais). A **RN-FIN-04** é a regra não-negociável do módulo Financeiro:

> *"O sistema bloqueará sumariamente a aprovação de qualquer saída financeira caso o Caixa selecionado para a operação não possua saldo suficiente para cobri-la. Não será permitida a geração de saldos negativos em caixas individuais."* — `docs/REGRAS_DE_NEGOCIO.md §2`

A trava precisa ser **canônica** porque é o ponto mais sensível de integridade financeira: um bug que permita `saldo < 0` destrói a confiança da congregação e infringe o dever fiduciário do tesoureiro. A regra de auditoria é simples: **a trava de saldo NUNCA pode residir só na UI** (botão desabilitado, mensagem amigável, etc.) porque um atacante pode modificar o DOM e submeter o form com valor maior que o saldo. A defesa tem que estar em **Camada 3 (service)**, antes do `prisma.*` escrever.

A RN-FIN-03 (autonomia por saldo real) completa a regra: `FINANCEIRO` e `SECRETARIO` têm autonomia para aprovar saídas **desde que o caixa tenha saldo**. Se o caixa tem saldo, o sistema processa; se não tem, o sistema barra com 409. A trava é o ponto de controle único.

O domínio tem 3 operações que **mutam saldo** e que DEVEM aplicar a trava:

1. **`criarLancamento` com `tipo: SAIDA`** — subtrai do `Caixa.saldoCentavos` (RN-FIN-01, RN-FIN-04).
2. **`transferirEntreCaixas`** — subtrai do caixa origem, soma no caixa destino (RN-FIN-02).
3. **`criarLancamento` com `tipo: ENTRADA`** — soma ao `Caixa.saldoCentavos` (sem trava, mas passa pelo mesmo helper para garantir não-negatividade eventual).

Toda `criarLancamento` com `categoria: TRANSFERENCIA` é gerada **automaticamente** dentro do `transferirEntreCaixas` (2 lançamentos espelho — ver RAG `pattern-transferencia-caixas`); não há caminho de UI que crie `Lancamento.categoria = TRANSFERENCIA` diretamente. Isso simplifica o universo de validação.

## 2. Decisão / Regra

**Toda mutação de `Caixa.saldoCentavos` passa por `assertSaldoSuficiente(caixaId, valorCentavos, context)` ANTES do `prisma.*` que decrementa. A função helper é `void` e lança `Response(409, "Saldo insuficiente no caixa de origem.")` se a regra falha.**

### 2.1 Helper canônico em `app/lib/finance.server.ts` (ou `app/lib/caixas.server.ts`)

```ts
import { prisma } from "~/db/prisma.server";

/**
 * Camada 3 de defesa para RN-FIN-04 (trava de saldo).
 *
 * Lança Response(409) se o caixa NÃO tem saldo suficiente para a
 * operação. Deve ser a PRIMEIRA chamada antes de qualquer
 * `prisma.caixa.update({ data: { saldoCentavos: { decrement: X } } })`.
 *
 * **NÃO decrementa o saldo aqui** — apenas valida. O decremento
 * real é feito pelo service chamador, dentro de `prisma.$transaction`
 * (atomicidade).
 *
 * @param {string} caixaId - UUID do caixa.
 * @param {number} valorCentavos - Valor a debitar (sempre > 0).
 * @param {string} context - Descrição do contexto (ex: "Saída de Caixa Geral").
 * @returns {Promise<void>}
 * @throws {Response} 409 se saldo < valorCentavos.
 * @throws {Response} 404 se caixa não existe.
 * @example
 *   await assertSaldoSuficiente(caixaId, 100, "Pagamento de conta de luz");
 *   // 100 cents = R$ 1,00; se saldo < 100, throws 409
 */
export async function assertSaldoSuficiente(
  caixaId: string,
  valorCentavos: number,
  context: string
): Promise<void> {
  if (!Number.isInteger(valorCentavos) || valorCentavos <= 0) {
    throw new Response(
      `${context}: valor deve ser inteiro > 0.`,
      { status: 400 }
    );
  }
  const caixa = await prisma.caixa.findUnique({
    where: { id: caixaId },
    select: { id: true, nome: true, saldoCentavos: true, ativo: true },
  });
  if (!caixa) {
    throw new Response(`${context}: caixa não encontrado.`, { status: 404 });
  }
  if (caixa.ativo === false) {
    throw new Response(
      `${context}: caixa "${caixa.nome}" está arquivado e não aceita movimentações.`,
      { status: 409 }
    );
  }
  if (caixa.saldoCentavos < valorCentavos) {
    throw new Response(
      `Saldo insuficiente no caixa de origem. Disponível: R$ ${(caixa.saldoCentavos / 100).toFixed(2)}.`,
      { status: 409 }
    );
  }
}
```

### 2.2 Ordem inegociável no service

```ts
// ✅ CERTO — assertCan* (RBAC) PRIMEIRO, depois trava, depois $transaction
export async function criarLancamento(input, user) {
  assertCanSeeFinancials(user);                       // RN-MEM-03 / RBAC
  // ... validações Zod, regras de categoria (DIZIMO precisa membroId) ...
  if (input.tipo === "SAIDA") {
    await assertSaldoSuficiente(input.caixaId, input.valorCentavos, "Lançamento de saída");
  }
  return prisma.$transaction(async (tx) => { /* ... */ });
}

// ❌ ERRADO — service que toca Prisma antes de validar saldo
await prisma.caixa.update({ data: { saldoCentavos: { decrement: X } } });
if (saldo < 0) throw ...  // TOCTOU + saldo já corrompido
```

### 2.3 Onde mora cada trava (mapa mental)

| Operação | Service | Trava aplica? | Helper |
|---|---|---|---|
| `criarLancamento({ tipo: ENTRADA, categoria: DIZIMO })` | `lancamentos.server.ts` | ❌ (entrada soma, não subtrai) | `assertCanWriteFinanceiro` (RBAC) + RN-FIN-05 (membroId obrigatório) |
| `criarLancamento({ tipo: SAIDA })` | `lancamentos.server.ts` | ✅ | `assertSaldoSuficiente` |
| `criarLancamento({ tipo: ENTRADA, categoria: OFERTA })` | `lancamentos.server.ts` | ❌ | `assertCanWriteFinanceiro` (RN-FIN-05: anônimo OK) |
| `transferirEntreCaixas` | `transferencias.server.ts` | ✅ (origem) | `assertSaldoSuficiente` na origem |
| `criarCaixa` | `caixas.server.ts` | ❌ (Caixa novo, saldo=0) | `assertCanManageCaixa` (RBAC) |
| `arquivarCaixa` | `caixas.server.ts` | ❌ (apenas flip do flag) | `assertCanManageCaixa` |
| `editarLancamento` (apenas descritivo) | `lancamentos.server.ts` | ❌ (não muta saldo) | `assertCanWriteFinanceiro` |

### 2.4 Onde mora a Camada 1 (UI) e Camada 2 (Loader)

**Camada 1 (UI):** botão "Salvar Saída" pode ser desabilitado (`disabled`) se o `saldo` carregado no loader for < `valorCentavos`. Isso é **UX**, não segurança. Código de exemplo:

```tsx
<Button type="submit" disabled={saldoAtual < valorCentavos} data-testid="submit-saida">
  Salvar saída
</Button>
{/* Não confiar neste disabled — Camada 3 é a real. */}
```

**Camada 2 (Loader/Action):** o loader que renderiza o form **não** precisa checar saldo (carga é dinâmica, vem do DB). O `action` que recebe o POST chama o service, que chama `assertSaldoSuficiente` antes do I/O. Comentário de cabeçalho no action:

```ts
// app/routes/app/financeiro/lancamentos/novo.tsx
export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  const form = await request.formData();
  const parsed = LancamentoCreateSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  // Camada 3 (service) trata trava de saldo + RBAC + regras de categoria.
  // Não duplicar a trava aqui — single source of truth = service.
  await criarLancamento(parsed.data, user);
  return redirect("/app/financeiro/caixas/" + parsed.data.caixaId);
}
```

### 2.5 Atomicidade obrigatória em transferências

`transferirEntreCaixas` **sempre** roda em `prisma.$transaction` porque a operação toca 3 tabelas (`Caixa` × 2 + `Lancamento` × 2 + `TransferenciaCaixa` × 1). Se qualquer parte falhar, todas revertem. A trava fica **antes** do `$transaction` para evitar lock desnecessário; as mutações ficam **dentro** da transação. Ver RAG `pattern-transferencia-caixas` para o exemplo completo.

## 3. Consequências

### Positivas

- **Impossível gerar saldo negativo por bug de aplicação** (helper é a única porta de entrada para mutação de saldo).
- **Teste de borda trivial:** "saldo = 0, SAIDA de 1 centavo → 409" cobre 100% da regra. 1 teste por service que muta saldo.
- **Audit-friendly:** o helper loga estruturado (`assertSaldoSuficiente failed: caixaId=X, disponivel=Y, requerido=Z, context=...`) **sem expor `valorCentavos` em log de auditoria** (RN-MEM-03 + RAG `lgpd-igreja-conect` §2.5).
- **Refatoração segura:** se uma operação nova precisar mutar saldo, o caminho é adicionar 1 chamada a `assertSaldoSuficiente` — esqueceu, o typecheck não pega, mas a suíte de testes pega (TDD obrigatório).

### Negativas

- **Mais 1 query ao DB** por operação (o `findUnique` do helper). Aceitável: é o mesmo DB que será tocado depois na transação; sem custo mensurável.
- **Caixa inativo (`ativo: false`) também é barrado** — feature não do escopo do ciclo 2, mas o helper já cobre (ver `decision-caixa-soft-delete`).
- **TOCTOU residual em transferência:** entre o `assertSaldoSuficiente` e o `decrement`, outra transação pode ter consumido o saldo. Mitigação: a checagem **final** de `saldoCentavos >= valorCentavos` acontece DENTRO do `$transaction` (re-leitura). Ver §4 Exemplo 2.

### Trade-offs aceitos

- **Não usar `CHECK (saldoCentavos >= 0)` no SQLite** (seria a defesa em camada 4). Razão: a regra precisa de mensagem amigável e tratamento por caixa (RN-FIN-04 fala em "caixa selecionado", não regra global). Helper no service é mais expressivo.
- **Não usar lock pessimista** (`SELECT ... FOR UPDATE`). SQLite single-writer já serializa; Postgres futuro (RAG `convention-prisma-sqlite` §2) herdaria o mesmo padrão via `$transaction` com `Serializable` isolation se necessário.
- **Logs sem `valorCentavos`** (RN-MEM-03): o contexto da operação é logado, mas o valor não. Em caso de incidente, auditoria tem que correlacionar por `caixaId` + `lancamentoId` no DB, não por valor no log.

## 4. Exemplos

### Exemplo 1 — `criarLancamento` (RN-FIN-04 + RN-FIN-05)

```ts
// app/lib/lancamentos.server.ts
import { z } from "zod";
import { prisma } from "~/db/prisma.server";
import { assertCanSeeFinancials } from "~/lib/rbac.server";
import { assertSaldoSuficiente, assertNonNegative } from "~/lib/finance.server";

export const LancamentoCreateSchema = z.object({
  tipo: z.enum(["ENTRADA", "SAIDA"]),
  categoria: z.enum([
    "DIZIMO", "OFERTA", "CAMPANHA", "DESPESA_OPERACIONAL",
    "COMPRA_ESTOQUE", "MANUTENCAO", "TRANSFERENCIA",
  ]),
  valorCentavos: z.number().int().positive(),
  caixaId: z.string().uuid(),
  membroId: z.string().uuid().optional().nullable(),
  dataCompetencia: z.coerce.date(),
  descricao: z.string().min(1).max(500),
}).strict().superRefine((val, ctx) => {
  // RN-FIN-05: DIZIMO exige membro; OFERTA permite anônimo; outros = membro null
  if (val.categoria === "DIZIMO" && !val.membroId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Dízimo exige vínculo com membro.", path: ["membroId"] });
  }
  if (val.categoria !== "DIZIMO" && val.categoria !== "OFERTA" && val.membroId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Categoria ${val.categoria} não aceita vínculo com membro.`, path: ["membroId"] });
  }
});

export async function criarLancamento(
  input: z.infer<typeof LancamentoCreateSchema>,
  user: SessionUser
) {
  // CAMADA 3 (RBAC) — PRIMEIRO.
  assertCanSeeFinancials(user);

  // Validações monetárias
  assertNonNegative(input.valorCentavos, "Lançamento");

  // CAMADA 3 (RN-FIN-04) — trava de saldo ANTES do I/O.
  if (input.tipo === "SAIDA") {
    await assertSaldoSuficiente(
      input.caixaId,
      input.valorCentavos,
      `Lançamento de saída (${input.categoria})`
    );
  }

  // Mutação atômica: criar lançamento + atualizar saldo.
  return prisma.$transaction(async (tx) => {
    const lancamento = await tx.lancamento.create({ data: input });
    await tx.caixa.update({
      where: { id: input.caixaId },
      data: {
        saldoCentavos: input.tipo === "ENTRADA"
          ? { increment: input.valorCentavos }
          : { decrement: input.valorCentavos },
      },
    });
    return lancamento;
  });
}
```

### Exemplo 2 — `transferirEntreCaixas` (RN-FIN-02 + RN-FIN-04 atômico)

```ts
// app/lib/transferencias.server.ts
import { prisma } from "~/db/prisma.server";
import { assertCanSeeFinancials } from "~/lib/rbac.server";
import { assertSaldoSuficiente } from "~/lib/finance.server";

export const TransferenciaCreateSchema = z.object({
  caixaOrigemId: z.string().uuid(),
  caixaDestinoId: z.string().uuid(),
  valorCentavos: z.number().int().positive(),
  dataHora: z.coerce.date().default(() => new Date()),
}).strict().superRefine((val, ctx) => {
  if (val.caixaOrigemId === val.caixaDestinoId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Origem e destino devem ser caixas diferentes.", path: ["caixaDestinoId"] });
  }
});

export async function transferirEntreCaixas(
  input: z.infer<typeof TransferenciaCreateSchema>,
  user: SessionUser
) {
  // CAMADA 3 (RBAC) — PRIMEIRO.
  assertCanSeeFinancials(user);

  // CAMADA 3 (RN-FIN-04) — trava na origem ANTES do I/O.
  await assertSaldoSuficiente(
    input.caixaOrigemId,
    input.valorCentavos,
    "Transferência entre caixas"
  );

  // Mutação atômica: 1 TransferenciaCaixa + 2 Lancamento espelho + 2 update de Caixa.
  return prisma.$transaction(async (tx) => {
    // Re-leitura do saldo DENTRO da transação (anti-TOCTOU).
    const origem = await tx.caixa.findUniqueOrThrow({
      where: { id: input.caixaOrigemId },
      select: { saldoCentavos: true, ativo: true },
    });
    if (origem.ativo === false) {
      throw new Response("Caixa de origem está arquivado.", { status: 409 });
    }
    if (origem.saldoCentavos < input.valorCentavos) {
      throw new Response(
        "Saldo insuficiente no caixa de origem (validado dentro da transação).",
        { status: 409 }
      );
    }

    // 1) Transferência (imutável, auditoria)
    const transf = await tx.transferenciaCaixa.create({
      data: {
        caixaOrigemId: input.caixaOrigemId,
        caixaDestinoId: input.caixaDestinoId,
        valorCentavos: input.valorCentavos,
        executadoPorId: user.id,
        dataHora: input.dataHora,
      },
    });

    // 2) Lançamento espelho SAIDA na origem
    await tx.lancamento.create({
      data: {
        tipo: "SAIDA",
        categoria: "TRANSFERENCIA",
        valorCentavos: input.valorCentavos,
        caixaId: input.caixaOrigemId,
        dataCompetencia: input.dataHora,
        descricao: `Transferência para caixa destino (id ${input.caixaDestinoId})`,
      },
    });

    // 3) Lançamento espelho ENTRADA no destino
    await tx.lancamento.create({
      data: {
        tipo: "ENTRADA",
        categoria: "TRANSFERENCIA",
        valorCentavos: input.valorCentavos,
        caixaId: input.caixaDestinoId,
        dataCompetencia: input.dataHora,
        descricao: `Transferência recebida do caixa origem (id ${input.caixaOrigemId})`,
      },
    });

    // 4) Decremento origem
    await tx.caixa.update({
      where: { id: input.caixaOrigemId },
      data: { saldoCentavos: { decrement: input.valorCentavos } },
    });

    // 5) Incremento destino
    await tx.caixa.update({
      where: { id: input.caixaDestinoId },
      data: { saldoCentavos: { increment: input.valorCentavos } },
    });

    return transf;
  });
}
```

### Exemplo 3 — Teste de borda (TDD, bloqueador)

```ts
// app/lib/finance.server.test.ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupTestDb, prismaTest, resetTestDb } from "../../tests/helpers/db";
import { assertSaldoSuficiente } from "./finance.server";
import { criarLancamento } from "./lancamentos.server";

describe("RN-FIN-04 — Trava de saldo", () => {
  let cleanup: () => Promise<void>;

  beforeAll(async () => { cleanup = await setupTestDb("trava-saldo"); });
  afterEach(async () => { await resetTestDb(); });
  afterAll(async () => { await cleanup(); });

  it("bloqueia SAIDA de 1 centavo quando saldo é 0 (409)", async () => {
    const caixa = await prismaTest.caixa.create({
      data: { nome: "Caixa Teste", saldoCentavos: 0 },
    });

    await expect(criarLancamento({
      tipo: "SAIDA",
      categoria: "DESPESA_OPERACIONAL",
      valorCentavos: 1,
      caixaId: caixa.id,
      dataCompetencia: new Date(),
      descricao: "Teste de borda",
    }, adminUser)).rejects.toMatchObject({ status: 409 });

    // Saldo permanece 0 (atomicidade — nenhum efeito colateral).
    const updated = await prismaTest.caixa.findUnique({ where: { id: caixa.id } });
    expect(updated?.saldoCentavos).toBe(0);
  });

  it("permite SAIDA quando saldo é EXATAMENTE igual ao valor", async () => {
    const caixa = await prismaTest.caixa.create({
      data: { nome: "Caixa Borda", saldoCentavos: 1000 }, // R$ 10,00
    });

    const lancamento = await criarLancamento({
      tipo: "SAIDA",
      categoria: "DESPESA_OPERACIONAL",
      valorCentavos: 1000,
      caixaId: caixa.id,
      dataCompetencia: new Date(),
      descricao: "Borda exata",
    }, adminUser);

    expect(lancamento.id).toBeDefined();
    const updated = await prismaTest.caixa.findUnique({ where: { id: caixa.id } });
    expect(updated?.saldoCentavos).toBe(0); // saldo zera, não vira negativo
  });

  it("bloqueia transferência origem=destino (400)", async () => {
    const caixa = await prismaTest.caixa.create({
      data: { nome: "Caixa Único", saldoCentavos: 1000 },
    });

    await expect(transferirEntreCaixas({
      caixaOrigemId: caixa.id,
      caixaDestinoId: caixa.id,
      valorCentavos: 100,
    }, adminUser)).rejects.toMatchObject({ status: 400 });
  });

  it("bloqueia transferência com valor=0 (400)", async () => {
    const origem = await prismaTest.caixa.create({ data: { nome: "Origem", saldoCentavos: 1000 } });
    const destino = await prismaTest.caixa.create({ data: { nome: "Destino", saldoCentavos: 0 } });

    await expect(transferirEntreCaixas({
      caixaOrigemId: origem.id,
      caixaDestinoId: destino.id,
      valorCentavos: 0,
    }, adminUser)).rejects.toMatchObject({ status: 400 });
  });

  it("bloqueia transferência com valor negativo (400)", async () => {
    const origem = await prismaTest.caixa.create({ data: { nome: "Origem", saldoCentavos: 1000 } });
    const destino = await prismaTest.caixa.create({ data: { nome: "Destino", saldoCentavos: 0 } });

    await expect(transferirEntreCaixas({
      caixaOrigemId: origem.id,
      caixaDestinoId: destino.id,
      valorCentavos: -100,
    }, adminUser)).rejects.toMatchObject({ status: 400 });
  });
});
```

## 5. Anti-exemplos

- ❌ **Trava de saldo apenas na UI** (botão `disabled` quando saldo insuficiente). Bypass trivial via DevTools (`element.removeAttribute("disabled")` e submit). Viola §2 e expõe a igreja a saídas não autorizadas.
- ❌ **Validar saldo DEPOIS de `prisma.caixa.update({ decrement })`.** TOCTOU: o saldo já foi decrementado; rollback em catch é frágil (rollback de Prisma 7 é automático em `$transaction`, mas fora dele não é). A trava é **antes** do I/O.
- ❌ **Criar campo `valorMaximo: Int` no schema para limitar SAIDA por perfil.** Tentação de autorização "por valor" — mas a regra é **por saldo** (RN-FIN-03/04), não por cargo. Saldo é dinâmico; valor fixo é ficção.
- ❌ **Usar `Float` para `saldoCentavos`** "porque é mais fácil comparar `< 0`". Quebra a convenção `convention-monetary-values` e reintroduz bugs de arredondamento.
- ❌ **Schemas Zod que validam `valorCentavos` mas não `> 0`**. Entrada `0` ou negativa passa no Zod e gera lançamento "fantasma" que polui o extrato. Schema precisa `.int().positive()`.
- ❌ **Salvar valorCentavos em log de auditoria** (`safeLog({ acao: "saida", valor: 100 })`). Viola RAG `lgpd-igreja-conect` §2.5 — valor financeiro nunca vai para log.
- ❌ **Múltiplas chamadas a `prisma.caixa.update` fora de `$transaction`** (ex: origem e destino em 2 updates sequenciais sem `$transaction`). Se o segundo update falhar, o sistema fica inconsistente (origem debitada, destino não creditada). Transferência **sempre** em `$transaction`.
- ❌ **Criar/abrir Caixa com `saldoCentavos` inicial arbitrário** (ex: ADMIN digita R$ 500 de "saldo de abertura" sem lastro). Se for requisito futuro, precisa de auditoria + flag `saldoInicialInformado: Boolean` + justificativa. No ciclo 2, caixas novos nascem com saldo = 0.
- ❌ **Confiar em `saldoCentavos` cacheado no loader** para validar no client. O cache é UX; o service SEMPRE re-lê do DB dentro do `$transaction` (anti-TOCTOU).

## 6. RAGs relacionados

- [`.harness/RAG/convention-monetary-values.md`](./convention-monetary-values.md) — helpers `parseBRLToCents`, `formatBRLFromCents`, `assertNonNegative`; mapa de campos `*Centavos`.
- [`.harness/RAG/pattern-3-layer-rbac.md`](./pattern-3-layer-rbac.md) — princípio "Camada 3 é a única que importa"; `assertSaldoSuficiente` é Camada 3 do **negócio**, complementar ao `assertCan*` (RBAC).
- [`.harness/RAG/security-rbac-matrix.md`](./security-rbac-matrix.md) — `FINANCEIRO` e `SECRETARIO` têm autonomia (RN-FIN-03) **dentro** do que o saldo permite; a trava é sobre saldo, não sobre cargo.
- [`.harness/RAG/pattern-transferencia-caixas.md`](./pattern-transferencia-caixas.md) — pattern gêmeo, dedicado à atomicidade da transferência (1 TransferenciaCaixa + 2 Lancamento espelho + 2 update de Caixa).
- [`.harness/RAG/lgpd-igreja-conect.md`](./lgpd-igreja-conect.md) — §2.5 proíbe logar `valorCentavos`; §2.2 obriga Camada 3.
- [`.harness/RAG/convention-prisma-sqlite.md`](./convention-prisma-sqlite.md) — `prisma.$transaction` é o mecanismo de atomicidade; cuidado com commit assíncrono em E2E (`lesson-prisma-7-commit-settle-e2e`).
- [`.harness/RAG/decision-caixa-soft-delete.md`](./decision-caixa-soft-delete.md) — campo `Caixa.ativo` (proposta pendente Fase 2) implica em checar `ativo === true` antes de mutar saldo.
- [`.harness/RAG/architecture-financeiro.md`](./architecture-financeiro.md) — visão macro do módulo; este RAG é a **peça de código** (helper + service), o outro é o **fluxo** entre camadas.

## 7. Notas de aplicação

### Checklist de PR que toca saldo (qualquer um dos 3 caminhos)

- [ ] Helper `assertSaldoSuficiente` chamado **antes** de qualquer `prisma.caixa.update` que decrementa? (`grep` confirma ordem.)
- [ ] Helper é a **primeira chamada** dentro do service, **depois** de `assertCan*` (RBAC) e **antes** de `prisma.$transaction`?
- [ ] Schema Zod do input tem `.int().positive()` em `valorCentavos`? Rejeita 0 e negativo?
- [ ] `prisma.$transaction` envolve **todas** as mutações (lançamento + saldo + transferência)? Sem mutação fora de transação?
- [ ] Re-leitura do saldo dentro do `$transaction` (anti-TOCTOU) em transferências?
- [ ] Teste de borda cobre "saldo = 0, saída de 1 centavo → 409"? É o gate de sprint — sem este teste, sprint não fecha.
- [ ] `safeLog` aplicado em vez de `console.log`? E sem `valorCentavos` no payload?
- [ ] `formatBRLFromCents` aplicado em **toda** exibição de saldo? Loader **nunca** retorna `*Centavos` cru para a UI?

### Sinal de code review (recusar PR se aparecer)

- `prisma.caixa.update` sem `assertSaldoSuficiente` antes.
- `prisma.$transaction` faltando em caminho de transferência.
- `parseFloat` / `parseInt` / `toFixed(2)` em valor monetário (RAG `convention-monetary-values` §5).
- `console.log` com `valor`/`valorCentavos`/`saldo` (RAG `lgpd-igreja-conect` §2.5).
- `default export` em service (RAG `architecture-monolith-modular` §5).
- `prisma.*` direto em loader de rota (RAG `lesson-route-service-bypass`).

### Testes obrigatórios por sprint que entrega o ciclo 2

- ✅ Saldo = 0 + SAIDA de 1 centavo → 409 (RN-FIN-04).
- ✅ Saldo = valor exato + SAIDA → saldo zera, lança OK.
- ✅ Transferência origem = destino → 400.
- ✅ Transferência valor = 0 → 400.
- ✅ Transferência valor negativo → 400.
- ✅ Transferência saldo origem < valor → 409.
- ✅ SECRETARIO criando caixa → 403 (RBAC).
- ✅ DISCIPULADOR acessando `/app/financeiro/**` → 403 em todas as camadas.
- ✅ DIZIMO sem membroId → 400 (RN-FIN-05).
- ✅ OFERTA sem membroId → OK, anônimo (RN-FIN-05).
- ✅ E2E: FINANCEIRO lança dízimo do Membro X no Caixa Geral; PASTOR abre aba Fidelidade do Membro X e vê o dízimo (métrica macro do brief §7.1).

### Quando reconsiderar este pattern

- Se algum dia o sistema operar com **multi-moeda** (donations em dólar, euro). Aí a trava tem que ser **por moeda** (não pode debitar USD de saldo BRL). Helper vira `assertSaldoSuficiente(caixaId, valorCentavos, moeda)`. Não é o caso do ciclo 2.
- Se entrar **gateway de pagamento** (Pix / cartão). A trava continua valendo — o gateway devolve confirmação, o service aplica a trava antes de criar o `Lancamento` de entrada. Não muda o pattern.
- Se entrar **concorrência multi-processo** (Postgres futuro). O `$transaction` com `Serializable` isolation é mandatório; o helper já lê dentro da transação, então o pattern escala.

### Próximos passos para o ciclo 2 (S06+)

1. **Sprint de hardening:** adicionar teste de **concorrência simulada** — 2 SAIDAs simultâneas que somam mais que o saldo. SQLite serializa, então não é problema real, mas o teste documenta a garantia.
2. **Auditoria:** script `pnpm audit:saldo` que percorre `Lancamento` e reconcilia com `Caixa.saldoCentavos` atual. Se `SUM(valorCentavos WHERE tipo=ENTRADA) - SUM(valorCentavos WHERE tipo=SAIDA) != saldoCentavos`, reporta. Roda semanalmente em CI.
3. **Feature futura (não ciclo 2):** tela `/app/financeiro/auditoria` para ADMIN comparar `saldoCentavos` com `SUM(lancamentos)`. Visão macro de saúde financeira.
