---
title: Pattern — RBAC em 3 Camadas (UI / Loader / Service) — Defense in Depth
category: pattern
applies_to:
  - app/components/**/*.tsx
  - app/routes/app/**/*.{ts,tsx}
  - app/lib/rbac.server.ts
  - app/lib/**/*.server.ts
  - tests/**/*rbac*
created: 2026-06-13
updated: 2026-06-13
version: 1.0
status: approved
priority: critical
sources:
  - app/lib/rbac.server.ts (helpers assertCan* e canManage*)
  - app/components/Can.tsx (componente UI)
  - app/routes/app/membros.$id.tsx (loader Camada 2)
  - app/lib/finance.server.ts:getDizimosByMembro (service Camada 3)
  - app/lib/members.server.ts (MEMBRO_SAFE_SELECT)
  - .harness/RAG/security-rbac-matrix.md (matriz canônica)
  - .harness/sprints/S05/code-review.md (validação 90/100)
tags: [pattern, rbac, security, owasp-a01, defense-in-depth, ui-loader-service, authorization, refactor]
owner: rag-curator
---

## 1. Contexto

A Igreja Conect implementa controle de acesso (RBAC) em **3 camadas independentes** para garantir que **nenhuma falha isolada** exponha dados ou permita ações não autorizadas. Este pattern materializa o padrão usado nos módulos Fidelidade (RN-MEM-03), Config Acolhimento (RN-MEM-05), Ministérios e Alertas.

**OWASP A01 (Broken Access Control)** é a vulnerabilidade #1 em aplicações web. A defesa em 3 camadas (UI / Loader / Service) garante:

- **Camada 1 (UI)**: melhor experiência do usuário (esconde ações não autorizadas)
- **Camada 2 (Loader/Action)**: gate de navegação (loader retorna 403 se bypass via URL)
- **Camada 3 (Service)**: **última linha de defesa** antes do I/O (DB nunca é tocado se RBAC falha)

**Por que 3 camadas:** se um dev esquece a Camada 1 (UX ruim, mas não inseguro), a Camada 2 protege. Se um dev esquece a Camada 2 (bypass via URL direto), a Camada 3 protege. Se um dev esquece a Camada 3 (refactor incompleto), as Camadas 1 e 2 ainda protegem em 99% dos casos. **Nenhuma camada é redundante** — cada uma cobre um vetor de ataque diferente.

## 2. Decisão / Regra

### 2.1 Estrutura das 3 camadas

```ts
// CAMADA 1 — UI (componente <Can>)
// app/components/Can.tsx
type CanProps = {
  allow: Cargo[];                      // ex: ['ADMIN', 'FINANCEIRO']
  children: React.ReactNode;
  fallback?: React.ReactNode;          // ex: null (esconde) ou <InfoBox>
};

export function Can({ allow, children, fallback = null }: CanProps) {
  const { user } = useLoaderData<typeof loader>();  // user do context
  return allow.includes(user.cargo) ? <>{children}</> : <>{fallback}</>;
}

// Uso:
<Can allow={['ADMIN', 'FINANCEIRO']}>
  <Button onClick={handlePromover}>Promover para Líder</Button>
</Can>
```

```ts
// CAMADA 2 — Loader/Action (gate de navegação)
// app/routes/app/membros.$id.tsx
export async function loader({ params, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  // Gate de CAMADA 2: força tab=dados se bypass via URL (?tab=fidelidade)
  const tab = getValidTab(url.searchParams.get("tab"), user.cargo);
  if (url.searchParams.get("tab") !== tab) {
    throw redirect(`/app/membros/${params.id}?tab=${tab}`);
  }

  // Service chamado AQUI (Camada 3 também vai rodar)
  return { user, membro, financeiro: await getDizimosByMembro(membroId, user) };
}
```

```ts
// CAMADA 3 — Service (última linha antes do DB)
// app/lib/finance.server.ts
export async function getDizimosByMembro(membroId: string, user: SessionUser) {
  // PRIMEIRO: assertCanSeeFinancials (camada 3, ANTES de qualquer I/O)
  assertCanSeeFinancials(user);

  // SÓ DEPOIS: query Prisma
  return prisma.lancamento.findMany({
    where: { membroId, caixa: { igrejaId: user.igrejaId ?? null } },
    orderBy: { dataCompetencia: "desc" },
  });
}

// app/lib/rbac.server.ts
export function assertCanSeeFinancials(user: SessionUser): void {
  const ALLOWED = ["ADMIN", "PASTOR", "FINANCEIRO"] as const;
  if (!ALLOWED.includes(user.cargo as any)) {
    throw new Response("Acesso restrito a perfis financeiros.", { status: 403 });
  }
}
```

### 2.2 Regras inegociáveis

1. **Camada 3 SEMPRE primeiro**: `assertCan*` é a **primeira linha** da função de service, antes de qualquer `prisma.*` ou `await`. (TOCTOU-safe — não há janela de race condition entre check e use.)

2. **Helpers `assertCan*` em `rbac.server.ts`**: nunca duplicar lógica RBAC inline. Toda decisão de acesso usa um helper exportado. Exemplos:
   - `assertIsAdmin(user)` → 403 se não ADMIN
   - `assertCanWriteMembers(user)` → 403 se não tem permissão
   - `assertCanSeeFinancials(user)` → 403 se não financeiro
   - `canManageMinisterios(user)` → boolean (UI condicional)

3. **UI não é segurança**: comentário `// SECURITY: este <Can> é UX, não segurança. Camada 3 é a real.` é obrigatório em todo uso.

4. **404 vs 403**: **404 em vez de 403** quando o recurso não é do escopo do usuário (anti-enumeração — RN-MEM-03 / OWASP A01). Ver `rbac.server.ts:getDizimosByMembroSafe` para padrão.

5. **Anti-enumeração no login**: 3 caminhos indistinguíveis retornam mesma `Response(401)` com mesma mensagem. Testado em `auth.server.test.ts`.

### 2.3 Mapa de aplicação (matriz módulo × camada)

| Módulo | Camada 1 (UI) | Camada 2 (Loader) | Camada 3 (Service) |
|---|---|---|---|
| **Fidelidade** (RN-MEM-03) | `<Can allow={['ADMIN','PASTOR','FINANCEIRO']}>` em `TabFidelidadeFinanceira` | `membros.$id.tsx:83-86` força `tab=dados` se bypass URL | `getDizimosByMembro` → `assertCanSeeFinancials` PRIMEIRO |
| **Config Acolhimento** (RN-MEM-05) | `canEdit = user.cargo === 'ADMIN'` em `FormConfigAcolhimento` | `config.acolhimento.tsx:32-70` action chama `assertIsAdmin` | `updateConfigAcolhimento` → `assertIsAdmin` |
| **Ministérios** | `onEdit`/`onDelete` escondidos se `!canManageMinisterios(user)` | `membros.$id.ministerios.tsx:93-97` action chama `canManageMinisterios` | `addMembroToMinisterio`/`removeMembroFromMinisterio` → `canManageMinisterios` |
| **Alertas** | (não há ação user-initiated além de marcar lido) | `alertas._index.tsx:60-76` filtra `destinatarios.some.membroId` no select | `listAlertas` → `destinatarios.some.membroId` no `where` |
| **Discipulado** | `assignDisciple` UI escondida se `!canWrite` | `membros.$id.discipulado.tsx` action | `assignDisciple` → `assertCanWriteMembers` + 4 checagens (auto/limite/loop/exists) |
| **Auth** | login form não tem ações por perfil | `routes.ts` middleware `_middleware.tsx` | `verifyCredentials` → 3 caminhos indistinguíveis |

## 3. Consequências

### Positivas

- **Zero brechas em S00-S05**: 4 auditorias de segurança consecutivas (S01, S02, S03, S05) confirmam que **nenhuma regressão de A01** foi introduzida após o rework S04. 5 SEC-* (session secret, alertas cross-user, estado global, ministerios RBAC, config transação) foram resolvidos **sem quebrar** nenhuma das 3 camadas.
- **Refatoração segura**: mover lógica de UI para service (ou vice-versa) não muda a segurança, porque a Camada 3 é sempre chamada.
- **Testes granulares**: cada camada tem seu próprio arquivo de teste:
  - `tests/unit/components/Can.test.tsx` (Camada 1)
  - `tests/integration/routes/*.test.tsx` (Camada 2 — bypass URL)
  - `tests/unit/lib/*.server.test.ts` (Camada 3 — assertCan* spy)
- **Defesa contra bugs futuros**: se um dev novo escrever uma action sem checagem, a Camada 3 do service chamado **ainda protege**.

### Negativas

- **Boilerplate**: cada action/loader/service precisa de 1-3 linhas de RBAC. Aceitável pelo ganho de segurança.
- **Confusão entre camadas**: devs podem achar que `<Can>` é "segurança suficiente" e esquecer a Camada 3. Mitigado por:
  - Comentário explícito em todo uso de `<Can>`
  - Code review (planning-reviewer) tem critério "service-first: nenhuma rota deve usar `prisma.*` se existir `*.server.ts`"
  - Teste E2E `fidelidade-bypass.spec.ts` cobre 3 vetores de bypass (UI, URL, service)

### Trade-offs aceitos

- **Não** criar 1 helper genérico `assertCan(user, operation, resource)` — explosão combinatória. Manter helpers específicos (`assertCanSeeFinancials`, `canManageMinisterios`) com semântica clara.
- **Não** mover RBAC para o schema Prisma (`@@allow` por campo). Seria lock-in de ORM e quebraria migrações. Camada 3 em TS é mais flexível.

## 4. Exemplos

### Exemplo 1: Fidelidade (RN-MEM-03) — referência canônica

**Camada 1 (UI)** em `app/routes/app/membros.$id.tsx`:
```tsx
<TabsMembro activeTab={loaderData.tab}>
  <TabDadosPessoais />
  <TabDiscipulado />
  <TabMinisterios />
  <Can allow={['ADMIN', 'PASTOR', 'FINANCEIRO']} fallback={null}>
    <TabFidelidadeFinanceira />
  </Can>
</TabsMembro>
```

**Camada 2 (Loader)** em `membros.$id.tsx:83-86`:
```ts
// Gate: se SECRETARIO tenta ?tab=fidelidade, redireciona para tab=dados
const requestedTab = url.searchParams.get("tab");
const validTab = getValidTab(requestedTab, user.cargo);
if (requestedTab !== validTab) {
  throw redirect(`/app/membros/${params.id}?tab=${validTab}`);
}
```

**Camada 3 (Service)** em `app/lib/finance.server.ts`:
```ts
export async function getDizimosByMembro(membroId: string, user: SessionUser) {
  // PRIMEIRO: gate. Se SECRETARIO, JÁ ERRA AQUI. DB intocado.
  assertCanSeeFinancials(user);

  // SÓ DEPOIS: query.
  return prisma.lancamento.findMany({
    where: { membroId, caixa: { igrejaId: user.igrejaId ?? null } },
    orderBy: { dataCompetencia: "desc" },
  });
}
```

**Teste E2E** em `e2e/fidelidade-bypass.spec.ts:389`:
```ts
test('Chain 6: source-audit — getDizimosByMembro chama assertCanSeeFinancials (camada 3)', async () => {
  const sourceCode = await fs.readFile('app/lib/finance.server.ts', 'utf-8');
  expect(sourceCode).toContain('assertCanSeeFinancials(user);');
  // Verifica que a chamada é ANTES de qualquer prisma.*
  const assertIdx = sourceCode.indexOf('assertCanSeeFinancials');
  const prismaIdx = sourceCode.indexOf('prisma.lancamento');
  expect(assertIdx).toBeLessThan(prismaIdx);
});
```

### Exemplo 2: Alertas (cross-user isolation, S04 rework)

**Camada 1**: sem ação visível para filtrar (alertas são read-only).
**Camada 2 (Loader)** em `alertas._index.tsx:60-76`:
```ts
// select filtra por destinatario do user logado
const items = await prisma.alerta.findMany({
  where: {
    destinatarios: { some: { membroId: user.id } },  // <-- filtro
  },
  select: {
    id: true, titulo: true, createdAt: true,
    // NÃO selecionar lido/resolvido do Alerta (global, sempre null)
    destinatarios: {
      where: { membroId: user.id },
      select: { lido: true, resolvido: true },
    },
  },
});
```

**Camada 3 (Service)** em `app/lib/alerts.server.ts:67-69`:
```ts
export async function listAlertas(user: SessionUser, filter: FiltroAlerta) {
  return prisma.alerta.findMany({
    where: {
      destinatarios: { some: { membroId: user.id } },  // <-- MESMO filtro
      ...(filter === "naoLidos" && { destinatarios: { some: { membroId: user.id, lido: false } } }),
    },
  });
}
```

**Por que duas camadas?** Loader filtra para renderizar a página; service filtra para qualquer chamada programática futura (ex: API JSON, GraphQL, etc.). Duplicação é intencional: **a Camada 3 é a única que garante a regra**; a Camada 2 é UX (não enviar dados desnecessários para o cliente).

## 5. Anti-exemplos

- ❌ **Usar `<Can>` como única proteção** (esquecer Camada 3). Comentário `// SECURITY:` ajuda, mas o **único** jeito de garantir é `assertCan*` no service. Code review deve recusar PR que adiciona `<Can>` sem o `assertCan*` correspondente no service.
- ❌ **Chamar `assertCan*` DEPOIS de `prisma.*`** (TOCTOU race condition). Sempre PRIMEIRO.
- ❌ **Duplicar lógica RBAC inline** (`if (user.cargo !== 'ADMIN')` em 5 lugares). Criar helper em `rbac.server.ts`.
- ❌ **Retornar 403 quando devia retornar 404** (enumera recursos). SECRETARIO não pode saber se o membro com id=X tem dízimos — retornar 404.
- ❌ **Confiar em `useLoaderData` para auth check** (loader já checa, mas e se loader falhar? action roda mesmo assim). Sempre `context.get(userContext)` no início.
- ❌ **Esquecer Camada 2 (loader)** e ter Camada 1 + 3. UX ruim (loader retorna 500/403 em vez de redirect) e possível Information Disclosure. Fidelidade é o caso testado: SEM Camada 2, SECRETARIO via URL vê "Acesso restrito" (vaza que o membro existe).
- ❌ **Camada 1 com `fallback` que vaza informação** (`fallback={<span>Você não pode ver isso</span>}`). Use `fallback={null}` ou `<InfoBox tone="info">` genérico.
- ❌ **RBAC no service baseado em ID de resource** (ex: `assertCanEditMembro(user, membroId)`) sem checar **escopo** (DISCIPULADOR pode editar apenas seus discípulos). Sempre carregar o resource antes de `assertCan*`.

## 6. RAGs relacionados

- [`security-rbac-matrix.md`](./security-rbac-matrix.md) — matriz canônica 6 perfis × módulos × operações. Este RAG é o **complemento arquitetural** (3 camadas); o outro é o **catálogo de regras** (o que cada perfil pode).
- [`lgpd-igreja-conect.md`](./lgpd-igreja-conect.md) — RBAC é pré-requisito de LGPD (Art. 18 — direito de acesso). Sem 3 camadas, vazamentos de PII são triviais.
- [`convention-prisma-sqlite.md`](./convention-prisma-sqlite.md) — `MEMBRO_SAFE_SELECT` é um exemplo de **Camada 3 no nível do ORM** (select canônico exclui `senhaHash`).
- [`architecture-monolith-modular.md`](./architecture-monolith-modular.md) — `app/lib/rbac.server.ts` é o **único** lugar que importa `Cargo` enum; rotas importam os helpers, não o enum.

## 7. Notas de aplicação

- **Checklist de PR que toca RBAC:**
  - [ ] Novo helper `assertCan*` adicionado em `rbac.server.ts`? Atualizar `security-rbac-matrix.md`.
  - [ ] `<Can>` no UI? Comentário `// SECURITY: UX, não segurança` presente?
  - [ ] `assertCan*` no service? É a **primeira linha** da função?
  - [ ] Teste unit do `assertCan*`? (Spy que confirma throw para perfis não-autorizados)
  - [ ] Teste integration do loader bypass URL? (E2E chain tipo `fidelidade-bypass`)
  - [ ] Teste E2E source-audit? (grep estático que confirma ordem assertCan* < prisma.*)
- **Sinal de code review:** se aparecer `if (user.cargo === 'ADMIN')` em uma action, **recusar PR** e pedir para usar `assertIsAdmin(user)`.
- **Sinal de code review:** se aparecer `<Can allow={...}>` sem comentário `// SECURITY:`, pedir para adicionar.
- **Próximos passos para S06+:** considerar criar um **linter customizado** (eslint-plugin) que detecte `<Can>` sem comentário `// SECURITY:`. YAGNI por ora (5 usos, validação manual funciona).
- **Migrar para RBAC declarativo?** (ex: schema Prisma `@@allow(['ADMIN'])`). Avaliar em S06+ quando entrar Auth0/Clerk. Manter TS por enquanto (lock-in de ORM é pior).
- **Auditoria de regressão:** rodar `tests/integration/rbac-matrix.test.ts` (7 perfis × 6 funções = 42 cenários) antes de cada release. Se passar 42/42, RBAC está íntegro.
- **Lembrete para o time:** "**Camada 3 é a única que importa**" — Layers 1 e 2 são UX. Service é segurança. Se tiver que escolher qual camada implementar, **escolha a 3**.
