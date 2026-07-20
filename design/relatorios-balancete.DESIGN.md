# Design — Balancete Mensal (ciclo 4)

> **Rota:** `/app/financeiro/relatorios/balancete`
> **RBAC:** ADMIN, PASTOR, FINANCEIRO (SECRETARIO BLOQUEADO)
> **Stitch base:** `~/Downloads/stitch_igrejaconnect/balancete_mensal_igrejaconnect/code.html`
> **Cross-refs:** PRD §3.3 (US-REL-009 a 012), SPEC §5.3 EP-002, brief §4.1.2 + §4.2.3

---

## 1. Contexto

Balancete mensal — relatório que mostra o **saldo anterior, entradas, saídas e saldo atual** de um mês específico, mais uma tabela "Resumo por Categoria" detalhada. É o relatório usado para o **conselho administrativo** mensal.

**Persona-alvo:** Tesoureiro (FINANCEIRO) — fechamento mensal. Pastor (PASTOR) — conselho pastoral.

**Caso de uso primário:** FINANCEIRO seleciona o mês no `<input type="month">`, vê 4 KPIs (Saldo Anterior, Entradas, Saídas, Saldo Atual) e a tabela "Resumo por Categoria". Clica em "Imprimir Balancete" para gerar versão física via `window.print()`.

**Quem NÃO acessa:** SECRETARIO, DISCIPULADOR, LIDER_MINISTERIO (RN-REL-01, 3 camadas).

---

## 2. Layout (estrutura visual)

### 2.1 Desktop (≥ 1024px)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Topbar + Sidebar ("Relatórios" ativo)                               │
├────────────┬─────────────────────────────────────────────────────────┤
│ Sidebar    │ ← Voltar    Balancete Mensal                            │ ← h1
│            │                                                            │
│            │ ┌────────────────┬─────────────────┬────────────────────┐│
│            │ │ Mês de Referência         [Imprimir Balancete 🖨]    ││ ← header
│            │ │ [input type=month: 2026-06]                            ││
│            │ └─────────────────────────────────────────────────────┘  │
│            │                                                            │
│            │ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────┐
│            │ │ Saldo Anterior   │ │ Entradas  🟢     │ │ Saídas  🔴   │ ← 3 KPIs
│            │ │ ⚪ R$ 5.000,00   │ │ R$ 12.500,00     │ │ R$ 8.754,00  │
│            │ │                  │ │ [+12.5% 📈]      │ │ [-4.2% 📉]   │
│            │ └──────────────────┘ └──────────────────┘ └──────────────┘
│            │ ┌──────────────────────────────┐                          │
│            │ │ Saldo Atual 🔵                 │                          │ ← 4º KPI
│            │ │ R$ 8.746,00   (ring lateral)   │                          │
│            │ └──────────────────────────────┘                          │
│            │                                                            │
│            │ ┌────────────────────────────────────┐ ┌─────────────────┐│
│            │ │ Resumo por Categoria               │ │ Distribuição de ││ ← grid 8+4
│            │ │ Categoria  │ Entradas │ Saídas │Saldo│ │ Saídas (donut)  ││
│            │ │ DIZIMO     │ 8000 │ 0    │ +8000│ │ ▓▓ DESP_OP 60% ││
│            │ │ OFERTA     │ 3500 │ 0    │ +3500│ │ ▓ MANUT 20%    ││
│            │ │ CAMPANHA   │ 1000 │ 0    │ +1000│ │ ▓ COMPRA 8%    ││
│            │ │ DESP_OP    │    0 │ 6000 │ -6000│ │ ▓ TRANSF 12%   ││
│            │ │ MANUTENÇÃO │    0 │ 2004 │ -2004│ │                 ││
│            │ │ (ordenado por saldo desc)        │ │ (SVG donut inline)│
│            │ └────────────────────────────────────┘ └─────────────────┘│
│            │                                                            │
│            │ ┌──────────────────────────────────────────────────────┐  │
│            │ │ Projeção Próximo Mês 🕐 (placeholder cinza YAGNI)     │  │
│            │ │ "Disponível em ciclo futuro — depende de módulo       │  │
│            │ │  Contas a Pagar (RN-XYZ)"                             │  │
│            │ └──────────────────────────────────────────────────────┘  │
└────────────┴─────────────────────────────────────────────────────────┘
```

### 2.2 Mobile (< 768px)

```
┌──────────────────────────────┐
│ ← Voltar    Balancete        │
├──────────────────────────────┤
│ Mês: [input type=month]      │
│              [Imprimir 🖨]    │
│                              │
│ ┌──────────────────────────┐ │
│ │ Saldo Anterior           │ │
│ │ ⚪ R$ 5.000,00           │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Entradas 🟢              │ │
│ │ R$ 12.500,00             │ │
│ │ [+12.5% 📈]              │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Saídas 🔴                │ │
│ │ R$ 8.754,00              │ │
│ │ [-4.2% 📉]               │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Saldo Atual 🔵           │ │
│ │ R$ 8.746,00              │ │
│ └──────────────────────────┘ │
│                              │
│ Resumo por Categoria         │
│ DIZIMO  8000  0   +8000     │
│ OFERTA  3500  0   +3500     │
│ DESP_OP 0   6000  -6000     │
│                              │
│ Distribuição de Saídas       │
│   ▓▓▓▓ DESP_OP 60%          │
│   ▓ MANUT 20%               │
│   ▓ COMPRA 8%               │
│                              │
│ Projeção Próximo Mês 🕐      │
│ (placeholder YAGNI)          │
└──────────────────────────────┘
```

---

## 3. Componentes utilizados

| Componente | Fonte | Props | Localização |
|---|---|---|---|
| `<ShellAutenticado>` | shared | — | (já existe) |
| `<PageHeader>` | shared | `title`, `backHref`, `action?` | (já existe) |
| `<KpiCard>` | novo (ciclo 4) | `titulo`, `valor`, `cor`, `icone`, `badge?`, `trend?`, `subtitulo?` | (já existe) |
| `<ResumoPorCategoria>` | novo (ciclo 4) | `items: ResumoPorCategoria[]` | `app/components/ResumoPorCategoria.tsx` |
| `<DonutDistribuicaoSaidas>` | novo (ciclo 4) | `items: Array<{categoria, percentual, totalCentavos}>` | `app/components/DonutDistribuicaoSaidas.tsx` |
| `<ProjectionPlaceholder>` | novo (ciclo 4) | `titulo`, `mensagem` | `app/components/ProjectionPlaceholder.tsx` |
| `<IconPrint>`, `<IconEvent>`, `<IconHourglass>`, `<IconKpiWallet>`, `<IconKpiBalance>` | novo (ciclo 4) | — | `app/components/icons/FinanceIcons.tsx` |

---

## 4. Estados visuais

| Estado | Quando | Render |
|---|---|---|
| **Initial (mês com dados)** | Mês selecionado tem lançamentos | 4 KPIs + tabela "Resumo por Categoria" + donut + placeholder "Projeção". |
| **Mês sem movimentações** | `getBalanceteMensal()` retorna zeros | 4 KPIs com `R$ 0,00` + tabela com "Nenhuma movimentação neste mês" + donut vazio. |
| **Mês de criação da igreja (sem histórico)** | `saldoAnteriorCentavos === 0` (primeiro mês de operação) | KPI "Saldo Anterior" mostra `R$ 0,00` em cinza com label "Sem histórico anterior". |
| **SECRETARIO / DISCIPULADOR / LIDER** | Bypass URL | **403** — ErrorBoundary. |
| **Loading** | Loader em 1ª carga | Skeleton: 4 retângulos grandes + 1 tabela `animate-pulse` + 1 círculo (donut). |
| **Error (400 / 500)** | Mês inválido (ex: `mes=13`) ou DB falhou | Mensagem inline + KPIs zerados + botão "Recarregar". |
| **Print mode** | `window.print()` acionado | CSS print mínimo (oculta sidebar + botões, mostra apenas conteúdo). |

---

## 5. Interatividade

| Elemento | Evento | Comportamento |
|---|---|---|
| `<input type="month">` | Mudar valor | Re-submete form com `?ano=YYYY&mes=MM`. Loader re-busca `getBalanceteMensal()`. |
| Botão "Imprimir Balancete" | Click | Aciona `window.print()`. CSS print oculta sidebar/botões. Sem PDF real (decisão §5.2). |
| Linha da tabela "Resumo por Categoria" | Click | Drill-down: `<Link>` para `/app/financeiro/lancamentos?categoria=X&ano=YYYY&mes=MM` (PENDÊNCIA — ver `design/relatorios-hub.DESIGN.md` §8). |
| Botão "← Voltar" | Click | Navega para `/app/financeiro/relatorios`. |

**Navegação por teclado:**
- Tab: input month → Imprimir → 4 KPIs (info) → tabela (drill-down) → sidebar.

---

## 6. RBAC (defesa em 3 camadas)

| Camada | Onde | Verifica | Falha → |
|---|---|---|---|
| **1 — UI** | `<Can allow={["ADMIN","PASTOR","FINANCEIRO"]}>` envolvendo grid | Render condicional | SECRETARIO vê 403. |
| **2 — Loader** | `assertCanSeeRelatorios(user)` + Zod `BalanceteMesSchema` (`ano`, `mes` ambos `z.coerce.number().int().min/max`) | Lança `Response(403)` ou `Response(400)` | ErrorBoundary |
| **3 — Service** | `getBalanceteMensal()` chama `assertCanSeeRelatorios` como 1ª linha | Mesmo helper | Lança `Response(403)` (defesa em profundidade) |

---

## 7. Placeholder Projeção (RN-YAGNI-01, brief §5.6)

O card "Projeção Próximo Mês" renderiza **placeholder cinza** com texto "Disponível em ciclo futuro — depende de módulo Contas a Pagar (RN-XYZ)". Implementação: `<ProjectionPlaceholder titulo="Projeção Próximo Mês" mensagem="Disponível em ciclo futuro — depende de módulo Contas a Pagar (RN-XYZ)" />` com fundo `bg-slate-100`, ícone `<IconHourglass>` e texto explicativo.

**Quando evoluir:** ciclo que entregar `ContaPagar` (estimativa: ciclo 6+).

---

## 8. Dados (loader + service)

### 8.1 Loader

```ts
export async function loader({ context, request }: Route.LoaderArgs) {
  const user = context.get(userContext);
  assertCanSeeRelatorios(user);

  const url = new URL(request.url);
  const { ano, mes } = parseBalanceteFromUrl(url); // Zod BalanceteMesSchema
  // ano: z.coerce.number().int().min(2000).max(2100)
  // mes: z.coerce.number().int().min(1).max(12)

  const balancete = await getBalanceteMensal({ ano, mes }, user);
  return { user, balancete };
}
```

### 8.2 Service contract (`getBalanceteMensal` em `app/lib/relatorios.server.ts`)

```ts
export async function getBalanceteMensal(
  mesReferencia: { ano: number; mes: number },
  user: SessionUser
): Promise<BalanceteData>;
```

**Tipo de retorno:**

```ts
type BalanceteData = {
  periodo: { ano: number; mes: number; inicio: Date; fim: Date };
  kpis: {
    saldoAnteriorCentavos: number;
    totalEntradasCentavos: number;
    totalSaidasCentavos: number;
    saldoAtualCentavos: number;
  };
  resumoPorCategoria: Array<{
    categoria: CategoriaLancamento;
    entradasCentavos: number;
    saidasCentavos: number;
    saldoCentavos: number;
  }>;
};
```

**Edge cases:**
- Mês de criação da igreja: `saldoAnteriorCentavos = 0`.
- Categoria sem movimento no mês: omitida da tabela.
- Caixa arquivado: lançamentos continuam (RN-REL-05).

---

## 9. Cross-references

- **Brief:** `brief-relatorios.md` §4.1.2, §4.2.3, §5.6 (projeção placeholder).
- **PRD:** `PRD.html` §3.3 (US-REL-009 a 012).
- **SPEC:** `SPEC.html` §5.3 EP-002, §7.1.2, RN-REL-01 a 04.
- **RAGs:** `pattern-relatorios-aggregations.md`, `convention-monetary-values.md`, `pattern-3-layer-rbac.md`.

---

## 10. Critérios de aceite (gate Phase 5)

- [ ] Loader chama `assertCanSeeRelatorios` antes de qualquer I/O.
- [ ] Zod valida `ano` (2000-2100) e `mes` (1-12) → 400 se inválido.
- [ ] Default é mês corrente quando sem search params.
- [ ] 4 KPIs renderizam com `formatBRLFromCents`.
- [ ] Tabela "Resumo por Categoria" ordenada por `saldoCentavos` decrescente.
- [ ] Donut SVG inline renderiza 3-5 fatias com cores distintas.
- [ ] Placeholder "Projeção" renderiza cinza com texto explicativo (sem lógica).
- [ ] Botão "Imprimir" aciona `window.print()` (sem PDF real).
- [ ] CSS print mínimo oculta sidebar e botões.
- [ ] Drill-down em categoria navega para `/app/financeiro/lancamentos?categoria=X&ano=YYYY&mes=MM`.
- [ ] SECRETARIO recebe 403 ao acessar (Camada 2 + 3).
- [ ] Cobertura de `getBalanceteMensal()` = 100%.
- [ ] `pnpm typecheck` passa.
- [ ] Lighthouse Accessibility ≥ 95.