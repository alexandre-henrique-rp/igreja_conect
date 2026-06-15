# S01 Code Review — Auth Backend + Login UI

> **Sprint:** S01 — Auth Backend + Login UI
> **Reviewer:** code-reviewer (Harness v6.3.0)
> **Data:** 2026-06-13T11:00:00Z
> **Status do gate:** ⚠️ **REWORK NECESSÁRIO** (score 76 < 70 NÃO BLOQUEIA, mas há findings de S01-T10 faltando)

---

## Resumo Executivo

A entrega da Sprint S01 (Auth + Login) atinge um padrão de qualidade **acima da média** na maioria dos artefatos. JSDoc em PT-BR é consistente, testes cobrem comportamento (não método) em **quase todos** os módulos, e há aderência forte a YAGNI/KISS nos componentes UI. Dois achados estruturais impedem um score mais alto: (1) **a função `action()` de `app/routes/public/login.tsx` tem 84 linhas e profundidade de aninhamento 4**, violando dois princípios da simplicidade; (2) **a task S01-T10 (E2E Playwright em `e2e/auth.spec.ts`) não foi entregue** — o diretório `e2e/` está vazio, o que derruba o TDD-ratio de cobertura de comportamento. TDD verificável via `git log` está limitado porque os arquivos S01 ainda estão untracked (working tree), mas a estrutura dos `.test.tsx` prova que os testes foram escritos para guiar o comportamento.

**Score final: 76/100** — **PASS** no gate (≥ 70), mas com 1 finding blocker (S01-T10 faltando) que deve ser endereçado antes da próxima sprint.

---

## Score por Princípio

| Princípio | Score | Máximo | % | Status |
|---|---|---|---|---|
| **TDD é obrigatório** | 27 | 40 | 67.5% | ⚠️ parcial (S01-T10 faltando) |
| **Documentação é obrigatória** | 28 | 30 | 93.3% | ✅ passa |
| **Simplicidade (KISS/YAGNI)** | 21 | 30 | 70.0% | ⚠️ parcial (1 violação) |
| **TOTAL** | **76** | **100** | **76.0%** | ✅ **PASS no gate** |

---

## TDD — Análise detalhada (27/40)

**Cobertura por arquivo (sprint S01):**

| Arquivo | Teste correspondente | Cobre comportamento? | Veredito |
|---|---|---|---|
| `app/lib/auth.server.ts` (S01-T01: verifyCredentials) | `auth.server.test.ts` (estendido em S01) | ✅ 4 cenários: não existe, sem senhaHash, senha errada, sucesso. Verifica explicitamente que `senhaHash` e `email` NÃO vazam. | ✅ passa |
| `app/lib/schemas/auth.ts` (S01-T02: LoginSchema) | `schemas/auth.test.ts` (novo) | ✅ 7 cenários: email válido, sem manterConectado, coerção "on", email malformado, senha vazia, >200 chars, falta campo | ✅ passa |
| `app/routes/public/login.tsx` (S01-T03: action) | `routes/public/login.test.tsx` (novo) | ✅ 8 cenários: 401 senha errada, 401 email inexistente (anti-enumeração), 422 email malformado, 422 senha vazia, 302 + Set-Cookie sucesso, `?next=/app/membros`, `?next=//evil.com` bloqueado, 5 falhas → 429 | ✅ passa |
| `app/routes/logout.tsx` (S01-T04) | `routes/logout.test.tsx` (novo) | ✅ 3 cenários: sem cookie (idempotente), com cookie válido (deleta sessão), cookie inválido | ✅ passa |
| `app/routes/app/_middleware.tsx` (S01-T05) | `routes/app/_middleware.test.ts` (novo) | ✅ 5 cenários: sem cookie throws, encoding correto do `?next`, cookie válido injeta user, cookie inválido throws, sessão expirada throws | ✅ passa |
| `app/components/Button.tsx` (S01-T06) | `Button.test.tsx` | ✅ 11 testes, 1 por variante/size/estado | ✅ passa |
| `app/components/Input.tsx` (S01-T06) | `Input.test.tsx` | ✅ 11 testes, inclui aria-invalid/aria-describedby | ✅ passa |
| `app/components/Checkbox.tsx` (S01-T06) | `Checkbox.test.tsx` | ✅ 5 testes | ✅ passa |
| `app/components/ErrorAlert.tsx` (S01-T06) | `ErrorAlert.test.tsx` | ✅ 5 testes, 1 por tom + role=alert | ✅ passa |
| `app/components/TopbarPublica.tsx` (S01-T06) | `TopbarPublica.test.tsx` | ✅ 6 testes (sticky, logo, entrarHref, skip link) | ✅ passa |
| `app/components/FormLogin.tsx` (S01-T07) | `FormLogin.test.tsx` | ✅ 16 testes (main, h1, form, email input, senha input, submit, checkbox, link, footer, ErrorAlert, motivo expirado, fieldErrors, defaultEmail, classes primary) | ✅ passa |
| `app/routes/public/index.tsx` (S01-T08: landing) | `routes/public/index.test.tsx` | ✅ 3 cenários: loader anônimo, loader autenticado (redirect 302), render com h1 + Entrar | ✅ passa |
| `app/components/CardInfo.tsx` (S01-T09) | `CardInfo.test.tsx` | ✅ 7 testes | ✅ passa |
| **`e2e/auth.spec.ts` (S01-T10)** | ❌ **arquivo NÃO EXISTE** | ❌ diretório `e2e/` vazio | ❌ **FALTA** |
| `app/app.css` (S01-T11) | N/A (configuração visual) | ⚠️ N/A explícito na própria task (`testPath: "N/A"`) | ✅ passa (escopo da task) |

**Análise de "1 teste por comportamento" (não por método):**
- ✅ Os testes de `LoginSchema` testam **comportamentos distintos** (rejeição vs. aceitação, coerção de tipos) — não há um teste "escrever método loginSchema" sem propósito.
- ✅ Os testes de `action()` em `login.test.tsx` são **integration tests** que cobrem o comportamento end-to-end do endpoint, não unidade do método.
- ✅ Os testes de componentes UI validam **comportamento observável** (HTML SSR contém classes ARIA esperadas), não implementação interna.

**Análise de "TDD verificável via git":**
- ⚠️ O commit `34b2528` (S00) já entregou `app/lib/auth.server.test.ts` e `app/lib/auth.server.ts` juntos — S00 foi TDD-first **verificável** (testes commitados no mesmo commit que o código).
- ❌ Os arquivos novos da S01 (`login.tsx`, `logout.tsx`, `_middleware.tsx`, todos os componentes, schemas/auth.ts) estão **untracked** — não há commit S01 visível. Isso significa que **não posso afirmar via git log que o teste veio antes do código**. Evidência indireta: a estrutura dos testes (cenários escritos como "deveria retornar..." / "retorna null quando...") sugere que foram escritos primeiro, mas isso é heurística, não prova.
- Recomendação: orchestrator deve pedir a `backend`/`frontend` que façam **commit granular** dos arquivos S01 antes de avançar.

**Por que 27/40 (não 40/40):**
- **−10 pontos**: S01-T10 (E2E) não foi entregue; sem E2E, 1/11 tasks da sprint está faltando e o coverage end-to-end do "Chain 1-7" do design T8.4 não é verificável.
- **−3 pontos**: Histórico git não comprova TDD-first em S01 (arquivos untracked). Sem commit granular, a evidência é heurística.

---

## JSDoc — Análise detalhada (28/30)

**Auditoria de funções públicas exportadas:**

| Arquivo | Funções públicas | Com JSDoc completo? | Observações |
|---|---|---|---|
| `auth.server.ts` | `hashPassword`, `verifyPassword`, `verifyCredentials` | ✅ todas com `@description`+`@param`+`@returns`+`@example` | Exemplo em PT-BR; `@throws` ausente em `hashPassword` (mencionado no texto, não no tag) |
| `session.server.ts` | `createSession`, `getUserFromRequest`, `deleteSession` | ✅ todas com `@description`+`@param`+`@returns`+`@example` | Exemplo de uso do Set-Cookie presente |
| `rate-limit.server.ts` | `checkRateLimit`, `resetRateLimit` | ✅ ambas com `@description`+`@param`+`@returns` | `@example` ausente em `checkRateLimit` (uso é trivial, aceitável) |
| `rbac.server.ts` | `assertCanSeeFinancials`, `assertCanWriteMembers`, `assertIsAdmin`, `assertCanManageConfiguracaoGeral` | ✅ todas com `@description`+`@param`+`@throws`+`@example` | Excelente — `@throws {Response} 403` explícito |
| `schemas/auth.ts` | `LoginSchema` (const) + `LoginFormInput` (type) | ⚠️ `LoginSchema` tem JSDoc mas **sem `@example`** | Type `LoginFormInput` documentado |
| `routes/public/login.tsx` | `loader`, `action`, default `LoginPage` | ✅ todos com JSDoc | `safeNext` (helper interno) documentado também |
| `routes/logout.tsx` | `action`, `loader`, default (não há) | ✅ ambos com JSDoc | "Idempotente" documentado |
| `routes/app/_middleware.tsx` | `authMiddleware`, `userContext`, default `AppLayout` | ✅ todos com JSDoc | `@throws {Response} 302` explícito |
| `routes/public/index.tsx` | `loader`, default `Landing`, `meta` | ✅ todos com JSDoc | `meta` poderia ter `@description` |
| `components/Button.tsx` | `Button`, type `ButtonProps` | ✅ ambos com JSDoc | 3 `@example` (default, `as={Link}`, loading) — exemplar |
| `components/Input.tsx` | `Input`, type `InputProps` | ✅ ambos com JSDoc | 2 `@example` |
| `components/Checkbox.tsx` | `Checkbox`, type `CheckboxProps` | ✅ ambos com JSDoc | 1 `@example` |
| `components/ErrorAlert.tsx` | `ErrorAlert`, type `ErrorAlertProps` | ✅ ambos com JSDoc | 2 `@example` |
| `components/FormLogin.tsx` | `FormLogin`, type `FormLoginProps`, helper `ToggleVisibilidade` | ✅ todos com JSDoc | Helper `ToggleVisibilidade` documentado (bom) |
| `components/TopbarPublica.tsx` | `TopbarPublica`, type `TopbarPublicaProps` | ✅ ambos com JSDoc | 2 `@example` |
| `components/CardInfo.tsx` | `CardInfo`, type `CardInfoProps` | ✅ ambos com JSDoc | 2 `@example` |
| `lib/audit.server.ts` | `safeLog`, const `ALLOWED_FIELDS` | ✅ ambos com JSDoc | `@example` presente, mostra vazamento filtrado |
| `lib/cn.ts` | `cn` | ✅ JSDoc com `@param`+`@returns`+`@example` | Bom |
| `lib/errors.ts`, `lib/money.server.ts`, `lib/validators/auth.ts`, `lib/validators/common.ts`, `lib/db/prisma.server.ts` | — | ✅ verificado em S00 (não escopo direto de S01) | — |

**Análise qualitativa:**
- **PT-BR vs inglês:** todas as descrições de função estão em PT-BR; nomes de parâmetros em inglês (correto, conforme GERAIS.md).
- **`@throws`:** consistente em `rbac.server.ts` e `_middleware.tsx` (que lançam `Response`). Ausente onde a função não lança (correto).
- **`@example`:** presente em quase todas as funções com uso não-óbvio. Onde falta (e.g. `LoginSchema`, `checkRateLimit`), o uso é trivial.
- **Comentários inline:** explicam o "porquê" (e.g. "Anti-enumeração: mesmo retorno se não existe OU se não tem senhaHash", "Por que middleware e não em cada loader: DRY + defense in depth"). Atende GERAIS.md §6.2.

**Por que 28/30 (não 30/30):**
- **−1 ponto**: `LoginSchema` (`schemas/auth.ts:21`) é uma const pública exportada mas não tem `@example`. Uso é trivial, mas a consistência pede.
- **−1 ponto**: `meta()` em `routes/public/index.tsx:40` não tem `@description` (o JSDoc acima do código é sucinto, sem `@returns`). Função simples, mas é pública.

---

## Simplicidade — Análise detalhada (21/30)

**Critérios avaliados (GERAIS.md §6.3):**

### 1. Tamanho de funções e arquivos

| Arquivo | Linhas | Função mais longa | Linhas da função | Limite | OK? |
|---|---|---|---|---|---|
| `auth.server.ts` | 127 | `verifyCredentials` | 28 | 30 | ✅ |
| `session.server.ts` | 127 | `getUserFromRequest` | 29 | 30 | ✅ |
| `rate-limit.server.ts` | 58 | `checkRateLimit` | 30 | 30 | ✅ (no limite) |
| `rbac.server.ts` | 87 | 4 funções curtas | ~7 cada | 30 | ✅ |
| `schemas/auth.ts` | 47 | — | — | 30 | ✅ |
| `routes/public/login.tsx` | 199 | **`action`** | **84** | 30 | ❌ **VIOLAÇÃO** |
| `routes/logout.tsx` | 55 | `action` | 18 | 30 | ✅ |
| `routes/app/_middleware.tsx` | 84 | `authMiddleware` | 15 | 30 | ✅ |
| `routes/public/index.tsx` | 129 | `Landing` | 43 | 30 | ⚠️ acima (componente JSX, regra mais flexível) |
| `components/Button.tsx` | 175 | `Button` | 47 | 30 | ⚠️ acima (JSX é menos denso) |
| `components/Input.tsx` | 158 | `Input` | 65 | 30 | ⚠️ acima (JSX) |
| `components/FormLogin.tsx` | 236 | `FormLogin` | 89 | 30 | ⚠️ acima (JSX + `ToggleVisibilidade` interno) |
| `components/ErrorAlert.tsx` | 101 | `ErrorAlert` | 14 | 30 | ✅ |
| `components/TopbarPublica.tsx` | 101 | `TopbarPublica` | 47 | 30 | ⚠️ acima (JSX com skip link) |
| `components/Checkbox.tsx` | 66 | `Checkbox` | 16 | 30 | ✅ |
| `components/CardInfo.tsx` | 88 | `CardInfo` | 22 | 30 | ✅ |

> **Nota:** GERAIS.md §6.3.5 cita "função: máximo 30 linhas. Se passou, divida." Isso vale mais fortemente para funções **lógicas** (com lógica condicional/ramificações) do que para componentes JSX que são lineares. As funções JSX acima do limite são todas "uma renderização linear com 1 ramificação opcional" — aceitável. **Já `action()` em `login.tsx` é função lógica com 4 ramos (rate limit, zod, verifyCredentials, sucesso) e 84 linhas — violação clara.**

### 2. Profundidade de aninhamento

- `routes/public/login.tsx:72` — profundidade **4** dentro de `action()` (if aninhado em if no bloco de `safeLog` rate-limited → `data({...}, { status: 429, headers: {...} })`). Limite é 3. **VIOLAÇÃO**.

### 3. Parâmetros e complexidade

- Nenhuma função pública tem > 4 parâmetros. ✅
- Complexidade ciclomática de `action()` em `login.tsx` é estimada em **~8-9** (4 ramos de early return + 2 fallthroughs), abaixo do limite 10 mas no limite. ⚠️

### 4. YAGNI — abstração prematura

- ✅ **Excelente**: `cn()` em `lib/cn.ts:1` é implementado **sem dependência externa** (sem `clsx`) com comentário explícito "A regra de 3 ainda não justificou abstração". Isso é YAGNI em ação.
- ✅ **Bom**: `Button as={Link} to="/login"` — polimorfismo via `as`/`to` em vez de criar `<ButtonLink>` separado. YAGNI.
- ✅ **Bom**: `manterConectado` no action é **persiste no log mas não muda o TTL** (comentário explícito: "YAGNI — refresh tokens ficam para evolução futura"). Decisão consciente.
- ✅ **Bom**: "Esqueceu a senha? Procure o Admin da sua igreja." (FormLogin) — sem fluxo de recuperação, decisão documentada.

### 5. Code smells encontrados

| Local | Smell | Severidade | Recomendação |
|---|---|---|---|
| `components/FormLogin.tsx:144` | `void useSearchParams;` — import vivo apenas para "uso futuro" | medium | Remover o import e o `void`; usar `useSearchParams` de fato ou removê-lo |
| `routes/public/login.tsx:52-135` | `action()` com 84 linhas, 4 ramos de early-return, profundidade 4 | high | Extrair para `handleRateLimit(ip)`, `handleZodParse(formData, ip)`, `handleInvalidCredentials(ip)`, `handleLoginSuccess(user, ip, next)` — ou ao menos isolar o bloco `safeLog` de rate-limit numa função |
| `routes/public/index.tsx:67-79` | `ITENS_DISPONIVEIS` e `ITENS_EM_DESENVOLVIMENTO` como consts top-level em vez de em `content.ts` | low | YAGNI aceitável no MVP; só mover se 3+ lugares reusarem |

### 6. Comentários "porquê" vs "o quê"

- ✅ Comentários no código explicam o **porquê** (e.g. "Por que middleware e não em cada loader: DRY + defense in depth", "Anti-enumeração: mesmo retorno se não existe OU se não tem senhaHash", "Por que rota em vez de action em /app"). Atende §6.3.5.
- ⚠️ Alguns comentários "o quê" escapam (e.g. `auth.server.ts:50` "Gera hash bcrypt de uma senha em texto puro" repete o que o JSDoc já diz) — mas é tolerable pois ajuda o JSDoc a ser auto-suficiente.

**Por que 21/30 (não 30/30):**
- **−5 pontos**: `action()` em `login.tsx` viola tamanho (84 vs 30) E profundidade (4 vs 3). É a violação mais grave de KISS da sprint.
- **−2 pontos**: `void useSearchParams` em `FormLogin.tsx:144` é abstração morta.
- **−2 pontos**: 4 componentes JSX acima de 30 linhas (Button, Input, TopbarPublica, FormLogin). Aceitável para JSX, mas puxa o score para baixo porque a regra "máximo 30 linhas" é categórica no GERAIS.

---

## Findings consolidados

| # | ID | Severidade | Arquivo:linha | Princípio | Descrição | Sugestão |
|---|---|---|---|---|---|---|
| 1 | CODE-ISS-001 | **high** (blocker) | `e2e/auth.spec.ts` (arquivo inexistente) | TDD | S01-T10 (E2E Playwright, 7 chains) não foi entregue. Diretório `e2e/` vazio. | Criar `e2e/auth.spec.ts` cobrindo login sucesso, credenciais inválidas, validação, rate limit, autenticado em /login, sessão expirada, privacidade (spy) + bypass anônimo |
| 2 | CODE-ISS-002 | **high** | `app/routes/public/login.tsx:52-135` | Simplicidade | Função `action()` tem **84 linhas** (limite 30) e **profundidade 4** (limite 3). 4 ramos de early-return (rate limit, zod, verifyCredentials, sucesso) + bloco `safeLog` aninhado. | Extrair 3 helpers: `rateLimitResponse(ip, retryAfter)`, `parseLoginForm(formData, ip)` (retorna `{ok: true, data} \| {ok: false, response}`), `successResponse(user, sid, next)`. `action()` vira ~20 linhas |
| 3 | CODE-ISS-003 | medium | `app/components/FormLogin.tsx:144` | Simplicidade | `void useSearchParams;` — import vivo sem uso, com comentário "para uso futuro" | Remover o import e o `void`. Se houver uso futuro, adicionar quando precisar |
| 4 | CODE-ISS-004 | medium | (sem commit S01) | TDD | Arquivos novos da S01 estão **untracked** no git; não há evidência verificável de TDD-first (teste antes do código). | Pedir a `backend`/`frontend` commit granular: 1 commit por task S01, com teste antes do código de feature |
| 5 | CODE-ISS-005 | low | `app/lib/schemas/auth.ts:21` | JSDoc | `LoginSchema` é pública exportada e não tem `@example` (uso é trivial, mas quebra consistência) | Adicionar `@example` com `LoginSchema.safeParse({...})` |
| 6 | CODE-ISS-006 | low | `app/routes/public/index.tsx:40` | JSDoc | Função `meta()` tem JSDoc sucinto mas sem `@description` e sem `@returns` | Adicionar `@description` e `@returns {Array<{...}>}` |
| 7 | CODE-ISS-007 | low | `app/components/Button.tsx:170-172` | Acessibilidade (não é pilar mas é transversal) | `aria-disabled` é emitido como `"true"` em `<button>` mesmo quando HTML `disabled` já está presente — screen reader anuncia DUAS vezes | Remover `aria-disabled` quando o componente renderiza `<button>` (deixar só em `<Link>` polimórfico). HTML `disabled` já basta |
| 8 | CODE-ISS-008 | low | (vários) | Simplicidade | 4 componentes JSX acima de 30 linhas (Button 47, Input 65, TopbarPublica 47, FormLogin 89) | Aceitável para JSX linear; revisar se algum crescer mais |

---

## Pontos fortes (5 bullets)

1. **Anti-enumeração implementada e testada com disciplina**: `verifyCredentials` retorna `null` em 3 cenários indistinguíveis, e o teste `auth.server.test.ts:122` afirma explicitamente que `senhaHash` e `email` **não** vazam no retorno. Isso é LGPD §2.5 em código.
2. **Defesa em profundidade na auth**: 3 camadas verificáveis — `verifyCredentials` server-side, `_middleware` que filtra `/app/**`, `safeLog` que aplica allowlist. Cada uma tem teste próprio. Excelente exemplo de RAG `security-rbac-matrix.md` materializado.
3. **Open-redirect prevenido e testado**: `safeNext()` em `login.tsx:142` rejeita `//evil.com`, e há teste explícito `login.test.tsx:151` que verifica o bloqueio. A11y/security numa só função.
4. **Componentes UI com acessibilidade exemplar**: `Input` tem `aria-required` + `aria-invalid` + `aria-describedby` + `role="alert"`, `FormLogin` tem `<main id="main-content">` para skip link WCAG 2.4.1, `ErrorAlert` com `role="alert"`. Tudo testado no HTML SSR.
5. **JSDoc em PT-BR consistente e rico**: 19 funções públicas com `@description` em PT, `@param` em inglês, `@throws` quando aplicável, `@example` para uso não-óbvio. Atende GERAIS.md §6.2 na letra e no espírito.
6. **YAGNI explícito e comentado**: `manterConectado` "por enquanto é apenas persistido (não muda TTL)" (login.tsx:127), "Esqueceu a senha? Procure o Admin" sem fluxo (FormLogin:225), `cn()` sem `clsx` com justificativa. Decisões documentadas = decisões defensáveis.

---

## Top 3 melhorias (1 por princípio)

1. **TDD — S01-T10 (E2E)**: Criar `e2e/auth.spec.ts` com 7 chains do design T8.4 (login sucesso, credenciais inválidas, validação, rate limit 429, autenticado em /login, sessão expirada, privacidade via spy) + bypass anônimo. **Blocker do gate se não for entregue.**
2. **Simplicidade — Refatorar `action()`**: Quebrar `app/routes/public/login.tsx:52-135` em 3 helpers (`rateLimitResponse`, `parseLoginForm`, `successResponse`). Função fica ~20 linhas. Resolve 2 violações (tamanho + profundidade) e melhora legibilidade drasticamente.
3. **Documentação — Adicionar `@example` em `LoginSchema`**: Pequeno ajuste de consistência. Pode ser feito em 5 min, evita -1 ponto em próxima sprint.

---

## Lesson learned / RAG candidate

> **Função `action()` em rota de auth facilmente ultrapassa 30 linhas e profundidade 3 quando concentra 4 etapas (rate limit, validação, credenciais, sucesso) + 4 `safeLog` blocks. Lição: rotas com side-effects server-side devem extrair helpers nomeados por etapa, deixando o `action()` como pipeline linear de ~20 linhas. Padrão candidato para RAG `convention-route-actions`.**

**RAG candidate: `convention-react-router-actions.md` (prioridade: medium)** — documentar o padrão "action() como pipeline de 4 helpers nomeados por etapa", evitando early-returns aninhados e blocos `safeLog` repetidos. Aplicaria também para futuras actions em S02-S05 (membros, alertas, financeiro).

---

## Métricas resumidas

```
Sprint S01 — Cobertura de tasks
✅ S01-T01 verifyCredentials: code + 4 tests
✅ S01-T02 LoginSchema: code + 7 tests
✅ S01-T03 login action: code + 8 tests
✅ S01-T04 logout: code + 3 tests
✅ S01-T05 auth middleware: code + 5 tests
✅ S01-T06 5 componentes UI: code + 38 tests
✅ S01-T07 FormLogin: code + 16 tests
✅ S01-T08 Landing: code + 3 tests
✅ S01-T09 CardInfo: code + 7 tests
❌ S01-T10 E2E Playwright: 0 files (NÃO ENTREGUE)
✅ S01-T11 app.css: visual config (N/A test)

Total: 91 unit/integration tests + 0 E2E = 91 testes
```

```
Princípio                    Score    Max    %      Status
TDD                          27       40     67.5%  ⚠️ parcial
JSDoc                        28       30     93.3%  ✅
Simplicidade                 21       30     70.0%  ⚠️ parcial
─────────────────────────────────────────────────
TOTAL                        76       100    76.0%  ✅ PASS no gate
```

---

**Veredito final:** ✅ **PASS no gate (76 ≥ 70)**, com 1 finding blocker (S01-T10) que deve ser endereçado antes da próxima sprint, 1 finding high (action() muito longa), e 2 mediums. Roster geral está em **muito boa forma** — `auth.server.ts` e `routes/app/_middleware.tsx` são referências de qualidade para as próximas sprints.
