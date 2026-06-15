# Dashboard Financeiro (`/app/financeiro`) — Frontend Implementation Prompt

## Capability grant

- **Paths de escrita:**
  - `app/routes/app/financeiro._index.tsx`
  - `app/components/KpiSaldoTotal.tsx`
  - `app/components/CardSaldoCaixa.tsx`
  - `app/components/AtalhoFinanceiro.tsx` (ou reusa `<Atalho>` do ciclo 1)
  - `app/components/UltimasMovimentacoes.tsx`
  - `app/lib/finance.server.ts` (estender: `getDashboardFinanceiro`)
- **Paths de leitura:** PRD, SPEC, AGENTS, ARCH, RAGs ciclo 2, schema.prisma, `app/lib/rbac.server.ts`, `app/lib/money.server.ts`, `design/private-financeiro-index.DESIGN.md`.
- **Boundary:** NÃO escrever `prisma.*` direto em `loader` (usar service). NÃO criar migration (Fase 5 do backend agent gera). NÃO acessar `valorCentavos` em log (RAG `lgpd-igreja-conect` §2.5).

## Contexto

Página raiz do **Módulo Financeiro** (ciclo 2). Mostra saldos de caixas ativos, indicador agregado, atalhos rápidos e últimos 5 lançamentos (filtrados por RBAC para SECRETARIO).

- **Design:** [`design/private-financeiro-index.DESIGN.md`](./private-financeiro-index.DESIGN.md)
- **PRD:** Apêndice D §D.3 (F7 — Dashboard de saldos), §D.4 (critérios de aceitação).
- **SPEC:** Apêndice D §D.4 (`GET /app/financeiro`).
- **RAGs:**
  - `architecture-financeiro` §3.4 (Fidelidade transversal).
  - `security-rbac-matrix` (matriz + `assertCanSeeFinancials`).
  - `pattern-3-layer-rbac` (UI / loader / service).
  - `convention-monetary-values` (`formatBRLFromCents`).
  - `decision-caixa-soft-delete` (filtro `ativo: true`).
  - `lgpd-igreja-conect` §2.5 (sem `valorCentavos` em log).

## Tarefas

### T1. Estender `app/lib/finance.server.ts` com `getDashboardFinanceiro`

- **Função:** `async function getDashboardFinanceiro(user: SessionUser): Promise<DashboardFinanceiroData>`.
- **Camada 3 RBAC (PRIMEIRO):** `assertCanSeeFinancials(user)`.
- **Lógica:**
  - `caixas = prisma.caixa.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } })` + `countLancamentosMes(caixaId)` (agregado).
  - `ultimosLancamentos = prisma.lancamento.findMany({ orderBy: { dataCompetencia: "desc" }, take: 5, include: { caixa: { select: { id, nome } }, membro: { select: { id, nome } } } })`.
  - **Filtro RBAC para SECRETARIO:** se `user.cargo === "SECRETARIO"`, refazer query com `where: { categoria: { not: "DIZIMO" } }`.
  - `saldoAgregadoCentavos = SUM(saldoCentavos WHERE ativo = true)` via `prisma.caixa.aggregate({ where: { ativo: true }, _sum: { saldoCentavos: true } })`.
  - `totalCaixasAtivos = caixas.length`.
- **Tipos:** exportar `DashboardFinanceiroData`, `CaixaResumo`, `LancamentoResumo` (ver DESIGN §8.2).
- **JSDoc completo** (`@param`, `@returns`, `@throws`, `@example`).
- **Edge cases:**
  - 0 caixas: `saldoAgregadoCentavos = 0`, `caixas = []`.
  - 0 lançamentos: `ultimosLancamentos = []`.
  - Membro deletado (dízimo órfão): `membro = null` (SetNull já no schema). UI trata.

### T2. Criar `<KpiSaldoTotal>`

- **Path:** `app/components/KpiSaldoTotal.tsx`
- **Props:** `saldoCentavos: number`, `totalCaixas: number`.
- **Estrutura:**
  ```tsx
  <section aria-labelledby="kpi-titulo" className="bg-cyan-700 text-white rounded-lg p-6 mb-6">
    <h2 id="kpi-titulo" className="text-sm font-medium uppercase tracking-wide opacity-90">Saldo total</h2>
    <p className="text-3xl font-bold mt-2" data-testid="kpi-saldo-total">
      {formatBRLFromCents(saldoCentavos)}
    </p>
    <p className="text-sm opacity-90 mt-1">
      {totalCaixas} {totalCaixas === 1 ? "caixa ativo" : "caixas ativos"}
    </p>
  </section>
  ```

### T3. Criar `<CardSaldoCaixa>`

- **Path:** `app/components/CardSaldoCaixa.tsx`
- **Props:** `caixa: CaixaResumo`, `podeCriarLancamento: boolean` (true se cargo ∈ {ADMIN, PASTOR, FINANCEIRO, SECRETARIO}).
- **Estrutura:**
  ```tsx
  <article
    className={cn(
      "border rounded-lg p-4 bg-white",
      caixa.saldoCentavos < 1000 ? "border-amber-500" : "border-slate-200" // < R$ 10,00 = "saldo baixo"
    )}
    aria-label={`${caixa.nome}, saldo ${formatBRLFromCents(caixa.saldoCentavos)}, ${caixa.lancamentosMes} lançamentos este mês`}
  >
    <h3 className="text-base font-semibold text-slate-900">{caixa.nome}</h3>
    <p className="text-2xl font-bold text-cyan-700 mt-2" data-testid={`saldo-caixa-${caixa.id}`}>
      {formatBRLFromCents(caixa.saldoCentavos)}
    </p>
    <p className="text-sm text-slate-600 mt-1">
      {caixa.lancamentosMes} {caixa.lancamentosMes === 1 ? "lançamento" : "lançamentos"} este mês
    </p>
    <div className="flex gap-2 mt-4">
      <Button as={Link} to={`/app/financeiro/caixas/${caixa.id}`} variant="primary" size="sm">
        Ver extrato
      </Button>
      {podeCriarLancamento && (
        <Button as={Link} to={`/app/financeiro/lancamentos/novo?caixaId=${caixa.id}`} variant="secondary" size="sm">
          + Lançar
        </Button>
      )}
    </div>
  </article>
  ```

### T4. Criar `<AtalhoFinanceiro>`

- **Path:** `app/components/AtalhoFinanceiro.tsx` (ou reusa `<Atalho>` do ciclo 1 se já existir com props compatíveis).
- **Props:** `label: string`, `href: string`, `variant?: "primary" | "secondary"`.
- **Estrutura:**
  ```tsx
  <Button as={Link} to={href} variant={variant ?? "primary"} className="w-full sm:w-auto">
    {label}
  </Button>
  ```

### T5. Criar `<UltimasMovimentacoes>`

- **Path:** `app/components/UltimasMovimentacoes.tsx`
- **Props:** `items: LancamentoResumo[]`, `podeVerMembro: boolean` (false para SECRETARIO, true para ADMIN/PASTOR/FINANCEIRO).
- **Estrutura:**
  ```tsx
  <section aria-labelledby="ultimas-titulo" className="mt-6">
    <h2 id="ultimas-titulo" className="text-lg font-semibold text-slate-900 mb-3">
      Últimas movimentações
    </h2>
    {items.length === 0 ? (
      <EmptyState
        title="Nenhuma movimentação ainda"
        description="Lance o primeiro dízimo, oferta ou despesa para começar."
        action={
          <Button as={Link} to="/app/financeiro/lancamentos/novo" variant="primary">
            + Novo lançamento
          </Button>
        }
      />
    ) : (
      <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white">
        {items.map(item => (
          <li key={item.id} className="px-4 py-3 hover:bg-slate-50">
            <Link to={`/app/financeiro/caixas/${item.caixa.id}`} className="flex items-center gap-3 text-sm">
              <time className="text-slate-500 w-16" dateTime={item.dataCompetencia.toISOString()}>
                {formatDate(item.dataCompetencia, "dd/MM")}
              </time>
              <span className="text-slate-700 w-32 truncate">{item.caixa.nome}</span>
              <span className={cn(
                "font-mono font-medium tabular-nums w-20 text-right",
                item.tipo === "ENTRADA" ? "text-green-700" : "text-red-700"
              )}>
                {item.tipo === "ENTRADA" ? "+" : "-"} {formatBRLFromCents(item.valorCentavos)}
              </span>
              <span className="text-slate-700 truncate flex-1">
                {item.categoria === "DIZIMO" && item.membro
                  ? `Dízimo — ${item.membro.nome}`
                  : item.categoria === "OFERTA"
                    ? "Oferta"
                    : item.categoria === "TRANSFERENCIA"
                      ? `Transferência ${item.tipo === "ENTRADA" ? "recebida" : "enviada"}`
                      : item.descricao}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    )}
  </section>
  ```

### T6. Criar `app/routes/app/financeiro._index.tsx`

- **Path:** `app/routes/app/financeiro._index.tsx`
- **Loader:**
  ```ts
  import type { Route } from "./+types/financeiro._index";
  import { userContext } from "~/lib/user-context";
  import { assertCanSeeFinancials } from "~/lib/rbac.server";
  import { getDashboardFinanceiro } from "~/lib/finance.server";

  export async function loader({ context }: Route.LoaderArgs) {
    const user = context.get(userContext);
    assertCanSeeFinancials(user); // Camada 2 — antes de qualquer I/O
    const data = await getDashboardFinanceiro(user); // Camada 3 redundante
    return data;
  }
  ```
- **Default export (componente):**
  ```tsx
  import { useLoaderData } from "react-router";
  import { ShellAutenticado } from "~/components/ShellAutenticado";
  import { PageHeader } from "~/components/PageHeader";
  import { KpiSaldoTotal } from "~/components/KpiSaldoTotal";
  import { CardSaldoCaixa } from "~/components/CardSaldoCaixa";
  import { AtalhoFinanceiro } from "~/components/AtalhoFinanceiro";
  import { UltimasMovimentacoes } from "~/components/UltimasMovimentacoes";
  import { Can } from "~/components/Can";
  import { EmptyState } from "~/components/EmptyState";
  import { Button } from "~/components/Button";
  import { Link } from "react-router";

  export default function FinanceiroDashboard({ loaderData }: Route.ComponentProps) {
    const { caixas, ultimosLancamentos, saldoAgregadoCentavos, totalCaixasAtivos, user } = loaderData;
    const podeCriarLancamento = ["ADMIN", "PASTOR", "FINANCEIRO", "SECRETARIO"].includes(user.cargo);
    const podeCriarCaixa = ["ADMIN", "PASTOR", "FINANCEIRO"].includes(user.cargo);
    const podeVerMembro = ["ADMIN", "PASTOR", "FINANCEIRO"].includes(user.cargo);

    return (
      <ShellAutenticado>
        <PageHeader
          title="Financeiro"
          action={
            <Can user={user} allow={["ADMIN", "PASTOR", "FINANCEIRO"]}>
              <Button as={Link} to="/app/financeiro/caixas/novo" variant="secondary">+ Nova Caixa</Button>
            </Can>
          }
        />

        <KpiSaldoTotal saldoCentavos={saldoAgregadoCentavos} totalCaixas={totalCaixasAtivos} />

        {caixas.length === 0 ? (
          <EmptyState
            title="Nenhum caixa ativo"
            description="Reative um caixa arquivado ou crie um novo."
            action={
              podeCriarCaixa && (
                <Button as={Link} to="/app/financeiro/caixas/novo" variant="primary">+ Nova Caixa</Button>
              )
            }
          />
        ) : (
          <section aria-labelledby="caixas-titulo" className="mb-6">
            <h2 id="caixas-titulo" className="text-lg font-semibold text-slate-900 mb-3">
              Caixas ativos ({caixas.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {caixas.map(c => (
                <CardSaldoCaixa key={c.id} caixa={c} podeCriarLancamento={podeCriarLancamento} />
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="atalhos-titulo" className="mb-6">
          <h2 id="atalhos-titulo" className="text-lg font-semibold text-slate-900 mb-3">
            Atalhos rápidos
          </h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <AtalhoFinanceiro label="+ Novo Lançamento" href="/app/financeiro/lancamentos/novo" variant="primary" />
            <AtalhoFinanceiro label="+ Nova Transferência" href="/app/financeiro/transferencias/nova" variant="secondary" />
            <AtalhoFinanceiro label="⚙ Gerenciar Caixas" href="/app/financeiro/caixas" variant="secondary" />
          </div>
        </section>

        <UltimasMovimentacoes items={ultimosLancamentos} podeVerMembro={podeVerMembro} />
      </ShellAutenticado>
    );
  }
  ```
- **ErrorBoundary:** renderiza 403 se `assertCanSeeFinancials` lançar.

### T7. Adicionar item "Financeiro" à Sidebar (se ainda não existir)

- Editar `app/components/Sidebar.tsx` (ciclo 1) para incluir `<NavLink to="/app/financeiro">💰 Financeiro</NavLink>`.
- **Visibilidade condicional:** `<Can user={user} allow={["ADMIN", "PASTOR", "FINANCEIRO", "SECRETARIO"]}>`.

## Validações e regras

- **RBAC:** 3 camadas (loader `assertCanSeeFinancials` + service `assertCanSeeFinancials` + UI `<Can>`).
- **Filtro DIZIMO para SECRETARIO:** service filtra **automaticamente** baseado em `user.cargo`. UI **não** faz filtro próprio.
- **Caixas arquivados:** service filtra `where: { ativo: true }` por padrão.
- **Centavos:** `Int` em trânsito; `formatBRLFromCents` na exibição; nunca `Float`.

## Testes (TDD)

### T7.1. Unit (sem DB)

- `assertCanSeeFinancials(secretarioUser)` → **não lança**.
- `assertCanSeeFinancials(discipuladorUser)` → lança `Response(403)`.
- `assertCanSeeFinancials(adminUser)` → **não lança**.

### T7.2. Integração (com DB, `setupTestDb`)

- Setup: seed cria 1 caixa (Caixa Geral). Teste cria mais 2 caixas (Cantina, Missões). Cria 7 lançamentos variados.
- `getDashboardFinanceiro(adminUser)`:
  - Retorna 3 caixas.
  - `ultimosLancamentos` tem 5 itens (take: 5).
  - `saldoAgregadoCentavos` = soma correta.
- `getDashboardFinanceiro(secretarioUser)`:
  - `ultimosLancamentos` **não inclui DIZIMO**.
- `getDashboardFinanceiro(discipuladorUser)` → lança `Response(403)`.
- `getDashboardFinanceiro(adminUser)` com 0 caixas: retorna `caixas: []`, `saldoAgregadoCentavos: 0`.
- `getDashboardFinanceiro(adminUser)` com caixa `ativo: false`: `caixas` não inclui o arquivado.

### T7.3. E2E (Playwright) — `e2e/financeiro-dashboard.spec.ts`

- Login `financeiro@igreja.local` → `/app/financeiro` → vê 3 caixas com saldos BRL formatados.
- Verifica que "Últimas movimentações" lista 5 itens em ordem decrescente.
- Click em "Ver extrato" do primeiro caixa → navega para `/app/financeiro/caixas/<id>`.
- **Bypass test:** login `discipulador@igreja.local` → `/app/financeiro` direto na URL → **403** (loader barra).
- **SECRETARIO test:** login `secretario@igreja.local` → vê dashboard mas lista "Últimas movimentações" **não tem DIZIMO**.

## Critérios de pronto (Definition of Done — gate Phase 5)

- [ ] Cobertura de `getDashboardFinanceiro` ≥ 100% (gate RN-FIN-01).
- [ ] Cobertura global ≥ 85%.
- [ ] 12 testes de borda do brief §7.3 **todos verdes** (este design cobre 2: SECRETARIO sem DIZIMO; DISCIPULADOR 403).
- [ ] `pnpm typecheck` passa.
- [ ] `pnpm test` passa.
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] Sem `valorCentavos` em log (`safeLog` apenas).
- [ ] JSDoc completo em `getDashboardFinanceiro`.
- [ ] Defesa em 3 camadas comprovada (UI + loader + service).

## Armadilhas comuns (RAGs)

- **RAG `lesson-route-service-bypass`:** NUNCA `prisma.*` direto em `loader` — sempre passar por service (`getDashboardFinanceiro`).
- **RAG `pattern-3-layer-rbac`:** `assertCanSeeFinancials` no service (Camada 3) é **redundante** com o loader, mas é a única segurança real contra bypass.
- **RAG `convention-monetary-values`:** `Int` em centavos; `formatBRLFromCents` na UI; nunca `*Centavos` cru para o cliente.
- **RAG `lgpd-igreja-conect` §2.5:** `safeLog` com allowlist; nunca `valorCentavos` em log.
- **RAG `decision-caixa-soft-delete`:** filtro `where: { ativo: true }` é default; toggle "Mostrar arquivados" é opt-in.
- **Erro comum:** esquecer de filtrar DIZIMO para SECRETARIO no service (vazamento de RN-MEM-03).
- **Erro comum:** `loader` chama `assertCanSeeFinancials` **depois** de `prisma.*` (TOCTOU + ordem errada).
- **Erro comum:** `formatBRLFromCents` não é importado de `~/lib/money.server` — formato manual `R$ ${valor/100}` causa inconsistência.

## Próximos passos

- Implementar página de lista de caixas (`/app/financeiro/caixas`) — próximo design (`private-financeiro-caixas.DESIGN.md`).
- Implementar detalhe do caixa (`/app/financeiro/caixas/:id`) — `private-financeiro-caixas-detalhe.DESIGN.md`.
- Implementar form de novo lançamento — `private-financeiro-lancamento-novo.DESIGN.md`.
- Implementar form de nova transferência — `private-financeiro-transferencia-nova.DESIGN.md`.
- Atualizar aba Fidelidade Financeira no detalhe do membro — `private-membros-fidelidade-update.DESIGN.md`.
