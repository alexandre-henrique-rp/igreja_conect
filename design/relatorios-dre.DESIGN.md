# Design — DRE (Demonstração do Resultado do Exercício) (ciclo 4)

> **Rota:** `/app/financeiro/relatorios/dre`
> **RBAC:** ADMIN, PASTOR, FINANCEIRO (SECRETARIO BLOQUEADO)
> **Stitch base:** `~/Downloads/stitch_igrejaconnect/dre_igrejaconnect/code.html`
> **Cross-refs:** PRD §3.2 (US-REL-005 a 008), SPEC §5.2 EP-001, brief §4.1.1 + §4.2.2

---

## 1. Contexto

Demonstração do Resultado do Exercício — relatório que consolida **entradas vs. saídas** em um período, agrupadas por categoria. É o relatório mais usado no fechamento mensal.

**Persona-alvo:** Tesoureiro (FINANCEIRO) — fechamento mensal. Pastor (PASTOR) — visão pastoral estratégica.

**Caso de uso primário:** FINANCEIRO entra, vê DRE do mês corrente (default), identifica qual categoria pesa mais nas saídas, clica em uma categoria para drill-down (ver `design/relatorios-hub.DESIGN.md` §8 sobre pendência da rota).

**Quem NÃO acessa:** SECRETARIO, DISCIPULADOR, LIDER_MINISTERIO (RN-REL-01, 3 camadas).

---

## 2. Layout (estrutura visual)

### 2.1 Desktop (≥ 1024px)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Topbar + Sidebar ("Relatórios" ativo)                               │
├────────────┬─────────────────────────────────────────────────────────┤
│ Sidebar    │ ← Voltar    DRE — Demonstração do Resultado do Exercício│ ← h1
│            │                                                            │
│            │ ┌────────────────┬────────────────────────────────────────┐│
│            │ │ Período        │ [7d][30d][Mês][Ano][Personalizado]    ││ ← FiltrosPeriodo
│            │ │ 01/06 → 30/06  │                                        ││
│            │ └────────────────┴────────────────────────────────────────┘│
│            │                                                            │
│            │ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────┐ │
│            │ │ Total Entradas   │ │ Total Saídas     │ │ Resultado    │ │ ← 3 KPIs
│            │ │ 🟢 R$ 12.500,00  │ │ 🔴 R$ 8.754,00   │ │ 🔵 +R$3.746  │ │
│            │ │                  │ │                  │ │ Badge "Lucro"│ │
│            │ └──────────────────┘ └──────────────────┘ └──────────────┘ │
│            │                                                            │
│            │ ┌──────────────────────────┐ ┌──────────────────────────┐│
│            │ │ Entradas por Categoria   │ │ Saídas por Categoria    ││ ← grid 5+7
│            │ │ ▓▓▓▓▓▓▓▓▓ DIZIMO 64%    │ │ Categoria   │ Total │ %  ││
│            │ │ ▓▓▓▓▓ OFERTA    28%      │ │ DESP_OP  🟥│ 600   │68%││
│            │ │ ▓▓ CAMPANHA   8%        │ │ MANUTENÇÃO 🟥│ 200   │23%││
│            │ │                          │ │ COMPRA    🟥│  75   │ 9%││
│            │ │ (barras de progresso)    │ │ (com ícones impacto)    ││
│            │ └──────────────────────────┘ └──────────────────────────┘│
│            │                                                            │
│            │ ┌──────────────────────────────────────────────────────┐  │
│            │ │ Resumo de Saúde Financeira 🌟 (gradiente azul/cyan)  │  │
│            │ │ "Resultado positivo de R$ 3.746,00. Saldo acumulado  │  │
│            │ │  mantém tendência de alta nos últimos 3 meses."      │  │
│            │ └──────────────────────────────────────────────────────┘  │
└────────────┴─────────────────────────────────────────────────────────┘
```

### 2.2 Mobile (< 768px)

```
┌──────────────────────────────┐
│ ← Voltar    DRE              │
├──────────────────────────────┤
│ [7d] [30d] [Mês] [Ano] [📅]  │
│ Período: 01/06 → 30/06       │
│                              │
│ ┌──────────────────────────┐ │
│ │ Total Entradas           │ │
│ │ 🟢 R$ 12.500,00          │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Total Saídas             │ │
│ │ 🔴 R$ 8.754,00           │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Resultado                │ │
│ │ 🔵 +R$ 3.746,00  [Lucro] │ │
│ └──────────────────────────┘ │
│                              │
│ Entradas por Categoria       │
│ ▓▓▓▓▓▓ DIZIMO    64%        │
│ ▓▓▓▓ OFERTA      28%        │
│ ▓ CAMPANHA        8%        │
│                              │
│ Saídas por Categoria         │
│ DESP_OP  🟥  R$600  68%    │
│ MANUTEN  🟥  R$200  23%    │
│ COMPRA   🟥  R$ 75   9%    │
└──────────────────────────────┘
```

---

## 3. Componentes utilizados

| Componente | Fonte | Props | Localização |
|---|---|---|---|
| `<ShellAutenticado>` | shared | — | (já existe) |
| `<PageHeader>` | shared | `title`, `backHref` | (já existe) |
| `<FiltrosPeriodo>` | novo (ciclo 4) | `value`, `onChange`, `presets`, `defaultPreset="mes"` | `app/components/FiltrosPeriodo.tsx` |
| `<KpiCard>` | novo (ciclo 4) | `titulo`, `valor`, `cor`, `icone`, `badge?`, `subtitulo?` | `app/components/KpiCard.tsx` |
| `<EntradasPorCategoria>` | novo (ciclo 4) | `items: EntradaPorCategoria[]` | `app/components/EntradasPorCategoria.tsx` |
| `<SaidasPorCategoria>` | novo (ciclo 4) | `items: SaidaPorCategoria[]` | `app/components/SaidasPorCategoria.tsx` |
| `<ResumoSaudeFinanceira>` | novo (ciclo 4) | `resultadoCentavos`, `tendencia` | `app/components/ResumoSaudeFinanceira.tsx` |
| `<IconKpiWallet>`, `<IconKpiArrowUp>`, `<IconKpiArrowDown>`, `<IconKpiBalance>` | novo (ciclo 4) | — | `app/components/icons/FinanceIcons.tsx` |
| `<Can>` | shared | `user`, `allow` | (já existe) |

---

## 4. Estados visuais

| Estado | Quando | Render |
|---|---|---|
| **Initial (com dados)** | Período com lançamentos | 3 KPIs + 2 listas + card de saúde. |
| **Período vazio (mês sem lançamentos)** | `getDRE()` retorna zeros | 3 KPIs com `R$ 0,00` + listas com mensagem "Nenhuma movimentação no período" + card de saúde com tom neutro. |
| **Resultado negativo (déficit)** | `resultadoLiquidoCentavos < 0` | KPI "Resultado" mostra `−R$ X` em vermelho + badge "Déficit". |
| **Resultado positivo (lucro)** | `resultadoLiquidoCentavos > 0` | KPI "Resultado" mostra `+R$ X` em azul + badge "Lucro". |
| **Resultado zero** | `resultadoLiquidoCentavos === 0` | KPI "Resultado" mostra `R$ 0,00` em cinza + badge "Neutro". |
| **SECRETARIO / DISCIPULADOR / LIDER** | Bypass URL | **403** — ErrorBoundary. |
| **Loading** | Loader em 1ª carga | Skeleton: 3 retângulos grandes (KPIs) + 2 retângulos médios (listas). |
| **Error (500 / Zod 400)** | Período inválido ou DB falhou | Mensagem inline no topo do formulário + 3 KPIs com placeholders cinza. |

---

## 5. Interatividade

| Elemento | Evento | Comportamento |
|---|---|---|
| `<FiltrosPeriodo>` | Click em preset (7d/30d/Mês/Ano) | Re-submete form com novos search params `?inicio=...&fim=...`. Loader re-busca `getDRE()`. |
| `<FiltrosPeriodo>` | Click em "Personalizado" | Abre 2 `<input type="date">` + botão "Aplicar". Submete form com datas customizadas. |
| Linha de "Saídas por Categoria" | Click | `<Link>` para `/app/financeiro/lancamentos?categoria=X&periodo=inicio..fim` (drill-down). **PENDÊNCIA:** rota listagem geral não existe — decidir S13. |
| Linha de "Entradas por Categoria" | Click | Drill-down análogo ao de saídas. |
| Botão "← Voltar" | Click | Navega para `/app/financeiro/relatorios`. |

**Navegação por teclado:**
- Tab: FiltrosPeriodo → 3 KPIs (informativos) → 2 listas (drill-down) → card de saúde → sidebar.
- Foco visível em linhas clicáveis (drill-down).

---

## 6. Drill-down (RN-REL-07)

Linhas da tabela "Saídas por Categoria" e barras de "Entradas por Categoria" são `<Link>` para rota `/app/financeiro/lancamentos?categoria=X&periodo=inicio..fim`.

**PENDÊNCIA (brief §9.6 item #2):** essa rota **não existe** hoje. Decisão esperada na Fase 4:
- **Opção A:** criar nova rota (1 sprint extra — S13).
- **Opção B:** redirecionar para `/app/financeiro/caixas/:id` (UX perde filtros entre caixas).

Até decisão, drill-down fica como `<Link>` e renderiza placeholder/404 gracioso.

---

## 7. RBAC (defesa em 3 camadas)

| Camada | Onde | Verifica | Falha → |
|---|---|---|---|
| **1 — UI** | `<Can>` envolvendo todo o grid | Render condicional | SECRETARIO vê 403 (loader). |
| **2 — Loader** | `assertCanSeeRelatorios(user)` + validação Zod `RelatorioPeriodoSchema` | Lança `Response(403)` ou `Response(400)` | ErrorBoundary |
| **3 — Service** | `getDRE()` chama `assertCanSeeRelatorios` como 1ª linha | Mesmo helper | Lança `Response(403)` (defesa em profundidade) |

---

## 8. Dados (loader + service)

### 8.1 Loader

```ts
export async function loader({ context, request }: Route.LoaderArgs) {
  const user = context.get(userContext);
  assertCanSeeRelatorios(user); // 403 se SECRETARIO

  const url = new URL(request.url);
  const periodo = parsePeriodoFromUrl(url); // Zod RelatorioPeriodoSchema
  // inicio: z.coerce.date(), fim: z.coerce.date()
  // default: mês corrente
  // erro: 400 se inicio >= fim

  const dre = await getDRE(periodo, user);
  return { user, dre };
}
```

### 8.2 Service contract (`getDRE` em `app/lib/relatorios.server.ts`)

```ts
export async function getDRE(
  periodo: { inicio: Date; fim: Date },
  user: SessionUser
): Promise<DREData>;
```

**Tipo de retorno:**

```ts
type DREData = {
  periodo: { inicio: Date; fim: Date };
  totalEntradasCentavos: number;
  totalSaidasCentavos: number;
  resultadoLiquidoCentavos: number;
  entradasPorCategoria: Array<{
    categoria: CategoriaLancamento;
    totalCentavos: number;
    transacoes: number;
    percentual: number;
  }>;
  saidasPorCategoria: Array<{
    categoria: CategoriaLancamento;
    totalCentavos: number;
    transacoes: number;
    percentual: number;
  }>;
};
```

**Edge cases do service:**
- Mês vazio: `{ totalEntradasCentavos: 0, totalSaidasCentavos: 0, resultadoLiquidoCentavos: 0, entradasPorCategoria: [], saidasPorCategoria: [] }`.
- Caixa arquivado: lançamentos **continuam aparecendo** (RN-REL-05).
- Soma em `Int` cents via `reduce` (RN-REL-03).

---

## 9. Cross-references

- **Brief:** `brief-relatorios.md` §4.1.1, §4.2.2, §5.1 (presets).
- **PRD:** `PRD.html` §3.2 (US-REL-005 a 008).
- **SPEC:** `SPEC.html` §5.2 EP-001, §7.1.1, RN-REL-01 a 04.
- **RAGs:** `pattern-relatorios-aggregations.md`, `convention-monetary-values.md`, `pattern-3-layer-rbac.md`.

---

## 10. Critérios de aceite (gate Phase 5)

- [ ] Loader chama `assertCanSeeRelatorios` antes de qualquer I/O.
- [ ] Zod valida `inicio >= fim` → 400.
- [ ] Default é mês corrente quando sem search params.
- [ ] 3 KPIs renderizam com `formatBRLFromCents`.
- [ ] Lista "Entradas" ordena por valor decrescente.
- [ ] Lista "Saídas" ordena por valor decrescente.
- [ ] Drill-down em categoria navega para `/app/financeiro/lancamentos?categoria=X&periodo=...` (mesmo se rota não existe — placeholder).
- [ ] Mês vazio renderiza zeros + listas vazias sem crash.
- [ ] Badge "Lucro" / "Déficit" / "Neutro" alterna conforme `resultadoLiquidoCentavos`.
- [ ] SECRETARIO recebe 403 ao acessar (Camada 2 + 3).
- [ ] Cobertura de `getDRE()` = 100%.
- [ ] Latência < 2s para 1 ano típico (5k lançamentos, 7 categorias).
- [ ] `pnpm typecheck` passa.
- [ ] Lighthouse Accessibility ≥ 95.