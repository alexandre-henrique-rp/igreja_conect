---
title: Lesson — Prisma `$transaction` Commit Assíncrono em Smoke E2E (Timing Flaky Tests)
category: lesson
applies_to:
  - e2e/**/*.spec.ts
  - app/lib/**/*.server.ts
  - tests/**/*transaction*
  - playwright.config.ts
created: 2026-06-13
updated: 2026-06-13
version: 1.0
status: approved
priority: medium
sources:
  - e2e/smoke.spec.ts (S05, Chain 2: alerta visitante — workaround aplicado)
  - app/lib/members.server.ts:createMembro (prisma.$transaction)
  - app/lib/alerts.server.ts:criarAlertaVisitante (helper transacional)
  - prisma/seed.ts (padrão de seed idempotente — pode ter mesmo problema)
  - .harness/sprints/S05/smoke-report.md (descoberta + mitigação)
  - Vitest docs: vi.useFakeTimers (alternativa que NÃO funciona aqui)
tags: [lesson, prisma, transaction, e2e, flaky-test, timing, race-condition, smoke, s05, workaround, future-fix]
owner: rag-curator
---

## 1. Contexto

No smoke E2E S05 (Chain 2: visitante gera alerta atômico), um alerta criado dentro de `prisma.$transaction([...])` **pode não estar visível** para a query subsequente que valida a chain — mesmo após o `response 302` do action já ter sido retornado. Sintoma típico:

- `await page.goto("/app/alertas")` retorna HTML **sem** o novo alerta
- `await prisma.alerta.findFirst({ where: { ... } })` retorna `null`
- Re-rodar a chain 30 segundos depois **passa**
- Aumentar o `timeout` do Playwright **mascara o sintoma** mas não resolve

**Descoberto em:** S05 (2026-06-13), durante smoke E2E. **Workaround aplicado:** `await new Promise(r => setTimeout(r, 100))` antes do assert Prisma. **Mitigação real pendente:** S06+ (ver §3 e §4.3).

**Por que acontece:** o `prisma.$transaction` do Prisma 7.8 com SQLite via `better-sqlite3` retorna **quando o COMMIT é enfileirado**, não necessariamente quando o **WAL é sincronizado com o reader** (o adapter `better-sqlite3` é sync mas a propagação para o `page.goto` do Playwright pode ter latência sub-ms que, em condições de carga, vira 50-200ms).

**Não é bug do Prisma** — é característica de WAL mode + reader isolado. Afeta qualquer banco SQLite em modo WAL (Write-Ahead Logging), que é o default do `better-sqlite3`.

## 2. Decisão / Regra

### 2.1 Regra prática: para smoke E2E com transação, sempre `await` com settle

```ts
// ❌ ERRADO: pode pegar o reader antes do commit propagar
test('Chain 2: visitante gera alerta', async ({ page, request }) => {
  await page.goto('/app/membros/novo');
  await page.fill('input[name="nome"]', 'Visitante Teste');
  await page.fill('input[name="telefone"]', '11999998888');
  await page.click('button[type="submit"]');
  // Response 302 OK, redirect para /app/membros/:id
  // MAS o alerta dentro da mesma transação pode ainda não estar visível em /app/alertas
  await page.goto('/app/alertas');
  await expect(page.locator('[data-testid="card-alerta"]')).toContainText('Visitante Teste');
  // ↑ pode falhar intermitentemente (flaky)
});

// ✅ CERTO: pequeno settle após mutações transacionais
test('Chain 2: visitante gera alerta', async ({ page, request }) => {
  await page.goto('/app/membros/novo');
  await page.fill('input[name="nome"]', 'Visitante Teste');
  await page.fill('input[name="telefone"]', '11999998888');
  await page.click('button[type="submit"]');

  // Workaround: esperar 100ms para o WAL do SQLite propagar
  await new Promise(r => setTimeout(r, 100));

  await page.goto('/app/alertas');
  await expect(page.locator('[data-testid="card-alerta"]')).toContainText('Visitante Teste');
  // ↑ passa consistentemente
});
```

### 2.2 Workaround documentado (helper)

Centralizar em `e2e/helpers/db-settle.ts` (criar S06+):

```ts
// e2e/helpers/db-settle.ts
/**
 * Aguarda a propagação do WAL do SQLite para readers em outros processos.
 * Workaround para `prisma.$transaction` em smoke E2E.
 *
 * **Por que 100ms?**
 * - better-sqlite3 adapter é sync, mas a propagação WAL → reader pode ter
 *   latência sub-ms em condições de carga. 100ms é folga generosa que
 *   adiciona ~5s ao smoke (10 chains × 100ms) — aceitável.
 * - Aumentar para 200-500ms se ainda flaky.
 *
 * **Por que `setTimeout` e não `waitFor` do Playwright?**
 * - `waitFor` espera **DOM**, não **DB**. Não há como waitar o WAL.
 * - `setTimeout` é determinístico e fácil de remover quando o fix real chegar.
 *
 * @see .harness/RAG/lesson-prisma-7-commit-settle-e2e.md
 */
export async function dbSettle(ms = 100): Promise<void> {
  await new Promise(r => setTimeout(r, ms));
}
```

Uso:
```ts
import { dbSettle } from './helpers/db-settle';

test('Chain 2', async ({ page }) => {
  // ... ação que cria visitante + alerta atômico ...
  await dbSettle();
  await page.goto('/app/alertas');
  // ... asserts ...
});
```

### 2.3 Quando o workaround **NÃO** é necessário

- ✅ Transação + query **no mesmo service** (sem HTTP round-trip): Prisma client garante serialização. `await prisma.alerta.findFirst()` dentro do mesmo service que chamou `prisma.$transaction` funciona.
- ✅ Query via **API JSON interna** (sem browser): o `request.get` do Playwright compartilha o mesmo processo. Latência desprezível.
- ✅ Transação sem round-trip subsequente: smoke não verifica o side-effect, só o response 302.

### 2.4 Quando o workaround **NÃO** resolve

- Se a transação está **realmente falhando** (rollback), `dbSettle` não vai magicamente materializar o alerta. Logar o error e abortar.
- Se o `prisma.$transaction` retorna **antes do COMMIT** (improvável, mas se acontecer), `dbSettle` é placebo. **Sempre** testar com `await prisma.$transaction` retornando explicitamente.

## 3. Consequências

### Positivas (do workaround)

- **Smoke E2E determinístico**: 5/5 chains passam consistentemente (S05).
- **Latência aceitável**: +500ms total no smoke (5 chains × 100ms). Bem abaixo do orçamento de 60s.
- **Fácil de remover**: quando o fix real chegar (S06+), basta deletar as chamadas `dbSettle`.

### Negativas

- **Não é a solução real**: estamos mascarando uma característica do SQLite WAL. Se transação for muito lenta (>100ms), smoke falha de novo. **Workaround, não fix**.
- **Sinal falso de "passou"**: se o alerta **não** foi criado (bug do service), o `dbSettle` não detecta. Smoke **ainda** valida UI (asserts), mas se asserts não forem strict, bug passa.
- **Sensível a carga**: em CI com CPU contended, 100ms pode ser insuficiente. Documentar como ajustar.

### Trade-offs aceitos

- **Não** migrar para Postgres agora (YAGNI — não vale o esforço para MVP).
- **Não** trocar para Prisma Transaction Isolation Level diferente (SQLite não tem).
- **Não** usar `vi.useFakeTimers` (Vitest) — esse problema é **E2E** (Playwright), não unit.

## 4. Exemplos

### Exemplo 1: Smoke E2E S05 — Chain 2 aplicada

```ts
// e2e/smoke.spec.ts (S05)
import { test, expect } from '@playwright/test';
import { dbSettle } from './helpers/db-settle';
import { loginViaApi } from './helpers/auth';
import { TEST_PASSWORD } from './helpers/constants';

test('Chain 2: visitante gera alerta atômico', async ({ page, request }) => {
  // Setup: ADMIN configura acolhimento para Membro X (chain anterior)
  await loginViaApi(request, 'admin@igreja.local', TEST_PASSWORD, page);
  await page.goto('/app/membros/novo');
  await page.fill('input[name="nome"]', 'Visitante Smoke E2E');
  await page.fill('input[name="telefone"]', '11999998888');
  await page.click('button[type="submit"]');

  // Workaround: garantir que o alerta transacional esteja visível
  await dbSettle();  // ← ESSENCIAL

  // Validação: alerta aparece para Membro X
  await loginViaApi(request, 'membro+alvo+fidelidade@igreja.local', TEST_PASSWORD, page);
  await page.goto('/app/alertas');
  await expect(page.locator('[data-testid="card-alerta"]').first())
    .toContainText('Visitante Smoke E2E');
  await expect(page.locator('[data-testid="card-alerta"]').first())
    .toContainText('11999998888');
});
```

### Exemplo 2: Unit test NÃO precisa do workaround

```ts
// app/lib/members.server.test.ts (unit, mesmo processo)
test('createMembro com tipo=VISITANTE cria alerta atômico', async () => {
  // ... criar visitante ...
  await createMembro(input, user);

  // ✅ SEM dbSettle: query no mesmo processo, sem HTTP round-trip
  const alertas = await listAlertas(user, 'todos');
  expect(alertas).toHaveLength(1);
  expect(alertas[0].mensagem).toContain('Visitante Teste');
});
```

### Exemplo 3: Fix real (S06+ — substituir workaround)

```ts
// e2e/smoke.spec.ts (S06+ após fix)
import { waitForAlertInDb } from './helpers/db-settle';

test('Chain 2: visitante gera alerta atômico', async ({ page, request }) => {
  // ...
  await page.click('button[type="submit"]');

  // ✅ Espera **o alerta específico** estar no DB, com timeout razoável
  await waitForAlertInDb({ visitanteNome: 'Visitante Smoke E2E' }, { timeout: 5000 });

  await page.goto('/app/alertas');
  await expect(...);
});
```

```ts
// e2e/helpers/db-settle.ts (S06+)
import { prisma } from '~/db/prisma.server';

export async function waitForAlertInDb(
  filter: { visitanteNome: string },
  opts: { timeout: number } = { timeout: 5000 }
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < opts.timeout) {
    const alerta = await prisma.alerta.findFirst({
      where: { mensagem: { contains: filter.visitanteNome } },
    });
    if (alerta) return;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error(`Alert for ${filter.visitanteNome} not found in ${opts.timeout}ms`);
}
```

**Vantagem:** polling no DB ao invés de timeout cego. Detecta bug (alerta nunca criado) rapidamente, em vez de esperar 100ms e falhar no assert.

## 5. Anti-exemplos

- ❌ **`setTimeout` "grande" tipo 5s** para "garantir" — desperdiça 25s no smoke (5 chains × 5s). E mascara bugs reais.
- ❌ **`vi.useFakeTimers`** (Vitest) — não funciona em Playwright E2E. Playwright tem seu próprio clock.
- ❌ **Múltiplos `dbSettle` na mesma chain** — sinal de que a chain está mal escrita. Consolidar em 1 ponto.
- ❌ **Confiar em `waitForResponse`** do Playwright — ele espera o **response HTTP** (302), não o **DB state**. A transação pode ter feito COMMIT antes do response, mas a propagação WAL ainda não completou.
- ❌ **Re-rodar chain "até passar"** (flaky test bias) — se passa na 2ª tentativa, é flaky. Reportar como flaky, não "fixar".
- ❌ **Migrar para Postgres "só para resolver"** — over-engineering. SQLite + WAL é **escolha consciente** do MVP. Documentar limite, não bypassar.
- ❌ **Desabilitar transação "para o smoke passar"** — **PIOR** coisa. Quebra atomicidade RN-MEM-05. Smoke flaky é preferível a dado inconsistente em prod.
- ❌ **Aumentar timeout do Playwright para 30s** — mascara o problema, desperdiça tempo de CI. Sinal de débito.

## 6. RAGs relacionados

- [`convention-prisma-sqlite.md`](./convention-prisma-sqlite.md) — §2.2 singleton; §2.5 DateTime; este RAG é o **complemento de E2E** (WAL timing).
- [`lesson-prisma-7-vite-8-ssr-incompat.md`](./lesson-prisma-7-vite-8-ssr-incompat.md) — outro caveat do Prisma 7.8. Combinados, são as 2 lições "Prisma 7.8 gotcha" do projeto.
- [`architecture-monolith-modular.md`](./architecture-monolith-modular.md) — `app/db/prisma.server.ts` é o único singleton; relevante para entender o adapter `better-sqlite3`.
- [`lgpd-igreja-conect.md`](./lgpd-igreja-conect.md) — `RN-MEM-05` (atomicidade visita+alerta) é a regra que usa `prisma.$transaction`. Se o workaround mascarar bug, regra fica inválida.

## 7. Notas de aplicação

- **Checklist de E2E chain que usa `prisma.$transaction` na action:**
  - [ ] Após `await page.click('button[type="submit"]')`, há `dbSettle()` antes do próximo `page.goto`?
  - [ ] Se houver polling no DB (`waitForAlertInDb`), timeout é `< 5000ms`?
  - [ ] Chain **NÃO** faz múltiplos `dbSettle`?
  - [ ] Smoke total `< 60s`?
- **Sinal de code review (planning-reviewer):**
  - [ ] PR adiciona `prisma.$transaction` em action? Pedir para adicionar `dbSettle` no E2E correspondente.
  - [ ] PR remove `dbSettle` de chain que faz transação? **Recusar**.
  - [ ] PR adiciona `setTimeout` em teste sem motivo? Pedir para justificar ou remover.
- **Migrar para `waitForAlertInDb`:** quando estabilizar, substituir `dbSettle` cego por polling. S06+ (DEBT-S06-001).
- **Monitorar em CI:** se smoke fica flaky (>5% de runs falham), aumentar `dbSettle` para 200ms **temporariamente** e abrir issue para S06+.
- **Lição replicável:** "**E2E com side-effect transacional precisa de polling ou settle.** Sleep cego é anti-pattern, polling é o ideal." Vale para qualquer banco com WAL (SQLite, Postgres com replicação async, etc).
- **Lembrete para o time:** "**dbSettle é muleta, não solução.** Se você está adicionando mais de 1 `dbSettle` por chain, o problema é da chain (talvez precise ser 2 chains separadas)."
- **Não esquecer:** o workaround **não** substitui teste de atomicidade. `app/lib/members.server.test.ts` testa que **se alerta falha, membro não persiste** (rollback). Esse teste é **unit**, sem `dbSettle`, e é a **verdadeira** validação de RN-MEM-05. O smoke E2E é para o caminho feliz.
