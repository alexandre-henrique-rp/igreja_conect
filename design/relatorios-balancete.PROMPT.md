# Prompt — Balancete Mensal (ciclo 4)

> **Arquivo de rota:** `app/routes/app/financeiro.relatorios.balancete.tsx`
> **Page name:** `relatorios-balancete`
> **Sprint alvo:** S12 (Frontend) + S11 (Backend — `getBalanceteMensal`)
> **Design:** `design/relatorios-balancete.DESIGN.md`

---

## 1. Contexto

Balancete mensal — relatório que mostra o **saldo anterior, entradas, saídas e saldo atual** de um mês específico, mais uma tabela "Resumo por Categoria" detalhada. É o relatório usado para o conselho administrativo mensal.

- **Rota:** `/app/financeiro/relatorios/balancete`
- **RBAC:** 3 perfis (ADMIN/PASTOR/FINANCEIRO). SECRETARIO BLOQUEADO.
- **Brief:** `brief-relatorios.md` §4.1.2 + §4.2.3
- **PRD:** `PRD.html` §3.3 (US-REL-009 a 012)
- **SPEC:** `SPEC.html` §5.3 EP-002, §7.1.2 (`getBalanceteMensal`)
- **Design:** `design/relatorios-balancete.DESIGN.md`

---

## 2. Loader (defense in depth — camada 2)

```typescript
// app/routes/app/financeiro.relatorios.balancete.tsx
import type { Route } from "./+types/financeiro.relatorios.balancete";
import { z } from "zod";
import { assertCanSeeRelatorios } from "~/lib/rbac.server";
import { getBalanceteMensal } from "~/lib/relatorios.server";

const BalanceteSchema = z.object({
  ano: z.coerce.number().int().min(2000).max(2100).optional(),
  mes: z.coerce.number().int().min(1).max(12).optional(),
});

export async function loader({ context, request }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  // Camada 2: RBAC
  assertCanSeeRelatorios(user);

  // Parse + valida mês (default: mês corrente)
  const url = new URL(request.url);
  const parsed = BalanceteSchema.safeParse({
    ano: url.searchParams.get("ano") ?? undefined,
    mes: url.searchParams.get("mes") ?? undefined,
  });

  if (!parsed.success) {
    throw new Response(parsed.error.errors[0]?.message ?? "Mês inválido.", { status: 400 });
  }

  const hoje = new Date();
  const mesReferencia = {
    ano: parsed.data.ano ?? hoje.getFullYear(),
    mes: parsed.data.mes ?? (hoje.getMonth() + 1),
  };

  // Camada 3 (via service): assertCanSeeRelatorios + groupBy
  const balancete = await getBalanceteMensal(mesReferencia, user);

  return { user, balancete, mesReferencia };
}
```

**Notas:**
- Loader chama `assertCanSeeRelatorios` **antes** de qualquer I/O (Camada 2).
- Zod valida `ano` (2000-2100) e `mes` (1-12) → 400 se inválido.
- Default é mês corrente se sem search params.
- Service `getBalanceteMensal` revalida RBAC (Camada 3).

---

## 3. Componentes a criar/usar

### 3.1 Criar (novos no ciclo 4)

| Componente | Localização | Props |
|---|---|---|
| `<ResumoPorCategoria>` | `app/components/ResumoPorCategoria.tsx` | `{ items: Array<{ categoria, entradasCentavos, saidasCentavos, saldoCentavos }>; periodo: { ano, mes } }` (com drill-down) |
| `<DonutDistribuicaoSaidas>` | `app/components/DonutDistribuicaoSaidas.tsx` | `{ items: Array<{ categoria, totalCentavos, percentual }> }` |
| `<ProjectionPlaceholder>` | `app/components/ProjectionPlaceholder.tsx` | `{ titulo: string; mensagem: string }` |

### 3.2 Usar (existentes)

- `<ShellAutenticado>` (ciclo 1)
- `<PageHeader title="Balancete Mensal" backHref="/app/financeiro/relatorios" action={<BotaoImprimir />} />`
- `<KpiCard>` (ciclo 4) — 4 cards: Saldo Anterior (cinza), Entradas (verde + badge +12.5%), Saídas (vermelho + badge -4.2%), Saldo Atual (azul + ring lateral)
- `<IconKpiWallet>`, `<IconKpiArrowUp>`, `<IconKpiArrowDown>`, `<IconKpiBalance>`, `<IconPrint>`, `<IconEvent>`, `<IconHourglass>`
- `<Can user={user} allow={["ADMIN","PASTOR","FINANCEIRO"]}>`

---

## 4. Layout (Tailwind)

```tsx
export default function BalancetePage({ loaderData }: Route.ComponentProps) {
  const { user, balancete, mesReferencia } = loaderData;
  const mesFormatado = `${mesReferencia.ano}-${String(mesReferencia.mes).padStart(2, '0')}`;

  return (
    <ShellAutenticado user={user}>
      <PageHeader
        title="Balancete Mensal"
        backHref="/app/financeiro/relatorios"
        action={
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-700 text-white rounded-lg hover:bg-cyan-800"
          >
            <IconPrint className="w-4 h-4" />
            Imprimir Balancete
          </button>
        }
      />

      <Can user={user} allow={["ADMIN", "PASTOR", "FINANCEIRO"]}>
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          {/* Header com input month */}
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-4">
            <div>
              <label htmlFor="mes-referencia" className="block text-sm font-medium text-slate-700">
                Mês de Referência
              </label>
              <input
                id="mes-referencia"
                type="month"
                defaultValue={mesFormatado}
                className="mt-1 px-3 py-2 border border-slate-300 rounded-md"
                onChange={(e) => navigate(`?ano=${e.target.value.split('-')[0]}&mes=${e.target.value.split('-')[1]}`)}
              />
            </div>
          </div>

          {/* 4 KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <KpiCard
              titulo="Saldo Anterior"
              valor={formatBRLFromCents(balancete.kpis.saldoAnteriorCentavos)}
              cor="default"
              icone={<IconKpiWallet className="w-6 h-6" />}
            />
            <KpiCard
              titulo="Entradas"
              valor={formatBRLFromCents(balancete.kpis.totalEntradasCentavos)}
              cor="emerald"
              icone={<IconKpiArrowUp className="w-6 h-6" />}
              trend="+12.5%"
            />
            <KpiCard
              titulo="Saídas"
              valor={formatBRLFromCents(balancete.kpis.totalSaidasCentavos)}
              cor="red"
              icone={<IconKpiArrowDown className="w-6 h-6" />}
              trend="-4.2%"
            />
            <KpiCard
              titulo="Saldo Atual"
              valor={formatBRLFromCents(balancete.kpis.saldoAtualCentavos)}
              cor="blue"
              icone={<IconKpiBalance className="w-6 h-6" />}
              subtitulo="Saldo após movimentações do mês"
            />
          </div>

          {/* Grid 8+4: Tabela + Donut */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Resumo por Categoria</h2>
              {balancete.resumoPorCategoria.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma movimentação neste mês.</p>
              ) : (
                <ResumoPorCategoria
                  items={balancete.resumoPorCategoria}
                  periodo={mesReferencia}
                />
              )}
            </div>

            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Distribuição de Saídas</h2>
              <DonutDistribuicaoSaidas items={balancete.resumoPorCategoria.filter((r) => r.saidasCentavos > 0)} />
            </div>
          </div>

          {/* Placeholder Projeção (YAGNI) */}
          <ProjectionPlaceholder
            titulo="Projeção Próximo Mês"
            mensagem="Disponível em ciclo futuro — depende de módulo Contas a Pagar (RN-XYZ)."
          />
        </div>
      </Can>
    </ShellAutenticado>
  );
}
```

**Container:** `p-6 max-w-7xl mx-auto space-y-6`
**KPI grid:** `grid grid-cols-1 md:grid-cols-4 gap-6` (4 KPIs lado a lado em desktop)
**Grid 8+4:** `grid grid-cols-1 lg:grid-cols-12 gap-6` + `lg:col-span-8` + `lg:col-span-4`
**Placeholder:** `bg-slate-100 border border-slate-200 rounded-xl p-6`

---

## 5. Dados esperados (loaderData)

```typescript
type LoaderData = {
  user: SessionUser;
  mesReferencia: { ano: number; mes: number };
  balancete: {
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
};
```

---

## 6. Interatividade

| Elemento | Comportamento |
|---|---|
| `<input type="month">` | `onChange` → `navigate(?ano=YYYY&mes=MM)`. Loader re-busca. |
| Botão "Imprimir Balancete" | `onClick={() => window.print()}`. CSS print oculta sidebar/botões. |
| Linha da tabela "Resumo por Categoria" | `<Link to={`/app/financeiro/lancamentos?categoria=${item.categoria}&ano=${ano}&mes=${mes}`}>` (drill-down). |
| Botão "← Voltar" | Navega para `/app/financeiro/relatorios`. |

**Drill-down (PENDÊNCIA — brief §9.6 item #2):** mesma do DRE.

---

## 7. Tarefas granulares

- **T001:** Backend: implementar `getBalanceteMensal(mesReferencia, user)` em `app/lib/relatorios.server.ts`.
- **T002:** Backend: query 1: `aggregate saldoAnterior` (soma de todos os lançamentos anteriores a `firstDayOfMonth`).
- **T003:** Backend: query 2: `groupBy categoria` para entradas e saídas do mês.
- **T004:** Backend: query 3: `aggregate saldoAtual = saldoAnterior + entradas - saidas`.
- **T005:** Backend: testes unitários (mês cheio, mês vazio, mês de criação da igreja, RBAC).
- **T006:** Frontend: criar `app/routes/app/financeiro.relatorios.balancete.tsx` com loader + default export.
- **T007:** Frontend: criar `<ResumoPorCategoria>` (ordenado por `saldoCentavos` desc, com drill-down).
- **T008:** Frontend: criar `<DonutDistribuicaoSaidas>` (SVG inline com 3-5 fatias).
- **T009:** Frontend: criar `<ProjectionPlaceholder>` (cinza, ícone hourglass, texto explicativo).
- **T010:** Frontend: integrar botão "Imprimir" → `window.print()`.
- **T011:** Teste E2E: `e2e/relatorios-balancete-rbac.spec.ts` — login SECRETARIO → expect 403.
- **T012:** Teste E2E: `e2e/relatorios-balancete-mes.spec.ts` — login FINANCEIRO → muda mês → vê KPIs atualizados.

---

## 8. Critérios de aceitação

- [ ] SECRETARIO recebe 403 ao acessar (Camada 2 + 3).
- [ ] `ano` (2000-2100) e `mes` (1-12) validados por Zod → 400 se inválido.
- [ ] Default é mês corrente.
- [ ] 4 KPIs renderizam com `formatBRLFromCents`.
- [ ] KPI "Entradas" tem badge `+12.5%`, KPI "Saídas" tem badge `-4.2%`.
- [ ] Tabela "Resumo por Categoria" ordenada por `saldoCentavos` decrescente.
- [ ] Donut SVG inline renderiza 3-5 fatias com cores distintas.
- [ ] Placeholder "Projeção" renderiza cinza com texto explicativo (sem lógica).
- [ ] Botão "Imprimir" aciona `window.print()` (sem PDF real).
- [ ] CSS print mínimo oculta sidebar e botões.
- [ ] Drill-down em categoria navega para `/app/financeiro/lancamentos?categoria=X&ano=YYYY&mes=MM`.
- [ ] Mês de criação da igreja (sem histórico): `saldoAnteriorCentavos = 0`.
- [ ] Categoria sem movimento no mês: omitida da tabela.
- [ ] Cobertura de `getBalanceteMensal` = 100%.
- [ ] `pnpm typecheck` passa.

---

## 9. Cross-module hints

- **`app/lib/relatorios.server.ts`:** adicionar função `getBalanceteMensal` (S11 — backend).
- **`app/components/ProjectionPlaceholder`:** reusado também em `design/relatorios-fluxo-caixa.PROMPT.md`.
- **`@react-router` (`useNavigate`):** navegação programática para `?ano=...&mes=...`.
- **Drill-down §5.4 (brief):** mesma pendência do DRE.

---

## 10. Notas de implementação

- **CSS print mínimo:** adicionar regra em `app.css`:
  ```css
  @media print {
    aside, header button, .no-print { display: none !important; }
    main { padding: 0 !important; }
  }
  ```
- **Donut SVG inline:** viewBox `0 0 200 200`, fatias calculadas via `stroke-dasharray` em `<circle>` (não path). Ou usar `<path>` com arcos. Decisão do frontend agent.
- **Saldo Anterior = soma de TODOS os lançamentos anteriores** (`dataCompetencia < firstDayOfMonth`), não apenas caixas. Decisão de cálculo: `entradas - saidas` acumulado.