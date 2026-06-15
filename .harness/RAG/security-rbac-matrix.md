---
title: RBAC — Matriz de Perfis × Módulos × Operações
category: security
applies_to:
  - app/lib/auth.server.ts
  - app/lib/rbac.server.ts
  - app/routes/**
  - app/api/**
  - prisma/schema.prisma (enum Cargo)
created: 2026-06-12
updated: 2026-06-12
version: 1.0
status: approved
priority: critical
sources:
  - brief.md §2 (Usuários e Personas)
  - docs/DESCRIÇÃO_DOS_MODULOS.md (Matriz RBAC)
  - docs/REGRAS_DE_NEGOCIO.md (RN-MEM-01, RN-MEM-03, RN-MEM-04)
tags: [rbac, security, owasp-a01, owasp-a03, authorization, defense-in-depth]
owner: rag-curator
---

## 1. Contexto

A Igreja Conect lida com **dados pessoais sensíveis** (endereço, contato, dados eclesiásticos) e **dados financeiros confidenciais** (dízimos — RN-MEM-03). Um vazamento de histórico de dízimos pode destruir a confiança da congregação e infringir LGPD. Por isso, o controle de acesso não pode depender de "esconder botão na UI": qualquer chamada direta via URL, fetch manual, ou ferramenta de API resultaria em bypass.

A matriz RBAC é derivada diretamente de `docs/DESCRIÇÃO_DOS_MODULOS.md` e de `brief.md §2`, e materializa 6 perfis (enum `Cargo` no Prisma) em regras de autorização executadas em **3 camadas independentes** — qualquer falha isolada não vaza dados.

## 2. Decisão / Regra

**Toda decisão de acesso na Igreja Conect passa por 3 camadas obrigatórias (defense in depth):**

| Camada | Onde | O que verifica | Falha → |
|--------|------|----------------|---------|
| **1. UI** | `app/components/**` | Renderiza condicional baseado em `user.cargo` | Esconde controle, mas **não** é fonte de verdade |
| **2. Loader/Action** | `app/routes/**/loader.ts`, `action.ts` | Chama `assertCan(user, action, resource)` antes de qualquer I/O | Lança `Response(null, { status: 403 })` — React Router renderiza ErrorBoundary |
| **3. Service** | `app/lib/**.server.ts` | Helper `assertCanSeeFinancials(perfil)` revalida mesmo se chamado por outro service | Lança erro de domínio (ex: `ForbiddenError`) |

**Matriz canônica (6 perfis × 5 domínios):**

| Perfil \ Operação | Membros CRUD | Vê Dízimos (RN-MEM-03) | Cria Caixa/Lançamento | Aprova Saída (saldo) | Autoriza Baixa Estoque |
|---|---|---|---|---|---|
| `ADMIN` | ✅ Total | ✅ | ✅ Total | ✅ | ✅ |
| `PASTOR` | ✅ Total | ✅ | ✅ Total | ✅ | ❌ |
| `FINANCEIRO` | ✅ Total | ✅ | ✅ | ✅ (RN-FIN-03) | ❌ |
| `SECRETARIO` | ✅ Total | ❌ **BLOQUEADO** | ✅ | ✅ (RN-FIN-03) | ✅ (RN-EST-02) |
| `DISCIPULADOR` | ✅ (só seus discípulos) | ❌ **BLOQUEADO** | ❌ | ❌ | ❌ |
| `LIDER_MINISTERIO` | ✅ (só do seu min.) | ❌ **BLOQUEADO** | ❌ | ❌ | ❌ |

**Padrão de helper canônico em `app/lib/rbac.server.ts`:**

```ts
// Helper obrigatório para qualquer leitura que toque Lancamento / Caixa
// de um membro específico. Lança Response(403) — não retorna boolean.
export function assertCanSeeFinancials(user: { cargo: Cargo | null }): void {
  const allowed: Cargo[] = ["ADMIN", "PASTOR", "FINANCEIRO"];
  if (!user.cargo || !allowed.includes(user.cargo)) {
    throw new Response("Acesso restrito a perfis financeiros.", { status: 403 });
  }
}
```

**Regra de RN-MEM-04 (12 discípulos):** o limite não é checado no Prisma (`onDelete: Restrict` é do banco, não de cardinalidade máxima). **Deve** ser checado em `app/lib/discipleship.server.ts` antes do `prisma.membro.update({ discipuladorId })`:

```ts
export const MAX_DISCIPULOS = 12;
export async function assignDisciple(discipuladorId: string, discipuloId: string) {
  const count = await prisma.membro.count({ where: { discipuladorId, tipo: "MEMBRO_ATIVO" } });
  if (count >= MAX_DISCIPULOS) {
    throw new Response(`Discipulador já possui ${MAX_DISCIPULOS} discípulos ativos.`, { status: 409 });
  }
  return prisma.membro.update({ where: { id: discipuloId }, data: { discipuladorId } });
}
```

## 3. Consequências

- **Positivas:**
  - Bypass via DevTools é inútil: a UI pode ser adulterada, mas o loader e o service continuam bloqueando.
  - Testes unitários de service (`assertCanSeeFinancials`) são triviais e cobrem 100% da matriz.
  - Audit-friendly: log de quem tentou acessar o quê e em qual camada foi barrado.
- **Negativas:**
  - 3 lugares para manter em sincronia. Mitigação: a matriz vive em **um único arquivo `rbac.server.ts`** e os componentes consultam o mesmo enum `Cargo`.
  - Custo de latência: cada `loader` faz checagem extra. Negligível (lookup em objeto JS), sem I/O adicional.
- **Trade-offs aceitos:**
  - Perfis `DISCIPULADOR` e `LIDER_MINISTERIO` têm CRUD de Membros mas com escopo restrito (filtro por `discipuladorId` / `ministerios` no `where` do Prisma). Vale o custo para preservar RN-MEM-01 sem complicar a UX com telas de "apenas leitura".

## 4. Exemplos

**Camada 2 — loader aplicando assertCanSeeFinancials:**

```ts
// app/routes/app/membros/$id.tsx
import { assertCanSeeFinancials } from "~/lib/rbac.server";
import { getMembroById } from "~/lib/members.server";
import { getDizimosByMembro } from "~/lib/finance.server";
import type { Route } from "./+types/$id";

export async function loader({ params, context }: Route.LoaderArgs) {
  const user = context.user; // injetado pelo middleware de auth
  const membro = await getMembroById(params.id);
  if (!membro) throw new Response("Não encontrado", { status: 404 });

  let dizimos: Lancamento[] = [];
  try {
    assertCanSeeFinancials(user);
    dizimos = await getDizimosByMembro(membro.id);
  } catch (e) {
    if (e instanceof Response && e.status === 403) dizimos = []; // UI não renderiza a aba
    else throw e;
  }
  return { membro, dizimos };
}
```

**Camada 1 — UI condicional (não é fonte de verdade):**

```tsx
// app/components/MembroFicha.tsx
import { useCanSeeFinancials } from "~/lib/rbac.client";

export function MembroFicha({ membro, dizimos, user }) {
  const canSeeFinancials = useCanSeeFinancials(user); // hook client-side
  return (
    <div>
      <DadosPessoais membro={membro} />
      {canSeeFinancials && <FidelidadeFinanceira dizimos={dizimos} />}
    </div>
  );
}
```

**Camada 3 — service aplicando trava em qualquer ponto de entrada:**

```ts
// app/lib/finance.server.ts
import { assertCanSeeFinancials } from "./rbac.server";

export async function getDizimosByMembro(membroId: string, actor: { cargo: Cargo | null }) {
  assertCanSeeFinancials(actor); // falha aqui mesmo se o loader esqueceu
  return prisma.lancamento.findMany({
    where: { membroId, categoria: "DIZIMO" },
    orderBy: { dataCompetencia: "desc" },
  });
}
```

## 5. Anti-exemplos

- ❌ **Esconder a aba "Fidelidade Financeira" com `display: none` e considerar a proteção feita.** Bypass trivial via DevTools. Quebra §2 e viola LGPD.
- ❌ **Verificar perfil só no `loader` e confiar que "nunca mais vai ser chamado por outro caminho".** Sempre que um service for reusado, refatorar a checagem para dentro dele (camada 3). Single point of failure.
- ❌ **Hard-coded `if (user.cargo === "ADMIN")` espalhado em 15 arquivos.** Quando a matriz mudar, vai esquecer um. Centralizar em `rbac.server.ts` e importar.
- ❌ **Confiar no `enum Cargo` do Prisma como "segurança".** É só um tipo; alguém pode passar `cargo: "ADMIN"` via payload e o Prisma aceita se o service não validar contra o `context.user` (que vem do cookie, não do body).
- ❌ **Implementar RN-MEM-04 no banco via `CHECK (count <= 12)`.** SQLite tem `CHECK`, mas a regra é de **negócio** (ex: conta 12 ativos, não 12 totais) e precisa de mensagem amigável. Vai no service.
- ❌ **Aplicar RN-MEM-03 só no `action` de `Lancamento` mas esquecer no `loader` da ficha do membro.** O vazamento é leitura, não escrita.

## 6. RAGs relacionados

- [`architecture-monolith-modular.md`](./architecture-monolith-modular.md) — define as 3 camadas (UI / loader / service) onde RBAC se aplica.
- [`lgpd-igreja-conect.md`](./lgpd-igreja-conect.md) — RN-MEM-03 é também uma obrigação legal; este RAG detalha o *como*.
- [`convention-prisma-sqlite.md`](./convention-prisma-sqlite.md) — `prisma.config.ts` e o enum `Cargo` no schema.

## 7. Notas de aplicação

- **Testes obrigatórios (TDD):** para cada par (perfil × endpoint), um teste que valida 200 para perfis permitidos e 403 para perfis negados. Cobertura alvo: 100% das células da matriz.
- **Onde criar testes E2E:** Playwright com login helper que troca o `user.cargo` entre cenários. RN-MEM-03 em particular **exige** teste E2E (cenário: SECRETARIO logado chama `/app/membros/<id>` direto na URL — espera-se 403 e aba ausente).
- **Auditoria:** log estruturado de toda falha de `assertCan*` em `app/lib/audit.server.ts` com `{ userId, cargo, attemptedAction, resourceId, layer }`. Sem PII no log.
- **Quando expandir a matriz:** adicionar 1 perfil novo = 1 linha em `rbac.server.ts` + 1 entrada em cada `assertCan*` aplicável + atualização da matriz neste RAG. Sem esquecer: o enum `Cargo` no `prisma/schema.prisma`.
- **Refactor seguro:** se 3+ `if (user.cargo === "X")` aparecerem, abstrair para `canX(user)`. Regra de 3 (YAGNI/KISS), não antes.
