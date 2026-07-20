# Design — Relatório Customizado (ciclo 4)

> **Rota:** `/app/financeiro/relatorios/customizado`
> **RBAC:** ADMIN, PASTOR, FINANCEIRO (SECRETARIO BLOQUEADO)
> **Stitch base:** `~/Downloads/stitch_igrejaconnect/relat_rio_customizado_igrejaconnect/code.html`
> **Cross-refs:** PRD §3.5 (US-REL-017 a 021), SPEC §5.5 EP-004 + §5.6 EP-005, brief §4.1.4 + §4.1.5 + §4.2.5

---

## 1. Contexto

Relatório Customizado — ferramenta mais flexível do módulo. Permite aplicar **6 filtros** (período, tipo, categoria, membro, caixa, status) e gerar uma lista paginada de lançamentos consolidados. Inclui **export CSV** (RFC 4180 + BOM + UTF-8).

**Persona-alvo:** Tesoureiro (FINANCEIRO) — auditoria ad-hoc, fechamento anual para assembleia. Administrador (ADMIN) — exportação para Excel.

**Caso de uso primário:** FINANCEIRO ajusta filtros (período Q1 2026, tipo SAIDA, categoria MANUTENÇÃO), clica "Aplicar Filtros", vê lista de 50 lançamentos/página, exporta CSV para abrir em Excel.

**Quem NÃO acessa:** SECRETARIO, DISCIPULADOR, LIDER_MINISTERIO (RN-REL-01, 3 camadas).

---

## 2. Layout (estrutura visual)

### 2.1 Desktop (≥ 1024px)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Topbar + Sidebar ("Relatórios" ativo)                               │
├────────────┬─────────────────────────────────────────────────────────┤
│ Sidebar    │ ← Voltar    Relatório Customizado    [📤 Exportar CSV]  │ ← h1 + ação
│            │                                                            │
│            │ ┌────────────────────────────────┐ ┌────────────────────┐│
│            │ │ Filtros Avançados              │ │ Total Entradas 🟢  ││ ← grid 8+4
│            │ │                                │ │ R$ 12.500,00       ││
│            │ │ Período: [Mês] [30d] [7d] [Ano]│ │                    ││
│            │ │ Início: [date] Fim: [date]     │ ├────────────────────┤│
│            │ │                                │ │ Total Saídas 🔴    ││
│            │ │ Tipo: [Todas ▼]                │ │ R$ 8.754,00        ││
│            │ │ Categoria: [Todas ▼]           │ │                    ││
│            │ │ Membro: [Todos ▼]              │ ├────────────────────┤│
│            │ │ Caixa: [Todos ▼]               │ │ Saldo Consolidado  ││
│            │ │ Status: [Em breve - disabled]  │ │ 🔵 R$ 3.746,00     ││
│            │ │                                │ │                    ││
│            │ │ [Aplicar Filtros] [Limpar]      │ └────────────────────┘│
│            │ └────────────────────────────────┘                        │
│            │                                                            │
│            │ ┌──────────────────────────────────────────────────────┐  │
│            │ │ Lançamentos Consolidados (1234 itens, pág 1/25)       │  │
│            │ │ ┌──────┬────────────┬──────────┬──────┬───────────┐  │  │
│            │ │ │ Data │ Descrição  │ Categoria│ Tipo │ Valor     │  │  │
│            │ │ ├──────┼────────────┼──────────┼──────┼───────────┤  │  │
│            │ │ │ 15/06│ Dízimo     │ DIZIMO   │ 🟢   │ R$ 350,00 │  │  │
│            │ │ │ 14/06│ Oferta     │ OFERTA   │ 🟢   │ R$ 100,00 │  │  │
│            │ │ │ 13/06│ Despesa op │ DESP_OP  │ 🔴   │ R$ 200,00 │  │  │
│            │ │ │ ...                                                │  │  │
│            │ │ └──────┴────────────┴──────────┴──────┴───────────┘  │  │
│            │ │ ◀ Anterior  [1] 2 3 ... 25  Próximo ▶                  │  │
│            │ └──────────────────────────────────────────────────────┘  │
│            │                                                            │
│            │ ┌────────────────────────────────────┐ ┌─────────────────┐│
│            │ │ Saldo Consolidado do Período 🔵    │ │ Ações Rápidas 🕐││ ← footer
│            │ │ "Resultado positivo de R$ 3.746,00" │ │ (placeholder)   ││
│            │ └────────────────────────────────────┘ │ - Imprimir PDF  ││
│            │                                          │ - Enviar E-mail ││
│            │                                          │ - Agendar       ││
│            │                                          └─────────────────┘│
└────────────┴─────────────────────────────────────────────────────────┘
```

### 2.2 Mobile (< 768px)

```
┌──────────────────────────────┐
│ ← Voltar    Customizado      │
│              [📤 Exportar]    │
├──────────────────────────────┤
│ Filtros Avançados            │
│ [Mês] [30d] [7d] [Ano]       │
│ Início: [date] Fim: [date]   │
│ Tipo: [Todas ▼]              │
│ Categoria: [Todas ▼]         │
│ Membro: [Todos ▼]            │
│ Caixa: [Todos ▼]             │
│ Status: [Em breve - disabled]│
│ [Aplicar] [Limpar]           │
│                              │
│ ┌──────────────────────────┐ │
│ │ Total Entradas 🟢        │ │
│ │ R$ 12.500,00             │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Total Saídas 🔴          │ │
│ │ R$ 8.754,00              │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Saldo Consolidado 🔵     │ │
│ │ R$ 3.746,00              │ │
│ └──────────────────────────┘ │
│                              │
│ Lançamentos (1234 itens)     │
│ ┌──────────────────────────┐ │
│ │ 15/06  Dízimo     🟢     │ │
│ │        R$ 350,00         │ │
│ ├──────────────────────────┤ │
│ │ 14/06  Oferta     🟢     │ │
│ │        R$ 100,00         │ │
│ ├──────────────────────────┤ │
│ │ 13/06  Despesa op 🔴     │ │
│ │        R$ 200,00         │ │
│ └──────────────────────────┘ │
│ ◀ Anterior  [1] 2 3 ▶       │
└──────────────────────────────┘
```

---

## 3. Componentes utilizados

| Componente | Fonte | Props | Localização |
|---|---|---|---|
| `<ShellAutenticado>` | shared | — | (já existe) |
| `<PageHeader>` | shared | `title`, `backHref`, `action?` | (já existe) |
| `<FiltrosCustomizado>` | novo (ciclo 4) | `value: RelatorioCustomizadoFiltros`, `onChange`, `caixasOptions`, `membrosOptions`, `categoriasOptions` | `app/components/FiltrosCustomizado.tsx` |
| `<KpiCard>` | novo (ciclo 4) | `titulo`, `valor`, `cor`, `icone` | (já existe) |
| `<LancamentosConsolidados>` | novo (ciclo 4) | `items: LancamentoListItem[]`, `page`, `pageSize`, `totalItens`, `totalPaginas` | `app/components/LancamentosConsolidados.tsx` |
| `<Paginacao>` | novo (ciclo 4) | `page`, `totalPaginas`, `onChange` | `app/components/Paginacao.tsx` |
| `<IconExport>`, `<IconFilter>`, `<IconCloudDownload>`, `<IconPictureAsPdf>`, `<IconMail>` | novo (ciclo 4) | — | `app/components/icons/FinanceIcons.tsx` |

---

## 4. Estados visuais

| Estado | Quando | Render |
|---|---|---|
| **Initial (com dados)** | Filtros default (mês corrente) | 2 KPIs + tabela paginada + saldo consolidado. |
| **0 resultados** | Filtros sem resultado | Mensagem "Nenhum lançamento encontrado" + KPIs zerados + saldo zerado. |
| **SECRETARIO / DISCIPULADOR / LIDER** | Bypass URL | **403** — ErrorBoundary. |
| **Loading** | Loader em 1ª carga | Skeleton: 2 retângulos (KPIs) + tabela `animate-pulse` + saldo. |
| **Error (400 / 422)** | Filtro inválido (ex: `categoria=BURRO`) | Mensagem inline no topo + manter filtros aplicados. |
| **Download CSV** | Click "Exportar CSV" | Download `igreja-conect-relatorio-YYYY-MM-DD.csv` (BOM UTF-8 + `;`). |
| **Filtro Status** | Click | Disabled — não clicável, label "Em breve — depende de refactor de schema". |

---

## 5. Interatividade

| Elemento | Evento | Comportamento |
|---|---|---|
| Botão "Aplicar Filtros" | Click | Re-submete form com search params: `?inicio&fim&tipo&categoria&membroId&caixaId&page=1`. Loader re-busca `getRelatorioCustomizado()`. |
| Botão "Limpar" | Click | Reseta form para valores default. |
| Botão "Exportar CSV" | Click | `<a href="?inicio=...&fim=...&export=csv&...">` (ou form method GET com `<button type="submit">`). Action do loader retorna `text/csv` com headers `Content-Disposition: attachment` + `Cache-Control: no-store`. |
| Botão "◀ Anterior" / "Próximo ▶" | Click | Navega para `?page=N+1` ou `?page=N-1`. |
| Click em linha da tabela | Click | Drill-down: `<Link>` para `/app/financeiro/lancamentos/:id` (PENDÊNCIA — ver `design/relatorios-hub.DESIGN.md` §8). |
| Botão "← Voltar" | Click | Navega para `/app/financeiro/relatorios`. |
| Filtro "Status" | Click | **Disabled**. Sem ação (decisão §5.7, YAGNI). |
| Botão "Imprimir PDF" | Click | **Placeholder** (botão desabilitado). PDF diferido (decisão §5.2). |
| Botão "Enviar E-mail" | Click | **Placeholder** (botão desabilitado). SMTP não configurado. |
| Botão "Agendar Relatório" | Click | **Placeholder** (botão desabilitado). Sem jobs. |

---

## 6. Filtros (6 dimensões)

| # | Filtro | Tipo | Default | Validação |
|---|---|---|---|---|
| 1 | **Período** | presets (7d/30d/Mês/Ano) + 2 `<input type="date">` | Mês corrente | `RelatorioPeriodoSchema` (inicio >= fim → 400) |
| 2 | **Tipo** | `<select>`: Todas / ENTRADA / SAIDA | "Todas" | `z.enum(["ENTRADA","SAIDA"]).optional()` |
| 3 | **Categoria** | `<select>`: Todas / 7 valores enum | "Todas" | `z.enum([...CategoriaLancamento]).optional()` |
| 4 | **Membro** | `<select>`: Todos / busca por nome | "Todos" | `z.string().uuid().optional()` |
| 5 | **Caixa** | `<select>`: Todos / 5 caixas seed + custom | "Todos" | `z.string().uuid().optional()` |
| 6 | **Status** | `<select disabled>`: placeholder | — | **Não implementado** (YAGNI) |

---

## 7. Export CSV (RN-REL-06)

**Service:** `exportarLancamentosCSV(filtros, user)` em `app/lib/relatorios-csv.server.ts`.

**Output:**
- BOM UTF-8 (`EF BB BF`) + cabeçalho `Data;Descrição;Categoria;Tipo;Caixa;Valor (R$);Membro` + linhas.
- Separador `;` (Excel pt-BR).
- CRLF (`\r\n`) entre linhas.
- Valor numérico puro (`1234.56`, sem `R$`).
- SAÍDA com sinal negativo (`-1234.56`).
- Escape RFC 4180: aspas duplas ao redor do campo + aspas internas duplicadas.

**Response headers:**
- `Content-Type: text/csv; charset=utf-8`
- `Content-Disposition: attachment; filename="igreja-conect-relatorio-YYYY-MM-DD.csv"`
- `Cache-Control: no-store` (LGPD).

**Performance:** 1.280 registros < 500ms (teste de borda 10 do brief §7.3).

---

## 8. RBAC (defesa em 3 camadas)

| Camada | Onde | Verifica | Falha → |
|---|---|---|---|
| **1 — UI** | `<Can allow={["ADMIN","PASTOR","FINANCEIRO"]}>` | Render condicional | SECRETARIO vê 403. |
| **2 — Loader/Action** | `assertCanSeeRelatorios(user)` + Zod `RelatorioCustomizadoFiltrosSchema` (`strict()`) | Lança `Response(403)` ou `Response(422)` | ErrorBoundary |
| **3 — Service** | `getRelatorioCustomizado()` e `exportarLancamentosCSV()` chamam `assertCanSeeRelatorios` | Mesmo helper | Lança `Response(403)` |

---

## 9. Dados (loader + service + action)

### 9.1 Loader

```ts
export async function loader({ context, request }: Route.LoaderArgs) {
  const user = context.get(userContext);
  assertCanSeeRelatorios(user);

  const url = new URL(request.url);
  if (url.searchParams.get('export') === 'csv') {
    // Action: export CSV
    return exportarLancamentosCSV(parseFiltros(url), user);
  }

  const filtros = parseFiltros(url); // Zod RelatorioCustomizadoFiltrosSchema
  const data = await getRelatorioCustomizado(filtros, user);
  return { user, ...data };
}
```

### 9.2 Service contracts

```ts
export async function getRelatorioCustomizado(
  filtros: RelatorioCustomizadoFiltros,
  user: SessionUser
): Promise<RelatorioCustomizadoData>;

export async function exportarLancamentosCSV(
  filtros: RelatorioCustomizadoFiltros,
  user: SessionUser
): Promise<Response>; // text/csv
```

**Tipos:**

```ts
type RelatorioCustomizadoFiltros = {
  inicio?: Date;
  fim?: Date;
  tipo?: 'ENTRADA' | 'SAIDA';
  categoria?: CategoriaLancamento;
  membroId?: string;
  caixaId?: string;
  page?: number; // default 1
  pageSize?: number; // default 50, max 200
};

type RelatorioCustomizadoData = {
  filtros: RelatorioCustomizadoFiltros;
  kpis: {
    totalEntradasCentavos: number;
    totalSaidasCentavos: number;
    saldoConsolidadoCentavos: number;
  };
  lancamentos: Array<LancamentoListItem>;
  paginacao: { page: number; pageSize: number; totalItens: number; totalPaginas: number };
};

type LancamentoListItem = {
  id: string;
  dataCompetencia: Date;
  descricao: string;
  categoria: CategoriaLancamento;
  tipo: 'ENTRADA' | 'SAIDA';
  caixa: { id: string; nome: string };
  membro: { id: string; nome: string } | null;
  valorCentavos: number;
  valorFormatado: string; // "350.00" ou "-100.00"
};
```

---

## 10. Cross-references

- **Brief:** `brief-relatorios.md` §4.1.4, §4.1.5, §4.2.5, §5.7 (status placeholder), §5.2 (CSV em vez de PDF).
- **PRD:** `PRD.html` §3.5 (US-REL-017 a 021), §4.3 LGPD.
- **SPEC:** `SPEC.html` §5.5 EP-004, §5.6 EP-005, §7.2 (CSV helpers), RN-REL-06.

---

## 11. Critérios de aceite (gate Phase 5)

- [ ] Loader chama `assertCanSeeRelatorios` antes de qualquer I/O.
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
- [ ] SECRETARIO recebe 403 ao acessar (Camada 2 + 3).
- [ ] Cobertura de `getRelatorioCustomizado()` e `exportarLancamentosCSV()` = 100%.
- [ ] `pnpm typecheck` passa.
- [ ] Lighthouse Accessibility ≥ 95.