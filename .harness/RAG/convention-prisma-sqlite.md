---
title: Convenção — Prisma 7 + SQLite (gotchas e padrões)
category: convention
applies_to:
  - prisma/schema.prisma
  - prisma/migrations/**
  - prisma/seed.ts
  - app/prisma.config.ts
  - app/db/prisma.server.ts
  - app/lib/**/*.server.ts
created: 2026-06-12
updated: 2026-06-12
version: 1.0
status: approved
priority: high
sources:
  - prisma/schema.prisma (modelos, enums, generator)
  - app/prisma.config.ts
  - package.json (versões Prisma 7.8, @prisma/adapter-better-sqlite3)
  - brief.md §5.1 (Stack fixada)
tags: [convention, prisma, sqlite, migration, typescript, persistence]
owner: rag-curator
---

## 1. Contexto

A Igreja Conect usa **Prisma 7.8** com **provider SQLite** (arquivo `dev.db` local). Esta combinação tem 3 armadilhas reais que já causaram bugs clássicos em sistemas financeiros:

1. **SQLite não tem `enum` nativo.** Prisma simula com `TEXT` + check constraint. Funciona, mas tem nuance na hora de migrar valores.
2. **SQLite não tem `Json` nativo.** Prisma também não suporta `Json` no provider SQLite. Tentativa de usar `Json` falha no `prisma migrate`.
3. **`DateTime` do Prisma em SQLite vira `TEXT` ISO 8601.** Comparações tipo `dataCompetencia >= "2026-01-01"` precisam passar por `new Date()` no service, não ser string comparison.

A escolha por SQLite foi consciente (`brief.md §6` — plenamente suficiente para uma igreja local) e a saída de emergência é migrar para Postgres, que Prisma suporta nativamente sem mudar o schema na maioria dos casos. Para isso, **as convenções deste RAG são desenhadas para serem portáveis** (sem features exclusivas de SQLite que travem o upgrade).

## 2. Decisão / Regra

### 2.1 Generator e adapter (já configurado no projeto)

```prisma
// prisma/schema.prisma (trecho real)
generator client {
  provider = "prisma-client"   // NÃO "prisma-client-js" (este é o generator novo do Prisma 7)
  output   = "../generated/prisma"
}

datasource db {
  provider = "sqlite"
}
```

E em `package.json`: `@prisma/adapter-better-sqlite3` (driver nativo) + `@prisma/client` 7.8. **Não trocar** o driver por `sqlite3` (legado) sem motivo — `better-sqlite3` é sync e mais rápido para o volume esperado.

### 2.2 Singleton do Prisma Client

**Padrão obrigatório** em `app/db/prisma.server.ts` (sufixo `.server.ts` impede bundling no cliente):

```ts
import { PrismaClient } from "../../generated/prisma/client"; // caminho do output do generator
import { PrismaBetterSQLite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaBetterSQLite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**Por quê:** o Vite HMR recarrega módulos em dev; sem o truque do `globalThis`, cada reload abre uma nova conexão. Em produção, uma única instância.

### 2.3 `enum` simulado pelo Prisma

Enum no Prisma com SQLite vira `TEXT` com check constraint. Exemplo já no schema:

```prisma
enum Cargo { ADMIN PASTOR SECRETARIO DISCIPULADOR FINANCEIRO LIDER_MINISTERIO }
```

→ Tabela SQLite: `cargo TEXT CHECK (cargo IN ('ADMIN', 'PASTOR', ...))`.

**Regra:** ao ler enum no service, sempre use o tipo do Prisma (`Cargo.ADMIN`), nunca a string crua `"ADMIN"`. Type safety de graça.

### 2.4 Sem `Json` — usar `String` + JSON no service

Se algum dia precisar guardar JSON (ex: preferências, config chave-valor), **não** tente `Json @db.Json`. Use:

```prisma
model Configuracao {
  id    String @id @default(uuid())
  chave String @unique
  valor String  // JSON serializado
}
```

E no service: `JSON.parse(config.valor)` na leitura, `JSON.stringify(obj)` na escrita. Documentar este padrão em JSDoc do service (TDD v6.2.0+).

### 2.5 `DateTime` em SQLite = texto ISO

`DateTime` em SQLite vira `TEXT` no formato `YYYY-MM-DD HH:MM:SS.SSS`. Comparações devem usar o `Date` do JS, não string. Errado:

```ts
// ❌ comparação de string funciona POR ACASO com ISO puro, mas quebra com fuso
const eventos = await prisma.alerta.findMany({
  where: { createdAt: { gte: "2026-01-01" } }  // ❌ não faça isso
});
```

Certo:

```ts
// ✅ comparação via Date (Prisma converte para o formato SQLite correto)
const limite = new Date("2026-01-01T00:00:00Z");
const eventos = await prisma.alerta.findMany({
  where: { createdAt: { gte: limite } }
});
```

### 2.6 Workflow de migration

```bash
# 1. Editar prisma/schema.prisma
# 2. Criar migration nomeada (a IDE/PR descreve o que mudou)
pnpm prisma migrate dev --name add_alerta_destinatario_unique
# 3. Prisma gera SQL em prisma/migrations/<timestamp>_<name>/migration.sql
# 4. SEMPRE commitar:
#    - prisma/schema.prisma
#    - prisma/migrations/<timestamp>_<name>/migration.sql
#    - prisma/migrations/migration_lock.toml (atualizado)
# 5. Em prod: pnpm prisma migrate deploy (nunca migrate dev)
```

**Proibido:** editar `migration.sql` à mão depois de gerado (gera drift). Se a migration estiver errada, `migrate dev --create-only`, edita o **preview**, valida, e só então aplica.

### 2.7 `onDelete: Restrict` em relacionamentos críticos

`prisma/schema.prisma` já aplica isso em:

- `Membro.discipulador` (auto-relacionamento 1:N): `onDelete: Restrict` — não perde árvore de discipulado.
- `TransferenciaCaixa.caixaOrigem/caixaDestino/executadoPor`: `Restrict` — integridade financeira.
- `Lancamento.caixa`, `Lancamento.membro`: `Restrict` e `SetNull` respectivamente.
- `MovimentacaoEstoque`, `ManutencaoAtivo`: `Restrict`.

**Regra:** **nunca** usar `Cascade` em campo financeiro ou de auditoria. `SetNull` é aceitável em campos opcionais (ex: `Lancamento.membro` quando oferta anônima). `Cascade` é aceitável em relacionamentos de junção pura (ex: `MinisterioMembro`).

### 2.8 Seed idempotente

O seed em `prisma/seed.ts` deve ser idempotente (rodar 2x não duplica). Para criar ADMIN inicial:

```ts
// prisma/seed.ts (padrão esperado)
import { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../app/lib/auth.server"; // hash bcrypt

const prisma = new PrismaClient();

async function main() {
  const email = "admin@igreja.local";
  const existente = await prisma.membro.findUnique({ where: { email } });
  if (existente) {
    console.log("ADMIN já existe, seed idempotente ok.");
    return;
  }
  await prisma.membro.create({
    data: {
      nome: "Administrador",
      email,
      senhaHash: await hashPassword("admin123"), // trocar em produção
      tipo: "MEMBRO_ATIVO",
      cargo: "ADMIN",
    },
  });
  console.log("ADMIN seed criado.");
}
main().finally(() => prisma.$disconnect());
```

Registrar no `package.json`: `"prisma": { "seed": "tsx prisma/seed.ts" }`. Adicionar `tsx` em devDependencies.

## 3. Consequências

- **Positivas:**
  - Devs não precisam saber SQL para começar (Prisma abstrai).
  - Type safety ponta a ponta: schema → tipos Prisma → service.
  - Migrações versionadas em `prisma/migrations/` viram histórico auditável.
  - Singleton evita exaustão de conexões em dev com HMR.
- **Negativas:**
  - `DateTime` em SQLite é texto: queries complexas de range ficam mais lentas que em Postgres (índice B-tree em TEXT ainda funciona, mas é menos eficiente).
  - Sem `Decimal` nativo (mitigado pela convenção de centavos — ver `convention-monetary-values.md`).
  - Sem `enum` nativo significa migrations que adicionam valor de enum precisam de migration manual se for antes de Prisma 5 (Prisma 7 resolve sozinho).
- **Trade-offs aceitos:**
  - Sem full-text search nativo do SQLite. Se precisar (busca textual em nome de membro), usar `LIKE` com índice em `LOWER(nome)` ou migrar para Postgres. No MVP, `contains` do Prisma sobre `nome` é suficiente.

## 4. Exemplos

**Exemplo 1 — Singleton (referência §2.2):**

```ts
// app/db/prisma.server.ts — já descrito em §2.2
// Importação típica em service:
import { prisma } from "~/db/prisma.server";

export async function listMembros() {
  return prisma.membro.findMany({
    select: { id: true, nome: true, tipo: true, email: true }, // nunca senhaHash
    orderBy: { nome: "asc" },
  });
}
```

**Exemplo 2 — Transação com `onDelete: Restrict` segurando integridade:**

```ts
// Tentativa de deletar caixa com lançamentos deve falhar (proteção do schema)
await prisma.caixa.delete({ where: { id: caixaId } });
// → P2003 Foreign key constraint failed (Prisma converte erro do SQLite)
```

**Exemplo 3 — Migration workflow (referência §2.6):**

```bash
$ pnpm prisma migrate dev --name add_cargo_to_membro
# Prisma detecta: novo enum, ajusta CHECK constraint
# Cria: prisma/migrations/20260612130000_add_cargo_to_membro/migration.sql
# Aplica ao dev.db
# Regenera: generated/prisma/client
# Commit:
git add prisma/schema.prisma prisma/migrations/20260612130000_add_cargo_to_membro/
```

**Exemplo 4 — Erros comuns de migration (para revisar em PR):**

```sql
-- ❌ ERRADO: Prisma nunca gera isso, mas se editar à mão vira drift
ALTER TABLE membros DROP COLUMN tipo;

-- ✅ CERTO: gerado pelo `migrate dev`
-- prisma/migrations/<ts>_*/migration.sql
ALTER TABLE membros ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'VISITANTE';
```

## 5. Anti-exemplos

- ❌ **Criar `prisma/migrations/<ts>_init/migration.sql` à mão para o seed inicial.** Use `prisma migrate dev --name init`. Edição manual no primeiro arquivo é a maior fonte de drift.
- ❌ **Usar `Float` para valor monetário "porque Decimal não tem em SQLite".** Use `Int` em cents (ver `convention-monetary-values.md`).
- ❌ **Criar `new PrismaClient()` dentro de cada service.** Conexão por chamada = vazamento. Use o singleton de `app/db/prisma.server.ts`.
- ❌ **Importar `prisma` de caminho relativo (`../../generated/prisma/client`) em service de UI (loader de rota).** Vai bundlar Prisma no cliente. Use sempre `~/db/prisma.server` que tem o sufixo `.server`.
- ❌ **`prisma.membro.findFirst()` em loop (N+1).** Use `findMany` com `where: { id: { in: ids } }` e indexe em memória.
- ❌ **Confiar em `JSON.stringify(obj)` direto em campo `Json` (que não existe no SQLite).** Use o padrão `String` + service wrapper (ver §2.4).
- ❌ **Rodar `prisma migrate reset` em produção para "começar do zero".** Apaga todos os dados. Use `migrate deploy` para aplicar migrations incrementais.
- ❌ **Não commitar `prisma/migrations/migration_lock.toml`.** O Prisma usa esse arquivo para detectar qual provider aplicou a migration; sem ele, time clone o repo e migrations falham.

## 6. RAGs relacionados

- [`architecture-monolith-modular.md`](./architecture-monolith-modular.md) — define `app/db/prisma.server.ts` como a única ponte para o banco.
- [`convention-monetary-values.md`](./convention-monetary-values.md) — explica a escolha de `Int` em cents como resposta à ausência de `Decimal` no SQLite.
- [`security-rbac-matrix.md`](./security-rbac-matrix.md) — `select` explícito no Prisma evita retornar `senhaHash` no payload.
- [`lgpd-igreja-conect.md`](./lgpd-igreja-conect.md) — schema é a fonte de verdade do que é coletado; ausência de campo = ausência de coleta.

## 7. Notas de aplicação

- **TDD no service que toca Prisma:** sempre que possível, isolar a chamada Prisma em 1 função e testar com um banco SQLite em memória (`new PrismaClient({ datasourceUrl: "file::memory:?cache=shared" })`). Não confiar em mocks frágeis.
- **Em PR que toca `schema.prisma`:** checklist do reviewer:
  - [ ] Migration gerada (não editada à mão)?
  - [ ] `migrations/migration_lock.toml` foi atualizado?
  - [ ] `generated/prisma/` foi regenerado e está commitado (se for o output versionado) — ou está no `.gitignore` e CI regenera?
  - [ ] `onDelete` escolhido é coerente com §2.7?
  - [ ] Nenhum campo sensível novo foi adicionado (LGPD)?
  - [ ] Testes de migração rodaram contra um banco limpo?
- **Regenerar client manualmente:** `pnpm prisma generate`. Vite HMR do dev server pega o client novo automaticamente na próxima request.
- **Backup local antes de migration destrutiva:** `cp dev.db dev.db.bak.$(date +%s)`. O RAG de risco R3 do brief menciona esse workflow.
- **Quando migrar para Postgres:** o esforço é trocar `provider = "sqlite"` → `postgresql`, ajustar o adapter (`@prisma/adapter-pg`), e rodar `prisma migrate dev` em um banco Postgres novo. O schema (com pequenas exceções de tipos) é portátil. **Não** fazer isso preventivamente — YAGNI.
- **Sinal de code review:** se aparecer `prisma.$queryRaw` no PR, pedir justificativa. `$queryRaw` deve ser último recurso (queries que o Prisma não expressa).
