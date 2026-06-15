---
title: Pattern — Transferência entre Caixas (RN-FIN-02) — 1 Registro Imutável + 2 Lançamentos Espelho em $transaction
category: pattern
applies_to:
  - app/lib/transferencias.server.ts
  - app/lib/finance.server.ts
  - app/lib/lancamentos.server.ts
  - prisma/schema.prisma (Caixa, TransferenciaCaixa, Lancamento)
  - app/routes/app/financeiro/transferencias/**
created: 2026-06-14
updated: 2026-06-14
version: 1.0
status: approved
priority: high
sources:
  - brief.md §4.4 e §5.2 (Modelagem de transferências confirmada)
  - docs/REGRAS_DE_NEGOCIO.md §2 (RN-FIN-02)
  - .harness/RAG/convention-monetary-values.md §4 (exemplo transferirEntreCaixas)
  - .harness/RAG/pattern-trava-saldo-service.md (gêmeo — trava + atomicidade)
  - .harness/RAG/convention-prisma-sqlite.md §2.6 ($transaction workflow)
tags: [pattern, finance, transferencia, rnf-fin-02, atomicidade, transaction, prisma, espelho, auditoria]
owner: rag-curator
---

## 1. Contexto

A **RN-FIN-02** exige **rastreabilidade total** de transferências entre caixas:

> *"Toda e qualquer transferência de valores entre caixas deve ser registrada de forma imutável, armazenando: valor transferido, data e hora exata da transação, identificador do usuário que executou a transferência."* — `docs/REGRAS_DE_NEGOCIO.md §2`

A decisão de modelagem foi tomada no **discovery do ciclo 2** (brief §5.2) e **confirmada** após considerar alternativas:

- **Alternativa 1 — Apenas `Lancamento` par:** 1 SAIDA na origem + 1 ENTRADA no destino, ambos `categoria = TRANSFERENCIA`. **Rejeitada:** não tem carimbo de operador (RN-FIN-02 exige) nem registro imutável separado — fácil de "esconder" uma transferência entre dois lançamentos.
- **Alternativa 2 — Apenas `TransferenciaCaixa`:** 1 registro imutável, sem lançamentos espelho. **Rejeitada:** `Caixa.saldoCentavos` precisa ser reconciliável via `SUM(Lancamento)` (RAG `convention-monetary-values` §2), o que exige que toda mutação de saldo seja um `Lancamento`.
- **✅ Alternativa 3 — Híbrida (escolhida):** 1 `TransferenciaCaixa` (imutável, auditoria, carimbo do operador) **+ 2 `Lancamento` espelho** (1 SAIDA origem + 1 ENTRADA destino, ambos `categoria = TRANSFERENCIA`). Garante **rastreabilidade** (RN-FIN-02) **+ reconciliação** (RAG `convention-monetary-values`).

A **atomicidade é obrigatória**: as 3 mutações (1 `TransferenciaCaixa.create` + 2 `Lancamento.create`) e as 2 atualizações de saldo (`Caixa.update` × 2) devem acontecer em **uma única `prisma.$transaction`**. Se qualquer parte falhar, **todas** revertem. Sem estado intermediário visível (ex: origem debitada mas destino não creditado).

O pattern é o **gêmeo** do `pattern-trava-saldo-service` (RN-FIN-04): ambos são sobre atomicidade e ordem inegociável de operações, mas este é dedicado à operação composta de **transferência** (5 mutações correlacionadas) enquanto o outro é sobre a trava simples de saldo (1 mutação).

## 2. Decisão / Regra

**Toda transferência entre caixas é executada por `transferirEntreCaixas(input, user)` em `app/lib/transferencias.server.ts`. A função:**

1. Aplica `assertCanSeeFinancials(user)` **PRIMEIRO** (Camada 3 RBAC — `pattern-3-layer-rbac`).
2. Aplica `assertSaldoSuficiente(caixaOrigemId, valorCentavos, ...)` **ANTES** da transação (Camada 3 RN-FIN-04 — `pattern-trava-saldo-service`).
3. Executa 5 mutações em **`prisma.$transaction`** atômica:
   - `transferenciaCaixa.create(...)` — registro imutável.
   - `lancamento.create(...)` × 2 — espelhos SAIDA + ENTRADA.
   - `caixa.update({ decrement })` na origem.
   - `caixa.update({ increment })` no destino.
4. Re-lê `caixa.saldoCentavos` **dentro** da transação (anti-TOCTOU).

**`Lancamento.categoria = TRANSFERENCIA` NUNCA é criado por UI ou service de `criarLancamento`.** É subproduto exclusivo de `transferirEntreCaixas`. Isso é verificado por teste estático (ver §5).

### 2.1 Schema do input (Zod)

```ts
// app/lib/transferencias.server.ts
import { z } from "zod";

export const TransferenciaCreateSchema = z.object({
  caixaOrigemId: z.string().uuid(),
  caixaDestinoId: z.string().uuid(),
  valorCentavos: z.number().int().positive(),  // rejeita 0, negativo, float
  dataHora: z.coerce.date().default(() => new Date()),
}).strict().superRefine((val, ctx) => {
  if (val.caixaOrigemId === val.caixaDestinoId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Origem e destino devem ser caixas diferentes.",
      path: ["caixaDestinoId"],
    });
  }
});
```

### 2.2 Service canônico (RN-FIN-02 + RN-FIN-04 atômico)

```ts
// app/lib/transferencias.server.ts
import { prisma } from "~/db/prisma.server";
import { assertCanSeeFinancials } from "~/lib/rbac.server";
import { assertSaldoSuficiente } from "~/lib/finance.server";

/**
 * @description Transfere valor entre dois caixas. Gera 1 TransferenciaCaixa
 * (imutável, auditoria) + 2 Lancamento espelho (SAIDA origem + ENTRADA destino).
 * Atualiza saldo de ambos. **Atômico** em $transaction.
 * @param {object} input - Validado por TransferenciaCreateSchema.
 * @param {SessionUser} user - Usuário autenticado (Camada 3 RBAC).
 * @returns {Promise<TransferenciaCaixa>} Registro imutável criado.
 * @throws {Response} 400 se origem = destino, valor ≤ 0, ou Zod falhar.
 * @throws {Response} 403 se user sem perfil financeiro.
 * @throws {Response} 404 se caixa origem/destino não existe.
 * @throws {Response} 409 se saldo origem < valor (RN-FIN-04).
 * @example
 *   const t = await transferirEntreCaixas(
 *     { caixaOrigemId, caixaDestinoId, valorCentavos: 5000 },
 *     adminUser
 *   );
 */
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

  // Mutação atômica: 5 operações correlacionadas.
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

    // Validação de destino dentro da transação (consistência).
    const destino = await tx.caixa.findUniqueOrThrow({
      where: { id: input.caixaDestinoId },
      select: { ativo: true },
    });
    if (destino.ativo === false) {
      throw new Response("Caixa de destino está arquivado.", { status: 409 });
    }

    // 1) Registro imutável (auditoria + carimbo do operador)
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
        descricao: `Transferência #${transf.id.slice(0, 8)} → caixa destino`,
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
        descricao: `Transferência #${transf.id.slice(0, 8)} ← caixa origem`,
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

### 2.3 Onde mora cada camada (defense in depth)

| Camada | Arquivo | O que verifica |
|---|---|---|
| **1 — UI** | `app/components/FormTransferencia.tsx` | Esconde formulário se `!canSeeFinancials(user)`. Desabilita submit se `origem.saldoCentavos < valor` (UX, não segurança). |
| **2 — Loader/Action** | `app/routes/app/financeiro/transferencias/nova.tsx` | Action chama `transferirEntreCaixas(parsed, user)`. **Não** duplica validação de saldo — service é single source of truth. |
| **3 — Service** | `app/lib/transferencias.server.ts` | `assertCanSeeFinancials` (RBAC) → `assertSaldoSuficiente` (RN-FIN-04) → `$transaction` atômica. |

### 2.4 Por que 2 lançamentos espelho e não 1

A escolha foi feita para **2 objetivos ortogonais** que cada model cumpre melhor:

- **`TransferenciaCaixa`** é a **prova de auditoria** (RN-FIN-02): registro imutável, carimbo do operador (`executadoPorId`), data/hora exatas. Se um auditor quer "todas as transferências que X fez em 2026", busca em `TransferenciaCaixa WHERE executadoPorId = X`.
- **`Lancamento` (×2)** é a **razão contábil**: a tabela é o **extrato do caixa**. Cada `Lancamento` é um item de linha do extrato. `Caixa.saldoCentavos` é a soma dos lançamentos (`SUM(ENTRADA) - SUM(SAIDA)`). Sem os 2 lançamentos, o extrato omitiria transferências e o saldo seria confuso.

**Reconciliação:** a soma de `valorCentavos` nos 2 `Lancamento` espelho é sempre igual a `valorCentavos` da `TransferenciaCaixa` correspondente. Teste estático cobre isso (ver §5).

### 2.5 Regras inegociáveis

1. **Atomicidade:** 5 mutações em `$transaction`. Sem exceção. Sem mutação fora de transação.
2. **Origem ≠ destino:** validado no Zod (`superRefine`).
3. **Valor > 0:** validado no Zod (`.int().positive()`).
4. **Carimbo de operador:** `executadoPorId: user.id` — nunca `null` ou `undefined`.
5. **`categoria: TRANSFERENCIA` exclusiva de transferências:** nenhum `criarLancamento` aceita essa categoria. Teste estático (`grep`) cobre.
6. **Sem log de `valorCentavos`:** `safeLog` aplicado em qualquer auditoria (RAG `lgpd-igreja-conect` §2.5).

## 3. Consequências

### Positivas

- **Reconciliação trivial:** `SELECT SUM(valorCentavos) FROM lancamentos WHERE caixaId = X AND categoria != 'TRANSFERENCIA'` dá o saldo real. Transferências aparecem em ambos os lados (entrada + saída de mesmo valor), **cancelando-se** na soma, o que é o comportamento contábil correto.
- **Auditoria completa:** um `WHERE executadoPorId = X AND dataHora BETWEEN '2026-01-01' AND '2026-12-31'` lista todas as transferências feitas por X no ano, com data/hora/valor/carimbo.
- **Rastreabilidade de ponta a ponta:** dado um `Lancamento` com `categoria = TRANSFERENCIA`, o service consegue achar a `TransferenciaCaixa` correspondente (via `descricao` ou `dataCompetencia` + cruzamento de valor). Ver RAG `architecture-financeiro` §3.
- **Teste de borda canônico:** transferência com valor `0`, negativo, ou origem = destino **sempre** falha antes do I/O.

### Negativas

- **Volume de dados 3× maior que o mínimo:** cada transferência gera 1 `TransferenciaCaixa` + 2 `Lancamento`. Para 1 igreja com ~100 transferências/mês, são 300 linhas/mês. Aceitável.
- **Inconsistência potencial se `$transaction` não for usado:** origem debitada, destino não creditado, ou 1 lançamento criado mas não o outro. Mitigado pelo teste estático + lint custom (sinal de code review §5).
- **Carimbo de operador imutável:** se um membro deixar a igreja, `TransferenciaCaixa.executadoPorId` continua apontando para ele (FK `Restrict`). Histórico preservado — desejável para auditoria.

### Trade-offs aceitos

- **Não usar evento de domínio** ("`TransferenciaSolicitada` → handler → lança 2 `Lancamento` + 1 `Transferencia`"). Service único síncrono é mais simples, suficiente para 1 processo, e 100% testável sem mock de event bus. YAGNI.
- **Não desnormalizar `valorCentavos` em `TransferenciaCaixa` e em `Lancamento` separadamente** (são 2 cópias do mesmo valor). Razão: `Lancamento` é o extrato canônico, `TransferenciaCaixa` é a auditoria canônica. Replicação é parte do design (read model + audit model).
- **`Lancamento.descricao` referencia `TransferenciaCaixa.id` truncado (8 chars).** Não é FK formal (não há relação Prisma entre os 2 models por design — são ortogonais). É **referência textual** para debug humano (`grep` no log: "Transferência #a1b2c3d4"). Suficiente para o volume esperado.

## 4. Exemplos

### Exemplo 1 — Service (referência §2.2, copy aqui)

Ver §2.2. O exemplo cobre:
- Camada 3 RBAC (`assertCanSeeFinancials`).
- Camada 3 RN-FIN-04 (`assertSaldoSuficiente`).
- Re-leitura anti-TOCTOU dentro do `$transaction`.
- 5 mutações correlacionadas.
- Mensagens de erro com contexto (caixa arquivado, saldo insuficiente).

### Exemplo 2 — UI: Form com trava visual (UX, não segurança)

```tsx
// app/components/FormTransferencia.tsx
import { Can } from "~/components/Can";
import { useLoaderData } from "react-router";
import { formatBRLFromCents } from "~/lib/money.server";

export function FormTransferencia() {
  const { caixas, saldoOrigem } = useLoaderData<typeof loader>();
  const [valor, setValor] = useState(0);
  const saldoInsuficiente = saldoOrigem < valor;

  return (
    <Can allow={["ADMIN", "PASTOR", "FINANCEIRO", "SECRETARIO"]}>
      <Form method="post" className="space-y-4">
        <select name="caixaOrigemId">
          {caixas.map((c) => <option key={c.id} value={c.id}>{c.nome} — {formatBRLFromCents(c.saldoCentavos)}</option>)}
        </select>
        <select name="caixaDestinoId">
          {caixas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <input
          name="valorBRL"
          type="text"
          inputMode="decimal"
          onChange={(e) => setValor(parseBRLToCentsSafe(e.target.value))}
        />
        {saldoInsuficiente && (
          <InfoBox tone="warning">
            Saldo insuficiente no caixa de origem. {/* UX only — Camada 3 barra. */}
          </InfoBox>
        )}
        <Button
          type="submit"
          disabled={saldoInsuficiente}
          data-testid="submit-transferencia"
        >
          Transferir
        </Button>
      </Form>
    </Can>
  );
}
```

### Exemplo 3 — Teste de borda (TDD, bloqueador para sprint)

```ts
// app/lib/transferencias.server.test.ts
describe("RN-FIN-02 — Transferência entre caixas (atomicidade)", () => {
  it("cria 1 TransferenciaCaixa + 2 Lancamento espelho + atualiza 2 saldos", async () => {
    const origem = await prismaTest.caixa.create({ data: { nome: "Geral", saldoCentavos: 10000 } });
    const destino = await prismaTest.caixa.create({ data: { nome: "Cantina", saldoCentavos: 0 } });

    const transf = await transferirEntreCaixas(
      { caixaOrigemId: origem.id, caixaDestinoId: destino.id, valorCentavos: 3000 },
      adminUser
    );

    expect(transf.id).toBeDefined();
    expect(transf.executadoPorId).toBe(adminUser.id);
    expect(transf.valorCentavos).toBe(3000);

    // 2 lançamentos espelho
    const lancamentos = await prismaTest.lancamento.findMany({
      where: { categoria: "TRANSFERENCIA" },
    });
    expect(lancamentos).toHaveLength(2);
    expect(lancamentos.find((l) => l.tipo === "SAIDA")?.caixaId).toBe(origem.id);
    expect(lancamentos.find((l) => l.tipo === "ENTRADA")?.caixaId).toBe(destino.id);

    // Saldos finais
    const origemFinal = await prismaTest.caixa.findUnique({ where: { id: origem.id } });
    const destinoFinal = await prismaTest.caixa.findUnique({ where: { id: destino.id } });
    expect(origemFinal?.saldoCentavos).toBe(7000);   // 10000 - 3000
    expect(destinoFinal?.saldoCentavos).toBe(3000);  // 0 + 3000
  });

  it("rollback total se 1 das 5 mutações falhar (atomicidade)", async () => {
    const origem = await prismaTest.caixa.create({ data: { nome: "Geral", saldoCentavos: 1000 } });
    const destino = await prismaTest.caixa.create({ data: { nome: "Cantina", saldoCentavos: 0 } });

    // Mock: forçar erro na criação do 2º lancamento
    const spy = vi.spyOn(prismaTest.lancamento, "create").mockImplementationOnce(async () => {
      throw new Error("Falha simulada no 2º INSERT");
    });

    await expect(transferirEntreCaixas(
      { caixaOrigemId: origem.id, caixaDestinoId: destino.id, valorCentavos: 500 },
      adminUser
    )).rejects.toThrow("Falha simulada");

    // Saldos intactos (rollback)
    const origemFinal = await prismaTest.caixa.findUnique({ where: { id: origem.id } });
    const destinoFinal = await prismaTest.caixa.findUnique({ where: { id: destino.id } });
    expect(origemFinal?.saldoCentavos).toBe(1000);
    expect(destinoFinal?.saldoCentavos).toBe(0);

    // Nenhum lançamento órfão
    const lancamentos = await prismaTest.lancamento.count({ where: { categoria: "TRANSFERENCIA" } });
    expect(lancamentos).toBe(0);

    // Nenhuma TransferenciaCaixa órfã
    const transf = await prismaTest.transferenciaCaixa.count();
    expect(transf).toBe(0);

    spy.mockRestore();
  });
});
```

### Exemplo 4 — Reconciliação (auditoria semanal, fora do escopo do ciclo 2)

```ts
// app/lib/finance-audit.server.ts (sugestão de feature futura)
export async function auditarReconciliacaoCaixas() {
  const caixas = await prisma.caixa.findMany({ select: { id: true, nome: true, saldoCentavos: true } });
  const inconsistencias = [];
  for (const c of caixas) {
    const calculated = await prisma.lancamento.aggregate({
      where: { caixaId: c.id },
      _sum: { valorCentavos: true },
    });
    const sumEntradas = await prisma.lancamento.aggregate({
      where: { caixaId: c.id, tipo: "ENTRADA" },
      _sum: { valorCentavos: true },
    });
    const sumSaidas = await prisma.lancamento.aggregate({
      where: { caixaId: c.id, tipo: "SAIDA" },
      _sum: { valorCentavos: true },
    });
    const esperado = (sumEntradas._sum.valorCentavos ?? 0) - (sumSaidas._sum.valorCentavos ?? 0);
    if (esperado !== c.saldoCentavos) {
      inconsistencias.push({ caixa: c.nome, saldo: c.saldoCentavos, esperado });
    }
  }
  return inconsistencias;
}
```

> Em produção: rodar via `node-cron` semanal, ou manualmente via `pnpm tsx scripts/auditar-reconciliacao.ts`.

## 5. Anti-exemplos

- ❌ **Criar `transferirEntreCaixas` SEM `prisma.$transaction`** (5 mutações sequenciais sem atomicidade). Se o 3º INSERT falhar, sistema fica inconsistente (origem debitada, destino não creditada). Estado financeiro corrompido.
- ❌ **Permitir `categoria: TRANSFERENCIA` em `criarLancamento`** (formulário genérico). Confunde auditoria — "essa transferência foi lançada pelo usuário ou foi um espelho automático?". Regra: TRANSFERENCIA é exclusiva do `transferirEntreCaixas`.
- ❌ **Não usar `executadoPorId` da sessão, mas sim de um campo do form.** Bypass trivial: usuário envia `executadoPorId = "outro-membro"` e o sistema aceita. SEMPRE `executadoPorId = user.id` no service.
- ❌ **Validar `saldo` com a leitura do `loader` (cache da UI) em vez de re-ler no service.** Cache desatualizado, TOCTOU. SEMPRE `findUnique` dentro do `$transaction`.
- ❌ **Criar apenas `TransferenciaCaixa` SEM os 2 `Lancamento` espelho** (alternativa 2 rejeitada). Saldo de caixa fica órfão: `Caixa.saldoCentavos` precisa ser reconciliado manualmente.
- ❌ **Criar apenas 2 `Lancamento` SEM `TransferenciaCaixa`** (alternativa 1 rejeitada). Sem carimbo de operador, sem registro imutável separado. Viola RN-FIN-02.
- ❌ **Criar `Lancamento` espelho com `membroId = user.id` (operador).** Confuso — o operador não é o membro dizimista. Espelho de transferência tem `membroId = null`.
- ❌ **`descricao` da transferência revelar dados sensíveis** (ex: "Transferência sigilosa para pagar dívida do Pastor"). Auditoria tem que ser **descritiva do evento, não do motivo**. Mensagem-padrão: `"Transferência #<id-curto> → caixa destino"`.
- ❌ **Atomicidade por fora do `$transaction`** (try/catch + rollback manual). Prisma 7 não suporta `BEGIN`/`COMMIT` explícito em SQLite; `$transaction` é o caminho único.
- ❌ **Confundir `categoria: TRANSFERENCIA` com `categoria: DESPESA_OPERACIONAL` na origem.** Categoria **TRANSFERENCIA** é exclusiva para espelhos de transferência. DESPESA_OPERACIONAL é saída real (pagamento de conta, compra de material). O `categoria` é o que distingue as duas naturezas no extrato.

## 6. RAGs relacionados

- [`.harness/RAG/pattern-trava-saldo-service.md`](./pattern-trava-saldo-service.md) — gêmeo; este é dedicado à **operação composta**, aquele à **trava simples**.
- [`.harness/RAG/convention-monetary-values.md`](./convention-monetary-values.md) — §4 já trazia exemplo de `transferirEntreCaixas` (este RAG é a expansão formal); §2 explica por que `valorCentavos: Int`.
- [`.harness/RAG/pattern-3-layer-rbac.md`](./pattern-3-layer-rbac.md) — princípio "Camada 3 é a única que importa" aplicado a transferências.
- [`.harness/RAG/security-rbac-matrix.md`](./security-rbac-matrix.md) — `FINANCEIRO` e `SECRETARIO` têm autonomia para transferir (RN-FIN-03), desde que com saldo (RN-FIN-04).
- [`.harness/RAG/convention-prisma-sqlite.md`](./convention-prisma-sqlite.md) — `$transaction` workflow; §6 do brief cita o gotcha de commit assíncrono em E2E.
- [`.harness/RAG/lesson-prisma-7-commit-settle-e2e.md`](./lesson-prisma-7-commit-settle-e2e.md) — em smoke E2E, `page.goto` logo após `transferirEntreCaixas` pode não ver os lançamentos espelho; usar `dbSettle(100)` ou `waitForLancamentoInDb` (futuro fix S06+).
- [`.harness/RAG/lgpd-igreja-conect.md`](./lgpd-igreja-conect.md) — §2.5 proíbe logar `valorCentavos`; §2.2 obriga Camada 3.
- [`.harness/RAG/architecture-financeiro.md`](./architecture-financeiro.md) — visão macro do módulo; este RAG é a **peça de fluxo** (sequência atômica), aquele é o **diagrama entre camadas**.
- [`.harness/RAG/decision-caixa-soft-delete.md`](./decision-caixa-soft-delete.md) — `caixa.ativo === false` barra transferência (origem ou destino arquivado).

## 7. Notas de aplicação

### Checklist de PR que toca transferência

- [ ] Service `transferirEntreCaixas` chama `assertCanSeeFinancials` **PRIMEIRO**?
- [ ] `assertSaldoSuficiente` chamado **antes** do `$transaction` (UX-friendly) **e** re-leitura **dentro** do `$transaction` (anti-TOCTOU)?
- [ ] 5 mutações dentro de **uma única** `prisma.$transaction`? (grep: nenhuma `await prisma.*` solta fora do callback `async (tx) =>`.)
- [ ] `executadoPorId: user.id` (não de form, não hardcoded)?
- [ ] `categoria: TRANSFERENCIA` nos 2 `Lancamento` espelho?
- [ ] Schema Zod rejeita origem = destino e valor ≤ 0? (teste de borda cobre.)
- [ ] Nenhum `criarLancamento` aceita `categoria: TRANSFERENCIA`? (teste estático cobre — `grep -r "categoria.*TRANSFERENCIA" app/lib/lancamentos.server.ts` deve dar 0 match fora do schema enum.)
- [ ] Logs **sem** `valorCentavos`?
- [ ] `formatBRLFromCents` em toda exibição de saldo na UI do form?

### Sinal de code review (recusar PR se aparecer)

- `prisma.transferenciaCaixa.create` ou `prisma.lancamento.create` **fora** do `prisma.$transaction` em `transferirEntreCaixas`.
- `executadoPorId` recebendo valor de form, query, ou hardcoded.
- Validação de saldo **só** fora do `$transaction` (TOCTOU).
- `default export` em `transferencias.server.ts` (RAG `architecture-monolith-modular` §5).
- `prisma.*` direto em loader/action de transferência (RAG `lesson-route-service-bypass`).
- `criarLancamento` aceitando `categoria: TRANSFERENCIA` (vai contra §2 — TRANSFERENCIA é exclusiva do espelho).

### Testes obrigatórios por sprint que entrega o ciclo 2

- ✅ Origem = destino → 400.
- ✅ Valor = 0 → 400.
- ✅ Valor negativo → 400.
- ✅ Saldo origem < valor → 409.
- ✅ Transferência **rollback completo** se 1 das 5 mutações falhar (teste com mock que injeta erro).
- ✅ Após transferência, `SUM(ENTRADA) - SUM(SAIDA) === saldoCentavos` em **ambos** os caixas.
- ✅ `categoria: TRANSFERENCIA` rejeitada em `criarLancamento` (teste estático / integração).
- ✅ E2E: FINANCEIRO transfere R$ 100 entre 2 caixas; extrato de ambos reflete (origem SAIDA, destino ENTRADA, com mesmo valor).
- ✅ SECRETARIO transferindo com saldo suficiente → OK (RN-FIN-03).
- ✅ DISCIPULADOR tentando `POST /app/financeiro/transferencias` → 403 (RBAC).

### Quando reconsiderar este pattern

- **Se algum dia entrar conta-corrente (multi-caixa com reconciliação bancária).** Aí o pattern vira "movimentação" (saiu do banco, entrou no caixa, lançada no sistema). Pode exigir evento assíncrono. Não é o caso do ciclo 2.
- **Se o volume de transferências explodir** (>10k/mês). Aí vale considerar partição por mês, ou arquivo morto em tabela `transferencias_historico`. Não antecipar.
- **Se multi-moeda entrar** (USD, EUR). Aí a `TransferenciaCaixa` precisa de `moeda` + `caixaOrigem` e `caixaDestino` precisam ter moeda compatível. Service vira `transferirEntreCaixas({ moeda, valorCentavosNaMoeda, ... })`. Não é o caso do ciclo 2.

### Próximos passos para o ciclo 2 (S06+)

1. **Tela de listagem:** `/app/financeiro/transferencias` (somente leitura) com filtros por período, caixa origem, caixa destino, operador.
2. **Auditoria semanal** (`scripts/auditar-reconciliacao.ts`) — pode entrar em sprint tardia do ciclo 2, ou backlog para ciclo 3.
3. **Teste de concorrência:** 2 transferências simultâneas da mesma origem com saldo justo para apenas 1. SQLite serializa, mas o teste documenta a garantia e pega regressão se alguém mover para Postgres sem ajustar isolation level.
