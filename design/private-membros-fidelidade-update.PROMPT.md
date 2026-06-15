# Atualizar Aba "Fidelidade Financeira" (`/app/membros/:id?tab=fidelidade`) — Frontend Implementation Prompt

## Capability grant

- **Paths de escrita:**
  - `app/components/TabFidelidadeFinanceira.tsx` (substituir placeholder)
  - `app/components/ResumoDizimos.tsx` (NOVO)
  - `app/components/TabelaDizimos.tsx` (NOVO)
  - `app/components/CardDizimo.tsx` (NOVO)
  - `app/routes/app/membros.$id.tsx` (estender loader para passar `dizimos` e `resumo` quando tab=fidelidade)
  - `app/lib/finance.server.ts` (estender `getDizimosByMembro` — adicionar paginação + resumo)
  - `app/lib/types.ts` (ou onde types são definidos) — adicionar `LancamentoResumo`, `ResumoDizimos`
- **Paths de leitura:** PRD, SPEC, AGENTS, ARCH, RAGs ciclo 2, schema.prisma, `app/lib/money.server.ts`, `app/lib/rbac.server.ts`, `design/private-membros-fidelidade-update.DESIGN.md`.
- **Boundary:** NÃO escrever `prisma.*` direto em `loader` (sempre via service). NÃO logar `valorCentavos` ou lista de dízimos (RAG `lgpd-igreja-conect`). NÃO renderizar aba para SECRETARIO/DISCIPULADOR/LIDER_MINISTERIO (3 camadas).

## Contexto

Substituir o placeholder do `TabFidelidadeFinanceira` (RN-MEM-03) por uma lista real de dízimos + card de resumo do mês e ano correntes. Esta é a **PARTE 2 da métrica macro do ciclo 2** (brief §7.1): FINANCEIRO lança dízimo → PASTOR vê na aba Fidelidade em < 2 min.

- **Design:** [`design/private-membros-fidelidade-update.DESIGN.md`](./private-membros-fidelidade-update.DESIGN.md)
- **PRD:** Apêndice D §D.3 (F6), §D.4 (DISCIPULADOR bypass URL → 403).
- **SPEC:** Apêndice D §D.5 (RBAC fina).
- **RAGs:**
  - `architecture-financeiro` §3.4 (fluxo completo).
  - `security-rbac-matrix` (`assertCanSeeFinancials`).
  - `pattern-3-layer-rbac` (3 camadas).
  - `lgpd-igreja-conect` (sem PII em log, dízimo é dado sensível).
  - `convention-monetary-values` (`formatBRLFromCents`).

## Tarefas

### T1. Estender `app/lib/finance.server.ts` com `getDizimosByMembro` (substituir placeholder)

- **Path:** `app/lib/finance.server.ts`
- **Substituir o placeholder** (que retorna `[]`) pela implementação completa.
- **Nova assinatura:** ver DESIGN §8.2 — `getDizimosByMembro(membroId, { page, pageSize }, user): Promise<{ items, total, page, pageSize, resumo }>`.
- **Implementação canônica** (ver DESIGN §8.2 — 4 queries em paralelo via `Promise.all`).
- **JSDoc completo** (substituir o JSDoc do placeholder).

```ts
export async function getDizimosByMembro(
  membroId: string,
  options: { page?: number; pageSize?: number } = {},
  user: SessionUser
): Promise<{
  items: LancamentoResumo[];
  total: number;
  page: number;
  pageSize: number;
  resumo: { mes: { totalCentavos: number; count: number }; ano: { totalCentavos: number; count: number } };
}> {
  // Camada 3 RBAC — PRIMEIRO
  assertCanSeeFinancials(user);

  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
  const firstDayOfNextYear = new Date(now.getFullYear() + 1, 0, 1);

  const where = { membroId, categoria: "DIZIMO" as const };
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 25;

  const [items, total, sumMes, countMes, sumAno, countAno] = await Promise.all([
    prisma.lancamento.findMany({
      where,
      orderBy: [{ dataCompetencia: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, dataCompetencia: true, valorCentavos: true, descricao: true, caixa: { select: { id: true, nome: true } } },
    }),
    prisma.lancamento.count({ where }),
    prisma.lancamento.aggregate({
      where: { ...where, dataCompetencia: { gte: firstDayOfMonth, lt: firstDayOfNextMonth } },
      _sum: { valorCentavos: true },
    }),
    prisma.lancamento.count({
      where: { ...where, dataCompetencia: { gte: firstDayOfMonth, lt: firstDayOfNextMonth } },
    }),
    prisma.lancamento.aggregate({
      where: { ...where, dataCompetencia: { gte: firstDayOfYear, lt: firstDayOfNextYear } },
      _sum: { valorCentavos: true },
    }),
    prisma.lancamento.count({
      where: { ...where, dataCompetencia: { gte: firstDayOfYear, lt: firstDayOfNextYear } },
    }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    resumo: {
      mes: { totalCentavos: sumMes._sum.valorCentavos ?? 0, count: countMes },
      ano: { totalCentavos: sumAno._sum.valorCentavos ?? 0, count: countAno },
    },
  };
}
```

- **Tipos:** adicionar `LancamentoResumo` e `ResumoDizimos` em `app/lib/types.ts` (ou exportar de `finance.server.ts`).

### T2. Atualizar `app/lib/rbac.server.ts` com `canSeeFinancials` (helper cliente-side)

- **Path:** `app/lib/rbac.server.ts` (estender)
- **Helper:** `canSeeFinancials(user): boolean` — **NÃO** lança. Usado no loader para fazer redirect (Camada 2) **antes** de chamar service.
- **Implementação:**
  ```ts
  /**
   * @description Verifica se user pode ver dados financeiros (sem throw).
   * Usado em loaders para decidir se redireciona ou renderiza.
   * NÃO substitui assertCanSeeFinancials (que lança — Camada 3).
   * @param {SessionUser} user
   * @returns {boolean} true se cargo ∈ {ADMIN, PASTOR, FINANCEIRO}.
   */
  export function canSeeFinancials(user: SessionUser): boolean {
    return user.cargo === "ADMIN" || user.cargo === "PASTOR" || user.cargo === "FINANCEIRO";
  }
  ```
- **Nota:** `assertCanSeeFinancials` (helper existente, Camada 3) lança. `canSeeFinancials` (novo, Camada 2) só retorna bool. **NÃO** remover o assert.

### T3. Criar `<ResumoDizimos>`

- **Path:** `app/components/ResumoDizimos.tsx`
- **Props:** `mes: { totalCentavos: number; count: number }`, `ano: { totalCentavos: number; count: number }`, `now?: Date` (para label "Mês atual").
- **Estrutura:**
  ```tsx
  export function ResumoDizimos({ mes, ano, now = new Date() }: ResumoDizimosProps) {
    const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(now);
    return (
      <section aria-labelledby="resumo-titulo" className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <h2 id="resumo-titulo" className="sr-only">Resumo de dízimos</h2>
        <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4" aria-label={`Dízimos no mês de ${monthName}: ${formatBRLFromCents(mes.totalCentavos)}, ${mes.count} dízimos`}>
          <h3 className="text-sm font-medium text-cyan-900 uppercase tracking-wide">Dízimos no Mês ({monthName})</h3>
          <p className="text-2xl font-bold text-cyan-700 mt-2" data-testid="resumo-mes-valor">{formatBRLFromCents(mes.totalCentavos)}</p>
          <p className="text-sm text-cyan-800 mt-1">{mes.count} {mes.count === 1 ? "dízimo" : "dízimos"}</p>
        </div>
        <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4" aria-label={`Dízimos no ano de ${now.getFullYear()}: ${formatBRLFromCents(ano.totalCentavos)}, ${ano.count} dízimos`}>
          <h3 className="text-sm font-medium text-cyan-900 uppercase tracking-wide">Dízimos no Ano ({now.getFullYear()})</h3>
          <p className="text-2xl font-bold text-cyan-700 mt-2" data-testid="resumo-ano-valor">{formatBRLFromCents(ano.totalCentavos)}</p>
          <p className="text-sm text-cyan-800 mt-1">{ano.count} {ano.count === 1 ? "dízimo" : "dízimos"}</p>
        </div>
      </section>
    );
  }
  ```

### T4. Criar `<TabelaDizimos>`

- **Path:** `app/components/TabelaDizimos.tsx`
- **Props:** `items: LancamentoResumo[]`.
- **Estrutura:**
  ```tsx
  export function TabelaDizimos({ items }: TabelaDizimosProps) {
    return (
      <div className="hidden md:block border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <caption className="sr-only">Histórico de dízimos</caption>
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
            <tr>
              <th scope="col" className="px-4 py-2">Data</th>
              <th scope="col" className="px-4 py-2 text-right">Valor (R$)</th>
              <th scope="col" className="px-4 py-2">Caixa</th>
              <th scope="col" className="px-4 py-2">Descrição</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map(d => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-600 text-sm">
                  <time dateTime={d.dataCompetencia.toISOString()}>{formatDate(d.dataCompetencia, "dd/MM/yyyy")}</time>
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-green-700">
                  +{formatBRLFromCents(d.valorCentavos)}
                </td>
                <td className="px-4 py-2 text-slate-700 text-sm">{d.caixa.nome}</td>
                <td className="px-4 py-2 text-slate-700 text-sm max-w-xs truncate" title={d.descricao}>
                  {d.descricao}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  ```

### T5. Criar `<CardDizimo>` (mobile)

- **Path:** `app/components/CardDizimo.tsx`
- **Props:** mesmas de `<TabelaDizimos>`.
- **Estrutura:** card com data, valor, caixa, descrição.

### T6. Atualizar `app/components/TabFidelidadeFinanceira.tsx` (substituir placeholder)

- **Path:** `app/components/TabFidelidadeFinanceira.tsx`
- **Substituir** o conteúdo do placeholder pela implementação real.
- **Props:** `dizimos: LancamentoResumo[]`, `resumo: ResumoDizimos`, `membroId: string`, `podeLancarDizimo: boolean` (true para ADMIN/PASTOR/FINANCEIRO).
- **Estrutura:**
  ```tsx
  import { ResumoDizimos } from "~/components/ResumoDizimos";
  import { TabelaDizimos } from "~/components/TabelaDizimos";
  import { CardDizimo } from "~/components/CardDizimo";
  import { EmptyState } from "~/components/EmptyState";
  import { Button } from "~/components/Button";
  import { Link } from "react-router";

  export function TabFidelidadeFinanceira({ dizimos, resumo, membroId, podeLancarDizimo }: TabFidelidadeFinanceiraProps) {
    return (
      <div role="region" data-testid="tab-fidelidade" className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Fidelidade Financeira</h2>
          {podeLancarDizimo && (
            <Button as={Link} to={`/app/financeiro/lancamentos/novo?membroId=${membroId}`} variant="primary" size="sm">
              + Lançar dízimo
            </Button>
          )}
        </div>

        <ResumoDizimos mes={resumo.mes} ano={resumo.ano} />

        {dizimos.length === 0 ? (
          <EmptyState
            title="Nenhum dízimo registrado"
            description="Lançamento é feito pelo Financeiro em /app/financeiro/lancamentos/novo."
          />
        ) : (
          <>
            <TabelaDizimos items={dizimos} />
            <CardDizimo items={dizimos} />
          </>
        )}
      </div>
    );
  }
  ```
- **Atualizar JSDoc** do componente.

### T7. Atualizar `app/routes/app/membros.$id.tsx` (estender loader)

- **Path:** `app/routes/app/membros.$id.tsx`
- **Modificar loader** para:
  1. Parse `tab` e `page` da URL.
  2. **Camada 2 RBAC:** se `tab === "fidelidade"` e `!canSeeFinancials(user)`, lançar `redirect("/app/membros/<id>?tab=dados")` (UX, não 403).
  3. Se `tab === "fidelidade"`, chamar `getDizimosByMembro(membroId, { page, pageSize: 25 }, user)` (Camada 3).
  4. Passar `dizimos`, `resumo`, `tab`, `page` para o componente.
- **Componente:** renderizar a aba correta baseado em `tab`.

```ts
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  const url = new URL(request.url);
  const tab = url.searchParams.get("tab") ?? "dados";
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);

  // Camada 2 RBAC: redirect se tab=fidelidade + cargo inválido
  if (tab === "fidelidade" && !canSeeFinancials(user)) {
    throw redirect(`/app/membros/${params.id}?tab=dados`);
  }

  const membro = await getMembroById(params.id, user);
  if (!membro) throw new Response("Membro não encontrado.", { status: 404 });

  let dizimos: LancamentoResumo[] = [];
  let resumo: ResumoDizimos | null = null;
  let total = 0;
  if (tab === "fidelidade") {
    const data = await getDizimosByMembro(params.id, { page, pageSize: 25 }, user);
    dizimos = data.items;
    resumo = data.resumo;
    total = data.total;
  }

  return { user, membro, dizimos, resumo, tab, page, total };
}
```

## Validações e regras

- **RBAC:** 3 camadas (UI `<Can>` + loader `canSeeFinancials` redirect + service `assertCanSeeFinancials` lança 403).
- **Filtro `categoria: "DIZIMO"`:** apenas dízimos (RN-FIN-05). OFERTAs não aparecem (mesmo se a OFERTA tem `membroId`).
- **Ordenação:** `dataCompetencia DESC + id ASC` (ordem determinística).
- **Resumo:** 4 queries em paralelo via `Promise.all` (perf).
- **`safeLog`:** `action: "view_dizimos"`, `resource: "membro:<id>"`, `userId`, `result: "ok"`. **Sem `valorCentavos` ou lista de dízimos no log.**

## Testes (TDD)

### T7.1. Unit (sem DB)

- `canSeeFinancials(adminUser)` → `true`.
- `canSeeFinancials(secretarioUser)` → `false` (SECRETARIO **não** vê dízimos).
- `canSeeFinancials(discipuladorUser)` → `false`.
- `canSeeFinancials(liderMinisterioUser)` → `false`.
- `getDizimosByMembro(...)` chama `assertCanSeeFinancials` como PRIMEIRA linha (já testado em ciclo 1).

### T7.2. Integração (com DB, `setupTestDb`)

- Setup: cria membro X. Cria 10 lançamentos DIZIMO (5 no mês corrente, 3 no ano anterior).
- `getDizimosByMembro(membroXId, { page: 1, pageSize: 25 }, adminUser)`:
  - Retorna 8 dízimos.
  - `resumo.mes = { totalCentavos: 25000, count: 5 }`.
  - `resumo.ano = { totalCentavos: 25000, count: 5 }` (todos no mesmo ano).
- `getDizimosByMembro(membroXId, { page: 1, pageSize: 3 }, adminUser)`:
  - Retorna 3 dízimos (paginação).
  - `total: 8`.
- `getDizimosByMembro(membroYId, {}, adminUser)` (sem dízimos):
  - `items: []`, `total: 0`, `resumo: { mes: { totalCentavos: 0, count: 0 }, ano: { ... } }`.
- `getDizimosByMembro(membroXId, {}, secretarioUser)`:
  - Lança `Response(403)`.
- `getDizimosByMembro(membroXId, {}, pastorUser)`:
  - OK.
- `getDizimosByMembro(membroXId, {}, financeiroUser)`:
  - OK.

### T7.3. E2E (Playwright) — atualizar `e2e/fidelidade-bypass.spec.ts`

- **Métrica macro (PARTE 2):**
  1. PASTOR loga → `/app/membros/<mariaId>?tab=fidelidade` → vê dízimos recém-lançados.
  2. Cards de resumo: mês atual R$ 50,00 (1 dízimo); ano 2026 R$ 50,00 (1 dízimo).
  3. Tabela mostra 1 linha.
- Login `admin@igreja.local` → `/app/membros/<id>?tab=fidelidade` → vê cards + tabela.
- Login `secretario@igreja.local` → `/app/membros/<id>?tab=fidelidade` → loader **redireciona** para `?tab=dados` (Camada 2). URL muda.
- Login `discipulador@igreja.local` → mesmo redirect.
- **Bypass programático (curl):** com cookie `sid=<secretarioSid>`, fetch `/app/membros/<id>?tab=fidelidade` → loader redireciona para `?tab=dados` (Camada 2). Se loader for bypassed, `getDizimosByMembro` lança 403 (Camada 3).
- Empty state: membro sem dízimos → "Nenhum dízimo registrado" + descrição.

## Critérios de pronto (Definition of Done — gate Phase 5)

- [ ] Cobertura de `getDizimosByMembro` ≥ 100% (gate RN-MEM-03).
- [ ] Cobertura global ≥ 85%.
- [ ] 12 testes de borda do brief §7.3 **todos verdes** (este design cobre 2: SECRETARIO bypass URL → 403; DISCIPULADOR bypass URL → 403).
- [ ] Métrica macro (brief §7.1) PARTE 2 verificada: PASTOR vê dízimo recém-lançado pelo FINANCEIRO.
- [ ] Loader redireciona para `?tab=dados` se cargo inválido (Camada 2 UX).
- [ ] `assertCanSeeFinancials` no service lança 403 (Camada 3 redundante).
- [ ] `where: { membroId, categoria: "DIZIMO" }` filtra apenas dízimos.
- [ ] Resumo do mês e ano corretos.
- [ ] Empty state amigável.
- [ ] `pnpm typecheck` passa.
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] Sem PII em log.
- [ ] JSDoc completo.

## Armadilhas comuns (RAGs)

- **RAG `lesson-route-service-bypass`:** NUNCA `prisma.*` direto em `loader`. SEMPRE via `getDizimosByMembro`.
- **RAG `pattern-3-layer-rbac`:** **3 camadas independentes**. Loader redirect (Camada 2, UX) **E** service 403 (Camada 3, segurança) **E** UI `<Can>` (Camada 1, esconde). Se loader for bypassed, service ainda barra.
- **RAG `lgpd-igreja-conect` §2.5:** `safeLog` com allowlist. Nunca `valorCentavos` ou lista de dízimos em log.
- **RAG `convention-monetary-values`:** `formatBRLFromCents` na UI; nunca `*Centavos` cru.
- **Erro comum:** loader lança `Response(403)` em vez de `redirect("/app/membros/<id>?tab=dados")`. Decisão: redirect é UX, não vaza informação; 403 seria técnico demais para um tab.
- **Erro comum:** `canSeeFinancials` (helper novo) **não substitui** `assertCanSeeFinancials` (helper existente). Ambos coexistem.
- **Erro comum:** `getDizimosByMembro` sem `Promise.all` (4 queries sequenciais = 4× latência). Paralelizar.
- **Erro comum:** `where: { membroId, categoria: "DIZIMO" }` esquecer `categoria: "DIZIMO"`. Sem o filtro, oferta vinculada a membro aparece.
- **Erro comum:** ordem `dataCompetencia DESC` sem `id ASC` como secundário. Resultado: ordem não-determinística para dízimos na mesma data.

## Próximos passos

- Implementação pelo `frontend` e `backend` agents na Fase 5 (Sprint 8 do ciclo 2).
- Auditoria mensal: tarefa do `lgpd-officer` revisar logs e confirmar ausência de PII.
- Backlog: auditoria de leitura (LGPD art. 37) — `AuditLog` table + hook em `getDizimosByMembro` para registrar "quem viu o quê".
