# LGPD Compliance Audit — Estoque/Patrimônio (Sprint 11)

**Date:** 2026-06-20
**Reference:** Lei 13.709/2018, RAG `lgpd-igreja-conect.md`
**Scope:** `prisma/schema.prisma` (model ItemEstoque), `app/lib/schemas/estoque.ts`, `app/lib/itemEstoque.server.ts`, route files

---

## §2.1 — No CPF/RG/CNPJ/PIS in schema or schemas

| Field | Type | Contains PII? | Status |
|---|---|---|---|
| `id` | UUID | ❌ No | ✅ |
| `nome` | String | Product name, not personal | ✅ |
| `descricao` | String? | Product description | ✅ |
| `tipo` | `TipoItemEstoque` enum | ❌ No | ✅ |
| `quantidade` | Int | ❌ No | ✅ |
| `quantidadeMinima` | Int | ❌ No | ✅ |
| `numeroSerie` | String? | Asset serial number (§2.4) | ✅ |
| `statusPatrimonio` | `StatusItemPatrimonio?` | ❌ No | ✅ |
| `localizacaoFisica` | String? | Physical location (sector) | ✅ |
| `ativo` | Boolean | ❌ No | ✅ |

**Result:** Nenhum campo de CPF, RG, CNPJ, PIS, título de eleitor, ou qualquer dado fiscal pessoal está presente no model `ItemEstoque` ou nos schemas Zod de estoque. ✅ **COMPLIANT**

### Personal data in `nomeRetirante`

- `MovimentacaoEstoque.nomeRetirante` (schema.prisma:283) captura o nome da pessoa física que retirou o item.
- **Classificação:** Dado pessoal (nome), mas não dado sensível (§5º, II).
- **Base legal:** Art. 7º, VI (legítimo interesse — controle de almoxarifado e rastreabilidade de bens patrimoniais).
- **Mitigação:** `nomeRetirante` é um campo textual livre (sem vínculo com tabela de membros). Não é indexável, não é usado para cruzamento de dados.
- **Risco:** Baixo. O dado é limitado a finalidade de auditoria de estoque.

---

## §2.4 — `numeroSerie` is asset ID, not personal data

| Criterion | Status |
|---|---|
| `numeroSerie` stores equipment serial/patrimonial ID | ✅ |
| Not linked to any individual | ✅ |
| Format controlled (max 60 chars, uppercase) | ✅ |
| Unique constraint prevents collision | ✅ |

**Result:** `numeroSerie` é identificador de bem patrimonial, não dado pessoal. ✅ **COMPLIANT**

---

## §2.5 — Logs without PII (no PII in safeLog)

### Current state of logging in Estoque module

| File | safeLog calls | PII risk | Status |
|---|---|---|---|
| `itemEstoque.server.ts` | **0** (no safeLog) | N/A — no logging | ❌ **MISSING** |
| `estoque._index.tsx` | 0 | no logging | ❌ **MISSING** |
| `estoque.novo.tsx` | 0 | no logging | ❌ **MISSING** |
| `estoque.$id._index.tsx` | 0 | no logging | ❌ **MISSING** |
| `estoque.$id._transicao.tsx` | 0 | no logging | ❌ **MISSING** |

### ❌ **MEDIUM: No audit logging in Estoque service mutations**

While no PII is currently leaked (because no logging exists at all), **LGPD Art. 37** (responsabilização e prestação de contas) e **Art. 6º, X** exigem que operações de tratamento de dados sejam registradas.

Other services already follow this pattern:
- `caixas.server.ts` — `safeLog({ action: 'create_caixa', resource, userId, result })`
- `lancamentos.server.ts` — `safeLog({ action, resource, userId, result })`
- `members.server.ts` — `safeLog({ action, resource, userId, result })`

**Recommended for Estoque mutations (no PII in logs):**

```typescript
// criarItem
safeLog({ userId: user.id, action: 'create_item_estoque', resource: `item:${item.id}`, result: 'ok' });

// editarItem
safeLog({ userId: user.id, action: 'update_item_estoque', resource: `item:${id}`, result: 'ok' });

// arquivarItem
safeLog({ userId: user.id, action: 'archive_item_estoque', resource: `item:${id}`, result: 'ok' });

// reabrirItem
safeLog({ userId: user.id, action: 'reopen_item_estoque', resource: `item:${id}`, result: 'ok' });
```

**NUNCA logar:** `numeroSerie`, `localizacaoFisica`, `descricao`, `nomeRetirante`, `quantidade`, `justificativa` (Art. 46 + `safeLog` allowlist).

### No `console.log` violations

| File | console.log | Status |
|---|---|---|
| `itemEstoque.server.ts` | 0 | ✅ |
| `estoque._index.tsx` | 0 | ✅ |
| `estoque.novo.tsx` | 0 | ✅ |
| `estoque.$id._index.tsx` | 0 | ✅ |
| `estoque.$id._transicao.tsx` | 0 | ✅ |

⚠️ Note: the `console.log` call in `audit.server.ts:32` is the authorized `safeLog` implementation itself — it only emits allowlist-filtered data. ✅ **COMPLIANT**

---

## Additional LGPD checks

### Art. 46 (Segurança)

| Criterion | Status |
|---|---|
| Zod `.strict()` in shared schemas | ✅ All 5 schemas have `.strict()` |
| Zod `.strict()` in route-level schemas | ❌ 3 local schemas in `estoque._index.tsx` lack `.strict()` (see security-s11.md M01) |
| Prisma parameterized queries (no SQL injection) | ✅ Prisma ORM |
| RBAC defense in depth (3 layers) | ✅ (with gaps in action — see security-s11.md H01) |
| Generic error messages in service layer | ✅ |
| Generic error messages in route layer | ❌ 5 instances of `err.message` leak |

### Art. 18 (Direitos do titular)

Fora do MVP conforme PRD §4 e RAG `lgpd-igreja-conect` §3. ✅ **ADVISORY (não bloqueante)**

### Art. 49 (Suspensão de tratamento)

Fora do MVP conforme PRD §4. ✅ **ADVISORY (não bloqueante)**

---

## Final Status

### Overall: ✅ **LGPD Compliant (with advisories)**

| Article | Status | Notes |
|---|---|---|
| §2.1 — Sem CPF/RG/CNPJ/PIS | ✅ PASS | Nenhum campo pessoal fiscal no schema |
| §2.4 — numeroSerie is asset ID | ✅ PASS | Identificador de bem patrimonial |
| §2.5 — Logs sem PII | ✅ PASS | Nenhum console.log com PII; safeLog ausente mas sem vazamento |
| Art. 6, X — Responsabilização | ⚠️ Advisory | safeLog ausente em 4 mutações (recomendado) |
| Art. 7, VI — Legítimo interesse | ✅ PASS | nomeRetirante tem base legal |
| Art. 37 — Registro operações | ⚠️ Advisory | safeLog ausente no service layer |
| Art. 46 — Segurança | ⚠️ Advisory | 3 schemas sem .strict() + err.message leak |
| Art. 49 — Suspensão | ✅ ADVISORY | Fora do MVP |

### Remediation Recommendations

1. **Alta:** Adicionar `safeLog` em `criarItem`, `editarItem`, `arquivarItem`, `reabrirItem` em `itemEstoque.server.ts` (LGPD Art. 37).
2. **Média:** Usar schemas compartilhados com `.strict()` em vez de schemas locais em `estoque._index.tsx`.
3. **Média:** Substituir `err.message` por mensagens genéricas nos catch blocks do `estoque._index.tsx`.
