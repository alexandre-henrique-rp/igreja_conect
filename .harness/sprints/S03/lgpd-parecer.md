# Parecer LGPD — Sprint S03 (Membros: Tipos, Discipulado, Ministérios, Fidelidade Financeira)

**Projeto:** Igreja Conect
**Sprint auditada:** S03 — 13 tasks (S03-T01 a S03-T13)
**Auditor:** `lgpd-officer` (harness v6.3.0)
**Lei aplicada:** Lei 13.709/2018 (LGPD)
**Data da auditoria:** 2026-06-13 (16:44 UTC)
**Status:** ✅ **CONFORME COM RESSALVAS** — pode avançar para `qa-gate`

---

## 1. Sumário executivo

| Item | Resultado |
|---|---|
| **Parecer final** | ✅ **CONFORME COM RESSALVAS** |
| **Blocking findings** | Critical: **0** · High: **0** · Medium: **2** · Low: **0** · Info: **1** |
| **Gate RN-MEM-03 — Fidelidade 3 camadas** | ✅ **PASS** (3/3 camadas implementadas e testadas) |
| **Gate RN-MEM-06 (zero cron)** | ✅ **PASS** |
| **Gate RN-MEM-02 (sem CPF)** | ✅ **PASS** |
| **LGPD threshold (0 critical, 0 high, <3 medium)** | ✅ **PASS — não bloqueia** |

> ⚠️ **Nota:** Este parecer SUBSTITUI o anterior (`S03-parecer.md` gerado antes da implementação). O código foi implementado desde então, e os 3 HIGH bloqueantes do parecer anterior foram todos resolvidos.

---

## 2. RN-MEM-03 — Fidelidade Financeira: 3 camadas (GATE PRINCIPAL)

### Camada 1 (UI) — ✅ PASS

**Arquivo:** `app/components/TabFidelidadeFinanceira.tsx` (existe ✓)
**Arquivo:** `app/components/TabsMembro.tsx`

```tsx
// TabsMembro.tsx:172 — Tab Fidelidade SÓ renderiza se canSeeFinancials
{canSeeFinancials && (
  <Link to="?tab=fidelidade" ...>Fidelidade</Link>
)}

// TabsMembro.tsx:224 — Conteúdo da tab também protegido
{effectiveTab === "fidelidade" && canSeeFinancials && (
  <TabFidelidadeFinanceira membroId={membro.id} />
)}
```

**Testes:** `TabFidelidadeFinanceira.test.tsx` (6 testes), `TabsMembro.test.tsx` (3 testes de permissão).

### Camada 2 (Loader) — ✅ PASS

**Arquivo:** `app/routes/app/membros.$id.tsx`

```tsx
// linha 83-86 — se ?tab=fidelidade sem permissão, força tab=dados
const canSeeFinancials =
  user.cargo != null && (FINANCIAL_CARGOS as readonly string[]).includes(user.cargo);
const activeTab: TabKey =
  tabFromUrl === "fidelidade" && !canSeeFinancials ? "dados" : tabFromUrl;
```

**Testes:** `membros.$id.test.tsx:401-486` — SECRETARIO bypass → tab Fidelidade some.

### Camada 3 (Service) — ✅ PASS

**Arquivo:** `app/lib/finance.server.ts`

```ts
// linha 62 — assertCanSeeFinancials é a PRIMEIRA linha (antes de qualquer DB)
export async function getDizimosByMembro(membroId: string, user: SessionUser) {
  assertCanSeeFinancials(user);  // <- Camada 3
  // ... só então toca o DB
}
```

**Testes:** `finance.server.test.ts` (7 testes) — cobre ADMIN/PASTOR/FINANCEIRO (passam) e SECRETARIO/DISCIPULADOR/LIDER_MINISTERIO/sem-cargo (403). Spy confirma que `lancamento.findMany` NÃO é chamado para bloqueados.

---

## 3. Status dos demais gates

| Gate | Status | Evidência |
|---|---|---|
| **RN-MEM-06** (sem cron automático) | ✅ PASS | `grep` → 0 setTimeout/setInterval/node-cron/bull no runtime |
| **RN-MEM-02** (sem CPF/RG) | ✅ PASS | `grep` → 0 no schema |
| **MEMBRO_SAFE_SELECT** | ✅ PASS | Todas as queries usam select canônico sem senhaHash |
| **safeLog em promoverTipo** | ✅ PASS | `members.server.ts:395` — log de auditoria implementado |
| **RBAC min. manager** | ✅ PASS | `rbac.server.ts` — 5 helpers + testes unitários |
| **E2E de bypass** | ❌ AUSENTE | `e2e/fidelidade-bypass.spec.ts` e `e2e/discipulado.spec.ts` não existem |

---

## 4. Findings

### Medium — LGPD-FIND-S03-001: safeLog ausente em mutações de discipulado e ministérios

**Art. violado:** Art. 6º, X (responsabilização e prestação de contas)

**Arquivos:**
- `app/lib/discipleship.server.ts` — `assignDisciple`, `unassignDisciple`
- `app/lib/ministries.server.ts` — `createMinisterio`, `updateMinisterio`, `deleteMinisterio`, `addMembroToMinisterio`, `removeMembroFromMinisterio`

**Impacto:** Operações que alteram dados sensíveis religiosos (vínculo de discipulado, atribuição a ministérios) não são registradas. ANPD pode solicitar evidências de quem fez o que e quando.

**Recomendação:** Adicionar `safeLog({ userId, action, resource, result, timestamp })` após cada mutação. Pattern já estabelecido em `members.server.ts:395`:
```ts
safeLog({ userId: user.id, action: "promover_tipo", resource: "membro", result: "ok", timestamp: Date.now() });
```

---

### Medium — LGPD-FIND-S03-002: Testes E2E de bypass não implementados

**Art. violado:** Art. 46 (medidas de segurança) + RN-MEM-03

**Arquivos:** `e2e/fidelidade-bypass.spec.ts` (NÃO EXISTE), `e2e/discipulado.spec.ts` (NÃO EXISTE)

**Impacto:** Defesa em 3 camadas existe e é testada unitariamente, mas sem E2E não há prova integrada em browser real. Refactor futuro pode quebrar a cadeia.

**Recomendação:** Implementar E2E com 3 chains: (1) UI — SECRETARIO não vê tab; (2) URL — bypass `?tab=fidelidade` → `tab=dados`; (3) Service — chamada direta a `getDizimosByMembro` → 403.

---

### Informational — LGPD-FIND-S03-003: Dados sensíveis sem consentimento granular

**Art. violado:** Art. 11, I (consentimento específico e destacado)

**Arquivos:** Schema `dataConversao`, `dataBatismo`, `tipo`, `discipuladorId`, `ministerios[]`

**Impacto:** Dados sensíveis religiosos são tratados sem registro auditável de consentimento. Fora do MVP (`brief.md §4`).

**Recomendação:** Criar tabela `Consentimento` em Sprint 2+ com `membroId`, `finalidade`, `granted`, `timestamp`, `ip`, `policyVersion`.

---

## 5. Conformidade por artigo LGPD

| Artigo | Status | Detalhe |
|---|---|---|
| **Art. 5º** (definições) | ✅ PASS | Modelagem correta; PII sensível religioso identificado |
| **Art. 6º, I** (finalidade) | ✅ PASS | Finalidades declaradas no código |
| **Art. 6º, III** (necessidade) | ✅ PASS | Sem CPF, sem coleta excessiva (RN-MEM-02) |
| **Art. 6º, VII** (segurança) | ✅ PASS | 3 camadas RN-MEM-03 implementadas |
| **Art. 6º, X** (responsabilização) | ⚠️ PARCIAL | safeLog presente em promoverTipo, ausente em discipulado/ministérios |
| **Art. 11** (dados sensíveis) | ⚠️ PARCIAL | Modelagem OK; sem tabela de consentimento (fora MVP) |
| **Art. 18** (direitos titular) | ⚠️ FORA MVP | 2/10 implementados (herdado S02) |
| **Art. 46** (segurança técnica) | ✅ PASS | defense in depth implementado |
| **Art. 49** (transf. internacional) | ✅ N/A | Stack 100% local |

---

## 6. Decisão do agente

```json
{
  "agent": "lgpd-officer",
  "sprint": "S03",
  "parecer": "CONFORME COM RESSALVAS",
  "blockingFindings": { "critical": 0, "high": 0, "medium": 2, "low": 0, "informational": 1 },
  "gates": {
    "rn_mem_03_fidelidade_3_camadas": "pass",
    "rn_mem_06_zero_cron": "pass",
    "rn_mem_02_sem_cpf": "pass",
    "safeLog_mutacoes": "fail (advisory)",
    "e2e_bypass_tests": "fail (advisory)"
  },
  "passed": true,
  "blockers": [],
  "advisory": [
    "LGPD-FIND-S03-001: Adicionar safeLog nas mutações de discipulado e ministérios",
    "LGPD-FIND-S03-002: Implementar testes E2E de bypass (S03-T12)",
    "LGPD-FIND-S03-003: Criar tabela Consentimento em Sprint 2+",
    "Art. 18 direitos do titular: programar para Sprint 2+"
  ],
  "nextAction": "Avançar para qa-gate. Os 2 MEDIUM findings devem ser endereçados em S04 ou S05."
}
```

**`harness-advance` PODE ser chamado.** Status `lgpdStatus = "compliant-with-advisory"`.
