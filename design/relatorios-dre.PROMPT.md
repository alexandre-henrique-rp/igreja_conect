# Prompt — DRE (ciclo 4)

> **Arquivo de rota:** `app/routes/app/financeiro.relatorios.dre.tsx`
> **Page name:** `relatorios-dre`
> **Sprint alvo:** S12 (Frontend) + S11 (Backend — `getDRE`)
> **Design:** `design/relatorios-dre.DESIGN.md`

---

## 1. Contexto

Demonstração do Resultado do Exercício — relatório que consolida **entradas vs. saídas** em um período, agrupadas por categoria. É o relatório mais usado no fechamento mensal.

- **Rota:** `/app/financeiro/relatorios/dre`
- **RBAC:** 3 perfis (ADMIN/PASTOR/FINANCEIRO). SECRETARIO BLOQUEADO.
- **Brief:** `brief-relatorios.md` §4.1.1 + §4.2.2
- **PRD:** `PRD.html` §3.2 (US-REL-005 a 008)
- **SPEC:** `SPEC.html` §5.2 EP-001, §7.1.1 (`getDRE`)
- **Design:** `design/relatorios-dre.DESIGN.md`

---

## 2. Loader (defense in depth — camada 2)

```typescript
// app/routes/app/financeiro.relatorios.dre.tsx
import type { Route } from "./+types/financeiro.relatorios.dre";
import { z } from "zod";
import { assertCanSeeRelatorios } from "~/lib/rbac.server";
import { getDRE } from "~/lib/relatorios.server";
import { startOfMonth, endOfMonthExclusive } from "~/lib/dates.server";

const PeriodoSchema = z.object({
  inicio: z.coerce.date().optional(),
  fim: z.coerce.date().optional(),
}).refine(
  (data) => !data.inicio || !data.fim || data.inicio < data.fim,
  { message: "Período inválido: início deve ser anterior ao fim." }
);

export async function loader({ context, request }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  // Camada 2: RBAC
  assertCanSeeRelatorios(user); // 403

  // Parse + valida período (default: mês corrente)
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
    inicio: parsed.data.inicio ?? startOfMonth(hoje),
    fim: parsed.data.fim ?? endOfMonthExclusive(hoje),
  };

  // Camada 3 (via service): assertCanSeeRelatorios + assertPeriodoValido + groupBy
  const dre = await getDRE(periodo, user);

  return { user, dre, periodo };
}
```

**Notas:**
- Loader chama `assertCanSeeRelatorios` **antes** de qualquer I/O (Camada 2).
- Zod valida período: `inicio >= fim` → 400.
- Default é mês corrente se sem search params.
- Service `getDRE` revalida RBAC (Camada 3) e chama `assertPeriodoValido`.

---

## 3. Componentes a criar/usar

### 3.1 Criar (novos no ciclo 4)

| Componente | Localização | Props |
|---|---|---|
| `<EntradasPorCategoria>` | `app/components/EntradasPorCategoria.tsx` | `{ items: Array<{ categoria, totalCentavos, transacoes, percentual }> }` |
| `<SaidasPorCategoria>` | `app/components/SaidasPorCategoria.tsx` | `{ items: Array<{ categoria, totalCentavos, transacoes, percentual }> }` (com drill-down) |
| `<ResumoSaudeFinanceira>` | `app/components/ResumoSaudeFinanceira.tsx` | `{ resultadoCentavos: number; entradasCentavos: number; saidasCentavos: number }` |

### 3.2 Usar (existentes)

- `<ShellAutenticado>` (ciclo 1)
- `<PageHeader title="DRE — Demonstração do Resultado do Exercício" backHref="/app/financeiro/relatorios" />`
- `<FiltrosPeriodo value={periodo} onChange={...} presets defaultPreset="mes" />`
- `<KpiCard>` (ciclo 4) — 3 cards: Entradas (verde), Saídas (vermelho), Resultado (azul com badge)
- `<IconKpiWallet>`, `<IconKpiArrowUp>`, `<IconKpiArrowDown>`, `<IconKpiBalance>` (ciclo 4)
- `<Can user={user} allow={["ADMIN","PASTOR","FINANCEIRO"]}>`

---

## 4. Layout (Tailwind)

```tsx
export default function DREPage({ loaderData }: Route.ComponentProps) {
  const { user, dre, periodo } = loaderData;
  const isLucro = dre.resultadoLiquidoCentavos > 0;
  const isDeficit = dre.resultadoLiquidoCentavos < 0;

  return (
    <ShellAutenticado user={user}>
      <PageHeader
        title="DRE — Demonstração do Resultado do Exercício"
        backHref="/app/financeiro/relatorios"
      />

      <Can user={user} allow={["ADMIN", "PASTOR", "FINANCEIRO"]}>
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          {/* Filtros de período */}
          <FiltrosPeriodo value={periodo} onChange={(p) => navigate(`?inicio=${...}&fim=${...}`)} presets defaultPreset="mes" />

          {/* 3 KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <KpiCard
              titulo="Total Entradas"
              valor={formatBRLFromCents(dre.totalEntradasCentavos)}
              cor="emerald"
              icone={<IconKpiArrowUp className="w-6 h-6" />}
            />
            <KpiCard
              titulo="Total Saídas"
              valor={formatBRLFromCents(dre.totalSaidasCentavos)}
              cor="red"
              icone={<IconKpiArrowDown className="w-6 h-6" />}
            />
            <KpiCard
              titulo="Resultado"
              valor={formatBRLFromCents(Math.abs(dre.resultadoLiquidoCentavos))}
              cor="blue"
              icone={<IconKpiBalance className="w-6 h-6" />}
              badge={isLucro ? "Lucro" : isDeficit ? "Déficit" : "Neutro"}
            />
          </div>

          {/* Grid 5+7: Entradas (esquerda) + Saídas (direita) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Entradas por Categoria</h2>
              {dre.entradasPorCategoria.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma movimentação no período.</p>
              ) : (
                <EntradasPorCategoria items={dre.entradasPorCategoria} />
              )}
            </div>

            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Saídas por Categoria</h2>
              {dre.saidasPorCategoria.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma movimentação no período.</p>
              ) : (
                <SaidasPorCategoria items={dre.saidasPorCategoria} periodo={periodo} />
              )}
            </div>
          </div>

          {/* Card de saúde financeira (gradiente azul) */}
          <ResumoSaudeFinanceira
            resultadoCentavos={dre.resultadoLiquidoCentavos}
            entradasCentavos={dre.totalEntradasCentavos}
            saidasCentavos={dre.totalSaidasCentavos}
          />
        </div>
      </Can>
    </ShellAutenticado>
  );
}
```

**Container:** `p-6 max-w-7xl mx-auto space-y-6`
**KPI grid:** `grid grid-cols-1 md:grid-cols-3 gap-6`
**Grid 5+7:** `grid grid-cols-1 lg:grid-cols-12 gap-6` + `lg:col-span-5` + `lg:col-span-7`
**Card branco:** `bg-white border border-slate-200 rounded-xl p-6`

---

## 5. Dados esperados (loaderData)

```typescript
type LoaderData = {
  user: SessionUser;
  periodo: { inicio: Date; fim: Date };
  dre: {
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
};
```

---

## 6. Interatividade

| Elemento | Comportamento |
|---|---|
| `<FiltrosPeriodo>` (presets) | Re-submete form com `?inicio=...&fim=...`. |
| `<FiltrosPeriodo>` (Personalizado) | 2 `<input type="date">` + botão "Aplicar". |
| Click em barra de "Entradas por Categoria" | `<Link to={`/app/financeiro/lancamentos?categoria=${item.categoria}&periodo=${inicio}..${fim}`}>` (drill-down). |
| Click em linha de "Saídas por Categoria" | Drill-down análogo. |
| Badge "Lucro" / "Déficit" / "Neutro" | Renderiza conforme `dre.resultadoLiquidoCentavos`. |

**Drill-down (PENDÊNCIA — brief §9.6 item #2):** rota `/app/financeiro/lancamentos` (listagem geral) **não existe**. Decisão esperada na Fase 4:
- **Opção A:** criar nova rota (S13 condicional).
- **Opção B:** redirecionar para `/app/financeiro/caixas/:id` com query params.

Até decisão, drill-down renderiza `<Link>` que leva a 404 gracioso ou placeholder.

---

## 7. Tarefas granulares

- **T001:** Backend: implementar `getDRE(periodo, user)` em `app/lib/relatorios.server.ts` com `Promise.all([groupBy ENTRADA, groupBy SAIDA])` + soma em `Int` cents + `mapCategorias()`.
- **T002:** Backend: implementar `assertPeriodoValido(periodo)` em `app/lib/relatorios-helpers.server.ts`.
- **T003:** Backend: implementar `mapCategorias(groupBy, totalCentavos)` em `app/lib/relatorios-helpers.server.ts`.
- **T004:** Backend: testes unitários para `getDRE` (mês vazio, mês cheio, RBAC, período inválido, caixa arquivado).
- **T005:** Frontend: criar `app/routes/app/financeiro.relatorios.dre.tsx` com loader + default export.
- **T006:** Frontend: criar `<EntradasPorCategoria>` e `<SaidasPorCategoria>` (com drill-down `<Link>`).
- **T007:** Frontend: criar `<ResumoSaudeFinanceira>` (gradiente azul, ícone `<IconAutoAwesome>`).
- **T008:** Frontend: integrar `<FiltrosPeriodo>` com state local (presets + personalizado).
- **T009:** Frontend: renderizar 3 `<KpiCard>` (Entradas verde, Saídas vermelho, Resultado azul).
- **T010:** Teste E2E: `e2e/relatorios-dre-rbac.spec.ts` — login SECRETARIO → expect 403.
- **T011:** Teste E2E: `e2e/relatorios-dre-filtros.spec.ts` — login FINANCEIRO → muda período → vê KPIs atualizados.

---

## 8. Critérios de aceitação

- [ ] SECRETARIO recebe 403 ao acessar (Camada 2 + 3).
- [ ] DISCIPULADOR e LIDER_MINISTERIO recebem 403.
- [ ] Período `inicio >= fim` retorna 400 com mensagem clara.
- [ ] Default é mês corrente quando sem search params.
- [ ] 3 KPIs renderizam com `formatBRLFromCents` (verde/vermelho/azul).
- [ ] Badge "Lucro" / "Déficit" / "Neutro" alterna conforme `resultadoLiquidoCentavos`.
- [ ] Lista "Entradas por Categoria" ordena por valor decrescente.
- [ ] Lista "Saídas por Categoria" ordena por valor decrescente.
- [ ] Drill-down em categoria gera `<Link>` para `/app/financeiro/lancamentos?categoria=X&periodo=...`.
- [ ] Mês vazio renderiza zeros + listas com "Nenhuma movimentação no período".
- [ ] Caixa arquivado: lançamentos **continuam** aparecendo (RN-REL-05).
- [ ] Cobertura de `getDRE` = 100%.
- [ ] Latência < 2s para 1 ano típico.
- [ ] `pnpm typecheck` passa.
- [ ] Lighthouse Accessibility ≥ 95.

---

## 9. Cross-module hints

- **`app/lib/relatorios.server.ts`:** adicionar função `getDRE` (S11 — backend).
- **`app/lib/relatorios-helpers.server.ts`:** adicionar `assertPeriodoValido` + `mapCategorias`.
- **Drill-down §5.4 (brief):** depende de rota `/app/financeiro/lancamentos` que ainda não existe. Decisão S13.

---

## 10. Notas de implementação

- **Soma sempre em `Int` cents** (RN-REL-03). Nunca `Float`.
- **Filtro semi-aberto `[gte, lt)`** (RN-REL-04). Nunca `lte`.
- **`Promise.all([entradas, saidas])`** para paralelizar 2 queries.
- **Soma em `Int` via `reduce`:** `entradas.reduce((acc, e) => acc + (e._sum.valorCentavos ?? 0), 0)`.
- **`mapCategorias`:** ordena por `totalCentavos` desc + calcula `percentual` arredondado para 2 casas.