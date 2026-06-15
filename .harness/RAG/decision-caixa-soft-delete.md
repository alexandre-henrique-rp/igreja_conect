---
title: Decisão — Soft-Delete de Caixa via Campo `ativo` (Proposta do Discovery, Formalização Fase 2)
category: decision
applies_to:
  - prisma/schema.prisma (model Caixa)
  - prisma/migrations/**
  - app/lib/caixas.server.ts
  - app/lib/finance.server.ts (assertSaldoSuficiente)
  - app/lib/transferencias.server.ts
  - .harness/RAG/pattern-trava-saldo-service.md §2.1 (checagem de ativo)
  - .harness/RAG/pattern-transferencia-caixas.md §2.2 (checagem de ativo)
created: 2026-06-14
updated: 2026-06-14
version: 0.1
status: approved
priority: medium
sources:
  - brief.md §5.4 (Decisão de modelagem adicional — proposta, requer confirmação na Fase 2)
  - brief.md §9.5 pendência #4 ("Decisão de modelagem Caixa.ativo (proposta §5.4)")
  - docs/REGRAS_DE_NEGOCIO.md §2 (RN-FIN-01)
  - prisma/schema.prisma (model Caixa, linhas 167-180)
tags: [decision, caixa, soft-delete, archive, modelagem, prisma, schema, migration, rnf-fin-01, pending, fase-2]
owner: rag-curator
---

## 1. Contexto

A **RN-FIN-01** ("Controle por Caixas Flutuantes") estabelece que o sistema opera baseado em **Caixas** apartados (Geral, Cantina, Missões, etc.). No **discovery do ciclo 2** (brief §5.4), o usuário levantou uma **proposta de modelagem adicional** que requer **confirmação na Fase 2 (Requisitos)** antes de virar migration:

> *"Adicionar campo `ativo: Boolean @default(true)` ao model `Caixa` para suportar **soft-delete (arquivamento)**. Caixas arquivados continuam no banco (para histórico de saldos), mas somem da listagem padrão. Sem esta coluna, a única alternativa é `onDelete: Restrict` (impede delete se há lançamentos) — funcional, mas perdemos a semântica de 'arquivado' que o usuário pediu."*

A motivação é tripla:

1. **Integridade histórica:** `Caixa.saldoCentavos` é a soma dos lançamentos. Deletar um caixa com histórico destruiria a rastreabilidade. Soft-delete preserva o caixa no banco (consultável, auditável), apenas o **esconde** da listagem padrão.
2. **Operação comum no domínio:** igrejas **criam e fecham caixas temáticos** (ex: "Caixa Campanha Natal 2025" → fecha após a campanha). Sem `ativo`, o caixa antigo polui a listagem ou precisa ser "deletado" (impossível se tem lançamentos).
3. **Decisão eclesiástica:** o usuário pediu explicitamente a semântica de "arquivado" no discovery. O `onDelete: Restrict` é funcional mas **não atende** ao pedido.

Este RAG é uma **decisão pendente** (status `pending`). Foi **aprovada em discovery** (brief §5.4) mas **aguarda formalização na Fase 2 (Requisitos)**, especificamente pelo `prd-reviewer` antes de virar migration. **Nenhuma migration pode ser gerada enquanto o status for `pending`** — esta RAG serve de subsídio técnico para o `prd-reviewer` validar a decisão.

## 2. Decisão / Regra

### 2.1 Decisão proposta (aguarda validação)

**Adicionar campo `ativo: Boolean @default(true)` ao model `Caixa` em `prisma/schema.prisma`.** Caixas arquivados (`ativo = false`) continuam no banco (histórico preservado, saldos reconciliáveis), mas:

- **Somem da listagem padrão** (`/app/financeiro` e `/app/financeiro/caixas` filtram `where: { ativo: true }` por padrão).
- **Não aceitam novas movimentações** — `assertSaldoSuficiente` em `app/lib/finance.server.ts` checa `caixa.ativo === false` ANTES de validar saldo, lançando `Response(409, "Caixa está arquivado e não aceita movimentações.")`.
- **Não podem ser origem/destino de transferência** — `transferirEntreCaixas` em `app/lib/transferencias.server.ts` checa `ativo` de **ambos** os caixas dentro do `$transaction`, lançando `Response(409, "Caixa de origem/destino está arquivado.")`.
- **Aparecem em relatórios históricos** (futuro, ciclo 3+) — ex: "saldo de todos os caixas que existiram em 2025" inclui arquivados.
- **Podem ser "desarquivados"** via `reabrirCaixa(id, user)` (RBAC: `assertCanManageCaixa`, mesmo gate de criar/editar).

### 2.2 Migration proposta (esboço, não gerar até `status: approved`)

```prisma
// prisma/schema.prisma — model Caixa (alteração proposta)
model Caixa {
  id            String @id @default(uuid())
  nome          String @unique
  saldoCentavos Int    @default(0)
  ativo         Boolean @default(true)  // <-- NOVO. Soft-delete (arquivamento).

  lancamentos   Lancamento[]
  origemTransf  TransferenciaCaixa[] @relation("CaixaOrigem")
  destinoTransf TransferenciaCaixa[] @relation("CaixaDestino")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("caixas")
  @@index([ativo])  // <-- NOVO. Otimiza listagem padrão `where: { ativo: true }`.
}
```

```sql
-- prisma/migrations/<timestamp>_add_ativo_to_caixa/migration.sql (esboço)
ALTER TABLE caixas ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT 1;
CREATE INDEX "caixas_ativo_idx" ON "caixas"("ativo");
```

> **`@default(true)` cobre migração automática:** todos os caixas existentes ficam `ativo = true` (visíveis, operacionais) por padrão. Sem `default`, migration falharia (NOT NULL sem default em tabela com dados).

### 2.3 Impacto no service `caixas.server.ts` (a ser criado no ciclo 2)

```ts
// app/lib/caixas.server.ts (esboço — pseudocódigo, Fase 5 implementa)
export async function listarCaixas(filtro: { apenasAtivos?: boolean } = { apenasAtivos: true }) {
  assertCanSeeFinancials(currentUser);  // qualquer um com perfil financeiro
  return prisma.caixa.findMany({
    where: filtro.apenasAtivos ? { ativo: true } : {},
    orderBy: { nome: "asc" },
  });
}

export async function arquivarCaixa(id: string, user: SessionUser) {
  assertCanManageCaixa(user);  // ADMIN, PASTOR, FINANCEIRO (decisão §5.3 do brief)
  return prisma.caixa.update({
    where: { id },
    data: { ativo: false },
  });
}

export async function reabrirCaixa(id: string, user: SessionUser) {
  assertCanManageCaixa(user);
  return prisma.caixa.update({
    where: { id },
    data: { ativo: true },
  });
}
```

### 2.4 Impacto em helpers transversais

**`assertSaldoSuficiente`** em `app/lib/finance.server.ts` (RAG `pattern-trava-saldo-service` §2.1) já **inclui** a checagem de `ativo`:

```ts
if (caixa.ativo === false) {
  throw new Response(
    `${context}: caixa "${caixa.nome}" está arquivado e não aceita movimentações.`,
    { status: 409 }
  );
}
```

**`transferirEntreCaixas`** em `app/lib/transferencias.server.ts` (RAG `pattern-transferencia-caixas` §2.2) já **inclui** a checagem de `ativo` de **ambos** os caixas dentro do `$transaction`.

**`criarLancamento`** em `app/lib/lancamentos.server.ts` (ciclo 2) — quando tipo = ENTRADA, **não** precisa de trava de saldo (soma, não subtrai), mas precisa checar `caixa.ativo === false` para **bloquear criação de lançamento em caixa arquivado** (consistência: arquivado = sem novas movimentações).

### 2.5 Alternativas consideradas (e rejeitadas)

#### Alternativa A — Apenas `onDelete: Restrict` (status quo)

- **Prós:** zero alteração de schema. `Restrict` impede `delete` se há `Lancamento` ou `TransferenciaCaixa` referenciando — integridade 100% preservada.
- **Contras:** **não atende ao pedido do usuário** (brief §5.4: "perdemos a semântica de 'arquivado' que o usuário pediu"). Operacionalmente, o caixa "fechado" **continua visível** na listagem, poluindo a UI. Para "esconder" seria preciso `findMany` filtrando manualmente em cada rota, sem garantia.
- **Decisão:** **rejeitada** no discovery. Não formalizada.

#### Alternativa B — `Caixa.status: CaixaStatus` (enum)

```prisma
enum CaixaStatus { ATIVO ARQUIVADO }
model Caixa { ... status CaixaStatus @default(ATIVO) ... }
```

- **Prós:** extensível para outros estados futuros (ex: `BLOQUEADO_POR_AUDITORIA`, `EM_DESATIVACAO`).
- **Contras:** YAGNI. 1 valor futuro não justifica. Flag `Boolean` é mais simples, cobre o caso, e segue o padrão de mercado (soft-delete via `deletedAt: DateTime?` ou `isActive: Boolean`).
- **Decisão:** **rejeitada**. YAGNI/KISS. Se entrar novo estado, refatora-se `Boolean` → `enum`.

#### Alternativa C — `Caixa.arquivadoEm: DateTime?`

- **Prós:** preserva timestamp do arquivamento (auditoria mais rica: "Caixa Cantina foi arquivado em 2025-12-15").
- **Contras:** a auditoria de "quando foi arquivado" e "por quem" **pertence** a uma tabela de auditoria (`AuditLog`) ou ao `Lancamento` de "ajuste" (criado pelo serviço de arquivamento). Adicionar `arquivadoEm` no model sem esses dados é redundância inútil.
- **Decisão:** **rejeitada** por ora. Se auditoria rica for requisito futuro, criar `AuditLog` (RAG `lgpd-igreja-conect` §2.5 — backlog).

#### Alternativa D — `onDelete: Cascade` (deletar tudo)

- **Prós:** zero "lixo" no banco.
- **Contras:** **destrói histórico financeiro** (RN-FIN-01 e auditoria LGPD). Caixa deletado → todos os `Lancamento` espelho e `TransferenciaCaixa` desaparecem. Saldos históricos somem. **Inaceitável** para sistema financeiro.
- **Decisão:** **rejeitada**. Violaria auditoria e RN-FIN-01.

### 2.6 Decisão final (proposta, aguarda validação)

**`Caixa.ativo: Boolean @default(true)`** é a modelagem recomendada. Justificativa consolidada:

- Atende ao pedido do usuário (semântica de "arquivado").
- Preserva integridade histórica (Caixa continua no banco, relacionamentos intactos).
- Implementação trivial (1 campo + 1 índice).
- 2 helpers transversais (`assertSaldoSuficiente`, `transferirEntreCaixas`) **já contemplam** a checagem — sem retrabalho no service layer.
- RAG `architecture-monolith-modular` §1 já documenta a separação `arquivar` (negócio) vs `deletar` (admin) — soft-delete é o caminho natural.
- YAGNI/KISS: flag binário é mais simples que enum, e cobre 100% do caso.

## 3. Consequências

### Positivas

- **Integridade histórica 100% preservada:** `Caixa.ativo = false` continua no DB, `saldoCentavos` continua válido, `Lancamento` espelho continua visível em relatórios históricos (futuro).
- **Operação comum do domínio coberta:** criar/arquivar Caixa é decisão eclesiástica que acontece 1-4×/ano na vida de uma igreja. Sem `ativo`, seria um caso especial mal coberto.
- **RBAC alinhada:** `assertCanManageCaixa` (helper novo, espelhado em `assertCanSeeFinancials`) já é o gate de criar/editar/arquivar (matriz §4.8 do brief). Sem `ativo`, arquivar era literalmente "deletar" (impossível por `Restrict`).
- **Defesa em profundidade consistente:** assim como `Caixa` tem `onDelete: Restrict` (camada DB) + checagem no service (camada 3), `ativo` adiciona **mais uma camada** (UI esconde + service bloqueia + DB preserva).
- **Reversibilidade:** `reabrirCaixa` é trivial (1 `update` flip do flag). Se a equipe eclesiástica reativar um caixa, o histórico inteiro reaparece — incluindo saldos e lançamentos.
- **Testabilidade:** 1 teste de borda ("caixa arquivado não aceita movimentação") cobre 100% do gate.

### Negativas

- **Custo de 1 query** na listagem padrão: `findMany({ where: { ativo: true } })` precisa de índice em `ativo` para escalar. Mitigação: `@@index([ativo])` na migration (proposta §2.2 já inclui).
- **Soft-delete + auditoria é uma combinação clássica que pode vazar** se alguém esquecer o filtro `where: { ativo: true }`. Mitigação: criar helper `caixasAtivas()` (ou `listarCaixas({ apenasAtivos: true })`) que aplica o filtro por padrão; `listarTodosCaixas()` é opt-in (apenas para auditoria, com RBAC separado).
- **Não confundir com `deletedAt`** (padrão de mercado para soft-delete). O ciclo 2 não precisa de timestamp; se auditoria temporal for requisito, criar `AuditLog` separado.
- **Caixa arquivado pode ter saldo ≠ 0** (saldo congelado no momento do arquivamento). Isso é **correto e desejável** — significa que o caixa tinha dinheiro quando foi arquivado, e esse dinheiro está "guardado" no extrato. O Tesoureiro pode relatar "o Caixa Cantina tem R$ 234,56 arquivados desde 2025-12".

### Trade-offs aceitos

- **Não migrar para `enum` (Alternativa B):** YAGNI. Se 1 dia precisar de `BLOQUEADO` ou `EM_DESATIVACAO`, refatora.
- **Não criar `arquivadoEm` (Alternativa C):** YAGNI. Auditoria de "quando foi arquivado" pertence a tabela `AuditLog` (backlog, não ciclo 2).
- **Não criar tela dedicada de "Caixas Arquivados" no ciclo 2:** o primeiro uso real do `ativo` é bloquear movimentação. Listagem de arquivados é backlog. Quando entrar, tela `/app/financeiro/caixas/arquivados` com permissão de ADMIN/PASTOR.

## 4. Exemplo (referência — implementação é no ciclo 2, Fase 5)

### 4.1 Schema pós-migration

```prisma
// prisma/schema.prisma (após migration aprovada)
model Caixa {
  id            String   @id @default(uuid())
  nome          String   @unique
  saldoCentavos Int      @default(0)
  ativo         Boolean  @default(true)  // <-- NOVO

  lancamentos   Lancamento[]
  origemTransf  TransferenciaCaixa[] @relation("CaixaOrigem")
  destinoTransf TransferenciaCaixa[] @relation("CaixaDestino")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([ativo])  // <-- NOVO
  @@map("caixas")
}
```

### 4.2 Service (esboço)

```ts
// app/lib/caixas.server.ts (esboço, Fase 5 implementa com TDD)
import { prisma } from "~/db/prisma.server";
import { assertCanSeeFinancials, assertCanManageCaixa } from "~/lib/rbac.server";
import type { SessionUser } from "~/lib/session.types";

export const CaixaCreateSchema = z.object({
  nome: z.string().min(2).max(80).regex(/^[\w\sÀ-ÿ-]+$/, "Nome inválido"),
}).strict();

export async function listarCaixas(
  user: SessionUser,
  options: { apenasAtivos?: boolean; incluirInativos?: boolean } = { apenasAtivos: true }
) {
  assertCanSeeFinancials(user);
  if (options.incluirInativos && !options.apenasAtivos) {
    // Modo auditoria — exige cargo extra (não implementado no ciclo 2)
    assertCanManageCaixa(user);  // ADMIN, PASTOR, FINANCEIRO
  }
  return prisma.caixa.findMany({
    where: options.incluirInativos ? {} : { ativo: true },
    orderBy: { nome: "asc" },
  });
}

export async function criarCaixa(input: z.infer<typeof CaixaCreateSchema>, user: SessionUser) {
  assertCanManageCaixa(user);  // ADMIN, PASTOR, FINANCEIRO (matriz §4.8)
  return prisma.caixa.create({ data: { ...input, ativo: true } });
}

export async function arquivarCaixa(id: string, user: SessionUser) {
  assertCanManageCaixa(user);
  return prisma.caixa.update({ where: { id }, data: { ativo: false } });
}

export async function reabrirCaixa(id: string, user: SessionUser) {
  assertCanManageCaixa(user);
  return prisma.caixa.update({ where: { id }, data: { ativo: true } });
}
```

### 4.3 Teste de borda (TDD, bloqueador)

```ts
describe("Caixa.ativo — soft-delete (RN-FIN-01)", () => {
  it("caixa arquivado rejeita criarLancamento (409)", async () => {
    const caixa = await prismaTest.caixa.create({
      data: { nome: "Caixa Arquivado", saldoCentavos: 1000, ativo: false },
    });
    await expect(criarLancamento({
      tipo: "ENTRADA",
      categoria: "OFERTA",
      valorCentavos: 100,
      caixaId: caixa.id,
      dataCompetencia: new Date(),
      descricao: "Tentativa em caixa arquivado",
    }, adminUser)).rejects.toMatchObject({ status: 409 });
  });

  it("caixa arquivado rejeita transferência como origem OU destino (409)", async () => {
    const origem = await prismaTest.caixa.create({ data: { nome: "Origem Ativa", saldoCentavos: 1000, ativo: true } });
    const destino = await prismaTest.caixa.create({ data: { nome: "Destino Arquivado", saldoCentavos: 0, ativo: false } });

    await expect(transferirEntreCaixas({
      caixaOrigemId: origem.id, caixaDestinoId: destino.id, valorCentavos: 100,
    }, adminUser)).rejects.toMatchObject({ status: 409 });
  });

  it("listarCaixas padrão esconde arquivados", async () => {
    await prismaTest.caixa.create({ data: { nome: "Ativo", saldoCentavos: 0, ativo: true } });
    await prismaTest.caixa.create({ data: { nome: "Inativo", saldoCentavos: 0, ativo: false } });

    const visiveis = await listarCaixas(adminUser);
    expect(visiveis).toHaveLength(1);
    expect(visiveis[0].nome).toBe("Ativo");
  });

  it("reabrirCaixa restaura acesso (soft-delete reversível)", async () => {
    const caixa = await prismaTest.caixa.create({ data: { nome: "Caixa", saldoCentavos: 500, ativo: false } });
    await reabrirCaixa(caixa.id, adminUser);
    const reaberto = await prismaTest.caixa.findUnique({ where: { id: caixa.id } });
    expect(reaberto?.ativo).toBe(true);
    // Saldo preservado (soft-delete não mexe em saldo)
    expect(reaberto?.saldoCentavos).toBe(500);
  });
});
```

## 5. Anti-exemplos (o que **não** fazer)

- ❌ **Migrar para `enum CaixaStatus` antes de ter 3+ estados.** YAGNI. Boolean cobre.
- ❌ **Adicionar `arquivadoEm: DateTime` no model sem ter tabela de auditoria.** Redundância inútil. Quando entrar auditoria temporal, criar `AuditLog` (tabela dedicada, fora do model de negócio).
- ❌ **Deletar caixa com `prisma.caixa.delete`** mesmo com `onDelete: Restrict` no schema. Em produção, `Restrict` impede (integridade); em SQLite de teste sem constraint, deletaria histórico. **Nunca** chamar `.delete()` em `Caixa` no service.
- ❌ **Esconder caixa arquivado só na UI** (loader filtra). Bypass via URL direta na API ou chamada programática ignora o filtro. **Sempre** o filtro mora no **service** (Camada 3), com helper centralizado.
- ❌ **Permitir `criarLancamento` em caixa arquivado** (entrada) "porque não subtrai saldo". Confunde a regra: arquivado = sem novas movimentações, ponto. Trava vale para ENTRADA, SAIDA e TRANSFERENCIA.
- ❌ **Esquecer o índice `@@index([ativo])`** — `findMany({ where: { ativo: true } })` sem índice é full scan. Com ~10 caixas, irrelevante; com 100 caixas (multi-igreja futura), problema.
- ❌ **Migrar sem `@default(true)`** — `ALTER TABLE ADD COLUMN ativo BOOLEAN NOT NULL` sem default falha em tabela com dados. Default garante retrocompatibilidade.
- ❌ **Marcar `status: approved` neste RAG antes da Fase 2 (prd-reviewer) validar.** Status atual é **`pending`** propositadamente. Approval só após `prd-reviewer` confirmar.

## 6. RAGs relacionados

- [`.harness/RAG/architecture-financeiro.md`](./architecture-financeiro.md) — §4.1 (Lifecycle de Caixa) já menciona `ativo` como **proposta**; §6 (Decisões macro) lista como "pendente — formalização na Fase 2".
- [`.harness/RAG/pattern-trava-saldo-service.md`](./pattern-trava-saldo-service.md) — §2.1: `assertSaldoSuficiente` JÁ checa `caixa.ativo === false` (helper antecipou a decisão).
- [`.harness/RAG/pattern-transferencia-caixas.md`](./pattern-transferencia-caixas.md) — §2.2: `transferirEntreCaixas` JÁ checa `ativo` de **ambos** os caixas dentro do `$transaction`.
- [`.harness/RAG/convention-prisma-sqlite.md`](./convention-prisma-sqlite.md) — workflow de migration (`migrate dev` → `migrate deploy`); §2.7 (regra `onDelete: Restrict` em campo financeiro) — **soft-delete complementa, não substitui**, `Restrict`.
- [`.harness/RAG/security-rbac-matrix.md`](./security-rbac-matrix.md) — matriz §4.8 do brief: `ADMIN`, `PASTOR`, `FINANCEIRO` podem criar/arquivar Caixa (helper `assertCanManageCaixa` documentado em §5.3 do brief).
- [`.harness/RAG/architecture-monolith-modular.md`](./architecture-monolith-modular.md) — §1: separação `arquivar` (negócio) vs `deletar` (admin DB). Soft-delete é o caminho natural para o primeiro.
- **Brief do ciclo 2:** [`brief.md`](../../brief.md) §5.4 (proposta original) e §9.5 pendência #4 (formalização na Fase 2).

## 7. Quando revisar / Status

### Status atual: `pending`

**Razão do `pending`:** o brief §5.4 explicitamente lista como **"Decisão de modelagem adicional (proposta, requer confirmação na Fase 2)"**. A formalização está agendada para a **Fase 2 (Requisitos)** do ciclo 2, com gate do `prd-reviewer`. Até lá:

- ❌ **Não** gerar migration (`pnpm prisma migrate dev --name add_ativo_to_caixa`).
- ❌ **Não** editar `prisma/schema.prisma` para incluir `ativo`.
- ❌ **Não** marcar `status: approved` neste RAG.
- ✅ **Pode** usar o campo `ativo` em código de service (helpers `assertSaldoSuficiente` e `transferirEntreCaixas` já antecipam — ganham null-safe com `caixa.ativo === undefined → trata como true`).
- ✅ **Pode** documentar a decisão em outros RAGs e no `AGENTS.md` (Fase 1, presente ciclo).

### Critérios para mover de `pending` → `approved`

1. **`prd-reviewer`** validou a decisão na Fase 2 (Requisitos) — confirmando que atende ao pedido do usuário sem introduzir complexidade.
2. **PRD do Módulo Financeiro** inclui menção explícita ao campo `ativo` no model `Caixa` e ao fluxo de arquivar/reabrir.
3. **Designer** (Fase 3) já wireframou a tela de gerenciamento de caixas com toggle "arquivados" visível.
4. **Migration gerada e validada** (Fase 5): `pnpm prisma migrate dev --name add_ativo_to_caixa` roda sem erros em SQLite local, e a migration SQL está commitada em `prisma/migrations/`.
5. **Testes de borda** (4 testes em §4.3) **todos verdes**.

### Quando revisar

- Ao final da Fase 2 (Requisitos) — se `prd-reviewer` reprovar a proposta, voltar aqui e documentar alternativa.
- Ao final da Fase 5 (Build) — se migration não foi gerada por algum motivo, reavaliar.
- Quando algum dia entrar multi-igreja — provavelmente vira `Caixa.ativoPorIgrejaId: String?` (relação N:N de caixas visíveis por igreja). Refatorar este RAG.

### Próximos passos para o ciclo 2

1. **Fase 2 (Requisitos, próxima):** `prd-reviewer` valida esta decisão como parte do gate de score do PRD do Módulo Financeiro.
2. **Fase 3 (Design):** wireframe de `/app/financeiro/caixas` com toggle "Mostrar arquivados" + ação "Reabrir" no ADMIN.
3. **Fase 4 (Planejamento):** `sprint-tasker` quebra em tasks: migration + service `caixas.server.ts` + componente `FormCaixa` + 4 testes de borda.
4. **Fase 5 (Build):** backend gera migration (TDD: teste do service **antes** do schema), frontend implementa UI, tester roda E2E, security valida RBAC, lgpd-officer audita.
5. **Após implementação:** atualizar `status` deste RAG para `approved` e adicionar `version: 1.0
approvedBy: prd-reviewer (Phase 2 ciclo 2, score 90, gate ≥ 80 passado)
approvedAt: 2026-06-14T12:00:00Z`.
