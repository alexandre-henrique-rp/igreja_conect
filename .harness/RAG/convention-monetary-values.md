---
title: Convenção — Valores Monetários em Centavos (Int)
category: convention
applies_to:
  - prisma/schema.prisma (Caixa.saldoCentavos, Lancamento.valorCentavos, TransferenciaCaixa.valorCentavos)
  - app/lib/money.server.ts
  - app/routes/app/financeiro/**
  - app/routes/app/membros/**
created: 2026-06-12
updated: 2026-06-12
version: 1.0
status: approved
priority: high
sources:
  - prisma/schema.prisma (linhas 139, 153, 170)
  - docs/REGRAS_DE_NEGOCIO.md (RN-FIN-01 a RN-FIN-05)
  - brief.md §5.3 (TDD obrigatório)
tags: [convention, money, typescript, prisma, decimal, centavos]
owner: rag-curator
---

## 1. Contexto

A Igreja Conect trata dinheiro real (dízimos, ofertas, transferências entre caixas, despesas). O schema Prisma já cristalizou uma escolha: **toda coluna monetária é `Int` e o sufixo do campo é `Centavos`**. Esta convenção existe por três razões técnicas:

1. **Tipos primitivos do JavaScript Number são ponto-flutuante IEEE 754.** `0.1 + 0.2 !== 0.3`. Aplicado a saldo de caixa, isso vira diferença de 1 centavo que some/reaparece em cada operação — bug clássico de sistema financeiro.
2. **SQLite não tem tipo `Decimal` nativo** (ver `convention-prisma-sqlite.md`). A alternativa ingênua seria `Float`, que herda o mesmo problema.
3. **Inteiro em centavos é o padrão de mercado** (Stripe, PayPal, Square API expõem `amount` em cents). A barreira de entrada para o próximo dev é zero.

A convenção precisa ser aplicada consistentemente: schema, helpers de formatação, validação em action, e UI. Um único lugar que armazena `Float` (ou exibe `*Centavos` cru) é fonte de bug de arredondamento.

## 2. Decisão / Regra

**Toda representação monetária persistida é `Int` em centavos. Toda representação monetária exibida na UI é `string` formatada em BRL via helper centralizado. Conversão é feita apenas na borda (form parse → cents, cents → UI format).**

**Campos já no schema que seguem a convenção (verificar antes de criar novos):**

| Model | Campo | Tipo | Constraint |
|---|---|---|---|
| `Caixa` | `saldoCentavos` | `Int` | `default(0)`, não negativo |
| `Lancamento` | `valorCentavos` | `Int` | `> 0` (validar no service) |
| `TransferenciaCaixa` | `valorCentavos` | `Int` | `> 0` |

**Helpers canônicos em `app/lib/money.server.ts` (TDD obrigatório — testes antes):**

```ts
// Formata Int (cents) → "R$ 1.234,56" para UI
export function formatBRLFromCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(cents / 100);
}

// Parse de string de input ("12,50" / "12.50" / "R$ 12,50") → Int (cents)
// Lança Response(400) em entrada inválida — não retorna NaN silencioso.
export function parseBRLToCents(input: string): number {
  const cleaned = input.replace(/[R$\s.]/g, "").replace(",", ".");
  const reais = Number(cleaned);
  if (!Number.isFinite(reais) || reais < 0) {
    throw new Response("Valor monetário inválido.", { status: 400 });
  }
  return Math.round(reais * 100);
}

// Garante não-negatividade (RN-FIN-04: saldo nunca negativo)
export function assertNonNegative(cents: number, context: string): void {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Response(`${context}: valor monetário deve ser inteiro ≥ 0.`, { status: 400 });
  }
}
```

**Onde aplicar (mapa mental):**

- **Caixa** — toda mutação de `saldoCentavos` passa por service que usa `assertNonNegative`.
- **Transferência** — `valorCentavos > 0` E `caixaOrigem.saldoCentavos >= valorCentavos` (RN-FIN-04).
- **Lançamento** — `valorCentavos > 0`; tipo ENTRADA soma ao saldo, SAIDA subtrai (e bloqueia se insuficiente).
- **Oferta** — pode ser anônima (RN-FIN-05): `membroId = null`, `categoria = OFERTA`.
- **Dízimo** — `membroId` obrigatório, `categoria = DIZIMO` (RN-FIN-05).

**Pitfall crítico:** **nunca** expor `*Centavos` cru na UI (loader retorna `123456` em vez de `"R$ 1.234,56"`). Toda rota formata antes de retornar, ou o componente formata ao receber.

## 3. Consequências

- **Positivas:**
  - Zero bugs de arredondamento: `100 + 50 === 150`, sempre.
  - Saldos de caixa são reconciliáveis: `SELECT SUM(valorCentavos) FROM lancamentos WHERE caixaId = X` confere com `caixa.saldoCentavos`.
  - Helpers testáveis sem I/O: `parseBRLToCents("1.234,56")` é unit test puro.
  - Compatibilidade com gateways futuros: a maioria devolve `amount` em cents.
- **Negativas:**
  - Toda entrada do usuário precisa parse; toda saída precisa format. Custo: ~2 imports + 1 chamada por campo.
  - Display sem formatação vaza "123456" na tela. Mitigação: helper `formatBRLFromCents` é o caminho único.
- **Trade-offs aceitos:**
  - Limite prático do `Int` em SQLite: 2^53 - 1 cents (≈ R$ 90 trilhões). Insuficiente em nenhuma igreja do mundo. Sem risco real.
  - Sem biblioteca de Decimal: `number-precision` ou `dinero.js` adicionaria dependência sem benefício observável no MVP.

## 4. Exemplos

**Exemplo 1 — Service de transferência aplicando todas as travas (RN-FIN-04):**

```ts
// app/lib/finance.server.ts (trecho)
import { prisma } from "~/db/prisma.server";
import { assertNonNegative, parseBRLToCents } from "~/lib/money.server";

export async function transferirEntreCaixas(args: {
  caixaOrigemId: string;
  caixaDestinoId: string;
  valorBRLInput: string;        // string crua do form
  executadoPorId: string;
}) {
  const valorCentavos = parseBRLToCents(args.valorBRLInput);
  assertNonNegative(valorCentavos, "Transferência");

  return prisma.$transaction(async (tx) => {
    const origem = await tx.caixa.findUniqueOrThrow({ where: { id: args.caixaOrigemId } });
    if (origem.saldoCentavos < valorCentavos) {
      throw new Response("Saldo insuficiente no caixa de origem.", { status: 409 });
    }
    await tx.caixa.update({
      where: { id: args.caixaOrigemId },
      data: { saldoCentavos: { decrement: valorCentavos } },
    });
    await tx.caixa.update({
      where: { id: args.caixaDestinoId },
      data: { saldoCentavos: { increment: valorCentavos } },
    });
    return tx.transferenciaCaixa.create({
      data: {
        caixaOrigemId: args.caixaOrigemId,
        caixaDestinoId: args.caixaDestinoId,
        valorCentavos,
        executadoPorId: args.executadoPorId,
      },
    });
  });
}
```

**Exemplo 2 — UI formatando na borda de loader:**

```ts
// app/routes/app/financeiro/caixa/$id.tsx
import { formatBRLFromCents } from "~/lib/money.server";

export async function loader({ params }: Route.LoaderArgs) {
  const caixa = await getCaixaById(params.id);
  return {
    caixa: {
      ...caixa,
      saldoFormatado: formatBRLFromCents(caixa.saldoCentavos), // ✅ string pronta p/ UI
      // saldoCentavos intencionalmente NÃO retornado (evita uso acidental na UI)
    },
  };
}
```

**Exemplo 3 — Teste unitário (TDD antes do service):**

```ts
// app/lib/money.test.ts
import { describe, it, expect } from "vitest";
import { formatBRLFromCents, parseBRLToCents, assertNonNegative } from "./money.server";

describe("money helpers", () => {
  it("formata 123456 cents como R$ 1.234,56", () => {
    expect(formatBRLFromCents(123456)).toBe("R$ 1.234,56");
  });
  it("parse 'R$ 12,50' para 1250 cents", () => {
    expect(parseBRLToCents("R$ 12,50")).toBe(1250);
  });
  it("parse '1.234,56' para 123456 cents", () => {
    expect(parseBRLToCents("1.234,56")).toBe(123456);
  });
  it("rejeita valor negativo com Response 400", () => {
    expect(() => parseBRLToCents("-10")).toThrow();
  });
  it("assertNonNegative aceita 0 e rejeita -1 e 1.5", () => {
    expect(() => assertNonNegative(0, "ctx")).not.toThrow();
    expect(() => assertNonNegative(-1, "ctx")).toThrow();
    expect(() => assertNonNegative(1.5, "ctx")).toThrow();
  });
});
```

## 5. Anti-exemplos

- ❌ **Adicionar campo `saldo: Float` em `Caixa`.** Já temos `saldoCentavos: Int`. Misturar convenções no mesmo model = bug.
- ❌ **Retornar `saldoCentavos: 123456` direto do loader e formatar no JSX com `(valor/100).toFixed(2)`.** Acoplamento UI/service, e formatação fica espalhada. Use o helper.
- ❌ **Salvar `0.1` como `10` (centavos) mas `0.05` como `5` sem usar `Math.round`.** Em casos limítrofes (`0.1 + 0.2 = 0.30000000000000004`), a falta de `Math.round` no `parseBRLToCents` gera `30` em vez de `30`. **Sempre** `Math.round(reais * 100)`.
- ❌ **Concatenar `R$` + valor manualmente no JSX:** `{`R$ ${valor.toFixed(2)}`}`. Quebra com i18n, com valores grandes (sem milhar), com formatação de BRL vs outras moedas.
- ❌ **Confiar em `parseFloat` de `<input type="number">` e gravar direto.** Browsers mandam `1.5` (com ponto, não vírgula) em en-US. `parseBRLToCents` é quem lida com `"1,50"` e `"1.50"`.
- ❌ **Criar `valorReais: Float` em adição a `valorCentavos: Int` "para a UI ser mais fácil".** Toda UI também usa centavos — o helper resolve. Dois campos = dois bugs.
- ❌ **Criar migration que muda `Int` para `BigInt` ou `Decimal` "preventivamente".** YAGNI: int32 cobre até R$ 21 milhões por caixa, mais que suficiente.

## 6. RAGs relacionados

- [`convention-prisma-sqlite.md`](./convention-prisma-sqlite.md) — explica por que `Float`/`Decimal` não é a escolha no SQLite e por que `Int` em cents é a resposta.
- [`security-rbac-matrix.md`](./security-rbac-matrix.md) — `Lancamento` (dízimo) é dado sensível; formatação e log devem respeitar o RAG de LGPD.
- [`lgpd-igreja-conect.md`](./lgpd-igreja-conect.md) — `valorCentavos` é dado financeiro e **não pode** aparecer em log de auditoria.

## 7. Notas de aplicação

- **TDD primeiro (não negociável, v6.2.0+):** testes em `app/lib/money.test.ts` **antes** de qualquer `import { parseBRLToCents }` em route. Cobertura alvo: 100% dos branches (negativo, NaN, vírgula, ponto, com/sem R$, com/sem espaço).
- **Onde parsear:** no `action` da rota, não no `loader`. UI manda string de form (`"1.234,56"`); service converte para `Int` antes de tocar Prisma.
- **Onde formatar:** **no service que devolve ao loader, ou no loader antes de retornar**. Nunca expor `*Centavos` cru para o componente — exceto se o componente faz cálculo (ex: somatório de uma lista) e o formata imediatamente.
- **Migração de dados legados (se vier de planilha):** o script de importação **deve** normalizar para `Int` cents **antes** de inserir. Não inserir como `Float` e "deixar o Prisma converter".
- **Sinal de code review:** se em PR aparece `parseFloat`, `parseInt` em valor monetário, `toFixed(2)`, ou `Intl.NumberFormat` em componente (em vez do helper), pedir refactor.
- **Quando reconsiderar:** se algum dia a igreja operar com **multi-moeda** (ex: doações em dólar). Aí vale extrair para `dinero.js` ou `currency.js`. Não antes.
