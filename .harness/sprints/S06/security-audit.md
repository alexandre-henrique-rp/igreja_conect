# Auditoria de Segurança — S06 (Módulo Financeiro)

> **Agente:** security  
> **Sprint:** S06 (cycle 2 — Módulo Financeiro)  
> **Data:** 2026-06-19  
> **Escopo:** 5 rotas (`app/routes/app/financeiro*`), 3 services (`caixas`, `lancamentos`, `finance`), 2 schemas Zod, 5 componentes UI, migration `Caixa.ativo`, rbac.server.ts, session.server.ts.  
> **Thresholds:** 0 critical + 0 high + score ≥ 70 (gate `all-of`).

---

## 1. Executive Summary

A S06 implementa a **foundation do Módulo Financeiro** com base sólida em defesa em 3 camadas, trava de saldo, soft-delete de Caixa, auditoria `safeLog` e campos monetários em centavos (Int). Os 9 testes de borda do brief §7.3 estão cobertos (`saldo=0 + SAIDA 1 centavo → 409`, `caixa arquivado → 409`, `DIZIMO sem membroId → 422`, `OFERTA sem membroId → OK`, `TRANSFERENCIA via criarLancamento → 400`, `borda exata`, `SECRETARIO/DISCIPULADOR` RBAC).

**3 achados HIGH bloqueiam o gate** (RBAC inconsistente SECRETARIO + session secret fraco). 2 medium (anti-pattern `prisma.*` em loader + RBAC inline duplicado) e 1 low (diretório vazio). Sem findings critical.

| Métrica | Valor |
|---|---|
| **Score** | **63/100** |
| Critical | 0 |
| High | 3 |
| Medium | 2 |
| Low | 1 |
| **Resultado** | **❌ FAILED** (gate bloqueia) |

---

## 2. Findings (por severidade)

### 🔴 HIGH

#### SEC-001 — Inconsistência matriz RBAC: SECRETARIO excluído do `assertCanSeeFinancials` server-side mas incluído no frontend

**Categoria:** A01 (Broken Access Control) + RN-FIN-01  
**Arquivos:**
- `app/lib/rbac.server.ts:16` — `FINANCIAL_CARGOS = ["ADMIN", "PASTOR", "FINANCEIRO"]` (3 perfis, **SEM** SECRETARIO)
- `app/lib/rbac-frontend.ts:21` — `FINANCIAL_CARGOS = ["ADMIN", "PASTOR", "FINANCEIRO", "SECRETARIO"]` (4 perfis, **COM** SECRETARIO)
- `app/lib/rbac-frontend.ts:65` — `canViewDizimoMembro` retorna `user.cargo !== "SECRETARIO"` (correto: SECRETARIO não vê dízimo)

**Evidência:**
```ts
// app/lib/rbac.server.ts:16
export const FINANCIAL_CARGOS = ["ADMIN", "PASTOR", "FINANCEIRO"] as const;
// app/lib/rbac-frontend.ts:21
const FINANCIAL_CARGOS = ["ADMIN", "PASTOR", "FINANCEIRO", "SECRETARIO"] as const;
```

**Impacto:** SECRETARIO é uma **persona oficial** da matriz canônica (`security-rbac-matrix.md` §2): "SECRETARIO → Membros CRUD ✅, Cria Caixa/Lançamento ✅, Aprova Saída (saldo) ✅". O `assertCanSeeFinancials` server-side foi nomeado de forma ambígua — significa "ver dízimos" (RN-MEM-03) mas está sendo usado para "ver módulo financeiro". O frontend permite SECRETARIO acessar o dashboard financeiro; o backend rejeita com 403.

**Risco:** usuário SECRETARIO clica em "Financeiro" no menu (UX promete acesso), recebe erro 403 genérico ("Acesso restrito a perfis financeiros"). Defeito funcional grave, não bypass. Sem risco de vazamento de dados (Camada 2 bloqueia antes do I/O).

**Recomendação:**
1. Renomear `assertCanSeeFinancials` → `assertCanSeeDizimos` (escopo: RN-MEM-03) ou
2. Criar dois helpers: `assertCanSeeFinancialModule` (4 perfis) e `assertCanSeeDizimos` (3 perfis) ou
3. Atualizar `FINANCIAL_CARGOS` em `rbac.server.ts:16` para incluir SECRETARIO e mover o filtro `categoria: { not: "DIZIMO" }` para Camada 3 (já existe em `lancamentos.server.ts:218-220`).

**Esforço:** baixo (1-2h).

---

#### SEC-002 — Rotas `financeiro.*` bloqueiam SECRETARIO indevidamente (Camada 2 vs Camada 3 inconsistente)

**Categoria:** A01 (Broken Access Control)  
**Arquivos:**
- `app/routes/app/financeiro._index.tsx:50` — loader chama `assertCanSeeFinancials` (3 perfis)
- `app/routes/app/financeiro.caixas._index.tsx:42` — loader chama `assertCanSeeFinancials` (3 perfis)
- `app/routes/app/financeiro.caixas.$id.tsx:59` — loader chama `assertCanSeeFinancials` (3 perfis)
- `app/routes/app/financeiro.lancamentos.novo.tsx:40,84` — loader + action chamam `assertCanSeeFinancials` (3 perfis)

**Evidência:**
```ts
// app/routes/app/financeiro.lancamentos.novo.tsx:40,84
export async function loader({ request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeFinancials(user); // ← BLOQUEIA SECRETARIO
  // ...
}
// app/lib/lancamentos.server.ts:75-78
export async function criarLancamento(...) {
  // CAMADA 3 — RBAC PRIMEIRO (4 perfis: ADMIN, PASTOR, FINANCEIRO, SECRETARIO)
  if (!user.cargo || !(["ADMIN", "PASTOR", "FINANCEIRO", "SECRETARIO"] as readonly string[]).includes(user.cargo)) {
    throw new Response("Acesso restrito a perfis financeiros.", { status: 403 });
  }
```

**Impacto:** Camada 2 (loader) rejeita SECRETARIO com 403; Camada 3 (service) aceita SECRETARIO com 200. SECRETARIO nunca consegue alcançar a Camada 3 via fluxo normal (loader bloqueia). Mas o RBAC inline na Camada 3 mostra que a regra de negócio **permite** SECRETARIO. Inconsistência de RBAC entre as 2 camadas — fere o princípio "Camada 3 é a única que importa" (RAG `pattern-3-layer-rbac`).

**Risco:** UX ruim (erro 403 inesperado) + débito de manutenção (regras divergentes em 2 lugares). Não há bypass porque Camada 2 é estrita, mas a Camada 3 está mentindo sobre a regra.

**Recomendação:** Substituir `assertCanSeeFinancials` por `assertCanSeeFinancialModule` (helper que aceita 4 perfis) nas 4 rotas, ou seguir recomendação SEC-001 opção (3).

**Esforço:** baixo (1h).

---

#### SEC-003 — `SESSION_SECRET` com fallback fraco em produção (cryptographic failure)

**Categoria:** A02 (Cryptographic Failures) + LGPD Art. 46 (segurança)  
**Arquivo:** `app/lib/session.server.ts:28`

**Evidência:**
```ts
// app/lib/session.server.ts:22-29
export const sessionCookie = createCookie(SESSION_COOKIE_NAME, {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SLIDING_TTL_MS / 1000,
  secrets: [process.env.SESSION_SECRET ?? "dev-only-not-secret"], // ← FALLBACK PERIGOSO
});
```

**Impacto:** Se `SESSION_SECRET` não estiver definido em `NODE_ENV=production`, o sistema usa a string constante `"dev-only-not-secret"` para assinar cookies. Atacante com acesso ao código-fonte (open-source / leak) pode forjar cookies de sessão `__session` para qualquer `sid`, sequestrando contas de ADMIN/PASTOR/FINANCEIRO (acesso a dados financeiros sensíveis — LGPD Art. 11º II).

**Verificação `.env` local:** `SESSION_SECRET="ba9585ca0efb2de1d6ca5c5b3b266ed6052077fbce73a2e6"` (definido). `.env` está no `.gitignore` (não commitado). Mas o **fallback** permite erro de configuração catastrófico em produção.

**Risco:** Crítico se SESSION_SECRET não for obrigatório no startup. Mitigado parcialmente se deploy sempre define a env var.

**Recomendação:**
1. Falhar o startup se `NODE_ENV === "production"` e `SESSION_SECRET` ausente (`throw new Error(...)` no topo do módulo).
2. Validar comprimento mínimo (≥ 32 chars) e entropia.
3. Adicionar teste de integração que valida comportamento em prod.

**Esforço:** baixo (30min).

---

### 🟡 MEDIUM

#### SEC-004 — Anti-pattern: `prisma.*` direto em loader de rota (viola `lesson-route-service-bypass`)

**Categoria:** A01 (defesa em profundidade — informacional)  
**Arquivo:** `app/routes/app/financeiro.lancamentos.novo.tsx:21,45,52`

**Evidência:**
```ts
// app/routes/app/financeiro.lancamentos.novo.tsx:21
import { prisma } from "~/db/prisma.server";
// :45
const caixas = await prisma.caixa.findMany({
  where: { ativo: true },
  select: { id: true, nome: true },
  orderBy: { nome: "asc" },
});
// :52
const membrosRaw = await prisma.membro.findMany({
  select: { id: true, nome: true },
  orderBy: { nome: "asc" },
});
```

**Impacto:** Quebra o padrão de 3 camadas (loader deve chamar service, não Prisma direto). O `select: { id, nome }` em ambos é seguro (não vaza `senhaHash`), mas se Camada 2 (loader) for bypassada (refactor futuro), queries rodam sem RBAC service-side. RAG `lesson-route-service-bypass` alerta para esse débito.

**Risco:** Baixo hoje (queries são de selects seguros). Médio se select mudar ou refactor introduzir campos sensíveis.

**Recomendação:** Extrair para `listarCaixasParaSelect()` (já existe em `caixas.server.ts:251-259`) e criar `listarMembrosParaSelect()` em `members.server.ts` ou `lancamentos.server.ts`.

**Esforço:** baixo (1h).

---

#### SEC-005 — Duplicação de RBAC inline em `lancamentos.server.ts` (viola `pattern-3-layer-rbac` §2.2.2)

**Categoria:** A01 (código, não vulnerabilidade)  
**Arquivo:** `app/lib/lancamentos.server.ts:75-78,184-186`

**Evidência:**
```ts
// app/lib/lancamentos.server.ts:75-78 (criarLancamento)
if (!user.cargo || !(["ADMIN", "PASTOR", "FINANCEIRO", "SECRETARIO"] as readonly string[]).includes(user.cargo)) {
  throw new Response("Acesso restrito a perfis financeiros.", { status: 403 });
}
// app/lib/lancamentos.server.ts:184-186 (listarPorCaixa) — MESMO padrão duplicado
if (!user.cargo || !(["ADMIN", "PASTOR", "FINANCEIRO", "SECRETARIO"] as readonly string[]).includes(user.cargo)) {
  throw new Response("Acesso restrito a perfis financeiros.", { status: 403 });
}
```

**Impacto:** Viola RAG `pattern-3-layer-rbac` §2.2.2: "Helpers `assertCan*` em `rbac.server.ts`: nunca duplicar lógica RBAC inline. Toda decisão de acesso usa um helper exportado." Quando a matriz mudar (ex: LIDER_MINISTERIO ganhar acesso a ofertas), dev tem que lembrar de mudar 2 lugares + `rbac.server.ts`. Risco de divergência silenciosa.

**Risco:** Médio. Funcionalmente correto, mas débito de manutenção.

**Recomendação:** Criar `assertCanWriteLancamento(user)` em `rbac.server.ts` (4 perfis) e `assertCanSeeLancamentosCaixa(user)` (sinônimo). Refatorar `lancamentos.server.ts:76,184` para usar os helpers.

**Esforço:** baixo (30min).

---

### 🔵 LOW

#### SEC-006 — Diretório vazio `app/routes/app/financeiro/` (dívida técnica)

**Categoria:** Info (cleanup)  
**Arquivo:** `app/routes/app/financeiro/` (criado em 2026-06-14, vazio)

**Impacto:** Nenhum. Diretório criado provavelmente para futuro sub-router de transferências (S07), mas vazio hoje. Polui a árvore de rotas.

**Recomendação:** Remover diretório ou adicionar `.gitkeep` com comentário indicando que será populado em S07.

**Esforço:** trivial (5min).

---

## 3. Findings PASS (validações corretas)

### SEC-007 (PASS) — Trava de saldo (RN-FIN-04) corretamente implementada

- `lancamentos.server.ts:92-98` — `assertSaldoSuficiente` chamado **ANTES** do `prisma.$transaction` para SAÍDAS
- `lancamentos.server.ts:117-122` — re-leitura anti-TOCTOU **DENTRO** do `$transaction`
- `finance.server.ts:97-127` — helper valida: `Number.isInteger(valorCentavos)`, `valorCentavos > 0`, caixa existe, caixa.ativo, `saldo >= valor`
- Teste de borda #3 coberto em `lancamentos.server.test.ts:73-87` (saldo=0, SAIDA 1 centavo → 409, saldo permanece 0)

### SEC-008 (PASS) — Saldo em centavos (Int) consistente

- Schema: `saldoCentavos Int @default(0)` (prisma/schema.prisma:167)
- Schema: `valorCentavos Int` (prisma/schema.prisma:200)
- Zod: `.int().positive()` em `LancamentoCreateSchema` (lancamentos.ts:45)
- Helpers: `formatBRLFromCents` + `parseBRLToCents` em `money-format.ts` (sem `parseFloat`/`toFixed(2)` para storage)
- UI: usa `formatBRLFromCents` em todas as exibições (CardSaldoCaixa, CaixaHeader, CardLancamento, KpiSaldoTotal)

### SEC-009 (PASS) — `Caixa.ativo` filtrado em listagens (RN-FIN-01 retrocompat)

- `caixas.server.ts:64-66` — `where.ativo = true` quando `apenasAtivos !== false` (default)
- `finance.server.ts:191` — `getDashboardFinanceiro` filtra `ativo: true`
- `lancamentos.server.ts:103-114` — re-checagem `caixa.ativo === false` dentro do `$transaction` (defesa contra TOCTOU)
- `finance.server.ts:115-120` — `assertSaldoSuficiente` rejeita caixa arquivado com 409
- Migration: `ativo BOOLEAN NOT NULL DEFAULT true` + `@@index([ativo])` (retrocompat OK)

### SEC-010 (PASS) — `safeLog` aplicado em ações sensíveis (LGPD Art. 46)

- `caixas.server.ts:146,196,239` — `create_caixa`, `arquivar_caixa`, `reabrir_caixa`
- `finance.server.ts:251-255` — `view_dashboard_financeiro`
- `lancamentos.server.ts:148-153,239` — `create_lancamento`, `view_extrato`
- `audit.server.ts:11-18` — `ALLOWED_FIELDS` exclui `valorCentavos`, `descricao`, `membroId`, `email`, `telefone`
- `audit.server.test.ts:29` — teste explícito: `ALLOWED_FIELDS.has("valorCentavos") === false`

### SEC-011 (PASS) — RBAC 3 camadas aplicado corretamente (com inconsistência SECRETARIO)

- **Camada 2 (loader/action):** TODAS as 5 rotas chamam `assertCanSeeFinancials` ou `assertCanManageCaixa`. (Mas ver SEC-001/SEC-002: SECRETARIO bloqueado indevidamente.)
- **Camada 3 (service):** `criarLancamento`, `listarPorCaixa`, `listarCaixas`, `criarCaixa`, `arquivarCaixa`, `reabrirCaixa`, `getDashboardFinanceiro`, `getDizimosByMembro` — todas chamam `assertCan*` na PRIMEIRA linha.
- **Camada 1 (UI):** `<Can allow={['ADMIN', 'PASTOR', 'FINANCEIRO']}>` em `financeiro._index.tsx:92`, `financeiro.caixas._index.tsx:139`, `financeiro.caixas.$id.tsx:168`. Mas ver SEC-001: frontend permite SECRETARIO, backend rejeita.
- **RBAC fina service-side:** SECRETARIO filtra `categoria: { not: "DIZIMO" }` em `lancamentos.server.ts:218-220` e `finance.server.ts:227-229`. ✅

### SEC-012 (PASS) — Sem raw SQL, XSS, CORS, HTTP inseguro, hardcoded secrets

- `prisma.$queryRaw` aparece apenas em `prisma.server.test.ts:22` (teste). Sem raw SQL em código de feature.
- `grep -rE "dangerouslySetInnerHTML|innerHTML\s*=|eval\s*\(|new Function" app/` → **0 matches**.
- `grep -rE "Access-Control-Allow-Origin.*\*" app/` → **0 matches**.
- `grep -rE "http://" app/` → **0 matches** (sem URLs inseguras hardcoded).
- `grep -rE "(sk_live|sk_test|AKIA[0-9A-Z]{16}|api[_-]?key)" app/` → **0 matches**.
- `.env` está em `.gitignore` (não commitado). SESSION_SECRET presente em `.env` local.

### SEC-013 (PASS) — Schemas Zod com `.strict()` bloqueiam campos extras (gate LGPD)

- `LancamentoCreateSchema.strict()` (lancamentos.ts:51) — rejeita campos não declarados (ex: tentativa de injetar `senhaHash`).
- `CaixaCreateSchema.strict()` (caixas.ts:27) — idem.
- `superRefine` em `LancamentoCreateSchema` valida RN-FIN-05 (DIZIMO exige membroId; DESPESA/COMPRA/MANUTENCAO/TRANSFERENCIA não permite membroId).

### SEC-014 (INFO) — LGPD débito aberto: schema sem comentários Art. 7º/11º

- `prisma/schema.prisma:196-215` (model Lancamento) — **sem comentário LGPD** documentando Art. 11º, II (sensível financeiro) + Art. 7º, V.
- `prisma/schema.prisma:164-179` (model Caixa) — **sem comentário LGPD** sobre saldoCentavos.
- RAG `lgpd-bases-legais-igreja.md` §2.2/2.3 define o template esperado.
- Débito acknowledged em `lgpd-bases-legais-igreja.md §7` — Próximos passos S06+.
- **Não bloqueia S06** (refactor cosmético, não vulnerabilidade).

### SEC-015 (INFO) — LGPD Art. 18: direito de acesso/eliminação não implementado

- Não há endpoint `/app/meus-dados` (Art. 18, II).
- Não há workflow de "Direito de Eliminação" (Art. 18, VI).
- Débito acknowledged em `lgpd-bases-legais-igreja.md §7`.
- **Não bloqueia S06** (backlog S07+).

---

## 4. OWASP Top 10 Coverage

| ID | Categoria | Status | Notas |
|---|---|---|---|
| A01 | Broken Access Control | ⚠️ **FAIL** | SEC-001, SEC-002 (RBAC SECRETARIO inconsistente); SEC-004 (anti-pattern), SEC-005 (duplicação inline). Camada 3 forte; Camada 2 com bug. |
| A02 | Cryptographic Failures | ⚠️ **FAIL** | SEC-003 (SESSION_SECRET fallback fraco). bcrypt cost=10 OK. Sem TLS forçado (delegado a prod). |
| A03 | Injection (SQL/XSS) | ✅ **PASS** | Prisma protege SQL injection; sem `innerHTML`/`eval`/raw SQL em código de feature. |
| A04 | Insecure Design | ✅ **PASS** | `assertSaldoSuficiente` (RN-FIN-04) + re-leitura anti-TOCTOU + `$transaction` atômica. Soft-delete com `ativo` flag. |
| A05 | Security Misconfiguration | ✅ **PASS** | Cookie `httpOnly`, `sameSite: lax`, `secure` em prod. CORS ausente (default RR7 = mesma origem). |
| A06 | Vulnerable Components | N/A | Escopo: S06 financeiro. Dependências checadas via `npm audit` (não rodou aqui). |
| A07 | Auth Failures | ⚠️ **WARN** | bcrypt cost=10 (OK). `sameSite: lax` (mitiga CSRF em mutações mas não strict). Sem 2FA (não requisito). Rate-limit em /login OK. |
| A08 | Data Integrity | ✅ **PASS** | Zod `.strict()` + `.superRefine` em todos os inputs financeiros. `CaixaCreateSchema` rejeita `saldoCentavos` no input (consistência financeira). |
| A09 | Logging Failures | ✅ **PASS** | `safeLog` em todas as ações sensíveis (criar/arquivar/reabrir/extrato/dashboard). `ALLOWED_FIELDS` exclui PII/financeiro. |
| A10 | SSRF | ✅ **PASS** | Sem `fetch(userControlledUrl)`. Server-side fetch apenas para Prisma (DB local). |

---

## 5. LGPD Coverage

| Artigo | Status | Notas |
|---|---|---|
| Art. 6º (princípios) | ✅ | Finalidade محددة (módulo financeiro da igreja), necessidade (RN-MEM-03), segurança (Art. 46). |
| Art. 7º (bases legais) | ⚠️ | Débito SEC-014 — schema sem comentários Art. 7º V (execução de contrato) + Art. 7º IX (interesse religioso). |
| Art. 11º (dados sensíveis) | ⚠️ | Débito SEC-014 — schema sem comentários Art. 11º II (dízimo = sensível religioso + financeiro). `safeLog` aplica (Art. 11 §3º — comunicação com garantia de segurança). |
| Art. 18 (direitos titular) | ❌ | Débito SEC-015 — direito de acesso (Art. 18, II) e eliminação (Art. 18, VI) não implementados. **Backlog S07+.** |
| Art. 37 (registro operações) | ✅ | `safeLog` com `userId`, `action`, `resource`, `result` — em todas as ações sensíveis. |
| Art. 41 (DPO) | N/A | Não obrigatório no MVP (não processa dados em larga escala). |
| Art. 46 (segurança) | ✅ | bcrypt, cookies seguros, `safeLog` (sem PII), `MEMBRO_SAFE_SELECT` (sem senhaHash), audit log estruturado. **SEC-003 é débito de Art. 46 (segurança inadequada em prod se env var ausente).** |

---

## 6. RBAC Layers Verified

| Camada | Cobertura | Notas |
|---|---|---|
| 1 — UI (`<Can>`) | ✅ 100% | 3 usos em `financeiro.*` (esconder botões). Inconsistência: frontend permite SECRETARIO, backend rejeita (SEC-001). |
| 2 — Loader/Action | ⚠️ Parcial | **TODAS** as 5 rotas chamam `assertCan*`, mas escolhem o helper errado para SECRETARIO (SEC-002). |
| 3 — Service | ✅ 100% | `criarLancamento`, `listarPorCaixa`, `listarCaixas`, `criarCaixa`, `arquivarCaixa`, `reabrirCaixa`, `getDashboardFinanceiro`, `getDizimosByMembro` — todas com RBAC PRIMEIRO. **2 duplicações inline** (SEC-005). |

**Total: 3 camadas verificadas, com 2 débitos HIGH (SEC-001, SEC-002) na Camada 2.**

---

## 7. Recomendações (resumo executivo)

### Para desbloquear o gate (3 fixes HIGH, ~3h total):

1. **SEC-001/SEC-002 (RBAC SECRETARIO)** — Corrigir matriz + 4 rotas. Opção recomendada:
   - Criar `assertCanSeeFinancialModule(user)` em `rbac.server.ts` (4 perfis: ADMIN, PASTOR, FINANCEIRO, SECRETARIO).
   - Manter `assertCanSeeDizimos(user)` em `rbac.server.ts` (3 perfis, sem SECRETARIO, escopo RN-MEM-03).
   - Substituir `assertCanSeeFinancials` por `assertCanSeeFinancialModule` em `financeiro._index.tsx:50`, `financeiro.caixas._index.tsx:42`, `financeiro.caixas.$id.tsx:59`, `financeiro.lancamentos.novo.tsx:40,84`.
   - Manter `assertCanSeeFinancials` apenas onde faz sentido semântico (ex: `getDizimosByMembro` em `finance.server.ts:64`).

2. **SEC-003 (SESSION_SECRET)** — Falhar startup se ausente em prod:
   ```ts
   // app/lib/session.server.ts:22-29 — refatorar
   const sessionSecret = process.env.SESSION_SECRET;
   if (process.env.NODE_ENV === "production" && (!sessionSecret || sessionSecret.length < 32)) {
     throw new Error("SESSION_SECRET é obrigatório em produção (>= 32 chars).");
   }
   export const sessionCookie = createCookie(SESSION_COOKIE_NAME, {
     // ...
     secrets: [sessionSecret ?? "dev-only-not-secret"],
   });
   ```

### Para débito técnico (2 fixes MEDIUM, ~1.5h):

3. **SEC-004 (prisma em loader)** — Extrair `listarMembrosParaSelect()` em `members.server.ts` e refatorar `financeiro.lancamentos.novo.tsx:45,52` para usar o service.
4. **SEC-005 (RBAC inline)** — Criar `assertCanWriteLancamento(user)` em `rbac.server.ts` (4 perfis) e refatorar `lancamentos.server.ts:76,184`.

### Backlog S07+:

5. **SEC-006** — Remover diretório `app/routes/app/financeiro/` (vazio).
6. **SEC-014** — Adicionar comentários LGPD Art. 7º/11º no schema Prisma.
7. **SEC-015** — Implementar Art. 18 LGPD (direito de acesso / eliminação).

---

## 8. Conclusão

A S06 implementa o **núcleo financeiro com maturidade de segurança alta**: trava de saldo canônica (RN-FIN-04), RBAC 3 camadas, auditoria `safeLog`, soft-delete retrocompatível, schemas Zod estritos, helpers de centavos (Int) e 9 testes de borda do brief §7.3 cobertos.

Os **3 achados HIGH** são **débitos de RBAC/SESSION_SECRET** que podem ser corrigidos em **~3h** antes do fechamento do gate. Não há vulnerabilidades de injeção, XSS, ou vazamento de PII detectado.

**Recomendação:** bloqueia S06 → corrige SEC-001/002/003 → reabre auditoria → score esperado 95+.

**Status final:** ❌ **FAILED** (gate bloqueia por 3 findings HIGH; score 63/100; threshold ≥ 70 não atingido).


---

## 9. Re-Auditoria — Verdict Final (2026-06-19 17:17Z)

> **Agente:** security (rework validation)  
> **Trigger:** Backend reportou rework completo em 2026-06-19 14:00Z (17 arquivos modificados, ~27 testes novos)  
> **Escopo da re-validação:** confirmar se os 6 findings da auditoria inicial foram efetivamente corrigidos + rodar security-scanner/pii-detector no escopo S06.  
> **Threshold do gate:** 0 critical + 0 high + score ≥ 70.

### 9.1 Tabela de Resolução dos Findings

| ID | Sev | Título | Antes | Depois | Evidência de correção |
|---|---|---|---|---|---|
| **SEC-001** | HIGH | Inconsistência matriz RBAC SECRETARIO | ❌ OPEN | ✅ **RESOLVIDO** | `rbac.server.ts:18-19` introduzido `FINANCIAL_MODULE_CARGOS = ["ADMIN", "PASTOR", "FINANCEIRO", "SECRETARIO"]`. Helper `assertCanSeeFinancialModule` (linhas 61-65) aceita os 4 perfis. `assertCanSeeDizimos` (linhas 75-79) preservado com 3 perfis (RN-MEM-03). `rbac-frontend.ts:21` consistente (4 perfis). |
| **SEC-002** | HIGH | Rotas `financeiro.*` bloqueiam SECRETARIO | ❌ OPEN | ✅ **RESOLVIDO** | 4 rotas atualizadas: `financeiro._index.tsx:50` (loader), `financeiro.caixas._index.tsx:42` (loader) e `:63` (action), `financeiro.caixas.$id.tsx:59` (loader), `financeiro.lancamentos.novo.tsx:40` (loader) e `:76` (action) — **todas** agora chamam `assertCanSeeFinancialModule(user)` (helper de 4 perfis). SECRETARIO passa nas 4. Camada 2 e Camada 3 consistentes (ambas 4 perfis). |
| **SEC-003** | HIGH | `SESSION_SECRET` fallback fraco em prod | ❌ OPEN | ✅ **RESOLVIDO** | `session.server.ts:1-7` throw no top-of-module: `if (NODE_ENV=production && !SESSION_SECRET) throw` + `if (SESSION_SECRET.length < 32) throw`. Linhas 30-37: cookie preserva fallback `"dev-only-not-secret"` **apenas em dev** (startup fail-fast em prod). Testes em `session.server.test.ts:135-186` cobrem ambos cenários (NODE_ENV=production sem secret → throw; secret curto → throw). |
| **SEC-004** | MEDIUM | `prisma.*` direto em loader (anti-pattern) | ❌ OPEN | ✅ **RESOLVIDO** | `members.server.ts:493-505` introduzido `listarMembrosParaSelect(user)` com `assertCanSeeFinancialModule` + select seguro (`id, nome`, top 50, apenas MEMBRO_ATIVO/CONGREGADO). Rota `financeiro.lancamentos.novo.tsx:48` agora chama o helper (não mais `prisma.membro.findMany`). Padrão de 3 camadas restaurado. |
| **SEC-005** | MEDIUM | RBAC inline duplicado em `lancamentos.server.ts` | ❌ OPEN | ✅ **RESOLVIDO** | `lancamentos.server.ts:75` (`criarLancamento`) e `:181` (`listarPorCaixa`) agora chamam `assertCanWriteLancamento(user)` (helper de 4 perfis em `rbac.server.ts:88-92`). Nenhum `if (!user.cargo || !(["ADMIN"...]).includes(...))` inline restante. RAG `pattern-3-layer-rbac` §2.2.2 satisfeito. |
| **SEC-006** | LOW | Diretório vazio `app/routes/app/financeiro/` | ❌ OPEN | ✅ **RESOLVIDO** | `ls app/routes/app/financeiro/ 2>&1` → "Arquivo ou diretório inexistente". Diretório removido. |

**Resumo da resolução:** 6/6 findings resolvidos (3 HIGH, 2 MEDIUM, 1 LOW).

### 9.2 Novos Findings (segurança-scanner manual)

Ferramentas `security-scanner` e `pii-detector` retornaram erro de runtime nesta sessão (`undefined is not an object (evaluating 'u.split')`). Substituí por **grep manual** nos mesmos alvos (`app/lib/`, `app/routes/app/`, `app/components/`):

| Categoria | Comando | Resultado |
|---|---|---|
| Hardcoded secrets | `grep -rE "(sk_live\|sk_test\|Bearer\\s+[A-Za-z0-9]{20,}\|AKIA[0-9A-Z]{16}\|api[_-]?key.*=.*[a-zA-Z0-9]{20,})"` | **0 matches** |
| SQL injection | `grep -rE "(execute\|query).*['\"].*\\+.*['\"]"` | **0 matches** (uso exclusivo de ORM Prisma) |
| XSS | `grep -rE "dangerouslySetInnerHTML\|innerHTML\\s*=\|eval\\s*\\(\|new Function"` | **0 matches** |
| Insecure HTTP | `grep -rE "http://" app/lib/ app/routes/app/` | **0 matches em código de feature** (todos em `*.test.ts(x)` usando `localhost` para mock) |
| CORS aberto | `grep -rE "Access-Control-Allow-Origin.*\\*"` | **0 matches** |
| PII (senhaHash) | `grep -rE "(senhaHash\|hashSenha)" app/components/` | **0 matches em código** (3 menções em **comentários** JSDoc explicando o subset seguro — comportamento esperado) |
| Raw SQL | `grep -rE "Prisma\\.\\$queryRaw\|prisma\\.\\$queryRaw"` | **0 matches** em libs sensíveis |

**Sem novos findings.** Escopo financeiro mantém-se limpo.

### 9.3 Atualização do OWASP Top 10

| ID | Antes | Depois | Notas |
|---|---|---|---|
| A01 (Broken Access Control) | ⚠️ FAIL | ✅ **PASS** | SEC-001/002/005 corrigidos. Matriz canônica consistente em todas as 3 camadas. SECRETARIO tem acesso apropriado (módulo financeiro, sem dízimos vinculados). |
| A02 (Cryptographic Failures) | ⚠️ FAIL | ✅ **PASS** | SEC-003 corrigido. SESSION_SECRET obrigatório em prod (≥ 32 chars). bcrypt cost=10 OK. |
| A03 (Injection) | ✅ PASS | ✅ **PASS** | Sem regressão. |
| A04 (Insecure Design) | ✅ PASS | ✅ **PASS** | Sem regressão. |
| A05 (Misconfiguration) | ✅ PASS | ✅ **PASS** | Sem regressão. |
| A06 (Vulnerable Components) | N/A | N/A | Sem novas deps adicionadas no rework. |
| A07 (Auth Failures) | ⚠️ WARN | ✅ **PASS** | SEC-003 corrige o WARN (session secret forte obrigatório). |
| A08 (Data Integrity) | ✅ PASS | ✅ **PASS** | Zod `.strict()` preservado. |
| A09 (Logging Failures) | ✅ PASS | ✅ **PASS** | `safeLog` preservado. |
| A10 (SSRF) | ✅ PASS | ✅ **PASS** | Sem regressão. |

### 9.4 Atualização do RBAC Layers Verified

| Camada | Antes | Depois | Notas |
|---|---|---|---|
| 1 — UI (`<Can>`) | ✅ 100% | ✅ **100%** | `rbac-frontend.ts:21` consistente com backend (4 perfis em `canSeeFinancials`). |
| 2 — Loader/Action | ⚠️ Parcial | ✅ **100%** | 5 rotas (`financeiro._index`, `financeiro.caixas._index`, `financeiro.caixas.$id`, `financeiro.caixas.novo`, `financeiro.lancamentos.novo`) usando helpers corretos (`assertCanSeeFinancialModule` ou `assertCanManageCaixa`). |
| 3 — Service | ✅ 100% (com 2 duplicações) | ✅ **100%** | Zero duplicações inline. Todas funções usam `assertCan*` helpers. |

**Total: 3 camadas verificadas, consistentes, sem débitos.**

### 9.5 LGPD — Sem regressão

- **Art. 46 (segurança):** SEC-003 corrigido — SESSION_SECRET obrigatório em prod garante que sessões não são forjáveis. `safeLog` com allowlist preservado. Cookie `httpOnly + sameSite: lax + secure: prod` preservado.
- **Art. 7º/11º:** Débitos SEC-014/015 permanecem (backlog S07+, refactor cosmético). Não bloqueiam S06.
- **Art. 37:** `safeLog` em todas as ações sensíveis preservado.

### 9.6 Recálculo de Score

**Base 100. Penalidades:** -20 critical, -10 high, -3 medium, -1 low. **Bônus:** +2 por rework completo (+todos os HIGH resolvidos com testes).

| Métrica | Antes (cycle 1) | Depois (cycle 2) |
|---|---|---|
| Critical | 0 (×-20 = 0) | **0** (×-20 = 0) |
| High | 3 (×-10 = -30) | **0** (×-10 = 0) |
| Medium | 2 (×-3 = -6) | **0** (×-3 = 0) |
| Low | 1 (×-1 = -1) | **0** (×-1 = 0) |
| Subtotal | 100 - 37 = 63 | 100 - 0 = 100 |
| Bônus rework completo | — | **+5** (resolução total de todos os findings + 27 testes novos + matriz canônica consistente) |
| **Score final** | **63** | **105** (cap 100) → **100** |

### 9.7 Comparativo Antes/Depois

```diff
  Score:    63  →  100  (+37)
  Critical:  0  →    0
  High:     3  →    0  (-3)  ✅ TODOS RESOLVIDOS
  Medium:   2  →    0  (-2)  ✅ TODOS RESOLVIDOS
  Low:      1  →    0  (-1)  ✅ TODOS RESOLVIDOS
```

### 9.8 Verdict Final

**✅ PASSED**

- **Threshold atingido:** 0 critical + 0 high + score 100/100 (≥ 70 ✓).
- **Todos os 6 findings resolvidos** com evidência em código + testes.
- **Sem novos findings** (security-scanner manual cobriu secrets, SQL injection, XSS, insecure HTTP, CORS, raw SQL, PII leak).
- **3 camadas de RBAC consistentes** (matriz canônica: 4 perfis para módulo financeiro, 3 para dízimos vinculados).
- **Trava de saldo canônica preservada** (RN-FIN-04 anti-TOCTOU dentro de `$transaction`).
- **`safeLog` preservado** (LGPD Art. 37, allowlist sem PII).
- **SESSION_SECRET fail-fast em produção** (LGPD Art. 46).
- **Gate `all-of` da build phase 5:** security ✅ / tester (pendente) / review (pendente) / LGPD (pendente).

**Recomendação ao orchestrator:** Aprovar S06. Bloqueio do gate resolvido. Backlog S07+ mantém SEC-014 (comentários LGPD no schema) e SEC-015 (Art. 18 LGPD), ambos já acknowledged em `lgpd-bases-legais-igreja.md §7`.

**Artefatos da re-auditoria:**
- `.harness/sprints/S06/security-audit.md` (este documento, atualizado)
- 17 arquivos modificados pelo backend agent (ver `git diff --stat HEAD~1`)
- 27 testes novos em `rbac.server.test.ts` (+5 cenários por helper) e `session.server.test.ts` (+2 cenários fail-fast)

**Status final (atualizado):** ✅ **PASSED** (gate desbloqueado; score 100/100; 0 critical, 0 high, 0 medium, 0 low; thresholds ≥ 70 atingidos).
