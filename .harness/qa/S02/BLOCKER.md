# S02-T12 — Bloqueio reportado pelo tester

**Data do reporte:** 2026-06-13T12:15:00Z
**Reporter:** tester (harness-tester)
**Severidade:** **blocker** — S02-T12 não pode ser executada
**Classificação failure-protocol.json:** `user-action` (ambiguidade operacional — fan-out fora de ordem)

---

## TL;DR

A task S02-T12 ("Teste E2E Playwright — `e2e/membros-crud.spec.ts`") foi atribuída ao tester **antes** do fan-out do backend/frontend da S02 entregar os pré-requisitos (`S02-T01..S11`). O working tree do projeto não contém nenhum dos arquivos que a task S02-T12 precisa exercitar.

O contrato declarativo do que precisa ser testado já foi gerado em `qa/S02/e2e-chains.json` (7 chains prontas), mas a geração do spec Playwright (`e2e/membros-crud.spec.ts`) e a execução foram **bloqueadas** — seria teatro criar chains que dependem de endpoints que retornam 404 ou pior, comportamento indefinido.

---

## Evidência (verificada em 2026-06-13T12:10:00Z)

### 1. Working tree não contém nenhum arquivo da S02

Comando: `find app -type f \( -name "*.ts" -o -name "*.tsx" \) | grep -E '(membro|Membro|MEMBRO)'`

**Resultado:** NENHUM match além de `app/lib/schemas/auth.ts` (S01) e arquivos não relacionados.

### 2. Rotas da S02 NÃO estão registradas em `app/routes.ts`

Linhas atuais de `app/routes.ts:15-19`:

```ts
layout("routes/app/_middleware.tsx", [
    // Rotas autenticadas virão aqui nas S02-S05.
    // (Sprint S01 entrega apenas o middleware + esqueleto de rota.)
    route("/app", "routes/app/_index.tsx"),
]),
```

Faltam (S02-T11): rotas para `membros`, `membros/novo`, `membros/:id`, `membros/:id/editar`.

### 3. Componentes da S02 não existem

Diretório `app/components/` contém apenas: `Button, CardInfo, Checkbox, ErrorAlert, FormLogin, Input, TopbarPublica` (todos da S01).

Faltam (S02-T03 + S02-T05 + S02-T09): `PageHeader, Select, TabelaMembros, CardMembro, FiltrosMembros, Pagination, Breadcrumb, FormField, FormMembro, Section, Sidebar, TopbarAutenticada`.

### 4. Service e schema da S02 não existem

- `app/lib/members.server.ts` (S02-T02) → **NÃO EXISTE**
- `app/lib/schemas/membros.ts` (S02-T01) → **NÃO EXISTE**

### 5. Banco de dados tem apenas o ADMIN

```json
[{
  "id": "c307460e-debe-4213-9eac-a66c089817ef",
  "nome": "Administrador",
  "email": "admin@igreja.local",
  "cargo": "ADMIN",
  "tipo": "MEMBRO_ATIVO",
  "discipuladorId": null
}]
```

Falta seed de DISCIPULADOR + discípulos (necessário para Chains 4 e 5 — RBAC fina).

### 6. Dev server NÃO está respondendo

```bash
$ curl -sS -m 3 http://127.0.0.1:5173/app
curl: (7) Failed to connect to 127.0.0.1 port 5173
```

O dev server é iniciado automaticamente pelo `playwright.config.ts → webServer`, mas as rotas `/app/membros/**` não existem (ver item 2).

---

## DAG de dependências (de sprints/S02.json)

```
S02-T12 (este E2E)
   └─ dependsOn: S02-T11
        └─ dependsOn: S02-T04, S02-T06, S02-T07, S02-T08, S02-T09, S02-T10
             ├─ S02-T04 (membros._index route) ── S02-T02, S02-T03
             ├─ S02-T06 (membros.novo)        ── S02-T02, S02-T05
             ├─ S02-T07 (membros.$id)         ── S02-T02, S02-T03, S02-T05
             ├─ S02-T08 (membros.$id.editar)  ── S02-T02, S02-T05, S02-T07
             ├─ S02-T09 (app layout + sidebar) ─ S01-T06
             └─ S02-T10 (app/_index placeholder) ─ S02-T09
```

**S02-T12 só pode rodar após T01..T11.** Nenhum desses arquivos existe.

---

## O que FOI feito (trabalho válido do tester)

1. **Lido o contexto completo** — `sprints/S02.json`, `sprints/cross-sprint.json`, `e2e/auth.spec.ts` (template S01), `playwright.config.ts`, `prisma/seed.ts`, `prisma/schema.prisma`, `app/routes.ts`, `app/routes/app/_middleware.tsx`, `app/lib/rbac.server.ts`, `app/lib/session.server.ts`, `app/lib/auth.server.ts`, `app/routes/public/login.tsx`.

2. **Confirmado S01 completo** — `sprints/S01.status.json` mostra 199/199 testes passando, coverage 89.31%, 8/8 chains E2E.

3. **Inspecionado o estado do banco e rotas** — apenas ADMIN seedado, rotas `/app/membros/**` ausentes.

4. **Gerado `qa/S02/e2e-chains.json`** — 7 chains declarativas completas (CRUD básico, editar, excluir, RBAC fina DISCIPULADOR vê só seus discípulos, RBAC 404 em outro membro, validação email malformado, LGPD senhaHash ausente do payload). Cada chain tem:
   - `sequence[]` com steps ordenados, `expectedStatus`, `expectedLocation`
   - `cleanup.steps[]` (try/finally no spec) que rodam mesmo em fail
   - `isolatedIp` para isolar rate-limit bucket
   - `dependsOn` explícito referenciando S02-T01..T11

5. **Documentado LIM-S02-001..003** no e2e-chains.json — blocker do fan-out, LIM-002 do path-boundary, blocker do seed S02.

---

## Decisão solicitada ao orchestrator

O tester **não pode prosseguir** sem uma das seguintes ações:

### Opção A (recomendada) — Esperar fan-out
Disparar o fan-out de S02 (`backend` + `frontend` + `security` + `lgpd-officer` + `code-reviewer` em paralelo, conforme fan-out declarado em `sprints/S02.json`).
Após fan-out concluir e o gate `coverage ≥ 80%` ser atingido pelos workers, re-invocar `tester` para S02-T12 — este artefato (`qa/S02/e2e-chains.json`) já está pronto e o spec Playwright pode ser gerado em ~30min seguindo o template `e2e/auth.spec.ts`.

### Opção B — Esperar parcialmente
Invocar `tester` para **gerar e rodar apenas as chains 1, 6, 7** (CRUD básico, validação, LGPD) usando mocks / fixtures do que ainda não existe. **NÃO recomendado** — requer edição de `app/lib/members.server.ts` (fere boundary do tester) ou inversão de mocks (fere TDD).

### Opção C — Abortar S02-T12
Marcar S02-T12 como `blocked` no `sprints/S02.status.json` e re-agendar para após o fan-out.

---

## Output parcial (o que o tester entrega AGORA)

```json
{
  "phase": "phase.5.build",
  "agent": "tester",
  "sprint": "S02",
  "qaDir": "qa/S02/",
  "chainsFile": "qa/S02/e2e-chains.json",
  "resultsFile": null,
  "coverage": { "current": null, "required": 80, "passed": false, "reason": "blocked — S02-T01..T11 not delivered" },
  "passed": 0,
  "failed": 0,
  "readyForQAGate": false,
  "blocker": "S02-T01..T11 (backend members.server, schemas, rotas /app/membros/**, componentes FormMembro/TabelaMembros/Sidebar/etc) ausentes. Ver qa/S02/BLOCKER.md para evidência completa.",
  "nextAction": "aguardar decisão do orchestrator (Opção A, B ou C)"
}
```

---

## Lesson learned (RAG candidate)

**Título:** "Tester deve validar DAG de deps antes de gerar artefatos E2E"
**Contexto:** Phase 5, Sprint N — tester invocado para task E2E.
**Lição:** Antes de começar qualquer chain, o tester deve:
1. Listar explicitamente os `dependsOn` da task.
2. Verificar working tree com `find` ou `glob` para os arquivos esperados.
3. Confirmar que `pnpm dev` ou build está em estado executável.
4. Se algum pre-req faltar, **reportar imediatamente** ao orchestrator em vez de improvisar.
**Benefício:** Evita ~2h de trabalho perdido gerando specs que rodam em 404 indefinido, e dá ao orchestrator visibilidade clara do fan-out fora de ordem.
**Categoria:** `workflow` / `lesson`
