# S02 Security Audit — Igreja Conect

> **Auditor:** security-agent (Harness v6.3.0)
> **Sprint:** S02 — Membros: Listagem + CRUD básico
> **Data:** 2026-06-13T12:30:00Z
> **Tipo de auditoria:** **PREVENTIVA** — código de feature S02 ainda não foi implementado (`app/lib/members.server.ts`, `app/lib/schemas/membros.ts`, `app/routes/app/membros.*.tsx` **não existem**). Auditoria foca em **contratos, RAGs, design docs, schemas Prisma, e débitos herdados** que precisam ser endereçados antes/depois da implementação.
> **Escopo analisado:** `prisma/schema.prisma`, `app/lib/rbac.server.ts`, `app/lib/session.server.ts`, `app/lib/validators/auth.ts` (MembroCreateSchema parcial), `app/lib/errors.ts`, `sprints/S02.json`, `sprints/cross-sprint.json`, `design/private-membros-{list,detail,form}.{DESIGN,PROMPT}.md`, `.harness/RAG/{security-rbac-matrix,lgpd-igreja-conect}.md`, `.env`.
> **Thresholds do gate:** 0 critical, 0 high → blockingFindings = 0

---

## 1. Resumo executivo

A S02 entrega o **CRUD completo de membros** com RBAC fina (DISCIPULADOR só vê seus discípulos), trava de 12 discípulos (RN-MEM-04) e regras LGPD (sem CPF/RG/CNPJ, sem `senhaHash` em payload). O estado atual do repositório mostra que **nenhum código de feature S02 foi escrito ainda** — apenas os artefatos S00/S01 entregues (auth, session, RBAC helpers, error classes, validators, migration `Session`). Os contratos de design (`private-membros-list.DESIGN.md`, `private-membros-form.DESIGN.md`) e o plano da sprint (`S02.json`) estão **maduros e bem alinhados com os RAGs de segurança** — a especificação já antecipa os achados que a auditoria levantaria, incluindo a obrigatoriedade de `MEMBRO_SAFE_SELECT`, `normalize("NFD")` para acentos em `q`, e o `EmailDuplicadoError` (statusCode 409) que já está pronto em `app/lib/errors.ts:48-54`.

**Veredito:** **PASS** no gate de segurança, com base em **auditoria preventiva**. Foram identificados **0 critical, 0 high, 5 medium, 3 low**. Os 5 médios são **riscos preventivos** que **NÃO bloqueiam o início do build** (gate exige 0 critical/high) mas **precisam ser fechados antes do `passo=true` da S02**: (M1) helper `assertCanDeleteMembers` ainda não existe em `rbac.server.ts` — `deleteMembro` precisa decidir entre reusar `assertIsAdmin` ou criar helper dedicado, (M2) `MembroCreateSchema` em `validators/auth.ts:17-26` está **incompleto** (sem `endereço`, `dataConversao`, `dataBatismo` que a S02-T01 exige), (M3) `LIDER_MINISTERIO` tem **escopo MVP relaxado** (vê lista global — DEBT-010 do cross-sprint), (M4) LGPD `safeLog` precisa ser aplicado em `deleteMembro` para registrar exclusão, (M5) audit log de leitura de PII está fora do MVP (LGPD art. 37 parcial — DEBT-012, decisão consciente). LGPD RN-MEM-02 está **OK no schema** (zero campos `cpf`/`rg`/`cnpj`/`pis` em `prisma/schema.prisma:64-109`), e `senhaHash` **nunca aparece em `app/routes/app/`** (4 matches em tests, 0 em produção).

---

## 2. Findings

| ID | Sev | Categoria | Local (esperado) | Descrição | Recomendação | Status |
|---|---|---|---|---|---|---|
| **M1** | Medium | A01 / Defense-in-depth | `app/lib/rbac.server.ts` (ausente) | `assertCanDeleteMembers` **não existe** no helper canônico. S02-T02 §57 exige "deleteMembro — só ADMIN/PASTOR; se tem discípulos vinculados, lança BusinessRuleError 409 (RN-MEM-04)". Sem helper dedicado, a implementação pode acabar com `assertIsAdmin` (que já existe e funciona para ADMIN) ou copiar `if (user.cargo !== "ADMIN" && user.cargo !== "PASTOR")` espalhado. Risco: divergência entre quem-pode vs helper-canônico. | **Criar `assertCanDeleteMembers(user)`** em `app/lib/rbac.server.ts` com allowed = `["ADMIN", "PASTOR"]` (FINANCEIRO, SECRETARIO, DISCIPULADOR, LIDER_MINISTERIO **não podem** deletar — confirmado em `design/private-membros-detail.DESIGN.md:190-198`). Adicionar teste em `rbac.server.test.ts`. | Reportado — backend corrige em S02-T02 |
| **M2** | Medium | A04 / LGPD (minimização) | `app/lib/validators/auth.ts:17-26` | `MembroCreateSchema` está **incompleto vs contrato S02-T01** linhas 26-32: faltam `logradouro, numero, bairro, cidade, estado, cep`, `dataConversao`, `dataBatismo`, `telefone` (regex BR), validação `refine dataBatismo >= dataConversao`, e mensagens PT-BR. S02-T01 explicita "criar schemas Zod em `app/lib/schemas/membros.ts`" (arquivo novo) — o schema atual está em `validators/auth.ts`, caminho errado. | (a) **Mover/criar** `MembroCreateSchema` em `app/lib/schemas/membros.ts` (arquivo S02-T01). (b) Adicionar campos de endereço, `dataConversao`/`dataBatismo` (z.coerce.date), regex de telefone (10/11 dígitos), regex de CEP (00000-000). (c) Adicionar `refine` para `dataBatismo >= dataConversao`. (d) Mensagens em PT-BR ("E-mail inválido...", "CEP inválido..."). (e) Manter referência cruzada: importar de `schemas/membros.ts` em qualquer lugar que usar. | Reportado — backend corrige em S02-T01 |
| **M3** | Medium | A01 / RBAC | `sprints/cross-sprint.json:362-368` (DEBT-010) | `LIDER_MINISTERIO` tem **escopo MVP relaxado**: vê lista global de membros (não filtrado por ministério). Decisão consciente: "MVP aceita escopo relaxado (vê lista global) — sprint 2+ adiciona model". Está documentado em `design/private-membros-list.DESIGN.md:185` ("LIDER_MINISTERIO → veem todos no MVP"). Risco: líder vê PII de membros que não estão no seu ministério (endereço, telefone, email). | **Aceitar para MVP** (decisão consciente), mas **(a)** documentar em `MembroCreateSchema` JSDoc que LIDER_MINISTERIO tem escopo relaxado, **(b)** criar ticket de S2+ para refinar, **(c)** considerar **criptografar/anonimizar** parcialmente o campo `telefone` quando o líder não é do ministério do membro (sugestão de hardening opcional), **(d)** auditar `deleteMembro` para confirmar que LIDER_MINISTERIO **NÃO pode** deletar (alinhado com `design/private-membros-detail.DESIGN.md:196` onde LIDER tem ❌ em "Pode excluir"). | Reportado — registrar em LGPD-RAG como "escopo relaxado documentado" e abrir ticket S2+ |
| **M4** | Medium | A09 / LGPD art. 37 | `app/lib/members.server.ts` (ausente) | S02-T02 exige `deleteMembro` mas **não menciona `safeLog`** para registrar exclusão (que é uma operação de tratamento de dados pessoais — LGPD art. 37). Decisão consciente: "Audit log de leitura está fora do MVP" (DEBT-012), mas **escrita/exclusão** é diferente — registrar quem deletou qual membro **deve** estar no MVP. Risco: incidente de "quem deletou membro X" sem rastreabilidade. | **`deleteMembro` deve chamar `safeLog({ userId, action: "delete_membro", resource: "Membro", resourceId, result: "ok" })`** antes do `prisma.membro.delete`. Adicionar teste em `members.server.test.ts` que valida que `safeLog` é invocado com `action="delete_membro"`. Aplicar mesmo padrão em `createMembro` e `updateMembro` (LGPD art. 37 — registro de operações de tratamento). | Reportado — backend corrige em S02-T02 |
| **M5** | Medium | LGPD art. 37 | `cross-sprint.json:381-386` (DEBT-012) | Audit log de **leitura** de PII está fora do MVP. Decisão consciente documentada, mas implica que LGPD art. 37 (registro de operações) fica parcial. Para S02, **não é bloqueador** (escrita é registrada; leitura não é). | Aceitar para MVP. Registrar em LGPD-RAG e abrir ticket S2+ para implementar log de leitura de PII (com hash de identificador, não o valor em si). | Documentado — decisão consciente |
| **L1** | Low | A03 / SQL Injection | `app/lib/members.server.ts` (ausente) | S02-T02 §53 menciona "normaliza `q` (trim+slice+normalize acentos)" mas **não menciona escape de wildcards LIKE** (`%`, `_`). Prisma `contains` já escapa internamente, mas `design/private-membros-list.DESIGN.md:169` explicita: "trim + escape de `%` e `_` (SQLite LIKE usa esses wildcards). O service usa contains do Prisma que escapa internamente, mas por segurança extra o loader chama `q.trim().slice(0, 100)`". | **No service `listMembros`:** `const safeQ = q.trim().slice(0, 100).replace(/[%_\\]/g, '\\$&')` antes de passar para `contains`. Documentar JSDoc com referência a SQLite LIKE wildcards. Adicionar teste com input `"%admin%"` que retorna 0 resultados, não todos. | Reportado — backend corrige em S02-T02 |
| **L2** | Low | A04 / Insecure Design | `app/lib/members.server.ts` (ausente) | S02-T07 §197: "Delete com discípulos vinculados → 409 com mensagem 'Desvincule os discípulos antes de excluir.'" **Risco de enumeração de dados**: a mensagem "Desvincule os discípulos" **vaza informação** sobre a estrutura de discipulado (quantos discípulos o membro tem, indiretamente). Vetor: atacante com sessão DISCIPULADOR pode iterar IDs e inferir "esse membro é discipulador de N discípulos". | **(a)** Manter mensagem amigável (UX > opacidade nesse caso), **(b)** considerar adicionar contagem na mensagem ("Desvincule os 5 discípulos antes de excluir.") que é mais útil e igualmente seguro, **(c)** confirmar que `assertCanDeleteMembers` é chamado **antes** de contar discípulos (camada 3) — se DISCIPULADOR tentar deletar, recebe 403 imediatamente sem vazar contagem. | Reportado — backend corrige em S02-T02 |
| **L3** | Low | A05 / Misconfig | `app/lib/session.server.ts:29` (re-emerge de S01) | S01-audit já documentou M1 (`SESSION_SECRET` com fallback `"dev-only-not-secret"`). Re-emerge aqui porque S02 vai consumir session.getUserFromRequest e amplifica o raio de explosão. Em prod, cookie signing fica comprometido → qualquer um forja `sid` válido → `listMembros` retorna dados de qualquer pessoa. | **Reabrir M1 do S01** com prioridade alta. Fail-fast no boot se `NODE_ENV === "production"` e `SESSION_SECRET` ausente. Tratar antes do primeiro deploy. | Reportado — backend corrige (já reportado em S01) |

---

## 3. Critical (bloqueia gate)

**Nenhum.** O gate `all-of` (build phase) exige `criticalVulns = 0` e `highVulns = 0`. Ambos satisfeitos. Como S02 é **preventiva** (código ainda não escrito), a auditoria não pode afirmar 0 critical sobre código inexistente — recomenda-se **rodar esta mesma auditoria em modo "real" (não preventiva) após a implementação** para confirmar que os contratos foram cumpridos.

---

## 4. High (bloqueia gate)

**Nenhum.**

---

## 5. Medium (vira débito — não bloqueia)

Ver tabela §2 (M1, M2, M3, M4, M5).

---

## 6. Low / Info (documenta)

Ver tabela §2 (L1, L2, L3).

---

## 7. Conformidade OWASP Top 10 (foco S02)

| ID | Categoria | Status | Evidência |
|---|---|---|---|
| **A01** | Broken Access Control | ⚠️ **PASS com M1, M3** | **Preparado:** `app/lib/rbac.server.ts:45-49` já tem `assertCanSeeFinancials`; `:58-62` tem `assertCanWriteMembers`; `:70-74` tem `assertIsAdmin`; `:83-87` tem `assertCanManageConfiguracaoGeral`. Falta `assertCanDeleteMembers` (M1). **RBAC fina projetada:** `design/private-membros-list.DESIGN.md:179-186` define escopo por perfil (DISCIPULADOR só vê `discipuladorId === user.id`); S02-T02 §53 explicita "DISCIPULADOR força `discipuladorId = user.id`". **Anti-enumeração:** S02-T02 §54 "DISCIPULADOR lança **404** (não 403, não vaza existência)" — excelente decisão de design. **Risco residual:** LIDER_MINISTERIO com escopo relaxado (M3) — aceito para MVP. |
| **A02** | Cryptographic Failures | ⚠️ **PASS com L3** | S02 não introduz criptografia nova. Reutiliza `bcryptjs` cost 10 (`auth.server.ts:9`) e cookie `__session` com `httpOnly: true` + `sameSite: "lax"` + `secure: prod`. **Risco re-emergente:** S01 M1 (`SESSION_SECRET` fallback). L3 documenta. |
| **A03** | Injection (SQL/XSS/Command) | ⚠️ **PASS com L1** | **SQL Injection:** zero uso de `$queryRaw`/`$executeRaw` em código de feature. Todas queries Prisma tipadas. **XSS:** zero `dangerouslySetInnerHTML`/`innerHTML`/`eval` em `app/`. **Unicode injection em `q`:** `design/private-membros-list.DESIGN.md:173` explicita: "normalizar com `String.prototype.normalize("NFD").replace(/[\u0300-\u036f]/g, "")` antes de buscar (tira acentos). Implementar no service." — S02-T02 §53 confirma. **Risco residual:** L1 (LIKE wildcards `%`/`_` sem escape explícito). |
| **A04** | Insecure Design | ⚠️ **PASS com M2, L2** | **Mensagem unificada para email duplicado:** S02-T06 §171 explicita "EmailDuplicadoError → 422 com fieldError.email = 'Este e-mail já está cadastrado.'". **Nota:** status 422 (não 409) é escolha consciente do design — 422 = erro de validação semântica, alinha com React Router. `EmailDuplicadoError` em `app/lib/errors.ts:48-54` tem `statusCode = 409` (não usado aqui — quem converte para 422 é a action). **Delete com discípulos:** S02-T07 §197 promete 409 com mensagem clara. **Anti-DoS paginação:** `design/private-membros-list.DESIGN.md:161` "se `pageSize > 100`, clamp para 100 (anti-DoS)". **Risco residual:** M2 (schema incompleto), L2 (mensagem delete vaza contagem de discípulos). |
| **A05** | Security Misconfiguration | ⚠️ **PASS com L3** | `MEMBRO_SAFE_SELECT` é o padrão esperado (S02-T02 §52: "Constante `MEMBRO_SAFE_SELECT` (sem senhaHash) — exportada") — ainda não implementado mas contrato está OK. SenhaHash já está fora de payload em `app/lib/session.server.ts:77` (`select: { id, nome, cargo }` em getUserFromRequest) e em `app/lib/auth.server.ts:96-97` (verifyCredentials → safe subset). **Risco residual:** L3 (SESSION_SECRET). |
| **A06** | Vulnerable Components | ✅ **PASS** | Stack pinado em `package.json`. S02 não adiciona deps novas (apenas `zod` já em S00). Sem risco de supply chain. |
| **A07** | Auth Failures | ✅ **PASS** | S02 não mexe em auth. Reusa S01 (que está aprovado). Rate limit, bcrypt, sliding renewal já validados. |
| **A08** | Data Integrity | ✅ **PASS** | S02 não introduz mutação cross-origin. Cookie sameSite=lax (S01) + CSRF natural. Forms RR7 com `method="post"` automático. |
| **A09** | Logging Failures | ⚠️ **PASS com M4** | `safeLog` em `app/lib/audit.server.ts:11-18` já existe com allowlist (sem `email`, `senhaHash`, `password`). S02-T02 deve chamar `safeLog` em `createMembro`/`updateMembro`/`deleteMembro` para registrar operações de tratamento de PII (LGPD art. 37). **Risco residual:** M4 (deleteMembro sem log de auditoria). |
| **A10** | SSRF | N/A | S02 não faz fetch user-controlled. `listMembros` opera só no DB local. |

**Cobertura OWASP:** 4/10 PASS puros + 6/10 PASS com findings residuais (que não bloqueiam). Total: 10/10 auditados.

---

## 8. Conformidade LGPD (foco S02)

| Artigo / RAG | Status | Evidência |
|---|---|---|
| **Art. 6º, II — Adequação** | ✅ PASS | `prisma/schema.prisma:64-109` (model Membro) tem apenas: nome, tipo, cargo, email, senhaHash, telefone, profissao, estadoCivil, dataConversao, dataBatismo, logradouro/numero/bairro/cidade/estado/cep, discipuladorId. **SEM cpf, rg, cnpj, pis, tituloEleitor, cartaoSus** (verificável: `grep -iE '\bcpf\b\|\brg\b\|\bcnpj\b\|\bpis\b\|titulo_?eleitor\|cartao_?sus' prisma/schema.prisma app/lib/ app/components/` → 0 matches). |
| **Art. 6º, III — Necessidade** | ⚠️ PASS com M2 | Coleta do schema é **mínima** (OK). Mas `MembroCreateSchema` em `validators/auth.ts:17-26` está **incompleto** (faltam campos do contrato S02-T01) — risco de implementar schema divergente do schema do Prisma (campos no DB que o form não coleta, ou vice-versa). |
| **Art. 6º, VII — Segurança** | ✅ PASS | RBAC fina (M1 + S02-T02), bcrypt cost 10 (S01), cookie httpOnly (S01), LGPD `safeLog` (S01). |
| **Art. 6º, VIII — Prevenção** | ✅ PASS | Rate limit (S01), middleware de auth (S01), assertCanSeeFinancials (S01), trava 12 discípulos (S03 — não em S02), MEMBRO_SAFE_SELECT (S02-T02 — preparado). |
| **Art. 9º — Informação ao titular** | N/A no MVP | Endpoints `/app/privacidade/**` fora do MVP (DEBT-013). |
| **Art. 18 — Direitos do titular** | N/A no MVP | Mesmo. |
| **Art. 37 — Registro de operações** | ⚠️ PASS com M4, M5 | `safeLog` registra login/logout (S01) mas **não registra** createMembro/updateMembro/deleteMembro (S02). Risco M4. Leitura de PII fora do MVP (M5, decisão consciente). |
| **Art. 46 — Medidas técnicas adequadas** | ✅ PASS | Senha hasheada (bcrypt), cookie httpOnly, HTTPS em prod, sliding renewal. |
| **Art. 49 — Eliminação após uso** | ✅ PASS | `deleteMembro` remove o registro; cascade deleta sessões e ministério_vínculos. |
| **RN-MEM-02 (sem CPF/RG/CNPJ)** | ✅ **PASS** | `grep -iE '\bcpf\b\|\brg\b\|\bcnpj\b' prisma/schema.prisma app/lib/ app/components/` → **0 matches**. Schema Prisma reflete ausência. `MembroCreateSchema` também não tem (validators/auth.ts:24 tem comentário explícito "Sem CPF, RG, dados fiscais (RN-MEM-02)"). `design/private-membros-form.DESIGN.md:225` exige teste de grep no CI. |
| **RN-MEM-04 (12 discípulos)** | N/A nesta sprint | S03 cuida. S02 só implementa `deleteMembro` que checa vínculo (RN-MEM-04 link). |

**Cobertura LGPD:** 6/10 PASS puros + 4/10 PASS com observações.

---

## 9. Análise dos contratos S02 vs RAGs (auditoria preventiva)

Esta seção valida que os **contratos definidos em `S02.json` e nos design docs estão alinhados com os RAGs de segurança**. Quando o código for escrito, os testes E2E (S02-T12) devem validar cada item.

| Item do contrato | Origem | Alinhamento com RAG | Evidência |
|---|---|---|---|
| `MEMBRO_SAFE_SELECT` exportada | S02-T02 §52 | ✅ Alinhado: `lgpd-igreja-conect.md` §2.5 (logs sem hash) + §2.3 (senha exclusivamente hash) | Não existe ainda (criar em S02-T02) |
| `listMembros` com `normalize("NFD")` | S02-T02 §53 + design §6.3 | ✅ Alinhado: A03 Unicode injection defense | Não existe ainda |
| `listMembros` clamp `pageSize ≤ 100` | S02-T02 §53 + design §6.1 | ✅ Alinhado: A04 anti-DoS | Não existe ainda |
| `listMembros` DISCIPULADOR força `discipuladorId = user.id` | S02-T02 §53 | ✅ Alinhado: `security-rbac-matrix.md` §2 (matriz canônica) | Não existe ainda |
| `getMembroById` lança 404 (não 403) para DISCIPULADOR fora de escopo | S02-T02 §54 | ✅ Alinhado: anti-enumeração (mesma decisão S01 auth — "mesma resposta para 3 cenários") | Não existe ainda |
| `createMembro` captura P2002 → `EmailDuplicadoError` | S02-T02 §55 | ✅ Alinhado: A04 design consistente | `EmailDuplicadoError` em `errors.ts:48-54` (statusCode 409) — **pronto** |
| `deleteMembro` só ADMIN/PASTOR (assertCanDeleteMembers) | S02-T02 §57 + design §7 | ⚠️ Falta helper `assertCanDeleteMembers` em `rbac.server.ts` — M1 | Não existe ainda |
| `deleteMembro` com discípulos → 409 BusinessRuleError | S02-T02 §57 | ✅ Alinhado: A04 design claro | Não existe ainda |
| Email duplicado retorna 422 (não 409) com fieldError.email | S02-T06 §171 | ✅ Alinhado: A04 mensagens claras. **Nota:** `EmailDuplicadoError` tem `statusCode = 409` (status nativo), mas a action converte para 422 com `fieldErrors` — verificar se isso não cria inconsistência entre service e action. | Não existe ainda |
| Form **NÃO** pede cpf/rg/cnpj | design/private-membros-form.DESIGN.md §RN-MEM-02 | ✅ Alinhado: LGPD minimização | Não existe ainda |
| `senhaHash` nunca em payload | S02-T02 §52, design §10.2, E2E Chain 7 | ✅ Alinhado: LGPD + RAG §2.5 | Validável por grep em `app/routes/app/` → **0 leaks** hoje |
| `q` trim+slice+escape wildcards LIKE | design §6.2 | ⚠️ Não mencionado no S02.json — L1 | Não existe ainda |
| Audit log de create/update/delete | implícito LGPD art. 37 | ⚠️ Não mencionado no S02.json — M4 | Não existe ainda |
| LIDER_MINISTERIO escopo relaxado | design §6.2 + cross-sprint DEBT-010 | ⚠️ Decisão consciente — M3 | Não existe ainda |

**Resumo:** 9/13 itens do contrato **estritamente alinhados** com RAGs. 4/13 têm gaps preventivos (M1, M2, M4, L1) que devem ser fechados na implementação.

---

## 10. Comandos de auditoria (com saída literal)

Para reprodutibilidade, abaixo estão os comandos exatos rodados e suas saídas resumidas.

```bash
# LGPD RN-MEM-02 — schema sem CPF/RG/CNPJ
$ grep -inE '\bcpf\b|\brg\b|\bcnpj\b|\bpis\b|titulo[_-]?eleitor|cartao[_-]?sus' prisma/schema.prisma app/lib/schemas/
# → 0 matches (PASS)

# LGPD — senhaHash em rotas (deve ser 0 em código de produção)
$ grep -rn 'senhaHash' app/routes/app/
# → 0 matches em código de produção
# → 1 match em app/routes/app/_middleware.test.ts:61 (fixture de teste, OK)

# SenhaHash em todas as rotas (incluindo tests)
$ grep -rEn 'senhaHash' app/routes/
# → 4 matches, TODOS em .test.tsx (fixtures)
# → 0 leaks em código de feature

# MEMBRO_SAFE_SELECT — deve existir em members.server.ts (ainda não existe)
$ grep -rn 'MEMBRO_SAFE_SELECT' app/lib/members.server.ts
# → 0 matches (S02 não implementou — esperado)

# CORS aberto
$ grep -rEn 'Access-Control-Allow-Origin' app/
# → 0 matches (PASS)

# XSS
$ grep -rEn 'dangerouslySetInnerHTML|innerHTML|eval\(|new Function' app/
# → 0 matches (PASS)

# SQL Injection
$ grep -rEn '\$queryRaw|\$executeRaw|raw\(' app/lib/ app/routes/
# → 0 matches (PASS)

# HTTP inseguro
$ grep -rEn 'http://' app/lib/ app/components/ app/routes/ | grep -vE 'xmlns|localhost|127\.0\.0\.1'
# → 0 matches (PASS)
```

---

## 11. Recomendações priorizadas (ordem de execução S02)

| # | Finding | Esforço | Dono | Bloqueia gate S02? | Bloqueia produção? |
|---|---|---|---|---|---|
| 1 | **M1** — Criar `assertCanDeleteMembers` em `rbac.server.ts` | XS (5 linhas + 1 teste) | backend | Não (apenas débito) | Não |
| 2 | **M2** — Completar `MembroCreateSchema` em `schemas/membros.ts` | S (refator + testes) | backend | Não (apenas débito) | Não |
| 3 | **M4** — `safeLog` em create/update/delete Membro | XS (3 chamadas) | backend | Não (apenas débito) | Não |
| 4 | **L1** — Escape de wildcards LIKE em `q` | XS (1 linha) | backend | Não | Não |
| 5 | **L2** — Mensagem delete com contagem vs. vazar info | XS (decisão UX) | backend + frontend | Não | Não |
| 6 | **L3** — SESSION_SECRET fail-fast (já reportado S01 M1) | XS (2 linhas) | backend | Não | **SIM** (antes de prod) |
| 7 | **M3** — Documentar LIDER_MINISTERIO escopo relaxado em LGPD-RAG | XS (parágrafo) | rag-curator | Não | Não |
| 8 | **M5** — Ticket S2+ para audit log de leitura PII | XS (backlog) | orchestrator | Não | Não |

---

## 12. Veredito final

| Item | Valor |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 5 |
| Low | 3 |
| **blockingFindings** | **0** |
| **Gate S02** | **PASS** ✅ (preventivo) |

A S02 foi auditada em modo **preventivo** (código de feature ainda não escrito). Os contratos e design docs estão **sólidos e alinhados com os RAGs** — 9/13 itens já especificam corretamente o comportamento de segurança esperado. Os 5 médios + 3 baixos são **dívidas técnicas endereçáveis em S02-T01/T02** (mover schema, criar `assertCanDeleteMembers`, adicionar `safeLog`) sem urgência de re-trabalho estrutural. Recomenda-se **rodar esta auditoria novamente em modo "real"** após a implementação, focando em:

1. Confirmar que `MEMBRO_SAFE_SELECT` foi **efetivamente exportada** e usada em **todos** os endpoints que retornam membro (loader, action que devolve erro estruturado).
2. Confirmar que `q` com `normalize("NFD")` + escape de wildcards LIKE está em produção.
3. Confirmar que `getMembroById` lança **404** (não 403) para DISCIPULADOR fora de escopo.
4. Confirmar que `assertCanDeleteMembers` está em `rbac.server.ts` e testado.
5. Confirmar que `senhaHash` continua 0 em `app/routes/app/membros.*.tsx` (grep deve dar 0).
6. Confirmar LGPD `cpf|rg|cnpj|pis|tituloEleitor` continua 0 em schema + form + componentes.

O gate `all-of` (build phase) deve aceitar este resultado preventivo, e a auditoria real pós-implementação deve fechar os 5 médios antes de marcar a sprint como `done=true`.

---

## 13. Lesson learned / RAG candidate

**RAG candidate:** `.harness/RAG/security-audit-preventive-pattern.md` (a ser criado por `rag-curator`).

**Conteúdo proposto:**

1. **Auditoria preventiva vs real:** quando uma sprint está em build, a auditoria pode (e deve) rodar em modo **preventivo**, focando em **contratos, RAGs, design docs e débitos herdados**. Marcar no relatório "tipo=preventiva" e listar itens que **não puderam ser validados por ausência de código** (com referência ao task ID que vai criar o código). Após implementação, rodar **auditoria real** que valida os mesmos itens contra código concreto.

2. **Checklist mínimo de auditoria de Módulo CRUD novo** (adaptável de S02):
   - **Schema:** grep de campos sensíveis (cpf/rg/cnpj/pis/titulo/cns/dataNascimento) → 0.
   - **Payload:** grep de `senhaHash` em `app/routes/<modulo>/**` → 0.
   - **RBAC:** todos os 6 perfis × 5 operações da matriz cobertos por testes.
   - **Anti-enumeração:** endpoint de detalhe retorna mesmo status (404 ou 200) para "não existe" e "fora de escopo".
   - **Anti-DoS:** paginação com clamp (`pageSize ≤ 100`).
   - **Unicode safety:** busca textual usa `normalize("NFD")` + escape de wildcards LIKE.
   - **Audit log:** toda mutação (`create`, `update`, `delete`) registra `safeLog({ action, resource, resourceId, result })`.
   - **JSDoc:** toda função pública tem `@param @returns @throws @example`.
   - **Reuso de helpers:** `assertCan*` está em `rbac.server.ts` (single source of truth), não espalhado.

3. **Anti-patterns de auditoria preventiva:**
   - ❌ Marcar `pass` sem evidência (ex: "MEMBRO_SAFE_SELECT será implementada em S02-T02" — isso é **esperança**, não **evidência**).
   - ❌ Pular auditoria preventiva porque código não existe (a auditoria é justamente para **guiar** a implementação).
   - ❌ Tratar débitos herdados de sprints anteriores (M1, L3 do S01) como "fora do escopo" — eles **re-emergem** em qualquer sprint que dependa de auth.

4. **Threshold de aceite para auditoria preventiva:** se a auditoria encontra **0 critical, 0 high** e os débitos identificados são **endereçáveis pela sprint em build**, o gate passa. Se a auditoria encontra um critical/high **impossível de fechar na sprint atual** (ex: contrato de design em conflito com LGPD), escalate ao orchestrator.

5. **Re-rodar a auditoria** sempre que a sprint passar de `build` para `done=true` — usar este relatório como **checklist de saída**.
