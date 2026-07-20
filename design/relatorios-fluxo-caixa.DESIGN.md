# Design — Fluxo de Caixa (ciclo 4)

> **Rota:** `/app/financeiro/relatorios/fluxo-caixa`
> **RBAC:** ADMIN, PASTOR, FINANCEIRO (SECRETARIO BLOQUEADO)
> **Stitch base:** `~/Downloads/stitch_igrejaconnect/fluxo_de_caixa_igrejaconnect/code.html`
> **Cross-refs:** PRD §3.4 (US-REL-013 a 016), SPEC §5.4 EP-003, brief §4.1.3 + §4.2.4

---

## 1. Contexto

Fluxo de Caixa — relatório que mostra **série temporal** de entradas, saídas e saldo acumulado ao longo de meses. É o relatório usado para **conselho pastoral** e visão de tendência.

**Persona-alvo:** Pastor (PASTOR) — aconselhamento estratégico. Tesoureiro (FINANCEIRO) — análise de tendência. Administrador (ADMIN) — auditoria.

**Caso de uso primário:** FINANCEIRO entra, vê 12 meses do ano corrente em gráfico SVG inline (Entradas verde sólido, Saídas vermelho sólido, Saldo azul tracejado), identifica tendência de queda de dízimo em jun-jul, planeja ação pastoral.

**Quem NÃO acessa:** SECRETARIO, DISCIPULADOR, LIDER_MINISTERIO (RN-REL-01, 3 camadas).

---

## 2. Layout (estrutura visual)

### 2.1 Desktop (≥ 1024px)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Topbar + Sidebar ("Relatórios" ativo)                               │
├────────────┬─────────────────────────────────────────────────────────┤
│ Sidebar    │ ← Voltar    Fluxo de Caixa                              │ ← h1
│            │                                                            │
│            │ ┌─────────────────┬──────────────────┬─────────────────┐│
│            │ │ [Dia: Em breve] │ [Semana: Em breve]│ [Mês: ATIVO]  ││ ← tabs
│            │ └─────────────────┴──────────────────┴─────────────────┘│
│            │ [📅 Período: 2026]  [Exportar 📤 (placeholder)]           │ ← header
│            │                                                            │
│            │ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────┐
│            │ │ Total Entradas   │ │ Total Saídas     │ │ Saldo Acumul.│ ← 3 KPIs
│            │ │ 🟢 R$ 125.000,00 │ │ 🔴 R$ 98.754,00  │ │ 🔵 R$ 26.246 │
│            │ └──────────────────┘ └──────────────────┘ └──────────────┘
│            │ ┌──────────────────────────────┐                          │
│            │ │ Contas a Pagar (30d) 🕐       │                          │ ← 4º KPI
│            │ │ "Em breve — placeholder"      │                          │
│            │ └──────────────────────────────┘                          │
│            │                                                            │
│            │ ┌────────────────────────────────────┐ ┌─────────────────┐│
│            │ │ Histórico de Fluxo de Caixa (SVG)   │ │ Projeção 30d 🕐 ││ ← grid 8+4
│            │ │                                    │ │ (placeholder    ││
│            │ │      ╱╲                            │ │  cinza YAGNI)   ││
│            │ │  ╱──╲╱╲╱╲  ← Entradas (verde)     │ │                 ││
│            │ │ ╱──────╲╱─  ← Saídas (vermelho)    │ │ "Disponível em  ││
│            │ │ ════════    ← Saldo (azul tracej.) │ │  ciclo futuro   ││
│            │ │                                    │ │  — depende de   ││
│            │ │ Jan Fev Mar Abr Mai Jun Jul Ago Set │ │  Contas a Pagar"││
│            │ └────────────────────────────────────┘ └─────────────────┘│
└────────────┴─────────────────────────────────────────────────────────┘
```

### 2.2 Mobile (< 768px)

```
┌──────────────────────────────┐
│ ← Voltar    Fluxo de Caixa   │
├──────────────────────────────┤
│ [Dia] [Semana] [Mês]         │
│ [📅 2026] [📤 Exportar]      │
│                              │
│ ┌──────────────────────────┐ │
│ │ Total Entradas 🟢        │ │
│ │ R$ 125.000,00            │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Total Saídas 🔴          │ │
│ │ R$ 98.754,00             │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Saldo Acumulado 🔵       │ │
│ │ R$ 26.246,00             │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Contas a Pagar (30d) 🕐  │ │
│ │ (placeholder)            │ │
│ └──────────────────────────┘ │
│                              │
│ Histórico (SVG)              │
│ ▁▂▃▅▆▇ Entradas            │
│ ▁▂▃▄▅▆ Saídas              │
│ ─ ─ ─ Saldo                 │
│                              │
│ Projeção 30d 🕐              │
│ (placeholder YAGNI)          │
└──────────────────────────────┘
```

---

## 3. Componentes utilizados

| Componente | Fonte | Props | Localização |
|---|---|---|---|
| `<ShellAutenticado>` | shared | — | (já existe) |
| `<PageHeader>` | shared | `title`, `backHref`, `action?` | (já existe) |
| `<TabsPeriodo>` | novo (ciclo 4) | `value: 'dia' \| 'semana' \| 'mes'`, `onChange` (apenas `mes` funcional) | `app/components/TabsPeriodo.tsx` |
| `<FiltrosPeriodo>` | novo (ciclo 4) | `value`, `onChange`, `presets`, `defaultPreset="ano"` | `app/components/FiltrosPeriodo.tsx` |
| `<KpiCard>` | novo (ciclo 4) | `titulo`, `valor`, `cor`, `icone`, `badge?` | (já existe) |
| `<FluxoCaixaChart>` | novo (ciclo 4) | `serie: Array<{mes, entradasCentavos, saidasCentavos, saldoCentavos}>` | `app/components/FluxoCaixaChart.tsx` (SVG line chart inline) |
| `<ProjectionPlaceholder>` | novo (ciclo 4) | `titulo`, `mensagem` | (já existe) |
| `<IconCalendar>`, `<IconExport>`, `<IconKpiWallet>`, `<IconKpiBalance>`, `<IconHourglass>`, `<IconShowChart>` | novo (ciclo 4) | — | `app/components/icons/FinanceIcons.tsx` |

---

## 4. Estados visuais

| Estado | Quando | Render |
|---|---|---|
| **Initial (com dados)** | Período com lançamentos | 4 KPIs + chart SVG 3 séries + placeholder "Projeção". |
| **Período vazio (ano sem lançamentos)** | `getFluxoCaixa()` retorna séries vazias | 4 KPIs com `R$ 0,00` + chart com eixos sem dados. |
| **Aba "Dia" / "Semana" clicada** | Tabs YAGNI | Label "Em breve" desabilitado (não navegável). |
| **SECRETARIO / DISCIPULADOR / LIDER** | Bypass URL | **403** — ErrorBoundary. |
| **Loading** | Loader em 1ª carga | Skeleton: 4 retângulos (KPIs) + 1 retângulo grande (chart). |
| **Error (400 / 500)** | Período inválido (> 24 meses) ou DB falhou | Mensagem inline + KPIs zerados. |

---

## 5. Interatividade

| Elemento | Evento | Comportamento |
|---|---|---|
| Tab "Dia" | Click | Label "Em breve" (desabilitado). Sem ação. Decisão YAGNI (brief §4.2.4). |
| Tab "Semana" | Click | Label "Em breve" (desabilitado). Sem ação. |
| Tab "Mês" (ativa) | Click | Mantém filtro de 12 meses. Default. |
| `<FiltrosPeriodo>` (Ano / Personalizado) | Click em preset | Re-submete form com `?inicio=...&fim=...`. Loader re-busca `getFluxoCaixa()`. Limite UI: 24 meses. |
| Botão "Exportar" | Click | **Placeholder visual** (botão desabilitado). PDF/Excel diferidos (decisão §5.2). |
| Botão "← Voltar" | Click | Navega para `/app/financeiro/relatorios`. |

**Navegação por teclado:**
- Tab: tabs (3) → filtros → 4 KPIs → chart → placeholder → sidebar.

---

## 6. SVG Line Chart (especificação técnica)

Renderizado inline em SVG (sem `recharts`/`d3`/`chart.js`, decisão §5.5). Estrutura:

```
<svg viewBox="0 0 800 320" class="w-full">
  <!-- Eixos -->
  <line x1="40" y1="280" x2="780" y2="280" />  <!-- X axis -->
  <line x1="40" y1="20" x2="40" y2="280" />     <!-- Y axis -->
  
  <!-- Grid horizontal (4 linhas) -->
  <line x1="40" y1="80" x2="780" y2="80" stroke-dasharray="4 4" />
  <line x1="40" y1="160" x2="780" y2="160" stroke-dasharray="4 4" />
  <line x1="40" y1="240" x2="780" y2="240" stroke-dasharray="4 4" />
  
  <!-- Série ENTRADAS (verde sólido, Bezier path) -->
  <path d="M 80 200 C 100 180, 140 160, 200 150 ..." 
        fill="none" stroke="#047857" stroke-width="3" />
  
  <!-- Série SAÍDAS (vermelho sólido, Bezier path) -->
  <path d="M 80 220 C 100 200, 140 180, 200 170 ..." 
        fill="none" stroke="#b91c1c" stroke-width="3" />
  
  <!-- Série SALDO (azul tracejado, Bezier path) -->
  <path d="M 80 240 C 100 220, 140 200, 200 180 ..." 
        fill="none" stroke="#0e7490" stroke-width="2" 
        stroke-dasharray="6 4" />
  
  <!-- Labels X (meses) -->
  <text x="80" y="300">Jan</text>
  <text x="140" y="300">Fev</text>
  ...
  
  <!-- Tooltip on hover (rect invisível) -->
  <g class="hover:opacity-100">
    <circle cx="..." cy="..." r="4" fill="#047857" />
    <rect ... />
    <text>...</text>
  </g>
</svg>
```

**Cálculo de coordenadas:** SVG recebe `serie: Array<{mes, entradasCentavos, saidasCentavos, saldoCentavos}>` e calcula path via algoritmo simples:
- Normaliza valores entre `[0, maxValor]` → mapeia para `[280, 20]` (Y invertido).
- Distribui 12 pontos uniformemente em X (de 80 a 760).
- Usa `path d="M ... L ... L ..."` ou Bezier (decisão de implementação no prompt do frontend).

**Cores:**
- Entradas: `#047857` (verde-700).
- Saídas: `#b91c1c` (vermelho-700).
- Saldo: `#0e7490` (cyan-700, tracejado).

---

## 7. Placeholder Projeção (RN-YAGNI-01, brief §5.6)

O side card "Projeção Próximos 30 dias" renderiza **placeholder cinza** com texto "Disponível em ciclo futuro — depende de módulo Contas a Pagar (RN-XYZ)". Implementação análoga ao do Balancete.

**Quando evoluir:** ciclo 6+ (ciclo que entregar `ContaPagar`).

---

## 8. RBAC (defesa em 3 camadas)

| Camada | Onde | Verifica | Falha → |
|---|---|---|---|
| **1 — UI** | `<Can allow={["ADMIN","PASTOR","FINANCEIRO"]}>` | Render condicional | SECRETARIO vê 403. |
| **2 — Loader** | `assertCanSeeRelatorios(user)` + Zod `FluxoCaixaPeriodoSchema` (limite UI 24 meses) | Lança `Response(403)` ou `Response(400)` | ErrorBoundary |
| **3 — Service** | `getFluxoCaixa()` chama `assertCanSeeRelatorios` | Mesmo helper | Lança `Response(403)` |

---

## 9. Dados (loader + service)

### 9.1 Loader

```ts
export async function loader({ context, request }: Route.LoaderArgs) {
  const user = context.get(userContext);
  assertCanSeeRelatorios(user);

  const url = new URL(request.url);
  const { inicio, fim } = parseFluxoFromUrl(url); // Zod FluxoCaixaPeriodoSchema
  // UI limita a 24 meses (decisão de performance, SPEC §5.4)

  const fluxo = await getFluxoCaixa({ inicio, fim }, user);
  return { user, fluxo };
}
```

### 9.2 Service contract (`getFluxoCaixa` em `app/lib/relatorios.server.ts`)

```ts
export async function getFluxoCaixa(
  periodo: { inicio: Date; fim: Date },
  user: SessionUser
): Promise<FluxoCaixaData>;
```

**Tipo de retorno:**

```ts
type FluxoCaixaData = {
  periodo: { inicio: Date; fim: Date };
  kpis: {
    totalEntradasCentavos: number;
    totalSaidasCentavos: number;
    saldoAcumuladoCentavos: number;
    contasAPagarCentavos: number | null; // placeholder
  };
  serie: Array<{
    mes: string; // 'YYYY-MM'
    entradasCentavos: number;
    saidasCentavos: number;
    saldoCentavos: number;
  }>;
};
```

**Workaround SQLite:** `prisma.lancamento.findMany` + `Map` em memória (Prisma não suporta `strftime('%Y-%m', dataCompetencia)` em `groupBy`). 12 pontos para 1 ano default.

---

## 10. Cross-references

- **Brief:** `brief-relatorios.md` §4.1.3, §4.2.4, §5.6 (projeção placeholder).
- **PRD:** `PRD.html` §3.4 (US-REL-013 a 016).
- **SPEC:** `SPEC.html` §5.4 EP-003, §7.1.3, RN-REL-01 a 04.

---

## 11. Critérios de aceite (gate Phase 5)

- [ ] Loader chama `assertCanSeeRelatorios` antes de qualquer I/O.
- [ ] Default é ano corrente quando sem search params.
- [ ] UI limita 24 meses (loader rejeita > 24 meses com 400).
- [ ] 4 KPIs renderizam com `formatBRLFromCents` (4º KPI é placeholder).
- [ ] SVG line chart renderiza 3 séries com cores corretas (verde/vermelho/azul tracejado).
- [ ] Tabs Dia/Semana desabilitadas com label "Em breve".
- [ ] Tab Mês funcional.
- [ ] Placeholder "Projeção 30d" renderiza cinza (sem lógica).
- [ ] Botão "Exportar" desabilitado (placeholder visual).
- [ ] SECRETARIO recebe 403 ao acessar (Camada 2 + 3).
- [ ] Cobertura de `getFluxoCaixa()` = 100%.
- [ ] Latência < 2s para 1 ano típico.
- [ ] `pnpm typecheck` passa.
- [ ] Lighthouse Accessibility ≥ 95 (SVG com `role="img"` + `aria-label` descritivo).