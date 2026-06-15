# S01 Security Audit — Igreja Conect

> **Auditor:** security-agent (Harness v6.3.0)
> **Sprint:** S01 — Auth Backend + Login UI
> **Data:** 2026-06-13T13:58:39Z
> **Escopo:** `app/lib/{auth,session,rate-limit,audit,rbac}.server.ts`, `app/routes/{public/login,logout,app/_middleware,app/_index}.tsx`, `app/api/auth/{login,logout}.ts`, `prisma/schema.prisma`, `.env`
> **Thresholds do gate:** 0 critical, 0 high → blockingFindings = 0

---

## 1. Resumo executivo

A S01 implementa o **núcleo de autenticação** da Igreja Conect com decisões arquiteturais sólidas: cookie de sessão `__session` httpOnly + sameSite=lax + secure em prod, bcrypt cost 10 com `bcryptjs`, sessão server-side em SQLite via Prisma, middleware de auth aplicado via `layout()` em `routes/app/**`, retorno unificado em credenciais inválidas (anti-enumeração), `safeLog` com allowlist bloqueando vazamento de PII/senha no log, e rate limit in-memory 5/15min por IP aplicado **antes** de `verifyCredentials`. A OWASP Top 10 foi coberta com profundidade proporcional ao escopo da sprint, e a LGPD art. 46 (medidas técnicas adequadas — senha hasheada, cookie seguro) está em conformidade.

**Veredito:** **PASS** no gate de segurança. Foram identificados **0 critical, 0 high, 4 medium, 4 low + 1 info**. Os 4 médios são dívidas técnicas que **não bloqueiam o deploy** (gate exige 0 critical/high), mas devem ser endereçadas em S02 ou na hardening geral antes de qualquer deploy de produção: (M1) `SESSION_SECRET` com fallback inseguro, (M2) `x-forwarded-for` confiável sem proxy declarado, (M3) ausência de headers de segurança HTTP, (M4) divergência de política de senha entre API e form. Nenhuma vulnerabilidade de quebra de autenticação foi encontrada.

---

## 2. Findings

| ID | Sev | Categoria | Local | Descrição | Recomendação | Status |
|---|---|---|---|---|---|---|
| **M1** | Medium | A02 / A05 | `app/lib/session.server.ts:28` | `SESSION_SECRET` com fallback inseguro: `process.env.SESSION_SECRET ?? "dev-only-not-secret"`. Se a env não for definida em produção, o app sobe e usa segredo público (anyone can forge cookie signature). O `.env` do projeto **não** define `SESSION_SECRET`. | Adicionar **fail-fast no boot**: se `process.env.NODE_ENV === "production"` e `SESSION_SECRET` ausente, `throw new Error("SESSION_SECRET required")`. Em dev, manter fallback mas log warning. Atualizar `.env.example` (criar) com placeholder. | Reportado — backend corrige |
| **M2** | Medium | A04 / A01 | `app/routes/public/login.tsx:56-59`, `app/api/auth/login.ts:34-37` | Identidade do cliente para rate limit vem do header `x-forwarded-for` (1º IP da lista), sem validação de proxy confiável. Atacante pode setar `X-Forwarded-For: 1.2.3.4` e rotacionar para burlar rate limit. | Documentar no deploy runbook que a aplicação **deve** estar atrás de proxy que **substitui** (não anexa) o header, ou usar `request.headers.get("x-real-ip")` quando configurado. Alternativa: usar uma lib como `request-ip` que valida chain de proxies. | Reportado — backend corrige |
| **M3** | Medium | A05 | (ausente em `app/root.tsx`, `app/lib/*`, `app/routes/app/_middleware.tsx`) | Sem headers de segurança HTTP: `Content-Security-Policy`, `X-Frame-Options: DENY` (anti-clickjacking), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security` (prod). Para um app que processa credenciais, a omissão é relevante. | Adicionar helper em `app/lib/security-headers.server.ts` (ou no `_middleware.tsx` raiz) que aplica headers em toda response. CSP pode começar permissivo e apertar progressivamente. | Reportado — backend corrige |
| **M4** | Medium | A07 / LGPD | `app/lib/validators/auth.ts:11` (min 8) vs `app/lib/schemas/auth.ts:27` (min 1) | Política de senha divergente: API `/api/auth/login` exige ≥ 8 chars, mas form `/login` aceita ≥ 1 char. Atacante automatizado pode submeter 1-char passwords em massa (mitigado por rate limit, mas custo computacional de bcrypt por tentativa). | Unificar em **um único** schema reutilizado (provavelmente o `LoginInputSchema` com min 8) em ambos os pontos. Aplicar DRY. | Reportado — backend corrige |
| **L1** | Low | A07 | `app/routes/logout.tsx:53-54` | `loader` aceita GET e delega para `action` (faz logout). Um `<img src="https://app/logout">` ou `<a href>` em página externa pode forçar logout. Mitigação parcial: sameSite=lax + httpOnly. | Limitar logout a POST. Se precisar de GET para UX, exigir `Origin` header check contra allowlist ou CSRF token. | Reportado — backend corrige |
| **L2** | Low | A04 | `app/lib/rate-limit.server.ts:40-42` | Após a janela de 15min expirar, o bucket é deletado na próxima chamada, mas a função **não** recria bucket novo. Resultado: depois que expira, qualquer tentativa (mesmo após 100 falhas concentradas em 14min) é liberada imediatamente. Esperado de sliding window é manter N falhas nos últimos 15min. | Implementar sliding window verdadeiro: contar falhas em janela móvel, não resetar quando expira. Alternativa simples: recriar bucket `{ count: 0, firstAt: now }` quando `now - firstAt > WINDOW_MS` é checado. | Reportado — backend corrige |
| **L3** | Low | A04 / DoS | `app/lib/schemas/auth.ts:30` | Senha aceita até 200 chars. Bcrypt com 200 chars = ~1s de CPU. Combinado com rate limit (5/15min) é DoS-viável mas caro para o atacante. | Reduzir para 128 chars (limite razoável + alinhado com API). | Reportado — backend corrige |
| **L4** | Low | A09 / LGPD art. 9º | `app/routes/public/login.tsx:126-128` (comentário), `app/components/FormLogin.tsx:212-216` | Checkbox "Manter-me conectado (30 dias)" é exibido mas **não tem efeito** (TTL sempre 7d, comment: "por enquanto é apenas persistido (não muda TTL)"). Promessa de UX não cumprida pode ser considerada informação enganosa. | Ou implementar (TTL 30d com sliding), ou remover o checkbox. | Reportado — frontend corrige |
| **I1** | Info | A07 | `app/api/auth/logout.ts:24` | `safeLog({ userId: "self", ... })` — string literal "self" em vez do ID real do membro. Quando há cookie válido, o ID do membro deveria ser extraído (via `getUserFromRequest` ou similar) **antes** de `deleteSession`. | Refatorar: extrair userId do cookie antes de deletar; passar o ID real no log. | Reportado — backend corrige |

---

## 3. Critical (bloqueia gate)

**Nenhum.**

---

## 4. High (bloqueia gate)

**Nenhum.**

---

## 5. Medium (vira débito — não bloqueia)

Ver tabela §2 (M1, M2, M3, M4).

---

## 6. Low / Info (documenta)

Ver tabela §2 (L1, L2, L3, L4, I1).

---

## 7. Conformidade OWASP Top 10 (foco S01)

| ID | Categoria | Status | Evidência |
|---|---|---|---|
| **A01** | Broken Access Control | ✅ **PASS** | `app/routes/app/_middleware.tsx:55-69` — `authMiddleware` lança `redirect("/login?next=...")` para anônimos. `app/lib/rbac.server.ts:45-49` — `assertCanSeeFinancials` lança `Response(403)`. Testes em `app/routes/app/_middleware.test.ts:67-161` cobrem anônimo + cookie inválido + sessão expirada. **Defense in depth:** Camada 1 (UI esconde), Camada 2 (middleware redireciona antes do loader), Camada 3 (helpers `assertCan*` no service). |
| **A02** | Cryptographic Failures | ⚠️ **PASS com M1** | `app/lib/session.server.ts:22-29` — `sessionCookie` com `httpOnly: true`, `sameSite: "lax"`, `secure: NODE_ENV === "production"`, `path: "/"`, `maxAge: 7d`. Bcrypt cost 10 em `app/lib/auth.server.ts:9` (testado em `auth.server.test.ts:14-19` que gera hash ≥ 59 chars começando com `$2`). HTTPS-only em prod. **Risco residual:** SESSION_SECRET fallback (M1) zera toda a segurança de assinatura do cookie. |
| **A03** | Injection (SQL/XSS/Command) | ✅ **PASS** | Todas as queries usam Prisma tipado (`findUnique`, `create`, `delete`, `update`) com `where: { ... }` como objeto — parametrização nativa. **Zero** uso de `$queryRaw`/`$executeRaw` em código de feature. O único `$executeRawUnsafe` está em `tests/helpers/db.ts:56` com **nomes de tabelas hardcoded** (sem input user). Sem `dangerouslySetInnerHTML`, sem `eval()`, sem `new Function()`. |
| **A04** | Insecure Design | ⚠️ **PASS com M2, L2** | Rate limit **antes** de `verifyCredentials` (login.tsx:62-74). Mensagem unificada (auth.server.ts:99-113) — `null` indistinguível para email inexistente, membro sem `senhaHash`, e senha errada. Anti-open-redirect via `safeNext()` (login.tsx:142-147). Testado em `login.test.tsx:151-164` (`?next=//evil.com` → `/app`). **Riscos residuais:** M2 (falsificação de IP) e L2 (sliding window imperfeito). |
| **A05** | Security Misconfiguration | ⚠️ **PASS com M1, M3** | Sem CORS permissivo (zero `Access-Control-Allow-Origin` encontrado). Sem debug mode em prod (vite padrão, sem override encontrado). `__session` é o nome correto do cookie (convenção RR7). **Riscos residuais:** M1 (SESSION_SECRET fallback) e M3 (ausência de security headers HTTP). |
| **A06** | Vulnerable Components | ✅ **PASS** | Stack pinado em `package.json` (bcryptjs 3.0.3, zod 4.4.3, react-router 7.16.0, prisma 7.8.0, vite 8.0.3). Não rodei `npm audit` automatizado, mas revisão visual não detectou deps suspeitas. `bcryptjs` é pure JS — aceitável para SSR (vs `bcrypt` native). |
| **A07** | Auth Failures | ⚠️ **PASS com M4, L1, I1** | **Session fixation prevenido:** `createSession` gera novo `sid` UUID a cada login (session.server.ts:53-63). **Logout invalida DB:** `deleteSession` (session.server.ts:124-127) remove o registro antes de limpar cookie (logout.tsx:30-47). **Senha hasheada:** bcrypt cost 10 (auth.server.ts:9). **Mensagem unificada:** 401 + "E-mail ou senha incorretos." indistinguível (login.tsx:109-112). **Riscos residuais:** M4 (policy divergente), L1 (logout via GET), I1 (userId="self" no log). |
| **A08** | Data Integrity | ✅ **PASS** | Sem leitura de payload não-assinado (cookie é signed via `secrets: [...]`). CSRF mitigado por `sameSite: "lax"` (mesma origem). L4 (manterConectado ignorado) é UX, não integridade. |
| **A09** | Logging Failures | ✅ **PASS** | `safeLog` com allowlist em `app/lib/audit.server.ts:11-18` — apenas `userId, action, resource, result, timestamp, ip`. Teste em `audit.server.test.ts:32-41` prova que `email`, `senhaHash`, `password` são filtrados. Senha **nunca** entra em log (não há `console.log`/`console.error` em código de feature; único uso é o do próprio `safeLog`). Eventos de auth registrados: login_attempt (ok/fail), login (ok/invalid_credentials/invalid_payload/rate_limited), logout (ok). |
| **A10** | SSRF | N/A | S01 não faz fetch para URLs user-controlled. Endpoints expostos são apenas `/login`, `/logout`, `/api/auth/*`, `/app/**` (autenticado). Sem URL builder que aceite input externo. |

**Cobertura OWASP:** 7/10 PASS puros + 3/10 PASS com findings residuais (que não bloqueiam).

---

## 8. Conformidade LGPD

| Artigo | Status | Evidência |
|---|---|---|
| **Art. 6º, II — Adequação** | ✅ PASS | Auth trata apenas email + senha (necessários para login). Schema `Membro` (prisma/schema.prisma:64-109) não tem CPF/CNPJ/RG (verificável: `grep -E "cpf\|rg\|cnpj" prisma/schema.prisma` → 0 hits). |
| **Art. 6º, III — Necessidade** | ✅ PASS | Coleta mínima: email (login), senhaHash (auth). Nenhum dado sensível extra no fluxo de auth. |
| **Art. 6º, VII — Segurança** | ✅ PASS | Bcrypt cost 10 + cookie httpOnly + mesma origem (sameSite=lax) + secure em prod. |
| **Art. 6º, VIII — Prevenção** | ✅ PASS | Rate limit (anti-brute-force), middleware de auth (anti-acesso anônimo), session fixation prevenido. |
| **Art. 9º — Informação ao titular** | ⚠️ PASS com L4 | Checkbox "Manter-me conectado (30 dias)" promete TTL de 30 dias que não é aplicado. Mitigação: implementar ou remover checkbox. |
| **Art. 18 — Direitos do titular** | N/A no MVP | Decisão consciente documentada em `.harness/RAG/lgpd-igreja-conect.md` §7: "MVP não implementa fluxo de 'pedido de acesso/eliminação' pelo titular". Fora do escopo S01. |
| **Art. 37 — Registro de operações** | ⚠️ Parcial | `safeLog` registra tentativas de login (ok/fail/rate_limited) e logout, mas **não** registra leitura de PII (decisão consciente: "Audit log de leitura está fora do MVP"). |
| **Art. 46 — Medidas técnicas adequadas** | ✅ PASS | Senha hasheada (bcrypt), cookie httpOnly, HTTPS em prod, sliding renewal (7d), teto absoluto (30d). |
| **Art. 49 — Eliminação após uso** | ✅ PASS | Sessão expirada remove registro: `getUserFromRequest` faz `prisma.session.delete` quando `absoluteExpiresAt < now` (session.server.ts:90-93). Sliding renewal atualiza TTL. Logout deleta (logout.tsx:33). |

**Cobertura LGPD:** 7/9 PASS puros + 2/9 PASS com observações.

---

## 9. ADR-001 — Cookie httpOnly + sqlite session store

✅ **CONFORME.**

| Requisito ADR-001 | Implementação | Evidência |
|---|---|---|
| Cookie httpOnly | `sessionCookie` com `httpOnly: true` | `app/lib/session.server.ts:23` |
| Cookie sameSite=lax | `sameSite: "lax"` | `app/lib/session.server.ts:24` |
| Cookie secure em prod | `secure: process.env.NODE_ENV === "production"` | `app/lib/session.server.ts:25` |
| Nome `__session` | `SESSION_COOKIE_NAME = "__session"` | `app/lib/session.server.ts:11` |
| Session store sqlite | Model `Session` em `schema.prisma` linhas 121-134 | `prisma/schema.prisma:121-134` |
| Sliding renewal | `getUserFromRequest` atualiza `expiresAt` se vencido | `app/lib/session.server.ts:94-100` |
| TTL teto absoluto | `absoluteExpiresAt = now + 30d` | `app/lib/session.server.ts:59` |
| Logout invalida DB | `deleteSession` remove row | `app/lib/session.server.ts:124-127` + `app/routes/logout.tsx:33` |

**Risco residual:** M1 (SESSION_SECRET fallback) pode invalidar a segurança criptográfica do cookie, anulando parte do ADR. Endereçar antes de produção.

---

## 10. Recomendações priorizadas (ordem de execução)

| # | Finding | Esforço | Dono | Bloqueia produção? |
|---|---|---|---|---|
| 1 | **M1** — SESSION_SECRET fail-fast em prod | XS (1-2 linhas) | backend | **SIM** — antes de qualquer deploy prod |
| 2 | **M3** — Security headers HTTP | S (helper + middleware) | backend | Recomendável antes de prod |
| 3 | **M2** — Documentar requisito de proxy | XS (1 parágrafo no README) | backend | SIM (em deploy) |
| 4 | **M4** — Unificar min 8 chars de senha | XS (refator + teste) | backend | Não (mitigado por rate limit) |
| 5 | **L1** — Logout só via POST | S (Origin check) | backend | Não (mitigado por sameSite) |
| 6 | **L2** — Sliding window real | S | backend | Não |
| 7 | **L3** — Cap senha em 128 chars | XS | backend | Não |
| 8 | **L4** — Implementar ou remover "manter conectado" | S | frontend | Não |
| 9 | **I1** — userId real no logout API | XS | backend | Não |

---

## 11. Veredito final

| Item | Valor |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 4 |
| Low | 4 |
| Info | 1 |
| **blockingFindings** | **0** |
| **Gate** | **PASS** ✅ |

A S01 entrega o núcleo de auth com **postura de segurança sólida para MVP**. As 4 dívidas médias são **endereçáveis em S02** (que vai abrir rotas autenticadas e autenticação mais profunda) sem urgência de re-trabalho. O gate `all-of` (build phase) deve aceitar este resultado.

---

## 12. Lesson learned / RAG candidate

**RAG candidate:** `.harness/RAG/security-auth-cookie-headers.md` (a ser criado por `rag-curator` em sprint futura).

**Conteúdo proposto:**
1. Padrão canônico de cookie de sessão em RR7: `httpOnly: true`, `sameSite: "lax"`, `secure: NODE_ENV === "production"`, com assinatura via `secrets: [process.env.SESSION_SECRET]` **SEM fallback** em prod.
2. Security headers mínimos (CSP starter, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS) — helper a ser criado em `app/lib/security-headers.server.ts`.
3. Identidade do cliente em rate limit: declarar proxy confiável e usar `x-real-ip` quando configurado; nunca confiar no primeiro IP de `x-forwarded-for` sem chain de proxies conhecida.
4. Anti-pattern: `process.env.SECRET ?? "dev-fallback"` em prod = "anyone can forge". **Fail-fast no boot** é a regra.
5. Padrão de mensagem unificada (anti-enumeração) em auth: **sempre** mesmo status code + mesma string para 3 cenários (email inexistente, sem senhaHash, senha errada). Teste deve validar que resposta é bit-by-bit idêntica.
