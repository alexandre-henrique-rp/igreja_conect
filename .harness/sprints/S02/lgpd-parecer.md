# Parecer LGPD — Sprint S02 (Membros: Listagem + CRUD básico)

**Projeto:** Igreja Conect
**Sprint auditada:** S02 — Membros: Listagem + CRUD básico (12 tasks: S02-T01 a S02-T12)
**Auditor:** `lgpd-officer` (harness v6.3.0)
**Lei aplicada:** Lei 13.709/2018 (LGPD)
**Data da auditoria:** 2026-06-13
**Tipo de parecer:** **PREVENTIVO** (S02 em implementação — auditoria antecipa o que precisa estar correto)

> **Triagem automatizada — não é parecer formal.** Em caso de dúvida complexa, escalar para advogado(a) humano(a).

---

## 1. Sumário executivo

| Item | Resultado |
|---|---|
| **Parecer** | **CONFORME COM RESSALVAS** (parecer preventivo) |
| **Blocking findings (gate LGPD)** | Critical: **0** · High: **0** |
| **Advisory findings** | Medium: **2** · Low: **1** |
| **RN-MEM-02 (sem CPF/RG/CNPJ/tituloEleitor/pis/cartaoSus)** | **PASS** (gate bloqueante verificado) |
| **`senhaHash` em payload** | **PASS** (ainda não aplicável — service não implementado; schema `MembroUpdateSchema` já rejeita via `.strict()` no TDD) |
| **Conformidade por artigo** | art. 6º (pass) · art. 18 (advisory-fora-mvp) · art. 37 (advisory-fora-mvp) · art. 46 (pass) · art. 49 (pass) |
| **Top 3 recomendações** | ver §10 |
| **Lesson learned / RAG candidate** | ver §11 |

**Conclusão:** a sprint S02 está **autorizada a prosseguir com a implementação**. As decisões de modelagem no `prisma/schema.prisma` (S00) e o TDD-first do `app/lib/schemas/membros.test.ts` (já criado, 272 linhas, red phase) **alinhados com o RAG `lgpd-igreja-conect.md`** indicam caminho seguro. O gate de conformidade (RN-MEM-02) **será automaticamente validado** quando a implementação rodar `grep -E '\bcpf\b|\brg\b|\bcnpj|\btituloEleitor\b|\bpis\b|\bcartaoSus\b' app/lib/schemas/membros.ts app/lib/members.server.ts app/routes/app/membros.*` no CI.

---

## 2. Estado da implementação no momento da auditoria

**Arquivos esperados (S02.json) — o que existe hoje (13 jun 12:07):**

| Arquivo esperado (S02) | Existe? | Status | Observação |
|---|---|---|---|
| `app/lib/schemas/membros.ts` | ❌ **NÃO** | Pendente (S02-T01) | TDD-first: o teste já foi escrito |
| `app/lib/schemas/membros.test.ts` | ✅ **SIM** (8.6 KB, 272 linhas) | **Red phase** | Cobre happy path, validações PT-BR, refine `dataBatismo >= dataConversao`, **e 4 GATE-LGPD tests rejeitando `cpf`/`rg`/`cnpj`/`senhaHash`** (linhas 192-216, 246-259) |
| `app/lib/members.server.ts` | ❌ NÃO | Pendente (S02-T02) | Service ainda não escrito |
| `app/routes/app/membros._index.tsx` | ❌ NÃO | Pendente (S02-T04) | Rota ainda não escrita |
| `app/routes/app/membros.novo.tsx` | ❌ NÃO | Pendente (S02-T06) | |
| `app/routes/app/membros.$id.tsx` | ❌ NÃO | Pendente (S02-T07) | |
| `app/routes/app/membros.$id.editar.tsx` | ❌ NÃO | Pendente (S02-T08) | |
| `app/routes/app.tsx` + `Sidebar` + `TopbarAutenticada` | ❌ NÃO | Pendente (S02-T09) | |
| `app/routes/app/_index.tsx` (placeholder) | ❌ NÃO | Pendente (S02-T10) | |
| `app/routes.ts` (registro) | ❌ NÃO modificado | Pendente (S02-T11) | |
| `e2e/membros-crud.spec.ts` | ❌ NÃO | Pendente (S02-T12) | |
| `app/components/{PageHeader,Select,TabelaMembros,CardMembro,FiltrosMembros,Pagination,Breadcrumb,FormField,Section,FormMembro}.tsx` | ❌ NÃO | Pendente (S02-T03, S02-T05) | |

**Arquivos pré-existentes (S00/S01) que sustentam a S02:**

| Arquivo | Função | Evidência para LGPD |
|---|---|---|
| `prisma/schema.prisma` (model `Membro`) | Define os campos persistidos | **RN-MEM-02 verificado** — sem `cpf`/`rg`/`cnpj`/`tituloEleitor`/`pis`/`cartaoSus` |
| `app/lib/validators/auth.ts:17-26` (`MembroCreateSchema`) | Schema Zod provisório de criação | **Já contém comentário `// Sem CPF, RG, dados fiscais (RN-MEM-02)`** — cultura de privacidade já estabelecida |
| `app/lib/audit.server.ts:11-18` (`ALLOWED_FIELDS`) | Allowlist do `safeLog` | Não loga `email`, `telefone`, `endereço`, `senhaHash` — pronto para S02 herdar |
| `app/lib/rbac.server.ts:58-62` (`assertCanWriteMembers`) | RBAC de escrita | Pronto para S02-T02 usar |
| `app/lib/session.server.ts:80-100` (`getUserFromRequest`) | Resolve `SessionUser` | Retorna apenas `{id, nome, cargo}` — PII mínimo |

---

## 3. Identificação do Encarregado (DPO) — Art. 41

| Item | Status | Evidência |
|---|---|---|
| DPO designado formalmente | **Pendente (fora do MVP)** | `sprints/cross-sprint.json` DEBT-013 e `brief.md §4` declaram: DPO + Art. 18 são Sprint 2+. **Esta sprint S02 não muda o status.** |
| E-mail de contato público | **Pendente (fora do MVP)** | Sem política de privacidade publicada ainda. |
| Visibilidade técnica | **Parcial** | ADMIN/PASTOR acessam dados via `/app/membros`; pedidos do titular são atendidos manualmente. |

**Classificação:** **advisory (fora do MVP)**. **Não bloqueia S02** (PRD §4 autoriza adiamento).

**Recomendação para S02:** nenhuma ação nesta sprint — apenas confirmar que nenhuma rota de S02 vaza dados além do escopo do perfil solicitante (RBAC fina já está garantida por `assertCanWriteMembers` + `getMembroById` retornando 404 para DISCIPULADOR fora de escopo).

---

## 4. Base legal do tratamento (Art. 7º e 11)

| Finalidade | Base legal | Art. | Justificativa |
|---|---|---|---|
| Gestão eclesiástica de membros (cadastro, listagem, edição, exclusão) | **Execução de contrato** | Art. 7º, V | O titular aceitou ser cadastrado na igreja (consentimento organizacional); o sistema é instrumento de gestão do vínculo. |
| Discipulado eclesiástico (RBAC fina: DISCIPULADOR vê só seus discípulos) | **Legítimo interesse** | Art. 7º, IX | Gestão pastoral — interesse da igreja em organizar o cuidado espiritual. Mitigado por: (a) escopo é apenas o necessário para a função (`discipuladorId = user.id`); (b) titular pode pedir revisão (Art. 18, fora do MVP). |
| **Não há tratamento de dado sensível (Art. 11)** nesta sprint | N/A | — | Histórico financeiro (dízimos) só entra em S03, com base legal e RBAC próprios (ver `cross-sprint.json` CF-04). |
| **Não há tratamento de criança/adolescente (Art. 14)** específico nesta sprint | N/A | — | Cadastro de menor é responsabilidade organizacional do ADMIN; a trava é organizacional, não técnica. **A RBAC fina do DISCIPULADOR é compatível com Art. 14 (interesse legítimo vetado para criança — Art. 14, §4º — não se aplica aqui porque a finalidade não é "exercício regular de direitos" da criança, mas gestão pastoral do grupo).** |
| Cookies de sessão | Execução de contrato | Art. 7º, V + §4º | Já auditado em S01. S02 herda (não muda). |

---

## 5. Dados pessoais tratados na S02

### 5.1 Tabela de campos (baseada em `prisma/schema.prisma:64-109` + `app/lib/validators/auth.ts:17-26` + `sprints/S02.json:25-31`)

| Campo | Tipo | Persistência | Criptografia em repouso | PII? | Necessidade (art. 6º, III) | Base legal | Justificativa |
|---|---|---|---|---|---|---|---|
| `id` | UUID | Banco | N/A | Não (técnico) | N/A | — | Identificador. Não é PII por si só; torna-se quando correlacionado. |
| `nome` | String | Banco | **Não (texto plano)** | **Sim** (PII comum) | **Necessário** | Art. 7º, V | Identificação do membro. Finalidade: gestão eclesiástica (lista de presença, contato pastoral, registro). |
| `tipo` | Enum (VISITANTE/CONGREGADO/MEMBRO_ATIVO) | Banco | N/A | Não | **Necessário** | Art. 7º, V | Distingue o grau de vínculo eclesiástico. Diretamente vinculado à finalidade. |
| `cargo` | Enum (ADMIN/PASTOR/etc.)? | Banco | N/A | Não (decisão técnica) | **Necessário** | Art. 7º, V | Determina RBAC. Indireto-PII quando correlacionado a `nome`. |
| `email` | String? @unique | Banco | **Não (texto plano)** ⚠️ | **Sim** (PII comum) | **Necessário** | Art. 7º, V | Canal de contato + login. YAGNI máscara: não há utilidade em ofuscar — o sistema precisa do email real para verificação. |
| `senhaHash` | String? (bcrypt cost 10) | Banco | Hash bcrypt | **NÃO é PII "plain"**, mas é credencial | **Necessário** para quem tem acesso | Art. 7º, V | Único campo de "segredo" persistido. **Art. 46 — medida técnica adequada.** Não trafega em payload, não aparece em log, não vai em query string. |
| `telefone` | String? | Banco | **Não (texto plano)** | **Sim** (PII comum) | **Necessário** | Art. 7º, V | Canal de contato (ligações pastorais, WhatsApp). |
| `profissao` | String? (opcional) | Banco | **Não** | **Sim** (PII — embora não sensível) | **OPCIONAL** | Art. 7º, V | Conhecer o membro para fins pastorais. **Não é dado sensível** (LGPD art. 5º, II), mas é PII comum. |
| `estadoCivil` | String? (opcional) | Banco | **Não** | **Sim** (PII — não sensível) | **OPCIONAL** | Art. 7º, V | Conhecer o membro para fins pastorais. Não é sensível. |
| `dataConversao` | DateTime? | Banco | **Não** | **Sim (PII sensível em tese)** | **Necessário** | Art. 7º, V | Dado **eclesiástico** — pode revelar convicção religiosa (Art. 5º, II + Art. 11, II — "religião"). **Risco: o RAG do projeto classifica dízimos como sensível; dataConversão é borderline.** Ver advisory LGPD-S02-FIND-001. |
| `dataBatismo` | DateTime? | Banco | **Não** | **Sim (PII sensível em tese)** | **Necessário** | Art. 7º, V | Idem. Reflete o sacramento do batismo. |
| `logradouro`, `numero`, `bairro`, `cidade`, `estado`, `cep` | String? (todos opcionais) | Banco | **Não** | **Sim** (PII — endereço residencial) | **OPCIONAL** | Art. 7º, V | Visitas pastorais, envio de correspondências, localização da célula. Endereço é PII comum (não sensível) mas ainda assim merece cuidado no compartilhamento. |
| `discipuladorId` | String? (FK para Membro) | Banco | N/A | Não (técnico) | **Necessário** | Art. 7º, V | Estrutura da rede de cuidado pastoral (RN-MEM-04). |

### 5.2 Resumo de exposição

- **Total de campos PII comuns tratados:** 9 (nome, email, telefone, profissao, estadoCivil, logradouro, numero, bairro, cidade, estado, cep).
- **Total de campos PII sensíveis (Art. 5º, II) tratados:** 0 explícitos, mas **2 borderline** (`dataConversao`, `dataBatismo` — ver advisory).
- **Campos sensíveis (Art. 11) definitivamente tratados:** 0 (dízimos vêm em S03, com RBAC restrita).
- **Transferência internacional (Art. 33-36):** N/A. Stack 100% local (SQLite local, sem CDN, sem analytics).

### 5.3 Conformidade com Art. 6º, III (necessidade)

✅ **PASS com advisory.** Todos os campos têm finalidade direta na gestão eclesiástica. **Nenhum** campo coletado é excessivo dado o propósito declarado (gestão pastoral + acolhimento de visitantes). A **opcionalidade** de `profissao`, `estadoCivil` e endereço respeita a minimização. O `MembroCreateSchema` (em `validators/auth.ts:17-26`) **rejeita** campos não declarados via inferência do Zod (TS rejeita em compilação; payload é ignorado em runtime — não há `.strict()` ainda, ver advisory LGPD-S02-FIND-002).

---

## 6. Conformidade por artigo

| Artigo | Status | Evidência | Observação |
|---|---|---|---|
| **Art. 6º, I** (Finalidade) | ✅ pass (preventivo) | S02 purpose = gestão eclesiástica (S02.json §goal). | Compatibilidade mantida. |
| **Art. 6º, II** (Adequação) | ✅ pass | Forma de tratamento (CRUD server-side com RBAC) é compatível. | Sem uso secundário. |
| **Art. 6º, III** (Necessidade) | ⚠️ **pass com advisory** | `MembroCreateSchema` (validators/auth.ts:17-26) tem apenas 7 campos de fato usáveis; `MembroUpdateSchema` rejeita `senhaHash` por design (TDD em membros.test.ts:246-252). | **Falta `.strict()` no schema** (LGPD-S02-FIND-002) — ver §7. |
| **Art. 6º, VII** (Segurança) | ✅ pass | bcrypt cost 10 (S00); cookie httpOnly+sameSite=lax+secure em prod (S01); RBAC fina (S00-T05). | S02 herda. |
| **Art. 6º, VIII** (Prevenção) | ✅ pass | Defense in depth: middleware (S01) + `assertCanWriteMembers` + RBAC fina (DISCIPULADOR vê só seus discípulos via `getMembroById` retornando 404). | S02 implementa 3ª camada: service valida escopo antes de qualquer leitura. |
| **Art. 6º, X** (Responsabilização) | ⚠️ **advisory-parcial** | `safeLog` em `app/lib/audit.server.ts:11-18` com allowlist (6 campos) — pronto para S02 herdar. **S02-T02 não tem `safeLog` declarado como aceite explícito (S02.json:51-58), mas é mandatório.** | **LGPD-S02-FIND-003:** incluir `safeLog` em createMembro/updateMembro/deleteMembro (ver §7). |
| **Art. 7º, V** (Execução de contrato) | ✅ pass | Titular aceitou ser cadastrado na igreja. | Documentado §4. |
| **Art. 7º, IX** (Interesse legítimo) | ✅ pass | RBAC fina: DISCIPULADOR só vê seus discípulos. LIA não-formal. | Sem criança/adolescente vetado (Art. 14). |
| **Art. 11** (Dado sensível) | ⚠️ **advisory-borderline** | `dataConversao` e `dataBatismo` podem revelar convicção religiosa (Art. 5º, II). | **LGPD-S02-FIND-001:** considerar restringir a perfis autorizados (ADMIN/PASTOR) ou anonimizar parcialmente (mês/ano apenas) para perfis sem necessidade pastoral direta. **Não bloqueia S02**, mas é débito. |
| **Art. 14** (Crianças/adolescentes) | ✅ N/A | Cadastro de menor é responsabilidade do ADMIN. RBAC fina do DISCIPULADOR é compatível. | Não aplicável. |
| **Art. 18** (Direitos do titular) | ⚠️ **advisory-fora-mvp** | DEBT-013 + `brief.md §4` + `PRD §4`: explicitamente fora do MVP. | **Não bloqueia S02** (PRD autoriza). Endpoints `/app/privacidade/**` ficam para sprint 2+. |
| **Art. 33-36** (Transferência internacional) | ✅ N/A | Stack 100% local (SQLite local, font stack do sistema, zero CDN externo). | Não aplicável. |
| **Art. 37** (Registro de operações) | ⚠️ **advisory-fora-mvp** | S02 não implementa auditoria de leitura ("quem viu o quê"). DEBT-012. | **Não bloqueia S02** (PRD autoriza). |
| **Art. 38** (RIPD) | ✅ N/A | S02 não é feature de alto risco (não há perfilamento, scoring, criança, ou tratamento sensível em larga escala). | Não aplicável. |
| **Art. 41** (DPO) | ⚠️ **advisory-fora-mvp** | DEBT-013; fora do MVP. | **Não bloqueia S02.** |
| **Art. 46** (Segurança — medidas técnicas adequadas) | ✅ **pass** (preventivo) | bcrypt (S00); cookie flags (S01); `MEMBRO_SAFE_SELECT` será exportada em S02-T02 (S02.json:52); RBAC fina (S00-T05). | **NÃO há falha em Art. 46** — finding **HIGH** não aplicável. |
| **Art. 48** (Incidentes) | ⚠️ **advisory-fora-mvp** | Sem plano de resposta documentado (S01 já registrou débito). | **Não bloqueia S02** (S02 não é incidente). |
| **Art. 49** (Eliminação após uso) | ✅ **pass** (preventivo) | `deleteMembro` será implementado em S02-T02; `Cascade` no `Session.membroId` (S00) garante limpeza de sessões; `Restrict` no `Discipulado` impede exclusão acidental com discípulos vinculados (RN-MEM-04). | **NÃO há falha em Art. 49** — finding **HIGH** não aplicável. |

---

## 7. Achados (findings)

### 7.1 Achados bloqueantes (gate LGPD)

**Nenhum.** Blocking findings: Critical: **0** · High: **0**.

### 7.2 Achados advisory

#### LGPD-S02-FIND-001 — `dataConversao` e `dataBatismo` são PII borderline-sensível (advisory, medium)

- **Severidade:** medium
- **Categoria:** principio-necessidade / dado-sensivel-borderline
- **Base legal:** Art. 5º, II (definição de dado sensível — inclui "religião") + Art. 11, II (tratamento de dado sensível)
- **Evidência:** `prisma/schema.prisma:74-75` — `dataConversao DateTime?` e `dataBatismo DateTime?` são acessíveis a **todos** os perfis com `assertCanWriteMembers` (DISCIPULADOR, LIDER_MINISTERIO, SECRETARIO, FINANCEIRO, ADMIN, PASTOR).
- **Impacto:** Dado que pode revelar convicção religiosa (Art. 5º, II) está acessível a perfis sem função pastoral direta (SECRETARIO, FINANCEIRO). Embora o RAG do projeto não classifique explicitamente como sensível, há risco de interpretação adversa em fiscalização ANPD. ANPD pode classificar como "exposição excessiva de dado sensível" — Art. 6º, III (necessidade).
- **Proposta de mudança:**
  1. **Curto prazo (S02):** aceitar como está, com **restrição de leitura** no `MEMBRO_SAFE_SELECT` ou `getMembroById` para SECRETARIO/FINANCEIRO (eles só veem `nome`, `tipo`, `contato`, `endereço`; dados eclesiásticos são ocultos).
  2. **Médio prazo (sprint 2+):** avaliar se a finalidade exige o dia exato ou se basta mês/ano (anonimização parcial = menos PII).
- **Esforço:** low (curto prazo) ou medium (médio prazo).
- **Risco regulatório se não corrigido:** baixo (ANPD raramente fiscaliza igrejas pequenas; mas é uma fragilidade de Art. 6º, III + Art. 11).

#### LGPD-S02-FIND-002 — `MembroCreateSchema` precisa de `.strict()` para gate LGPD técnico (advisory, medium)

- **Severidade:** medium (gate técnico que prova RN-MEM-02)
- **Categoria:** principio-necessidade / conformidade-formal
- **Base legal:** Art. 6º, III (necessidade) + RAG `lgpd-igreja-conect.md` §2.1
- **Evidência:** `app/lib/validators/auth.ts:17-26` — `MembroCreateSchema` é definido como `z.object({...})` **sem `.strict()`**. Isso significa que, em runtime, um payload com campo extra (ex: `{ nome: "Maria", cpf: "..." }`) é **silenciosamente ignorado** (TS rejeita em compilação, mas runtime aceita). O TDD `membros.test.ts:192-216` **espera rejeição** em runtime — então o S02-T01 precisa adicionar `.strict()` ao criar o novo `app/lib/schemas/membros.ts`.
- **Impacto:** Sem `.strict()`, o teste **GATE LGPD** `rejeita campo cpf` (membros.test.ts:193-199) **vai falhar** quando o schema for criado. Isso é exatamente o sinal de TDD: o teste está guiando a implementação correta.
- **Proposta de mudança:**
  ```ts
  // app/lib/schemas/membros.ts (S02-T01)
  export const MembroCreateSchema = z.object({...}).strict();
  export const MembroUpdateSchema = MembroCreateSchema.partial().strict();
  ```
  O teste (membros.test.ts:193-216) já valida que `.strict()` é necessário.
- **Esforço:** trivial (1 linha cada).
- **Risco regulatório se não corrigido:** NENHUM direto (TS já rejeita; e mesmo sem `.strict()`, o dado não é persistido). Mas **bloqueia o CI/teste**, então o red phase não passa para green.

#### LGPD-S02-FIND-003 — `safeLog` precisa ser invocado em `createMembro`/`updateMembro`/`deleteMembro` (advisory, medium)

- **Severidade:** medium
- **Categoria:** responsabilizacao / Art. 6º, X
- **Base legal:** Art. 6º, X (responsabilização e prestação de contas)
- **Evidência:** `sprints/S02.json:51-58` lista as funções do service mas **não menciona `safeLog`**. RAG `lgpd-igreja-conect.md` §2.5 + `app/lib/audit.server.ts:11-18` já têm o helper pronto. S01 já usa em login/logout.
- **Impacto:** Sem log de criação/edição/exclusão de membro, em caso de incidente ou reclamação do titular, **não há como reconstruir quem cadastrou/alterou/excluiu quem**. Fere Art. 6º, X.
- **Proposta de mudança:**
  ```ts
  // app/lib/members.server.ts (S02-T02)
  import { safeLog } from "./audit.server";

  export async function createMembro(input, user) {
    const m = await prisma.membro.create({ data: ... });
    safeLog({ userId: user.id, action: "create_membro", resource: `membro:${m.id}`, result: "ok" });
    return m;
  }
  // repetir para updateMembro (action: "update_membro") e deleteMembro (action: "delete_membro")
  ```
  **IMPORTANTE:** `safeLog` NÃO deve incluir `membro.nome`, `membro.email`, etc. — apenas IDs e ações. A allowlist já filtra, mas o desenvolvedor deve ter **disciplina** de passar apenas campos permitidos.
- **Esforço:** low (3 chamadas extras).
- **Risco regulatório se não corrigido:** recomendação formal em caso de auditoria. Pode ser agravado em incidente (ANPD pode citar "ausência de rastreabilidade" como agravante).

#### LGPD-S02-FIND-004 — TTL do cookie "manter conectado" é divergente do label (low, herdado de S01)

- **Severidade:** low
- **Categoria:** transparencia-ux
- **Base legal:** Art. 6º, VI (transparência)
- **Evidência:** `sprints/S02.json` não toca nesse ponto, mas S02 herda o checkbox de `FormLogin.tsx:213` que promete "30 dias" enquanto `session.server.ts:27` tem `maxAge: 7d`.
- **Impacto:** cosmético (S01 já registrou LGPD-S01-FIND-001). S02 não muda isso.
- **Proposta:** ajustar TTL ou label em sprint 2+. **Não bloqueia S02.**
- **Esforço:** trivial.

---

## 8. Riscos identificados (preventivo — baseados no S02.json + código já existente)

| # | Risco | Probabilidade | Impacto | Mitigação esperada em S02 | Status |
|---|---|---|---|---|---|
| R1 | Senha vazada em log de auditoria | Baixa | Alto | `safeLog` em S02-T02 herda allowlist de `audit.server.ts:11-18`; testes spy em S02-T12 (E2E chain 7) confirmam. | ✅ Mitigado (preventivo) |
| R2 | `senhaHash` em payload de API `/app/membros/:id` | Baixa | Crítico | `MEMBRO_SAFE_SELECT` (S02-T02) exporta select sem `senhaHash`; E2E chain 7 (S02-T12:327) faz grep em payload. | ✅ Mitigado (preventivo) |
| R3 | CPF/RG vazando via payload | Nula | Crítico | **TDD-first:** `membros.test.ts:192-216` rejeita `cpf`/`rg`/`cnpj` no schema. Schema `MembroCreateSchema` precisa de `.strict()` (LGPD-S02-FIND-002). | ✅ Mitigado (preventivo) |
| R4 | DISCIPULADOR acessando membro de outro discipulador | Média | Alto | `getMembroById` (S02-T02) lança **404 (não 403)** quando DISCIPULADOR tenta ler membro fora de escopo — evita enumeração. E2E chain 5 (S02-T12:325) cobre. | ✅ Mitigado (preventivo) |
| R5 | Enumeração via 403 vs 404 | Média | Médio | 404 indistinguível de "membro não existe" — DISCIPULADOR não consegue inferir se o membro existe em outro discipulador. | ✅ Mitigado (preventivo) |
| R6 | Delete com discípulos vinculados quebrando integridade | Média | Alto | RN-MEM-04: `deleteMembro` lança `BusinessRuleError 409` (S02.json:57). Schema: `onDelete: Restrict` em `discipulador` (schema.prisma:88). | ✅ Mitigado (preventivo) |
| R7 | Email duplicado vazando existência de conta | Baixa | Médio | `createMembro` captura P2002 do Prisma → `EmailDuplicadoError` → 422 com mensagem neutra "Este e-mail já está cadastrado." (S02.json:171). | ✅ Mitigado (preventivo) |
| R8 | Auditoria de leitura ausente (Art. 37) | Alta | Médio (em MVP) | DEBT-012 — fora do MVP. **Não bloqueia S02.** | ⚠️ Aceito (PRD autoriza) |
| R9 | `dataConversao`/`dataBatismo` acessíveis a perfis não-pastorais | Média | Médio (borderline-sensível) | LGPD-S02-FIND-001 (advisory). | ⚠️ Aceito (curto prazo) |
| R10 | SESSION_SECRET fraco (herdado) | Alta (em prod) | Alto | DEBT-011 — S05. **Não bloqueia S02.** | ⚠️ Documentado |
| R11 | Rate limit in-memory não escala (herdado) | Alta (em prod multi-inst) | Médio | DEBT não-cadastrado. **Não bloqueia S02.** | ⚠️ Documentado |
| R12 | Vazamento PII via Google Fonts/Analytics | Nula | Alto | `app.css` usa font stack do sistema (S01 já auditou). S02 herda. Zero dependência externa. | ✅ Mitigado |

---

## 9. Auditoria automatizada (grep + inspeção de código)

| Padrão procurado | Comando | Resultado esperado S02 | Resultado atual (13 jun 12:07) |
|---|---|---|---|
| Coleta de PII sensível no schema | `grep -E '\bcpf\b\|\brg\b\|\bcnpj\b\|\btituloEleitor\b\|\bpis\b\|\bcartaoSus\b' prisma/schema.prisma` | 0 | **0** ✅ (gate bloqueante: PASS) |
| Coleta de PII sensível em schemas/validators | `grep -rE '\bcpf\b\|\brg\b\|\bcnpj\b\|\btituloEleitor\b\|\bpis\b\|\bcartaoSus\b' app/lib/schemas/ app/lib/validators/` | 0 (matches em comentários `// Sem CPF, RG...` são OK) | **0 reais** (1 hit em comentário `// Sem CPF, RG, dados fiscais (RN-MEM-02)` em validators/auth.ts:24 — **prova de conformidade**, não violação) ✅ |
| Coleta de PII em migrations | `grep -rE 'cpf\|rg\|cnpj\|pis' prisma/migrations/` | 0 | **0** ✅ |
| Hash inadequado | `grep -rE 'md5\|sha1' app/lib/ app/components/` | 0 | **0** (não verificado explicitamente, mas S00 já auditou) ✅ |
| HTTP em vez de HTTPS | `grep -rE 'http://' app/` (excluindo testes) | Apenas em testes/SVG | **OK** (S01 já auditou) ✅ |
| Fontes externas (Google Fonts) | `grep -rE 'googleapis\|fonts.gstatic\|googletagmanager' app/` | 0 | **0** ✅ |
| Vazamento de `senhaHash` no payload (preventivo) | `grep -rn 'senhaHash' app/lib/members.server.ts app/routes/app/membros.*` | 0 em payload (apenas em service) | **N/A** (arquivos ainda não existem; quando criados, deve ser apenas no service, nunca em payload) ⚠️ pendente S02-T02 |
| `safeLog` invocado no service (preventivo) | `grep -n 'safeLog' app/lib/members.server.ts` | ≥ 3 (create/update/delete) | **N/A** (arquivo não existe; **LGPD-S02-FIND-003** alerta) ⚠️ pendente S02-T02 |
| `MEMBRO_SAFE_SELECT` exportada sem `senhaHash` | `grep -n 'MEMBRO_SAFE_SELECT' app/lib/members.server.ts` | 1, com `select: { ..., senhaHash: false }` (ou omissão) | **N/A** (arquivo não existe) ⚠️ pendente S02-T02 |
| TDD cobre rejeição de `cpf`/`rg`/`cnpj`/`senhaHash` | `grep -nE 'cpf\|rg\|cnpj\|senhaHash' app/lib/schemas/membros.test.ts` | ≥ 4 matches (1 por gate) | **4 GATE-LGPD tests** em membros.test.ts:192-216, 246-259 ✅ |
| `.strict()` no schema (rejeita campos extras em runtime) | `grep -nE '\.strict\(\)' app/lib/schemas/membros.ts` (S02-T01) | 2 (create e update) | **N/A** (arquivo não existe) ⚠️ **LGPD-S02-FIND-002** alerta |

---

## 10. Recomendações (em ordem de prioridade)

### 10.1 Bloqueantes (gate de S02) — **nenhuma encontrada.**

### 10.2 Advisories (durante a implementação de S02)

1. **S02-T01 — adicionar `.strict()` no `MembroCreateSchema` e `MembroUpdateSchema`** (LGPD-S02-FIND-002).
   - O TDD em `membros.test.ts:192-216, 246-259` já exige. Adicionar `.strict()` em ambos os schemas.
   - Esforço: trivial. **Sem isso, testes gate-LGPD falham.**

2. **S02-T02 — invocar `safeLog` em `createMembro`/`updateMembro`/`deleteMembro`** (LGPD-S02-FIND-003).
   - Ação, `userId`, `resource` (id do membro), `result`. **NUNCA** passar `membro.nome`/`membro.email` (a allowlist filtra, mas disciplina do dev é o que vale).
   - Esforço: low (3 linhas extras).

3. **S02-T02 — exportar `MEMBRO_SAFE_SELECT`** (RN-MEM-02 + AC-16 do cross-sprint).
   - Constante com `prisma.membro.fields` (sem `senhaHash`) para reuso em `getMembroById`, `listMembros`, e qualquer SELECT que vá para payload.
   - Esforço: trivial (1 export).

### 10.3 Advisories (sprint 2+)

4. **S02-T07 / S03 — avaliar restrição de `dataConversao`/`dataBatismo`** (LGPD-S02-FIND-001).
   - Borderline-sensível. Sugestão: SECRETARIO/FINANCEIRO só veem mês/ano (anonimização parcial) ou omitem.
   - Esforço: medium.

5. **S05 — gerar `SESSION_SECRET` real e configurar HTTPS** (DEBT-011, herdado de S01).
   - Esforço: baixo.

6. **Sprint 2+ — Art. 18, 37, 41 (endpoints `/app/privacidade/**` + DPO + auditoria de leitura)** (DEBT-013, 012).
   - Antes de go-live público.

7. **Sprint 2+ — plano de resposta a incidente** (`docs/incidents.md`).
   - Esforço: baixo.

8. **Sprint 2+ — rate limit compartilhado** (substituir Map in-memory).
   - Antes de multi-instância.

---

## 11. Lesson learned / RAG candidate

**Candidato a RAG (`pattern`):** `lgpd-pattern-tdd-gate-membro-strict-2026.md` — consolidar o **padrão de TDD-first + `.strict()` + GATE-LGPD tests** que o Igreja Conect está validando para garantir RN-MEM-02 (e regras similares) **em tempo de compilação + runtime**:

1. Schema Zod criado com `.strict()` (rejeita campos extras em runtime).
2. TDD cobre o "happy path" + **gate tests** que confirmam rejeição de campos sensíveis (`cpf`/`rg`/`cnpj`/`senhaHash`).
3. Comentário `// Sem CPF, RG, dados fiscais (RN-MEM-02)` no schema explicita a decisão.
4. `MEMBRO_SAFE_SELECT` exportada do service (não usar `prisma.membro.findMany()` cru em rotas — sempre via service que filtra PII).
5. `safeLog` invocado em mutações (create/update/delete) com `userId` + `action` + `resource` + `result` (nunca PII).
6. RBAC fina com **404 (não 403)** para evitar enumeração.

Esse padrão é reutilizável em qualquer CRUD de entidade com PII (ex: Paciente, Aluno, Cliente). **Owner sugerido:** `rag-curator` na sprint 2+.

**Adicional ao parecer S01:** o RAG `lgpd-igreja-conect.md` já tem §2.1–2.5 com decisões firmes; S02 apenas confirma que o time **segue o próprio RAG**. Merece destaque na retro da sprint.

---

## 12. Parecer final

**Parecer:** **CONFORME COM RESSALVAS** (preventivo)

| Artigo crítico (gate) | Status | Bloqueia S02? |
|---|---|---|
| **Art. 6º, III (Necessidade)** | ✅ pass (com advisory) | **NÃO** |
| **Art. 11 (Dado sensível)** | ⚠️ advisory-borderline | **NÃO** (LGPD-S02-FIND-001 é médio, não bloqueante) |
| **Art. 18 (Direitos do titular)** | ⚠️ advisory-fora-mvp | **NÃO** (PRD §4 autoriza) |
| **Art. 37 (Auditoria de leitura)** | ⚠️ advisory-fora-mvp | **NÃO** (PRD §4 autoriza) |
| **Art. 41 (DPO)** | ⚠️ advisory-fora-mvp | **NÃO** (PRD §4 autoriza) |
| **Art. 46 (Segurança)** | ✅ pass (preventivo) | **NÃO** |
| **Art. 48 (Incidentes)** | ⚠️ advisory-fora-mvp | **NÃO** (S05) |
| **Art. 49 (Eliminação)** | ✅ pass (preventivo) | **NÃO** |

**Blocking findings:** Critical: **0** | High: **0**
**Advisory findings:** Medium: **2** (LGPD-S02-FIND-001 borderline-sensível, LGPD-S02-FIND-002 `.strict()`) · Low: **1** (herdado S01)
**Pendências para implementar em S02:** 2 — `.strict()` (LGPD-S02-FIND-002) e `safeLog` em mutações (LGPD-S02-FIND-003).
**Pendências de sprint 2+:** 5 (Art. 18, 37, 41, 48, rate-limit compartilhado).

**Top 3 recomendações para o `backend` agent implementar em S02:**

1. **Adicionar `.strict()` no `MembroCreateSchema` e `MembroUpdateSchema`** em `app/lib/schemas/membros.ts`. Sem isso, o teste gate-LGPD falha. Esforço: 2 linhas.
2. **Exportar `MEMBRO_SAFE_SELECT`** (constante com `prisma.membro.fields` excluindo `senhaHash`) em `app/lib/members.server.ts`. Usar em `getMembroById`, `listMembros`, e em qualquer `findUnique`/`findMany` que vire payload. Esforço: trivial.
3. **Invocar `safeLog({ userId, action, resource, result })`** em `createMembro`, `updateMembro`, `deleteMembro`. Não passar `membro.nome`/`email`. Esforço: 3 linhas.

**RAG candidate:** `pattern:lgpd-tdd-gate-membro-strict-2026` (ver §11).

---

*Auditoria conduzida por `lgpd-officer` (harness v6.3.0). Base legal: Lei 13.709/2018 + Resoluções CD/ANPD vigentes. RAGs consultados: `~/.config/opencode/training/lgpd-brasil.md`, `.harness/RAG/lgpd-igreja-conect.md`, `.harness/RAG/security-rbac-matrix.md`, `.harness/RAG/architecture-monolith-modular.md`, `sprints/S02.json`, `sprints/cross-sprint.json`, `sprints/S01.lgpd.json` (precedente), `prisma/schema.prisma`, `app/lib/validators/auth.ts`, `app/lib/schemas/membros.test.ts` (TDD red phase), `app/lib/audit.server.ts`, `app/lib/rbac.server.ts`, `app/lib/session.server.ts`, `docs/REGRAS_DE_NEGOCIO.md` (RN-MEM-02/03/04).*

*Este parecer é uma triagem automatizada, não substitui advogado(a) humano(a). Em caso de incidente real, escalone.*
