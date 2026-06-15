# Dashboard Financeiro (`/app/financeiro`) — Design

## 1. Contexto

Página raiz do **Módulo Financeiro** (ciclo 2). Acessível em `/app/financeiro`. Funciona como "home" do módulo: visão consolidada dos saldos dos caixas, indicador agregado, ações rápidas e atalhos para áreas mais usadas.

**Persona-alvo:** perfis com `canSeeFinancials` (4 perfis — `ADMIN`, `PASTOR`, `FINANCEIRO`, `SECRETARIO`). **DISCIPULADOR** e **LIDER_MINISTERIO** recebem 403 em todas as 3 camadas (UI esconde, loader checa, service barra).

**Caso de uso primário (métrica macro do ciclo 2, brief §7.1):** `FINANCEIRO` entra, vê o saldo atual do Caixa Geral, clica em "Novo lançamento" e registra um dízimo do Membro X. Saldo do caixa reflete a entrada. `PASTOR` abre a aba Fidelidade Financeira do Membro X e vê o dízimo. **Tudo em menos de 2 minutos.**

**Casos secundários:**
- Ver extrato resumido de cada caixa (5 últimos lançamentos).
- Atalho para nova transferência entre caixas.
- Atalho para gerenciar caixas (criar/arquivar/reabrir).
- Ver saldo agregado (soma de todos os caixas ativos).
- Ver alertas financeiros: caixas com saldo baixo, caixas arquivados.

**Restrição crítica (RN-MEM-03):** dízimos e ofertas são restritos a ADMIN/PASTOR/FINANCEIRO. `SECRETARIO` vê o dashboard mas não vê dízimos vinculados a membro (loader filtra). Defesa em 3 camadas obrigatória.

**Restrição monetária:** saldos em **centavos** (`Int`) no DB, exibidos em BRL via `formatBRLFromCents` (RAG `convention-monetary-values`). Nunca `Float`.

---

## 2. Wireframe

### 2.1 Desktop (≥ 1024px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Topbar + Sidebar (com "Financeiro" destacado)                           │
├────────────┬─────────────────────────────────────────────────────────────┤
│ Sidebar    │  Financeiro                                                  │ ← h1
│            │  ┌──────────────────────────────────────────────────────┐  │
│ • Dashboard│  │ Saldo total                                           │  │ ← KPI agregado
│ • Membros  │  │ R$ 1.234,56  (Caixa Geral + Cantina + Missões)        │  │
│ • Financei-│  └──────────────────────────────────────────────────────┘  │
│   ro(ativo)│                                                             │
│ • Ministé- │  Caixas ativos (3)                  [+ Nova Caixa]          │ ← seção
│   rios     │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│ • Alertas  │  │ Caixa Geral  │ │ Caixa Cantina│ │ Caixa Missões│         │ ← cards
│            │  │ R$ 1.000,00  │ │ R$ 234,56    │ │ R$ 0,00      │         │
│ ─────      │  │ +5 lanç. mês │ │ +2 lanç. mês │ │ 0 lanç. mês  │         │
│ Sair       │  │ [Ver extrato]│ │ [Ver extrato]│ │ [Ver extrato]│         │
│            │  │ [Novo lanç.] │ │ [Novo lanç.] │ │ [Novo lanç.] │         │
│            │  └──────────────┘ └──────────────┘ └──────────────┘         │
│            │                                                             │
│            │  Atalhos rápidos                                            │ ← atalhos
│            │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│            │  │ + Novo       │ │ + Nova       │ │ ⚙ Gerenciar  │         │
│            │  │   Lançamento │ │   Transfe-   │ │   Caixas     │         │
│            │  │              │ │   rência     │ │              │         │
│            │  └──────────────┘ └──────────────┘ └──────────────┘         │
│            │                                                             │
│            │  Últimas movimentações (5 mais recentes)                    │
│            │  ┌──────────────────────────────────────────────────────┐  │
│            │  │ 14/06  Caixa Geral   + R$ 50,00  Dízimo — Maria     │  │
│            │  │ 13/06  Caixa Cantina + R$ 20,00  Oferta             │  │
│            │  │ 12/06  Caixa Geral   - R$ 100,00 Despesa operacional│  │
│            │  │ 10/06  Caixa Geral → R$ 50,00  Transferência p/ Cant.│  │
│            │  │ 09/06  Caixa Cantina - R$ 12,00 Compra material    │  │
│            │  └──────────────────────────────────────────────────────┘  │
└────────────┴─────────────────────────────────────────────────────────────┘
```

### 2.2 Mobile (< 768px)

```
┌──────────────────────────────┐
│ [☰] [Financeiro]   [🔔] [👤]│
├──────────────────────────────┤
│ Saldo total                  │
│ R$ 1.234,56                  │
│ Caixa Geral + Cantina + Miss.│
│                              │
│ Caixas ativos (3)            │
│ ┌──────────────────────────┐ │
│ │ Caixa Geral              │ │
│ │ R$ 1.000,00              │ │
│ │ +5 lanç. mês             │ │
│ │ [Ver] [+ Lançar]         │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Caixa Cantina            │ │
│ │ R$ 234,56                │ │
│ │ +2 lanç. mês             │ │
│ │ [Ver] [+ Lançar]         │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Caixa Missões            │ │
│ │ R$ 0,00                  │ │
│ │ 0 lanç. mês              │ │
│ │ [Ver] [+ Lançar]         │ │
│ └──────────────────────────┘ │
│ [+ Nova Caixa]               │
│                              │
│ Atalhos                      │
│ [+ Lançamento] [+ Transf.]  │
│ [⚙ Gerenciar Caixas]         │
│                              │
│ Últimas movimentações        │
│ • 14/06 +R$ 50,00 Dízimo    │
│ • 13/06 +R$ 20,00 Oferta    │
│ • 12/06 -R$ 100,00 Despesa  │
│ [Ver todas em /transferencias│
│  e /caixas/:id]              │
└──────────────────────────────┘
```

---

## 3. Componentes

| Componente | Fonte | Props | Localização |
|---|---|---|---|
| `<ShellAutenticado>` | shared (ciclo 1) | — | (já existe) |
| `<PageHeader>` | shared (ciclo 1) | `title`, `action?` | (já existe) |
| `<KpiSaldoTotal>` | novo (ciclo 2) | `saldoCentavos: number`, `caixasCount: number` | `app/components/KpiSaldoTotal.tsx` |
| `<CardSaldoCaixa>` | novo (ciclo 2) | `caixa: { id, nome, saldoCentavos, lancamentosMes }`, `podeCriarLancamento: boolean` | `app/components/CardSaldoCaixa.tsx` |
| `<AtalhoFinanceiro>` | novo (ciclo 2) | `label`, `href`, `variant?` | `app/components/AtalhoFinanceiro.tsx` (pode reusar `<Atalho>` do ciclo 1) |
| `<UltimasMovimentacoes>` | novo (ciclo 2) | `items: Array<{data, caixa, valorCentavos, categoria, descricao}>`, `podeVerDescricaoMembro: boolean` | `app/components/UltimasMovimentacoes.tsx` |
| `<EmptyState>` | shared (ciclo 1) | `title`, `description`, `action?` | (já existe) |
| `<Can>` | shared (ciclo 1) | `user`, `allow`, `children` | (já existe) |

**Hierarquia de arquivos:**
- `app/routes/app/financeiro._index.tsx` (rota `/app/financeiro`).
- Service loader chama `getDashboardFinanceiro(user)` em `app/lib/finance.server.ts` (helper novo, ou extensão de `getDizimosByMembro`).
- Sidebar destaca "Financeiro" (item de menu ativo).

---

## 4. Estados

| Estado | Quando | Render |
|---|---|---|
| **Initial (com caixas)** | Sistema tem ≥ 1 caixa (sempre após `db:reset`) | KPI agregado + cards + atalhos + últimos 5 lançamentos. |
| **Initial (sistema novo)** | Seed rodou mas sem lançamentos | KPI agregado mostra R$ 0,00; cards mostram saldo 0; últimos lançamentos = "Nenhuma movimentação ainda." |
| **SECRETARIO logado** | RN-MEM-03: SECRETARIO vê dashboard mas **não** vê dízimos | Lista "Últimas movimentações" **filtra** lançamentos onde `categoria = DIZIMO` (mostra apenas CAMPANHA, DESPESA_OPERACIONAL, COMPRA_ESTOQUE, MANUTENCAO, TRANSFERENCIA + OFERTA anônima sem membro). |
| **DISCIPULADOR/LIDER_MINISTERIO** | Tentativa de acesso | **403** do loader. UI nunca renderiza. Defesa em 3 camadas. |
| **Loading** | Loader em andamento (1ª carga) | Skeleton: 1 retângulo grande (KPI) + 3 retângulos menores (cards) + lista vazia com `animate-pulse`. |
| **Empty (sem caixas ativos)** | Todos os caixas arquivados (`ativo = false`) | EmptyState: "Nenhum caixa ativo. Reative um caixa arquivado ou crie um novo." + CTA "+ Nova Caixa" (só para ADMIN/PASTOR/FINANCEIRO). |
| **Caixa arquivado** | Toggle "Mostrar arquivados" desativado por padrão | Caixas com `ativo = false` NÃO aparecem nos cards. Aparece em listagem dedicada (futuro: `/app/financeiro/caixas/arquivados` — backlog). |
| **Error (500)** | Loader falhou | ErrorState central: "Não foi possível carregar o painel financeiro. Tente novamente." + botão "Recarregar". |
| **Saldo baixo** | Caixa com saldo < R$ 10,00 (YAGNI: só um destaque visual, sem alerta real) | Borda do card com cor `amber-700` + ícone de aviso. Sem notificação (cron é backlog). |

---

## 5. Fluxos de interação

| Elemento | Evento | Comportamento |
|---|---|---|
| KPI "Saldo total" | (informativo) | Sem ação de click (sempre o total agregado). |
| Card de caixa | Click em "Ver extrato" | Navega para `/app/financeiro/caixas/{id}`. |
| Card de caixa | Click em "+ Lançar" | Abre modal inline OU navega para `/app/financeiro/lancamentos/novo?caixaId={id}` pré-preenchido. **Decisão (YAGNI):** navega para a rota dedicada, pré-preenchendo `caixaId` via search param. |
| Atalho "+ Novo Lançamento" | Click | Navega para `/app/financeiro/lancamentos/novo`. |
| Atalho "+ Nova Transferência" | Click | Navega para `/app/financeiro/transferencias/nova`. |
| Atalho "Gerenciar Caixas" | Click | Navega para `/app/financeiro/caixas`. |
| Item "Últimas movimentações" | Click | Navega para `/app/financeiro/caixas/{caixaId}` (foca o caixa da movimentação). |
| Sidebar "Financeiro" | Click | Recarrega a página atual (já é a rota atual). |

**Navegação por teclado:**
- Tab: KPI → cards (1 a 1) → atalhos (1 a 1) → últimos lançamentos (1 a 1) → sidebar.
- Foco visível em todos os elementos clicáveis (`<Link>` ou `<button>`).
- Cards de caixa com 2 botões: `Tab` percorre Card → "Ver extrato" → "+ Lançar".

**Pré-preenchimento via search param:**
- `?caixaId=<uuid>` no form de novo lançamento filtra/pré-seleciona o caixa.
- Implementação: `lancamentos.novo.tsx` loader lê `caixaId` e seta `defaultCaixaId` no payload.

---

## 6. Validações e regras

### 6.1 Schema Zod (helper do loader)

Não há validação de input (página é read-only). Mas o `user` precisa passar por:

```ts
// Em app/lib/rbac.server.ts
export function assertCanSeeFinancials(user: SessionUser): void {
  const allowed: Cargo[] = ["ADMIN", "PASTOR", "FINANCEIRO", "SECRETARIO"];
  if (!user.cargo || !allowed.includes(user.cargo)) {
    throw new Response("Você não tem permissão para acessar o módulo financeiro.", { status: 403 });
  }
}
```

### 6.2 Regras de negócio (loader)

- **RN-FIN-01 (Caixas apartados):** loader lista apenas caixas com `ativo = true` (proposta aprovada `decision-caixa-soft-delete`). Toggle "Mostrar arquivados" é opt-in (padrão: false).
- **RN-MEM-03 (privacidade de dízimos):** loader filtra a lista "Últimas movimentações" para SECRETARIO:
  - Mostra: CAMPANHA, DESPESA_OPERACIONAL, COMPRA_ESTOQUE, MANUTENCAO, TRANSFERENCIA, OFERTA (qualquer).
  - **Esconde:** DIZIMO (mesmo se o SECRETARIO tem acesso a `/app/financeiro` em geral, o histórico de dízimos é restrito).
  - ADMIN/PASTOR/FINANCEIRO veem **todos** os 5 últimos.
- **RN-FIN-04 (trava de saldo):** o dashboard **não muta** saldo. Apenas exibe. Trava mora no `criarLancamento` e `transferirEntreCaixas`.
- **RN-FIN-02 (transferência híbrida):** o dashboard mostra transferências com `categoria = TRANSFERENCIA` (saída ou entrada), formatadas como `Caixa X → R$ Y → Caixa Z`.

### 6.3 Edge cases

- **Sistema novo (após `pnpm db:reset`):** 1 caixa (Caixa Geral, `saldoCentavos = 0`), 0 lançamentos. Renderizar com saldo 0 e empty state para "Últimas movimentações".
- **Muitos caixas (>5):** scroll horizontal no carrossel de cards (YAGNI: criar paginação agora? Não — 1 igreja raramente tem >10 caixas).
- **Valor monetário `Int` em trânsito:** loader retorna `saldoCentavos: number`; UI usa `formatBRLFromCents(saldoCentavos)` para exibir. **Nunca** `Float` em payload de API/loader.
- **Timezone:** `dataCompetencia` é UTC no DB; UI exibe via `formatDate` (helper existente) em `America/Sao_Paulo`.

### 6.4 Integrações externas

Nenhuma no dashboard. Integrações (ViaCEP para endereço de membro) não se aplicam aqui.

---

## 7. RBAC (defesa em 3 camadas)

| Camada | Onde | O que verifica | Falha → |
|---|---|---|---|
| **1 — UI** | `<Can allow={["ADMIN","PASTOR","FINANCEIRO","SECRETARIO"]}>` envolvendo cards de caixa e atalhos | Render condicional por `user.cargo` | Esconde controles (UX, não segurança) |
| **2 — Loader** | `assertCanSeeFinancials(user)` no início do `loader` antes de qualquer I/O | Lança `Response(403)` | Página renderiza ErrorBoundary 403 |
| **3 — Service** | `assertCanSeeFinancials` em `getDashboardFinanceiro(user)` (Camada 3 redundante) | Mesmo helper, dupla checagem | Lança `Response(403)` (defesa em profundidade) |

**Matriz:**
- **ADMIN, PASTOR, FINANCEIRO:** dashboard completo. Vê dízimos. Vê todos os caixas. Vê todos os lançamentos.
- **SECRETARIO:** dashboard **filtrado** (sem dízimos na lista "Últimas movimentações"). Vê todos os caixas. Vê saldos.
- **DISCIPULADOR, LIDER_MINISTERIO:** **403** em todas as 3 camadas.

**Botão "+ Nova Caixa"** (só para ADMIN, PASTOR, FINANCEIRO): `<Can allow={["ADMIN","PASTOR","FINANCEIRO"]}>`. SECRETARIO vê dashboard mas **não** vê esse botão (não pode criar caixas — RN-FIN-01 + matriz §4.8).

**Botão "+ Novo Lançamento" e "+ Nova Transferência":** visíveis para os 4 perfis com `canSeeFinancials` (SECRETARIO pode lançar despesa, RN-FIN-01).

---

## 8. Dados (loader + service)

### 8.1 Loader

```ts
// app/routes/app/financeiro._index.tsx
export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  // Camada 2 RBAC
  assertCanSeeFinancials(user);

  // Camada 3 (service) — busca dados
  const data = await getDashboardFinanceiro(user);
  return data;
}
```

### 8.2 Service contract (helper novo em `app/lib/finance.server.ts`)

```ts
/**
 * @description Busca dados consolidados para o dashboard financeiro:
 * lista de caixas ativos com saldo + últimos 5 lançamentos (filtrados por RBAC).
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<DashboardFinanceiroData>} { caixas: CaixaResumo[], ultimosLancamentos: LancamentoResumo[], saldoAgregadoCentavos: number, totalCaixasAtivos: number }
 * @throws {Response} 403 se user sem perfil financeiro (Camada 3).
 */
export async function getDashboardFinanceiro(user: SessionUser): Promise<DashboardFinanceiroData>;
```

**Tipos de retorno:**

```ts
type CaixaResumo = {
  id: string;
  nome: string;
  saldoCentavos: number;
  lancamentosMes: number; // COUNT WHERE dataCompetencia >= firstDayOfMonth
};

type LancamentoResumo = {
  id: string;
  dataCompetencia: Date;
  tipo: "ENTRADA" | "SAIDA";
  categoria: CategoriaLancamento;
  valorCentavos: number;
  descricao: string;
  caixa: { id: string; nome: string };
  // Para DIZIMO: incluir `membro: { id, nome }` (somente se perfil pode ver — ADMIN/PASTOR/FINANCEIRO)
  membro?: { id: string; nome: string };
};

type DashboardFinanceiroData = {
  caixas: CaixaResumo[];
  ultimosLancamentos: LancamentoResumo[];
  saldoAgregadoCentavos: number;
  totalCaixasAtivos: number;
};
```

**Filtros no service:**
- `caixas`: `where: { ativo: true }`, `orderBy: { nome: "asc" }`.
- `ultimosLancamentos`: `take: 5`, `orderBy: { dataCompetencia: "desc" }`.
  - Se `user.cargo === "SECRETARIO"`: `where: { categoria: { not: "DIZIMO" } }`.
  - Outros perfis: sem filtro de categoria.
- `saldoAgregadoCentavos`: `SUM(saldoCentavos WHERE ativo = true)`.

### 8.3 Edge cases do service

- **0 caixas ativos:** `saldoAgregadoCentavos = 0`, `caixas = []`. UI renderiza empty state.
- **0 lançamentos:** `ultimosLancamentos = []`. UI renderiza "Nenhuma movimentação ainda."
- **Membro deletado (dízimo órfão):** `Lancamento.membro = null` (SetNull no schema, RN-FIN-05). UI exibe "Membro removido" em vez do nome.

---

## 9. Testes sugeridos (TDD)

### 9.1 Unit (sem DB)

- `assertCanSeeFinancials(secretarioUser)` → **não lança** (SECRETARIO pode ver dashboard).
- `assertCanSeeFinancials(discipuladorUser)` → lança `Response(403)`.
- `assertCanSeeFinancials(adminUser)` → **não lança**.

### 9.2 Integração (com DB, `setupTestDb`)

- `getDashboardFinanceiro(adminUser)` retorna:
  - 3 caixas (seed cria 1; teste cria 2).
  - 5 últimos lançamentos em ordem decrescente.
  - `saldoAgregadoCentavos` = soma dos saldos.
- `getDashboardFinanceiro(secretarioUser)`:
  - `ultimosLancamentos` **não inclui** DIZIMO.
  - Inclui CAMPANHA, DESPESA, OFERTA anônima, TRANSFERENCIA.
- `getDashboardFinanceiro(discipuladorUser)` → lança `Response(403)`.
- 0 caixas ativos: retorna `caixas: []`, `saldoAgregadoCentavos: 0`.

### 9.3 E2E (Playwright)

- `e2e/financeiro-dashboard.spec.ts`:
  - Login `financeiro@igreja.local` → `/app/financeiro` → vê 3 caixas (seed + 2 criados no beforeAll).
  - Verifica saldo BRL formatado (R$ 1.234,56 — aceita variações de format).
  - Verifica "Últimas movimentações" lista 5 itens.
  - Click em "Ver extrato" do Caixa Geral → 302 → `/app/financeiro/caixas/<id>`.
  - **Bypass test:** login `discipulador@igreja.local` → `/app/financeiro` direto na URL → 403. **Camada 2 (loader) barra. Camada 3 (service) é redundante.**

---

## 10. Critérios de aceite (gate Phase 5)

- [ ] Loader chama `assertCanSeeFinancials` **antes** de qualquer I/O.
- [ ] `getDashboardFinanceiro(user)` chamado em `app/lib/finance.server.ts` com JSDoc completo.
- [ ] SECRETARIO **não vê** DIZIMO em "Últimas movimentações" (filtro de service).
- [ ] DISCIPULADOR e LIDER_MINISTERIO recebem 403 ao acessar `/app/financeiro`.
- [ ] Caixas arquivados (`ativo = false`) **não aparecem** nos cards (filtro de service).
- [ ] Saldos exibidos em BRL via `formatBRLFromCents` (nunca `*Centavos` cru na UI).
- [ ] KPI "Saldo total" = soma de `saldoCentavos` de caixas ativos.
- [ ] 5 últimos lançamentos ordenados por `dataCompetencia DESC`.
- [ ] Atalho "+ Nova Caixa" **escondido** para SECRETARIO (Camada 1 UI) **e** loader 403 ao tentar bypass (Camada 2).
- [ ] Empty state amigável quando 0 caixas ativos.
- [ ] Cobertura do service ≥ 100% (gate RN-FIN-01).
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] `pnpm typecheck` passa.
- [ ] Sem dado sensível em log (`safeLog`, sem `valorCentavos`).

---

## 11. Acessibilidade

- **`<h1>`** = "Financeiro".
- **`<h2>`** para "Saldo total", "Caixas ativos", "Atalhos rápidos", "Últimas movimentações".
- **Cards de caixa** com `aria-label` descritivo (ex: `aria-label="Caixa Geral, saldo R$ 1.000,00, 5 lançamentos este mês"`).
- **Empty state** com `role="status"` (informativo, não urgente).
- **Indicador de saldo baixo** com `aria-label="Saldo baixo"` + texto visível (não só cor).
- **Lista de movimentações** é `<ul>` com `<li>` (poucos itens, não `<table>`).
- **Foco visível** em todos os elementos clicáveis.
- **Tab order** segue ordem visual (KPI → cards → atalhos → lista).

---

## 12. Mobile

- **KPI agregado** full-width no topo.
- **Cards de caixa** em coluna (1 caixa por linha).
- **Atalhos** em coluna, full-width.
- **Lista de últimos lançamentos** sem hover (touch only).
- **Sidebar vira drawer** com hamburger na topbar (já implementado no ciclo 1).
- **Targets de toque** ≥ 44×44px em todos os botões.

---

## 13. Cross-references

- **PRD:** [Apêndice D §D.3 F7 (Dashboard de saldos)](./PRD.html#c2-features), §D.4 (critérios de aceitação).
- **SPEC:** [Apêndice D §D.4 (Endpoints)](./SPEC.html#c2-endpoints), §D.3 (Camadas).
- **AGENTS:** [§"Módulo Financeiro (ciclo 2)" §"Onde mora cada trava"](./agents/AGENTS.md).
- **ARCH:** [§8.1 (Camadas do módulo), §8.2 (Fluxo crítico 1: Criar Dízimo)](./docs/architecture/ARCH.md).
- **RAGs:**
  - [`.harness/RAG/architecture-financeiro.md`](./.harness/RAG/architecture-financeiro.md) §3.4 (fluxo Fidelidade, transversal).
  - [`.harness/RAG/security-rbac-matrix.md`](./.harness/RAG/security-rbac-matrix.md) — matriz 6 perfis × domínios.
  - [`.harness/RAG/pattern-3-layer-rbac.md`](./.harness/RAG/pattern-3-layer-rbac.md) — defesa em 3 camadas.
  - [`.harness/RAG/convention-monetary-values.md`](./.harness/RAG/convention-monetary-values.md) — `formatBRLFromCents`, `assertNonNegative`.
  - [`.harness/RAG/decision-caixa-soft-delete.md`](./.harness/RAG/decision-caixa-soft-delete.md) — `ativo: Boolean @default(true)`.
  - [`.harness/RAG/lgpd-igreja-conect.md`](./.harness/RAG/lgpd-igreja-conect.md) — sem PII em log, sem `valorCentavos` em log.
