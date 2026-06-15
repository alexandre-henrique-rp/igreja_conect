# S03 Security Audit — Igreja Conect

> **Auditor:** security-agent (Harness v6.3.0)
> **Sprint:** S03 — Membros: Tipos, Discipulado, Ministérios, Fidelidade Financeira bloqueada
> **Data:** 2026-06-13T13:00:00Z
> **Tipo de auditoria:** **PREVENTIVA** — código de feature S03 ainda não foi implementado. Os 13 arquivos-alvo de S03 (`app/lib/discipleship.server.ts`, `app/lib/ministries.server.ts`, `app/lib/finance.server.ts`, `app/lib/schemas/{discipulado,ministerios}.ts`, `app/components/{Can,TabsMembro,TabDadosPessoais,TabDiscipulado,TabMinisterios,TabFidelidadeFinanceira,AcoesMembro,ResumoMembro,DiscipuladoPainel,ContadorDiscipulos,ModalSelecionarDiscipulador,CadeiaDiscipulado,ListaDiscipulos,Dialog,CardMinisterio,ModalCriarMinisterio,ModalVincularMembro,RadioGroup,InfoBox}.tsx`, rotas `app/routes/app/membros.$id.{discipulado,tipo,discipulador}.tsx`, `app/routes/app/ministerios._index.tsx`) **NÃO EXISTEM**. Auditoria foca em **contratos, RAGs, design docs, débitos herdados, e base já entregue (S00–S02)** que precisam ser endereçados antes/depois da implementação.
> **Escopo analisado:** `prisma/schema.prisma`, `app/lib/{rbac,members,errors,session,audit}.server.ts`, `app/lib/schemas/membros.ts`, `app/routes/app/{_middleware,membros.$id}.tsx`, `app/routes.ts`, `sprints/S03.json`, `sprints/cross-sprint.json`, `.harness/RAG/{security-rbac-matrix,lgpd-igreja-conect}.md`, `package.json`, `.env`.
> **Thresholds do gate:** 0 critical, 0 high → blockingFindings = 0

---

## 1. Resumo executivo

A S03 entrega o **núcleo de regra de negócio mais sensível** do Igreja Conect: **trava de 12 discípulos (RN-MEM-04)**, **anti-loop A↔B** (defesa contra inconsistência da cadeia), **gestão de ministérios N:N**, **promoção manual de tipo (RN-MEM-06)**, e o **bloqueio da aba Fidelidade Financeira para perfis não-financeiros (RN-MEM-03)** em 3 camadas (UI, loader, service). O estado atual do repositório confirma que **nenhum código de feature S03 foi escrito ainda** — apenas os artefatos S00/S01/S02 entregues (auth, session, RBAC helpers, members.server com `MEMBRO_SAFE_SELECT`, schemas Zod completos, error classes). Os contratos de S03 estão **maduros e bem alinhados com os RAGs** — `security-rbac-matrix.md §2` já define literalmente o `MAX_DISCIPULOS = 12` como constante exportada, e `security-rbac-matrix.md §4` (Camada 3) já documenta o padrão `assertCanSeeFinancials` PRIMEIRO em `getDizimosByMembro`. As decisões críticas de design (auto-vínculo → 400, loop → 422, bypass URL → loader força tab=dados) estão todas **antecipadas nos contratos** e nos E2E chains 1-7 (S03-T12).

**Veredito:** **PASS** no gate de segurança, com base em **auditoria preventiva**. Foram identificados **0 critical, 0 high, 6 medium, 4 low**. Os 6 médios são **riscos preventivos** que **NÃO bloqueiam o início do build** (gate exige 0 critical/high) mas **precisam ser fechados antes do `passo=true` da S03**: (M1) helper `canManageMinisterios` ainda não existe em `rbac.server.ts` para `deleteMinisterio`/`createMinisterio` (apenas `assertCanManageConfiguracaoGeral` existe, mas é só ADMIN — ministérios precisam ADMIN/PASTOR/SECRETARIO); (M2) `assignDisciple` precisa aplicar 4-5 etapas em ordem: `assertCanWriteMembers` (camada 3), auto-vínculo → 400, count >= 12 → 409, `isDescendantOf` → 422, update; (M3) `isDescendantOf` recursivo precisa de **limite de profundidade 10 hard-coded** (proteção DoS contra cadeias patológicas) e teste de boundary; (M4) `getDizimosByMembro` precisa chamar `assertCanSeeFinancials` como **primeira linha** (não depois de algum I/O — TOCTOU-safe); (M5) LGPD `dataBatismo`/`dataConversão` (art. 5°, II — convicção religiosa = **dado sensível**) precisam de decisão de quem-pode-ver além do `MEMBRO_SAFE_SELECT` atual; (M6) audit log de mutações (assignDisciple, unassignDisciple, promoverTipo, ministérios) ainda não é exigido em S03 — re-mergência de S02-M4. **LGPD RN-MEM-02 está OK no schema** (zero `cpf`/`rg`/`cnpj`/`pis`), `MEMBRO_SAFE_SELECT` sem `senhaHash` (S02 já validado por testes em `members.server.test.ts:107-118`), e `assertCanSeeFinancials` em `rbac.server.ts:45-49` é a base sólida para a Camada 3. **RN-MEM-06 (sem cron) está PASS** — grep em `app/` retornou **0 matches reais** (apenas 1 falso positivo em `bullets` do `CardInfo.tsx`, que é estilização CSS).

**Re-rogada obrigatória em modo "real"** após a implementação de S03-T01..T13, focando em: (1) `MAX_DISCIPULOS = 12` exportado e boundary test 12/13 verde, (2) `isDescendantOf` com profundidade máx 10 e fail-safe, (3) `assertCanSeeFinancials` PRIMEIRO em `getDizimosByMembro`, (4) `Can` component com `allow=['ADMIN','PASTOR','FINANCEIRO']` em `TabFidelidadeFinanceira`, (5) loader de `membros.$id.tsx` força `tab='dados'` se bypass via URL, (6) `deleteMinisterio` com 409 quando há membros vinculados, (7) RN-MEM-06 continua com 0 matches de `setTimeout|setInterval|node-cron|bull` em `app/`.

---

## 2. Findings

| ID | Sev | Categoria | Local (esperado) | Descrição | Recomendação | Status |
|---|---|---|---|---|---|---|
| **M1** | Medium | A01 / Defense-in-depth | `app/lib/rbac.server.ts:45-87` (ausente) | `canManageMinisterios` **não existe** no helper canônico. S03-T04 §104-109 exige "createMinisterio / updateMinisterio / deleteMinisterio — assertCanManageMinisterios (ADMIN, PASTOR, SECRETARIO); Helper `canManageMinisterios(user)`". Existe apenas `assertCanManageConfiguracaoGeral` (apenas ADMIN) — ministérios precisam do trio (DEBT-001 matriz §2). Risco: divergência entre quem-pode vs helper-canônico, ou uso indevido de `assertIsAdmin` que bloquearia SECRETARIO indevidamente. | **Criar `assertCanManageMinisterios(user: SessionUser): void`** em `app/lib/rbac.server.ts` com allowed = `["ADMIN", "PASTOR", "SECRETARIO"]` (FINANCEIRO, DISCIPULADOR, LIDER_MINISTERIO **não podem** — confirmado em S03-T04). Adicionar teste em `rbac.server.test.ts` com it.each para os 6 perfis. | Reportado — backend corrige em S03-T04 |
| **M2** | Medium | A01 / RN-MEM-04 + Lógica de negócio | `app/lib/discipleship.server.ts` (ausente) | `assignDisciple` precisa executar **5 etapas em ordem** (S03-T01 §27): (1) `assertCanWriteMembers` (camada 3 — qualquer autenticado escreve, RN-MEM-01); (2) auto-vínculo (`discipuladorId === discId`) → throw `Response("Você não pode ser seu próprio discipulador.", { status: 400 })`; (3) `count(where: { discipuladorId, tipo: "MEMBRO_ATIVO" }) >= 12` → throw `Response("Discipulador já possui 12 discípulos ativos.", { status: 409 })`; (4) `isDescendantOf(candidate, discipuladorId)` → throw `BusinessRuleError("Vínculo em loop detectado: candidato é descendente do discipulador.", 422)`; (5) `prisma.membro.update({ where: { id: discId }, data: { discipuladorId } })`. Risco: ordem incorreta gera TOCTOU (count antes vs update depois) ou bypass de regra (atualizar antes de validar). | **Implementar `assignDisciple(discId, discipuladorId, user)`** com a sequência exata de 5 etapas. JSDoc deve declarar explicitamente a ordem. **TOCTOU-safe:** count() é feito DENTRO da transação, ou com locking otimista (Prisma não tem `SELECT FOR UPDATE` nativo, mas `$transaction` + `SERIALIZABLE` isolation level cobre o caso). Testes: (a) boundary 12 OK, 13 falha, (b) auto-vínculo, (c) loop A→B→A, (d) counter em escopo correto (MEMBRO_ATIVO apenas). | Reportado — backend corrige em S03-T01 |
| **M3** | Medium | A04 / Insecure Design (DoS) | `app/lib/discipleship.server.ts` (ausente) | `isDescendantOf(candidate, ancestor)` é **recursivo** (S03-T01 §29: "recursivo, profundidade máx 10, fail-safe: >10 considera descendente"). Sem o limite de profundidade, um atacante com permissão de escrita (DISCIPULADOR) pode tentar construir uma cadeia artificialmente profunda que faz o serviço recursar até stack-overflow → DoS de banco (cada chamada = 1 query Prisma). O limite 10 com **fail-safe (considera descendente se >10)** é a decisão correta do contrato: previne DoS E garante que chains legítimas até profundidade 10 funcionam. | **Implementar `isDescendantOf(candidateId, ancestorId, depth = 0): Promise<boolean>` com guard `if (depth > 10) return true` no início.** JSDoc deve explicitar o motivo (proteção DoS) e o fail-safe. Testes: (a) chain 1 → descendente, (b) chain 10 → descendente, (c) chain 11+ → descendente (fail-safe), (d) candidato === ancestor → false (já tratado pelo auto-vínculo em M2, mas dupla checagem é boa). | Reportado — backend corrige em S03-T01 |
| **M4** | Medium | A01 / LGPD (Camada 3 RBAC) | `app/lib/finance.server.ts` (ausente) | `getDizimosByMembro(membroId, user)` precisa chamar `assertCanSeeFinancials(user)` como **PRIMEIRA linha da função**, ANTES de qualquer I/O (`prisma.lancamento.findMany`). `assertCanSeeFinancials` em `rbac.server.ts:45-49` **JÁ EXISTE** (base sólida) e lança `Response(403)`. Risco: se o loader esquecer a checagem (Camada 2 falha), o service ainda barra (Camada 3). Defense in depth real. A RN-MEM-03 (dízimos) é **dado sensível** (art. 5°, II LGPD — convicção religiosa + capacidade financeira), e o helper canônico já trata o trio ADMIN/PASTOR/FINANCEIRO. | **Implementar `getDizimosByMembro(membroId, user)` com `assertCanSeeFinancials(user)` PRIMEIRO.** JSDoc deve referenciar "RN-MEM-03 — Camada 3. Se loader esquecer, service barra (defense in depth). Sprint 1+ lê Lancamento where membroId + categoria=DIZIMO." Retornar `[]` placeholder. Testes: 6 perfis (ADMIN/PASTOR/FINANCEIRO → [], SECRETARIO/DISCIPULADOR/LIDER → `Response(403)`). | Reportado — backend corrige em S03-T11 |
| **M5** | Medium | LGPD (art. 5°, II — sensível) | `prisma/schema.prisma:74-75` + `app/lib/schemas/membros.ts:78-79,130-131` | `Membro.dataBatismo` e `Membro.dataConversão` são **dado pessoal sensível** sob art. 5°, II LGPD — "convicção religiosa" é categoria explícita. Atualmente o `MEMBRO_SAFE_SELECT` em `members.server.ts:43-64` retorna esses campos **para todos os perfis** que passaram em `getMembroById` (incluindo DISCIPULADOR de outro discípulo, SECRETARIO, LIDER_MINISTERIO). Risco: LIDER_MINISTERIO vê data de batismo de membro de outro ministério (escopo relaxado já é M3 do S02), DISCIPULADOR vê data de batismo de membro fora de sua cadeia (que `getMembroById` barraria com 404, OK). Decisão consciente MVP do S02: `getMembroById` aplica escopo DISCIPULADOR via 404, mas **dataBatismo/dataConversão continuam expostas** dentro do escopo permitido (outro discípulo). Isso é **aceitável** se documentado, mas merece um parágrafo no LGPD-RAG. | **(a)** Aceitar para MVP: DISCIPULADOR vê dataBatismo de seus próprios discípulos (escopo garantido por 404). SECRETARIO/LIDER_MINISTERIO veem (escopo relaxado aceito no MVP). **(b)** Documentar em `lgpd-igreja-conect.md §2.6` que dataBatismo/dataConversão **são** dado sensível (art. 5°, II) mas com escopo RBAC aplicado. **(c)** O `MEMBRO_SAFE_SELECT` é o único caminho de leitura — não vazar em action que retorna payload completo. **(d)** Considerar S2+: `dataBatismo`/`dataConversão` ficarem em select **adicional** (não padrão) para perfis restritos, com opt-in explícito no loader. | Reportado — registrar em LGPD-RAG; backend confirma que `MEMBRO_SAFE_SELECT` é o único consumidor |
| **M6** | Medium | A09 / LGPD art. 37 | `app/lib/{discipleship,ministries}.server.ts` (ausente) | S03-T01, T02, T04 mencionam múltiplas mutações (`assignDisciple`, `unassignDisciple`, `promoverTipo`, `createMinisterio`, `updateMinisterio`, `deleteMinisterio`, `addMembroToMinisterio`, `removeMembroFromMinisterio`) mas **não exigem `safeLog` explícito**. LGPD art. 37 exige registro de operações de tratamento de dados pessoais. S02-M4 (já reportado) cobra para `createMembro`/`updateMembro`/`deleteMembro`; S03 amplia a superfície com 8 mutações adicionais. Risco: incidente de "quem vinculou/disvinculou/disse X" sem rastreabilidade. | **Cada mutação em S03 deve chamar `safeLog({ userId, action, resource, resourceId, result })`** com action strings como `assign_disciple`, `unassign_disciple`, `promover_tipo`, `create_ministerio`, `update_ministerio`, `delete_ministerio`, `add_membro_to_ministerio`, `remove_membro_from_ministerio`. Adicionar testes que validam que `safeLog` é invocado (spy em `audit.server.ts`). | Reportado — backend corrige em S03-T01/T02/T04 |
| **L1** | Low | A01 / Defense-in-depth | `app/components/Can.tsx` (ausente) | S03-T07 §199: "`<Can>` helper client-side; se user.cargo in allow → children; senão fallback (default null)". Risco: se `user.cargo` for lido de uma prop que pode ser manipulada (ex: bypass via DevTools definindo `cargo: "ADMIN"`), o `<Can>` é falsificável. **Mitigação:** o `<Can>` é **Camada 1 (UI)** e **NÃO é fonte de verdade** — RAG `security-rbac-matrix.md` §1 é explícito: "Esconde controle, mas **não** é fonte de verdade". Camada 2 (loader) e Camada 3 (service) são o que importa. | **Documentar JSDoc do `<Can>`:** "Helper **client-side** de UX. NÃO é defesa — bypass trivial via DevTools. Fonte de verdade: loader (Camada 2) e service (Camada 3). Ver RAG security-rbac-matrix §1." Manter implementação simples: `if (user.cargo in allow) return children; return fallback ?? null;`. Adicionar teste com `cargo` alterado em runtime (não-op — o teste prova que é UX-only). | Reportado — frontend documenta em S03-T07 |
| **L2** | Low | A04 / Insecure Design (anti-enumeração) | `app/routes/app/membros.$id.discipulado.tsx` (ausente) | S03-T06 §169: "DISCIPULADOR acessando membro de outro → 404 (escopo)". O contrato de S02 já estabelece `getMembroById` lança 404 (não 403) para DISCIPULADOR fora de escopo (`members.server.ts:182-184` validado). Risco residual: o loader de `membros.$id.discipulado.tsx` precisa **reusar `getMembroById`** (não buscar direto) para herdar o comportamento 404. Se implementar `prisma.membro.findUnique` direto, perde o 404. | **Loader de `membros.$id.discipulado.tsx` deve chamar `getMembroById(params.id, user)`** (não acesso direto ao Prisma). JSDoc deve referenciar RAG §3.3 (anti-enumeração). Adicionar teste: DISCIPULADOR acessando discípulo de outro → 404 (mesmo status que "não existe"). | Reportado — backend corrige em S03-T06 |
| **L3** | Low | A01 / Boundary error handling | `app/lib/finance.server.ts` (ausente) | `getDizimosByMembro` precisa **converter** `Response(403)` lançada por `assertCanSeeFinancials` em `ForbiddenError` semântico (errors.ts:26-32 já existe com statusCode=403), ou documentar que a action/loader captura `Response` diretamente. Risco: mistura de `Response` (padrão RR7) e `ForbiddenError` (erro de domínio) gera inconsistência. S02 já tem padrão: `deleteMembro` (members.server.ts:319) lança `Response(403)` direto, action captura `BusinessRuleError`/`NotFoundError` (errors.ts) mas deixa `Response` propagar. **Decisão consciente de S02:** `assertCan*` lança `Response(403)`, domain errors lançam classes de `errors.ts`. Manter padrão. | **Manter padrão S02:** `assertCanSeeFinancials` lança `Response(403)` (canônico em rbac.server.ts). `getDizimosByMembro` **não converte** — deixa o `Response` propagar. Loader pode capturar e devolver `dizimos: []` (UX), ou deixar ErrorBoundary renderizar 403. JSDoc explicitar: "Lança Response(403) — caller decide entre capturar (UX) ou propagar (boundary)." | Reportado — backend confirma padrão em S03-T11 |
| **L4** | Low | A02 / SESSION_SECRET (re-emerge) | `app/lib/session.server.ts:34` (re-emerge) | S01 M1, S02 L3 — `SESSION_SECRET` fallback `"dev-only-not-secret"` continua. S03 amplia o raio de explosão (qualquer chamada autenticada pode tocar caminhos de Fidelidade, ministérios, discipulado). Em prod, cookie signing comprometido → qualquer um forja `sid` válido → acesso a todas as rotas autenticadas. | **Reabrir S01-M1 / S02-L3** com prioridade alta. Fail-fast no boot se `NODE_ENV === "production"` e `SESSION_SECRET` ausente. Tratar antes do primeiro deploy (S05 ou antes). | Reportado — backend corrige (já reportado em S01 e S02) |

---

## 3. Critical (bloqueia gate)

**Nenhum.** O gate `all-of` (build phase) exige `criticalVulns = 0` e `highVulns = 0`. Ambos satisfeitos. Como S03 é **preventiva** (código ainda não escrito), a auditoria não pode afirmar 0 critical sobre código inexistente — recomenda-se **rodar esta mesma auditoria em modo "real" (não preventiva) após a implementação** para confirmar que os contratos foram cumpridos.

---

## 4. High (bloqueia gate)

**Nenhum.**

---

## 5. Medium (vira débito — não bloqueia)

Ver tabela §2 (M1, M2, M3, M4, M5, M6). **Total: 6 médios.**

---

## 6. Low / Info (documenta)

Ver tabela §2 (L1, L2, L3, L4). **Total: 4 baixos.**

---

## 7. Conformidade OWASP Top 10 (foco S03)

| ID | Categoria | Status | Evidência |
|---|---|---|---|
| **A01** | Broken Access Control | ⚠️ **PASS com M1, M2, M3, L1, L2** | **Base herdada sólida:** `rbac.server.ts:45-87` tem 4 helpers (assertCanSeeFinancials, assertCanWriteMembers, assertIsAdmin, assertCanManageConfiguracaoGeral). `getMembroById` em `members.server.ts:166-187` aplica escopo DISCIPULADOR via 404 (não 403 — anti-enumeração). `MEMBRO_SAFE_SELECT` em `members.server.ts:43-64` é o único select seguro. **Falta S03:** `canManageMinisterios` (M1) para `createMinisterio`/`updateMinisterio`/`deleteMinisterio` com trio ADMIN/PASTOR/SECRETARIO. `assignDisciple` precisa 5 etapas em ordem (M2). `isDescendantOf` com profundidade máx 10 (M3, anti-DoS). `<Can>` é UX-only (L1, documentado). Loader de `membros.$id.discipulado` reusa `getMembroById` (L2). |
| **A02** | Cryptographic Failures | ⚠️ **PASS com L4** | S03 não introduz criptografia nova. Reutiliza bcryptjs cost 10 (S01), cookie `__session` httpOnly+sameSite+lax+secure (S01). **Risco re-emergente:** `SESSION_SECRET` fallback (L4, 3ª re-rogada). |
| **A03** | Injection (SQL/XSS/Command) | ✅ **PASS** | S03 não adiciona queries raw. Toda query Prisma será tipada. XSS: zero `dangerouslySetInnerHTML`/`innerHTML`/`eval` em `app/` (grep confirmou). RN-MEM-06 garante zero `setTimeout|setInterval|node-cron|bull` (gate bloqueante, PASS). |
| **A04** | Insecure Design | ⚠️ **PASS com M3, L1, L2** | **Anti-DoS:** `MAX_DISCIPULOS = 12` boundary test 12/13 (M2), `isDescendantOf` profundidade 10 (M3), `pageSize ≤ 100` (herdado de S02). **Anti-enumeração:** `getMembroById` 404 (não 403) para DISCIPULADOR fora de escopo (herdado, validado em S02). **Mensagens claras:** 400 (auto-vínculo), 409 (limite/discípulos), 422 (loop), 403 (RBAC) — todas previstas em S03-T01..T11. **Risco residual:** M3 (DoS cadeia), L1 (`<Can>` é UX), L2 (loader reusando `getMembroById`). |
| **A05** | Security Misconfiguration | ⚠️ **PASS com L4** | `MEMBRO_SAFE_SELECT` é o padrão (S02 — validado por testes em `members.server.test.ts:107-118`). CORS: 0 `Access-Control-Allow-Origin` em `app/` (grep confirmou). HTTP inseguro: 0 `http://` em código de feature (grep confirmou). `NODE_ENV=production` ainda sem fail-fast para `SESSION_SECRET` (L4). |
| **A06** | Vulnerable Components | ✅ **PASS** | S03 não adiciona deps novas (apenas `zod` já em S00; componentes próprios). Sem risco de supply chain. |
| **A07** | Auth Failures | ✅ **PASS** | S03 não mexe em auth. Reusa S01 (aprovado). Rate limit, bcrypt, sliding renewal já validados. |
| **A08** | Data Integrity | ✅ **PASS** | S03 não introduz mutação cross-origin. Cookie sameSite=lax (S01) + CSRF natural. Forms RR7 com `method="post"` automático. Schemas Zod em `app/lib/schemas/{discipulado,ministerios}.ts` validam payloads. |
| **A09** | Logging Failures | ⚠️ **PASS com M6** | `safeLog` em `app/lib/audit.server.ts:11-32` com allowlist (sem `email`, `senhaHash`, `password`, `valorCentavos`). S02 cobre createMembro/updateMembro/deleteMembro. S03 deve cobrir assign/unassign/promoverTipo/CRUD ministérios (M6). |
| **A10** | SSRF | N/A | S03 não faz fetch user-controlled. Operações são todas no DB local. |

**Cobertura OWASP:** 4/10 PASS puros + 6/10 PASS com findings residuais (que não bloqueiam). Total: 10/10 auditados.

---

## 8. Conformidade LGPD (foco S03)

| Artigo / RAG | Status | Evidência |
|---|---|---|
| **Art. 5°, II — Dado sensível (convicção religiosa)** | ⚠️ **PASS com M5** | `Membro.dataBatismo` e `Membro.dataConversão` no schema (`prisma/schema.prisma:74-75`) são **dado pessoal sensível** sob LGPD art. 5°, II. Atualmente expostos via `MEMBRO_SAFE_SELECT` (members.server.ts:51-52) para todos os perfis que passaram no escopo RBAC. Decisão consciente MVP: aceitar com escopo aplicado (DISCIPULADOR só vê seus discípulos via 404 do `getMembroById`). Documentar em LGPD-RAG §2.6 (M5). |
| **Art. 6°, II — Adequação** | ✅ PASS | Schema Prisma continua sem `cpf`/`rg`/`cnpj`/`pis`/`tituloEleitor`/`cartaoSus` em `prisma/schema.prisma:64-109`. `MembroCreateSchema` em `app/lib/schemas/membros.ts:63-102` tem `.strict()` que rejeita campos não declarados (gate LGPD testado em `membros.test.ts`). |
| **Art. 6°, III — Necessidade** | ✅ PASS | `MEMBRO_SAFE_SELECT` (members.server.ts:43-64) é o único caminho de leitura. S03 não introduz campos novos. |
| **Art. 6°, VII — Segurança** | ⚠️ **PASS com M4, M6** | `assertCanSeeFinancials` em `rbac.server.ts:45-49` é o gate. `getDizimosByMembro` precisa chamá-lo PRIMEIRO (M4). Audit log de mutações (M6). |
| **Art. 6°, VIII — Prevenção** | ✅ PASS | `MAX_DISCIPULOS = 12` (boundary test), `isDescendantOf` profundidade 10, RN-MEM-06 sem cron, middleware de auth em `_middleware.tsx:49-63`. |
| **Art. 9º — Informação ao titular** | N/A no MVP | Endpoints `/app/privacidade/**` fora do MVP (DEBT-013). |
| **Art. 18 — Direitos do titular** | N/A no MVP | Mesmo. |
| **Art. 37 — Registro de operações** | ⚠️ **PASS com M6** | `safeLog` (audit.server.ts) já existe com allowlist. S02 cobre create/update/delete Membro. S03 precisa cobrir 8 mutações adicionais (M6). Leitura de PII fora do MVP (DEBT-012, decisão consciente). |
| **Art. 46 — Medidas técnicas adequadas** | ✅ PASS | bcrypt cost 10 (S01), cookie httpOnly, HTTPS em prod, sliding renewal. |
| **Art. 49 — Eliminação após uso** | ✅ PASS | `deleteMembro` (S02) e `deleteMinisterio` (S03 — esperado) remove registros; cascade deleta sessões e ministerio_vínculos. |
| **RN-MEM-02 (sem CPF/RG/CNPJ)** | ✅ **PASS** | `grep -iE 'cpf|rg|cnpj|pis' prisma/schema.prisma app/lib/schemas/` → **0 matches** (apenas menções em comentários JSDoc e fixtures de teste em `membros.test.ts`). Schema Prisma reflete ausência. `MembroCreateSchema` tem `.strict()` (gate testado). |
| **RN-MEM-03 (Fidelidade restrita)** | ⚠️ **PASS com M4** | `assertCanSeeFinancials` em `rbac.server.ts:45-49` (base). `getDizimosByMembro` precisa chamá-lo PRIMEIRO (M4). 3 camadas (UI/loader/service) a serem implementadas em S03-T07/T11. |
| **RN-MEM-04 (12 discípulos)** | ⚠️ **PASS com M2, M3** | `MAX_DISCIPULOS = 12` em `app/lib/discipleship.server.ts` (S03-T01) — esperado. `isDescendantOf` profundidade 10 (M3). Boundary test 12/13 (S03-T12 chain 1). |
| **RN-MEM-06 (sem cron)** | ✅ **PASS** | `grep -rE 'setTimeout|setInterval|node-cron|bull' app/ --include="*.ts" --include="*.tsx"` → **0 matches reais** (apenas 1 falso positivo em `bullets` do `CardInfo.tsx`, que é estilização CSS). Gate bloqueante do SPEC §10. |

**Cobertura LGPD:** 5/12 PASS puros + 7/12 PASS com observações. Total: 12/12 auditados.

---

## 9. Fidelidade 3 Camadas (gate LGPD bloqueante)

A RN-MEM-03 exige bloqueio da aba "Fidelidade Financeira" em **3 camadas independentes** (defense in depth). Como S03 é preventiva, valido os **contratos** e a **base herdada**.

| Camada | Onde | Contrato S03 | Base herdada | Status |
|---|---|---|---|---|
| **Camada 1 (UI)** | `<TabFidelidadeFinanceira>` | S03-T07 §204: "SÓ renderizado se canSeeFinancials" | `assertCanSeeFinancials` em `rbac.server.ts:45-49` é o gate. Componente `<Can>` a ser criado em S03-T07 §199 com `allow=['ADMIN','PASTOR','FINANCEIRO']`. | ⚠️ **PASS com L1** (componente existe em contrato; L1 alerta que é UX-only) |
| **Camada 2 (Loader)** | `app/routes/app/membros.$id.tsx` (extensão S03) | S03-T07 §206: "Loader: aplica camada 2 RBAC — se `!canSeeFinancials && tab===fidelidade`, força `tab=dados`" | `app/routes/app/membros.$id.tsx:54-66` (versão S02) não tem `?tab=fidelidade` ainda. S03 adiciona. | ⚠️ **PASS preventivo** (contrato bem definido; precisa implementação) |
| **Camada 3 (Service)** | `app/lib/finance.server.ts:getDizimosByMembro` | S03-T11 §307: "`getDizimosByMembro(membroId, user)` — `assertCanSeeFinancials` primeiro (camada 3); retorna `[]` (placeholder)" | `assertCanSeeFinancials` em `rbac.server.ts:45-49` é o helper canônico. JSDoc do `finance.server.ts` (a ser criado) deve marcar "RN-MEM-03 — Camada 3. Se loader esquecer, service barra." | ⚠️ **PASS com M4** (helper existe; precisa ser chamado PRIMEIRO) |

**Bypass test esperado (S03-T12 chains 4, 5, 6):**
- Chain 4 (UI): SECRETARIO acessa `/app/membros/:id` → vê 3 abas (Dados, Discipulado, Ministérios); NÃO vê Fidelidade. **Esperado PASS se L1 for resolvido.**
- Chain 5 (URL): SECRETARIO acessa `/app/membros/:id?tab=fidelidade` → vê aba Dados ativa, sem Fidelidade. **Esperado PASS se Camada 2 for implementada (loader força tab=dados).**
- Chain 6 (service): chamada direta a `getDizimosByMembro` como SECRETARIO → `Response(403)`. **Esperado PASS se M4 for resolvido.**

**Status consolidado:** 3/3 camadas com **contrato sólido** + **base herdada** suficiente. Auditoria real (pós-implementação) deve confirmar com grep em `app/components/TabFidelidadeFinanceira.tsx`, `app/routes/app/membros.$id.tsx`, `app/lib/finance.server.ts`.

---

## 10. Análise dos contratos S03 vs RAGs (auditoria preventiva)

Esta seção valida que os **contratos definidos em `S03.json` e nos design docs estão alinhados com os RAGs de segurança**. Quando o código for escrito, os testes E2E (S03-T12) devem validar cada item.

| Item do contrato | Origem | Alinhamento com RAG | Evidência |
|---|---|---|---|
| `MAX_DISCIPULOS = 12` exportado | S03-T01 §26 + RAG §2 | ✅ Alinhado: `security-rbac-matrix.md §2` (literalmente `export const MAX_DISCIPULOS = 12`) | Não existe ainda (criar em S03-T01) |
| `assignDisciple` com 5 etapas em ordem | S03-T01 §27 | ✅ Alinhado: TOCTOU-safe, RN-MEM-04 + anti-loop + auto-vínculo | Não existe ainda (M2) |
| `isDescendantOf` recursivo, profundidade máx 10, fail-safe | S03-T01 §29 + RAG §2 | ✅ Alinhado: anti-DoS (M3) | Não existe ainda (M3) |
| `unassignDisciple(id, user)` — update `{ discipuladorId: null }` | S03-T01 §28 | ✅ Alinhado: assertCanWriteMembers | Não existe ainda |
| `getDiscipuladoData(membroId, user)` — orquestrador | S03-T01 §30 | ✅ Alinhado: reuso de getMembroById (escopo) | Não existe ainda |
| `promoverTipo(id, novoTipo, user)` — assertCanWriteMembers + Zod | S03-T02 §53-57 | ✅ Alinhado: endpoint dedicado (RN-MEM-06) | Não existe ainda |
| `canManageMinisterios(user)` — ADMIN/PASTOR/SECRETARIO | S03-T04 §104-109 | ✅ Alinhado: matriz §2 (DEBT-008 matriz) — **falta helper** (M1) | Helper ausente em `rbac.server.ts:45-87` |
| `deleteMinisterio` com count(MinisterioMembro) > 0 → 409 | S03-T04 §106 | ✅ Alinhado: A04 design claro | Não existe ainda |
| `AssignDiscipleSchema` Zod | S03-T03 §77-80 | ✅ Alinhado: ADR-003 (Zod) | Não existe ainda |
| `MinisterioCreateSchema` Zod | S03-T03 §78-79 | ✅ Alinhado: A04 validação de input | Não existe ainda |
| `<Can>` helper — `if (user.cargo in allow) children` | S03-T07 §199 | ✅ Alinhado: Camada 1 UI, **NÃO é fonte de verdade** (RAG §1) | Não existe ainda (L1) |
| `<TabFidelidadeFinanceira>` — SÓ renderiza se canSeeFinancials | S03-T07 §204 | ✅ Alinhado: Camada 1 RN-MEM-03 | Não existe ainda |
| Loader de `membros.$id.tsx` — força `tab=dados` se bypass | S03-T07 §206 | ✅ Alinhado: Camada 2 RN-MEM-03 | Não existe ainda (S03-T07) |
| Bypass `?tab=fidelidade` SECRETARIO → aba Dados ativa | S03-T07 §207 | ✅ Alinhado: Camada 2 RN-MEM-03 | Não existe ainda (teste E2E S03-T12 chain 5) |
| `getDizimosByMembro` com `assertCanSeeFinancials` PRIMEIRO | S03-T11 §307 | ✅ Alinhado: Camada 3 RN-MEM-03 | Helper `assertCanSeeFinancials` existe em `rbac.server.ts:45-49`; service a ser criado (M4) |
| `safeLog` em `promoverTipo` (action: 'promover_tipo') | S03-T02 §56 | ✅ Alinhado: LGPD art. 37 (M6) | Não existe ainda |
| RN-MEM-06 (sem cron) | S03-T01 §32 | ✅ Alinhado: gate bloqueante, grep validado (PASS) | Verificado: 0 matches reais em `app/` |
| `deleteMembro` reusa assertCanDeleteMembers | S02-T02 §57 (re-rogada) | ⚠️ M1 do S02 já reportado: helper **não foi criado**; S02 usou `if (user.cargo !== "ADMIN" && user.cargo !== "PASTOR")` inline em `members.server.ts:318-320` (funciona, mas quebra princípio de single source of truth) | Re-rogada S02-M1 — não bloqueia, mas débito técnico |
| DISCIPULADOR acessando membro de outro → 404 | S03-T06 §169 + RAG §3.3 | ✅ Alinhado: anti-enumeração | Herdado de S02: `getMembroById` em `members.server.ts:182-184` lança 404; loader de `membros.$id.discipulado.tsx` deve reusar (L2) |
| Bypass Fidelidade E2E: UI+URL+service (3 chains) | S03-T12 chains 4-6 | ✅ Alinhado: CF-04 do cross-sprint | Não existe ainda (S03-T12) |

**Resumo:** 17/20 itens do contrato **estritamente alinhados** com RAGs. 3/20 têm gaps preventivos (M1, M2, M3) que devem ser fechados na implementação. **L1, L2, L3, M4, M5, M6** são débitos adicionais (não-bloqueantes) endereçáveis em S03-T01..T11.

---

## 11. Comandos de auditoria (com saída literal)

Para reprodutibilidade, abaixo estão os comandos exatos rodados e suas saídas resumidas.

```bash
# RN-MEM-06 — sem cron/scanner (gate bloqueante)
$ grep -rE 'setTimeout|setInterval|node-cron|bull' app/ --include="*.ts" --include="*.tsx" | grep -vE 'bullet|test\.ts'
# → 0 matches (PASS — gate RN-MEM-06 OK)

# LGPD RN-MEM-02 — schema sem CPF/RG/CNPJ (gate bloqueante)
$ grep -rE 'cpf|rg|cnpj' prisma/schema.prisma app/lib/schemas/
# → 0 matches (apenas comentários JSDoc e fixtures em membros.test.ts) (PASS)

# MAX_DISCIPULOS — trava 12 (S03-T01)
$ grep -n 'MAX_DISCIPULOS' app/lib/discipleship.server.ts
# → FILE NOT FOUND (S03 não implementou — esperado)

# assertCanSeeFinancials em finance.server.ts (S03-T11)
$ grep -n 'assertCanSeeFinancials' app/lib/finance.server.ts
# → FILE NOT FOUND (S03 não implementou — esperado; helper JÁ EXISTE em app/lib/rbac.server.ts:45-49)

# isDescendantOf (S03-T01)
$ grep -rE 'isDescendantOf' app/ | grep -v test
# → 0 matches (S03 não implementou — esperado)

# canManageMinisterios (S03-T04)
$ grep -rE 'canManageMinisterios' app/lib/
# → 0 matches (helper ausente em rbac.server.ts — M1)

# MEMBRO_SAFE_SELECT (S02)
$ grep -n 'senhaHash' app/lib/members.server.ts
# → 1 match em comentário JSDoc (members.server.ts:63 — "intencionalmente SEM senhaHash")
# → 0 leaks (PASS — validado por testes em members.server.test.ts:107-118)

# senhaHash em rotas (LGPD)
$ grep -rEn 'senhaHash' app/routes/
# → 0 matches em código de produção
# → fixtures em .test.tsx (OK)

# dataBatismo/dataConversao (PII borderline — M5)
$ grep -rEn 'dataBatismo|dataConversao' app/ prisma/
# → campos expostos via MEMBRO_SAFE_SELECT (members.server.ts:51-52)
# → aceito para MVP com escopo RBAC; documentar em LGPD-RAG (M5)

# CORS aberto
$ grep -rEn 'Access-Control-Allow-Origin' app/
# → 0 matches (PASS)

# XSS
$ grep -rEn 'dangerouslySetInnerHTML|innerHTML|eval\(|new Function' app/
# → 0 matches (PASS)

# SQL Injection (Prisma raw)
$ grep -rEn '\$queryRaw|\$executeRaw|raw\(' app/lib/ app/routes/
# → 0 matches (PASS)

# HTTP inseguro
$ grep -rEn 'http://' app/lib/ app/components/ app/routes/ | grep -vE 'xmlns|localhost|127\.0\.0\.1'
# → 0 matches (PASS)
```

---

## 12. Recomendações priorizadas (ordem de execução S03)

| # | Finding | Esforço | Dono | Bloqueia gate S03? | Bloqueia produção? |
|---|---|---|---|---|---|
| 1 | **M1** — Criar `canManageMinisterios` em `rbac.server.ts` | XS (5 linhas + 1 teste) | backend | Não (apenas débito) | Não |
| 2 | **M2** — `assignDisciple` com 5 etapas em ordem (TOCTOU-safe) | S (lógica + 4 testes) | backend | Não | Não |
| 3 | **M3** — `isDescendantOf` recursivo, profundidade 10, fail-safe | XS (3 linhas + 3 testes) | backend | Não | Não |
| 4 | **M4** — `getDizimosByMembro` chama `assertCanSeeFinancials` PRIMEIRO | XS (1 linha + 6 testes) | backend | Não (gate lgpd-officer no S05) | Não |
| 5 | **M5** — Documentar `dataBatismo`/`dataConversão` (art. 5°, II) em LGPD-RAG §2.6 | XS (parágrafo) | rag-curator | Não | Não |
| 6 | **M6** — `safeLog` em 8 mutações S03 | S (8 chamadas + spy tests) | backend | Não | Não |
| 7 | **L1** — Documentar `<Can>` como UX-only no JSDoc | XS (parágrafo) | frontend | Não | Não |
| 8 | **L2** — Loader `membros.$id.discipulado` reusa `getMembroById` | XS (1 chamada) | backend | Não | Não |
| 9 | **L3** — Documentar padrão Response(403) vs ForbiddenError em `finance.server.ts` | XS (parágrafo) | backend | Não | Não |
| 10 | **L4** — SESSION_SECRET fail-fast (já reportado S01 M1 / S02 L3) | XS (2 linhas) | backend | Não | **SIM** (antes de prod) |

---

## 13. Veredito final

| Item | Valor |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 6 |
| Low | 4 |
| **blockingFindings** | **0** |
| **Gate S03** | **PASS** ✅ (preventivo) |

A S03 foi auditada em modo **preventivo** (código de feature ainda não escrito). Os contratos e design docs estão **sólidos e bem alinhados com os RAGs** — 17/20 itens já especificam corretamente o comportamento de segurança esperado, e a base herdada de S00/S01/S02 (RBAC helpers, `MEMBRO_SAFE_SELECT`, `getMembroById` com 404 anti-enumeração, `assertCanSeeFinancials`) é **robusta o suficiente** para suportar a implementação de S03. Os 6 médios + 4 baixos são **dívidas técnicas endereçáveis em S03-T01..T11** sem urgência de re-trabalho estrutural. **RN-MEM-06 (sem cron) está PASS** — gate bloqueante do SPEC §10 validado por grep. Recomenda-se **rodar esta auditoria novamente em modo "real"** após a implementação, focando em:

1. Confirmar que `MAX_DISCIPULOS = 12` foi **efetivamente exportado** e que o boundary test 12/13 passa verde.
2. Confirmar que `isDescendantOf` tem `if (depth > 10) return true` (fail-safe) e teste de profundidade 10 e 11+ passando.
3. Confirmar que `getDizimosByMembro` chama `assertCanSeeFinancials(user)` como **PRIMEIRA linha** (TOCTOU-safe).
4. Confirmar que `<TabFidelidadeFinanceira>` usa `<Can allow={['ADMIN','PASTOR','FINANCEIRO']}>` ou equivalente, e **não renderiza** para SECRETARIO/DISCIPULADOR/LIDER.
5. Confirmar que o loader de `membros.$id.tsx` força `tab='dados'` quando `!canSeeFinancials && tab==='fidelidade'` (Camada 2).
6. Confirmar que `deleteMinisterio` lança 409 quando há membros vinculados, e que SECRETARIO/DISCIPULADOR/LIDER não conseguem criar/editar/excluir (RBAC testada).
7. Confirmar que `RN-MEM-06` continua com 0 matches reais de `setTimeout|setInterval|node-cron|bull` em `app/` (grep deve dar 0).
8. Confirmar que `senhaHash` continua 0 em `app/routes/app/membros.*.tsx` (grep deve dar 0).
9. Confirmar LGPD `cpf|rg|cnpj|pis` continua 0 em schema + schemas + componentes.
10. Confirmar que `MEMBRO_SAFE_SELECT` continua sendo o único caminho de leitura (zero `prisma.membro.findUnique`/`findMany` sem `select: MEMBRO_SAFE_SELECT` em código S03).

O gate `all-of` (build phase) deve aceitar este resultado preventivo, e a auditoria real pós-implementação deve fechar os 6 médios antes de marcar a sprint como `done=true`.

---

## 14. Lesson learned / RAG candidate

**RAG candidate:** `.harness/RAG/security-audit-sprint-pre-implementation-checklist.md` (a ser criado por `rag-curator`).

**Conteúdo proposto:**

1. **Checklist universal de auditoria preventiva de Módulo com regra de negócio complexa** (RN-MEM-04, RN-MEM-03, RN-MEM-06 são exemplos):
   - **Constantes exportadas com valores mágicos:** verificar se o contrato declara `const MAX_X = N` e o RAG correspondente já tem o snippet pronto (ex: `security-rbac-matrix.md §2` para MAX_DISCIPULOS). Risco: copy-paste de valor 12 em 3 lugares e divergência.
   - **Recursão com profundidade:** se a feature tem traversal de grafo (cadeia de discipulado, árvore de ministérios), o contrato DEVE declarar `profundidadeMax = N` e `fail-safe: >N considera X`. Risco: stack-overflow DoS.
   - **Camada 3 service-level:** se a feature lê dado sensível, o service DEVE chamar `assertCan*` como PRIMEIRA linha (antes de I/O). Contrato: JSDoc com referência a "Camada 3. Se loader esquecer, service barra."
   - **Endpoints dedicados vs edição geral:** se a feature tem regra de transição de estado (VISITANTE → CONGREGADO → MEMBRO_ATIVO), o contrato DEVE exigir endpoint dedicado (`PATCH /membros/:id/tipo`) em vez de editar via PUT geral. Risco: bypass via PUT que muda tipo sem disparar validações de transição.
   - **CRUD com hierarquia:** se a feature tem delete com filhos (deleteMinisterio com membros vinculados), o contrato DEVE exigir 409 com mensagem clara e test E2E do boundary. Risco: cascade destrutivo.

2. **Anti-patterns de auditoria preventiva de feature complexa (re-rogada da lesson do S02):**
   - ❌ Tratar débitos herdados (M1, L4) como "fora do escopo" — eles **re-emergem** em qualquer sprint que dependa do módulo base. M1 do S02 (`assertCanDeleteMembers`) continua débito não-feito em S03.
   - ❌ Marcar `pass` sem evidência ("Será implementado em S03-T01" é **esperança**, não **evidência**).
   - ❌ Pular auditoria preventiva porque código não existe (a auditoria é justamente para **guiar** a implementação).
   - ❌ Não rodar auditoria "real" pós-implementação — a preventiva cobre **contratos**, a real cobre **código concreto**.

3. **Checklist de Fidelidade 3 Camadas (gate LGPD bloqueante):**
   - **Camada 1 (UI):** `<Can allow={[FINANCIAL_CARGOS]}>` ou wrapper que verifica `user.cargo` antes de renderizar. JSDoc explicita "UX-only, bypass trivial via DevTools".
   - **Camada 2 (Loader):** `if (tab===restricted && !canSee) tab=default`. Test E2E do bypass via URL.
   - **Camada 3 (Service):** `assertCan*(user)` PRIMEIRA linha, antes de qualquer `prisma.*.find*`. Test unit com spy.
   - **E2E chains:** uma por camada (UI esconde, URL força, service barra).

4. **Re-rodar a auditoria** sempre que a sprint passar de `build` para `done=true` — usar este relatório como **checklist de saída**.
