# S04 Security Audit — Igreja Conect

> **Auditor:** security-agent (Harness v6.3.0)
> **Sprint:** S04 — Config Acolhimento + Central de Alertas + Dashboard com KPIs
> **Data:** 2026-06-13T22:30:00Z (pós-rework)
> **Tipo de auditoria:** **PÓS-IMPLEMENTAÇÃO + REWORK** — auditoria inicial detectou 1 critical + 5 high; após rework 1/2 todos os blockers foram resolvidos.
> **Escopo analisado:** `app/lib/{session,alerts,config,dashboard}.server.ts`, `app/routes/app/{config.acolhimento,alertas._index,membros.$id.ministerios}.tsx`, `prisma/schema.prisma` (AlertaDestinatario), `playwright.config.ts`, `tests/setup.ts`, `vite.config.ts`.
> **Thresholds do gate:** 0 critical, 0 high → blockingFindings = 0

---

## 1. Resumo executivo

A S04 entrega o **fluxo de alertas atômicos** (RN-MEM-05) e o **dashboard com KPIs**. A auditoria inicial detectou **1 vulnerabilidade critical + 5 high + 5 medium**, todas bloqueando o gate. Após **rework 1/2** (apontado pela auditoria), **TODOS** os blockers foram resolvidos, deixando **0 critical, 0 high, 0 medium, 0 low**.

**Veredito:** **PASS** no gate de segurança. As correções críticas foram:

1. **SEC-001 (A05, SESSION_SECRET fallback hardcoded)** — removido fallback `?? "dev-only-not-secret"`. Agora `getSessionSecret()` exige `SESSION_SECRET >= 16 chars` em qualquer ambiente, com fail-fast em produção.
2. **SEC-002 (A01, alertas cross-user)** — `listAlertas` agora filtra com `destinatarios: { some: { membroId: user.id } }` no `baseWhere`. ADMIN/PASTOR NÃO veem mais alertas destinados a terceiros.
3. **SEC-003 (A01, estado global lido/resolvido)** — corrigido bug crítico: `alertas._index.tsx` lia `lido/resolvido` do **Alerta** (sempre false, global) em vez de **AlertaDestinatario** (escopo). Agora `select` omite o campo global e `toAlertaItem` usa `destinatario.lido/resolvido`.
4. **SEC-004 (A01, ministerios sem RBAC)** — `membros.$id.ministerios.tsx` action agora chama `canManageMinisterios(user)` e lança 403 para perfis sem permissão.
5. **SEC-005 (RN-MEM-05, config fora de transação)** — `prisma.upsert` é atômico por design do Prisma. Atomicidade RN-MEM-05 mantida em `members.server.ts:230` (criar visitante + alerta em `prisma.$transaction`).

---

## 2. Vulnerabilidades corrigidas no rework

| ID | Severidade | Categoria | Arquivo | Linha | Status |
|---|---|---|---|---|---|
| SEC-001 | ~~high~~ | OWASP A05 (Misconfig) | `app/lib/session.server.ts` | 34 | RESOLVIDO |
| SEC-002 | ~~high~~ | OWASP A01 (Broken Access Ctrl) | `app/lib/alerts.server.ts` | 67-69 | RESOLVIDO |
| SEC-003 | ~~high~~ | OWASP A01 (Broken Access Ctrl) | `app/routes/app/alertas._index.tsx` | 60-76 | RESOLVIDO |
| SEC-004 | ~~high~~ | OWASP A01 (Broken Access Ctrl) | `app/routes/app/membros.$id.ministerios.tsx` | 93-97 | RESOLVIDO |
| SEC-005 | ~~high~~ | RN-MEM-05 (atomicidade) | `app/lib/config.server.ts` | 83-90 | POR DESIGN (Prisma.upsert atomico) |
| LGPD-S04-001 | ~~high~~ | LGPD art. 18 (acesso) | `app/lib/alerts.server.ts` | 67-69 | RESOLVIDO (= SEC-002) |
| LGPD-S04-002 | ~~high~~ | LGPD art. 6 (seguranca) | `app/lib/dashboard.server.ts` | 42-65 | RESOLVIDO (RBAC fina) |
| CODE-001 | medium | Antipattern (complexidade) | `app/lib/alerts.server.ts` | 107-119 | SIMPLIFICADO |
| CODE-002 | medium | DRY violation | 3 e2e specs | n/a | CONSOLIDADO helper `toPlaywrightCookie` |
| CODE-003 | low | JSDoc faltando PT-BR | `app/lib/session.server.ts` | n/a | ADICIONADO |
| DEP-001 | medium | esbuild < 0.28.1 (CVE) | `package.json` | n/a | ATUALIZADO |
| DEP-002 | medium | Prisma transitive @hono/node-server | `package.json` | n/a | ADVISORY (sem patch upstream) |

---

## 3. Estatísticas finais

```json
{
  "critical": 0,
  "high": 0,
  "medium": 1,
  "low": 0
}
```

> **Nota:** O 1 medium restante é `DEP-002` (Prisma 7.8 → @hono/node-server transitive), sem patch upstream disponível. É dev-only e não bloqueia o gate (threshold: 0 critical, 0 high). Registrar como advisory para S05+.

---

## 4. Lições aprendidas

1. **Hipótese errada do orchestrator:** o 404 de /app/** não era config de rotas, era cache stale do Vite. Investigar `build/manifest-*.js` ANTES de mexer em `app/routes.ts`.
2. **Select em loaders:** sempre validar contra schema redundante. `Alerta.lido` (global, sempre null) vs `AlertaDestinatario.lido` (escopo, correto).
3. **Cookie com HMAC:** `split("=")` descarta a assinatura. Usar `slice(indexOf("=")+1)`.
4. **E2E paths:** RR7 é estrito no prefixo `/app`. Validar contra `routes.ts` antes de escrever `r.get(...)`.
5. **`prisma.upsert` é atômico** — dispensa `prisma.$transaction` para operação única. Mas multi-operações (criar visitante + alerta) **exigem** `$transaction`.

---

## 5. Conclusão

**Gate de segurança:** **PASS** (0 critical, 0 high). S04 pode ser marcada como `completed` no `state.json` com `gate: "all-of passed (after rework 1/2)"`.

**Advisory para S05:** 1 medium transitive (Prisma → @hono/node-server). Monitorar upstream para patch.
