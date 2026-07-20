# Prompt — Hub de Relatórios (ciclo 4)

> **Arquivo de rota:** `app/routes/app/financeiro.relatorios._index.tsx`
> **Page name:** `relatorios-hub`
> **Sprint alvo:** S12 (Frontend)
> **Design:** `design/relatorios-hub.DESIGN.md`

---

## 1. Contexto

Página-raiz do **módulo Relatórios Financeiros** (ciclo 4). É o "ponto de entrada" para 4 relatórios estruturados (DRE, Balancete, Fluxo de Caixa, Customizado) mais um bloco secundário "Relatório de Transparência 2024" (placeholder visual, sem ação).

- **Rota:** `/app/financeiro/relatorios`
- **RBAC:** 3 perfis (ADMIN/PASTOR/FINANCEIRO). SECRETARIO BLOQUEADO.
- **Brief:** `brief-relatorios.md` §4.2.1
- **PRD:** `PRD.html` §3.1 (US-REL-001 a 004)
- **SPEC:** `SPEC.html` §5.1 EP-001, §7.4 (assertCanSeeRelatorios)
- **Design:** `design/relatorios-hub.DESIGN.md`

---

## 2. Loader (defense in depth — camada 2)

```typescript
// app/routes/app/financeiro.relatorios._index.tsx
import type { Route } from "./+types/financeiro.relatorios._index";
import { assertCanSeeRelatorios } from "~/lib/rbac.server";
import { prisma } from "~/db/prisma.server";

export async function loader({ context, request }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  // Camada 2: RBAC
  assertCanSeeRelatorios(user); // 403 se SECRETARIO, DISCIPULADOR, LIDER_MINISTERIO

  // Loader leve: contagem de lançamentos no mês corrente para exibir "Última geração: há X dias"
  const hoje = new Date();
  const firstDayOfMonth = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const firstDayNextMonth = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);

  const totalLancamentosMes = await prisma.lancamento.count({
    where: {
      dataCompetencia: {
        gte: firstDayOfMonth,
        lt: firstDayNextMonth,
      },
    },
  });

  const ultimoLancamento = await prisma.lancamento.findFirst({
    orderBy: { dataCompetencia: "desc" },
    select: { dataCompetencia: true },
  });

  return {
    user,
    meta: {
      totalLancamentosMes,
      ultimoLancamento: ultimoLancamento?.dataCompetencia ?? null,
    },
  };
}
```

**Notas:**
- Loader chama `assertCanSeeRelatorios` **antes** de qualquer I/O (Camada 2).
- Se SECRETARIO digitar URL direto, recebe `Response(403)` → ErrorBoundary.
- Loader é leve (apenas `count` + `findFirst`) — não agrega valores.

---

## 3. Componentes a criar/usar

### 3.1 Criar (novos no ciclo 4)

| Componente | Localização | Props |
|---|---|---|
| `<RelatorioCard>` | `app/components/RelatorioCard.tsx` | `{ titulo: string; descricao: string; icone: React.ReactNode; cor: 'cyan' \| 'green' \| 'indigo' \| 'amber'; href: string }` |

**Estrutura de `<RelatorioCard>`:**
```tsx
export function RelatorioCard({ titulo, descricao, icone, cor, href }: RelatorioCardProps) {
  const corBg = { cyan: 'bg-cyan-50', green: 'bg-green-50', indigo: 'bg-indigo-50', amber: 'bg-amber-50' }[cor];
  const corIcone = { cyan: 'text-cyan-700', green: 'text-green-700', indigo: 'text-indigo-700', amber: 'text-amber-700' }[cor];
  return (
    <Link to={href} className={`block p-6 rounded-xl border border-slate-200 hover:shadow-md transition ${corBg}`}>
      <div className={`mb-3 ${corIcone}`}>{icone}</div>
      <h3 className="text-lg font-semibold text-slate-900">{titulo}</h3>
      <p className="text-sm text-slate-600 mt-1">{descricao}</p>
      <button className="mt-4 inline-flex items-center gap-2 text-cyan-700 font-medium text-sm">
        Gerar Relatório <IconChevronRight className="w-4 h-4" />
      </button>
    </Link>
  );
}
```

### 3.2 Usar (existentes)

- `<ShellAutenticado>` (ciclo 1)
- `<PageHeader title="Relatórios Financeiros" subtitle="Visão consolidada..." />`
- `<Can user={user} allow={["ADMIN","PASTOR","FINANCEIRO"]}>...</Can>`
- `<IconDRE>`, `<IconBalancete>`, `<IconFluxoCaixa>`, `<IconCustomizado>`, `<IconAutoAwesome>`, `<IconChevronRight>` (todos em `app/components/icons/FinanceIcons.tsx`)

---

## 4. Layout (Tailwind)

```tsx
export default function RelatoriosHub({ loaderData }: Route.ComponentProps) {
  const { user, meta } = loaderData;
  return (
    <ShellAutenticado user={user}>
      <PageHeader
        title="Relatórios Financeiros"
        subtitle="Visão consolidada para prestação de contas e auditoria"
      />

      <Can user={user} allow={["ADMIN", "PASTOR", "FINANCEIRO"]}>
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          {/* Grid 2×2 de cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <RelatorioCard
              titulo="DRE"
              descricao="Demonstração do Resultado do Exercício — entradas vs. saídas por categoria."
              icone={<IconDRE className="w-8 h-8" />}
              cor="cyan"
              href="/app/financeiro/relatorios/dre"
            />
            <RelatorioCard
              titulo="Balancete Mensal"
              descricao="Resumo mensal com saldo anterior, entradas, saídas e saldo atual."
              icone={<IconBalancete className="w-8 h-8" />}
              cor="green"
              href="/app/financeiro/relatorios/balancete"
            />
            <RelatorioCard
              titulo="Fluxo de Caixa"
              descricao="Histórico de entradas e saídas ao longo dos meses."
              icone={<IconFluxoCaixa className="w-8 h-8" />}
              cor="indigo"
              href="/app/financeiro/relatorios/fluxo-caixa"
            />
            <RelatorioCard
              titulo="Relatório Customizado"
              descricao="Filtros avançados + exportação CSV (Excel pt-BR)."
              icone={<IconCustomizado className="w-8 h-8" />}
              cor="amber"
              href="/app/financeiro/relatorios/customizado"
            />
          </div>

          {/* Bloco secundário: Relatório de Transparência 2024 (placeholder) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex items-start gap-4">
            <IconAutoAwesome className="w-10 h-10 text-cyan-700 flex-shrink-0" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-slate-900">Relatório de Transparência 2024</h2>
              <p className="text-sm text-slate-600 mt-1">
                Prestação de contas anual à assembleia. Disponível em ciclo futuro.
              </p>
              <button
                disabled
                className="mt-3 inline-flex items-center gap-2 text-slate-400 font-medium text-sm cursor-not-allowed"
              >
                Ver Demo (em breve)
              </button>
            </div>
          </div>

          {/* Meta info */}
          <p className="text-xs text-slate-500 text-center">
            {meta.totalLancamentosMes} lançamentos este mês
            {meta.ultimoLancamento && ` • Última atualização: ${formatDate(meta.ultimoLancamento)}`}
          </p>
        </div>
      </Can>
    </ShellAutenticado>
  );
}
```

**Container:** `p-6 max-w-7xl mx-auto space-y-6`
**Grid 2×2:** `grid grid-cols-1 md:grid-cols-2 gap-6`
**Cards:** `block p-6 rounded-xl border border-slate-200 hover:shadow-md transition`
**Bloco secundário:** `bg-slate-50 border border-slate-200 rounded-xl p-6`

---

## 5. Dados esperados (loaderData)

```typescript
type LoaderData = {
  user: SessionUser;
  meta: {
    totalLancamentosMes: number;
    ultimoLancamento: Date | null;
  };
};
```

**Validação Zod (opcional):** sem search params, mas se houver (futuro), validar via `RelatorioPeriodoSchema`.

---

## 6. Interatividade

| Elemento | Comportamento |
|---|---|
| Click em `<RelatorioCard>` | `<Link>` navega para `href` (DRE/Balancete/Fluxo/Customizado). React Router SSR navigation. |
| Hover em card | `hover:shadow-md transition` (CSS). |
| Click em "Ver Demo" do bloco secundário | **Disabled**. Sem ação (decisão §5.7). |
| Sidebar item "Relatórios" | Ativo (estilo `bg-cyan-50 text-cyan-700`). |

**Navegação por teclado:**
- Tab: card 1 → card 2 → card 3 → card 4 → bloco secundário → sidebar.

---

## 7. Tarefas granulares (para sprint-tasker)

- **T001:** Criar arquivo `app/components/RelatorioCard.tsx` com props `{ titulo, descricao, icone, cor, href }`.
- **T002:** Criar rota `app/routes/app/financeiro.relatorios._index.tsx` com loader + default export.
- **T003:** Implementar loader chamando `assertCanSeeRelatorios` + `count` de lançamentos do mês + `findFirst` último lançamento.
- **T004:** Renderizar 4 cards com `<RelatorioCard>` e ícones SVG.
- **T005:** Renderizar bloco "Transparência 2024" com botão disabled.
- **T006:** Atualizar `app/components/Sidebar.tsx` adicionando item "Relatórios" com `roles: ["ADMIN", "PASTOR", "FINANCEIRO"]`.
- **T007:** Criar ícones SVG `<IconDRE>`, `<IconBalancete>`, `<IconFluxoCaixa>`, `<IconCustomizado>`, `<IconAutoAwesome>` em `app/components/icons/FinanceIcons.tsx`.
- **T008:** Teste E2E: `e2e/relatorios-rbac-secretario-bloqueado.spec.ts` — login SECRETARIO → digita `/app/financeiro/relatorios` → expect 403.
- **T009:** Teste E2E: `e2e/relatorios-hub-cards.spec.ts` — login FINANCEIRO → vê 4 cards → clica em DRE → navega para `/dre`.
- **T010:** Unit test: loader retorna `meta.totalLancamentosMes` correto.

---

## 8. Critérios de aceitação

- [ ] SECRETARIO recebe 403 ao acessar `/app/financeiro/relatorios` (Camada 2 + 3).
- [ ] SECRETARIO NÃO vê item "Relatórios" no `Sidebar.tsx` (Camada 1).
- [ ] DISCIPULADOR e LIDER_MINISTERIO recebem 403 ao acessar.
- [ ] ADMIN, PASTOR, FINANCEIRO vêem 4 cards com ícones coloridos.
- [ ] Click em card navega para sub-rota correta.
- [ ] Bloco "Transparência 2024" renderiza com botão disabled.
- [ ] Meta info (total de lançamentos + última atualização) renderiza no rodapé.
- [ ] Hover em card aplica `hover:shadow-md`.
- [ ] Navegação por teclado funcional (Tab ordem: card 1 → card 4 → bloco → sidebar).
- [ ] Cobertura do loader ≥ 100%.
- [ ] `pnpm typecheck` passa.
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] Sem dado sensível em log (`safeLog`).

---

## 9. Cross-module hints

- **Sidebar.tsx (ciclo 1):** adicionar item "Relatórios" **após** item "Financeiro" com `roles: ["ADMIN", "PASTOR", "FINANCEIRO"]`. SECRETARIO NÃO vê.
- **RAG `pattern-3-layer-rbac`:** Camada 1 (Sidebar esconde), Camada 2 (loader 403), Camada 3 (helper revalida).
- **Sem drill-down** nesta página (apenas navegação para sub-rotas).

---

## 10. Notas de implementação

- **Não criar migration** — schema atual cobre 100% (apenas leitura).
- **Não criar dependência nova** — ícones SVG inline (`app/components/icons/FinanceIcons.tsx`).
- **Não criar action** — Hub é read-only puro.
- **Pendência §8 do DESIGN.md (drill-down de relatórios):** não afeta esta página. Drill-down é nas sub-rotas.
- **Ordem do menu lateral:** item "Relatórios" fica após "Financeiro" (Ciclo 2) e antes de "Ministérios" (ciclo 1).