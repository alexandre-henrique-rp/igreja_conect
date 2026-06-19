# Code Review S06 — Módulo Financeiro

> **Agente:** code-reviewer (Harness v6.3.0)
> **Sprint:** S06 (cycle 2 — Módulo Financeiro: Caixas + Lançamentos + Dashboard)
> **Data:** 2026-06-19T17:29:03Z
> **Threshold:** ≥ 70 para `pass`.

**Score:** 83/100
**Status:** PASSED

---

## 1. Avaliação por Critério

| Critério | Nota | Comentário |
|----------|------|------------|
| TDD | 7/10 | 4 arquivos de teste (caixas, lancamentos, finance, rbac, schemas/lancamentos) cobrem bordas do brief §7.3 (saldo=0+SAIDA, DIZIMO sem membro, OFERTA anônimo, TRANSFERENCIA bloqueada, caixa arquivado, RBAC SECRETARIO/DISCIPULADOR). Cobertura services: caixas 96%, finance 100%, rbac 100%, lancamentos 87%, schemas/lancamentos 100%. **Gap**: `app/lib/schemas/caixas.ts` SEM teste de schema; rotas `financeiro.*.tsx` SEM testes de rota unitários (apenas E2E em `e2e/financeiro-basico.spec.ts`); 4/5 componentes SEM teste (só `CardSaldoCaixa.test.tsx` existe). |
| Documentação | 10/10 | 89 tags `@param/@returns/@throws/@description` em 4 services; todas as 13 funções públicas dos services têm JSDoc completo (descrição + `@param` + `@returns` + `@throws` + `@example` quando útil). Cabeçalho de arquivo com `@see` RAG links em todos. Schemas, componentes e rotas também documentados. |
| Simplicidade | 7/10 | Código direto, sem strategy/factory para 1 caso (KISS respeitado). **Funções >30 linhas**: `criarLancamento` (96 linhas), `getDashboardFinanceiro` (86 linhas), `listarPorCaixa` (137 linhas), `listarCaixas` (47 linhas), `assertSaldoSuficiente` (39 linhas) — justificado por complexidade de domínio (atomic transaction com anti-TOCTOU + múltiplas queries agregadas). Complexidade ciclomática aceitável. |
| Defesa 3 camadas | 9/10 | Padrão exemplar: **Camada 1 (UI)** via `<Can>` component + condicionais; **Camada 2 (Loader/Action)** chama `assertCan*` em todas as 5 rotas; **Camada 3 (Service)** aplica `assertCanSeeFinancialModule/assertCanWriteLancamento/assertCanManageCaixa` como PRIMEIRA statement de cada função. Filtro fino SECRETARIO↔DIZIMO aplicado na service layer (Camada 3) — defense-in-depth correto. S06-REWORK endereçou SEC-001/002/005 (separação `assertCanSeeFinancials` vs `assertCanSeeFinancialModule`). **Minor**: `assertCanSeeFinancials` legada mantida (deprecated via JSDoc) — gerar dívida leve. |
| LGPD by design | 9/10 | Soft-delete via `Caixa.ativo` (RN-FIN-01); Zod `.strict()` em ambos schemas bloqueia campos não declarados; `safeLog` allowlist sem PII (sem `valorCentavos`, `descricao`, `membroId`); valores monetários em **centavos (Int)** — nunca Float; SECRETARIO excluído de DIZIMO em 2 services; P2002 → 409 sem vazar schema; resposta de erro 403/404/409 sem PII. Per `lgpd-parecer.md`: **gate passa** (0 critical, 0 high Art. 18/48); débitos médios em Art. 18 §II/V (export) são advisory para S09+. |
| TypeScript | 7/10 | Sem `@ts-ignore`/`@ts-expect-error` em todo `app/`; tipos explícitos em 90%+ das ocorrências. **Débitos**: 4× `Promise<unknown>` em returns (caixas.server.ts:128,176,219 + lancamentos.server.ts:73) — usar tipo Prisma explícito (`Promise<Caixa>`); 2× `where as any` em `lancamentos.server.ts:221,223` (where dinâmico `Record<string, unknown>`) — substituir por `Prisma.LancamentoWhereInput`. Casts em testes (`as any` em caixas.server.test.ts:198) são legítimos para testar `.strict()`. |

**Cálculo:** TDD(7)×20 + Doc(10)×20 + Simple(7)×15 + RBAC(9)×20 + LGPD(9)×15 + TS(7)×10
= 14 + 20 + 10.5 + 18 + 13.5 + 7 = **83/100**

---

## 2. Findings (severidade + file:line + descrição + recomendação)

### High
- _nenhum_

### Medium
- [medium] `app/lib/schemas/caixas.ts` — Schema `CaixaCreateSchema` SEM arquivo de teste correspondente (`caixas.test.ts`). Testes existentes cobrem via integração em `caixas.server.test.ts:182-206` (nome < 2 chars, strict), mas teste de schema isolado falta (paridade com `lancamentos.test.ts`). **Recomendação:** criar `app/lib/schemas/caixas.test.ts` espelhando `lancamentos.test.ts`.
- [medium] `app/lib/lancamentos.server.ts:221,223` — `where as any` em `prisma.lancamento.count/findMany` por causa de `Record<string, unknown>`. **Recomendação:** tipar `const where: Prisma.LancamentoWhereInput = { caixaId };` (sem `as any`).
- [medium] `app/lib/caixas.server.ts:128,176,219` e `lancamentos.server.ts:73` — `Promise<unknown>` em 4 returns de service. **Recomendação:** importar tipos Prisma (`Caixa`, `Lancamento`) e tipar retorno (`Promise<Caixa>`). Reduz ruído nos call-sites (eliminaria `as { id: string; ...}` em testes).
- [medium] `app/routes/app/financeiro.*.tsx` — 5 rotas SEM testes de loader/action unitários. Validação depende exclusivamente de `e2e/financeiro-basico.spec.ts` (Playwright). **Recomendação:** adicionar `app/routes/app/financeiro.caixas._index.test.tsx` espelhando o padrão usado em S02 (`membros._index.test.tsx`). Cobre 422 Zod, 409 P2002, 403 SECRETARIO em arquivar.

### Low
- [low] `app/components/{CardLancamento,CaixaHeader,AtalhoFinanceiro,CaixaSearchBar}.tsx` — 4/5 componentes sem `.test.tsx`. Apenas `CardSaldoCaixa.test.tsx` existe. **Recomendação:** priorizar `CardLancamento` (lógica de cor entrada/saída + filtro SECRETARIO) e `CaixaHeader` (warning arquivado).
- [low] `app/lib/rbac.server.ts:46` — `assertCanSeeFinancials` legada marcada `@deprecated` mas ainda exportada. Usada internamente por `finance.server.ts:64` (`getDizimosByMembro`). **Recomendação:** avaliar migração para `assertCanSeeDizimos` (semântica equivalente, mais clara). Não-bloqueante.

### Info
- [info] `app/lib/caixas.server.ts:62-103` — `listarCaixas` faz 2 queries (findMany + groupBy). Para volume alto, agregação única com `_count` no `select` Prisma seria mais performática. Não-bloqueante (escala igreja pequena).
- [info] `app/routes/app/financeiro._index.tsx:76-82` — Lógica RBAC inline duplicada (`["ADMIN","PASTOR","FINANCEIRO"].includes(user.cargo)`) em 3+ lugares. **Recomendação:** extrair para helper `podeGerenciarCaixa(user)` em `rbac-frontend.ts` (YAGNI: 3ª repetição chegou).
- [info] `app/lib/finance.server.ts:1-30` — Header de arquivo com 5 `@see` RAG links (excelente rastreabilidade). Manter padrão.
- [info] `app/lib/lancamentos.server.ts:96-153` — Transaction com anti-TOCTOU é a **referência canônica** do pattern `trava-saldo-service` (RAG). JSDoc explica o porquê (RN-FIN-04). Bom modelo para S07 transferências.

---

## 3. Estatísticas

| Métrica | Valor |
|---------|-------|
| Arquivos de feature auditados | 7 (4 services + 2 schemas + 5 rotas + 5 componentes) |
| Arquivos de teste existentes | 6 (4 services + 1 schema + 1 componente) |
| TDD ratio (feature:test files) | 17:6 ≈ **1:0.35** (services 4:4 — perfeito; rotas 5:0; componentes 5:1) |
| Funções públicas com JSDoc | 13/13 services + 5/5 componentes = **100%** |
| Tags `@param/@returns/@throws/@description` | 89 (38+15+16+20) |
| `as any` em código de feature | 2 (lancamentos.server.ts:221,223) |
| `@ts-ignore`/`@ts-expect-error` | 0 |
| `Promise<unknown>` em returns | 4 |
| Funções >30 linhas | 5 (`criarLancamento` 96, `listarPorCaixa` 137, `getDashboardFinanceiro` 86, `listarCaixas` 47, `assertSaldoSuficiente` 39) |
| Aninhamento >3 níveis | 0 |
| Cobertura services (lines) | caixas 96.36% / finance 100% / rbac 100% / lancamentos 87% |
| Schemas Zod `.strict()` | 2/2 ✅ (gate LGPD) |
| Soft-delete (`Caixa.ativo`) | ✅ implementado (T01) |
| `safeLog` allowlist | ✅ aplicado em todos mutations (criar/arquivar/reabrir/criarLancamento/dashboard) |
| Helper `assertCan*` Camada 3 | ✅ primeira statement de cada função pública de service |

---

## 4. RAG Candidates

- **pattern** `pattern-trava-saldo-service-impl-reference` — `criarLancamento` (lancamentos.server.ts:96-153) é implementação canônica do pattern documentado em `pattern-trava-saldo-service.md`. Adicionar referência `app/lib/lancamentos.server.ts:96-153` como exemplo real.
- **pattern** `pattern-3-layer-rbac-financeiro` — Já existe `pattern-3-layer-rbac.md`; adicionar caso de uso S06 (Caixa com SECRETARIO + filtro DIZIMO service-side).
- **antipattern** `antipattern-promise-unknown-returns` — 4 ocorrências de `Promise<unknown>` em services Prisma. Sugerir tipo explícito `Promise<Caixa>` / `Promise<Lancamento>`.
- **antipattern** `antipattern-where-as-any` — 2 ocorrências de `where as any` por where dinâmico. Documentar alternativa `Prisma.LancamentoWhereInput`.
- **decision** `decision-rbac-helper-deprecation` — Decidir destino de `assertCanSeeFinancials` legada (manter deprecated vs remover em S07).
- **lesson** `lesson-prisma-7-transaction-antitoctou` — `criarLancamento` (lancamentos.server.ts:96-153) demonstra re-leitura do caixa dentro da transação; capturar como lição consolidada para transferências S07.

---

## 5. Verdict

**PASSED ✅ — score 83/100 ≥ 70.**

**Justificativa:**
- Os 3 pilares da v6.2.0 (TDD, Documentação, Simplicidade) estão **aderentes** com débitos menores.
- **Defesa em 3 camadas RBAC** é o ponto mais forte: padrão consistente UI/Loader/Service em todas as 5 rotas + service-side fine-grained para SECRETARIO↔DIZIMO.
- **LGPD by design** tem soft-delete, Zod strict, safeLog, centavos; débitos Art. 18 §II/V (export) são **advisory** para S09+ (não-bloqueante).
- **TypeScript** sem `@ts-ignore`/`@ts-expect-error`; débitos `Promise<unknown>` e `where as any` são tipagem fraca, não suppression.
- **S06-REWORK** endereçou SEC-001/002/005 (RBAC SECRETARIO). Code está alinhado com `security-rbac-matrix.md` v2 e `lgpd-bases-legais-igreja.md`.

**Recomendações pré-S07 (transferências):**
1. Adicionar testes de schema `caixas.test.ts` (paridade com `lancamentos.test.ts`).
2. Tipar returns de services com `Caixa`/`Lancamento` Prisma types (elimina `Promise<unknown>`).
3. Adicionar testes de loader/action em rotas `financeiro.caixas._index.test.tsx` (paridade S02 membros).
4. Migrar `assertCanSeeFinancials` → `assertCanSeeDizimos` em `finance.server.ts:64` (sem idêntica).
5. Extrair `podeGerenciarCaixa(user)` helper para `rbac-frontend.ts` (3ª repetição chegou).

**Sem bloqueadores.** Score sólido para um módulo completo (Caixas + Lançamentos + Dashboard + 5 rotas + 5 componentes + 3 services + 2 schemas + migration).
