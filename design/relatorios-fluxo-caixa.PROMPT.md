# Prompt — Fluxo de Caixa (ciclo 4)

> **Arquivo de rota:** `app/routes/app/financeiro.relatorios.fluxo-caixa.tsx`
> **Page name:** `relatorios-fluxo-caixa`
> **Sprint alvo:** S12 (Frontend) + S11 (Backend — `getFluxoCaixa`)
> **Design:** `design/relatorios-fluxo-caixa.DESIGN.md`

---

## 1. Contexto

Fluxo de Caixa — relatório que mostra **série temporal** de entradas, saídas e saldo acumulado ao longo de meses. É o relatório usado para conselho pastoral e visão de tendência.

- **Rota:** `/app/financeiro/relatorios/fluxo-caixa`
- **RBAC:** 3 perfis (ADMIN/PASTOR/FINANCEIRO). SECRETARIO BLOQUEADO.
- **Brief:** `brief-relatorios.md` §4.1.3 + §4.2.4
- **PRD:** `PRD.html` §3.4 (US-REL-013 a 016)
- **SPEC:** `SPEC.html` §5.4 EP-003, §7.1.3 (`getFluxoCaixa`)
- **Design:** `design/relatorios-fluxo-caixa.DESIGN.md`

---

## 2. Loader (defense in depth — camada 2)

```typescript
// app/routes/app/financeiro.relatorios.fluxo-caixa.tsx
import type { Route } from "./+types/financeiro.relatorios.fluxo-caixa";
import { z } from "zod";
import { assertCanSeeRelatorios } from "~/lib/rbac.server";
import { getFluxoCaixa } from "~/lib/relatorios.server";
import { startOfYear, endOfYearExclusive } from "~/lib/dates.server";

const PeriodoSchema = z.object({
  inicio: z.coerce.date().optional(),
  fim: z.coerce.date().optional(),
}).refine(
  (data) => {
    if (!data.inicio || !data.fim) return true;
    // Limite UI: 24 meses (decisão de performance)
    const diffMonths = (data.fim.getFullYear() - data.inicio.getFullYear()) * 12 + (data.fim.getMonth() - data.inicio.getMonth());
    return diffMonths <= 24 && data.inicio < data.fim;
  },
  { message: "Período inválido ou excede 24 meses (limite UI)." }
);

export async function loader({ context, request }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  // Camada 2: RBAC
  assertCanSeeRelatorios(user);

  // Parse + valida período (default: ano corrente)
  const url = new URL(request.url);
  const parsed = PeriodoSchema.safeParse({
    inicio: url.searchParams.get("inicio") ?? undefined,
    fim: url.searchParams.get("fim") ?? undefined,
  });

  if (!parsed.success) {
    throw new Response(parsed.error.errors[0]?.message ?? "Período inválido.", { status: 400 });
  }

  const hoje = new Date();
  const periodo = {
    inicio: parsed.data.inicio ?? startOfYear(hoje),
    fim: parsed.data.fim ?? endOfYearExclusive(hoje),
  };

  // Camada 3 (via service)
  const fluxo = await getFluxoCaixa(periodo, user);

  return { user, fluxo, periodo };
}
```

**Notas:**
- Loader chama `assertCanSeeRelatorios` **antes** de qualquer I/O (Camada 2).
- UI limita a 24 meses (decisão SPEC §5.4). > 24 meses → 400.
- Default é ano corrente se sem search params.
- Service `getFluxoCaixa` revalida RBAC (Camada 3).

---

## 3. Componentes a criar/usar

### 3.1 Criar (novos no ciclo 4)

| Componente | Localização | Props |
|---|---|---|
| `<TabsPeriodo>` | `app/components/TabsPeriodo.tsx` | `{ value: 'dia' \| 'semana' \| 'mes'; onChange }` (Dia/Semana disabled) |
| `<FluxoCaixaChart>` | `app/components/FluxoCaixaChart.tsx` | `{ serie: Array<{ mes, entradasCentavos, saidasCentavos, saldoCentavos }> }` (SVG line chart inline) |
| `<ProjectionPlaceholder>` | (compartilhado) | `{ titulo, mensagem }` |

### 3.2 Usar (existentes)

- `<ShellAutenticado>` (ciclo 1)
- `<PageHeader title="Fluxo de Caixa" backHref="/app/financeiro/relatorios" />`
- `<FiltrosPeriodo>` (ciclo 4) — `defaultPreset="ano"`.
- `<KpiCard>` (ciclo 4) — 4 cards: Entradas, Saídas, Saldo Acumulado, Contas a Pagar (placeholder).
- `<IconCalendar>`, `<IconExport>`, `<IconKpiWallet>`, `<IconKpiBalance>`, `<IconHourglass>`, `<IconShowChart>`

---

## 4. Layout (Tailwind)

```tsx
export default function FluxoCaixaPage({ loaderData }: Route.ComponentProps) {
  const { user, fluxo, periodo } = loaderData;

  return (
    <ShellAutenticado user={user}>
      <PageHeader title="Fluxo de Caixa" backHref="/app/financeiro/relatorios" />

      <Can user={user} allow={["ADMIN", "PASTOR", "FINANCEIRO"]}>
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          {/* Tabs Dia/Semana/Mês (apenas Mês funcional) */}
          <TabsPeriodo value="mes" onChange={() => {}} />

          {/* Header com período + Exportar (placeholder) */}
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-4">
            <FiltrosPeriodo value={periodo} onChange={(p) => navigate(`?inicio=...&fim=...`)} presets defaultPreset="ano" />
            <button disabled className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-400 rounded-lg cursor-not-allowed">
              <IconExport className="w-4 h-4" />
              Exportar (em breve)
            </button>
          </div>

          {/* 4 KPIs (4º é placeholder) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <KpiCard
              titulo="Total Entradas"
              valor={formatBRLFromCents(fluxo.kpis.totalEntradasCentavos)}
              cor="emerald"
              icone={<IconKpiWallet className="w-6 h-6" />}
            />
            <KpiCard
              titulo="Total Saídas"
              valor={formatBRLFromCents(fluxo.kpis.totalSaidasCentavos)}
              cor="red"
              icone={<IconKpiWallet className="w-6 h-6" />}
            />
            <KpiCard
              titulo="Saldo Acumulado"
              valor={formatBRLFromCents(fluxo.kpis.saldoAcumuladoCentavos)}
              cor="blue"
              icone={<IconKpiBalance className="w-6 h-6" />}
            />
            <KpiCard
              titulo="Contas a Pagar (30d)"
              valor="Em breve"
              cor="default"
              icone={<IconHourglass className="w-6 h-6" />}
              subtitulo="Disponível em ciclo futuro"
            />
          </div>

          {/* Grid 8+4: Chart + Placeholder Projeção */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Histórico de Fluxo de Caixa</h2>
              {fluxo.serie.length === 0 ? (
                <p className="text-sm text-slate-500">Sem dados no período.</p>
              ) : (
                <FluxoCaixaChart serie={fluxo.serie} />
              )}
            </div>

            <div className="lg:col-span-4">
              <ProjectionPlaceholder
                titulo="Projeção Próximos 30 dias"
                mensagem="Disponível em ciclo futuro — depende de módulo Contas a Pagar (RN-XYZ)."
              />
            </div>
          </div>
        </div>
      </Can>
    </ShellAutenticado>
  );
}
```

**Container:** `p-6 max-w-7xl mx-auto space-y-6`
**KPI grid:** `grid grid-cols-1 md:grid-cols-4 gap-6`
**Grid 8+4:** `grid grid-cols-1 lg:grid-cols-12 gap-6` + `lg:col-span-8` + `lg:col-span-4`

---

## 5. Dados esperados (loaderData)

```typescript
type LoaderData = {
  user: SessionUser;
  periodo: { inicio: Date; fim: Date };
  fluxo: {
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
};
```

---

## 6. SVG Line Chart (`<FluxoCaixaChart>`)

Renderiza 3 séries em SVG inline (sem `recharts`/`d3`/`chart.js`).

```tsx
export function FluxoCaixaChart({ serie }: { serie: FluxoCaixaData['serie'] }) {
  const width = 800;
  const height = 320;
  const padding = { top: 20, right: 20, bottom: 40, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxValor = Math.max(
    ...serie.flatMap((s) => [s.entradasCentavos, s.saidasCentavos, Math.abs(s.saldoCentavos)])
  );

  const xStep = chartWidth / Math.max(serie.length - 1, 1);

  const toPath = (key: 'entradasCentavos' | 'saidasCentavos' | 'saldoCentavos', invert = false) => {
    return serie
      .map((s, i) => {
        const x = padding.left + i * xStep;
        const y = padding.top + chartHeight - (s[key] / maxValor) * chartHeight;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Histórico de Fluxo de Caixa">
      {/* Eixos */}
      <line x1={padding.left} y1={padding.top + chartHeight} x2={width - padding.right} y2={padding.top + chartHeight} stroke="#cbd5e1" />
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartHeight} stroke="#cbd5e1" />

      {/* Grid horizontal */}
      {[0.25, 0.5, 0.75].map((p) => (
        <line key={p} x1={padding.left} y1={padding.top + chartHeight * p} x2={width - padding.right} y2={padding.top + chartHeight * p} stroke="#e5e7eb" strokeDasharray="4 4" />
      ))}

      {/* Série ENTRADAS (verde sólido) */}
      <path d={toPath('entradasCentavos')} fill="none" stroke="#047857" strokeWidth="3" />

      {/* Série SAÍDAS (vermelho sólido) */}
      <path d={toPath('saidasCentavos')} fill="none" stroke="#b91c1c" strokeWidth="3" />

      {/* Série SALDO (azul tracejado) */}
      <path d={toPath('saldoCentavos')} fill="none" stroke="#0e7490" strokeWidth="2" strokeDasharray="6 4" />

      {/* Labels X (meses) */}
      {serie.map((s, i) => (
        <text key={s.mes} x={padding.left + i * xStep} y={height - 10} fontSize="12" textAnchor="middle" fill="#64748b">
          {s.mes.slice(5)} {/* MM */}
        </text>
      ))}

      {/* Legenda */}
      <g transform={`translate(${padding.left}, ${padding.top - 10})`}>
        <circle cx="0" cy="0" r="4" fill="#047857" />
        <text x="10" y="4" fontSize="12" fill="#475569">Entradas</text>
        <circle cx="80" cy="0" r="4" fill="#b91c1c" />
        <text x="90" y="4" fontSize="12" fill="#475569">Saídas</text>
        <line x1="155" y1="0" x2="175" y2="0" stroke="#0e7490" strokeWidth="2" strokeDasharray="6 4" />
        <text x="180" y="4" fontSize="12" fill="#475569">Saldo</text>
      </g>
    </svg>
  );
}
```

**Cores:**
- Entradas: `#047857` (verde-700)
- Saídas: `#b91c1c` (vermelho-700)
- Saldo: `#0e7490` (cyan-700, tracejado)

---

## 7. Interatividade

| Elemento | Comportamento |
|---|---|
| Tab "Dia" / "Semana" | **Disabled** com label "Em breve". Sem ação (decisão §5.6). |
| Tab "Mês" (ativa) | Mantém filtro. Default. |
| `<FiltrosPeriodo>` (Ano / Personalizado) | `onChange` → `navigate(?inicio=...&fim=...)`. Limite UI: 24 meses. |
| Botão "Exportar" | **Disabled** (placeholder). PDF/Excel diferidos. |
| Botão "← Voltar" | Navega para `/app/financeiro/relatorios`. |

---

## 8. Tarefas granulares

- **T001:** Backend: implementar `getFluxoCaixa(periodo, user)` em `app/lib/relatorios.server.ts`.
- **T002:** Backend: query `findMany` em `prisma.lancamento` filtrando por período.
- **T003:** Backend: agregar em memória por mês (Map<YYYY-MM, {entradas, saidas}>). Calcular saldo acumulado (running total).
- **T004:** Backend: limitar retorno a 24 pontos na UI.
- **T005:** Backend: testes unitários (1 ano, 2 anos limitado a 24, ano vazio, RBAC).
- **T006:** Frontend: criar `app/routes/app/financeiro.relatorios.fluxo-caixa.tsx` com loader + default export.
- **T007:** Frontend: criar `<TabsPeriodo>` (3 tabs, 2 disabled).
- **T008:** Frontend: criar `<FluxoCaixaChart>` (SVG inline, 3 séries, 24 pontos máx).
- **T009:** Frontend: renderizar 4 KPIs (3 funcionais + 1 placeholder).
- **T010:** Frontend: integrar `<ProjectionPlaceholder>` no side card.
- **T011:** Teste E2E: `e2e/relatorios-fluxo-caixa-rbac.spec.ts` — login SECRETARIO → expect 403.
- **T012:** Teste E2E: `e2e/relatorios-fluxo-caixa-svg.spec.ts` — login FINANCEIRO → chart SVG renderiza 3 séries.

---

## 9. Critérios de aceitação

- [ ] SECRETARIO recebe 403 ao acessar (Camada 2 + 3).
- [ ] UI limita 24 meses (loader rejeita > 24 com 400).
- [ ] Default é ano corrente.
- [ ] 4 KPIs renderizam (4º é placeholder com texto "Em breve").
- [ ] SVG line chart renderiza 3 séries com cores corretas (verde/vermelho/azul tracejado).
- [ ] Path Bezier OU linhas retas (decisão frontend). 24 pontos máx.
- [ ] Tabs Dia/Semana desabilitadas com label "Em breve".
- [ ] Tab Mês funcional.
- [ ] Placeholder "Projeção 30d" renderiza cinza.
- [ ] Botão "Exportar" desabilitado (placeholder visual).
- [ ] Cobertura de `getFluxoCaixa` = 100%.
- [ ] Latência < 2s para 1 ano típico.
- [ ] `pnpm typecheck` passa.

---

## 10. Cross-module hints

- **`app/lib/relatorios.server.ts`:** adicionar função `getFluxoCaixa` (S11 — backend).
- **Workaround SQLite:** Prisma não suporta `strftime('%Y-%m', dataCompetencia)` em `groupBy`. Usar `findMany` + `Map` em memória (decisão SPEC §7.1.3).
- **Sem drill-down** nesta página (apenas leitura).
- **RAG `convention-monetary-values`:** soma em `Int` cents.

---

## 11. Notas de implementação

- **Workaround SQLite (`findMany` + `Map`):** aceitável até ~60k linhas (12 meses × 5k). Acima disso, `prisma.$queryRaw` com `strftime` é backlog (ciclo 6+).
- **Saldo acumulado = running total:** soma incremental mês a mês, não reset por mês.
- **Path do SVG:** algoritmo simples (linhas retas). Se quiser Bezier, usar `path d="M ... C ..."`. Decisão do frontend agent.
- **`aria-label` no `<svg>`:** "Histórico de Fluxo de Caixa com X pontos de X a X".