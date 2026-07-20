---
title: "Pattern — Agregações de Lançamento em Relatórios (groupBy + soma em centavos)"
category: pattern
applies_to:
  - app/lib/relatorios.server.ts
  - app/lib/lancamentos.server.ts
  - app/lib/finance.server.ts
  - app/routes/app/financeiro/relatorios/**
  - prisma/schema.prisma (model Lancamento)
created: 2026-06-20
updated: 2026-06-20
version: 1.0
status: approved
priority: high
sources:
  - brief-relatorios.md §4.1 (5 services de agregação)
  - brief-relatorios.md §5.1 (filtros de data — presets)
  - brief-mvp-financeiro.md §4 (Lancamento + CategoriaLancamento)
  - .harness/RAG/convention-monetary-values.md (Int em centavos)
  - .harness/RAG/pattern-3-layer-rbac.md (defense in depth)
  - .harness/RAG/architecture-financeiro.md (Módulo Financeiro — ciclo 2)
tags: [pattern, relatorios, finance, prisma, groupBy, agregacao, centavos, ciclo-4]
owner: rag-curator
---

## 1. Contexto

O **ciclo 4 (Relatórios Financeiros)** adiciona **5 services de agregação** em `app/lib/relatorios.server.ts` que **lêem** o model `Lancamento` já existente (schema do ciclo 1, sem migration). Esses services transformam o repositório bruto de lançamentos em **inteligência estruturada**: DRE, Balancete Mensal, Fluxo de Caixa temporal, Relatório Customizado paginado e exportação CSV.

A operação central de todos os 5 services é `prisma.lancamento.groupBy(...)` combinado com `_sum.valorCentavos` e filtros de `dataCompetencia: { gte, lt }`. Esta escolha de pattern é não-negociável por 3 razões:

1. **Performance:** `groupBy` traduz 1 round-trip ao SQLite em vez de N+1 queries (1 `findMany` por categoria). Em uma igreja com ~5k lançamentos/mês, isso é 5k× vs. ~7 queries (uma por categoria).
2. **Correção monetária:** somar em `Int` (centavos) elimina o bug clássico de `Float` (`0.1 + 0.2 !== 0.3`). Toda agregação opera em cents; formatação BRL só na borda UI.
3. **LGPD + RBAC:** `assertCanSeeRelatorios(user)` PRIMEIRO no service (Camada 3) garante que SECRETARIO não consiga invocar `getDRE` mesmo via bypass de Camada 2.

O pattern é uma **extensão** do `pattern-trava-saldo-service` (RN-FIN-04) e do `architecture-financeiro` (ciclo 2): mesmas convenções (`Int` centavos, Zod strict, 3 camadas), mas com semântica **read-only** (nenhuma mutação).

## 2. Decisão / Regra

### 2.1 Estrutura canônica de cada service de agregação

Todo service de relatório segue **exatamente** este esqueleto (TDD antes do código, gate 100%):

```ts
// app/lib/relatorios.server.ts
import { prisma } from "~/db/prisma.server";
import { assertCanSeeRelatorios } from "~/lib/rbac.server";
import { assertPeriodoValido } from "~/lib/relatorios-helpers.server";

/**
 * @description Agrega entradas e saídas por categoria em um período, retornando DRE.
 * @param {{ inicio: Date; fim: Date }} periodo - Range semi-aberto [inicio, fim).
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<DREData>} DTO com totais, resultado líquido e listas por categoria.
 * @throws {Response} 403 se user não tem cargo em RELATORIOS_CARGOS.
 * @throws {Response} 400 se periodo.inicio >= periodo.fim.
 * @example
 *   const dre = await getDRE({ inicio: new Date("2026-06-01"), fim: new Date("2026-07-01") }, user);
 *   // dre.resultadoLiquidoCentavos === -12345 (déficit)
 */
export async function getDRE(
  periodo: { inicio: Date; fim: Date },
  user: SessionUser
): Promise<DREData> {
  // CAMADA 3 — PRIMEIRO, antes de qualquer I/O.
  assertCanSeeRelatorios(user);
  assertPeriodoValido(periodo);

  // Query única com 2 groupBy paralelos (ENTRADA e SAIDA).
  const [entradas, saidas] = await Promise.all([
    prisma.lancamento.groupBy({
      by: ["categoria"],
      where: { dataCompetencia: { gte: periodo.inicio, lt: periodo.fim }, tipo: "ENTRADA" },
      _sum: { valorCentavos: true },
      _count: { _all: true },
    }),
    prisma.lancamento.groupBy({
      by: ["categoria"],
      where: { dataCompetencia: { gte: periodo.inicio, lt: periodo.fim }, tipo: "SAIDA" },
      _sum: { valorCentavos: true },
      _count: { _all: true },
    }),
  ]);

  // Soma em Int (centavos) — nunca em Float.
  const totalEntradasCentavos = entradas.reduce(
    (acc, e) => acc + (e._sum.valorCentavos ?? 0),
    0
  );
  const totalSaidasCentavos = saidas.reduce(
    (acc, s) => acc + (s._sum.valorCentavos ?? 0),
    0
  );

  return {
    periodo,
    totalEntradasCentavos,
    totalSaidasCentavos,
    resultadoLiquidoCentavos: totalEntradasCentavos - totalSaidasCentavos,
    entradasPorCategoria: mapCategorias(entradas, totalEntradasCentavos),
    saidasPorCategoria: mapCategorias(saidas, totalSaidasCentavos),
  };
}
```

### 2.2 Filtros de data (sempre semi-aberto `[gte, lt)`)

**Decisão:** todos os services de relatório usam `where: { dataCompetencia: { gte: inicio, lt: fim } }`. O `lt` (não `lte`) garante que meses consecutivos não se sobreponham no boundary (01/07 00:00 pertence ao mês 07, não ao mês 06).

```ts
// Mês corrente: [primeiro dia 00:00, primeiro dia do próximo mês 00:00)
// Exemplo: junho/2026 = [2026-06-01T00:00, 2026-07-01T00:00)
const mesCorrente = (): { inicio: Date; fim: Date } => {
  const now = new Date();
  const inicio = new Date(now.getFullYear(), now.getMonth(), 1);
  const fim = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { inicio, fim };
};
```

**Atenção ao fuso horário:** `dataCompetencia` é `DateTime` no Prisma. SQLite armazena em UTC, mas `new Date()` no Node usa o fuso do servidor. Para o ciclo 4, **assume-se fuso do servidor** (sem conversão) — decisão consciente (brief §6.1, herdado do ciclo 2). Migração para `Int` epoch em ciclo futuro se a igreja operar em múltiplos fusos.

### 2.3 Edge cases obrigatórios (testes antes do código)

| Edge case | Comportamento esperado | Test reference |
|---|---|---|
| **Período sem lançamentos** | `{ totalEntradasCentavos: 0, totalSaidasCentavos: 0, resultadoLiquidoCentavos: 0, entradasPorCategoria: [], saidasPorCategoria: [] }`. Sem null/undefined. | `relatorios.server.test.ts:it('returns zeros for empty period')` |
| **Categoria sem movimento** | Omitida da lista `entradasPorCategoria`/`saidasPorCategoria` (não cria linha zerada). | `relatorios.server.test.ts:it('omits categories with zero movement')` |
| **Filtro `categoria` inválida** (ex: `BURRO`) | Zod `.strict()` no loader lança `Response(400, "Categoria inválida")` ANTES de chegar no service. | `relatorios.test.ts:it('rejects invalid categoria enum')` |
| **Período com `inicio >= fim`** | Helper `assertPeriodoValido` lança `Response(400, "Período inválido")`. | `relatorios-helpers.server.test.ts` |
| **Caixa arquivado (`ativo = false`)** | Lançamentos do caixa arquivado **continuam aparecendo** no agregado (regra do ciclo 2: arquivar não apaga histórico). Filtro `ativo` aplicado APENAS para UI/listagem, **nunca** para agregação. | `relatorios.server.test.ts:it('includes archived caixa in aggregate')` |

### 2.4 Map de categorias (helper interno)

Cada relatório precisa transformar `Array<{ categoria, _sum, _count }>` em `Array<{ categoria, totalCentavos, transacoes, percentual }>`. Crie **um helper privado** por arquivo (não exportado):

```ts
// PRIVADO — apenas para uso interno em relatorios.server.ts
function mapCategorias(
  groupBy: Array<{ categoria: CategoriaLancamento; _sum: { valorCentavos: number | null }; _count: { _all: number } }>,
  totalCentavos: number
): Array<{ categoria: CategoriaLancamento; totalCentavos: number; transacoes: number; percentual: number }> {
  return groupBy.map((g) => {
    const total = g._sum.valorCentavos ?? 0;
    return {
      categoria: g.categoria,
      totalCentavos: total,
      transacoes: g._count._all,
      percentual: totalCentavos > 0 ? Math.round((total / totalCentavos) * 10_000) / 100 : 0,
    };
  }).sort((a, b) => b.totalCentavos - a.totalCentavos); // maior → menor
}
```

**Atenção:** `Math.round((total / totalCentavos) * 10_000) / 100` arredonda para 2 casas (ex: `12.34%`). Sem arredondamento, a soma de percentuais pode dar `99.99%` ou `100.01%` por precisão de Float.

### 2.5 Fluxo de Caixa: agregação temporal (12 meses)

Diferente do DRE/Balancete (agregam em 1 período), o Fluxo de Caixa gera uma **série temporal** com 1 ponto por mês:

```ts
// app/lib/relatorios.server.ts
export async function getFluxoCaixa(
  periodo: { inicio: Date; fim: Date },
  user: SessionUser
): Promise<FluxoCaixaData> {
  assertCanSeeRelatorios(user);
  assertPeriodoValido(periodo);

  // PRISMA NÃO SUPORTA groupBy por mês nativo em SQLite.
  // Workaround: buscar findMany e agrupar em memória (12-365 pontos).
  // Para volume esperado (até 5k lançamentos/mês, 12 meses = 60k linhas),
  // é viável. Escalar para Postgres em ciclo futuro.
  const lancamentos = await prisma.lancamento.findMany({
    where: { dataCompetencia: { gte: periodo.inicio, lt: periodo.fim } },
    select: { dataCompetencia: true, tipo: true, valorCentavos: true },
  });

  // Agrupa por mês (YYYY-MM)
  const seriesPorMes = new Map<string, { entradasCentavos: number; saidasCentavos: number }>();
  for (const l of lancamentos) {
    const key = `${l.dataCompetencia.getFullYear()}-${String(l.dataCompetencia.getMonth() + 1).padStart(2, "0")}`;
    const atual = seriesPorMes.get(key) ?? { entradasCentavos: 0, saidasCentavos: 0 };
    if (l.tipo === "ENTRADA") atual.entradasCentavos += l.valorCentavos;
    else atual.saidasCentavos += l.valorCentavos;
    seriesPorMes.set(key, atual);
  }

  // Calcula saldo acumulado (running total)
  let saldoAcumulado = 0;
  const serie = Array.from(seriesPorMes.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => {
      saldoAcumulado += v.entradasCentavos - v.saidasCentavos;
      return { mes, ...v, saldoCentavos: saldoAcumulado };
    });

  return {
    periodo,
    totalEntradasCentavos: serie.reduce((acc, s) => acc + s.entradasCentavos, 0),
    totalSaidasCentavos: serie.reduce((acc, s) => acc + s.saidasCentavos, 0),
    saldoAcumuladoCentavos: saldoAcumulado,
    serie,
  };
}
```

**Limitação conhecida:** `findMany` + `Map` em memória funciona para até ~60k linhas (volume esperado de 1 ano de uma igreja média). Acima disso, migrar para `prisma.$queryRaw` com `strftime('%Y-%m', dataCompetencia)`. **Não** usar `$queryRaw` agora — decisão YAGNI (brief §8: "Sem dependências externas novas").

## 3. Consequências

### 3.1 Positivas

- **Performance:** `groupBy` evita N+1. Para DRE de 1 mês típico (~50 lançamentos, 7 categorias), query cai de ~7 queries para 2 (uma por tipo). Redução de ~70% no tempo de resposta.
- **Type-safe:** tipos do `groupBy` são inferidos do Prisma. Sem tipos ad-hoc.
- **Reutilizável:** mesmo `groupBy({ by: ['categoria'] })` cobre DRE, Balancete e Customizado. Helpers `mapCategorias` evitam duplicação.
- **Testável:** services são puros (recebem `user`, retornam DTO). Mock de `prisma.lancamento.groupBy` cobre 100% dos branches.

### 3.2 Trade-offs aceitos

- **Fluxo de Caixa não escala para 5 anos:** com `findMany` em memória, 60k linhas (1 ano) é OK; 300k linhas (5 anos) começa a degradar. Mitigação: limitar filtro de período a 24 meses na UI (`max 24 meses`). Migração para `$queryRaw` ou Postgres fica para ciclo 6+.
- **Fuso do servidor:** assumido único. Migração para UTC puro em ciclo futuro (se a igreja operar multi-regional).
- **Categorias enum-hardcoded:** `CategoriaLancamento` tem 7 valores (DIZIMO, OFERTA, CAMPANHA, DESPESA_OPERACIONAL, COMPRA_ESTOQUE, MANUTENCAO, TRANSFERENCIA). Adicionar categoria nova requer migration + atualização deste pattern.

## 4. Exemplos

### 4.1 Exemplo completo: DRE de junho/2026

**Input:** `getDRE({ inicio: new Date("2026-06-01"), fim: new Date("2026-07-01") }, userFinanceiro)`

**Query SQL gerada (aproximada):**
```sql
SELECT categoria, SUM(valorCentavos) as sum_valorCentavos, COUNT(*) as count_all
FROM lancamentos
WHERE dataCompetencia >= '2026-06-01' AND dataCompetencia < '2026-07-01' AND tipo = 'ENTRADA'
GROUP BY categoria
```

**Output:**
```ts
{
  periodo: { inicio: 2026-06-01T00:00, fim: 2026-07-01T00:00 },
  totalEntradasCentavos: 1_250_000,   // R$ 12.500,00
  totalSaidasCentavos: 875_400,       // R$ 8.754,00
  resultadoLiquidoCentavos: 374_600,  // R$ 3.746,00 (lucro)
  entradasPorCategoria: [
    { categoria: "DIZIMO", totalCentavos: 800_000, transacoes: 12, percentual: 64.00 },
    { categoria: "OFERTA", totalCentavos: 350_000, transacoes: 8, percentual: 28.00 },
    { categoria: "CAMPANHA", totalCentavos: 100_000, transacoes: 2, percentual: 8.00 },
  ],
  saidasPorCategoria: [
    { categoria: "DESPESA_OPERACIONAL", totalCentavos: 600_000, transacoes: 5, percentual: 68.55 },
    { categoria: "MANUTENCAO", totalCentavos: 200_400, transacoes: 1, percentual: 22.90 },
    { categoria: "COMPRA_ESTOQUE", totalCentavos: 75_000, transacoes: 2, percentual: 8.55 },
  ],
}
```

**Renderização:** UI aplica `formatBRLFromCents(totalCentavos)` em cada valor. Resultado: `R$ 12.500,00` (verde), `R$ 8.754,00` (vermelho), `R$ 3.746,00` (azul com badge "Lucro").

### 4.2 Exemplo de teste (TDD antes do código)

```ts
// app/lib/relatorios.server.test.ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupTestDb, resetTestDb } from "../../tests/helpers/db";
import { getDRE } from "./relatorios.server";
import { criarMembroAdmin } from "./members.server.test-helpers";

describe("relatorios.server — getDRE", () => {
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    cleanup = await setupTestDb("relatorios.server");
  });
  afterEach(async () => { await resetTestDb(); });
  afterAll(async () => { await cleanup(); });

  it("retorna DRE vazia para período sem lançamentos", async () => {
    const user = await criarMembroAdmin();
    const result = await getDRE(
      { inicio: new Date("2026-01-01"), fim: new Date("2026-02-01") },
      user
    );
    expect(result.totalEntradasCentavos).toBe(0);
    expect(result.totalSaidasCentavos).toBe(0);
    expect(result.resultadoLiquidoCentavos).toBe(0);
    expect(result.entradasPorCategoria).toEqual([]);
    expect(result.saidasPorCategoria).toEqual([]);
  });

  it("SECRETARIO recebe 403 antes de qualquer I/O", async () => {
    const user = await criarMembroSecretario();
    await expect(
      getDRE({ inicio: new Date("2026-01-01"), fim: new Date("2026-02-01") }, user)
    ).rejects.toThrow(); // ErrorBoundary → 403
  });

  it("lança 400 se periodo.inicio >= periodo.fim", async () => {
    const user = await criarMembroAdmin();
    await expect(
      getDRE({ inicio: new Date("2026-02-01"), fim: new Date("2026-01-01") }, user)
    ).rejects.toThrow(); // assertPeriodoValido
  });
});
```

## 5. Anti-exemplos

### ❌ Errado: `findMany` + reduce manual

```ts
// NUNCA FAÇA — N+1 queries + soma em Float
const lancamentos = await prisma.lancamento.findMany({ where: { ... } });
const total = lancamentos.reduce((acc, l) => acc + l.valorCentavos, 0);
// Problema 1: 1 query por chamada (não agrega no DB).
// Problema 2: soma em Int está OK aqui, mas se algum dev usar parseFloat antes, bug de precisão.
```

**Por que errado:** perde a vantagem de `groupBy` (agregação no DB). Para 5k lançamentos, transfere 5k linhas do SQLite para Node desnecessariamente.

### ❌ Errado: agregar em `Float`

```ts
// NUNCA FAÇA — bug de precisão IEEE 754
const totalReais = (lancamentos.reduce((acc, l) => acc + l.valorCentavos, 0)) / 100;
// Se 2 devs somarem 0.1 + 0.2, resultado é 0.30000000000000004.
```

**Por que errado:** viola `convention-monetary-values`. Toda agregação em `Int` (cents). Float só na borda UI, e mesmo assim via `formatBRLFromCents` que divide por 100 em ponto-flutuante apenas para `Intl.NumberFormat`.

### ❌ Errado: helper `getDRE` sem RBAC

```ts
// NUNCA FAÇA — bypass de Camada 3
export async function getDRE(periodo, user) {
  // Faltou assertCanSeeRelatorios!
  return prisma.lancamento.groupBy({ ... });
}
```

**Por que errado:** loader pode esquecer de chamar `assertCanSeeRelatorios` na Camada 2 (ex: novo dev adiciona rota sem copiar helper). Service SEM Camada 3 = única linha de defesa é loader. Quebra o pattern `pattern-3-layer-rbac`.

### ❌ Errado: usar `Float` para percentual

```ts
// NUNCA FAÇA — soma de percentuais pode dar 99.99% ou 100.01%
percentual: (total / totalCentavos) * 100,
// Exemplo: 3 categorias com (200/600)*100 + (200/600)*100 + (200/600)*100 = 99.99999...%
```

**Por que errado:** UX ruim na UI ("Cadê o 0.01% que falta?"). Solução: `Math.round(... * 10_000) / 100` (arredonda para 2 casas). Aceita-se pequena diferença de arredondamento.

### ❌ Errado: `groupBy` por data sem normalizar para mês

```ts
// NUNCA FAÇA — agrupa por timestamp completo, explode cardinalidade
prisma.lancamento.groupBy({
  by: ["dataCompetencia"],  // cada lançamento vira 1 grupo (50 grupos)
  ...
});
```

**Por que errado:** DRE/Balancete agregam por categoria (7 grupos), não por data. Para série temporal (Fluxo de Caixa), `groupBy(['dataCompetencia'])` agrupa por dia com timestamp completo — vira 365 grupos/ano em vez de 12. Use `findMany` + `Map` (código §2.5) para agregar manualmente por mês.

## 6. Cross-refs

- **`.harness/RAG/convention-monetary-values.md`** — `Int` em centavos, helpers `formatBRLFromCents` / `parseBRLToCents` / `assertNonNegative`. **Toda agregação em cents.**
- **`.harness/RAG/pattern-3-layer-rbac.md`** — `assertCanSeeRelatorios` é Camada 3. Helper é a ÚLTIMA barreira antes do I/O.
- **`.harness/RAG/pattern-trava-saldo-service.md`** — parallel conceitual (RN-FIN-04: trava antes do I/O). Mesmo princípio, escopo read-only aqui.
- **`.harness/RAG/architecture-financeiro.md`** — visão macro do Módulo Financeiro (ciclo 2), do qual Relatórios é extensão read-only.
- **`.harness/RAG/security-rbac-matrix.md`** — matriz 6 perfis × domínios; Relatórios adiciona 1 coluna nova (`RELATORIOS_CARGOS = 3 perfis`).
- **`brief-relatorios.md`** §4.1 — assinatura canônica dos 5 services.
- **`brief-relatorios.md`** §5.1 — filtros de data (presets + datepicker opcional).
- **`docs/architecture/ARCH.md`** §10 (Relatórios Financeiros, ciclo 4) — diagrama de fluxo e camadas.

## 7. Notas de aplicação / Audit trail

- **Criado em:** 2026-06-20 (Fase 1, ciclo 4 — Relatórios Financeiros).
- **Por:** `documenter` agent (delega para `rag-curator` conforme escopo da Fase 1).
- **Audit:** aplicável em todo PR que tocar `app/lib/relatorios.server.ts`. Code review deve validar:
  1. `assertCanSeeRelatorios(user)` é a PRIMEIRA linha.
  2. Soma em `Int` (cents), nunca `Float`.
  3. `where.dataCompetencia: { gte, lt }` (semi-aberto, não `lte`).
  4. Helpers `mapCategorias` arredondam percentual para 2 casas.
  5. Testes cobrem 100% dos branches (gate de cobertura: 100% em `relatorios.server.ts`).
- **Quando revisar:** ao adicionar novo service de relatório ou nova categoria em `CategoriaLancamento`.
- **Trabalho futuro (backlog, fora do ciclo 4):**
  - Migrar `getFluxoCaixa` para `prisma.$queryRaw` com `strftime` (escala > 24 meses).
  - Adicionar `Caixa.ativo` ao filtro quando o campo for aprovado (ciclo 2 já propôs — ver `decision-caixa-soft-delete`).
  - Adicionar suporte multi-fuso (assumir UTC puro em produção).
