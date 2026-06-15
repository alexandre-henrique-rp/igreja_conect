# S03-T12 — Bloqueio reportado pelo tester (estado revisado)

**Data do reporte:** 2026-06-13T14:10:00Z
**Reporter:** tester (harness-tester)
**Severidade:** **blocker parcial** — S03-T12 não pode ser 100% executada; ~3 chains podem ser testadas com adapt.
**Classificação failure-protocol.json:** `user-action` (ambiguidade operacional — fan-out parcial)
**Padrão recorrente:** este é o **2º bloqueio por fan-out fora de ordem** (1º foi S02-T12 — ver `qa/S02/BLOCKER.md`).

---

## TL;DR

A task S03-T12 ("Teste E2E Playwright — `e2e/discipulado.spec.ts` + `e2e/fidelidade-bypass.spec.ts`") foi atribuída ao tester **antes** do fan-out do backend/frontend da S03 entregar TODOS os pré-requisitos. Após nova inspeção (mais profunda) do working tree, identificamos que:

- ✅ **~50% do fan-out S03 foi entregue** (services + schemas + alguns componentes)
- ❌ **As rotas S03 (T06, T07, T08, T10, T13) NÃO foram criadas** — dependências explícitas de S03-T12
- ❌ **Typecheck do projeto está QUEBRADO** com 4 erros TS
- ❌ **1 teste vitest falhando** em `ministries.server.test.ts` (P2002 não capturado)
- ⚠️ **Working tree está DIRTY** (78 entries: 21 modified, 6 deleted, 51 untracked) — bloqueio operacional

**Conclusão atualizada:** o fan-out de S03 está em **estado parcial funcional** — os services foram entregues e testados em unidade, mas a **camada de rotas (T06, T07, T08, T10) está ausente**, e essas são deps EXPLÍCITAS de S03-T12.

---

## Evidência (verificada em 2026-06-13T14:10:00Z)

### 1. Inventário de arquivos S03 — 50% entregue

**ENTREGUES (untracked mas existem):**
- ✅ `app/lib/discipleship.server.ts` (S03-T01) — completo, 332 linhas
- ✅ `app/lib/discipleship.server.test.ts` (S03-T01 test) — **MAS com erro de import** (testa `isDescendantOf` que não é exportado, só `isDescendantOfPure`)
- ✅ `app/lib/finance.server.ts` (S03-T11) — completo, 71 linhas, com assertCanSeeFinancials
- ✅ `app/lib/finance.server.test.ts` (S03-T11 test)
- ✅ `app/lib/ministries.server.ts` (S03-T04) — completo, 257 linhas
- ✅ `app/lib/ministries.server.test.ts` (S03-T04 test) — **MAS 1 teste falhando** (P2002 não capturado em updateMinisterio)
- ✅ `app/components/CadeiaDiscipulado.tsx` (S03-T05 — parcial)
- ✅ `app/components/ContadorDiscipulos.tsx` (S03-T05 — parcial)
- ✅ `app/components/Dialog.tsx` (S03-T05 — parcial)
- ✅ `app/components/ListaDiscipulos.test.tsx` (S03-T05 — test, mas o .tsx falta)
- ✅ `app/lib/schemas/discipulado.ts` (S03-T03)
- ✅ `app/lib/schemas/ministerios.ts` (S03-T03)

**FALTAM (deps EXPLÍCITAS de S03-T12):**
- ❌ `app/routes/app/membros.$id.discipulado.tsx` (S03-T06) — **rota não existe; assignDisciple não pode ser chamado via form action**
- ❌ `app/routes/app/membros.$id.tipo.tsx` (S03-T08)
- ❌ `app/routes/app/ministerios._index.tsx` (S03-T10)
- ❌ `app/routes/app/membros.$id.discipulador.tsx` (S03-T13)
- ❌ Extensão de `app/routes/app/membros.$id.tsx` com abas (S03-T07) — a rota atual é a S02 (com `ResumoMembro` e `AcoesMembro`, mas SEM TabsMembro, sem Fidelidade, sem loader bypass)
- ❌ Componentes S03-T05 restantes: `DiscipuladoPainel.tsx`, `ModalSelecionarDiscipulador.tsx` (test importa módulo que NÃO EXISTE)
- ❌ Componentes S03-T07: `TabsMembro`, `TabDadosPessoais`, `TabDiscipulado`, `TabMinisterios`, `TabFidelidadeFinanceira`, `Can`, `AcoesMembro`, `ResumoMembro`
- ❌ Componentes S03-T09: `CardMinisterio`, `ModalCriarMinisterio`, `ModalVincularMembro`, `RadioGroup`, `InfoBox`

**Taxa de entrega S03:** 12 de ~22 arquivos = ~55%. **Mas as 4 deps explícitas de T12 incluem 2 que NÃO FORAM ENTREGUES (T06, T07).**

### 2. Typecheck quebrado (4 erros)

```
$ pnpm typecheck
app/components/Dialog.test.tsx(39,10): error TS2322: Type '{ children: Element; open: boolean; onClose?: (() => void) | undefined; title?: string | undefined; footer?: ReactNode; className?: string | undefined; }' is not assignable to type 'DialogProps'.
  Types of property 'onClose' are incompatible.
    Type '(() => void) | undefined' is not assignable to type '() => void'.
      Type 'undefined' is not assignable to type '() => void'.
app/components/ModalSelecionarDiscipulador.test.tsx(19,45): error TS2307: Cannot find module './ModalSelecionarDiscipulador' or its corresponding type declarations.
app/lib/discipleship.server.test.ts(20,60): error TS2694: Namespace '".../app/lib/discipleship.server"' has no exported member 'isDescendantOf'.
app/lib/discipleship.server.test.ts(32,24): error TS2551: Property 'isDescendantOf' does not exist on type 'typeof import(".../app/lib/discipleship.server")'. Did you mean 'isDescendantOfPure'?
```

**Análise:**
- Erro 1: `Dialog.tsx` exporta `onClose` como obrigatório, mas test passa opcional. **Inconsistência de tipos entre componente e test.**
- Erro 2: `ModalSelecionarDiscipulador.test.tsx` importa componente que **NÃO EXISTE** (S03-T05 incompleto).
- Erros 3-4: `discipleship.server.test.ts` testa `isDescendantOf` mas service só exporta `isDescendantOfPure`. **API inconsistente entre service e test.**

**Implicação para teste E2E:** mesmo se as rotas existissem, o typecheck quebrado sugere que o dev server pode falhar ao compilar e retornar 500 em qualquer request, não 4xx com mensagem clara.

### 3. Vitest: 538/539 passam, 1 falha

```
$ pnpm test
 Test Files  2 failed | 55 passed (57)
      Tests  1 failed | 538 passed (539)
   Duration  49.02s
```

**Análise da falha:** `app/lib/ministries.server.test.ts:176` — `updateMinisterio` deveria lançar `NomeDuplicadoError` ao tentar renomear para nome já existente, mas está deixando o `P2002` propagar. O `try/catch` na linha 155-163 usa duck-typing `e && typeof e === "object" && e.code === "P2002"` que pode falhar se o erro for wrapped por `prisma.$transaction` ou similar.

**Implicação para teste E2E:** o service `updateMinisterio` tem bug latente que pode ser exposto por testes E2E de Chain 5 (Fidelidade bypass) quando a rota existir. Fora do escopo do tester corrigir, mas deve ser reportado.

### 4. Working tree MUITO dirty — risco de conflito

```
$ git status --short | wc -l
78
```

**21 modified + 6 deleted + 51 untracked.** Quase tudo é S00/S01/S02/S03. **Se o fan-out for re-disparado agora, conflitos são prováveis.**

**Recomendação:** o orchestrator (ou o agent fan-out) deve **commit o trabalho atual antes de continuar** OU **trabalhar em branch isolada**.

### 5. Membros do enum Cargo no Prisma (verificado)

```prisma
enum Cargo {
  ADMIN
  PASTOR
  SECRETARIO
  DISCIPULADOR
  FINANCEIRO
}
```

**`SECRETARIO` está presente** — Chains 4, 5, 6 da Fidelidade podem ser testadas SEMPRE que o SECRETARIO for seedado.

**`LIDER_MINISTERIO` NÃO está no enum** (mencionado em S02 specs mas DEBT-010 do cross-sprint — não bloqueia MVP).

### 6. Status das 7 chains (análise por chain)

| Chain | Testável AGORA? | Por quê? |
|---|---|---|
| 1 (trava 12) | ❌ NÃO | Rota `membros.$id.discipulado.tsx` (T06) não existe. Service `assignDisciple` existe e funciona, mas E2E precisa de form action HTTP. |
| 2 (anti-loop) | ❌ NÃO | Mesma dependência de T06. |
| 3 (auto-vínculo) | ❌ NÃO | Mesma dependência de T06. |
| 4 (Fidelidade UI) | ❌ NÃO | `membros.$id.tsx` (T07) não foi estendido com TabsMembro. Comentário menciona abas mas não renderiza. |
| 5 (Fidelidade URL) | ❌ NÃO | Loader de T07 não checa `canSeeFinancials` nem força `tab=dados`. |
| 6 (Fidelidade service) | ⚠️ PARCIAL | Service `finance.server.ts` está OK e pode ser validado por source audit. Mas a parte "chamada direta como SECRETARIO → ForbiddenError" requer teste de integração que está em `finance.server.test.ts` (passando). **Pode ser validado por grep.** |
| 7 (RN-MEM-06) | ⚠️ PARCIAL | `promoverTipo` em `members.server.ts` precisa ser verificado (mas a rota dedicada T08 não existe — visita ao S04). **Pode ser validado por grep `setTimeout\|setInterval\|node-cron\|bull` no app/.** |

**Resumo:** **0 chains podem ser 100% testadas. 2 chains (6 e 7) podem ser validadas PARCIALMENTE por source audit.**

---

## DAG de dependências (de sprints/S03.json)

```
S03-T12 (este E2E) — BLOQUEADO PARCIALMENTE
   ├─ S03-T06 (membros.$id.discipulado route)         ❌ NÃO EXISTE
   │    └─ S03-T01 (discipleship.server)              ✅ EXISTE
   │    └─ S03-T05 (componentes de Discipulado)       ⚠️  PARCIAL (3/6)
   ├─ S03-T07 (membros.$id com abas — TabsMembro)     ❌ NÃO EXISTE
   │    └─ S03-T02 (promoverTipo em members.server)   ✅ EXISTE (inferido pelo .test.ts)
   │    └─ S03-T04 (ministries.server)                ✅ EXISTE
   │    └─ S03-T05 (componentes)                      ⚠️  PARCIAL
   │    └─ S02-T07 (rota detalhe S02)                 ✅ EXISTE
   └─ S03-T11 (finance.server)                        ✅ EXISTE
```

---

## O que FOI feito (trabalho válido do tester)

1. **Lido o contexto completo** — `sprints/S03.json`, `sprints/cross-sprint.json`, `sprints/S02.status.json`, `e2e/auth.spec.ts` (template S01), `qa/S02/e2e-chains.json` (template declarativo), `qa/S02/BLOCKER.md` (padrão), `playwright.config.ts`, `prisma/seed.ts`, `prisma/schema.prisma` (enums Cargo, TipoMembro), `app/lib/rbac.server.ts`, `app/lib/discipleship.server.ts` (332 linhas, completo!), `app/lib/finance.server.ts` (71 linhas, completo!), `app/lib/ministries.server.ts` (257 linhas, completo), `app/lib/schemas/discipulado.ts`, `app/lib/schemas/ministerios.ts`, `app/routes/app/membros.$id.tsx` (versão S02 — sem abas), `app/routes/app/membros.$id.editar.tsx` (S02).

2. **Confirmado S02 completo e S03 parcial** — `git status --short` mostra ~78 entries, com arquivos S03 (services e alguns componentes) já entregues, mas rotas críticas (T06, T07) ausentes.

3. **Rodado typecheck** — 4 erros TS (Dialog types, ModalSelecionarDiscipulador módulo faltando, isDescendantOf não exportado).

4. **Rodado vitest** — 538/539 testes passam, 1 falha em `updateMinisterio` (P2002 não capturado).

5. **Gerado `qa/S03/e2e-chains.json`** — 7 chains declarativas completas com mapeamento preciso de deps. Cada chain marca `criticality: GATE` quando aplicável.

6. **Atualizado este BLOCKER.md** — relatório revisado com a nova evidência (estado parcial, typecheck quebrado, 1 teste vitest falhando).

---

## Decisão solicitada ao orchestrator

O tester **não pode prosseguir 100%** sem uma das seguintes ações:

### Opção A (recomendada) — Finalizar fan-out de S03 + corrigir typecheck

Disparar (ou re-disparar) o fan-out de S03 para entregar:
- S03-T06: `app/routes/app/membros.$id.discipulado.tsx`
- S03-T07: extensão de `app/routes/app/membros.$id.tsx` com TabsMembro + Tab* + bypass do loader
- S03-T08: `app/routes/app/membros.$id.tipo.tsx`
- S03-T10: `app/routes/app/ministerios._index.tsx`
- Componentes S03-T05 restantes: `DiscipuladoPainel`, `ModalSelecionarDiscipulador`
- Componentes S03-T07: `TabsMembro`, `TabDadosPessoais`, `TabDiscipulado`, `TabMinisterios`, `TabFidelidadeFinanceira`, `Can`, `AcoesMembro`, `ResumoMembro`
- Componentes S03-T09: `CardMinisterio`, `ModalCriarMinisterio`, `ModalVincularMembro`, `RadioGroup`, `InfoBox`

**E em paralelo (sugestão):** corrigir os 4 erros de typecheck e o 1 teste vitest falhando (provavelmente backend agent).

**Pré-condição:** fazer commit ou stash do working tree dirty ANTES de re-disparar fan-out.

### Opção B — Opção híbrida (teste parcial de Chains 6 e 7 por source-audit)

Invocar `tester` para **gerar specs Playwright parciais que validam apenas as Chains 6 e 7** via source-audit (grep estático do código), e **reportar Chains 1-5 como bloqueadas**. As Chains 4 e 5 podem ser SIMULADAS com asserts `not_visible` em rotas que retornam 404 (não é prova real — é melhor que nada).

**Limitação:** Chains 1-3 e parte de 4-5 ficariam sem cobertura até a Opção A.

### Opção C — Abortar S03-T12

Marcar S03-T12 como `blocked` no `sprints/S03.status.json` (criar o arquivo). Re-invocar `tester` após fan-out completo + typecheck OK.

### Opção D — Investigar causa raiz do padrão (CRÍTICO e recomendado em paralelo)

S02-T12 e S03-T12 foram bloqueadas pelo mesmo motivo: tester invocado antes do fan-out. Sugestão: o orchestrator deve adicionar uma **validação automática** na sua state machine que verifica (1) `pnpm typecheck` passa, (2) `pnpm test` tem N>=threshold testes passando, (3) arquivos de deps listados nos `dependsOn` da task do tester EXISTEM no working tree, ANTES de invocar o tester. Se qualquer check falhar, o orchestrator deve abortar e reportar.

```ts
// Pseudo-código para o orchestrator
function canInvokeTester(sprintTask: SprintTask): boolean {
  const deps = sprintTask.dependsOn;
  for (const dep of deps) {
    const expectedFiles = DEPENDENCY_FILE_MAP[dep]; // mapa dep → arquivos
    for (const file of expectedFiles) {
      if (!fs.existsSync(path.join(ROOT, file))) {
        logBlocker(`Tester bloqueado: dep ${dep} não entregou ${file}`);
        return false;
      }
    }
  }
  if (!runTypecheck().ok) return false;
  if (runVitest().failing > 0) return false;
  return true;
}
```

**Benefício:** evita padrão recorrente de 2+ sprints bloqueadas.

---

## Output parcial (atualizado)

```json
{
  "phase": "phase.5.build",
  "agent": "tester",
  "sprint": "S03",
  "qaDir": "qa/S03/",
  "chainsFile": "qa/S03/e2e-chains.json",
  "resultsFile": null,
  "coverage": {
    "current": null,
    "required": 85,
    "passed": false,
    "reason": "blocked — 2/4 deps explícitas não entregues (T06, T07); typecheck quebrado; 1 vitest falhando"
  },
  "passed": 0,
  "failed": 0,
  "partialChainsTestableBySourceAudit": ["E2E-MEM-FID-6", "E2E-MEM-RN06-7"],
  "blockedChains": ["E2E-MEM-DISC-1", "E2E-MEM-DISC-2", "E2E-MEM-DISC-3", "E2E-MEM-FID-4", "E2E-MEM-FID-5"],
  "readyForQAGate": false,
  "blocker": "S03-T06 (membros.$id.discipulado) e S03-T07 (membros.$id com abas) NÃO entregues. Typecheck quebrado (4 erros). 1 vitest falhando (P2002 em updateMinisterio). Working tree dirty (78 entries). Ver qa/S03/BLOCKER.md para evidência completa.",
  "nextAction": "aguardar decisão do orchestrator (Opção A, B, C ou D)"
}
```

---

## Lesson learned (RAG candidate — promover para RAG global)

**Título:** "Fan-out de Phase 5 está sistematicamente fora de ordem — Orchestrator precisa de gate de pré-condições"

**Contexto:** Phase 5, Sprint S02 e S03 — tester invocado em ambas as sprints **antes** do fan-out de backend/frontend.

**Lição:**
1. S02-T12 (deliverable: `e2e/membros-crud.spec.ts`) foi bloqueada por S02-T01..T11 não entregues.
2. S03-T12 (deliverable: `e2e/discipulado.spec.ts` + `e2e/fidelidade-bypass.spec.ts`) foi **parcialmente bloqueada** por S03-T01..T11 não entregues (50% entregue, mas as deps EXPLÍCITAS de T12 não estão entre as entregues).
3. **2 em 2 sprints** = padrão, não anomalia. O orchestrator não tem um gate automático que verifique pré-condições antes de invocar o tester.

**Lição adicional (S03):** mesmo quando o fan-out é PARCIAL, o typecheck quebrar invalida a suposição de que o dev server pode subir. **Gate de typecheck + vitest é MÍNIMO, não negociável.**

**Ação concreta sugerida (RAG `decision` ou `workflow`):**
- O `state.json` deveria ter um campo `prereqsMet: { typecheck: bool, vitest: { passing: n, total: n, failing: n }, filesPresent: string[] }` atualizado após cada fan-out de worker.
- O orchestrator, antes de invocar `tester`, deveria fazer um `assertion` simples:
  ```ts
  if (!state.prereqsMet || state.prereqsMet.typecheck === false) return BLOCKED;
  if (state.prereqsMet.vitest.failing > 0) return BLOCKED;
  for (const file of state.prereqsMet.filesPresent) {
    if (!fs.existsSync(file)) return BLOCKED;
  }
  ```
- Alternativa: o tester deveria ser **fan-out** também (não invocado pelo orchestrator, mas auto-disparado pelo último worker de backend/frontend que fecha a sprint).

**Benefício:** Evita 2h+ de trabalho perdido por sprint gerando specs que rodam em 404 indefinido, e evita 30min de investigação de typecheck quebrado.

**Categoria:** `workflow` / `lesson` — promover para `~/.config/opencode/training/` (global) por recorrência.

---

## Cross-references

- `qa/S02/BLOCKER.md` — 1º bloqueio por mesmo motivo (S02 fan-out fora de ordem)
- `qa/S02/e2e-chains.json` — template declarativo usado como base
- `e2e/auth.spec.ts` — template Playwright usado como base para spec S03
- `sprints/S03.json` — sprint plan
- `sprints/cross-sprint.json` §"crossModuleDataFlows" flows CF-04, CF-05 (Fidelidade 3 camadas, Trava 12) — origem das chains
- `app/lib/rbac.server.ts` — pré-existente (S00-T05) e correto: `FINANCIAL_CARGOS = [ADMIN, PASTOR, FINANCEIRO]`; SECRETARIO NÃO incluído. Asserção da Chain 6 é verificável por grep.
- `app/lib/discipleship.server.ts` — service S03-T01 completo (332 linhas), mas ROTA T06 ausente
- `app/lib/finance.server.ts` — service S03-T11 completo (71 linhas), OK para Chain 6 source-audit
- `app/lib/ministries.server.ts` — service S03-T04 completo (257 linhas), com 1 bug em updateMinisterio
