# Parecer LGPD — Sprint S01 (Auth Backend + Login UI)

**Projeto:** Igreja Conect
**Sprint auditada:** S01 — Auth Backend + Login UI
**Auditor:** `lgpd-officer` (harness v6.3.0)
**Lei aplicada:** Lei 13.709/2018 (LGPD)
**Data da auditoria:** 2026-06-13
**Escopo da auditoria:** tarefas S01-T01 a S01-T11 (auth completo), com base em `sprints/S01.json`, `sprints/cross-sprint.json`, `prisma/schema.prisma`, `app/lib/auth.server.ts`, `app/lib/session.server.ts`, `app/lib/audit.server.ts`, `app/lib/rate-limit.server.ts`, `app/lib/schemas/auth.ts`, `app/routes/public/login.tsx`, `app/routes/logout.tsx`, `app/routes/app/_middleware.tsx`, `app/components/FormLogin.tsx`, `app/app.css`.

> **Triagem automatizada — não é parecer formal.** Em caso de dúvida complexa, escalar para advogado(a) humano(a).

---

## 1. Identificação do Encarregado (DPO) — Art. 41

| Item | Status | Evidência |
|---|---|---|
| DPO designado formalmente | **Pendente (fora do MVP)** | `sprints/cross-sprint.json` DEBT-013 e `brief.md §4` declaram explicitamente: DPO + Art. 18 são Sprint 2+. |
| E-mail de contato público | **Pendente (fora do MVP)** | Sem política de privacidade publicada ainda (Art. 18 fora do MVP). |
| Visibilidade técnica | **Parcial** | Nenhum artefato de designação; contudo, requests do titular hoje são atendidos manualmente pelo ADMIN. |

**Base legal:** Art. 41 LGPD. **Classificação:** **advisory (fora do MVP)** — `brief.md §4` e PRD §4 excluem explicitamente. **Não bloqueia S01** (gate atual não exige DPO designado no MVP, conforme `state-machine.json`).

**Recomendação para sprint 2+:** designar DPO (pode ser o Pastor Presidente + ADMIN técnico em modelo híbrido), publicar e-mail (ex: `dpo@igreja.local`), e atualizar política de privacidade antes de qualquer exposição pública.

---

## 2. Base legal do tratamento (Art. 7º)

| Finalidade | Base legal escolhida | Art. | Justificativa |
|---|---|---|---|
| Autenticação de membro (login) | **Execução de contrato** | Art. 7º, V | O titular é parte do vínculo eclesiástico; login é procedimento preliminar necessário à fruição do sistema. |
| Segurança do sistema (rate limit, logs de tentativas) | **Interesse legítimo** | Art. 7º, IX | Prevenção a fraude e abuso (força-bruta). Mitigado por: (a) LIA não-formal; (b) retenção mínima (apenas `userId`/`ip`/`action`/`result`); (c) titular pode revogar a qualquer momento via exclusão da conta. |
| Cookies essenciais (sessão) | **Execução de contrato** | Art. 7º, V | Sem o cookie, o serviço não funciona. **Não é consentimento** — Art. 7º, §4º (cookies estritamente necessários não precisam de consentimento). |
| Manter sessão por 7 dias (sliding) | **Execução de contrato** | Art. 7º, V | UX solicitada pelo titular (checkbox "manter conectado" tem efeito de UX percebido; TTL sliding já cobre o caso comum — YAGNI refresh token). |

> **Art. 14 (crianças/adolescentes):** Não há tratamento específico de dado de menor nesta sprint. O sistema pode ser acessado por menores apenas se forem `MEMBRO_ATIVO` (responsabilidade do ADMIN cadastrar). A trava é organizacional, não técnica. **Não bloqueia.**

---

## 3. Dados pessoais tratados na S01

| Categoria | Campo | Origem | Persistência | Criptografia | Observação |
|---|---|---|---|---|---|
| Identificação | `Membro.id` (UUID) | Schema | Banco (sessão + log) | N/A (identificador técnico) | Não é PII por si só; torna-se PII quando correlacionado. |
| Nome | `Membro.nome` | Schema | Banco (sessão via `SessionUser`) | N/A (necessário para UI) | Selecionado no `verifyCredentials` para evitar lookup posterior. |
| Cargo | `Membro.cargo` | Schema | Banco (sessão) | N/A (necessário para RBAC) | Decide permissões. |
| E-mail (input) | `LoginSchema.email` | Form HTML → action | **Não persistido em log** | N/A (transitório) | Mensagem unificada anti-enumeração. Nunca vai para `safeLog` (verificado por spy em teste). |
| Senha (input) | `LoginSchema.senha` | Form HTML → action | **Não persistido em log** | bcrypt cost 10 em `Membro.senhaHash` | Nunca vai para `safeLog`; nunca trafega em query string; nunca volta no payload. |
| Hash de senha | `Membro.senhaHash` | Schema | Banco | bcrypt (`$2a$10$…`) | Único campo de "segredo" persistido. |
| IP | `request.headers["x-forwarded-for"]` | Action | Log (allowlist) | N/A | Necessário para rate limit + auditoria de tentativas. |
| SID (sessão) | `Session.id` (UUID) | Schema | Banco + cookie | N/A (já é opaco) | Cookie `__session` httpOnly, sameSite=lax, secure em prod. |
| Expiração | `Session.expiresAt` + `Session.absoluteExpiresAt` | Schema | Banco | N/A | Sliding 7d + teto 30d (Art. 49 — eliminação). |
| User-agent | — | — | **Não coletado** | — | **Princípio da necessidade (Art. 6º, III)** — não há utilidade operacional registrada; não foi coletado. |

> **Conformidade com Art. 6º, III (necessidade):** ✅ o conjunto de dados é o mínimo para autenticação. Não há coleta de CPF, RG, data de nascimento, profissão, ou endereço **nesta sprint**. Esses campos existem no schema (S02+), mas não são tratados pelo fluxo de auth.

---

## 4. Finalidade (Art. 6º, I)

**Finalidade declarada:** autenticação de membro no sistema administrativo da Igreja Conect, incluindo prevenção a acesso não autorizado (força-bruta e session hijacking).

**Uso efetivo observado em código:**
- `verifyCredentials` (auth.server.ts:86-113) → compara credenciais, retorna subset seguro (`id`, `nome`, `cargo`).
- `createSession` (session.server.ts:53-63) → cria registro de sessão vinculado a `membroId`.
- `getUserFromRequest` (session.server.ts:79-107) → resolve usuário a cada request, com sliding renewal e eliminação de sessões expiradas.
- `deleteSession` (session.server.ts:124-127) → remove registro no logout.
- `authMiddleware` (app/_middleware.tsx:55-69) → protege rotas `/app/**` (redireciona anônimos para `/login?next=…`).
- `safeLog` (audit.server.ts:28-33) → loga apenas `userId`/`action`/`result`/`ip`/`resource`/`timestamp` (allowlist).

**Compatibilidade:** ✅ finalidade compatível com a declarada. Nenhum uso secundário (sem marketing, sem compartilhamento, sem analytics).

---

## 5. Riscos identificados

| # | Risco | Probabilidade | Impacto | Mitigação | Status |
|---|---|---|---|---|---|
| R1 | Senha vazada em log (mesmo hasheada) | Baixa | Alto | `safeLog` aplica allowlist; testes de spy confirmam. | ✅ Mitigado |
| R2 | Session fixation | Média | Alto | Cookie novo é gerado a cada login bem-sucedido (`createSession` cria novo UUID); sessão antiga é invalidada pelo sliding renewal. | ✅ Mitigado |
| R3 | CSRF em logout | Baixa | Médio | Cookie com `sameSite: "lax"` (session.server.ts:24). Logout é POST. | ✅ Mitigado |
| R4 | XSS roubando sessão | Média | Crítico | Cookie `httpOnly: true` (session.server.ts:23) impede JS de ler sessão. Tailwind 4 + React 19 com escape automático de string interpolations. | ✅ Mitigado |
| R5 | Força-bruta em `/login` | Média | Alto | Rate limit 5 falhas/15min/IP (rate-limit.server.ts:11-12) com reset em sucesso (linha 33-35). Retorna 429 + `Retry-After`. | ✅ Mitigido |
| R6 | Enumeração de usuários (email existe ou não) | Média | Médio | Mensagem unificada "E-mail ou senha incorretos." (login.tsx:110) + mesmo `null` retornado em 3 cenários (auth.server.ts:99-103). Tempo de resposta uniforme (bcrypt roda mesmo quando usuário não existe). | ✅ Mitigado |
| R7 | Sessão órfã (criada, nunca encerrada) | Baixa | Médio | Sliding renewal por 7d + teto absoluto 30d (session.server.ts:90-100). Sessão expirada é deletada no próximo request. `Cascade` no `Membro` (schema.prisma:129) garante limpeza ao excluir membro. | ✅ Mitigado |
| R8 | Cookie em HTTP (não-TLS) | Média | Alto | `secure: process.env.NODE_ENV === "production"` (session.server.ts:25). Em dev: HTTP local; em prod: exige HTTPS. | ⚠️ Dependente de config de deploy — **risco residual operacional** (não-bloqueante para S01, mas S05/DEBT-011 deve gerar `SESSION_SECRET` e configurar HTTPS antes do go-live). |
| R9 | Acesso anônimo a `/app/**` | Média | Alto | `authMiddleware` (app/_middleware.tsx:55-69) redireciona para `/login?next=…`. `getUserFromRequest` retorna `null` para sessão expirada. Defense in depth. | ✅ Mitigado |
| R10 | `SESSION_SECRET` em default fraco | Alta | Alto | `secrets: [process.env.SESSION_SECRET ?? "dev-only-not-secret"]` (session.server.ts:28). **Em produção, se a env var não for setada, o cookie fica assinado com string pública.** | ⚠️ Risco residual — **DEBT-011** já registrado para S05 gerar/configurar antes do go-live. Não bloqueia S01 (S01 é dev/MVP). |
| R11 | Rate limit in-memory não escala | Alta (em prod multi-instância) | Médio | Documentado em código (rate-limit.server.ts:2-4): "estado em memória. Não persiste após restart, não escala para multi-instância. Para MVP (1 processo Node) é suficiente." Aceito conscientemente. | ⚠️ Aceito — substituir por Redis/DB antes de escalar. Não bloqueia MVP. |
| R12 | Vazamento de PII via Google Fonts/Analytics | Nula | Alto | `app.css` usa font stack 100% do sistema (app.css:60-64). Zero dependência externa. Verificado por `grep` (sem `googleapis`, `googletagmanager`, `google-analytics`). | ✅ Mitigado |

---

## 6. Conformidade por artigo

| Artigo | Status | Evidência (arquivo:linha) | Observação |
|---|---|---|---|
| **Art. 6º, I** (Finalidade) | ✅ pass | `verifyCredentials` (auth.server.ts:86-113), `safeLog` (audit.server.ts:11-18) | Compatibilidade mantida. |
| **Art. 6º, II** (Adequação) | ✅ pass | Mensagem unificada anti-enumeração (login.tsx:110; auth.server.ts:99-103). | Forma de tratamento compatível. |
| **Art. 6º, III** (Necessidade) | ✅ pass | `SessionUser` carrega apenas `{id, nome, cargo}` (session.server.ts:34-38); `safeLog` allowlist com 6 campos (audit.server.ts:11-18). | Mínimo necessário. |
| **Art. 6º, VII** (Segurança) | ✅ pass | bcrypt cost 10 (auth.server.ts:9); cookie httpOnly+sameSite=lax+secure em prod (session.server.ts:22-29); rate limit (rate-limit.server.ts:11-12). | Implementação robusta. |
| **Art. 6º, VIII** (Prevenção) | ✅ pass | Defense in depth: middleware (app/_middleware.tsx:55-69) + `verifyCredentials` + sliding renewal + rate limit. | Múltiplas camadas. |
| **Art. 6º, X** (Responsabilização) | ⚠️ parcial | `safeLog` registra tentativas, mas **auditoria de leitura** (quem viu o quê) está fora do MVP (PRD §4, DEBT-012). | Aceito para MVP. **Advisory** para sprint 2+. |
| **Art. 7º, V** (Execução de contrato — login) | ✅ pass | Login é procedimento preliminar do vínculo eclesiástico. | Documentado nesta seção 2. |
| **Art. 7º, IX** (Interesse legítimo — segurança) | ✅ pass | Rate limit + log de tentativas; LIA não-formal; titular pode revogar (encerrar conta). | Sem crianças/adolescentes vetados (Art. 14). |
| **Art. 11** (Dado sensível) | ✅ N/A | S01 não trata dado sensível. Histórico de dízimos só será tratado em S03+ (com RBAC restrita). | Não aplicável nesta sprint. |
| **Art. 14** (Crianças/adolescentes) | ✅ N/A | Cadastro de menor é responsabilidade do ADMIN. Auth não trata dado específico de menor. | Não aplicável. |
| **Art. 18** (Direitos do titular) | ⚠️ **advisory-fora-mvp** | DEBT-013 + `brief.md §4` + `PRD §4`: explicitamente fora do MVP. | **Não bloqueia S01** (PRD autoriza adiamento). Endpoints `/app/privacidade/**` ficam para sprint 2+. |
| **Art. 33-36** (Transferência internacional) | ✅ N/A | Stack 100% local (SQLite local, font stack do sistema, zero CDN externo). Sem AWS US / GCP US / Vercel / Cloudflare. Verificado por `grep` e leitura de `app.css`. | Não aplicável. |
| **Art. 37** (Registro de operações) | ⚠️ **advisory-fora-mvp** | S01 registra **tentativas de login/logout** (Art. 6º, X), mas não a auditoria de **leitura** ("quem viu o quê"). DEBT-012. | **Não bloqueia S01** (PRD autoriza). |
| **Art. 38** (RIPD) | ✅ N/A | S01 não é feature de alto risco (não há perfilamento, scoring, dado sensível, ou criança). RIPD será necessário em S03/S04 (Fidelidade, Alertas). | Não aplicável. |
| **Art. 41** (DPO/Encarregado) | ⚠️ **advisory-fora-mvp** | DEBT-013; fora do MVP. | **Não bloqueia S01.** |
| **Art. 46** (Segurança — medidas técnicas adequadas) | ✅ **pass** | bcrypt (auth.server.ts:9); cookie flags (session.server.ts:22-29); sliding renewal + cascade (session.server.ts:90-100, schema.prisma:129); rate limit (rate-limit.server.ts:11-12). | **NÃO há falha em Art. 46** — finding **HIGH** não aplicável. |
| **Art. 48** (Incidentes) | ⚠️ **advisory-fora-mvp** | Sem plano de resposta documentado (DEBT não-cadastrado, mas a ser criado). Time precisa saber prazo de 2 dias úteis para ANPD. | **Advisory** — não bloqueia S01 (S01 não é incidente, é o baseline). Sprint 2+ deve documentar. |
| **Art. 49** (Eliminação após uso) | ✅ **pass** | `deleteSession` no logout (session.server.ts:124-127; logout.tsx:33); sessão expirada é deletada (session.server.ts:91); `Cascade` no `Membro` (schema.prisma:129); rate limit zerado em sucesso (rate-limit.server.ts:33-35). | **NÃO há falha em Art. 49** — finding **HIGH** não aplicável. |

---

## 7. Auditoria automatizada (grep + inspeção de código)

| Padrão procurado | Comando / inspeção | Resultado |
|---|---|---|
| Coleta de PII sensível no schema | `grep -E "(cpf|rg|cnpj|tituloEleitor|pis|cartaoSus)" prisma/schema.prisma` | **0 matches** (matches `cargo` são falso-positivo do regex). ✅ |
| Hash inadequado | `grep -E "(md5|sha1)" app/` | **0 matches.** ✅ |
| Senha em log | `grep -E "(console\.(log|error)\|logger\.).*\b(cpf\|email\|senha\|password\|token\|secret)\b" app/` | **0 matches.** ✅ |
| HTTP em vez de HTTPS | `grep -E "http://" app/` | 28 matches — **todos** são: (a) `new Request("http://localhost/...")` em arquivos de teste (`**/*.test.tsx`); (b) `xmlns="http://www.w3.org/2000/svg"` em SVGs inline. **Nenhuma conexão real sem TLS.** ✅ |
| Fontes externas (Google Fonts) | `grep -E "(googleapis\|fonts.gstatic\|googletagmanager\|google-analytics)" app/` | **0 matches.** Font stack 100% do sistema (app.css:60-64). ✅ |
| Analytics/tracking de terceiros | mesmo grep | 0 matches. ✅ |
| Vazamento de `senhaHash` no payload de auth | `auth.server.test.ts:120-122` | `expect(...).senhaHash).toBeUndefined();` e `email).toBeUndefined()`. ✅ |
| Allowlist do `safeLog` | `audit.server.test.ts:24-30` | Garante que `email`, `senhaHash`, `password`, `telefone`, `valorCentavos` estão fora. ✅ |
| Bcrypt cost | `auth.server.test.ts:14-19` | Hash começa com `$2` e tem ≥ 59 chars (cost 10). ✅ |

---

## 8. Recomendações (em ordem de prioridade)

### 8.1 Bloqueantes (gate de S01) — **nenhuma encontrada.**

### 8.2 Advisories (sprint 2+)

1. **S05 — gerar `SESSION_SECRET` real e configurar HTTPS** (DEBT-011).
   - Risco: cookie assinado com secret padrão é forjável. Em dev, OK. Antes do go-live, obrigatório.
   - Esforço: baixo (gerar 32 bytes, setar env var).

2. **Sprint 2+ — Art. 18 (endpoints `/app/privacidade/...`)** (DEBT-013).
   - Implementar 10 direitos (Art. 18, I-IX, §1º) com prazo de 15 dias (Res. CD/ANPD 15/2024).
   - Endpoints: `/api/privacy/access`, `/api/privacy/correction`, `/api/privacy/portability`, `/api/privacy/deletion` (com soft-delete + job de purga).
   - Esforço: médio. Bloqueia go-live público (não bloqueia MVP em piloto).

3. **Sprint 2+ — Art. 37 (auditoria de leitura)** (DEBT-012).
   - Helper `accessMembroData(actor, target, action, legalBasis)` em `app/lib/audit.server.ts` (camada 3).
   - View `/app/admin/auditoria` (ADMIN-only).
   - Esforço: médio.

4. **Sprint 2+ — Art. 41 (DPO designado + política de privacidade)** (DEBT-013).
   - Designar encarregado (pode ser híbrido: Pastor Presidente + ADMIN técnico).
   - Publicar e-mail (ex: `dpo@igreja.local`) no rodapé do app.
   - Publicar política de privacidade (mínimo: controlador, finalidades, bases legais, direitos do titular, contato do DPO, retenção, compartilhamento).
   - Esforço: baixo (textual + atualização de `app.css` e footer).

5. **Sprint 2+ — Art. 48 (plano de resposta a incidente)**.
   - `docs/incidents.md` com: definição, contatos, runbook, prazo 2 dias úteis ANPD, template de comunicação a titulares, teste de tabletop trimestral.
   - Esforço: baixo. Não-bloqueante para MVP.

6. **Sprint 2+ — rate limit compartilhado** (substituir Map in-memory por DB ou Redis).
   - Antes de multi-instância, rate limit atual permite bypass entre instâncias.
   - Esforço: médio (mover `Map<>` para SQLite ou Redis).

7. **Sprint 2+ — `manterConectado` com TTL estendido** (opcional).
   - Checkbox existe, mas cookie tem TTL fixo de 7d. UX promete "30 dias" no label (FormLogin.tsx:213). Ajustar para `maxAge: 30 * 24 * 60 * 60` se `manterConectado` for `true` (com teto absoluto de 30d no `absoluteExpiresAt`).
   - **Achado adicional menor (low).** Esforço: baixo.

---

## 9. Lesson learned / RAG candidate

**Candidato a RAG (`pattern`):** `lgpd-pattern-auth-cookie-2026.md` — consolidar o **padrão de cookie de sessão LGPD-compliant para React Router 7 + Prisma + SQLite** que o Igreja Conect validou:

- bcrypt cost ≥ 10 (ADR-002 do projeto);
- `httpOnly: true`, `sameSite: "lax"`, `secure: NODE_ENV === "production"`, `path: "/"`, `maxAge: 7d`;
- sessão server-side com sliding renewal + teto absoluto (evita JWT client-side);
- `safeLog` com allowlist (6 campos) garantindo que nem email nem hash vazam;
- mensagem unificada anti-enumeração (3 cenários indistinguíveis: email inexistente, sem senhaHash, senha errada);
- rate limit por IP, com reset em sucesso;
- `Cascade` no `Session.membroId` para limpeza automática ao excluir membro;
- `manterConectado` documentado como UX (não muda TTL — YAGNI refresh token).

Esse padrão pode ser reutilizado em outros 2 projetos do mesmo dev solo / startup, e reduz risco de re-implementação insegura. **Owner sugerido:** `rag-curator` na sprint 2+.

---

## 10. Parecer final

**Parecer:** **CONFORME COM RESSALVAS**

| Artigo crítico (gate) | Status | Bloqueia? |
|---|---|---|
| **Art. 46 (Segurança)** | ✅ pass | **NÃO** |
| **Art. 49 (Eliminação)** | ✅ pass | **NÃO** |
| **Art. 18 (Direitos do titular)** | ⚠️ advisory-fora-mvp | **NÃO** (PRD §4 autoriza) |
| **Art. 37 (Auditoria de leitura)** | ⚠️ advisory-fora-mvp | **NÃO** (PRD §4 autoriza) |
| **Art. 41 (DPO)** | ⚠️ advisory-fora-mvp | **NÃO** (PRD §4 autoriza) |
| **Art. 48 (Incidentes)** | ⚠️ advisory-fora-mvp | **NÃO** (não-bloqueante, S05) |

**Blocking findings:** Critical: **0** | High: **0**
**Advisory findings:** Medium: **0** | Low: **1** (UX `manterConectado` ≠ TTL efetivo)
**Fora do MVP (registrados):** 5 (DEBT-011, 012, 013, + plano de incidente + RIPD futuro).

**Top 3 recomendações:**

1. **Nada bloqueia S01** — a implementação está sólida e bem documentada.
2. **Sprint 2+ deve atacar Art. 18, 37 e 41** antes de qualquer exposição pública (piloto interno pode conviver).
3. **S05 (gate final) deve gerar `SESSION_SECRET` real** (DEBT-011) e documentar plano de resposta a incidente antes do go-live.

**RAG candidate:** `pattern:auth-cookie-lgpd-compliant-rr7-prisma-sqlite` (ver §9).

---

*Auditoria conduzida por `lgpd-officer` (harness v6.3.0). Base legal: Lei 13.709/2018 + Resoluções CD/ANPD vigentes. RAGs consultados: `~/.config/opencode/training/lgpd-brasil.md`, `.harness/RAG/lgpd-igreja-conect.md`, `.harness/RAG/security-rbac-matrix.md`, `.harness/RAG/architecture-monolith-modular.md`.*

*Este parecer é uma triagem automatizada, não substitui advogado(a) humano(a). Em caso de incidente real, escalone.*
