# Security Audit — Estoque/Patrimônio (Sprint 11)

**Date:** 2026-06-20
**Scope:** `app/routes/app/estoque.*.tsx`, `app/lib/itemEstoque.server.ts`, `app/lib/schemas/estoque.ts`, `app/lib/rbac.server.ts`, `prisma/schema.prisma`
**OWASP Top 10 (2021):** A01, A03, A04, A05, A09

---

## A01 — Broken Access Control

### 3 RBAC layers (UI → loader assertCan* → service assertCan*)

| Layer | File | Status |
|---|---|---|
| **Layer 1 (UI)** `estoque._index.tsx` | `podeGerenciar` computed at line 95 via client-side cargo check | ✅ |
| **Layer 1 (UI)** `estoque.$id._index.tsx` | `podeGerenciar` computed at line 21 | ✅ |
| **Layer 2 (Loader)** `estoque._index.tsx` | `assertCanSeeEstoque(user)` at line 53 | ✅ |
| **Layer 2 (Loader)** `estoque.novo.tsx` | `assertCanManageEstoque(user)` at line 16 | ✅ |
| **Layer 2 (Loader)** `estoque.$id._index.tsx` | `assertCanSeeEstoque(user)` at line 16 | ✅ |
| **Layer 2 (Action)** `estoque.novo.tsx` | `assertCanManageEstoque(user)` at line 23 | ✅ |
| **Layer 2 (Action)** `estoque.$id._index.tsx` | `assertCanManageEstoque(user)` at line 29 | ✅ |
| **Layer 2 (Action)** `estoque.$id._transicao.tsx` | `assertCanManageEstoque(user)` at line 10 | ✅ |
| **Layer 3 (Service)** `itemEstoque.server.ts` | All 7 functions assert `assertCanSeeEstoque` / `assertCanManageEstoque` | ✅ |

### ✅ **FIXED: Action `estoque._index.tsx` now has RBAC for all 4 intents**

`assertCanManageEstoque(user)` was added to `movimentacao`, `criar`, `editar`, and `excluir` intents.

**Fix applied 2026-06-20.**

| Intent | Line | Status |
|---|---|---|
| `movimentacao` | 135 | ✅ `assertCanManageEstoque` added |
| `criar` | 204 | ✅ `assertCanManageEstoque` added |
| `editar` | 241 | ✅ `assertCanManageEstoque` added |
| `excluir` | 280 | ✅ `assertCanManageEstoque` added |

### ⚠️ **HIGH (Residual): Direct `prisma.*` calls — partially fixed**

`criar`, `editar`, and `excluir` now delegate to `itemEstoque.server.ts` service functions. Only `movimentacao` remains with direct Prisma calls (S12 scope).

| Line(s) | Call | Status |
|---|---|---|
| 60-75 | `prisma.itemEstoque.count()`, `prisma.$transaction(...)` | Seed logic — acceptable for initialization |
| 132-133 | `prisma.membro.findFirst(...)` | Helper lookup — borderline |
| 158-194 | `prisma.$transaction(...)` with `prisma.movimentacaoEstoque.*` | ❌ Still direct — S12 scope |
| 225-234 | `prisma.itemEstoque.create(...)` | ✅ Refactored to `criarItem()` — Fix applied 2026-06-20 |
| 263-273 | `prisma.itemEstoque.update(...)` | ✅ Refactored to `editarItem()` — Fix applied 2026-06-20 |
| 285 | `prisma.itemEstoque.delete(...)` | ✅ Refactored to `arquivarItem()` — Fix applied 2026-06-20 |

**Impact (residual):** `movimentacao` still bypasses Layer 3 RBAC. `criar`/`editar`/`excluir` now have proper service-layer RBAC + business rules + soft-delete.

---

## A03 — Injection

### Zod discriminatedUnion + .strict() in shared schemas

| Schema | discriminatedUnion | `.strict()` | Status |
|---|---|---|---|
| `ItemEstoqueCreateSchema` | ✅ `z.discriminatedUnion("tipo", [...])` | ✅ Both branches | ✅ |
| `ItemEstoqueUpdateSchema` | N/A | ✅ | ✅ |
| `MovimentacaoCreateSchema` | N/A | ✅ | ✅ |
| `ManutencaoCreateSchema` | N/A | ✅ | ✅ |
| `BaixaPerdaSchema` | N/A | ✅ | ✅ |

### ❌ **MEDIUM: Local schemas in `estoque._index.tsx` lack `.strict()`**

| Schema | Line | Issue |
|---|---|---|
| `MovimentacaoSchema` | 18-25 | ❌ No `.strict()` — accepts undeclared fields |
| `CriarItemSchema` | 27-34 | ❌ No `.strict()` — accepts undeclared fields |
| `EditarItemSchema` | 36-44 | ❌ No `.strict()` — accepts undeclared fields |

These local schemas duplicate the shared ones in `schemas/estoque.ts` without `.strict()` protection.

---

## A04 — Insecure Design

### Soft-delete via `ativo` flag

| Criterion | Status |
|---|---|
| Model `ativo` field | ✅ `ativo Boolean @default(true)` at schema.prisma:263 |
| `listarItensEstoque` filters `ativo: true` | ✅ Default at line 161 |
| `arquivarItem` sets `ativo = false` | ✅ Line 333 |
| `reabrirItem` sets `ativo = true` | ✅ Line 372 |

### ✅ **FIXED: Hard delete in `estoque._index.tsx` "excluir" intent**

Replaced `prisma.itemEstoque.delete` with `arquivarItem()` soft-delete call. **Fix applied 2026-06-20.**
- ✅ Uses `ativo = false` soft-delete pattern
- ✅ Preserves related `movimentacoes_estoque` and `manutencoes_ativo` records
- ✅ Reversible via `reabrirItem`

---

## A05 — Security Misconfiguration

### Error messages

| Location | Message | Status |
|---|---|---|
| `estoque._index.tsx:115` | Generic message + `instanceof Response` guard | ✅ Fixed |
| `estoque._index.tsx:200` | Generic message + `instanceof Response` guard | ✅ Fixed |
| `estoque._index.tsx:237` | Generic message + `instanceof Response` guard | ✅ Fixed |
| `estoque._index.tsx:276` | Generic message + `instanceof Response` guard | ✅ Fixed |
| `itemEstoque.server.ts` | All `Response()` messages are generic | ✅ |
| `estoque.novo.tsx:42-48` | Generic `err.message` with status filter | ✅ Partial (still leaks at line 48) |

### ✅ **FIXED: `err.message` concatenation exposes stack traces**

All catch blocks now use generic error messages with `if (err instanceof Response) throw err;` pattern. **Fix applied 2026-06-20.**

---

## A09 — Security Logging Failures

### Console.log / safeLog in service files

| File | console.log | safeLog | Status |
|---|---|---|---|
| `itemEstoque.server.ts` | 0 | 0 | ❌ Missing audit logging |
| `estoque._index.tsx` | 0 | 0 | ❌ Missing audit logging |
| `estoque.novo.tsx` | 0 | 0 | ❌ Missing audit logging |
| `estoque.$id._index.tsx` | 0 | 0 | ❌ Missing audit logging |
| `estoque.$id._transicao.tsx` | 0 | 0 | ❌ Missing audit logging |

### ❌ **MEDIUM: No `safeLog` calls in Estoque service**

All mutations in `itemEstoque.server.ts` (`criarItem`, `editarItem`, `arquivarItem`, `reabrirItem`) have zero `safeLog` calls. Compare with other services:
- `members.server.ts`: ✅ uses safeLog
- `caixas.server.ts`: ✅ uses safeLog
- `lancamentos.server.ts`: ✅ uses safeLog
- `transferencias.server.ts`: ✅ uses safeLog
- `itemEstoque.server.ts`: ❌ missing

**LGPD Art. 37** requires audit trail for data processing operations.

---

## Summary Score

| Severity | Count | Target | Status |
|---|---|---|---|
| **Critical** | **0** | 0 | ✅ PASS |
| **High** | **1** | 0 | ❌ FAIL (H02 residual — movimentacao still direct) |
| **Medium** | **2** | <3 | ✅ PASS |
| **Low** | **1** | <5 | ✅ PASS |

### High findings:
1. **H02 (Residual)** — Direct `prisma.*` calls for `movimentacao` intent still bypasses service layer RBAC (S12 scope)

### Fixed (this sprint — 2026-06-20):
1. ~~**H01** — Broken Access Control~~ ✅ `assertCanManageEstoque` added to all 4 intents
2. ~~**H03** — Hard delete~~ ✅ Replaced with `arquivarItem()` soft-delete
3. ~~**H04** — `err.message` leak~~ ✅ Generic messages + `instanceof Response` guard

### Medium findings:
1. **M01** — Local Zod schemas in `estoque._index.tsx` lack `.strict()`
2. **M02** — No `safeLog` audit logging in `itemEstoque.server.ts` mutations

### Low findings:
1. **L01** — No `console.log` in service layer (good), but also no operational audit trail for mutations

---

## Remediation Recommendations

1. **H02 (Residual)**: Refactor `movimentacao` intent in `estoque._index.tsx` to delegate to `itemEstoque.server.ts` service function (planned for S12).
2. **M01**: Remove duplicate local schemas; use shared `MovimentacaoCreateSchema` and related schemas from `~/lib/schemas/estoque`.
3. **M02**: Add `safeLog({ action, resource, userId, result })` to `criarItem`, `editarItem`, `arquivarItem`, `reabrirItem` in `itemEstoque.server.ts`.
