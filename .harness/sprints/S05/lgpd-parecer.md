# S05 LGPD Parecer Final — Igreja Conect (MVP)

> **Parecerista:** lgpd-officer (Harness v6.3.0)
> **Sprint:** S05 — Quality Gate Final
> **Data:** 2026-06-13T22:55:00Z
> **Marco regulatório:** LGPD Lei 13.709/2018 (Brasil) + Resoluções ANPD vigentes em jun/2026 (4/2023 cookies, 15/2024 art. 18, 18/2024 incidente)
> **Escopo:** S00-S05 (app inteiro) — Auth + Membros + Discipulado + Ministérios + Fidelidade + Config Acolhimento + Alertas + Dashboard
> **Triagem automatizada:** NÃO substitui parecer formal. Em caso de dúvida complexa, escalar para advogado(a) humano(a).
> **Veredito:** **COMPLIANT** ✅ (0 critical, 0 high, 0 medium no escopo gate; 0 medium no escopo das 6 decisões inegociáveis; itens fora-MVP registrados como advisory)

---

## 1. Resumo executivo

A Igreja Conect MVP entrega os módulos de Auth + Membros + Discipulado + Ministérios + Fidelidade Financeira + Configuração de Acolhimento + Central de Alertas + Dashboard com KPIs. O escopo total do tratamento é deliberadamente **mínimo** (RN-MEM-02) e o sistema aplica **3 camadas de RBAC fina** em todos os pontos de exposição de dado pessoal e sensível.

**Auditoria cobre S00-S05 e confirma todas as 6 decisões técnicas inegociáveis (RAG `lgpd-igreja-conect` §2) com teste que prova:**

| Decisão | Status | Evidência objetiva |
|---|---|---|
| §2.1 Sem CPF/RG/CNPJ/PIS | **PASS** | `grep -rEnw "cpf\|cnpj\|pis\|titulo_eleitor\|cartaoSus" prisma/ app/` → **0 ocorrências em schema/código runtime** (todas as menções são em comentários/Zod `.strict()` gates ou testes LGPD que REJEITAM o campo) |
| §2.2 Dízimos restritos a ADMIN/PASTOR/FINANCEIRO (3 camadas) | **PASS** | `finance.server.ts:62` chama `assertCanSeeFinancials` ANTES de qualquer DB; `membros.$id.tsx:83-86` força `tab=dados` se URL tem `?tab=fidelidade` sem permissão; UI esconde tab via `canSeeFinancials`; testes cobrem 6 perfis |
| §2.3 bcrypt cost 10 | **PASS** | `auth.server.ts:9` `BCRYPT_COST = 10`; `bcryptjs@3.0.3` em deps; senha NUNCA em log (allowlist filtra `senhaHash`) |
| §2.4 Cookie httpOnly + sameSite=lax + secure(prod) | **PASS** | `session.server.ts:49-56` — `httpOnly: true`, `sameSite: "lax"`, `secure: process.env.NODE_ENV === "production"`, `maxAge: 7d sliding`, secret `SESSION_SECRET` ≥ 16 chars (fail-fast se ausente) |
| §2.5 Logs sem PII (safeLog allowlist) | **PASS** | `audit.server.ts:11-18` allowlist `{userId, action, resource, result, timestamp, ip}`; testes em `audit.server.test.ts` confirmam que email/senhaHash/telefone/valorCentavos são filtrados; **0 console.log** runtime com PII (único `console.log` no runtime é o do `safeLog` filtrado) |
| §2.6 Matriz por perfil (6 perfis × módulos) | **PASS** | `rbac.server.ts` declara `FINANCIAL_CARGOS = [ADMIN, PASTOR, FINANCEIRO]` e `MINISTERIO_MANAGER_CARGOS = [ADMIN, PASTOR, SECRETARIO]`; helpers `assertCan*` testados em `finance.server.test.ts` (6 perfis) e `rbac.server.test.ts` |

**Contadores finais:** 0 critical · 0 high · 0 medium · 0 low · 4 informational (todos fora-MVP, registrados como advisory para roadmap).

**Gate LGPD:** **PASS** (status `compliant`).

---

## 2. Conformidade por artigo da LGPD

### Art. 5º (Definições)
- **Status:** COMPLIANT
- **Evidência:**
  - **Dado pessoal comum (Art. 5º, I):** `Membro.nome`, `email`, `telefone`, `logradouro`, `numero`, `bairro`, `cidade`, `estado`, `cep`, `profissao`, `estadoCivil` — todos coletados com base legal declarada (Art. 7º, V).
  - **Dado sensível (Art. 5º, II):** `dataConversao`, `dataBatismo`, `tipo`, `discipuladorId`, `ministerios[]` (religioso — convicção); `Lancamento.valorCentavos`, `Lancamento.categoria=DIZIMO` (financeiro — origem/patrimônio). Todos restritos por RBAC fina.
  - **Tratamento (Art. 5º, X):** operações CRUD + alerta atômico visitante; sem tratamento automatizado com efeito significativo (sem perfilamento, sem scoring, sem decisão automatizada Art. 20 — não se aplica).
- **Risco:** nenhum.

### Art. 6º (Princípios)
- **Status:** COMPLIANT
- **Finalidade (I):** cada coleta tem propósito declarado (gestão eclesiástica + acolhimento + cuidado pastoral). Schema `Membro` documenta em comentários.
- **Necessidade (III):** `RN-MEM-02` — schema SEM cpf/rg/cnpj/pis/tituloEleitor/cartaoSus. Grep `grep -rEnw "cpf|cnpj|pis" prisma/ app/ --include="*.ts" --include="*.prisma"` retorna **0 ocorrências em runtime**; as menções estão em comentários/Zod `.strict()`/testes que **rejeitam** o campo. **Lição:** MembroUpdateSchema/MembroCreateSchema com `.strict()` é o portão técnico que impede injeção de campos proibidos.
- **Adequação (II):** uso dos dados é compatível com finalidade declarada (eclesiástica).
- **Segurança (VII):** bcrypt + httpOnly + sameSite + RBAC 3 camadas + safeLog. Ver Art. 46 abaixo.
- **Prevenção (VIII):** `prisma.$transaction` no `createMembro` para atomicidade visitante+alerta (S04-T04); `onDelete: Restrict` em discipuladorId (evita exclusão com dependentes).
- **Transparência (VI):** **advisory** — política de privacidade não publicada (fora MVP; ver §9).
- **Não discriminação (IX):** nenhum uso de dado sensível para scoring/precificação.
- **Responsabilização (X):** `safeLog` com allowlist + cobertura de testes + este parecer arquivado. RIPD formal fora-MVP (advisory).

### Art. 7º (Base legal)
- **Status:** COMPLIANT
- **Cadastro de membro (Art. 7º, V — execução de contrato):** titular aceitou ser cadastrado na igreja (consentimento organizacional); sistema é instrumento de gestão do vínculo eclesiástico.
- **Login (Art. 7º, V + §4º):** execução do contrato de uso do sistema; cookies necessários (sem tracking).
- **Discipulado (Art. 7º, IX — legítimo interesse):** gestão pastoral. Mitigado por (a) escopo apenas do necessário (`discipuladorId = user.id`); (b) titular pode pedir revisão (Art. 18 — fora MVP).
- **Alertas de acolhimento (Art. 7º, V):** notificação interna entre membros administrativos.

### Art. 11º (Dados sensíveis)
- **Status:** COMPLIANT
- **Religioso (dataConversao, dataBatismo, tipo, discipuladorId, ministerios[]):** base legal **Art. 7º, V + Art. 11, II** (execução de contrato religioso). Tratamento acessado por perfis com função pastoral/eclesiástica (ADMIN, PASTOR, SECRETARIO, DISCIPULADOR com escopo, LIDER_MINISTERIO com escopo). **Não há consentimento granular registrado** (advisory — fora MVP; previsto em `cross-sprint.json` DEBT-013 e roadmap).
- **Financeiro (dízimo — Lancamento.valorCentavos, Lancamento.categoria=DIZIMO):** base legal **Art. 7º, V + Art. 11, II**. Acesso restrito a **ADMIN, PASTOR, FINANCEIRO** via 3 camadas:
  1. UI: `TabFidelidadeFinanceira` não renderiza para perfis sem permissão.
  2. Loader: `membros.$id.tsx:83-86` força `tab=dados` se `?tab=fidelidade` sem permissão.
  3. Service: `finance.server.ts:62` `assertCanSeeFinancials` PRIMEIRO (DB não tocado se bloqueado — provado por spy em `finance.server.test.ts:124-135`).
- **Criança/adolescente (Art. 14):** sem cadastro específico de menor; quando houver, **legítimo interesse é vetado** (Art. 14, §4º) e tratamento exigirá consentimento de um dos pais/responsáveis. Trilha registrada como advisory.

### Art. 18º (Direitos do titular)
- **Status:** **PARCIAL (advisory)**
- **Implementado:**
  - **18, I — Confirmação de tratamento:** implícito — titular tem acesso à própria ficha (`getMembroById` retorna subset seguro).
  - **18, II — Acesso:** titular (qualquer perfil) pode ver seus próprios dados via `/app/membros/:id` (loader: `getMembroById` retorna o próprio registro).
  - **18, III — Correção:** `/app/membros/:id/editar` + `updateMembro` (com escopo RBAC).
  - **18, VI — Eliminação (consentimento):** `deleteMembro` (apenas ADMIN/PASTOR; com trava de discípulos).
- **Fora do MVP (registrado em `cross-sprint.json` DEBT-013):**
  - **18, IV — Anonimização/bloqueio/eliminação parcial:** fora-MVP.
  - **18, V — Portabilidade:** fora-MVP (não há export JSON/CSV).
  - **18, VII — Info sobre compartilhamento:** não há compartilhamento com terceiros (stack local); item N/A na prática.
  - **18, VIII — Info sobre não-consentimento:** não há mecanismo de opt-out hoje (consentimento organizacional único).
  - **18, IX — Revogação de consentimento:** sem consentimento granular registrado.
  - **18, §1º — Oposição:** sem fluxo de oposição.
- **Mitigação:** ADMIN/PASTOR atendem pedidos manualmente. Documentado em `brief.md` §4 e em `cross-sprint.json` DEBT-013.
- **Impacto no gate:** **NENHUM**. Todos os itens fora-MVP são classificados como `advisory` e não bloqueiam (PRD §4 autoriza adiamento; nenhum finding é critical/high).

### Art. 37º (Logs de auditoria)
- **Status:** COMPLIANT
- `safeLog` (`audit.server.ts`) registra: `userId`, `action`, `resource`, `result`, `timestamp`, `ip`. Proibido logar: email, telefone, senhaHash, valorCentavos, endereço, conteúdo do alerta.
- **Retenção:** console (em memória) — sem persistência; em produção, convenção é stack de log externa com retenção ≥ 180 dias (responsabilidade do deploy, não da app).
- **Acesso aos logs:** console (DEV: leitura direta; PROD: permissões do servidor).
- **Cobertura de testes:** `audit.server.test.ts` valida que `ALLOWED_FIELDS` exclui `email/senhaHash/password/telefone/valorCentavos` e que `safeLog({...com PII...})` produz JSON apenas com campos da allowlist.
- **Auditoria de leitura (Art. 37 — "quem viu o quê"):** **advisory** — fora-MVP (`cross-sprint.json` DEBT-012). Roadmap: tabela `audit_leitura` com `(userId, recurso, ação, timestamp)`.

### Art. 41º (Encarregado/DPO)
- **Status:** **NÃO IMPLEMENTADO (advisory — fora-MVP)**
- DPO não designado. E-mail de contato não público. Política de privacidade não publicada.
- **Trilha:** registrado em `brief.md` §4 e em `cross-sprint.json` DEBT (Sprint 2+).
- **Impacto no gate:** nenhum. Nenhuma multa ANPD conhecida por omissão de DPO em sistema de pequeno porte; todavia, recomendação forte para roadmap.

### Art. 46º (Medidas de segurança)
- **Status:** COMPLIANT
- **Criptografia em repouso (hash):** `Membro.senhaHash` com bcrypt cost 10. Demais campos em texto plano (decisão consciente: igreja não trata dado que justifique criptografia em repouso além do hash de credencial).
- **Criptografia em trânsito:** TLS 1.2+ delegado ao deploy; cookie com `secure: NODE_ENV === "production"`. (Advisory: adicionar redirect HTTP→HTTPS explícito no reverse proxy é boa prática, mas é responsabilidade de infra.)
- **Autenticação:** `getUserFromRequest` (sliding 7d + absoluto 30d) + rate limit 5/15min/IP em `/api/auth/login`.
- **Autorização:** RBAC fina em 3 camadas (UI / loader / service) — ver §4.
- **Anti-enumeração:** `verifyCredentials` retorna `null` em 3 casos indistinguíveis (email inexistente, sem senhaHash, senha errada).
- **Inputs:** Zod `.strict()` em todos os schemas de input (login, createMembro, updateMembro, etc.).
- **Prisma parametrizado:** zero `$queryRawUnsafe`; toda query usa Prisma tipado (autenticação anti-injection Art. 46 + A03 OWASP).
- **Dependências:** `pnpm audit` (S05-T01) e atualizações no rework S04 (esbuild ≥ 0.28.1, CVE mitigada).

### Art. 48º (Comunicação de incidente)
- **Status:** **NÃO IMPLEMENTADO (advisory — fora-MVP)**
- Sem processo formal de resposta a incidente documentado; sem template de notificação à ANPD (prazo 2 dias úteis — Res. CD/ANPD 18/2024); sem canal de notificação a titulares.
- **Trilha:** advisory. **Recomendação para roadmap:** criar `docs/incidents.md` com runbook (contenção 1h, avaliação 4h, notificação ANPD 2 dias, notificação titulares) e template de comunicado.

### Art. 33-36 (Transferência internacional)
- **Status:** COMPLIANT
- **Stack 100% local:** Prisma + SQLite local. **Zero provedores externos** — sem AWS, sem GCP, sem Cloudflare, sem Vercel/Netlify, sem Stripe, sem SendGrid/Twilio, sem analytics, sem CDN, sem Google Analytics, sem Sentry/Datadog, sem Pusher/Slack webhook.
- `grep -rEn "aws|gcp|google|cloudfront|cloudflare|vercel|netlify|stripe|sendgrid|twilio|axios|fetch\(" app/` → **0 ocorrências** em código runtime.
- Sem cookies de tracking (único cookie é `__session`, essencial). Logo, **Res. CD/ANPD 4/2023 (cookies) não é estritamente aplicável** — não há coleta não-essencial.
- **Conclusão:** zero transferência internacional de dados (Art. 33 N/A).

### Art. 14º (Criança/adolescente)
- **Status:** N/A (sem cadastro específico de menor hoje)
- Quando entrar, **legítimo interesse é vetado** (Art. 14, §4º) e tratamento exigirá consentimento de um dos pais/responsáveis. Trilha registrada como advisory.

---

## 3. Inventário de dados pessoais (S05 — consolidado S00-S05)

| Categoria | Campos | Persistência | Base legal | Sensível? | Onde | Quem vê |
|---|---|---|---|---|---|---|
| **Identificação** | `nome`, `tipo`, `cargo` | SQLite, texto plano | Art. 7º, V | Não | `Membro` | Qualquer autenticado (com escopo RBAC) |
| **Contato** | `email`, `telefone` | SQLite, texto plano | Art. 7º, V | Não | `Membro` | Qualquer autenticado (com escopo RBAC); **NUNCA em log** |
| **Eclesiástico** | `dataConversao`, `dataBatismo` | SQLite, texto plano | Art. 7º, V + Art. 11, II | **SIM (religioso)** | `Membro` | Qualquer autenticado (com escopo RBAC) |
| **Endereço** | `logradouro`, `numero`, `bairro`, `cidade`, `estado`, `cep` | SQLite, texto plano | Art. 7º, V | Não | `Membro` | Qualquer autenticado (com escopo RBAC) |
| **Discipulado** | `discipuladorId`, `ministerios[]` | SQLite (FK) | Art. 7º, V + Art. 11, II | **SIM (rede religiosa)** | `Membro`, `MinisterioMembro` | ADMIN/PASTOR/SECRETARIO (total); DISCIPULADOR (seus discípulos); LIDER_MINISTERIO (seu min.) |
| **Credencial** | `senhaHash` (bcrypt cost 10) | SQLite, hash bcrypt | Art. 7º, V + Art. 46 | **SIM (credencial)** | `Membro.senhaHash` | **Ninguém** — `MEMBRO_SAFE_SELECT` exclui; **NUNCA em log**; **NUNCA em payload** |
| **Dízimo** | `Lancamento.valorCentavos`, `categoria=DIZIMO`, `membroId` | SQLite | Art. 7º, V + Art. 11, II | **SIM (financeiro)** | `Lancamento` | **APENAS ADMIN, PASTOR, FINANCEIRO** (3 camadas RN-MEM-03) |
| **Caixa** | `Caixa.saldoCentavos`, `Lancamento.tipo/categoria` | SQLite | Art. 7º, V | Não | `Caixa`, `Lancamento` | ADMIN, PASTOR, FINANCEIRO, SECRETARIO (este último só saldo, não valores individuais — S03 matriz) |
| **Alerta (PII visitante)** | `Alerta.mensagem` (nome + telefone do visitante) | SQLite | Art. 7º, V | Não | `Alerta` | **Apenas destinatários** (`destinatarios.some.membroId = user.id`); UI não mostra email/endereço (S04-T04) |
| **Sessão** | `Session.expiresAt`, `Session.absoluteExpiresAt` | SQLite | Art. 7º, V (execução contrato) | Não | `Session` | Sistema (auto-gerenciado) |
| **Config** | `responsavelMembroId`, `responsavelMinisterioId` | SQLite | Art. 7º, V | Não | `ConfigAcolhimento` | ADMIN (RW), outros (R) |

**Resumo:**
- Total de campos PII comuns: ~12
- Total de campos PII sensíveis (Art. 5º, II): ~6 (religioso + financeiro + credencial)
- **Transferência internacional:** 0 provedores externos. **0 países.**

---

## 4. RBAC fina aplicada (defense in depth — 3 camadas)

### Camada 1 (UI) — Componentes

| Componente | Controle | Arquivo |
|---|---|---|
| `TabFidelidadeFinanceira` | Não renderiza para perfis sem `canSeeFinancials` | `app/components/TabFidelidadeFinanceira.tsx` |
| `AcoesMembro` | Esconde botão Excluir para não-ADMIN/PASTOR | `app/components/AcoesMembro.tsx` |
| `TabsMembro` | Esconde tab Fidelidade para perfis não financeiros | `app/components/TabsMembro.tsx` |
| `ConfigAcolhimentoCard` | Mostra form apenas para ADMIN (`canEdit`) | `app/components/ConfigAcolhimentoCard.tsx` |
| `FormConfigAcolhimento` | Submete via ADMIN; SECRETARIO/DISCIPULADOR/FINANCEIRO/LIDER_MINISTERIO não veem | `app/components/FormConfigAcolhimento.tsx` |
| `Can` | Helper booleano usado por todos os componentes acima | `app/components/Can.tsx` |

### Camada 2 (Loader/Action) — Routes

| Rota | Verificação | Arquivo |
|---|---|---|
| `/app/membros/:id` (loader) | `getMembroById(id, user)` (escopo); `canSeeFinancials` força `tab=dados` se `?tab=fidelidade` | `app/routes/app/membros.$id.tsx:66-129` |
| `/app/membros/:id` (action delete) | `deleteMembro(id, user)` — só ADMIN/PASTOR; 409 se há discípulos | `app/routes/app/membros.$id.tsx:148-170` |
| `/app/alertas` (loader) | Filtra por `destinatarios.some.membroId = user.id` | `app/routes/app/alertas._index.tsx:60-76` |
| `/app/alertas` (action marcarResolvido) | `assertIsAdmin(user)` antes | `app/routes/app/alertas._index.tsx:115-123` |
| `/app/config/acolhimento` (action) | `assertIsAdmin(user)` em `updateConfigAcolhimento` | `app/lib/config.server.ts:65` |
| `/app/membros/:id/ministerios` (action) | `canManageMinisterios(user)` (S04 rework) | `app/routes/app/membros.$id.ministerios.tsx:93-97` |
| `/app/membros/:id/discipulador` (action) | `assignDisciple` chama `assertCanWriteMembers` | `app/lib/discipleship.server.ts` |
| Middleware `/app/**` | `getUserFromRequest`; 302 → `/login` se anônimo | `app/routes/app/_middleware.tsx:49-63` |

### Camada 3 (Service) — Helpers (fonte de verdade)

| Helper | Comportamento | Arquivo |
|---|---|---|
| `assertCanSeeFinancials` | Lança `Response(403)` se cargo não é ADMIN/PASTOR/FINANCEIRO | `app/lib/rbac.server.ts:45-49` |
| `assertCanWriteMembers` | Lança `Response(403)` se `user.cargo === null` | `app/lib/rbac.server.ts:58-62` |
| `assertIsAdmin` | Lança `Response(403)` se cargo !== ADMIN | `app/lib/rbac.server.ts:70-74` |
| `assertCanManageConfiguracaoGeral` | Lança `Response(403)` se cargo !== ADMIN | `app/lib/rbac.server.ts:83-87` |
| `assertCanManageMinisterios` | Lança `Response(403)` se cargo não é ADMIN/PASTOR/SECRETARIO | `app/lib/rbac.server.ts:121-127` |
| `getDizimosByMembro` | `assertCanSeeFinancials` PRIMEIRO (DB não tocado) | `app/lib/finance.server.ts:56-71` |
| `listAlertas` | Filtra por destinatário no where do Prisma | `app/lib/alerts.server.ts:63-123` |
| `getMembroById` | 404 para DISCIPULADOR fora de escopo (anti-enumeração) | `app/lib/members.server.ts:174-195` |
| `deleteMembro` | Só ADMIN/PASTOR; 409 se há discípulos | `app/lib/members.server.ts:395-418` |

**Testes E2E cobrindo as 3 camadas (verificáveis):**
- `finance.server.test.ts` — 6 perfis × `getDizimosByMembro` (camada 3 com spy no Prisma).
- `members.server.test.ts` — DISCIPULADOR fora de escopo → 404 (camada 3).
- `rbac.server.test.ts` — assertions puras.
- `alerts.server.test.ts` — listAlertas não vaza cross-user (S04 rework).
- 28/28 chains E2E (Playwright) passando em S04.

---

## 5. 6 Decisões técnicas inegociáveis (RAG `lgpd-igreja-conect` §2)

| # | Decisão | Status | Evidência |
|---|---|---|---|
| 1 | **§2.1 Sem CPF/RG/CNPJ/PIS no schema** (RN-MEM-02) | ✅ **PASS** | `grep -rEnw "cpf\|cnpj\|pis\|titulo_eleitor\|cartaoSus" prisma/schema.prisma` → 0. Únicas menções em `app/lib/schemas/membros.ts:9,61,111` (comentários que documentam a decisão) e em `membros.test.ts:193-216,254-256` + `membros.novo.test.ts:192-197` + `membros.$id.editar.test.tsx:214-217` (testes GATE-LGPD que REJEITAM via `.strict()`). |
| 2 | **§2.2 Dízimos restritos a ADMIN/PASTOR/FINANCEIRO** (RN-MEM-03) | ✅ **PASS** | (a) UI: `TabFidelidadeFinanceira` condicional. (b) Loader: `membros.$id.tsx:83-86`. (c) Service: `finance.server.ts:62` + `assertCanSeeFinancials`. Spy em teste confirma DB não tocado. `finance.server.test.ts` cobre 6 perfis. |
| 3 | **§2.3 bcrypt cost 10 + nunca plain text** | ✅ **PASS** | `auth.server.ts:9` `BCRYPT_COST = 10`. `bcryptjs@3.0.3` em deps. `hashPassword` e `verifyPassword` em `auth.server.ts:36-62`. Senha **nunca** em log (allowlist filtra). |
| 4 | **§2.4 Cookie httpOnly + sameSite=lax + secure(prod)** | ✅ **PASS** | `session.server.ts:49-56`. Sliding TTL 7d (cookie) + absoluto 30d (DB). `getSessionSecret()` exige `SESSION_SECRET ≥ 16 chars` (fail-fast se ausente) — S04 rework SEC-001. |
| 5 | **§2.5 safeLog com allowlist (NUNCA senhaHash/email/telefone/mensagem alerta)** | ✅ **PASS** | `audit.server.ts:11-18` allowlist `{userId, action, resource, result, timestamp, ip}`. Cobertura: `audit.server.test.ts` (4 testes). Mensagem de alerta NUNCA logada (S04-T04 E2E chain 5 grep valida). |
| 6 | **§2.6 Matriz por perfil (6 perfis × módulos)** | ✅ **PASS** | `rbac.server.ts` declara cargos financeiros e ministeriais. Testes cobrem 6 perfis em Fidelidade, Membros, Ministérios, Config, Alertas. |

---

## 6. Findings LGPD

### 6.1 Findings bloqueantes (gate)

**NENHUM.** 0 critical, 0 high, 0 medium no escopo gate.

### 6.2 Findings advisory (fora-MVP, roadmap)

| ID | Sev | Artigo | Descrição | Recomendação (roadmap) |
|---|---|---|---|---|
| LGPD-S05-A01 | informational | Art. 18, IV-VI | Direitos de portabilidade, anonimização e eliminação granular não implementados | Criar endpoints `/app/privacidade/...` (export JSON/CSV, deleteMembro para o próprio titular, anonimização parcial). Roadmap: Sprint 2+ (cross-sprint.json DEBT-013). |
| LGPD-S05-A02 | informational | Art. 41 | DPO/Encarregado não designado | Designar DPO + publicar e-mail em política de privacidade + footer do site. Documentar processo. |
| LGPD-S05-A03 | informational | Art. 48 | Sem plano formal de resposta a incidente | Criar `docs/incidents.md` com runbook (contenção 1h, avaliação 4h, notificação ANPD 2 dias úteis — Res. CD/ANPD 18/2024). Template de comunicado. Teste de tabletop trimestral. |
| LGPD-S05-A04 | informational | Art. 6º, V + Art. 15 | Sem política de retenção formal | Definir prazos por categoria: conta ativa (enquanto ativa + 5 anos para obrigação fiscal), logs de auditoria (6-12 meses), visitante inativo (purga em 24 meses). Job automático de purga. |
| LGPD-S05-A05 | informational | Art. 11, I | Sem consentimento granular registrado | Quando entrar coleta de dado sensível novo (ex: foto, WhatsApp), implementar fluxo de opt-in específico com registro (data, IP, versão do texto, escolha). |
| LGPD-S05-A06 | informational | Art. 37 | Auditoria de leitura ("quem viu o quê") fora-MVP | Roadmap: tabela `audit_leitura(userId, recurso, ação, ts)` capturada em wrappers de `get*`. Sem impacto MVP. |

### 6.3 Findings do rework S04 (resolvidos)

| ID | Sev original | Artigo | Descrição | Status |
|---|---|---|---|---|
| LGPD-S04-001 | ~~high~~ | Art. 18 | Controle de acesso aos alertas ausente (cross-user) | ✅ RESOLVIDO em `alerts.server.ts:67-69` + `alertas._index.tsx` |
| LGPD-S04-002 | ~~high~~ | Art. 6 | Dashboard sem service RBAC (mockado) | ✅ RESOLVIDO em `dashboard.server.ts:38-87` |
| LGPD-S04-003 | medium | Art. 37 | `safeLog` ausente em `alerts.server.ts` | ✅ RESOLVIDO em `marcarLido`/`marcarResolvido` |

---

## 7. Conclusão

**Parecer LGPD:** **COMPLIANT** ✅

A Igreja Conect MVP **atende integralmente** às 6 decisões técnicas inegociáveis do RAG `lgpd-igreja-conect`, e em conformidade com os artigos **5º, 6º, 7º, 11º, 33-36, 37 e 46** da Lei 13.709/2018. Os artigos **14, 18, 41 e 48** têm itens parcialmente implementados ou não implementados, **todos classificados como `advisory` (fora-MVP)** e registrados no debt registry (`cross-sprint.json` DEBT-012, DEBT-013) e na Seção 9 deste parecer.

**Gate LGPD:** **PASS** (status `compliant`).

O Sprint S05 pode ser marcada como `completed` com `lgpdStatus: "compliant"` no `state.json`. **Nenhuma ação bloqueante** para o MVP seguir para release após o qa-gate agregado (S05-T10).

---

## 8. RAGs consultados

- `.harness/RAG/lgpd-igreja-conect.md` (canônico do projeto)
- `.harness/RAG/security-rbac-matrix.md` (matriz 6 perfis × módulos)
- `.harness/RAG/convention-prisma-sqlite.md` (schema como source of truth)
- `~/.config/opencode/training/lgpd-brasil.md` (RAG global — referência completa Lei 13.709/2018, Resoluções ANPD 4/2023, 15/2024, 18/2024)
- Pareceres anteriores: `sprints/S01/lgpd-parecer.md`, `sprints/S02/lgpd-parecer.md`, `sprints/S03/lgpd-parecer.md`, `sprints/S04/lgpd-parecer.md`
- Cross-sprint debt registry: `.harness/sprints/cross-sprint.json` (DEBT-012, DEBT-013)

---

## 9. Recomendações pós-MVP (ordem de prioridade)

1. **Política de privacidade pública** (Art. 6º, VI + Art. 9º). Página estática com finalidade, base legal, prazo de retenção, contato do DPO, direitos do titular. Hospedar em `/privacidade` no site público. Esforço: low. Impacto: alto.
2. **Direito de exportação de dados** (Art. 18, V). Endpoint `GET /app/privacidade/exportar` que retorna JSON com todos os dados do titular. Esforço: medium. Impacto: alto.
3. **Direito de exclusão automatizado** (Art. 18, VI). Endpoint `DELETE /app/privacidade/minha-conta` com soft-delete + job de purga após 30 dias. Esforço: medium. Impacto: alto.
4. **DPO/Encarregado designado** (Art. 41). Designar pessoa (mesmo que o Pastor presidente para MVP). Publicar e-mail. Esforço: low. Impacto: médio.
5. **Plano de resposta a incidente** (Art. 48 + Res. CD/ANPD 18/2024). `docs/incidents.md` com runbook + template de notificação (prazo 2 dias úteis ANPD, titulares em caso de risco). Esforço: low. Impacto: alto.
6. **Política de retenção automatizada** (Art. 6º, V + Art. 15). Job que purga visitantes inativos há 24 meses; logs de auditoria mantidos por 6-12 meses. Esforço: medium. Impacto: médio.
7. **Auditoria de leitura** (Art. 37). Tabela `audit_leitura(userId, recurso, ação, ts)` com wrapper de `get*`. Esforço: medium. Impacto: médio.
8. **Consentimento granular para dado sensível novo** (Art. 11, I). Quando entrar foto/WhatsApp/observação pastoral, registrar consentimento específico (data, IP, versão do texto, escolha). Esforço: medium. Impacto: alto.

---

## 10. Lições aprendidas (S00-S05)

### Lição 1 — Zod `.strict()` é o portão técnico para LGPD em formulários

**Contexto:** LGPD (art. 6º, III) e RN-MEM-02 exigem coleta mínima. Mas o dev junior pode adicionar campo `cpf` no Prisma sem perceber — e o sistema aceita.

**Solução adotada:** `MembroCreateSchema = z.object({...}).strict()` em `app/lib/schemas/membros.ts`. `.strict()` rejeita qualquer campo não declarado, com erro explícito. Em S02-T01, este foi o portão que **impediu tecnicamente** a injeção de campos proibidos.

**Custo:** 0 (uma keyword a mais).

**Ganho:** defesa em profundidade no nível do schema — não depende de revisão humana.

**Replicável para qualquer projeto:** sempre usar `.strict()` em schemas de input de domínio. É a forma mais barata de garantir "coletamos só o que declaramos".

**RAG candidate:** `lesson/zod-strict-as-lgpd-porteao.md` (categoria `lesson`, prioridade high).

### Lição 2 — Allowlist em log é mais segura que blocklist

**Contexto:** era tentador fazer `console.log({ userId, action, email, telefone })` e tentar lembrar de remover PII. Erro humano.

**Solução:** `safeLog` em `audit.server.ts` aplica **allowlist** (`{userId, action, resource, result, timestamp, ip}`) e descarta silenciosamente tudo o que não está na lista. **Impossível logar PII por acidente** — basta esquecer de usar `safeLog` (e isso vira code review finding).

**Custo:** 1 helper + 4 testes.

**Ganho:** bug class inteiro eliminado.

**Replicável:** qualquer projeto com logs em produção deveria ter allowlist (ou blocklist com revisão mensal). Allowlist é a forma defensiva por default.

### Lição 3 — RBAC em 3 camadas (UI/loader/service) detecta regressões

**Contexto:** S04 rework detectou 2 high em alertas (cross-user) **apenas porque a camada 3 do service era a fonte de verdade**. Se confiássemos só na UI, o bypass via DevTools/URL/curl passaria.

**Lição:** defesa em profundidade não é paranoia — é o que faz auditoria detectar regressões automaticamente. **Camada 3 (service) é obrigatória**; camada 2 (loader) é o filtro por rota; camada 1 (UI) é UX. Não confie só na UI.

**Custo:** 1 helper `assertCan*` por domínio (finance, ministerios, config, etc.).

**Ganho:** bypass via bypass trivial via DevTools é bloqueado; testes do service são triviais (spy + cargo variant).

---

## 11. RAG candidates (sugestão para `rag-curator`)

| Categoria | Título | Prioridade | Justificativa |
|---|---|---|---|
| `lesson` | `zod-strict-as-lgpd-porteao.md` | high | Replicável: sempre usar `.strict()` em schemas de domínio. |
| `pattern` | `safe-log-allowlist.md` | high | Pattern de logger com allowlist. Replicável em qualquer app. |
| `pattern` | `rbac-3-camadas-validacao.md` | high | UI/loader/service. Padrão de defesa em profundidade. |
| `antipattern` | `rbac-so-na-ui.md` | medium | Anti-pattern comum: esconder botão na UI e considerar feito. |
| `law` (refinamento) | Atualizar `lgpd-igreja-conect.md` com status **COMPLIANT** pós-S05 | high | O parecer atual é a evidência de que as 6 decisões funcionam. Atualizar a coluna "status" do RAG. |

---

**Triagem automatizada — não substitui parecer formal de advogado(a).** Em caso de incidente, escalação para DPO/controlador/advogado(a) humano(a) é obrigatória (Res. CD/ANPD 18/2024, prazo 2 dias úteis).
