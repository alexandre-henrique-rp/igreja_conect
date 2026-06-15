# Atualizar Aba "Fidelidade Financeira" (`/app/membros/:id?tab=fidelidade`) — Design

## 1. Contexto

Substituir o **placeholder** do componente `TabFidelidadeFinanceira` (RN-MEM-03 — já preparado no ciclo 1) por uma **lista real de dízimos** + **card de resumo** (total do mês corrente, total do ano corrente).

Acessível via aba "Fidelidade Financeira" no detalhe do membro (`/app/membros/:id?tab=fidelidade`).

**Persona-alvo:** perfis com `canSeeFinancials` (3 perfis — `ADMIN`, `PASTOR`, `FINANCEIRO`). `SECRETARIO`, `DISCIPULADOR`, `LIDER_MINISTERIO` **não** veem a aba (Camada 1 UI) **e** recebem 403 em bypass via URL (Camada 2 e 3).

**Caso de uso primário (métrica macro do ciclo 2, brief §7.1 — SEGUNDA PARTE):** `PASTOR` abre o perfil do Membro X na aba "Fidelidade Financeira" e vê a tabela de dízimos em ordem decrescente, com totais do mês e do ano. Confirma que o dízimo lançado pelo `FINANCEIRO` há 2 minutos aparece.

**Casos secundários:**
- Empty state amigável: "Membro ainda não tem dízimos registrados."
- Resumo do mês e do ano (cards no topo).
- Link "Lançar dízimo" (atalho para `/app/financeiro/lancamentos/novo?membroId=<id>`) — opcional.
- Auditoria: cada dízimo tem `dataCompetencia` (UTC) e `descricao`.

**Restrições críticas:**
- **RN-MEM-03 (privacidade):** aba some da UI para SECRETARIO/DISCIPULADOR/LIDER_MINISTERIO. URL `?tab=fidelidade` direta com perfil inadequado → loader redireciona para `?tab=dados` **e** service lança 403 (Camada 3 redundante).
- **LGPD (Art. 18, 31):** dízimo é dado financeiro sensível. `safeLog` com allowlist. Nunca logar `valorCentavos` ou lista de dízimos.
- **Schema atual:** `Lancamento.membro` é `SetNull` no delete (dízimo órfão preserva histórico). UI exibe "Dízimo órfão — (membro removido)" se aplicável.

---

## 2. Wireframe

### 2.1 Desktop (≥ 1024px) — aba "Fidelidade Financeira" dentro do detalhe do membro

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Topbar + Sidebar                                                       │
├────────────┬─────────────────────────────────────────────────────────────┤
│ Sidebar    │  Membros > Maria da Silva > Fidelidade Financeira          │ ← breadcrumb
│            │                                                             │
│            │  ┌─ Resumo ───────────────────────────────────────────────┐  │
│            │  │ Dízimos no Mês (Junho 2026)                          │  │ ← card 1
│            │  │ R$ 150,00    (3 dízimos)                              │  │
│            │  │                                                        │  │
│            │  │ Dízimos no Ano (2026)                                 │  │ ← card 2
│            │  │ R$ 850,00    (17 dízimos)                             │  │
│            │  └────────────────────────────────────────────────────────┘  │
│            │                                                             │
│            │  Histórico de dízimos (47)                  [+ Lançar dízimo]│ ← CTA opcional
│            │  ┌──────────────────────────────────────────────────────┐  │
│            │  │ Data       │ Valor (R$)  │ Descrição                │  │ ← tabela
│            │  ├──────────────────────────────────────────────────────┤  │
│            │  │ 14/06/2026 │ +50,00      │ Dízimo mensal            │  │
│            │  │ 13/05/2026 │ +50,00      │ Dízimo mensal            │  │
│            │  │ 12/04/2026 │ +50,00      │ Dízimo mensal            │  │
│            │  │ 15/03/2026 │ +50,00      │ Dízimo mensal            │  │
│            │  │ 14/02/2026 │ +50,00      │ Dízimo mensal            │  │
│            │  │ ... (pagin.)                                            │  │
│            │  └──────────────────────────────────────────────────────┘  │
│            │                                                             │
│            │  ‹ 1 2 3 ... 5 ›   Por página: 25 ▼                          │ ← paginação
│            │                                                             │
└────────────┴─────────────────────────────────────────────────────────────┘
```

### 2.2 Mobile

```
┌──────────────────────────────┐
│ [☰] Maria da Silva           │
│ [Dados] [Discipulado]        │ ← tabs (active = "Fidelidade")
│ [Fidelidade]                 │
├──────────────────────────────┤
│ Resumo                       │
│ ┌──────────────────────────┐ │
│ │ Dízimos no Mês (Jun/26)  │ │
│ │ R$ 150,00                │ │
│ │ 3 dízimos                │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Dízimos no Ano (2026)    │ │
│ │ R$ 850,00                │ │
│ │ 17 dízimos               │ │
│ └──────────────────────────┘ │
│                              │
│ Histórico (47)               │
│ ┌──────────────────────────┐ │
│ │ 14/06/2026               │ │
│ │ +R$ 50,00                │ │
│ │ Dízimo mensal            │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ 13/05/2026               │ │
│ │ +R$ 50,00                │ │
│ │ Dízimo mensal            │ │
│ └──────────────────────────┘ │
│ ...                          │
│ [Carregar mais]              │
└──────────────────────────────┘
```

---

## 3. Componentes

| Componente | Fonte | Props | Localização |
|---|---|---|---|
| `<TabFidelidadeFinanceira>` | substituir (ciclo 1 era placeholder) | `dizimos: LancamentoResumo[]`, `resumo: { mes: { totalCentavos, count }, ano: { totalCentavos, count } }`, `podeLancarDizimo: boolean` | `app/components/TabFidelidadeFinanceira.tsx` |
| `<ResumoDizimos>` | novo | `mes: { totalCentavos, count }`, `ano: { totalCentavos, count }` | `app/components/ResumoDizimos.tsx` |
| `<TabelaDizimos>` | novo | `items: LancamentoResumo[]` | `app/components/TabelaDizimos.tsx` |
| `<CardDizimo>` | novo (mobile) | mesma | `app/components/CardDizimo.tsx` |
| `<Pagination>` | shared (ciclo 1) | `current`, `total`, `basePath`, `searchParams?` | (já existe) |
| `<EmptyState>` | shared (ciclo 1) | (já existe) | (já existe) |
| `<Can>` | shared (ciclo 1) | (já existe) | (já existe) |

**Hierarquia:**
- Esta é uma **atualização** de uma aba já existente em `app/components/TabFidelidadeFinanceira.tsx`.
- Modifica `app/routes/app/membros.$id.tsx` para passar `dizimos` e `resumo` quando `tab = "fidelidade"`.
- Service `getDizimosByMembro` em `app/lib/finance.server.ts` (estender — já existe como placeholder; ciclo 2 descomenta a query real + adiciona `getResumoDizimosByMembro`).

---

## 4. Estados

| Estado | Quando | Render |
|---|---|---|
| **Initial (membro com dízimos)** | Membro tem ≥ 1 dízimo | Cards de resumo + tabela paginada. |
| **Initial (membro sem dízimos)** | Membro sem dízimos | EmptyState: "Este membro ainda não tem dízimos registrados. Lançamento é feito pelo Financeiro em /app/financeiro/lancamentos/novo." |
| **SECRETARIO / DISCIPULADOR / LIDER_MINISTERIO** | Tentativa de acesso à aba | **Camada 1:** aba **não renderiza**. **Camada 2 (loader):** se `?tab=fidelidade` na URL mas cargo inválido, redireciona para `?tab=dados`. **Camada 3 (service):** `getDizimosByMembro` lança 403 se bypass programático. |
| **Loading** | Loader em andamento | Skeleton: 2 retângulos (cards) + 5 linhas com `animate-pulse`. |
| **Página 2+** | `?page=2` | Paginação. Preserva `tab=fidelidade`. |
| **Membro deletado (dízimo órfão)** | Lançamento com `membroId: null` (SetNull) | Tabela mostra o lançamento como "Dízimo — (membro removido)" (mas se `membroId` é null, **NÃO** aparece na aba Fidelidade do membro que foi deletado — só em relatórios). Edge case raro. |

---

## 5. Fluxos de interação

| Elemento | Evento | Comportamento |
|---|---|---|
| Tab "Fidelidade" (nav dentro do detalhe do membro) | Click | URL vira `/app/membros/<id>?tab=fidelidade`. Loader busca dízimos. Renderiza aba. |
| Botão "+ Lançar dízimo" | Click | Navega para `/app/financeiro/lancamentos/novo?membroId=<id>`. (Pré-preenchimento via search param — ver DESIGN `private-financeiro-lancamento-novo.DESIGN.md`.) |
| Item da tabela (dízimo) | Click | (futuro: detalhe do lançamento — backlog). Por ora, sem ação. |
| Paginação | Click | Navega para `?tab=fidelidade&page=2`. Preserva tab. |

**Navegação por teclado:**
- Tab: tab nav (Dados, Discipulado, Fidelidade) > cards (read-only) > tabela (read-only) > CTA "+ Lançar" > paginação.
- Foco visível em todos os botões.

**Loader redirect (Camada 2 RBAC):**

```ts
// app/routes/app/membros.$id.tsx (loader)
const tab = url.searchParams.get("tab") ?? "dados";
if (tab === "fidelidade" && !canSeeFinancials(user)) {
  // Redirect para "dados" (UX, não 403 — não vaza informação)
  throw redirect(`/app/membros/${params.id}?tab=dados`);
}
```

---

## 6. Validações e regras

### 6.1 Sem validação de input (read-only)

Esta aba é read-only. Não há `<Form>`.

### 6.2 Regras de negócio

- **RN-MEM-03 (privacidade):** `getDizimosByMembro` chama `assertCanSeeFinancials(user)` como **PRIMEIRA** linha (Camada 3). Lança `Response(403)` se cargo inválido.
- **Categoria:** `getDizimosByMembro` filtra `where: { membroId, categoria: "DIZIMO" }` (apenas dízimos, RN-FIN-05).
- **Ordenação:** `orderBy: { dataCompetencia: "desc" }` + secundário `{ id: "asc" }` (ordem determinística).
- **Resumo do mês:** `SUM(valorCentavos WHERE dataCompetencia >= firstDayOfCurrentMonth AND dataCompetencia < firstDayOfNextMonth AND categoria = "DIZIMO" AND membroId = <id>)`.
- **Resumo do ano:** mesma query, ano corrente.
- **Sem auditoria de leitura (LGPD art. 37):** backlog. Não registrar "quem viu o quê".

### 6.3 Edge cases

- **Membro sem dízimos:** empty state.
- **Dízimo órfão (membro deletado):** não aparece na aba (já que `membroId = null` ≠ `membroId = <id>`). Edge case raro.
- **Dízimo com `descricao` muito longa:** truncar com `text-ellipsis` (max-w-xs + truncate).
- **Valor zero (não deveria acontecer por Zod, mas defesa em profundidade):** service `getDizimosByMembro` filtra `valorCentavos > 0` (implícito por Zod).
- **Filtro SECURITY bypass:** `getDizimosByMembro` lança 403 mesmo se loader esquecer (Camada 3 redundante).

### 6.4 Integrações externas

Nenhuma.

---

## 7. RBAC (defesa em 3 camadas)

| Operação | ADMIN | PASTOR | FINANCEIRO | SECRETARIO | DISCIPULADOR | LIDER_MIN. |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Aba "Fidelidade" aparece no nav | ✅ | ✅ | ✅ | 🚫 | 🚫 | 🚫 |
| Conteúdo da aba renderiza | ✅ | ✅ | ✅ | 🚫 (redirect ou 403) | 🚫 (redirect ou 403) | 🚫 (redirect ou 403) |
| Botão "+ Lançar dízimo" | ✅ | ✅ | ✅ | 🚫 (UI esconde) | 🚫 | 🚫 |

**Defesa em 3 camadas:**
- **UI (Camada 1):** `<Can allow={["ADMIN", "PASTOR", "FINANCEIRO"]}>` envolvendo a aba. SECRETARIO/DISCIPULADOR/LIDER_MINISTERIO **não veem** o link da aba.
- **Loader (Camada 2):** se `?tab=fidelidade` na URL mas cargo inválido, **redirect** para `?tab=dados` (UX — não 403, para não vazar a existência da aba).
- **Service (Camada 3):** `getDizimosByMembro` chama `assertCanSeeFinancials(user)` como PRIMEIRA linha, lança `Response(403)` se bypass programático (curl, DevTools).

**Decisão (do ciclo 1, `PRODUCT.md §7.4`):** "A aba **simplesmente não existe na interface** para perfis sem permissão — e se algum desavisado tentar acessar via URL direta, recebe 403 do servidor." Esta é a decisão formal.

**Implementação (camada 2):** redirect para `?tab=dados` (UX, não vaza informação), **e** service lança 403 se loader foi bypassed.

---

## 8. Dados (loader + service)

### 8.1 Loader (`app/routes/app/membros.$id.tsx`)

```ts
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  const url = new URL(request.url);
  const tab = url.searchParams.get("tab") ?? "dados";
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);

  // Camada 2: redirect se tab=fidelidade + cargo inválido
  if (tab === "fidelidade" && !canSeeFinancials(user)) {
    throw redirect(`/app/membros/${params.id}?tab=dados`);
  }

  const membro = await getMembroById(params.id, user);
  if (!membro) throw new Response("Membro não encontrado.", { status: 404 });

  // Buscar dízimos apenas se aba fidelidade
  let dizimos: LancamentoResumo[] = [];
  let resumo: ResumoDizimos | null = null;
  if (tab === "fidelidade") {
    const data = await getDizimosByMembro(params.id, { page, pageSize: 25 }, user);
    dizimos = data.items;
    resumo = data.resumo;
  }

  return { user, membro, dizimos, resumo, tab, page };
}
```

### 8.2 Service contract (`app/lib/finance.server.ts`)

**Estender `getDizimosByMembro`** (já existe como placeholder com assertCanSeeFinancials — basta descomentar a query real e adicionar paginação + resumo).

**Nova assinatura:**

```ts
/**
 * @description Lista os dízimos de um membro (apenas categoria DIZIMO, RN-FIN-05).
 * Inclui resumo do mês e ano correntes. **Camada 3 RBAC** — bloqueia perfis
 * sem acesso a dados financeiros ANTES de qualquer query.
 * @param {string} membroId - UUID do membro.
 * @param {object} options - Paginação.
 * @param {number} options.page - Página atual (default 1).
 * @param {number} options.pageSize - Itens por página (default 25).
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<{ items: LancamentoResumo[], total: number, resumo: { mes: { totalCentavos: number, count: number }, ano: { totalCentavos: number, count: number } } }>}
 * @throws {Response} 403 se user sem perfil financeiro.
 */
export async function getDizimosByMembro(
  membroId: string,
  options: { page?: number; pageSize?: number },
  user: SessionUser
): Promise<{
  items: LancamentoResumo[];
  total: number;
  page: number;
  pageSize: number;
  resumo: { mes: { totalCentavos: number; count: number }; ano: { totalCentavos: number; count: number } };
}>;
```

**Implementação:**

```ts
export async function getDizimosByMembro(
  membroId: string,
  options: { page = 1, pageSize = 25 } = {},
  user: SessionUser
) {
  // Camada 3 RBAC — PRIMEIRO
  assertCanSeeFinancials(user);

  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
  const firstDayOfNextYear = new Date(now.getFullYear() + 1, 0, 1);

  const where = { membroId, categoria: "DIZIMO" as const };

  const [items, total, sumMes, countMes, sumAno, countAno] = await Promise.all([
    prisma.lancamento.findMany({
      where,
      orderBy: [{ dataCompetencia: "desc" }, { id: "asc" }],
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      select: { id: true, dataCompetencia: true, valorCentavos: true, descricao: true, caixa: { select: { id: true, nome: true } } },
    }),
    prisma.lancamento.count({ where }),
    prisma.lancamento.aggregate({
      where: { ...where, dataCompetencia: { gte: firstDayOfMonth, lt: firstDayOfNextMonth } },
      _sum: { valorCentavos: true },
    }),
    prisma.lancamento.count({
      where: { ...where, dataCompetencia: { gte: firstDayOfMonth, lt: firstDayOfNextMonth } },
    }),
    prisma.lancamento.aggregate({
      where: { ...where, dataCompetencia: { gte: firstDayOfYear, lt: firstDayOfNextYear } },
      _sum: { valorCentavos: true },
    }),
    prisma.lancamento.count({
      where: { ...where, dataCompetencia: { gte: firstDayOfYear, lt: firstDayOfNextYear } },
    }),
  ]);

  return {
    items,
    total,
    page: options.page,
    pageSize: options.pageSize,
    resumo: {
      mes: { totalCentavos: sumMes._sum.valorCentavos ?? 0, count: countMes },
      ano: { totalCentavos: sumAno._sum.valorCentavos ?? 0, count: countAno },
    },
  };
}
```

**Tipos:**

```ts
type LancamentoResumo = {
  id: string;
  dataCompetencia: Date;
  valorCentavos: number;
  descricao: string;
  caixa: { id: string; nome: string };
};

type ResumoDizimos = {
  mes: { totalCentavos: number; count: number };
  ano: { totalCentavos: number; count: number };
};
```

### 8.3 Edge cases do service

- **0 dízimos:** `items: []`, `total: 0`, `resumo.mes = { totalCentavos: 0, count: 0 }`, `resumo.ano = { ... }`.
- **Dízimo com `descricao` null:** Zod já exige `min(1)`, mas se vier `null` (defesa em profundidade), default para "Dízimo" no display.
- **Membro deletado:** query `where: { membroId }` retorna 0 itens (porque `membroId = null`). UI renderiza empty state.
- **Dízimo com data futura (agendado):** aparece na lista em ordem cronológica decrescente. Aparece no resumo do mês se a data cair no mês corrente.

---

## 9. Testes sugeridos (TDD)

### 9.1 Unit (sem DB)

- `getDizimosByMembro`:
  - `secretarioUser` → lança `Response(403)`.
  - `discipuladorUser` → lança `Response(403)`.
  - `liderMinisterioUser` → lança `Response(403)`.
  - `adminUser` → ok.

### 9.2 Integração (com DB, `setupTestDb`)

- Setup: cria membro X. Cria 10 lançamentos DIZIMO (5 no mês corrente, 3 no ano anterior, 2 órfãos com `membroId: null`).
- `getDizimosByMembro(membroXId, { page: 1, pageSize: 25 }, adminUser)`:
  - Retorna 5 dízimos (apenas do membro X).
  - `resumo.mes = { totalCentavos: 25000, count: 5 }`.
  - `resumo.ano = { totalCentavos: 25000, count: 5 }`.
  - `total: 5`.
- `getDizimosByMembro(membroXId, { page: 1, pageSize: 3 }, adminUser)`:
  - Retorna 3 dízimos (paginação).
  - `total: 5`, `page: 1`, `pageSize: 3`.
- `getDizimosByMembro(membroYId, {}, adminUser)` (sem dízimos):
  - `items: []`, `total: 0`, `resumo: { mes: { totalCentavos: 0, count: 0 }, ano: { ... } }`.
- `getDizimosByMembro(membroXId, {}, secretarioUser)`:
  - Lança `Response(403)`.
- `getDizimosByMembro(membroXId, {}, pastorUser)`:
  - OK (PASTOR pode ver dízimos — RN-MEM-03).
- `getDizimosByMembro(membroXId, {}, financeiroUser)`:
  - OK.

### 9.3 E2E (Playwright) — atualizar `e2e/fidelidade-bypass.spec.ts` (já existe do ciclo 1)

- **Métrica macro (brief §7.1 — PARTE 2):**
  1. PASTOR loga → `/app/membros/<mariaId>?tab=fidelidade` → vê dízimos recém-lançados.
- Login `admin@igreja.local` → `/app/membros/<id>?tab=fidelidade` → vê cards de resumo + tabela.
- Login `secretario@igreja.local` → `/app/membros/<id>?tab=fidelidade` → loader **redireciona** para `?tab=dados` (Camada 2).
- Login `discipulador@igreja.local` → `/app/membros/<id>?tab=fidelidade` → loader **redireciona** para `?tab=dados` (Camada 2).
- **Bypass programático:** curl com `cookie sid=<secretarioSid>` + URL `?tab=fidelidade` → loader redireciona (Camada 2). Se loader for bypassed, service `getDizimosByMembro` lança 403 (Camada 3).
- Empty state: membro sem dízimos → empty state amigável.
- Resumo do mês e do ano corretos após lançamentos.

---

## 10. Critérios de aceite (gate Phase 5)

- [ ] Loader chama `canSeeFinancials` e redireciona se cargo inválido (Camada 2).
- [ ] `getDizimosByMembro` chama `assertCanSeeFinancials` como PRIMEIRA linha (Camada 3).
- [ ] `where: { membroId, categoria: "DIZIMO" }` filtra apenas dízimos (RN-FIN-05).
- [ ] `orderBy: { dataCompetencia: "desc" }, { id: "asc" }` (ordem determinística).
- [ ] Cards de resumo do mês e ano corretos (SUM + COUNT em 2 ranges).
- [ ] Paginação 25/página, preserva `tab=fidelidade`.
- [ ] SECRETARIO/DISCIPULADOR/LIDER_MINISTERIO **não veem** a aba (Camada 1).
- [ ] Bypass via URL → loader redireciona para `?tab=dados` (Camada 2).
- [ ] Bypass programático (loader bypassed) → service lança 403 (Camada 3).
- [ ] Empty state amigável.
- [ ] Cobertura do service ≥ 100% (gate RN-MEM-03).
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] Sem PII em log (`safeLog`).
- [ ] JSDoc completo.

---

## 11. Acessibilidade

- **`<h2>`** para "Resumo", "Histórico de dízimos".
- **`<h3>`** dentro de cada card (mes/ano).
- **`<table>`** com `<caption className="sr-only">`, `<th scope="col">`.
- **Cards de resumo** com `aria-label` descritivo.
- **Empty state** com `role="status"`.
- **Tab nav** (Dados, Discipulado, Fidelidade) com `aria-current="page"` na aba ativa.
- **Botão "+ Lançar dízimo"** com `aria-label="Lançar novo dízimo para {nome do membro}"`.

---

## 12. Mobile

- **Cards de resumo** full-width, empilhados.
- **Tabela** vira `<CardDizimo>` (1 dízimo por card).
- **Paginação** "Carregar mais" em vez de números.
- **Tab nav** mantém-se na topbar; em mobile, tabs viram abas horizontais com scroll.

---

## 13. Cross-references

- **PRD:** [Apêndice D §D.3 F6 (Aba Fidelidade Financeira)](./PRD.html#c2-features), §D.4 (DISCIPULADOR bypass URL → 403), §D.7 (métrica macro).
- **SPEC:** [Apêndice D §D.4, §D.5 (RBAC fina)](./SPEC.html#c2-endpoints).
- **AGENTS:** [§"Módulo Financeiro (ciclo 2)" §"Como rodar a aba Fidelidade Financeira localmente"](./agents/AGENTS.md).
- **ARCH:** [§8.5 (Fluxo crítico 4: Aba Fidelidade Financeira)](./docs/architecture/ARCH.md).
- **RAGs:**
  - [`.harness/RAG/architecture-financeiro.md`](./.harness/RAG/architecture-financeiro.md) §3.4 (fluxo completo).
  - [`.harness/RAG/security-rbac-matrix.md`](./.harness/RAG/security-rbac-matrix.md) — matriz, `assertCanSeeFinancials`.
  - [`.harness/RAG/pattern-3-layer-rbac.md`](./.harness/RAG/pattern-3-layer-rbac.md) — 3 camadas.
  - [`.harness/RAG/lgpd-igreja-conect.md`](./.harness/RAG/lgpd-igreja-conect.md) — sem PII em log, dízimo é dado sensível.
  - [`.harness/RAG/lgpd-bases-legais-igreja.md`](./.harness/RAG/lgpd-bases-legais-igreja.md) — base legal (Art. 7º, 11º).
