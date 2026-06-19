# Code Review S07 — Transferências entre Caixas

> **Agente:** code-reviewer (Harness v6.3.0)
> **Sprint:** S07 (cycle 2 — Módulo Financeiro: Transferências)
> **Data:** 2026-06-19T18:20:35Z
> **Threshold:** ≥ 70 para `pass`.

**Score:** 78/100
**Status:** PASSED ✅ (com 1 finding HIGH que exige rework)

---

## 1. Avaliação por Critério

| Critério | Nota | Comentário |
|----------|------|------------|
| TDD | 6/10 | Cobertura sólida no service (17 cenários em `transferencias.server.test.ts`) e no schema (11 cenários em `schemas/transferencias.test.ts`). **Débitos:** (1) teste de atomicidade (BLOQUEADOR do TDD) NÃO está implementado — não há mock que falhe na 2ª mutação para provar rollback; (2) `financeiro.transferencia-nova.test.tsx` é fraco — testa apenas mocks de funções já mockadas (não exercita o loader/action real); (3) `FormTransferencia` e `CardTransferencia` SEM `.test.tsx`; (4) `vitest.config.ts` inclui apenas `*.test.ts` (não `*.tsx`) — o teste de rota existente **não roda** (dívida pré-existente MVP confirmada em sprints/S07.json); (5) `e2e/financeiro-transferencia.spec.ts` (T05) **NÃO EXISTE** — sprint JSON marca T05 como `pending`. |
| Documentação | 9/10 | Padrão exemplar: todos os 6 arquivos novos têm cabeçalho com `@see RAG links`; todas as 14 funções públicas (1 schema + 1 type + 7 services + 1 service + 1 loader + 1 action + 2 componentes) têm JSDoc completo (`@description @param @returns @throws @example`). 95+ tags JSDoc totais. **Débitos:** typo "Camada 1 pode掩藏" (caractere chinês corrompido) em `financeiro.transferencia-nova.tsx:188`; `assertSaldoSuficiente` é importada em transferencias.server.ts:30 mas nunca chamada — JSDoc deveria refletir que o re-check inline é a versão "anti-TOCTOU" canônica (a menção atual é confusa). |
| Simplicidade | 6/10 | Código direto sem strategy/factory, YAGNI respeitado (sem `ModalConfirmarTransferencia`, sem página de listagem — ambos corretamente adiados para S09+). **Débitos:** (1) `transferirEntreCaixas` tem **158 linhas** — 5× acima do limite de 30 linhas/função; a função inteira (RBAC + Zod + 2 lookups + $transaction com 5 mutações + log + retorno) deveria ser quebrada em helpers (`validarEBuscarCaixas`, `executarTransferenciaAtomica`); (2) `app/lib/caixas.server.ts` tem **332 linhas** (>300 limite) — pré-existente de S06, mas `listarCaixasParaTransferencia` adiciona mais código ao arquivo sem modularizar; (3) `await import("./rbac.server")` dinâmico em caixas.server.ts:323 (módulo já importável estaticamente — wasteful); (4) dead import `assertSaldoSuficiente` em transferencias.server.ts:30 (nunca chamada — decisão técnica é re-check inline); (5) magic number `take: 100` em listarCaixasParaTransferencia. |
| Defesa 3 camadas | 10/10 | Padrão **exemplar e consistente** com S06. **Camada 1 (UI):** `<Can allow={["ADMIN","PASTOR","FINANCEIRO"]} fallback={...}>` em `financeiro.transferencia-nova.tsx:214` com mensagem amigável para SECRETARIO (não 403). **Camada 2 (Loader):** `assertCanTransferir(user)` na linha 62 (PRIMEIRO após context). **Camada 2 (Action):** chama `transferirEntreCaixas` que internamente valida (Camada 3 redundante — defense in depth). **Camada 3 (Service):** `assertCanTransferir(user)` na linha 106 (PRIMEIRA statement). Lista de perfis alinhada em todas as 3 camadas (3 perfis: ADMIN, PASTOR, FINANCEIRO). SECRETARIO bloqueado consistentemente. Nenhum buraco. |
| LGPD by design | 7/10 | Soft-delete via `Caixa.ativo` (RN-FIN-01) ✓. Zod `.strict()` em `TransferenciaCreateSchema` bloqueia campos extras (gate LGPD) ✓. `safeLog` com allowlist sem PII em transferencias.server.ts:228-233 (apenas `action/resource/userId/result`, sem `valorCentavos/descricao/membroId`) ✓. Centavos (Int) — nunca Float ✓. **Débitos:** modelo `TransferenciaCaixa` (prisma/schema.prisma:181-194) com `executadoPorId` (carimbo do operador — RN-FIN-02 imutabilidade) **NÃO é criado** pela implementação atual. O design usou `transferenciaGrupoId` em Lancamento como substituto, mas perde a auditoria imutável canonica (1 registro TransferenciaCaixa = prova legal de quem/quando/quanto). Isso quebra o acceptance criteria S07-T02 §1️⃣ ("tx.transferenciaCaixa.create") — finding HIGH. |
| TypeScript | 9/10 | Sem `as any`/`@ts-ignore`/`@ts-expect-error` em qualquer arquivo novo de S07 ✓ (verificado em 7 arquivos). Tipos explícitos em ~95% das ocorrências. `TransferenciaResult` é type discriminado limpo. **Débitos:** (1) `tipo: saida.tipo as "SAIDA"` e similar em transferencias.server.ts:240,250 — casts de Prisma enum para literal type, legítimos mas elimináveis com `satisfies` ou tipo mais estreito no Prisma client; (2) `ref={setOrigemRef as never}` em 3 lugares do FormTransferencia — workaround para React ref typing com HTMLSelectElement/HTMLInputElement union (não tem `unknown`/`any`, mas `never` é igualmente um cast). |

**Cálculo:** TDD(6)×20 + Doc(9)×20 + Simple(6)×15 + RBAC(10)×20 + LGPD(7)×15 + TS(9)×10
= 12 + 18 + 9 + 20 + 10.5 + 9 = **78.5 → 78/100**

---

## 2. Findings (severidade + file:line + descrição + recomendação)

### 🔴 HIGH

- [high] `app/lib/transferencias.server.ts:151-225` — Implementação da `$transaction` faz **4 mutações** (2 Lancamento + 2 Caixa.update), mas o acceptance criteria S07-T02 §1️⃣-5️⃣ (sprints/S07.json:134-138) exige **5 mutações** incluindo `tx.transferenciaCaixa.create(...)`. O modelo `TransferenciaCaixa` (schema.prisma:181-194) tem `executadoPorId` (carimbo do operador, RN-FIN-02 imutabilidade) que é o pilar da auditoria legal. **Impacto:** perde-se prova imutável de quem/quando/quanto transferiu — apenas 2 lançamentos espelhados ficam, sem registro único da operação. **Recomendação:** adicionar `tx.transferenciaCaixa.create({ data: { caixaOrigemId, caixaDestinoId, valorCentavos, executadoPorId: user.id, dataHora } })` como 1ª mutação dentro do `$transaction`. Atualizar `TransferenciaResult` para incluir `transferenciaCaixaId`. Atualizar testes para verificar que o registro existe.

### 🟡 Medium

- [medium] `app/lib/transferencias.server.ts:101-258` — Função `transferirEntreCaixas` tem **158 linhas** (limite: 30). Viola diretriz KISS/YAGNI de função única. **Recomendação:** quebrar em helpers — `validarInputEBuscarCaixas(input, user)` (RBAC + Zod + lookups + ativo check) e `executarTransferenciaAtomica(caixas, valor, user)` ($transaction + log + retorno). Cada helper ≤ 40 linhas.
- [medium] `vitest.config.ts:30-32` — `include: ["app/**/*.test.ts"]` exclui `*.test.tsx`. Confirmado por sprints/S07.json:461 ("frontendTests: 2 .test.tsx criados mas débito pré-existente MVP"). Resultado: `financeiro.transferencia-nova.test.tsx` **não roda**. **Recomendação:** adicionar `app/**/*.test.tsx` ao `include` (com `environment: "jsdom"` ou `@testing-library/react` setup para componentes, OU manter `environment: "node"` se for testar só loaders/actions — verificar se `react-router` server-side testing funciona nesse modo). Dívida pré-existente — não-bloqueante para S07, mas reduz a confiança nos testes de rota.
- [medium] `app/lib/transferencias.server.test.ts` — **Teste de atomicidade (BLOQUEADOR do TDD-T02)** NÃO está presente. Acceptance criteria sprints/S07.json:146: "mock que injeta erro na 2ª mutação → 0 TransferenciaCaixa, 0 Lancamento TRANSFERENCIA, saldos intactos". O test file não cobre esse cenário. **Recomendação:** adicionar `it("atomicidade: falha na 2ª mutação → 0 lancamentos, saldos intactos (rollback total)")` usando `vi.spyOn(tx.lancamento, 'create')` para falhar na 2ª chamada. Após o high finding acima for resolvido, validar que também 0 TransferenciaCaixa.
- [medium] `app/routes/app/financeiro.transferencia-nova.tsx:84-178` — Função `action` tem **94 linhas** com aninhamento de try/catch + 4 ramos if/else para tratamento de status (400 Zod, 409 saldo, outros). **Recomendação:** extrair `parseActionError(err): { fieldErrors?, formError?, status }` helper. Reduz para ~50 linhas com fluxo linear.
- [medium] `app/components/financeiro.transferencia.tsx:117-125` — 3× `ref={setOrigemRef as never}` (e variantes) — cast `as never` mascara tipagem incorreta. **Recomendação:** tipar refs explicitamente com `useRef<HTMLSelectElement | HTMLInputElement>(null)` e usar callback ref que respeita o tipo (não precisa de cast). Alternativa: `useImperativeHandle` ou separar refs por componente.

### 🔵 Low

- [low] `app/lib/transferencias.server.ts:30` — `import { assertSaldoSuficiente } from "./finance.server";` é **dead import** (nunca chamada). Decisão técnica é re-check inline dentro do $transaction (correto, pois `assertSaldoSuficiente` usa `prisma` global, não `tx`). **Recomendação:** remover import ou adicionar comentário explicando por que NÃO usa a função canônica (`assertSaldoSuficiente` query fora do $transaction quebraria isolamento).
- [low] `app/lib/caixas.server.ts:301-332` — Função `listarCaixasParaTransferencia` (13 linhas) usa `await import("./rbac.server")` dinâmico (linha 323), apesar de o módulo ser importável estaticamente. **Recomendação:** adicionar `import { assertCanTransferir } from "./rbac.server";` ao topo do arquivo (junto com imports estáticos existentes) e remover o dynamic import. Padrão consistente com resto do codebase.
- [low] `app/lib/caixas.server.ts:330` — `take: 100` é magic number sem justificativa. **Recomendação:** extrair constante `MAX_CAIXAS_TRANSFERENCIA = 100` no topo do arquivo com JSDoc explicando o limite (escala igreja pequena).
- [low] `app/routes/app/financeiro.transferencia-nova.tsx:188` — Typo: "Camada 1 pode掩藏" — caractere chinês corrompido no JSDoc. **Recomendação:** substituir por "Camada 1 pode mostrar fallback" ou similar PT-BR puro.

### ℹ️ Info

- [info] `app/lib/transferencias.server.ts:1-25` — Cabeçalho de arquivo com 4 `@see RAG links` e resumo da estratégia atômica em pseudocódigo. Excelente para revisão. Manter padrão.
- [info] `app/lib/schemas/transferencias.ts:30-47` — `superRefine` com `path: ["origemId"]` + mensagem PT-BR é a forma canônica de validação cross-field no Zod v3. Bom modelo.
- [info] `app/components/financeiro.transferencia.tsx:110-114` — `useEffect` para focus em primeiro erro após submit — boa UX acessível (WCAG 2.4.3 + 3.3.1).
- [info] `app/lib/transferencias.server.ts:228-233` — `safeLog` com 4 campos da allowlist, sem PII. Mensagem "transferencia" + ID de grupo (UUID, não PII). Conforme RAG `lgpd-igreja-conect` §2.5.

---

## 3. Estatísticas

| Métrica | Valor |
|---------|-------|
| Arquivos de feature auditados | 7 (1 schema + 1 service + 1 RBAC + 1 caixas + 1 rota + 2 componentes + 1 migration) |
| Arquivos de teste existentes | 3 (`schemas/transferencias.test.ts` 141L + `transferencias.server.test.ts` 398L + `financeiro.transferencia-nova.test.tsx` 92L — este último **não executa**) |
| TDD ratio (feature:test files) | 7:3 ≈ **1:0.43** (schema 1:1 ✓; service 1:1 ✓; route 1:1 fraco; componentes 2:0) |
| Funções públicas com JSDoc | 14/14 services/componentes/rotas = **100%** |
| Tags `@param/@returns/@throws/@description` | 95+ |
| `as any` em código de feature novo S07 | 0 ✓ |
| `@ts-ignore`/`@ts-expect-error` em S07 | 0 ✓ |
| `as never` em componentes S07 | 3 (refs HTMLSelect/Input union) |
| `Promise<unknown>` em returns S07 | 0 ✓ (corrigido de S06) |
| Funções >30 linhas (apenas S07) | 2 (`transferirEntreCaixas` 158L, `action` 94L) |
| Aninhamento >3 níveis | 0 |
| Schemas Zod `.strict()` | 1/1 ✓ (gate LGPD) |
| `safeLog` em mutações | ✓ aplicado em `transferirEntreCaixas` (1×) |
| Helper `assertCan*` Camada 3 PRIMEIRO | ✓ em `transferirEntreCaixas`, `listarCaixasParaTransferencia` |
| Camadas RBAC (UI/Loader/Action/Service) | 4/4 ✓ |
| `transferenciaGrupoId` index | ✓ criado em migration (lancamentos_transferenciaGrupoId_idx) |
| Teste de atomicidade (BLOQUEADOR) | ❌ **AUSENTE** |
| E2E (`e2e/financeiro-transferencia.spec.ts`) | ❌ **AUSENTE** (T05 pending) |

---

## 4. RAG Candidates

- **antipattern** `antipattern-dead-import-assertsaldo` — `app/lib/transferencias.server.ts:30` importa `assertSaldoSuficiente` mas nunca chama. Documentar quando é correto re-checar inline vs delegar (decisão: dentro de $transaction, query no `prisma` global quebraria isolation; mas o import devia ser removido + JSDoc explicando).
- **antipattern** `antipattern-divergent-from-acceptance-criteria` — S07-T02 marcado `completed` mas diverge do acceptance criteria (5 mutações no spec, 4 implementadas). Adicionar checklist automatizado no pre-commit que valida critérios de task contra diff real.
- **pattern** `pattern-3-layer-rbac-transferencia` — Caso exemplar S07 com 3 perfis (ADMIN/PASTOR/FINANCEIRO) consistente em todas as 4 camadas (UI/Loader/Action/Service). Adicionar a `pattern-3-layer-rbac.md` como referência para escopo "transações".
- **pattern** `pattern-foco-acessibilidade-form` — `FormTransferencia.tsx` implementa WCAG 2.4.3 (foco em erro) + 3.3.1 (identificação) com `aria-invalid`, `aria-describedby`, `role="alert"`. Adicionar a `pattern-form-validation-ux.md`.
- **lesson** `lesson-vitest-config-tsx-exclude` — `vitest.config.ts` em S07 (e sprints anteriores) exclui `.test.tsx`. Resultado: 2 testes de rota (.tsx) declarados mas não executados. Dívida pré-existente. **Ação:** criar issue para adicionar `app/**/*.test.tsx` ao include com setup apropriado.
- **lesson** `lesson-atomicidade-test-pattern` — Atomicidade (S07-T02 acceptance #146) deveria ter teste dedicado com `vi.spyOn` em `tx.lancamento.create`. Não implementado. Adicionar a `lesson-test-anti-rollback.md`.
- **decision** `decision-transferencia-grupoId-vs-transferenciaCaixa` — Decisão de design: usar `transferenciaGrupoId` em Lancamento ao invés de criar registro `TransferenciaCaixa`. Prós: 1 modelo a manter. Contras: perde carimbo do operador imutável (`executadoPorId`). **Recomendação:** revisar — provavel que ambos sejam necessários (Lancamento para extrato + TransferenciaCaixa para auditoria legal RN-FIN-02).

---

## 5. Verdict

**PASSED ✅ — score 78/100 ≥ 70.**

**Justificativa:**
- **3 pilares da v6.2.0 (TDD, Documentação, Simplicidade):** Documentação é exemplar (9/10). TDD tem débitos mas service + schema são robustos (6/10). Simplicidade comprometida pelo tamanho excessivo de `transferirEntreCaixas` (158 linhas — 5× acima do limite) (6/10).
- **Defesa em 3 camadas RBAC** é o ponto mais forte da sprint (10/10): UI/Loader/Action/Service todos com `assertCanTransferir` consistente e 3 perfis idênticos.
- **LGPD by design** sólido (7/10) — Zod strict, safeLog, centavos, soft-delete. **MAS** perde 1 ponto pelo achado HIGH de `TransferenciaCaixa` não-criado, que quebra a cadeia de auditoria imutável (RN-FIN-02).
- **TypeScript** sem suppressões (9/10). Padrão limpo, sem `as any`/`@ts-ignore` em arquivos novos de S07.

**1 achado HIGH exige rework pré-próxima sprint:**
- **HIGH-1:** Reintroduzir `tx.transferenciaCaixa.create(...)` na $transaction para preservar o carimbo do operador (RN-FIN-02). Atualmente a implementação usa apenas `transferenciaGrupoId` em Lancamento — divergência silenciosa do acceptance criteria.

**Débitos medium/low (não-bloqueantes, melhorar em S08+):**
- Quebrar `transferirEntreCaixas` em helpers de ≤40 linhas (MD-1).
- Adicionar `*.test.tsx` ao vitest.config include (MD-2 — dívida pré-existente).
- Implementar teste de atomicidade com mock que falha na 2ª mutação (MD-3 — BLOQUEADOR declarado no acceptance mas não escrito).
- Extrair `parseActionError` helper em action (MD-4).
- Tipar refs explicitamente no FormTransferencia (MD-5).
- Remover dead import `assertSaldoSuficiente` (LW-1).
- Trocar dynamic import por static em caixas.server.ts (LW-2).
- Mover magic number `take: 100` para constante nomeada (LW-3).
- Corrigir typo "掩藏" no JSDoc da rota (LW-4).

**Dívidas de processo (transbordam para QA/T07):**
- E2E test (`e2e/financeiro-transferencia.spec.ts`) NÃO escrito — sprint JSON marca T05 como `pending`. Sem prova E2E de atomicidade, RBAC Camada 2, UX de erro.
- Security audit (T07) ainda `in_progress` — necessário verificar especialmente o HIGH-1 (impacto na audit chain).

**Sem bloqueadores de score.** Sprint funcional com débitos documentados. Score sólido para um sprint atômico que entrega feature nova + RBAC fina + LGPD.
