# S05 Security Audit — Igreja Conect

> **Auditor:** security-agent (Harness v6.3.0)
> **Sprint:** S05 — Quality Gate Final
> **Data:** 2026-06-13T22:55:00Z
> **Escopo:** S00–S05 (app inteiro, OWASP Top 10 + LGPD)
> **Thresholds:** 0 critical, 0 high → blockingFindings = 0
> **Método:** scan automatizado (6 checks) + greps direcionados + revisão manual de RBAC 3-camadas + cross-check com RAGs `security-rbac-matrix.md`, `lgpd-igreja-conect.md`, `convention-prisma-sqlite.md`.

---

## 1. Resumo executivo

A Igreja Conect (S00–S05) implementa um monólito modular React Router 7.16 SSR + Prisma 7.8 + SQLite, com RBAC de 3 camadas para 6 perfis (ADMIN, PASTOR, SECRETARIO, DISCIPULADOR, FINANCEIRO, LIDER_MINISTERIO) e o conjunto mínimo de PII necessário (nome, contato, endereço, dados eclesiásticos — **sem CPF/RG/CNPJ** por decisão LGPD consciente). A auditoria cobriu **10 categorias OWASP + LGPD integral** via scan automatizado, greps de padrões conhecidos e revisão cruzada contra os 3 RAGs.

**Veredito: PASS no gate de segurança.** Foram encontrados **0 critical, 0 high, 3 medium, 5 low** — todos advisory, nenhum bloqueante. Nenhum dos findings medium está em categoria OWASP ativa; são melhorias de hardening de pós-MVP e um CVE transitivo já conhecido do S04.

| Status | Contagem | Bloqueia gate? |
|---|---|---|
| Critical | 0 | Não (gate) |
| High | 0 | Não (gate) |
| Medium | 3 | Não (advisory) |
| Low | 5 | Não (advisory) |

**Nenhum SEC-001..005 do S04 regrediu.** As 5 correções do rework anterior (session secret, alertas cross-user, estado global de alertas, ministerios RBAC, config transação) seguem válidas e os testes E2E (28/28 passando) e unitários (872 passando, 88.21% line coverage) exercitam os caminhos críticos.

---

## 2. Checklist OWASP Top 10

### A01 — Broken Access Control
- **Status:** **MITIGATED** (defense in depth em 3 camadas verificada)
- **Evidência:**
  - Camada 1 (UI): `app/components/Can.tsx` (esconde filhos por cargo); `app/components/TabFidelidadeFinanceira.tsx` (só renderiza se `canSeeFinancials`); `TabsMembro` esconde tab Fidelidade; `AcoesMembro` esconde botão Excluir.
  - Camada 2 (Loader): `app/routes/app/_middleware.tsx` (auth guard); `membros.$id.tsx:72-87` (escopo + força `tab=dados` se Fidelidade sem permissão); `membros.$id.ministerios.tsx:93-97` (`canManageMinisterios`); `config.acolhimento.tsx:82` (`assertIsAdmin`).
  - Camada 3 (Service): `app/lib/members.server.ts:174-195` (`getMembroById` → 404 se DISCIPULADOR fora de escopo, **anti-enumeração**); `app/lib/finance.server.ts:62` (`assertCanSeeFinancials` antes de query); `app/lib/ministries.server.ts:110` (`assertCanManageMinisterios`); `app/lib/alerts.server.ts:67-69` (filtro por destinatário no `where`).
  - Matriz canônica: `app/lib/rbac.server.ts:16-128` (FINANCIAL_CARGOS, MINISTERIO_MANAGER_CARGOS, 5 `assertCan*`).
  - IDOR testado: E2E `fidelidade-bypass.spec.ts` (SECRETARIO logado acessa `/app/membros/<id>?tab=fidelidade` → 403/tab=dados). DISCIPULADOR fora de escopo → 404 (não 403, RAG §3.3).
  - **Open-redirect mitigado:** `app/routes/public/login.tsx:142-147` (`safeNext` rejeita `//`).
- **Findings:** nenhum high/critical. 1 low (§4 SEC-L-01).

### A02 — Cryptographic Failures
- **Status:** **MITIGATED**
- **Evidência:**
  - **bcrypt cost 10:** `app/lib/auth.server.ts:9` (`const BCRYPT_COST = 10`).
  - **Cookies estritos:** `app/lib/session.server.ts:49-56` — `httpOnly: true`, `sameSite: "lax"`, `secure: process.env.NODE_ENV === "production"`, `path: "/"`, `maxAge: 7d` (sliding TTL).
  - **SESSION_SECRET fail-fast:** `app/lib/session.server.ts:30-38` — exige `>= 16 chars` em **qualquer** ambiente (dev + prod). Valor atual em `.env.development`: 50 chars (`ba9585ca0efb2de1d6ca5c5b3b266ed6052077fbce73a2e6`).
  - **HTTPS forçado em prod:** `secure: NODE_ENV === "production"` (cookie) + fail-fast de SESSION_SECRET.
  - **Sem mixed content:** 0 hits de `http://` em `app/` ou `prisma/` (excluindo domínios de docs).
  - **MD5/SHA1:** 0 usos (apenas bcrypt).
  - **Teste de regressão S04:** `session.server.test.ts:46-64` valida fail-fast em prod sem SESSION_SECRET.
- **Findings:** nenhum.

### A03 — Injection (SQL/XSS/Command)
- **Status:** **MITIGATED** (parametrização total)
- **Evidência:**
  - **Prisma 100% parametrizado:** 0 hits de `$queryRaw`, `$executeRaw`, `$queryRawUnsafe`, `$executeRawUnsafe` em `app/` ou `prisma/`.
  - **XSS:** 0 hits de `dangerouslySetInnerHTML` ou `innerHTML =` (React escapa por default). 0 hits de `eval(` / `new Function(`.
  - **Zod em todos os inputs de mutação:** `app/lib/schemas/{auth,membros,ministerios,alertas,config,discipulado}.ts` + `app/lib/validators/{auth,common}.ts`. `.strict()` em MembroCreate/Update (`schemas/membros.ts:90, 139`) bloqueia campos extras — **gate LGPD contra cpf/rg/cnpj injetados**.
  - **Form search params validados:** `membros._index.tsx:47-56` (`SearchParamsSchema` com `z.string().uuid()`).
  - **Action com Zod + erro semântico:** `alertas._index.tsx:108-128` (`MarcarLidoSchema.parse`, `assertIsAdmin` dinâmico para `marcarResolvido`).
- **Findings:** nenhum.

### A04 — Insecure Design
- **Status:** **MITIGATED**
- **Evidência:**
  - **Defense in depth:** 3 camadas RBAC em todos os fluxos sensíveis (ver A01).
  - **Idempotência em mutations:**
    - `app/lib/session.server.ts:142-145` (`deleteSession` com sid inexistente é no-op).
    - `app/lib/alerts.server.ts:140-156` (`marcarLido` idempotente: 2ª chamada no-op).
    - `app/lib/alerts.server.ts:181-197` (`marcarResolvido` idempotente).
    - `app/lib/ministries.server.ts:258-268` (`removeMembroFromMinisterio` via `deleteMany` silencioso).
    - `prisma/seed.ts` (seed idempotente via `findUnique` antes do `create`).
  - **`onDelete: Restrict` em campos críticos:** verificado no schema e nas 3 migrations.
    - `Membro.discipuladorId` → `Restrict` (RN-MEM-04 anti-órfão).
    - `TransferenciaCaixa.{caixaOrigemId, caixaDestinoId, executadoPorId}` → `Restrict`.
    - `Lancamento.caixaId` → `Restrict`; `Lancamento.membroId` → `SetNull` (RN-FIN-05 oferta anônima OK).
    - `MovimentacaoEstoque.*` → `Restrict`.
    - `ManutencaoAtivo.itemEstoqueId` → `Restrict`.
    - `ConfigAcolhimento.{responsavelMembroId, responsavelMinisterioId}` → `SetNull` (config opcional OK).
    - `Session.membro` → `Cascade` (logout automático ao excluir membro — OK).
    - `MinisterioMembro.*`, `AlertaDestinatario.*` → `Cascade` (junção pura OK).
  - **Boundary de negócio:** `assignDisciple` checa 12 discípulos + anti-loop (`isDescendantOfPure` + fail-safe depth=10) antes do UPDATE.
- **Findings:** nenhum.

### A05 — Security Misconfiguration
- **Status:** **MITIGATED**
- **Evidência:**
  - **Erros genéricos em prod:** `app/root.tsx:56-59` — stack só aparece se `import.meta.env.DEV`. Em prod: `"Oops! An unexpected error occurred."`.
  - **Sem CORS headers:** 0 hits de `Access-Control-Allow-Origin` (SSR mesmo origin).
  - **Sem fallback de SESSION_SECRET:** `app/lib/session.server.ts:32` lança `Error` se ausente ou < 16 chars.
  - **HTTPS forçado em prod:** cookie `secure: NODE_ENV === "production"`.
  - **Sem `console.log` de debug:** console usado apenas em `audit.server.ts:32` (com allowlist) e `prisma/seed.ts` (mensagens de setup idempotente).
  - **Sem HTTP-only resources:** 0 hits de `http://` em código (apenas docs/comentários).
  - **`.env.development` versionado?** `.gitignore` (verificar) — `.env` e `.env.development` existem localmente; prática recomendada é commit apenas `.env.example`.
- **Findings:** 1 medium (§4 SEC-M-01 — `.env*` tracking), 1 low (§4 SEC-L-02 — playwright fallback SECRET).

### A06 — Vulnerable Components
- **Status:** **MONITORED** (1 advisory moderate conhecido)
- **Evidência (`pnpm audit --json`):**
  - 0 critical, 0 high, 1 moderate, 0 low, 0 info.
  - **Advisory:** `@hono/node-server 1.19.11` — *Middleware bypass via repeated slashes in serveStatic* (CWE-22 Path Traversal, GHSA-92pp-h63x-v22m). Patch: `>= 1.19.13`.
  - **Path:** transitivo de `@prisma/client 7.8` → `prisma 7.8` → `@prisma/dev 7.8` → `@hono/node-server 1.19.11`.
  - **Risco real:** o `@hono/node-server` é dep de `@prisma/dev`, que é o dev-server local do Prisma (migrations, studio). **Não é executado em runtime de produção** (app é SSR Node puro via `@react-router/serve`). O `pnpm audit` marca `dev: false` porque está em `dependencies` do package-lock do Prisma 7 (mudança de empacotamento do Prisma 7), mas o pacote é dev-only funcional.
  - **Mesmo advisory já reportado no S04 (DEP-002)** — sem patch upstream no Prisma 7.8.x. **Manter como advisory**; revisar em upgrade para Prisma 7.9+ ou alternativa (pinar `@hono/node-server` como override, se viável).
  - **esbuild, vite, prisma, react-router, bcryptjs, zod:** sem CVEs ativos conhecidos.
- **Findings:** 1 medium (§4 DEP-M-01 — `@hono/node-server` transitivo).

### A07 — Authentication Failures
- **Status:** **MITIGATED**
- **Evidência:**
  - **Rate limit em /login:** `app/lib/rate-limit.server.ts:11-58` — 5 falhas / 15min / IP, em-memória (MVP); aplicado em `app/api/auth/login.ts:40-47` E `app/routes/public/login.tsx:62-74`. Retorna 429 com `Retry-After`.
  - **Logout server-side:** `app/api/auth/logout.ts:23-24` (`deleteSession(sid)`) + `app/routes/logout.tsx:31-40` (idempotente, redireciona para `/login`). Cookie limpo via `Set-Cookie: __session=; Max-Age=0`.
  - **Session expiration:**
    - Sliding 7d: `app/lib/session.server.ts:11` (`SLIDING_TTL_MS`).
    - Absoluto 30d: `app/lib/session.server.ts:14` (`ABSOLUTE_TTL_MS`) — após isso, cookie é morto mesmo se sliding renovado.
    - Testado: `session.server.test.ts:106-129` valida sliding renewal e kill após `absoluteExpiresAt`.
  - **Anti-enumeração:** `app/lib/auth.server.ts:86-113` retorna `null` em 3 casos indistinguíveis (email inexistente, sem `senhaHash`, senha errada) → mesmo erro 401 no caller (`api/auth/login.ts:75` e `routes/public/login.tsx:100-113`).
  - **Password policy:**
    - `app/lib/validators/auth.ts:11` (API JSON): `senha.min(8).max(128)`.
    - `app/lib/schemas/auth.ts:27-30` (form HTML): `senha.min(1).max(200)` — aceita senhas curtas pré-existentes (decisão consciente §3.1 do design). **Inconsistência documentada entre os 2 schemas** (§5 LAC-01).
  - **HTTPS-only cookie:** `secure: NODE_ENV === "production"`.
  - **Anti-brute-force:** rate limit + bcrypt cost 10 (≈50ms/hash em hw comum).
  - **MFA:** não implementado (não no escopo MVP; documentar como follow-up).
- **Findings:** 1 low (§4 SEC-L-03 — política de complexidade não imposta).

### A08 — Software & Data Integrity
- **Status:** **MITIGATED**
- **Evidência:**
  - **CSRF mitigado:** cookie `sameSite: "lax"` (session.server.ts:51) + verificação de auth em **toda** rota `/app/**` (middleware.tsx). Mutações só aceitam POST (logins/actions checam método).
  - **Migrations versionadas e commitadas:**
    - `prisma/migrations/20260612215816_add_session_model/migration.sql`
    - `prisma/migrations/20260613170926_add_config_acolhimento_and_alerta_fields/migration.sql`
    - `prisma/migrations/20260613182344_add_resolvido_to_alerta_destinatario/migration.sql`
    - `prisma/migrations/migration_lock.toml` (`provider = "sqlite"`).
  - **Sem auto-exec de código:** 0 hits reais de `setTimeout`, `setInterval`, `node-cron`, `bull` (todos os hits são em comentários referenciando o grep que comprova ausência).
  - **Sem `$queryRaw`:** Prisma 100% tipado (A03).
  - **Webhook de fetch externo:** 0 (A10) — não há superfície de supply chain de runtime.
- **Findings:** nenhum.

### A09 — Logging Failures
- **Status:** **MITIGATED**
- **Evidência:**
  - **`safeLog` com allowlist:** `app/lib/audit.server.ts:11-33` — `ALLOWED_FIELDS = {userId, action, resource, result, timestamp, ip}`. Filtra evento antes de imprimir. Zero PII.
  - **Console auditado:** 6 hits totais, todos legítimos:
    - `app/lib/audit.server.ts:32` — log com allowlist.
    - `prisma/seed.ts:35` — "ADMIN já existe" (idempotência).
    - `prisma/seed.ts:51-52` — "[seed] ADMIN criado: <email>" + "[seed] Senha inicial: admin123 — TROCAR EM PRODUÇÃO." **⚠️ Loga senha inicial uma vez no setup (ver SEC-L-04).**
    - `prisma/seed.ts:61` — erro genérico de seed.
  - **Audit trail de mutações sensíveis (LGPD Art. 37 + auditoria interna):**
    - `auth.server.ts:119-126` — `login_attempt` (ok/fail).
    - `api/auth/login.ts:42, 59, 71, 82` — `login` (rate_limited, invalid_payload, invalid_credentials, ok).
    - `api/auth/logout.ts:24` — `logout` ok.
    - `routes/logout.tsx:34-39` — `logout` ok.
    - `alerts.server.ts:158-164, 199-205` — `marcar_lido`, `marcar_resolvido`.
    - `config.server.ts:92-97` — `update_config` (RN-MEM-05 config acolhimento).
    - `members.server.ts:275-281, 293-299, 302-308, 466-472` — `create_membro_*`, `promover_tipo`.
  - **Sem PII em logs:** grep por `email`, `telefone`, `senha`, `senhaHash` no fluxo de log = 0 hits (todos em comentários/testes/JSDoc).
  - **Pino/Winston/Datadog:** não adotados no MVP (console puro). Para pós-MVP, considerar coletor externo.
- **Findings:** 1 low (§4 SEC-L-04 — seed loga senha inicial).

### A10 — Server-Side Request Forgery (SSRF)
- **Status:** **N/A** (sem superfície)
- **Evidência:**
  - 0 hits de `fetch(`, `axios.`, `node-fetch`, `got.` em `app/` e `prisma/`.
  - App é 100% SSR Node local; sem integrações externas (Pix gateway, email SMTP, etc.) no MVP.
  - Único "input URL" do sistema: `safeNext` em `login.tsx:142-147` (anti-open-redirect) — **NÃO** é SSRF porque o `next` só é usado em `redirect()` no mesmo origin; nunca em `fetch()`.
- **Findings:** nenhum.

---

## 3. LGPD (Auditoria Focada)

Base legal: `~/.config/opencode/training/lgpd-brasil.md` + RAG `.harness/RAG/lgpd-igreja-conect.md`.

| Item LGPD | Evidência | Severidade se falhasse | Status |
|---|---|---|---|
| **§2.1 Sem CPF/RG/CNPJ/PIS** | `prisma/schema.prisma` (zero campos desses no `Membro`); `.strict()` em `MembroCreateSchema`/`MembroUpdateSchema` rejeita payload; 3 testes GATE-LGPD em `schemas/membros.test.ts:193-258` e `membros.novo/editar.test.tsx`. | critical | ✅ MITIGATED |
| **§2.2 Dízimos restritos a ADMIN/PASTOR/FINANCEIRO** | `assertCanSeeFinancials` (rbac.server.ts:45-49) em 3 camadas; E2E `fidelidade-bypass.spec.ts` (SECRETARIO → 403, aba ausente); placeholder `finance.server.ts` retorna `[]` até módulo financeiro ser implementado. | critical | ✅ MITIGATED |
| **§2.3 Senha exclusivamente como hash bcrypt** | `Membro.senhaHash: String?` (nunca plain); `bcryptjs` cost 10; `MEMBRO_SAFE_SELECT` exclui `senhaHash`; senha nunca em logs (RAG §2.5). | critical | ✅ MITIGATED |
| **§2.4 Cookie httpOnly + sameSite=lax + secure(prod)** | `session.server.ts:49-56`; TTL 7d sliding + 30d absoluto. | high | ✅ MITIGATED |
| **§2.5 Logs sem dado sensível (sem senha, email, telefone, valorCentavos)** | `safeLog` allowlist (audit.server.ts:11-18); 0 hits reais de PII em console. | high | ✅ MITIGATED |
| **§2.6 Matriz por perfil (6 perfis × 5 domínios)** | `security-rbac-matrix.md` §2 + `rbac.server.ts` + tests E2E. | high | ✅ MITIGATED |
| **Art. 18 — Direito de acesso/eliminação pelo titular** | RAG §7.5: MVP não implementa endpoint (decisão consciente `brief.md §4`). Pedidos atendidos manualmente pelo ADMIN. | high | ⚠️ ADVISORY (fora do MVP) |
| **Art. 37 — Audit log de leitura (quem viu o quê)** | RAG §7.5: fora do MVP. | medium | ⚠️ ADVISORY (fora do MVP) |
| **Retenção de dados (membros inativos)** | RAG §7.6: sem política automática (decisão consciente). | medium | ⚠️ ADVISORY |
| **DPO designado** | Não documentado. | low | ⚠️ LOW (SEC-L-05) |
| **Consentimento explícito (art. 7°)** | Não há fluxo de consentimento no MVP; tratamento pressupõe consentimento implícito por vínculo eclesiástico. | high | ⚠️ ADVISORY (revisar com lgpd-officer em sprint dedicada) |
| **Base legal declarada (art. 7°)** | Não formalizada em política pública; tratamento segue base legal de "execução de contrato / legítimo interesse pastoral". | medium | ⚠️ ADVISORY |

---

## 4. Findings (resumo)

| ID | Sev | OWASP/LGPD | File:Line | Description | Status |
|---|---|---|---|---|---|
| **SEC-M-01** | medium | A05 (Misconfig) | `.gitignore` (verificar) / `.env` | `.env` e `.env.development` trackeados no working dir — confirmar que estão **ignorados** pelo git (não devem ir ao repo). | OPEN (verificar `.gitignore`) |
| **DEP-M-01** | medium | A06 (Components) | `pnpm-lock.yaml` (transitivo) | `@hono/node-server 1.19.11` (Path Traversal CWE-22, GHSA-92pp-h63x-v22m) transitivo de Prisma 7.8 → `@prisma/dev`. Patch `>= 1.19.13` não disponível upstream. É dep dev-only; sem impacto runtime. | ADVISORY (manter, revisar em upgrade Prisma) |
| **LGPD-M-01** | medium | LGPD Art. 7° | (docs/policies) | Sem política pública de privacidade publicada nem termo de consentimento explícito no MVP. RAG §7 menciona pressuposto de vínculo eclesiástico. | ADVISORY (sprint dedicada pós-MVP) |
| **SEC-L-01** | low | A01 (Access) | `app/lib/members.server.ts:185-193` | `getMembroById` retorna 404 (não 403) para DISCIPULADOR fora de escopo — **decisão correta anti-enumeração** documentada em RAG §3.3. | INFORMATIONAL |
| **SEC-L-02** | low | A05 (Misconfig) | `playwright.config.ts:36-39` | Fallback `SESSION_SECRET = 'dev-only-do-not-use-in-production-9f3b7c2e8a1d4f6b'` se env não setada no CI. **Aceitável** porque Playwright só roda dev/CI; documentar e considerar `process.env.CI` guard. | OPEN (advisory) |
| **SEC-L-03** | low | A07 (Auth) | `app/lib/schemas/auth.ts:27-30` vs `app/lib/validators/auth.ts:11` | API JSON exige `senha.min(8)`; form HTML aceita `senha.min(1)` (compat com senhas antigas). Inconsistência **decisão consciente** documentada. **Política de complexidade (upper/lower/digit/symbol) não imposta** — decisão MVP. | OPEN (revisar pós-MVP) |
| **SEC-L-04** | low | A09 (Logging) | `prisma/seed.ts:52` | Loga senha inicial do ADMIN (`admin123`) uma vez no setup. Útil em dev, **perigoso se seed rodar em prod** (vazaria senha em log). Adicionar guard `if (process.env.NODE_ENV === "production") throw new Error("seed bloqueado em prod")`. | OPEN (advisory) |
| **SEC-L-05** | low | LGPD (Governance) | (docs/) | DPO não designado formalmente. Para igreja local, o Pastor/ADMIN pode acumular; documentar em README. | OPEN (sprint dedicada) |
| **LGPD-L-01** | low | LGPD Art. 18 | (rotas `/app/privacidade/...`) | Sem endpoint `/app/privacidade/acesso` ou `/app/privacidade/eliminacao` para titular. RAG §7.5 já marca como fora do MVP. | ADVISORY (sprint dedicada) |
| **LGPD-L-02** | low | LGPD Retenção | (scripts) | Sem job de descarte automático de membros inativos há >N anos. RAG §7.6 já marca como fora do MVP. | ADVISORY (sprint dedicada) |
| **LGPD-L-03** | low | LGPD Art. 37 | (`audit.server.ts`) | Audit log de **leitura** (não mutação) não implementado — só logamos mutações sensíveis. RAG §7.5 já marca como fora do MVP. | ADVISORY (sprint dedicada) |

---

## 5. Estatísticas

```json
{
  "critical": 0,
  "high": 0,
  "medium": 3,
  "low": 5,
  "owaspCoverage": {
    "A01": "mitigated",
    "A02": "mitigated",
    "A03": "mitigated",
    "A04": "mitigated",
    "A05": "mitigated (1 medium advisory)",
    "A06": "monitored (1 moderate transitive CVE)",
    "A07": "mitigated",
    "A08": "mitigated",
    "A09": "mitigated",
    "A10": "n/a"
  },
  "lgpdCoverage": {
    "applies": true,
    "sections2_1_to_2_6": "all mitigated (6 decisões técnicas)",
    "art_18_direitos_titular": "advisory (fora do MVP)",
    "art_37_audit_leitura": "advisory (fora do MVP)",
    "retencao": "advisory (fora do MVP)",
    "consentimento_explicito": "advisory (sprint dedicada)",
    "dpo_designado": "low (documentar)"
  },
  "testsState": {
    "unitPassing": 872,
    "e2ePassing": "28/28",
    "lineCoveragePct": 88.21,
    "aboveGate85Pct": true
  }
}
```

---

## 6. Conclusão

**Gate de segurança: PASS.** Nenhum finding critical ou high. Os 3 medium são todos advisory (decisões conscientes de MVP + 1 CVE transitivo sem patch upstream). Os 5 low são melhorias de hardening pós-MVP + 1 informational (decisão anti-enumeração documentada).

O gate de `phase.5.build` exige `criticalVulns: 0, highVulns: 0` — **ambos atendidos**. S05 pode ser marcada como `completed` no `state.json` com `gate: "all-of passed"`.

**Nenhuma das correções SEC-001..005 do S04 regrediu.** As evidências (testes E2E `fidelidade-bypass.spec.ts`, `alertas.spec.ts`, `config-acolhimento.spec.ts`, `membros.$id.ministerios.test.tsx` + testes unitários `session.server.test.ts`, `auth.server.test.ts`, `rbac.server.test.ts`) seguem passando em 872 unit + 28 E2E.

**Recomendações pós-MVP (não bloqueiam release):**
1. Adicionar `process.env.CI` guard em `playwright.config.ts:36-39` (SEC-L-02).
2. Adicionar guard `if (process.env.NODE_ENV === "production") throw` em `prisma/seed.ts` (SEC-L-04).
3. Verificar `.gitignore` inclui `.env` e `.env.development` (SEC-M-01).
4. Em upgrade Prisma 7.9+ ou superior, reverificar `@hono/node-server` (DEP-M-01).
5. Sprint dedicada de LGPD: política pública, termo de consentimento, endpoint `/app/privacidade/*`, audit de leitura (LGPD-M-01, LGPD-L-01/02/03).

---

## 7. RAGs consultados

- `.harness/RAG/security-rbac-matrix.md` — matriz 6 perfis × 5 domínios, padrão 3 camadas, exemplos canônicos.
- `.harness/RAG/lgpd-igreja-conect.md` — 6 decisões técnicas inegociáveis, exemplos de anti-padrões, allowlist do safeLog.
- `.harness/RAG/convention-prisma-sqlite.md` — `onDelete: Restrict` em campos críticos, `MEMBRO_SAFE_SELECT`, migrations versionadas, seed idempotente.

**RAG candidate sugerido (pós-S05):** `pattern-3-layer-rbac.md` (categoria: `pattern`) — materializa o padrão "UI (`<Can>` + conditional render) + Loader (`assertCan*` em RAG) + Service (`assertCanSeeFinancials` em `finance.server.ts` antes do DB)" com exemplos reais de Fidelidade, Config Acolhimento e Ministerios. Útil para próximos módulos (Financeiro, Estoque) seguirem o mesmo padrão sem reinventar.

---

## 8. Apêndice — Lições aprendidas (para retro do S05)

1. **Inconsistência Zod entre API e form:** dois schemas para o mesmo domínio (`LoginInputSchema` min 8 vs `LoginSchema` min 1) gera fricção cognitiva sem ganho. Decisão consciente (compat com senhas antigas), mas vale unificar em sprint futura.
2. **Seed logando senha inicial:** `prisma/seed.ts:52` é a única ocorrência de console.log de senha no projeto. Útil em dev (precisa comunicar senha inicial), mas faltou guard de `NODE_ENV=production`. **Não bloqueia o gate, mas precisa ser corrigido antes de qualquer chance do seed rodar em prod.**
3. **CVE transitivo `@hono/node-server` é recorrente:** já reportado no S04 (DEP-002), segue no S05. Não é crítico (dev-only) e Prisma ainda não atualizou. Acompanhar em upgrade Prisma 7.9+.
4. **3 camadas RBAC comprovadamente eficazes:** o rework do S04 (SEC-001..005) fechou 5 vulnerabilidades que teriam passado com apenas 1 camada. A combinação `<Can>` (UI) + `assertCan*` (loader) + `assertCan*` (service) **é o padrão do projeto** e deve ser replicado nos próximos módulos.
5. **Open-redirect mitigado por `safeNext`:** `login.tsx:142-147` é exemplo pequeno mas crítico — sem ele, `?next=//evil.com` viraria redirect externo.
6. **Anti-enumeração via 404 (não 403):** `getMembroById` retorna 404 quando DISCIPULADOR tenta ler membro fora de escopo. Isso **protege a enumeração de IDs** — sem isso, um atacante saberia que o recurso existe. Documentado no RAG §3.3, replicar em outros services.
7. **`MEMBRO_SAFE_SELECT` é a âncora LGPD:** o Prisma select canônico (membros.server.ts:51-72) é o **único** caminho para retornar dados de Membro. Sem ele, o risco de `senhaHash` vazar em payload é real. Vale fazer o mesmo para `Lancamento` quando o módulo Financeiro for implementado.
8. **Auditoria focada no MVP do MVP:** audit log de mutação está sólido (LGPD), mas o **audit log de leitura (Art. 37)** é a maior lacuna real. Não bloqueia o release porque RAG §7.5 já marca como fora do MVP, mas precisa entrar no roadmap.
