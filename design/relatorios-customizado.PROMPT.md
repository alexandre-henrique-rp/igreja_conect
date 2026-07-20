# Prompt — Relatório Customizado (ciclo 4)

> **Arquivo de rota:** `app/routes/app/financeiro.relatorios.customizado.tsx`
> **Page name:** `relatorios-customizado`
> **Sprint alvo:** S12 (Frontend) + S11 (Backend — `getRelatorioCustomizado` + `exportarLancamentosCSV`)
> **Design:** `design/relatorios-customizado.DESIGN.md`

---

## 1. Contexto

Relatório Customizado — ferramenta mais flexível do módulo. Permite aplicar **6 filtros** (período, tipo, categoria, membro, caixa, status) e gerar uma lista paginada de lançamentos consolidados. Inclui **export CSV** (RFC 4180 + BOM + UTF-8).

- **Rota:** `/app/financeiro/relatorios/customizado`
- **RBAC:** 3 perfis (ADMIN/PASTOR/FINANCEIRO). SECRETARIO BLOQUEADO.
- **Brief:** `brief-relatorios.md` §4.1.4 + §4.1.5 + §4.2.5
- **PRD:** `PRD.html` §3.5 (US-REL-017 a 021)
- **SPEC:** `SPEC.html` §5.5 EP-004, §5.6 EP-005, §7.2 (CSV helpers)
- **Design:** `design/relatorios-customizado.DESIGN.md`

---

## 2. Loader (defense in depth — camada 2) + Action (export CSV)

```typescript
// app/routes/app/financeiro.relatorios.customizado.tsx
import type { Route } from "./+types/financeiro.relatorios.customizado";
import { z } from "zod";
import { assertCanSeeRelatorios } from "~/lib/rbac.server";
import { getRelatorioCustomizado, exportarLancamentosCSV } from "~/lib/relatorios.server";

const FiltrosSchema = z.object({
  inicio: z.coerce.date().optional(),
  fim: z.coerce.date().optional(),
  tipo: z.enum(["ENTRADA", "SAIDA"]).optional(),
  categoria: z.enum(["DIZIMO", "OFERTA", "CAMPANHA", "DESPESA_OPERACIONAL", "COMPRA_ESTOQUE", "MANUTENCAO", "TRANSFERENCIA"]).optional(),
  membroId: z.string().uuid().optional(),
  caixaId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
}).strict();

export async function loader({ context, request }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  // Camada 2: RBAC
  assertCanSeeRelatorios(user);

  const url = new URL(request.url);

  // Se for export CSV, chama action
  if (url.searchParams.get("export") === "csv") {
    return await exportarLancamentosCSVAction(url, user);
  }

  // Parse + valida filtros (Zod strict)
  const parsed = FiltrosSchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    throw new Response(parsed.error.errors[0]?.message ?? "Filtros inválidos.", { status: 422 });
  }

  const filtros: RelatorioCustomizadoFiltros = {
    inicio: parsed.data.inicio,
    fim: parsed.data.fim,
    tipo: parsed.data.tipo,
    categoria: parsed.data.categoria,
    membroId: parsed.data.membroId,
    caixaId: parsed.data.caixaId,
    page: parsed.data.page ?? 1,
    pageSize: parsed.data.pageSize ?? 50,
  };

  // Camada 3 (via service): assertCanSeeRelatorios + findMany
  const data = await getRelatorioCustomizado(filtros, user);

  // Buscar opções para os selects (caixas, membros)
  const [caixas, membros] = await Promise.all([
    prisma.caixa.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.membro.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true }, take: 200 }),
  ]);

  return { user, data, filtros, caixas, membros };
}

async function exportarLancamentosCSVAction(url: URL, user: SessionUser) {
  const parsed = FiltrosSchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    throw new Response(parsed.error.errors[0]?.message ?? "Filtros inválidos.", { status: 422 });
  }

  const filtros: RelatorioCustomizadoFiltros = {
    inicio: parsed.data.inicio,
    fim: parsed.data.fim,
    tipo: parsed.data.tipo,
    categoria: parsed.data.categoria,
    membroId: parsed.data.membroId,
    caixaId: parsed.data.caixaId,
  };

  const csv = await exportarLancamentosCSV(filtros, user);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="igreja-conect-relatorio-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store", // LGPD
    },
  });
}
```

**Notas:**
- Loader chama `assertCanSeeRelatorios` **antes** de qualquer I/O (Camada 2).
- Zod strict rejeita campos extras (defesa contra prompt injection — SPEC §5.7).
- `?export=csv` → action inline que retorna `Response` com headers LGPD-compliant.
- Service `getRelatorioCustomizado` e `exportarLancamentosCSV` revalidam RBAC (Camada 3).

---

## 3. Componentes a criar/usar

### 3.1 Criar (novos no ciclo 4)

| Componente | Localização | Props |
|---|---|---|
| `<FiltrosCustomizado>` | `app/components/FiltrosCustomizado.tsx` | `{ value: Filtros; onChange; caixas; membros; categorias }` |
| `<LancamentosConsolidados>` | `app/components/LancamentosConsolidados.tsx` | `{ items: LancamentoListItem[]; page; pageSize; totalItens; totalPaginas }` |
| `<Paginacao>` | `app/components/Paginacao.tsx` | `{ page; totalPaginas; onChange }` |
| `<SaldoConsolidadoCard>` | `app/components/SaldoConsolidadoCard.tsx` | `{ saldoCentavos; entradasCentavos; saidasCentavos }` |

### 3.2 Usar (existentes)

- `<ShellAutenticado>` (ciclo 1)
- `<PageHeader title="Relatório Customizado" backHref="/app/financeiro/relatorios" action={<BotaoExportarCSV />} />`
- `<KpiCard>` (ciclo 4) — 3 cards: Entradas, Saídas, Saldo Consolidado.
- `<IconExport>`, `<IconFilter>`, `<IconPictureAsPdf>`, `<IconMail>` (placeholders para ações futuras)

---

## 4. Layout (Tailwind)

```tsx
export default function CustomizadoPage({ loaderData }: Route.ComponentProps) {
  const { user, data, filtros, caixas, membros } = loaderData;

  const csvUrl = `/app/financeiro/relatorios/customizado?export=csv&${new URLSearchParams(
    Object.entries(filtros).filter(([_, v]) => v != null).map(([k, v]) => [k, String(v)])
  )}`;

  return (
    <ShellAutenticado user={user}>
      <PageHeader
        title="Relatório Customizado"
        backHref="/app/financeiro/relatorios"
        action={
          <a
            href={csvUrl}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-700 text-white rounded-lg hover:bg-cyan-800"
            download
          >
            <IconExport className="w-4 h-4" />
            Exportar CSV
          </a>
        }
      />

      <Can user={user} allow={["ADMIN", "PASTOR", "FINANCEIRO"]}>
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          {/* Grid 8+4: Filtros + KPIs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Filtros Avançados</h2>
              <FiltrosCustomizado
                value={filtros}
                caixas={caixas}
                membros={membros}
                onChange={(novoFiltro) => navigate(`?${new URLSearchParams(...).toString()}`)}
              />
              <div className="mt-4 flex gap-2">
                <button type="submit" className="px-4 py-2 bg-cyan-700 text-white rounded-lg hover:bg-cyan-800">
                  Aplicar Filtros
                </button>
                <button type="reset" className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
                  Limpar
                </button>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-4">
              <KpiCard
                titulo="Total Entradas"
                valor={formatBRLFromCents(data.kpis.totalEntradasCentavos)}
                cor="emerald"
                icone={<IconKpiArrowUp className="w-6 h-6" />}
              />
              <KpiCard
                titulo="Total Saídas"
                valor={formatBRLFromCents(data.kpis.totalSaidasCentavos)}
                cor="red"
                icone={<IconKpiArrowDown className="w-6 h-6" />}
              />
              <KpiCard
                titulo="Saldo Consolidado"
                valor={formatBRLFromCents(data.kpis.saldoConsolidadoCentavos)}
                cor="blue"
                icone={<IconKpiBalance className="w-6 h-6" />}
              />
            </div>
          </div>

          {/* Tabela de Lançamentos Consolidados */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                Lançamentos Consolidados ({data.paginacao.totalItens} itens)
              </h2>
              <Paginacao page={data.paginacao.page} totalPaginas={data.paginacao.totalPaginas} onChange={(p) => navigate(`?${...}&page=${p}`)} />
            </div>

            {data.lancamentos.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-12">Nenhum lançamento encontrado com os filtros aplicados.</p>
            ) : (
              <LancamentosConsolidados items={data.lancamentos} />
            )}
          </div>

          {/* Footer: Saldo Consolidado + Ações Rápidas (placeholders) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SaldoConsolidadoCard
              saldoCentavos={data.kpis.saldoConsolidadoCentavos}
              entradasCentavos={data.kpis.totalEntradasCentavos}
              saidasCentavos={data.kpis.totalSaidasCentavos}
            />

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
              <h3 className="text-base font-semibold mb-3">Ações Rápidas</h3>
              <div className="space-y-2">
                <button disabled className="w-full inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-400 rounded-lg cursor-not-allowed text-sm">
                  <IconPictureAsPdf className="w-4 h-4" />
                  Imprimir PDF (em breve)
                </button>
                <button disabled className="w-full inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-400 rounded-lg cursor-not-allowed text-sm">
                  <IconMail className="w-4 h-4" />
                  Enviar por E-mail (em breve)
                </button>
                <button disabled className="w-full inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-400 rounded-lg cursor-not-allowed text-sm">
                  <IconEvent className="w-4 h-4" />
                  Agendar Relatório (em breve)
                </button>
              </div>
            </div>
          </div>
        </div>
      </Can>
    </ShellAutenticado>
  );
}
```

**Container:** `p-6 max-w-7xl mx-auto space-y-6`
**Grid 8+4 (filtros + KPIs):** `grid grid-cols-1 lg:grid-cols-12 gap-6` + `lg:col-span-8` + `lg:col-span-4`
**Tabela:** `bg-white border border-slate-200 rounded-xl p-6`
**Botões disabled:** `bg-slate-100 text-slate-400 cursor-not-allowed`

---

## 5. Dados esperados (loaderData)

```typescript
type LoaderData = {
  user: SessionUser;
  filtros: RelatorioCustomizadoFiltros;
  caixas: Array<{ id: string; nome: string }>;
  membros: Array<{ id: string; nome: string }>;
  data: {
    filtros: RelatorioCustomizadoFiltros;
    kpis: {
      totalEntradasCentavos: number;
      totalSaidasCentavos: number;
      saldoConsolidadoCentavos: number;
    };
    lancamentos: Array<{
      id: string;
      dataCompetencia: Date;
      descricao: string;
      categoria: CategoriaLancamento;
      tipo: 'ENTRADA' | 'SAIDA';
      caixa: { id: string; nome: string };
      membro: { id: string; nome: string } | null;
      valorCentavos: number;
      valorFormatado: string;
    }>;
    paginacao: { page: number; pageSize: number; totalItens: number; totalPaginas: number };
  };
};
```

---

## 6. Interatividade

| Elemento | Comportamento |
|---|---|
| Botão "Aplicar Filtros" | `<form method="GET">` com 6 inputs. Submete com `?inicio&fim&tipo&categoria&membroId&caixaId&page=1`. |
| Botão "Limpar" | `<button type="reset">` no form. |
| Botão "Exportar CSV" | `<a href="?export=csv&..." download>`. Action retorna `Response` com `text/csv`. |
| Click em linha da tabela | `<Link to={`/app/financeiro/lancamentos/${item.id}`}>` (drill-down). PENDÊNCIA — brief §9.6 item #2. |
| Botão "◀ Anterior" / "Próximo ▶" | `navigate(?...&page=N)`. |
| Filtro "Status" | **Disabled**. Sem ação (decisão §5.7). |
| Botões "Imprimir PDF" / "Enviar E-mail" / "Agendar" | **Disabled** (placeholders). |

---

## 7. Export CSV (RN-REL-06)

**Service:** `exportarLancamentosCSV(filtros, user)` em `app/lib/relatorios-csv.server.ts`.

**Output esperado:**
```
\uFEFFData;Descrição;Categoria;Tipo;Caixa;Valor (R$);Membro\r\n
2026-06-15;Dízimo mensal;OFERTA;ENTRADA;Caixa Geral;500.00;Maria Silva\r\n
2026-06-15;Dízimo ""Maria"" (recorrente);DIZIMO;ENTRADA;Caixa Geral;350.00;Maria Silva\r\n
```

**Regras (RAG `convention-relatorios-csv-export`):**
- BOM UTF-8 (`\uFEFF` ou bytes `EF BB BF`).
- Separador `;` (Excel pt-BR).
- CRLF (`\r\n`) entre linhas.
- Cabeçalho fixo: `Data;Descrição;Categoria;Tipo;Caixa;Valor (R$);Membro`.
- Valor numérico puro: `500.00` (sem `R$`, sem vírgula).
- SAÍDA com sinal negativo: `-100.00`.
- Escape RFC 4180: aspas duplas `"..."` ao redor do campo + aspas internas duplicadas `""`.
- Encoding: UTF-8.

**Response headers (LGPD):**
- `Content-Type: text/csv; charset=utf-8`
- `Content-Disposition: attachment; filename="igreja-conect-relatorio-YYYY-MM-DD.csv"`
- `Cache-Control: no-store`

**Performance:** 1.280 registros < 500ms (teste de borda 10 do brief §7.3).

---

## 8. Tarefas granulares

- **T001:** Backend: implementar `getRelatorioCustomizado(filtros, user)` em `app/lib/relatorios.server.ts`.
- **T002:** Backend: query `findMany` com `where` dinâmico (período, tipo, categoria, membroId, caixaId).
- **T003:** Backend: incluir `caixa` e `membro` via `include`.
- **T004:** Backend: paginação via `skip` + `take`.
- **T005:** Backend: calcular KPIs (soma de entradas, saídas, saldo).
- **T006:** Backend: implementar `exportarLancamentosCSV(filtros, user)` em `app/lib/relatorios-csv.server.ts`.
- **T007:** Backend: helpers `escapeCsvField`, `formatValorCsv`, `montarCabecalhoCsv`.
- **T008:** Backend: testes unitários para `escapeCsvField` (10 cenários: vírgula, aspas, CRLF, BOM, etc.).
- **T009:** Backend: testes de performance (1.280 registros < 500ms).
- **T010:** Frontend: criar `app/routes/app/financeiro.relatorios.customizado.tsx` com loader + default export.
- **T011:** Frontend: criar `<FiltrosCustomizado>` (6 selects + 2 inputs date + botão Aplicar/Limpar).
- **T012:** Frontend: criar `<LancamentosConsolidados>` (tabela com colunas Data/Descrição/Categoria/Tipo/Valor).
- **T013:** Frontend: criar `<Paginacao>` (◀ Anterior | páginas | Próximo ▶).
- **T014:** Frontend: integrar botão "Exportar CSV" como `<a href download>`.
- **T015:** Frontend: renderizar 3 KPIs (Entradas/Saídas/Saldo).
- **T016:** Frontend: filtro "Status" como `<select disabled>` com 4 opções placeholder.
- **T017:** Frontend: botões "Imprimir PDF" / "Enviar E-mail" / "Agendar" como `disabled`.
- **T018:** Teste E2E: `e2e/relatorios-customizado-rbac.spec.ts` — login SECRETARIO → expect 403.
- **T019:** Teste E2E: `e2e/relatorios-customizado-export-csv.spec.ts` — login FINANCEIRO → clica "Exportar CSV" → download com BOM + `;`.
- **T020:** Teste E2E: `e2e/relatorios-customizado-filtros.spec.ts` — login FINANCEIRO → aplica 6 filtros → vê tabela atualizada.
- **T021:** Teste E2E: `e2e/relatorios-customizado-status-disabled.spec.ts` — verifica que filtro Status é `<select disabled>`.

---

## 9. Critérios de aceitação

- [ ] SECRETARIO recebe 403 ao acessar (Camada 2 + 3).
- [ ] DISCIPULADOR e LIDER_MINISTERIO recebem 403.
- [ ] Zod valida 6 filtros strict → 422 se inválido.
- [ ] Filtro "Status" desabilitado com label "Em breve — depende de refactor de schema".
- [ ] 3 KPIs (Entradas, Saídas, Saldo Consolidado) renderizam com `formatBRLFromCents`.
- [ ] Tabela renderiza 50 lançamentos/página (configurável até 200).
- [ ] Paginação funcional via `?page=N`.
- [ ] Botão "Exportar CSV" gera download com BOM UTF-8 + separador `;`.
- [ ] Cabeçalho CSV: `Data;Descrição;Categoria;Tipo;Caixa;Valor (R$);Membro`.
- [ ] SAÍDA com sinal negativo (`-1234.56`).
- [ ] Escape RFC 4180 para aspas internas em descrição.
- [ ] CSV 1.280 registros < 500ms (teste de performance).
- [ ] `Cache-Control: no-store` em todas as respostas.
- [ ] 0 resultados: mensagem "Nenhum lançamento encontrado" + KPIs zerados.
- [ ] Caixa arquivado: lançamentos continuam (RN-REL-05).
- [ ] Cobertura de `getRelatorioCustomizado` e `exportarLancamentosCSV` = 100%.
- [ ] `pnpm typecheck` passa.
- [ ] Lighthouse Accessibility ≥ 95.

---

## 10. Cross-module hints

- **`app/lib/relatorios.server.ts`:** adicionar `getRelatorioCustomizado` (S11).
- **`app/lib/relatorios-csv.server.ts`:** novo arquivo (S11) com `exportarLancamentosCSV` + helpers.
- **Drill-down §5.4 (brief):** rota `/app/financeiro/lancamentos/:id` (detalhe) pode ser reusada do ciclo 2. PENDÊNCIA rota de listagem geral.
- **CSV §5.2 (brief):** PDF/Excel diferidos. Sem SMTP. Sem jobs.

---

## 11. Notas de implementação

- **`escapeCsvField`** (RFC 4180 §2.6):
  ```ts
  function escapeCsvField(value: string | null | undefined): string {
    if (value == null) return '';
    const str = String(value);
    if (str.includes('"') || str.includes(';') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
  ```
- **`formatValorCsv`** (centavos → "1234.56"):
  ```ts
  function formatValorCsv(centavos: number): string {
    const reais = centavos / 100;
    return reais.toFixed(2); // "1234.56" ou "-100.00"
  }
  ```
- **`montarCabecalhoCsv`**:
  ```ts
  function montarCabecalhoCsv(): string {
    return '\uFEFFData;Descrição;Categoria;Tipo;Caixa;Valor (R$);Membro\r\n';
  }
  ```
- **Camada 3 redundante:** mesmo com SECRETARIO bloqueado em Camada 2, `exportarLancamentosCSV` chama `assertCanSeeRelatorios` como 1ª linha (defesa em profundidade).
- **Performance:** `findMany` com `include` (caixa + membro). Para 1.280 registros, ~50ms. Cache desabilitado.