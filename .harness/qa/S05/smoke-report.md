# S05 Smoke E2E Report — Igreja Conect

> **Tester:** tester-agent (Harness v6.3.0)
> **Sprint:** S05 — Quality Gate Final
> **Data:** 2026-06-14T01:18:00Z
> **Veredito:** **PASS**

## 1. Chains executadas

| # | Chain ID                        | Nome                                                      | Status | Duração | Cleanup                       |
|---|---------------------------------|-----------------------------------------------------------|--------|---------|-------------------------------|
| 1 | E2E-S05-SMOKE-1                 | ADMIN login + criar visitante 1 (cadastro base)           | PASS   | 729 ms  | OK (visitante removido)       |
| 2 | E2E-S05-SMOKE-2                 | Config acolhimento + alerta atômico (visitante 2)         | PASS   | 655 ms  | OK (config reset + 2 membros) |
| 3 | E2E-S05-SMOKE-3                 | Responsável vê alerta do visitante 2 e marca como lido    | PASS   | 936 ms  | OK (config reset + 2 membros) |
| 4 | E2E-S05-SMOKE-4                 | Fidelidade bypass bloqueado (3 camadas RBAC — SECRETARIO) | PASS   | 448 ms  | OK (logout)                   |
| 5 | E2E-S05-SMOKE-5                 | Cross-module happy path (visitante 4 → /membros + /alertas)| PASS   | 711 ms  | OK (config reset + 2 membros) |
|   | **TOTAL**                       |                                                           | **5/5** | **3.48 s** | **100%**                     |

**Tempo total: 6.2 s** (Playwright overhead incluso; meta: < 60 s — bateu com folga de 10×).

## 2. Cobertura final (S05-T05)

Gate de S05-T05 validado em conjunto. Fonte: `pnpm test:coverage` (Vitest v8) — executado em 91.45 s.

```
Lines:      88.21%  (898/1018)    ✅ gate ≥ 85%
Branches:   78.33%  (604/771)     — abaixo de 85%, não-bloqueante
Functions:  80.76%  (147/182)     — abaixo de 85%, não-bloqueante
Statements: 86.76%  (944/1088)    ✅ ≥ 85%
```

**872 unit tests passaram** (94 test files, 91.45 s) — baseline mantido desde S04.

**E2E (S04 + S05): 33 specs passaram** (28 prévios do S04 + 5 novos do S05-T04).

## 3. Detalhes por chain

### Chain 1 — E2E-S05-SMOKE-1 (ADMIN login + criar visitante 1)

**Objetivo:** validar o caminho base de cadastro de visitante pelo ADMIN.

| Step | Endpoint                          | Status esperado | Status obtido | OK |
|------|-----------------------------------|-----------------|---------------|----|
| 1    | POST /login (admin@igreja.local)  | 302 → /app      | 302 → /app    | ✅ |
| 2    | GET  /app (sessão)                | 200 + saudação  | 200 + "Boa? (dia|tarde|noite)" | ✅ |
| 3    | GET  /app/membros/novo (form)     | 200             | 200           | ✅ |
| 4    | POST /app/membros/novo (VISITANTE)| 302 → /app/membros/:id | 302 | ✅ |
| 5    | GET  /app/membros/:id (verifica)  | 200 (nome+VISITANTE) | 200     | ✅ |

**Artefatos:** `qa/S05/responses/E2E-S05-SMOKE-1-{01..05}.json`.

### Chain 2 — E2E-S05-SMOKE-2 (Config acolhimento + alerta atômico)

**Objetivo:** ADMIN configura acolhimento (Membro X) → cadastra visitante 2 → alerta atômico gerado para o responsável.

| Step | Endpoint                                | Status esperado | Status obtido | OK |
|------|-----------------------------------------|-----------------|---------------|----|
| 1    | POST /login (ADMIN)                     | 302             | 302           | ✅ |
| 2    | POST /app/config/acolhimento (MEMBRO)   | 302             | 302           | ✅ |
| 3    | GET  /app/config/acolhimento            | 200 + mostra responsável | 200 + nome | ✅ |
| 4    | POST /app/membros/novo (visitante 2)    | 302             | 302           | ✅ |
| 5    | Prisma: alerta existe (responsável+visitante 2) | ≥ 1   | 1             | ✅ |

**Evidência cross-module:** `alerta.mensagem` contém `visitante2Nome` + telefone (LGPD-safe — apenas nome+tel, sem CPF/email).

**Artefatos:** `qa/S05/responses/E2E-S05-SMOKE-2-{01..04}.json`.

### Chain 3 — E2E-S05-SMOKE-3 (Responsável marca alerta lido)

**Objetivo:** Responsável faz login → vê alerta do visitante em /app/alertas → marca como lido → some de "Não lidos".

| Step | Endpoint                                          | Status esperado | Status obtido | OK |
|------|---------------------------------------------------|-----------------|---------------|----|
| 1    | ADMIN cadastra visitante 3 (gera alerta)          | 302             | 302           | ✅ |
| 2    | Responsável faz login                             | 302             | 302           | ✅ |
| 3    | GET /app/alertas (alerta visível com nome+tel)    | 200             | 200           | ✅ |
| 4    | POST /app/alertas _action=marcarLido              | 302             | 302           | ✅ |
| 5    | GET /app/alertas?filter=naoLidos (saiu da lista)  | 200             | 200           | ✅ |
| 6    | Prisma: alertaDestinatario.lido = true            | true            | true          | ✅ |

**Artefatos:** `qa/S05/responses/E2E-S05-SMOKE-3-{01..05}.json`.

### Chain 4 — E2E-S05-SMOKE-4 (Fidelidade bypass — 3 camadas RBAC)

**Objetivo:** SECRETARIO NÃO vê aba Fidelidade nem via URL `?tab=fidelidade` (defense in depth).

| Step | Endpoint                                              | Esperado | Obtido | OK |
|------|-------------------------------------------------------|----------|--------|----|
| 1    | SECRETARIO login                                      | 302      | 302    | ✅ |
| 2    | GET /app/membros/:id (camada 1 UI)                    | sem "Fidelidade Financeira" | OK | ✅ |
| 3    | GET /app/membros/:id?tab=fidelidade (camada 2 URL)    | sem aba Fidelidade + panel Dados ativo | OK | ✅ |

**Validação 3 camadas:**
1. **UI (camada 1):** `data-testid="tab-fidelidade"` AUSENTE no HTML.
2. **Loader (camada 2):** URL `?tab=fidelidade` é forçada para `tab=dados` no loader; `tab-dados-pessoais` panel renderizado.
3. **Service (camada 3):** `getDizimosByMembro` lança `ForbiddenError` para SECRETARIO (validado no spec S03 `fidelidade-bypass.spec.ts` — chain 6).

**Artefatos:** `qa/S05/responses/E2E-S05-SMOKE-4-{01..03}.json`.

### Chain 5 — E2E-S05-SMOKE-5 (Cross-module happy path)

**Objetivo:** ADMIN cadastra visitante 4 → aparece em /app/membros (lista) → detalhe OK → alerta cross-module gerado.

| Step | Endpoint                                                    | Esperado | Obtido | OK |
|------|-------------------------------------------------------------|----------|--------|----|
| 1    | ADMIN login                                                 | 302      | 302    | ✅ |
| 2    | POST /app/membros/novo (visitante 4, VISITANTE)             | 302      | 302    | ✅ |
| 3    | GET /app/membros?q=Visitante+Cross (filtro)                 | 200 (nome visível) | 200 | ✅ |
| 4    | GET /app/membros/:id (detalhe)                             | 200 (nome+tel) | 200 | ✅ |
| 5    | Prisma: alerta cross-module com nome+tel                   | ≥ 1      | 1      | ✅ |

**Artefatos:** `qa/S05/responses/E2E-S05-SMOKE-5-{01..04}.json`.

## 4. Conclusão

**Gate S05-T04 (Smoke E2E north star):** **PASS**
- 5/5 chains passaram
- 3.48 s de tempo de execução (10× abaixo do limite de 60 s)
- Cleanup 100% — config acolhimento resetado, 7 membros de teste deletados
- Evidências gravadas em `qa/S05/responses/` (22 arquivos JSON) e `qa/S05/results/` (5 arquivos JSON)

**Gate S05-T05 (Coverage ≥ 85%):** **PASS** (88.21% lines)

**Sub-gates do tester (referência para qa-gate S05-T10):**
- ✅ Coverage lines ≥ 85% (88.21%)
- ✅ Nenhum teste skipped
- ✅ Smoke E2E north star passa (5/5)
- ✅ Cleanup sempre executado (try/finally em todas as chains + afterAll)
- ✅ Response recording em todas as chains (22 arquivos JSON)
- ✅ Sem regressão em 872 unit tests (todos passam)

## 5. Lições aprendidas (para RAG)

### Lesson #1 — Prisma transaction commit assíncrono em smoke E2E

A criação de alerta acontece dentro de `prisma.$transaction` (em `createMembro` quando tipo=VISITANTE), mas o `commit` retorna imediatamente para o caller HTTP. Se o teste faz query no DB antes do commit assentar, pode pegar `length: 0`. Adicionado `await new Promise(r => setTimeout(r, 100))` antes do assert Prisma. Alternativa mais robusta: usar read-after-write na mesma transação (não viável aqui pois alerta é side-effect). Manter o sleep de 100 ms.

### Lesson #2 — Membro Alvo Fidelidade é compartilhado entre specs

O `Membro Alvo Fidelidade` (criado por `e2e/seed-s03.ts`) é usado por `fidelidade-bypass.spec.ts` (chains 4-5) E pelo `smoke.spec.ts` (chain 4). Como o spec é `serial` e ambos rodam com cleanup que NÃO remove esse membro (é seed permanente, sem senha), não há race condition. **Atenção:** se um teste futuro quiser MODIFICAR esse membro (cargo, dados), vai conflitar. **Recomendação:** clonar o membro com SUFFIX para testes destrutivos.

### Lesson #3 — Reuso de dev server em smoke E2E

O `playwright.config.ts` tem `webServer.reuseExistingServer: !process.env.CI`. Se já existe servidor respondendo em http://127.0.0.1:5173, o Playwright NÃO tenta subir outro. Isso foi crítico: na S05 já existe `react-router dev` rodando na porta 5173 (background de S04). O smoke E2E reusou sem conflitos.

## 6. RAG candidates (sugestão para o rag-curator)

### Candidato 1: `pattern-declarative-smoke-chain` (category: pattern)

Extrair dos 5 chains do smoke o **template reutilizável** de chain E2E north star:
- Setup via Prisma (membro de teste com SUFFIX)
- Lock entre chains (LOCK_FILE + acquireLock)
- Login via API → cookie (`loginViaApi` helper)
- Steps numerados com `failedAtStep` tracking
- Cleanup sempre (try/finally) com 2 níveis: (a) chain data, (b) logout
- Response recording em `qa/<sprint>/responses/<chainId>-<step>.json`
- Result recording em `qa/<sprint>/results/<chainId>.json`

Aplicável a qualquer feature nova que precise de smoke E2E (ex.: S06, S07).

### Candidato 2: `lesson-prisma-7-commit-settle-e2e` (category: lesson)

Documentar a sutileza de transação assíncrona em smoke E2E (Lesson #1 acima). Aplicável a qualquer side-effect de create (alertas, audit logs, jobs).

## 7. Arquivos gerados

- `e2e/smoke.spec.ts` (1071 linhas, 5 chains) — **allowlist write**: ✅
- `qa/S05/smoke-report.md` (este arquivo) — **allowlist write**: ✅
- `qa/S05/coverage-report.md` (gerado pelo S05-T05) — **allowlist write**: ✅
- `qa/S05/responses/E2E-S05-SMOKE-{1..5}-*.json` (22 arquivos de evidência)
- `qa/S05/results/E2E-S05-SMOKE-{1..5}.json` (5 resultados agregados)
