---
title: Antipattern — Rota Usando `prisma.*` Direto em vez do Service (Service Bypass)
category: antipattern
applies_to:
  - app/routes/**/*.{ts,tsx}
  - app/lib/**/*.server.ts
  - app/lib/**/*.ts
  - tests/**/*service-bypass*
created: 2026-06-13
updated: 2026-06-13
version: 1.0
status: approved
priority: high
sources:
  - app/routes/app/ministerios._index.tsx (CASO REAL DE BYPASS — DÉBITO S05 DEB-MIN-1)
  - app/lib/ministries.server.ts (service completo, testado, IGNORADO pela rota)
  - .harness/sprints/S05/code-review.md (score 90/100,指摘 "KISS quebra padrão")
  - .harness/RAG/pattern-3-layer-rbac.md (relacionado — service é Camada 3)
  - .harness/RAG/architecture-monolith-modular.md (fonte única de verdade para I/O)
tags: [antipattern, refactor, prisma, service-layer, code-review, kies, s06-plus, service-bypass, duplication]
owner: rag-curator
---

## 1. Contexto

No code review final S05 (90/100), foi identificado o débito **DEB-MIN-1 (medium)**: a rota `app/routes/app/ministerios._index.tsx` faz CRUD inline usando `prisma.*` direto, **ignorando** o service `app/lib/ministries.server.ts` que já existe, está testado, e contém as regras de negócio (RBAC, P2002 handling, atomicidade).

**Esse é o antipattern "Service Bypass"**: quando a rota (loader ou action) acessa o ORM (Prisma) diretamente em vez de delegar ao service. Tem pelo menos 4 consequências negativas:

1. **Duplicação de regras de negócio** — a rota repete inline o que o service já encapsula (ex: `prisma.ministerio.create({...})` com try/catch de P2002 em vez de chamar `createMinisterio` que já trata).
2. **Bypass de testes** — as regras de negócio ficam em **dois lugares**: service (testado) e rota (NÃO testado). Cobertura falsa.
3. **Bypass de RBAC** — se a rota usar `prisma.*` direto, esquece o `assertCan*` que o service faria. Volta ao caso pré-S03 (quase-bypass).
4. **Bypass de LGPD** — o `MEMBRO_SAFE_SELECT` (e similares) está no service. Rota com `prisma.*` direto pode esquecer e retornar `senhaHash`.

**Quando foi descoberto:** S05 code review. **Status atual:** DÉBITO (refactor pendente S06+). **Risco:** segurança (Camada 3 RBAC) + LGPD (select canônico).

## 2. Decisão / Regra

### 2.1 Regra de ouro: **Service-first**

**Se existe um `*.server.ts` que faz a operação, a rota (loader/action) DEVE chamá-lo. Nunca `prisma.*` direto para essa operação.**

```ts
// ❌ ERRADO: bypass de service
export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  // Bypass: rota usa Prisma direto, ignora listMinisterios do service
  const ministerios = await prisma.ministerio.findMany({
    orderBy: { nome: "asc" },
  });
  return { ministerios };
}

// ✅ CERTO: delega ao service
export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  return { ministerios: await listMinisterios(user) };
}
```

### 2.2 Quando é OK usar `prisma.*` direto na rota

**Exceção 1: Query trivial de leitura sem regra de negócio.**

```ts
// ✅ OK: lookup simples sem RBAC
const config = await prisma.configAcolhimento.findFirst();
// ... desde que `getConfigAcolhimento(user)` do service faça o mesmo
```

**MAS:** se a operação cresce (filtros, joins, RBAC), **mova para o service imediatamente**. A regra "regra de 3": 1ª vez pode ser inline; 2ª vez note a duplicação; 3ª vez extraia.

**Exceção 2: Service ainda não existe (sprint em andamento).**

```ts
// ⚠️ TEMPORÁRIO: S##-T## a fazer é criar o service
// PR atual implementa rota com prisma.* direto. PR seguinte cria o service e refatora.
// Comment:
// TODO(S##-T##): mover esta lógica para `app/lib/feature.server.ts` quando o service for criado.
```

**Exceção 3: Service existe MAS a operação específica ainda não foi extraída.**

```ts
// ⚠️ TEMPORÁRIO: service existe mas não tem `getDashboardDataWithCustomFilter`
// Criar `getDashboardDataCustom` no service e delegar.
```

### 2.3 Linter customizado (sugestão S06+)

```ts
// tools/eslint-plugin-no-prisma-in-routes.ts
// Detecta `prisma.*` em app/routes/** e sugere usar service.

const FORBIDDEN_PATTERNS = [
  /\bprisma\.\w+\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\b/,
  /\bprisma\.\w+\.find(First|Many|Unique)\b.*MEMBRO_SAFE_SELECT/,
  // ... outros
];

// Em app/routes/app/ministerios._index.tsx: PRISMA EM ROTA = ERRO
```

**YAGNI por ora:** 1 débito conhecido é manejável com code review. Linter quando chegar a 5+ débitos.

### 2.4 Mapping: rota com bypass → service a chamar

| Rota | Bypass atual | Service a chamar |
|---|---|---|
| `ministerios._index.tsx` (loader) | `prisma.ministerio.findMany` | `listMinisterios(user)` |
| `ministerios._index.tsx` (action create) | `prisma.ministerio.create` | `createMinisterio(input, user)` |
| `ministerios._index.tsx` (action delete) | `prisma.ministerio.delete` | `deleteMinisterio(id, user)` |
| `ministerios._index.tsx` (action add-membro) | `prisma.ministerioMembro.create` | `addMembroToMinisterio(ministerioId, membroId, user)` |
| `ministerios._index.tsx` (action remove-membro) | `prisma.ministerioMembro.delete` | `removeMembroFromMinisterio(ministerioId, membroId, user)` |

(Adaptar à realidade do projeto após S05.)

## 3. Consequências

### Positivas (de seguir a regra)

- **Camada 3 RBAC sempre protegida**: o service tem `assertCan*` como primeira linha. Rota que delega está automaticamente segura.
- **LGPD sempre protegida**: `MEMBRO_SAFE_SELECT` no service. Rota que delega não retorna `senhaHash` por engano.
- **Testes granulares**: cada operação testada em UM lugar (service). Coverage real.
- **Refatoração centralizada**: trocar ORM (Prisma → Drizzle) muda 1 service, não 10 rotas.
- **Auditoria trivial**: `grep prisma app/routes/` retorna vazio. Sinal de que tudo delega.

### Negativas (de seguir a regra — trade-offs)

- **Mais arquivos**: 1 service por módulo, mesmo que pequeno. Aceitável (KISS local).
- **Indireção**: dev precisa conhecer o service antes de usar. Documentação (RAGs) compensa.

### Negativas (de NÃO seguir a regra — o que aconteceu em `ministerios._index.tsx`)

- **Duplicação**: `prisma.ministerio.create({...})` na rota E no service. Duas implementações da mesma lógica.
- **Drift**: a rota muda (ex: adiciona um campo) e o service fica desatualizado. Qual está "certa"? Ninguém sabe.
- **Teste buraco**: a rota tem 0 testes de integração (apenas E2E). A lógica NÃO está coberta.
- **RBAC bypass silencioso**: a rota tem `if (user.cargo === 'ADMIN')` inline, mas e se um dia SECRETARIO precisar de permissão? Muda a rota E o service, e o dev esquece da rota.
- **LGPD vazamento**: rota pode esquecer de excluir `senhaHash` em algum select ad-hoc.

## 4. Exemplos

### Exemplo 1: O caso real (S05 code review)

**ANTES (antipattern):**
```ts
// app/routes/app/ministerios._index.tsx (trecho REAL, S05)
const CAN_MANAGE = ["ADMIN", "PASTOR", "SECRETARIO"] as const;

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  // ❌ BYPASS: prisma.* direto, sem chamar listMinisterios do service
  const ministerios = await prisma.ministerio.findMany({
    orderBy: { nome: "asc" },
    include: { _count: { select: { membros: true } } },
  });

  return { user, ministerios, canManage: CAN_MANAGE.includes(user.cargo as any) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  const formData = await request.formData();
  const intent = formData.get("_action");

  if (intent === "create") {
    if (!CAN_MANAGE.includes(user.cargo as any)) {
      throw new Response("Acesso restrito.", { status: 403 });
    }
    // ❌ BYPASS: prisma.* direto, sem chamar createMinisterio
    const data = MinisterioCreateSchema.parse({
      nome: formData.get("nome"),
      descricao: formData.get("descricao") || undefined,
    });
    try {
      await prisma.ministerio.create({ data });
    } catch (e) {
      // ❌ Erro P2002 (unique constraint) tratado inline; service já tem isso
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return { fieldErrors: { nome: "Já existe um ministério com este nome." } };
      }
      throw e;
    }
    return redirect("/app/ministerios");
  }

  // ... outros intents (delete, add-membro, remove-membro) — TODOS bypass ...
}
```

**DEPOIS (refator S06+):**
```ts
// app/routes/app/ministerios._index.tsx (refatorado)
export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  // ✅ DELEGA: chama o service
  return {
    user,
    ministerios: await listMinisterios(user),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  const formData = await request.formData();
  const intent = formData.get("_action");

  if (intent === "create") {
    const data = MinisterioCreateSchema.parse({
      nome: formData.get("nome"),
      descricao: formData.get("descricao") || undefined,
    });
    // ✅ DELEGA: service tem assertCan* + P2002 handling
    return await createMinisterio(data, user);  // throws Response(302) ou fieldErrors
  }

  // ... outros intents ...
}
```

**Diff:** -30 linhas, +1 linha por intent. Service é a única fonte de verdade.

### Exemplo 2: Linter rule (futuro)

```ts
// tools/eslint-plugin-igreja/no-prisma-in-routes.ts
import { Rule } from 'eslint';

const rule: Rule.RuleModule = {
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value.startsWith('~/db/prisma.server')) {
          context.report({
            node,
            message: 'Routes não devem importar prisma.server. Use o service (*.server.ts) correspondente.',
          });
        }
      },
      CallExpression(node) {
        // Detecta prisma.X.Y em rotas
        if (node.callee.type === 'MemberExpression' &&
            node.callee.object.type === 'MemberExpression' &&
            node.callee.object.object?.name === 'prisma') {
          context.report({
            node,
            message: 'Rotas não devem usar prisma.* diretamente. Delegue ao service em app/lib/*.server.ts.',
          });
        }
      },
    };
  },
};

export default rule;
```

### Exemplo 3: Refactor incremental (S06+)

Quando chegar S06, a task é:
1. **Identificar todas as rotas com `prisma.*` direto** (grep `prisma\.\w+\.find\w+|prisma\.\w+\.create\(|prisma\.\w+\.update\(|prisma\.\w+\.delete\(` em `app/routes/`)
2. **Para cada uma**, verificar se já existe service correspondente
3. **Se existe**: refatorar rota → service
4. **Se não existe**: criar service primeiro (TDD), depois refatorar rota
5. **Após refactor**: rodar `pnpm test` (não pode quebrar), `pnpm test:e2e`, e adicionar E2E que valida regra que estava inline

**Critério de pronto:** `grep -r "prisma\." app/routes/` retorna **0 matches** (excluindo comentários).

## 5. Anti-exemplos

- ❌ **`prisma.*` direto em route** quando existe `*.server.ts` com a operação. **Sempre** delegar.
- ❌ **Refator "meia-boca"**: delegar `list` mas manter `create` inline. **Tudo** ou nada.
- ❌ **Confundir "lookup simples" com "bypass aceitável"**: `prisma.configAcolhimento.findFirst()` direto em uma rota é OK **apenas se** o service for trivial (1 linha) e não crescer. Se crescer, extrair.
- ❌ **Service que delega para a rota**: service chama `prisma.*` em vez de `prisma.*` direto? Não, **service é a única camada que toca Prisma**, exceto `tests/`.
- ❌ **Múltiplos services com mesma operação** (ex: `getMembroSimple` em `members.server.ts` e `getMembroWithMinisterios` em `membrosByDiscipulador.server.ts`). Consolidar.
- ❌ **"Service" que é só wrapper de uma linha** (`export const listMembros = () => prisma.membro.findMany();`). YAGNI. **Ou** tem regra de negócio (assertCan*, validação, transformação) **ou** é inline na rota. Sem meio-termo.
- ❌ **Refator sem testes**: mudar rota para chamar service **sem** rodar `pnpm test` antes/depois. Cobertura é o termômetro.
- ❌ **Aceitar bypass "por enquanto" sem TODO**: se vai refatorar S06+, deixar comentário `// TODO(S06+): delegar a listMinisterios` com link pro issue. Não deixar bypass silencioso.

## 6. RAGs relacionados

- [`pattern-3-layer-rbac.md`](./pattern-3-layer-rbac.md) — Camada 3 (service) é onde mora o `assertCan*` + `MEMBRO_SAFE_SELECT`. Bypass de service = bypass de Camada 3.
- [`architecture-monolith-modular.md`](./architecture-monolith-modular.md) — define `app/lib/*.server.ts` como a **única** ponte para I/O. Rotas não tocam Prisma. Este RAG é o **enforcement** prático dessa regra.
- [`security-rbac-matrix.md`](./security-rbac-matrix.md) — quem pode fazer o quê. Service implementa; rota consome.
- [`convention-prisma-sqlite.md`](./convention-prisma-sqlite.md) — `MEMBRO_SAFE_SELECT` está em `members.server.ts`. Bypass de `members.server.ts` = potencial leak de `senhaHash`.
- [`convention-monetary-values.md`](./convention-monetary-values.md) — `Lancamento` (dízimo) tem RBAC restritiva. Service `finance.server.ts` é o gate. Bypass = dízimo acessível a SECRETARIO.

## 7. Notas de aplicação

- **Checklist de PR que toca rota:**
  - [ ] A rota tem `prisma.*` direto? **Se sim, verificar se já existe service que faz a operação.**
  - [ ] Service existe mas foi ignorado? **Recusar PR** e pedir delegação.
  - [ ] Service não existe mas operação é trivial? OK inline com `// TODO(S##-T##): extrair para service`.
  - [ ] Service não existe e operação tem regra de negócio (RBAC, validação, atomicidade)? **Recusar PR** e pedir para criar service primeiro.
- **Sinal de code review (planning-reviewer):**
  - [ ] PR adiciona `prisma.*` em `app/routes/`? Abrir issue `service-bypass` no backlog.
  - [ ] PR move lógica de service para rota? **Recusar imediatamente**.
  - [ ] PR adiciona 2ª lógica similar a existente no service? Pedir para extrair/refatorar.
- **Lembrete para o time:** "**Service é a fronteira. Rota delega ou cresce.**" Se você está importando `~/db/prisma.server` em uma rota, **pergunte-se: por que não estou usando o service?**
- **Métrica de saúde:** `grep -r "prisma\." app/routes/ | wc -l` deve tender a 0 ao longo do tempo. Se subir, é débito.
- **Auditoria S06+:** rodar `tests/integration/no-prisma-in-routes.test.ts` que **falha** se encontrar `prisma.*` em `app/routes/`. YAGNI por ora (manual funciona), mas considerar.
- **Lição replicável:** "**Regra de 3** também se aplica a bypass. 1º bypass: tolerar. 2º: tolerar. 3º: **linter ou PR block**." Igreja Conect está em 5+ bypasses conhecidos (`ministerios._index.tsx` tem 5 intents com `prisma.*`). Hora de linter.
- **Backward-compat:** ao refatorar rota → service, manter **assinatura idêntica** (mesmo return type, mesmo error). E2E deve passar sem modificação. Se quebrar, é regressão de comportamento.
