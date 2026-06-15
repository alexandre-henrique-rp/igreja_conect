# Detalhe do Caixa (`/app/financeiro/caixas/:id`) — Design

## 1. Contexto

Página de **detalhe de Caixa**. Acessível em `/app/financeiro/caixas/:id`. Mostra cabeçalho do caixa (nome, saldo, status), extrato de lançamentos com filtros, e ações de gerenciamento (arquivar/reabrir, novo lançamento, nova transferência).

**Persona-alvo:** perfis com `canSeeFinancials` (4 perfis — `ADMIN`, `PASTOR`, `FINANCEIRO`, `SECRETARIO`). `SECRETARIO` vê o extrato **filtrado** (sem DIZIMO — RN-MEM-03).

**Caso de uso primário (F1 + F2 + F5 — F1: gestão, F2: lançamentos, F5: trava saldo):** `FINANCEIRO` abre Caixa Geral, vê o extrato dos últimos lançamentos, identifica o último dízimo de Membro X, clica em "Arquivar" para fechar o caixa (decisão eclesiástica).

**Casos secundários:**
- Filtros por período (mês corrente, mês passado, ano corrente, custom).
- Filtro por categoria (DIZIMO, OFERTA, DESPESA_OPERACIONAL, etc.).
- Export manual (copy-paste da tabela — fora do ciclo 2, sem PDF/Excel).
- Visualizar saldo congelado de caixa arquivado (read-only).
- Reabrir caixa arquivado (RBAC: ADMIN/PASTOR/FINANCEIRO).
- Auditoria: ver `dataHora` de cada lançamento e `executadoPorId` (via include no Prisma).

**Restrições críticas:**
- **RN-FIN-01:** caixas arquivados continuam mostrando **saldo e histórico** (read-only). UI indica status "Arquivado" no header.
- **RN-MEM-03:** SECRETARIO vê extrato **sem DIZIMO**.
- **RN-FIN-04:** caixa arquivado rejeita criação de lançamento e transferência (loader desabilita botões; service barra se bypass).
- **RN-FIN-05:** dízimo órfão (membro deletado) aparece como "Dízimo — (membro removido)".

---

## 2. Wireframe

### 2.1 Desktop (≥ 1024px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Topbar + Sidebar (com "Caixas" ativo)                                   │
├────────────┬─────────────────────────────────────────────────────────────┤
│ Sidebar    │  Financeiro > Caixas > Caixa Geral       [+ Novo Lanç.]   │ ← breadcrumb + CTA
│            │                                                             │
│            │  ┌─ Cabeçalho do Caixa ──────────────────────────────────┐ │
│            │  │ Caixa Geral                       [Ativo] [⚙]         │ │ ← badge + ações
│            │  │ Saldo atual: R$ 1.000,00                             │ │
│            │  │ Criado em: 01/01/2026                                │ │
│            │  │ Total de lançamentos: 47                              │ │
│            │  └────────────────────────────────────────────────────────┘ │
│            │                                                             │
│            │  ┌─ Filtros do Extrato ──────────────────────────────────┐ │
│            │  │ [Período ▼]  [Categoria ▼]  [Limpar]                 │ │
│            │  └────────────────────────────────────────────────────────┘ │
│            │                                                             │
│            │  Extrato (47 lançamentos)                                   │
│            │  ┌──────────────────────────────────────────────────────┐  │
│            │  │ Data       │ Tipo    │ Categoria │ Valor      │ Membro│  │ ← tabela
│            │  ├──────────────────────────────────────────────────────┤  │
│            │  │ 14/06/2026 │ ENTRADA │ DIZIMO     │ +R$ 50,00  │ Maria│  │
│            │  │ 13/06/2026 │ ENTRADA │ OFERTA     │ +R$ 20,00  │ —    │  │
│            │  │ 12/06/2026 │ SAIDA   │ DESP_OP    │ -R$ 100,00 │ —    │  │
│            │  │ 10/06/2026 │ ENTRADA │ TRANSF.    │ +R$ 50,00  │ —    │  │ ← transferência recebida
│            │  │ 10/06/2026 │ SAIDA   │ TRANSF.    │ -R$ 50,00  │ —    │  │ ← (origem do mesmo par)
│            │  │ 09/06/2026 │ SAIDA   │ COMPRA_EST │ -R$ 12,00  │ —    │  │
│            │  │ ... (pagin.)                                            │  │
│            │  └──────────────────────────────────────────────────────┘  │
│            │                                                             │
│            │  ‹ 1 2 3 ... 5 ›   Por página: 25 ▼                          │ ← paginação
│            │                                                             │
│            │  ── Ações de gerenciamento (só ADMIN/PASTOR/FINANCEIRO) ── │
│            │  [📦 Arquivar caixa]  (se ativo)  [🔓 Reabrir caixa] (se arquivado) │
└────────────┴─────────────────────────────────────────────────────────────┘
```

### 2.2 Mobile (< 768px)

```
┌──────────────────────────────┐
│ [☰] Caixa Geral    [⚙]     │
├──────────────────────────────┤
│ Saldo atual: R$ 1.000,00    │
│ Status: Ativo                │
│ Criado: 01/01/2026           │
│ Lançamentos: 47              │
│                              │
│ [+ Novo Lançamento]          │
│ [+ Nova Transferência]       │
│                              │
│ Filtros                      │
│ [Período ▼] [Categoria ▼]   │
│ [Limpar]                     │
│                              │
│ Extrato (47)                 │
│ ┌──────────────────────────┐ │
│ │ 14/06                    │ │
│ │ ENTRADA • DIZIMO         │ │
│ │ +R$ 50,00                │ │
│ │ Maria da Silva           │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ 13/06                    │ │
│ │ ENTRADA • OFERTA         │ │
│ │ +R$ 20,00                │ │
│ │ (anônima)                │ │
│ └──────────────────────────┘ │
│ ...                          │
│ [Carregar mais]              │
│                              │
│ [📦 Arquivar caixa]          │
└──────────────────────────────┘
```

---

## 3. Componentes

| Componente | Fonte | Props | Localização |
|---|---|---|---|
| `<ShellAutenticado>` | shared (ciclo 1) | — | (já existe) |
| `<PageHeader>` | shared (ciclo 1) | `title`, `action?`, `breadcrumb?` | (já existe) |
| `<CaixaHeader>` | novo | `caixa: CaixaDetalhe`, `podeGerenciar: boolean` | `app/components/CaixaHeader.tsx` |
| `<ExtratoFiltros>` | novo | `defaultPeriodo?: string`, `defaultCategoria?: string` | `app/components/ExtratoFiltros.tsx` |
| `<ExtratoCaixa>` | novo | `items: LancamentoExtrato[]`, `podeVerMembro: boolean` | `app/components/ExtratoCaixa.tsx` |
| `<CardLancamento>` | novo (mobile) | `item: LancamentoExtrato`, `podeVerMembro: boolean` | `app/components/CardLancamento.tsx` |
| `<Pagination>` | shared (ciclo 1) | `current`, `total`, `basePath` | (já existe) |
| `<ModalConfirmar>` | (criado no T8 do `private-financeiro-caixas.PROMPT.md`) | (já existe) | `app/components/ModalConfirmar.tsx` |
| `<EmptyState>` | shared (ciclo 1) | (já existe) | (já existe) |
| `<Can>` | shared (ciclo 1) | (já existe) | (já existe) |

**Hierarquia:**
- `app/routes/app/financeiro.caixas.$id.tsx` (rota `/app/financeiro/caixas/:id`).
- Service `lancamentos.server.ts` (NOVO) com `listarPorCaixa(caixaId, filtros, user)`.

---

## 4. Estados

| Estado | Quando | Render |
|---|---|---|
| **Initial (caixa ativo, com lançamentos)** | Caixa ativo, ≥ 1 lançamento | Header + filtros + tabela extrato. |
| **Initial (caixa ativo, vazio)** | Caixa ativo, 0 lançamentos | Header + empty state "Nenhuma movimentação neste caixa ainda." + CTA "+ Novo Lançamento". |
| **Caixa arquivado** | `caixa.ativo = false` | Header mostra badge "Arquivado" + aviso "Caixa arquivado — movimentações bloqueadas. Saldo e histórico preservados." Botões "📦 Arquivar" **ocultos**, "🔓 Reabrir" **visível** (se `podeGerenciar`). Botões "+ Novo Lançamento" e "+ Nova Transferência" **ocultos** (desabilitados). |
| **SECRETARIO** | RN-MEM-03 | Tabela extrato **filtra** DIZIMO. Coluna "Membro" some ou fica vazia. |
| **DISCIPULADOR/LIDER_MINISTERIO** | Tentativa de acesso | **403** do loader. |
| **Loading** | Loader em andamento | Skeleton: header + 5 linhas com `animate-pulse`. |
| **Filtro vazio** | `?periodo=2025-01` retorna 0 | EmptyState: "Nenhuma movimentação neste período." + botão "Limpar filtros". |
| **Caixa não encontrado** | ID inválido | 404 com ErrorBoundary. |
| **Modal arquivar** | Click em "📦 Arquivar" | Modal: "Arquivar caixa \"X\"? Movimentações serão bloqueadas; histórico preservado. Esta ação é reversível (Reabrir)." |
| **Modal reabrir** | Click em "🔓 Reabrir" | Modal: "Reabrir caixa \"X\"? Movimentações serão liberadas. Saldo histórico preservado." |
| **Toast sucesso (arquivar)** | Após PATCH OK | Toast: "Caixa \"X\" arquivado." + redirect para `/app/financeiro/caixas` (lista). |
| **Toast sucesso (reabrir)** | Após PATCH OK | Toast: "Caixa \"X\" reaberto." |
| **Toast sucesso (novo lançamento)** | Após POST OK | Toast: "Lançamento registrado." + permanece na página (toast no topo). |

---

## 5. Fluxos de interação

| Elemento | Evento | Comportamento |
|---|---|---|
| Filtro "Período" | Change + submit | Atualiza URL `?periodo=2026-06` (ou `custom&de=...&ate=...`). |
| Filtro "Categoria" | Change + submit | Atualiza URL `?categoria=DIZIMO`. |
| Botão "Limpar" | Click | Limpa todos os filtros. |
| Link "Lançar" (header) | Click | Navega para `/app/financeiro/lancamentos/novo?caixaId=<id>`. |
| Link "Transferir" (header) | Click | Navega para `/app/financeiro/transferencias/nova?caixaOrigemId=<id>`. |
| Botão "📦 Arquivar" | Click | Abre modal. Confirmar → PATCH `/app/financeiro/caixas/<id>/arquivar`. |
| Botão "🔓 Reabrir" | Click | Abre modal. Confirmar → PATCH `/app/financeiro/caixas/<id>/reabrir`. |
| Item do extrato (row) | Click | (futuro: detalhe do lançamento — fora do ciclo 2). Por ora, sem ação. |
| Paginação | Click | Navega para `?page=2`. |

**Navegação por teclado:**
- Tab: breadcrumb > filtros > tabela (1 linha por vez) > ações.
- Foco visível em todos os botões.

**Modal:** `Esc` fecha. Click fora fecha. Foco no botão "Confirmar".

---

## 6. Validações e regras

### 6.1 Schema Zod (filtros do extrato)

```ts
// app/lib/schemas/lancamentos.ts (parcial — filtros)
export const ExtratoFiltrosSchema = z.object({
  periodo: z.enum([
    "mes_atual", "mes_passado", "ano_atual", "todos", "custom"
  ]).optional(),
  categoria: z.enum([
    "DIZIMO", "OFERTA", "CAMPANHA", "DESPESA_OPERACIONAL",
    "COMPRA_ESTOQUE", "MANUTENCAO", "TRANSFERENCIA"
  ]).optional(),
  de: z.coerce.date().optional(),  // para periodo=custom
  ate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().optional().default(25),
}).strict();
```

### 6.2 Regras de negócio

- **RN-FIN-01 (caixa apartados):** loader busca por `caixaId` exato. Caixas são identificados por `id` (UUID).
- **RN-FIN-04 (trava saldo):** caixa arquivado rejeita `criarLancamento` (Camada 3 service). Loader **desabilita** botões "Lançar" e "Transferir" (Camada 1 UI) **e** verifica `caixa.ativo === false` antes de renderizar (Camada 2).
- **RN-FIN-05 (dízimo órfão):** `Lancamento.membro = null` é exibido como "(membro removido)" ou "Dízimo — (membro removido)".
- **RN-MEM-03 (privacidade dízimos):** SECRETARIO vê o extrato **sem DIZIMO**. Service filtra `where: { categoria: { not: "DIZIMO" } }` para SECRETARIO.
- **Edição de lançamento:** **NÃO** permitida nesta página (apenas criar + listar). Edição é em rota dedicada (backlog ciclo 3+).

### 6.3 Edge cases

- **Caixa arquivado + saldo ≠ 0:** saldo congelado, exibido em BRL com label "Saldo congelado". Sem ação de ajustar.
- **Transferência com `categoria = TRANSFERENCIA`:** exibida como 2 linhas (SAIDA origem + ENTRADA destino). Mesmo valor. **Decisão:** ordenar por `dataCompetencia DESC` + `id ASC` para garantir ordem determinística (origem antes de destino, ou ambos próximos).
- **Dízimo órfão (membro deletado):** `membroId` virou `null` (SetNull). UI exibe "Dízimo — (membro removido)".
- **Lançamento com `descricao` muito longa:** truncar com `text-ellipsis` no `td` (max-w-xs + truncate).

### 6.4 Integrações externas

Nenhuma. Filtros são todos locais.

---

## 7. RBAC (defesa em 3 camadas)

| Operação | ADMIN | PASTOR | FINANCEIRO | SECRETARIO | DISCIPULADOR | LIDER_MIN. |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Ver detalhe do caixa | ✅ | ✅ | ✅ | ✅ | 🚫 | 🚫 |
| Ver extrato (com filtros) | ✅ | ✅ | ✅ | ✅ (sem DIZIMO) | 🚫 | 🚫 |
| Botão "+ Novo Lançamento" (se caixa ativo) | ✅ | ✅ | ✅ | ✅ | 🚫 | 🚫 |
| Botão "+ Nova Transferência" (se caixa ativo) | ✅ | ✅ | ✅ | ✅ | 🚫 | 🚫 |
| Botão "📦 Arquivar" | ✅ | ✅ | ✅ | 🚫 (403) | 🚫 (403) | 🚫 (403) |
| Botão "🔓 Reabrir" (se arquivado) | ✅ | ✅ | ✅ | 🚫 (403) | 🚫 (403) | 🚫 (403) |

**Defense em 3 camadas:**
- **UI (Camada 1):** `<Can allow={[...]}>`. SECRETARIO **não** vê botões "Arquivar"/"Reabrir" (escondidos). Caixas arquivados **não** mostram botões "Lançar"/"Transferir" (desabilitados).
- **Loader/Action (Camada 2):** `assertCanSeeFinancials(user)` (sempre); `assertCanManageCaixa(user)` para arquivar/reabrir. Service barra se bypass.
- **Service (Camada 3):** `listarPorCaixa(caixaId, filtros, user)` chama `assertCanSeeFinancials` + filtra DIZIMO para SECRETARIO. `arquivarCaixa`/`reabrirCaixa` chamam `assertCanManageCaixa`.

---

## 8. Dados (loader + service)

### 8.1 Loader

```ts
// app/routes/app/financeiro.caixas.$id.tsx
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  assertCanSeeFinancials(user); // Camada 2

  // Parse query string
  const url = new URL(request.url);
  const filtros = ExtratoFiltrosSchema.parse(Object.fromEntries(url.searchParams));

  // Buscar caixa + extrato
  const data = await getCaixaDetalhe(params.id, filtros, user); // Camada 3
  if (!data) throw new Response("Caixa não encontrado.", { status: 404 });
  return { ...data, user, filtros };
}
```

### 8.2 Service contract

**`getCaixaDetalhe` (helper novo em `app/lib/caixas.server.ts` ou `app/lib/finance.server.ts`):**

```ts
/**
 * @description Busca detalhe do caixa + extrato paginado.
 * Filtra DIZIMO se user é SECRETARIO (RN-MEM-03).
 * @param {string} caixaId - UUID do caixa.
 * @param {ExtratoFiltros} filtros - Período, categoria, paginação.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<{ caixa: CaixaDetalhe, lancamentos: LancamentoExtrato[], total: number, page: number, pageSize: number } | null>} null se caixa não existe.
 * @throws {Response} 403 se user sem perfil financeiro.
 */
export async function getCaixaDetalhe(
  caixaId: string,
  filtros: ExtratoFiltros,
  user: SessionUser
): Promise<CaixaDetalheData | null>;
```

**`CaixaDetalhe` type:**

```ts
type CaixaDetalhe = {
  id: string;
  nome: string;
  saldoCentavos: number;
  ativo: boolean;
  createdAt: Date;
  totalLancamentos: number;
};
```

**`LancamentoExtrato` type:**

```ts
type LancamentoExtrato = {
  id: string;
  dataCompetencia: Date;
  tipo: "ENTRADA" | "SAIDA";
  categoria: CategoriaLancamento;
  valorCentavos: number;
  descricao: string;
  membro: { id: string; nome: string } | null; // null para anônimo/órfão
  transferencia: { id: string; caixaContraparte: { id: string; nome: string } } | null; // para TRANSFERENCIA
};
```

### 8.3 Edge cases do service

- **Caixa arquivado:** retorna `caixa.ativo = false`. UI renderiza badge + aviso.
- **Filtro `periodo=mes_atual`:** `dataCompetencia: { gte: firstDayOfCurrentMonth, lt: firstDayOfNextMonth }`.
- **Filtro `periodo=custom`:** `dataCompetencia: { gte: filtros.de, lte: filtros.ate }`.
- **SECRETARIO:** adiciona `categoria: { not: "DIZIMO" }` ao `where`.
- **Transferência:** include `transferenciaRelacionada` via `descricao` matching (heurística simples — futuro: refatorar schema para ter FK explícita). **Decisão YAGNI:** exibir `categoria: TRANSFERENCIA` + `descricao` com texto-padrão "Transferência #abc123 → caixa destino" (já implementado em `transferencias.server.ts`).

---

## 9. Testes sugeridos (TDD)

### 9.1 Unit (sem DB)

- `ExtratoFiltrosSchema`:
  - Aceita `{}`, `{ periodo: "mes_atual" }`, `{ categoria: "DIZIMO" }`, `{ page: 2, pageSize: 50 }`.
  - Rejeita `periodo: "invalido"`, `categoria: "INVALIDA"`, `page: 0`, `pageSize: 0`.

### 9.2 Integração (com DB, `setupTestDb`)

- `getCaixaDetalhe(caixaGeralId, {}, adminUser)`:
  - Retorna caixa + lista de lançamentos (paginado, ordem decrescente).
- `getCaixaDetalhe(caixaGeralId, {}, secretarioUser)`:
  - Lista de lançamentos **não inclui DIZIMO**.
- `getCaixaDetalhe(caixaInvalida, {}, adminUser)` → retorna `null` (loader converte para 404).
- `getCaixaDetalhe(caixaGeralId, { periodo: "mes_atual" }, adminUser)`:
  - Apenas lançamentos do mês corrente.
- `getCaixaDetalhe(caixaGeralId, { categoria: "DESPESA_OPERACIONAL" }, adminUser)`:
  - Apenas despesas operacionais.
- `getCaixaDetalhe(caixaGeralId, {}, discipuladorUser)` → lança `Response(403)`.

### 9.3 E2E (Playwright) — `e2e/financeiro-caixa-detalhe.spec.ts`

- Login `financeiro@igreja.local` → `/app/financeiro` → click "Ver extrato" do Caixa Geral → 302 → `/app/financeiro/caixas/<id>`.
- Vê saldo R$ 0,00, badge "Ativo", header com data de criação.
- Vê filtros vazios + tabela com 0 linhas.
- Click "+ Novo Lançamento" → `/app/financeiro/lancamentos/novo?caixaId=<id>` (pré-preenchido).
- Volta → cria um dízimo → toast + volta para extrato com 1 linha.
- **SECRETARIO:** login `secretario@igreja.local` → `/app/financeiro/caixas/<id>` → vê extrato **sem DIZIMO**.
- **Caixa arquivado:** arquiva caixa via lista → volta para lista → click no caixa arquivado → vê badge "Arquivado" + aviso + **botões "Lançar"/"Transferir" ocultos** + botão "🔓 Reabrir" visível.

---

## 10. Critérios de aceite (gate Phase 5)

- [ ] Loader chama `assertCanSeeFinancials` **antes** de I/O.
- [ ] Service `getCaixaDetalhe` com JSDoc completo, filtra DIZIMO para SECRETARIO.
- [ ] Caixas arquivados mostram badge + saldo congelado (read-only).
- [ ] Botões "Lançar" e "Transferir" **ocultos** para caixa arquivado.
- [ ] Botões "Arquivar"/"Reabrir" **ocultos** para SECRETARIO/DISCIPULADOR/LIDER_MINISTERIO (Camada 1).
- [ ] Modal de confirmação antes de arquivar/reabrir.
- [ ] Filtros (período, categoria) funcionam via URL state.
- [ ] Paginação 25/página.
- [ ] Dízimo órfão (membro deletado) exibe "(membro removido)".
- [ ] Transferência com `categoria = TRANSFERENCIA` mostra 2 linhas (SAIDA + ENTRADA).
- [ ] Cobertura do service ≥ 100%.
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] `pnpm typecheck` passa.

---

## 11. Acessibilidade

- **`<h1>`** = nome do caixa (subordinado ao h1 "Caixas" da lista, mas aqui é página de detalhe).
- **`<h2>`** para "Cabeçalho do Caixa", "Filtros do Extrato", "Extrato", "Ações de gerenciamento".
- **`<table>`** com `<caption className="sr-only">`, `<th scope="col">`.
- **Filtros** com `<label htmlFor>`.
- **Coluna "Membro"** escondida se SECRETARIO (`<th>` + `<td>` condicionais).
- **Badge "Arquivado"** com `aria-label="Caixa arquivado, saldo congelado"`.
- **Botões "📦 Arquivar" / "🔓 Reabrir"** com `aria-label` descritivo.
- **Modal** com `role="dialog"`, `aria-modal="true"`, `aria-labelledby`.
- **Toast** com `role="status"`, `aria-live="polite"`.

---

## 12. Mobile

- **Header do caixa** em cards empilhados (nome, saldo, status, criado, total).
- **Filtros** em coluna, full-width.
- **Tabela** vira `<CardLancamento>` (1 lançamento por card, com data, tipo, categoria, valor, membro).
- **Botões de ação** full-width, empilhados.
- **Paginação** "Carregar mais" em vez de números.
- **Targets de toque** ≥ 44×44px.

---

## 13. Cross-references

- **PRD:** [Apêndice D §D.3 F1, F2, F5 (CRUD Caixas + Lançamentos + Trava saldo)](./PRD.html#c2-features), §D.4 (aceitação).
- **SPEC:** [Apêndice D §D.4 (`GET /app/financeiro/caixas/:id`)](./SPEC.html#c2-endpoints), §D.3 (services).
- **AGENTS:** [§"Módulo Financeiro (ciclo 2)" §"Comandos de verificação específicos"](./agents/AGENTS.md).
- **ARCH:** [§8.1, §8.2, §8.3 (fluxos)](./docs/architecture/ARCH.md).
- **RAGs:**
  - [`.harness/RAG/architecture-financeiro.md`](./.harness/RAG/architecture-financeiro.md) §4.1, §4.2 (lifecycle).
  - [`.harness/RAG/pattern-trava-saldo-service.md`](./.harness/RAG/pattern-trava-saldo-service.md) — `assertSaldoSuficiente` (não muta saldo).
  - [`.harness/RAG/decision-caixa-soft-delete.md`](./.harness/RAG/decision-caixa-soft-delete.md) — soft-delete preserva histórico.
  - [`.harness/RAG/security-rbac-matrix.md`](./.harness/RAG/security-rbac-matrix.md) — matriz.
  - [`.harness/RAG/convention-monetary-values.md`](./.harness/RAG/convention-monetary-values.md) — `formatBRLFromCents`.
  - [`.harness/RAG/lgpd-igreja-conect.md`](./.harness/RAG/lgpd-igreja-conect.md) — sem PII em log.
