# Brief — Igreja Conect — Ciclo 4: Relatórios Financeiros

> **Escopo deste brief:** Módulo de **Relatórios Financeiros** (ciclo 4 do Harness v6).
> **Data:** 2026-06-20.
> **Autor:** `harness-briefing` agent (Fase 0, ciclo 4, attempt 2).
> **Estado:** aguardando `user-approval` para iniciar Fase 1 (Documentação).
> **Versão:** 1.0 (ciclo 4).
> **Cross-refs principais:**
> - [`brief-mvp-financeiro.md`](./brief-mvp-financeiro.md) — ciclo 2 (módulo Financeiro: Caixas + Lançamentos + Transferências + Fidelidade). **Este brief depende daquele.**
> - [`brief-mvp.md`](./brief-mvp.md) — ciclo 1 (MVP: Auth + Membros + Discipulado + Alertas).
> - State.json: `cycle4.scope = "Relatórios Financeiros (Hub + DRE + Balancete + Fluxo de Caixa + Customizado)"`.

---

## 1. Contexto e propósito do ciclo

O **ciclo 2 do Harness v6** (S06–S08) entregou o **Módulo Financeiro** operacional: CRUD de Caixas, CRUD de Lançamentos (com trava de saldo service-side — RN-FIN-04), transferências atômicas (RN-FIN-02), aba "Fidelidade Financeira" (RN-MEM-03) e dashboard de saldos. O schema Prisma já contém `Caixa`, `TransferenciaCaixa`, `Lancamento` (com `Int` em centavos e 7 valores em `CategoriaLancamento`), e a matriz RBAC já está consolidada em 4 perfis financeiros (`FINANCIAL_MODULE_CARGOS`) e 3 perfis restritos a dízimos (`DIZIMO_CARGOS`). **O ciclo 2 entrou em produção com 1.115 testes passando, gate `all-of` aprovado em 2026-06-19, release `v0.2.0-financeiro-preview`.**

O **ciclo 3** (Estoque + Patrimônio) está com planning completo e build deferred. O **ciclo 4** volta ao módulo Financeiro, mas agora **na camada de inteligência**: o que os ciclos 1 e 2 **não entregaram** é a leitura consolidada, comparativa e auditável dos lançamentos. Hoje o `FINANCEIRO` consegue lançar um dízimo em < 2 min, mas para responder "qual foi o resultado líquido de outubro?" ou "quanto entrou de dízimo vs. oferta nos últimos 6 meses?", ele precisa baixar planilha e calcular manualmente.

**O propósito do ciclo 4** é entregar **5 relatórios financeiros estruturados** que transformam o repositório bruto de `Lancamento` em inteligência pastoral/tesouraria, **sem alterar schema, sem adicionar funcionalidades não-ditas e sem dependências externas novas**. As 5 regras de negócio já existentes (`RN-FIN-01` a `RN-FIN-05`) são suficientes — este ciclo **lê** o que já foi escrito.

### 1.1 O que este ciclo NÃO faz

- ❌ Não cria novos models Prisma (`ContaPagar`, `ProjecaoFinanceira`, `Orcamento`, `StatusLancamento`, etc.).
- ❌ Não altera a trava de saldo nem a RN-FIN-04.
- ❌ Não cria novos perfis RBAC nem expande a matriz para incluir SECRETARIO em relatórios.
- ❌ Não depende de módulo Contas a Pagar nem de dados externos.
- ❌ Não implementa PDF (decisão §5.2 — diferido).
- ❌ Não implementa projeção real (decisão §5.6 — placeholder visual).

### 1.2 O que este ciclo FAZ

- ✅ Adiciona 5 páginas de leitura agregada em `/app/financeiro/relatorios/**`.
- ✅ Adiciona 5 services de agregação em `app/lib/relatorios.server.ts`.
- ✅ Adiciona 1 service de exportação CSV em `app/lib/relatorios-csv.server.ts`.
- ✅ Adiciona 2 componentes compartilhados: `<FiltrosPeriodo />` e `<KpiCard />`.
- ✅ Atualiza `app/components/Sidebar.tsx` com item "Relatórios" visível a 3 perfis.
- ✅ Adiciona 2 helpers RBAC em `app/lib/rbac.server.ts`: `RELATORIOS_CARGOS` + `assertCanSeeRelatorios`.
- ✅ Adiciona ~25 ícones SVG em `app/components/icons/FinanceIcons.tsx` (substituindo Material Symbols dos HTMLs do Stitch).

---

## 2. Problema e oportunidade

### 2.1 Problema

Hoje a igreja tem o **registro bruto** (Lançamentos), mas **não tem inteligência estruturada** sobre esses dados. Isso gera **5 riscos concretos** que afetam governança, transparência, conformidade legal e operação pastoral:

1. **Risco de governança — Déficit de prestação de contas.** Sem DRE nem Balancete mensais gerados pelo sistema, o conselho e a assembleia recebem números em formato aberto (planilha, quadro, mensagem de WhatsApp). Não há como auditar a memória institucional: "qual era o saldo do Caixa Missões em maio/2025?". Resposta: "não sei, o anterior anotou em um caderno que se perdeu."

2. **Risco pastoral — Falta de visão de tendência.** O pastor precisa aconselhar famílias com base em padrões (aumentou/diminuiu o dízimo? a despesa com manutenção está subindo?). Hoje ele precisa inferir manualmente. Sem Fluxo de Caixa temporal, ele não tem como dar direção estratégica.

3. **Risco de compliance LGPD — Falta de evidência de segregação.** A LGPD (Art. 46) exige que o controlador comprove medidas técnicas de proteção. Sem relatórios que diferenciem **quem pode ver o quê** (Fidelidade Financeira restrita a 3 perfis, demais relatórios a 4), o DPO não tem como atestar segregação funcional de acessos em auditoria.

4. **Risco operacional — Falta de drill-down.** Quando o tesoureiro recebe uma pergunta ("esse valor de Manutenção em outubro é recorrente?"), ele precisa abrir cada lançamento individual e reconstruir o contexto na cabeça. Sem filtro estruturado por categoria + período, a consulta manual consome 5–10 min por pergunta.

5. **Risco de transparência pública — Sem Relatório Anual.** A igreja se compromete (segundo o Stitch `hub_de_relatorios_igrejaconnect/code.html:213` "Relatório de Transparência 2024") com prestação de contas anual à assembleia. Hoje, gerar esse documento requer exportar 12 planilhas e remontar à mão.

### 2.2 Oportunidade

**Toda a infraestrutura necessária já existe**, criada nos ciclos 1–2:

- ✅ **Schema Prisma completo:** `Lancamento`, `Caixa`, `TransferenciaCaixa`, `Membro`, enums `TipoLancamento` e `CategoriaLancamento` — **100% dos requisitos de relatórios são atendidos sem migration**.
- ✅ **Services financeiros maduros:** `getDashboardFinanceiro`, `assertSaldoSuficiente`, `getDizimosByMembro` já implementam agregações e RBAC fina. Os novos services de relatório podem **reutilizar e estender** esse padrão.
- ✅ **Matriz RBAC estável:** 4 perfis `FINANCIAL_MODULE_CARGOS` + 3 perfis `DIZIMO_CARGOS` + helper `canSeeFinancials` + helper `assertCanSeeFinancialModule`. Estender para relatórios é trivial: nova constante `RELATORIOS_CARGOS = ["ADMIN", "PASTOR", "FINANCEIRO"]` (SECRETARIO **bloqueado** — decisão §5.3).
- ✅ **Helpers monetários prontos:** `formatBRLFromCents`, `parseBRLToCents`, `assertNonNegative` — não há decisão de modelagem monetária a tomar.
- ✅ **Componentes UI base:** `CardSaldoCaixa`, `KpiCard`-like, `<Can>` wrapper, `Sidebar.tsx`, `TopbarAutenticada.tsx` — todos já seguem Tailwind 4 + Geist. O ciclo 4 não precisa inventar sistema de design.
- ✅ **Defesa em 3 camadas:** UI / loader / service já é o padrão. Os novos relatórios apenas seguem a regra.

**Custo estimado do ciclo:** 2 sprints (S11, S12), mais 1 sprint condicional (S13) se o drill-down exigir criar `/app/financeiro/lancamentos` (a verificar na Fase 3 — Design).

### 2.3 Restrições herdadas (dos ciclos 1–3, imutáveis)

- **Stack:** React Router 7.16 SSR + Prisma 7.8 + SQLite + Tailwind 4 + Vite 8 + TypeScript 5.9 strict.
- **Monólito modular, sem microsserviço.** Sem Redis, sem message broker, sem upload S3, sem gateway de pagamento.
- **Defesa em profundidade em 3 camadas** (UI → loader → service) — qualquer rota de relatório aplica `assertCanSeeRelatorios` (Camada 2) e cada service de agregação revalida via helper (Camada 3).
- **Valores monetários são `Int` em centavos** com sufixo `Centavos`. Toda exibição passa por `formatBRLFromCents`. Toda agregação opera em cents (soma em `Int` evita `0.1 + 0.2 !== 0.3`).
- **LGPD:** `valorCentavos` é dado financeiro e **não pode aparecer em log de auditoria**. Relatórios devem ser gerados **sob demanda** (não cachear dados financeiros sensíveis em localStorage/cookies).
- **Datas em `dataCompetencia: DateTime`** — agregações mensais filtram por `gte`/`lt` no mesmo dia, considerando fuso do servidor (já documentado em `brief-mvp-financeiro.md §2.3`).

---

## 3. Usuários primários (personas RBAC)

A matriz RBAC do ciclo 4 **endurece** o que o ciclo 2 definiu: SECRETARIO, mesmo podendo ver o módulo financeiro, **NÃO tem acesso aos relatórios estruturados**. Essa é decisão de produto confirmada no discovery (ver §5.3).

| Persona | Perfil RBAC | Acesso a Relatórios | Justificativa |
|---------|-------------|---------------------|---------------|
| **Tesoureiro(a)** | `FINANCEIRO` | ✅ Todos os 5 relatórios + exportação CSV | Operador que precisa de visão consolidada para fechamento mensal e prestação de contas ao pastor. |
| **Pastor** | `PASTOR` | ✅ Todos os 5 relatórios + exportação CSV | Visão pastoral estratégica; precisa de DRE para aconselhamento e Balancete para conselho. |
| **Administrador** | `ADMIN` | ✅ Todos os 5 relatórios + exportação CSV | Configura regras, audita operações, gera relatórios anuais para assembleia. |
| **Secretário(a)** | `SECRETARIO` | 🚫 **BLOQUEADO em todas as rotas** `/app/financeiro/relatorios/**` | Tem acesso ao módulo financeiro operacional (caixas, lançamentos), mas o produto define que relatórios estruturados são decisão pastoral-administrativa. Bloqueio de Camada 2 (loader) + Camada 3 (helper). |
| **Discipulador** | `DISCIPULADOR` | 🚫 **BLOQUEADO** | RN-MEM-03: nunca toca dados financeiros. |
| **Líder de Ministério** | `LIDER_MINISTERIO` | 🚫 **BLOQUEADO** | RN-MEM-03: nunca toca dados financeiros. |

### 3.1 Observação sobre SECRETARIO

A decisão de **bloquear SECRETARIO** dos relatórios estruturados (não apenas dos dízimos individuais, como já fazia o ciclo 2) é **regra de produto**, não falha de segurança. Justificativas registradas no discovery (decisão §5.3):

1. **Princípio da necessidade (LGPD Art. 6°, III):** relatórios consolidados (DRE, Balancete) revelam tendências financeiras agregadas. SECRETARIO não precisa dessa visão para sua função operacional.
2. **Decisão eclesiástica:** prestação de contas ao conselho é responsabilidade pastoral (PASTOR) e tesouraria (FINANCEIRO). SECRETARIO opera dentro dos caixas existentes, não responde pela governança.
3. **Defesa em profundidade:** a Camada 2 (loader) chama `assertCanSeeRelatorios(user)` que lança `Response(403)`. O item "Relatórios" some do menu lateral para SECRETARIO (Camada 1).

A matriz RBAC fina é **testada em E2E** com Playwright (ver §7.3).

---

## 4. Escopo do ciclo 4 — Entregáveis

**8 entregáveis planejados**, agrupados em 3 categorias: services de agregação, rotas (UI + loader), e componentes compartilhados.

### 4.1 Service de agregação — `app/lib/relatorios.server.ts`

**5 funções públicas**, todas com Camada 3 (RBAC) obrigatória:

#### 4.1.1 `getDRE(periodo: { inicio: Date; fim: Date }, user: SessionUser): Promise<DREData>`

- **Quem chama:** loader de `/app/financeiro/relatorios/dre`.
- **RBAC:** `assertCanSeeRelatorios(user)` como primeira linha.
- **Query Prisma:** `prisma.lancamento.groupBy({ by: ['categoria'], where: { dataCompetencia: { gte: inicio, lt: fim } }, _sum: { valorCentavos: true }, _count: { _all: true } })` + agregação separada por `tipo` (ENTRADA / SAIDA).
- **Saída:**
  ```ts
  type DREData = {
    periodo: { inicio: Date; fim: Date };
    totalEntradasCentavos: number;
    totalSaidasCentavos: number;
    resultadoLiquidoCentavos: number;
    entradasPorCategoria: Array<{ categoria: CategoriaLancamento; totalCentavos: number; transacoes: number; percentual: number }>;
    saidasPorCategoria: Array<{ categoria: CategoriaLancamento; totalCentavos: number; transacoes: number; percentual: number }>;
  };
  ```
- **Edge cases:** `periodo` sem lançamentos → `{ totalEntradasCentavos: 0, totalSaidasCentavos: 0, resultadoLiquidoCentavos: 0, entradasPorCategoria: [], saidasPorCategoria: [] }`. Sem null/undefined.

#### 4.1.2 `getBalanceteMensal(mesReferencia: { ano: number; mes: number }, user: SessionUser): Promise<BalanceteData>`

- **Quem chama:** loader de `/app/financeiro/relatorios/balancete`.
- **RBAC:** `assertCanSeeRelatorios(user)`.
- **Query Prisma:**
  - Saldo anterior: `prisma.lancamento.aggregate({ where: { dataCompetencia: { lt: firstDayOfMonth } }, _sum: { valorCentavos: true } })` (interpretado por tipo).
  - Entradas/saídas do mês: `prisma.lancamento.groupBy({ by: ['categoria'], where: { dataCompetencia: { gte: firstDay, lt: firstDayNextMonth } } })`.
- **Saída:** inclui 4 KPIs (Saldo Anterior, Entradas, Saídas, Saldo Atual) + tabela "Resumo por Categoria" com colunas Categoria | Entradas | Saídas | Saldo.
- **Edge cases:** mês de criação da igreja (sem histórico) → `saldoAnteriorCentavos: 0`. Categoria sem movimento no mês → omitida da tabela.

#### 4.1.3 `getFluxoCaixa(periodo: { inicio: Date; fim: Date }, user: SessionUser): Promise<FluxoCaixaData>`

- **Quem chama:** loader de `/app/financeiro/relatorios/fluxo-caixa`.
- **RBAC:** `assertCanSeeRelatorios(user)`.
- **Query Prisma:** série temporal com `prisma.lancamento.groupBy({ by: ['dataCompetencia'], where: { dataCompetencia: { gte, lt } } })` agregado por mês (12 pontos para 1 ano).
- **Saída:** 4 KPIs (Entradas Totais, Saídas Totais, Saldo Acumulado, placeholder "Contas a Pagar (30d)" — ver §5.6) + série temporal `Array<{ mes: string; entradasCentavos: number; saidasCentavos: number; saldoCentavos: number }>`.
- **Edge cases:** período vazio → séries vazias, saldo acumulado `0`.

#### 4.1.4 `getRelatorioCustomizado(filtros: RelatorioCustomizadoFiltros, user: SessionUser): Promise<RelatorioCustomizadoData>`

- **Quem chama:** loader de `/app/financeiro/relatorios/customizado`.
- **RBAC:** `assertCanSeeRelatorios(user)`.
- **Filtros aceitos:** `{ periodo: { inicio, fim } | preset, tipo?: 'ENTRADA' | 'SAIDA', categoria?: CategoriaLancamento, caixaId?: string, membroId?: string }`. Validação Zod no loader antes de chegar aqui.
- **Query Prisma:** `prisma.lancamento.findMany({ where: <dinâmico>, orderBy: { dataCompetencia: 'desc' }, include: { caixa: true, membro: true } })`.
- **Saída:** 2 KPIs (Total Entradas, Total Saídas) + Saldo Consolidado + tabela paginada `Array<LancamentoListItem>` com Data | Descrição | Categoria | Caixa | Valor.
- **Edge cases:** filtros inválidos → 400. 0 resultados → tabela vazia + KPIs zerados.

#### 4.1.5 `exportarLancamentosCSV(filtros, user: SessionUser): Promise<ReadableStream | string>`

- **Quem chama:** action de download em `/app/financeiro/relatorios/customizado?export=csv`.
- **RBAC:** `assertCanSeeRelatorios(user)`.
- **Implementação:** `app/lib/relatorios-csv.server.ts` separado (regra de responsabilidade única). Cabeçalho CSV: `Data;Descrição;Categoria;Tipo;Caixa;Valor (R$);Membro` (separador `;` para Excel pt-BR; RFC 4180). Encoding UTF-8 com BOM.
- **LGPD:** se SECRETARIO estivesse liberado, teríamos que filtrar dízimos. Como já está bloqueado em Camada 2, a Camada 3 apenas aplica `assertCanSeeRelatorios`.

### 4.2 Rotas (UI + loader/action) — `app/routes/app/financeiro/relatorios/**`

**5 rotas novas**, cada uma com Camada 2 (loader chama `assertCanSeeRelatorios`) e UI em Tailwind 4.

#### 4.2.1 Hub de Relatórios — `/app/financeiro/relatorios`

- **Arquivo:** `app/routes/app/financeiro.relatorios._index.tsx`.
- **Loader:** `assertCanSeeRelatorios(user)` + busca leve (count de lançamentos no mês corrente para exibir "Última geração: há X dias" no card).
- **UI:** replicação fiel do Stitch `hub_de_relat_rios_igrejaconnect/code.html` — grid 2×2 de 4 cards grandes (DRE, Balancete, Fluxo de Caixa, Customizado) + bloco secundário "Relatório de Transparência 2024" (apenas visual, sem ação). Cada card tem ícone colorido (azul DRE, verde Balancete, índigo Fluxo, laranja Customizado) + botão "Gerar Relatório" → navega para a sub-rota.
- **Substituições de Material Symbols → SVG inline:** `bar_chart_4_bars` → SVG DRE, `description` → SVG Balancete, `trending_up` → SVG Fluxo, `tune` → SVG Customizado. Todos em `app/components/icons/FinanceIcons.tsx`.

#### 4.2.2 DRE — `/app/financeiro/relatorios/dre`

- **Arquivo:** `app/routes/app/financeiro.relatorios.dre.tsx`.
- **Loader:** chama `getDRE({ inicio, fim }, user)`. `inicio`/`fim` vêm de search params (default: mês corrente).
- **UI:** replica Stitch `dre_igrejaconnect/code.html`. Filtro de período (dois `<input type="date">` + botão refresh). 3 KPIs (Total Entradas verde, Total Saídas vermelho, Resultado Líquido azul com badge "Lucro" / "Déficit"). Grid 12-col: coluna 5 (Entradas por Tipo, barras de progresso), coluna 7 (Saídas por Categoria, tabela com barra de impacto + percentual + valor total). Footer gradiente "Resumo de Saúde Financeira" (visual).

#### 4.2.3 Balancete Mensal — `/app/financeiro/relatorios/balancete`

- **Arquivo:** `app/routes/app/financeiro.relatorios.balancete.tsx`.
- **Loader:** chama `getBalanceteMensal({ ano, mes }, user)`. Default: mês corrente.
- **UI:** replica Stitch `balancete_mensal_igrejaconnect/code.html`. Header com `<input type="month">` (formato `YYYY-MM`) + botão "Imprimir Balancete" (apenas visual, aciona `window.print()` — sem PDF real). 4 KPIs (Saldo Anterior cinza, Entradas verde com badge +12.5%, Saídas vermelho com badge -4.2%, Saldo Atual azul com ring lateral). Grid 8+4: tabela "Resumo por Categoria" (Categoria | Entradas | Saídas | Saldo) + side card "Distribuição de Saídas" (donut SVG inline). Card escuro "Projeção Próximo Mês" — **placeholder cinza** (§5.6).

#### 4.2.4 Fluxo de Caixa — `/app/financeiro/relatorios/fluxo-caixa`

- **Arquivo:** `app/routes/app/financeiro.relatorios.fluxo-caixa.tsx`.
- **Loader:** chama `getFluxoCaixa({ inicio, fim }, user)`. Default: ano corrente (12 meses).
- **UI:** replica Stitch `fluxo_de_caixa_igrejaconnect/code.html`. Tabs Dia/Semana/Mês (Dia e Semana virão "Em breve" — só Mês implementado). Botão calendário (range 12 meses default). Botão "Exportar" (placeholder visual neste ciclo). 4 KPIs (Entradas, Saídas, Saldo Acumulado, Contas a Pagar — placeholder cinza). Card principal "Histórico de Fluxo de Caixa" com **SVG line chart inline** (path Bezier) Entradas (verde) + Saídas (vermelho) + Saldo (azul tracejado). Side card "Projeção Próximos 30 dias" — **placeholder cinza** (§5.6).

#### 4.2.5 Relatório Customizado — `/app/financeiro/relatorios/customizado`

- **Arquivo:** `app/routes/app/financeiro.relatorios.customizado.tsx`.
- **Loader:** chama `getRelatorioCustomizado(filtros, user)`. Filtros via search params.
- **Action:** chama `exportarLancamentosCSV(filtros, user)` quando query `?export=csv`. Response: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="relatorio-customizado-YYYY-MM-DD.csv"`.
- **UI:** replica Stitch `relat_rio_customizado_igrejaconnect/code.html`. Bento grid: card 8-col "Filtros Avançados" (6 selects: Período, Tipo, Categoria, Membro, Caixa, Status — **Status é placeholder**, ver §5.7) + card 4-col com 2 KPIs (Total Entradas verde, Total Saídas vermelho). Botões header: "Exportar CSV" (chama action) e "Aplicar Filtros" (re-submete com search params). Tabela "Lançamentos Consolidados" com paginação simples (50 por página). Footer: card gradiente azul "Saldo Consolidado do Período" + card "Ações Rápidas" (3 botões: Imprimir PDF / Enviar E-mail / Agendar Relatório — **todos placeholders**, diferidos).

### 4.3 Componentes compartilhados

#### 4.3.1 `<FiltrosPeriodo />` — `app/components/FiltrosPeriodo.tsx`

- Props: `{ value: { inicio: Date; fim: Date } | null; onChange: (periodo) => void; presets?: boolean }`.
- Renderiza: 4 botões de preset (7 dias, 30 dias, Mês corrente, Ano) + botão "Personalizado" que abre 2 inputs `<input type="date">`.
- Padrão controlado via `useState`. Reutilizado em DRE, Fluxo de Caixa e Relatório Customizado.

#### 4.3.2 `<KpiCard />` — `app/components/KpiCard.tsx`

- Props: `{ titulo: string; valor: string; cor?: 'default' | 'emerald' | 'red' | 'blue' | 'amber'; icone: React.ReactNode; badge?: string; trend?: string; subtitulo?: string }`.
- Renderiza: card com ícone colorido à esquerda, badge opcional (ex: "+12.5%"), valor em `text-2xl font-bold`, subtítulo opcional.
- Reutilizado em todos os 5 relatórios — economia estimada: ~120 linhas duplicadas.

### 4.4 Atualização de navegação — `app/components/Sidebar.tsx`

Adicionar 1 item no array `MENU_ITEMS`:

```ts
{
  label: "Relatórios",
  to: "/app/financeiro/relatorios",
  icon: ICON_RELATORIOS, // novo SVG inline
  roles: ["ADMIN", "PASTOR", "FINANCEIRO"], // SECRETARIO BLOQUEADO
},
```

**Ordem:** após "Financeiro". Ícone `ICON_RELATORIOS` segue padrão dos demais (`<svg>` inline 24x24, stroke="currentColor").

### 4.5 Helpers RBAC — `app/lib/rbac.server.ts`

Adicionar 2 exports:

```ts
/** Cargos que podem acessar /app/financeiro/relatorios/** */
export const RELATORIOS_CARGOS = ["ADMIN", "PASTOR", "FINANCEIRO"] as const;

/**
 * Lança Response(403) se o usuário não pode ver relatórios financeiros estruturados.
 * SECRETARIO é BLOQUEADO — apenas ADMIN, PASTOR, FINANCEIRO.
 */
export function assertCanSeeRelatorios(user: SessionUser): void {
  if (!user.cargo || !(RELATORIOS_CARGOS as readonly string[]).includes(user.cargo)) {
    throw new Response("Acesso restrito a ADMIN/PASTOR/FINANCEIRO.", { status: 403 });
  }
}
```

Segue o padrão canônico do arquivo (`assertCanSeeFinancials`, `assertCanSeeFinancialModule`).

### 4.6 Ícones SVG — `app/components/icons/FinanceIcons.tsx`

**~25 SVGs** novos, todos 24x24 viewBox, stroke="currentColor", strokeWidth=2. Substituem os Material Symbols dos HTMLs do Stitch. Exemplos:

- `IconDRE` (bar_chart_4_bars)
- `IconBalancete` (description)
- `IconFluxoCaixa` (trending_up)
- `IconCustomizado` (tune)
- `IconKpiWallet`, `IconKpiArrowUp`, `IconKpiArrowDown`, `IconKpiBalance`
- `IconExport`, `IconCalendar`, `IconRefresh`, `IconFilter`, `IconCloudDownload`
- `IconChevronRight`, `IconInfo`, `IconMoreVert`, `IconPrint`, `IconHistory`
- `IconCheck`, `IconWarning`, `IconVerified`, `IconAutoAwesome`, `IconShowChart`
- `IconArrowDropUp`, `IconArrowDropDown`, `IconEvent`, `IconPictureAsPdf`, `IconMail`

Cada um exportado como `const ICON_X: React.ReactNode` (mesmo padrão de `Sidebar.tsx`).

### 4.7 Estimativa de sprints

- **S11 (Backend foundation):** `relatorios.server.ts` (5 services) + `rbac.server.ts` (2 helpers) + testes unitários (TDD obrigatório — ≥ 100 testes).
- **S12 (Frontend + integração):** 5 rotas + 2 componentes compartilhados + Sidebar atualizada + ícones SVG + testes E2E.
- **S13 (Drill-down, condicional):** apenas se a Fase 3 confirmar que a rota `/app/financeiro/lancamentos` precisa ser criada para suportar o drill-down (decisão §5.4). Hoje já existem `/app/financeiro/caixas/:id` (extrato) e `/app/financeiro/lancamentos/novo` (form), mas não há listagem geral.

---

## 5. Decisões confirmadas neste discovery

Sete decisões foram tomadas na rodada de discovery de 2026-06-20 (attempt 1 + attempt 2).

### 5.1 Filtros de data — presets + datepicker opcional

- **Decisão:** todas as 5 páginas de relatório oferecem 4 presets (7 dias, 30 dias, mês corrente, ano corrente) via `<FiltrosPeriodo />`. Datepicker de range livre fica disponível apenas como "Personalizado" no card de filtros.
- **Por que:** 95% das consultas reais usam um preset (mês corrente para fechamento, ano para assembleia). Datepicker para casos de borda (auditoria de mês específico antigo).
- **Implementação:** componente controlado, prop `presets?: boolean` (default true), `defaultPreset?: '7d' | '30d' | 'mes' | 'ano'`.

### 5.2 Exportação — CSV no escopo, PDF diferido

- **Decisão:** apenas **CSV** é implementado neste ciclo, no Relatório Customizado (botão "Exportar CSV"). PDF é **diferido para ciclo futuro**.
- **Por que:** PDF requer biblioteca (pdfkit, puppeteer, jspdf) com peso considerável (puppeteer ~250MB) e não há dependência de PDF no projeto. CSV cobre o caso real (abrir em Excel/Google Sheets e pivotar).
- **Formatação CSV:** separador `;` (Excel pt-BR), encoding UTF-8 com BOM, cabeçalho `Data;Descrição;Categoria;Tipo;Caixa;Valor (R$);Membro`. RFC 4180.
- **Atalho de download:** action dedicada com `Content-Disposition: attachment`, não loader.

### 5.3 RBAC — apenas 3 perfis (ADMIN/PASTOR/FINANCEIRO), SECRETARIO BLOQUEADO

- **Decisão:** `RELATORIOS_CARGOS = ["ADMIN", "PASTOR", "FINANCEIRO"]`. SECRETARIO, mesmo podendo acessar o módulo financeiro operacional, **NÃO** acessa `/app/financeiro/relatorios/**`.
- **Por que:** decisão de produto confirmada em discovery (não falha de segurança). Prestação de contas estruturada é responsabilidade pastoral-administrativa. SECRETARIO opera dentro dos caixas existentes.
- **Implementação:** Camada 1 (item "Relatórios" some do menu lateral para SECRETARIO) + Camada 2 (loader chama `assertCanSeeRelatorios`) + Camada 3 (helper revalida em `exportarLancamentosCSV`).
- **Teste de borda (Playwright E2E):** SECRETARIO logado → digitar `/app/financeiro/relatorios` direto na URL → esperar 403.

### 5.4 Drill-down — clicar em categoria navega para `/app/financeiro/lancamentos?...`

- **Decisão:** ao clicar em uma linha da tabela "Resumo por Categoria" (Balancete) ou em uma barra do DRE, a UI navega para `/app/financeiro/lancamentos?caixa=X&categoria=Y&periodo=inicio..fim`.
- **Por que:** necessidade operacional real ("esse valor de Manutenção em outubro é recorrente?"). Hoje, o tesoureiro precisa abrir cada lançamento individual.
- **PENDÊNCIA:** essa rota `/app/financeiro/lancamentos` (listagem geral) **não existe hoje** — só há `/app/financeiro/lancamentos/novo` (form de criação) e `/app/financeiro/caixas/:id` (extrato). A Fase 3 (Design) deve decidir entre:
  - **Opção A:** criar nova rota `/app/financeiro/lancamentos` (1 sprint extra — S13 condicional).
  - **Opção B:** redirecionar drill-down para `/app/financeiro/caixas/:id` com query params adicionais (mais barato, mas UX perde filtros entre caixas).
- **Estado atual:** pendência registrada em §9.6 item #2. Decisão final na Fase 3.

### 5.5 Ícones — manter SVG inline (consistência)

- **Decisão:** converter todos os Material Symbols dos HTMLs do Stitch para SVG inline (24x24, stroke="currentColor"), armazenados em `app/components/icons/FinanceIcons.tsx`. Não usar biblioteca externa (`lucide-react` etc.) nem CSS icon font.
- **Por que:** consistência com `Sidebar.tsx` (que já usa SVG inline) e `TopbarAutenticada.tsx`. Menos dependências. Sem flash de loading de font externa.
- **Estimativa:** ~25 SVGs a criar (lista em §4.6).

### 5.6 Projeções (próximo mês / 30 dias) — placeholder visual cinza

- **Decisão:** os cards "Projeção Próximo Mês" (Balancete) e "Projeção Próximos 30 dias" (Fluxo de Caixa) renderizam **placeholder cinza** com texto "Disponível em ciclo futuro — depende de módulo Contas a Pagar (RN-XYZ)".
- **Por que:** YAGNI. Projeção real depende de módulo `ContaPagar` que não existe no schema. Implementar "projeção fake" agora seria mentir para o usuário.
- **Implementação:** componente `<ProjectionPlaceholder />` com fundo cinza claro, ícone `IconHourglass`, texto explicativo.
- **Quando evoluir:** ciclo que entregar `ContaPagar` (estimativa: ciclo 6+).

### 5.7 Status de lançamento — placeholder (YAGNI)

- **Decisão:** o filtro "Status" (Confirmado/Pendente/Cancelado) no Relatório Customizado renderiza **select desabilitado** com label "Em breve — depende de refactor de schema".
- **Por que:** o schema `Lancamento` **não tem** campo `status: LancamentoStatus`. Adicionar requer migration e decisão de produto sobre quais status usar (Confirmado vs Pendente vs Cancelado vs Estornado).
- **Implementação:** `<select disabled>` com 4 opções placeholder visíveis mas não clicáveis.

---

## 6. Restrições

### 6.1 Stack e arquitetura (imutáveis, herdadas dos ciclos 1–3)

- **Frontend:** React Router 7.16 (SSR + future flags `v8_*`), Tailwind 4, Vite 8, TypeScript 5.9 strict.
- **Backend:** mesmo processo Node 22, Prisma 7.8 client em `app/db/prisma.server.ts`.
- **DB:** SQLite local (`prisma/dev.db`).
- **Auth:** session cookie httpOnly + sliding renewal (TTL 7d, teto 30d abs).
- **Validação:** Zod para query params e body de filtros.
- **Testes:** Vitest (unit + integração) + Playwright (E2E) — 3 camadas.
- **Cobertura:** gate ≥ 85% por sprint, 100% em services de regra de negócio.

### 6.2 Compliance e LGPD

- **RN-MEM-03 (estendido):** SECRETARIO **bloqueado** em relatórios, não apenas em dízimos individuais. Logs de auditoria **nunca** registram `valorCentavos` (mesma regra do ciclo 2).
- **LGPD Art. 6° (necessidade):** relatórios consolidados (DRE, Balancete, Fluxo de Caixa) são acessíveis apenas a perfis com função pastoral/tesouraria/administrativa. Princípio da necessidade respeitado.
- **LGPD Art. 46:** o `lgpd-officer` auditará este módulo. Atenção especial à: (a) segregação por perfil (RBAC fina nos services), (b) minimização de dados (relatórios agregados, não listam todos os lançamentos), (c) registro de operações sensíveis (geração de relatório → log de auditoria sem `valorCentavos`).

### 6.3 RAGs a seguir (não-negociáveis)

- [`.harness/RAG/security-rbac-matrix.md`](./.harness/RAG/security-rbac-matrix.md) — matriz RBAC, padrão de 3 camadas, helper `assertCan*`.
- [`.harness/RAG/convention-monetary-values.md`](./.harness/RAG/convention-monetary-values.md) — `Int` em centavos, helpers `formatBRLFromCents` / `parseBRLToCents` / `assertNonNegative`. **Crítico para agregações.**
- [`.harness/RAG/lgpd-igreja-conect.md`](./.harness/RAG/lgpd-igreja-conect.md) — segregação, minimização, auditoria.
- (A criar na Fase 1) `pattern-relatorios-agregacao.md` — padrão de service de agregação (extensão do `pattern-trava-saldo-service.md`).

### 6.4 Restrições operacionais

- **Prazo:** alvo de **2 sprints** (S11, S12) + **1 sprint condicional** (S13) se drill-down exigir nova rota.
- **Sem dependências externas novas:** sem `pdfkit`, sem `puppeteer`, sem `lucide-react`, sem `recharts`. Charts são SVG inline.
- **Sem novas rotas `app/api/**`:** manter padrão RR7 (loader/action em `app/routes/**`).
- **Sem migration:** schema atual cobre 100% dos requisitos. Nenhum `prisma migrate` neste ciclo.

---

## 7. Critérios de sucesso

### 7.1 Métrica macro (única)

> **O ciclo 4 é considerado bem-sucedido quando um `FINANCEIRO` consegue, em menos de 2 minutos, gerar o DRE do mês corrente, ver o total de entradas (verde), o total de saídas (vermelho) e o resultado líquido (azul), clicar em uma categoria para abrir o drill-down, e exportar a tabela do Relatório Customizado em CSV.**

### 7.2 Métricas de qualidade (gate do phase 5)

- **Cobertura de testes:** ≥ 85% global, **100% em `app/lib/relatorios.server.ts`** (services de agregação são regra de negócio).
- **Vulnerabilidades:** 0 critical, 0 high (gate do `security-scanner`).
- **`planning-reviewer` score:** ≥ 70.
- **LGPD:** `lgpd-officer` status ≥ `warning`, 0 critical em Art. 6°/18/46.
- **Defesa em 3 camadas comprovada:** 100% das 5 rotas cobertas por testes E2E com login helper que troca `user.cargo` entre cenários.

### 7.3 Testes de borda obrigatórios (TDD antes do service)

- **SECRETARIO acessando `/app/financeiro/relatorios`:** recebe 403 em Camada 2 (loader) + Camada 3 (helper).
- **SECRETARIO digitando `/app/financeiro/relatorios/dre` direto na URL:** 403 (não há fallback).
- **DISCIPULADOR / LIDER_MINISTERIO:** 403 em todas as 5 rotas.
- **Mês sem lançamentos no DRE:** renderiza zeros, listas vazias, sem crash.
- **Mês sem categorias com movimento no Balancete:** tabela oculta linhas vazias, totais zerados.
- **Período com 0 resultados no Relatório Customizado:** tabela mostra "Nenhum lançamento encontrado" + KPIs zerados.
- **Filtro `categoria` inválida (ex: `categoria=BURRO`):** loader lança `Response(400, "Categoria inválida")`.
- **Filtro `periodo` com `inicio > fim`:** loader lança `Response(400, "Período inválido")`.
- **Caixa arquivado no DRE:** lançamentos do caixa arquivado **continuam aparecendo** no agregado (regra do ciclo 2 — arquivar não apaga histórico).
- **CSV com 1.280 registros:** geração completa em < 500ms (teste de performance).
- **CSV com caracteres especiais (descrição "São Paulo & Cia."):** escape correto conforme RFC 4180 (aspas duplas ao redor do campo + aspas internas duplicadas).
- **5 ADMs/PASTORes/FINANCEIROs logados simultaneamente gerando relatórios:** sem contenção (SQLite serializa, mas a latência aceitável é < 2s).
- **CSV sem BOM:** Excel pt-BR reconhece UTF-8 se BOM presente; sem BOM, caracteres acentuados viram mojibake. Teste automatizado confere os 3 primeiros bytes (`EF BB BF`).

---

## 8. Não-objetivos (fora de escopo deste ciclo)

Listados explicitamente para evitar **scope creep**. Qualquer item aqui pode virar ciclo futuro se a demanda surgir.

- ❌ **Exportação PDF.** Diferida — depende de biblioteca externa com peso considerável. CSV cobre o caso de uso real (Excel/Sheets).
- ❌ **Envio de relatório por e-mail.** Sem SMTP no projeto (alinhado com `brief-mvp-financeiro.md §8`).
- ❌ **Agendamento de relatórios (cron).** Sem jobs no projeto.
- ❌ **Projeção financeira real (próximo mês, próximos 30 dias).** Depende de módulo `ContaPagar` que não existe no schema. Placeholder visual (§5.6).
- ❌ **Status de lançamento (Confirmado/Pendente/Cancelado/Estornado).** Schema não tem campo. Placeholder (§5.7).
- ❌ **Conciliação bancária.** Caixas são internos (RN-FIN-01). Sem extrato bancário para reconciliar.
- ❌ **Multi-igreja / multi-tenant.** Uma instância = uma igreja.
- ❌ **Multi-moeda.** Apenas BRL. A constante `Int` cobre até R$ 21 milhões por caixa.
- ❌ **Cache de relatório.** Toda geração é on-demand. Sem Redis/SQLite WAL tricks.
- ❌ **Filtros por centro de custo / departamento.** Não há modelagem de centro de custo no schema.
- ❌ **Drill-down em gráficos SVG (clicar em barra = abrir detalhe).** Apenas clique em linhas de tabela é navegável (§5.4).
- ❌ **Impressão formatada (CSS print + page-break).** Botão "Imprimir Balancete" usa `window.print()` com CSS mínimo.
- ❌ **Comparativo YoY automático ("vs. mesmo mês do ano passado").** Pode entrar via filtro manual de período.
- ❌ **Auditoria visual de quem gerou cada relatório.** Não há modelagem de `RelatorioGerado` neste ciclo (logs de auditoria cobrem).

---

## 9. Anexos e referências cruzadas

### 9.1 Documentos de domínio (fonte da verdade)

- [`docs/REGRAS_DE_NEGOCIO.md`](./docs/REGRAS_DE_NEGOCIO.md) — RN-MEM-01 a 06, **RN-FIN-01 a 05**, RN-EST-01 a 05.
- [`docs/DESCRIÇÃO_DOS_MODULOS.md`](./docs/DESCRIÇÃO_DOS_MODULOS.md) — matriz RBAC, objetivos por módulo.
- [`docs/architecture/ARCH.md`](./docs/architecture/ARCH.md) — 17 seções, ADRs, modelo de dados.

### 9.2 RAGs (memória de longo prazo do projeto)

- [`.harness/RAG/security-rbac-matrix.md`](./.harness/RAG/security-rbac-matrix.md) — **crítico para este ciclo**.
- [`.harness/RAG/convention-monetary-values.md`](./.harness/RAG/convention-monetary-values.md) — **crítico para este ciclo**.
- [`.harness/RAG/lgpd-igreja-conect.md`](./.harness/RAG/lgpd-igreja-conect.md) — segregação, minimização, auditoria.

### 9.3 Briefs de ciclos anteriores (cross-refs)

- [`brief-mvp.md`](./brief-mvp.md) — ciclo 1 (Auth + Membros + Discipulado + Alertas).
- [`brief-mvp-financeiro.md`](./brief-mvp-financeiro.md) — **ciclo 2 (módulo Financeiro)**. **Este brief depende diretamente daquele.**

### 9.4 Schema e código existente

- [`prisma/schema.prisma`](./prisma/schema.prisma) — models `Caixa`, `TransferenciaCaixa`, `Lancamento`, enums `TipoLancamento`, `CategoriaLancamento`. **Cobre 100% dos requisitos.**
- [`app/lib/finance.server.ts`](./app/lib/finance.server.ts) — `getDashboardFinanceiro`, `assertSaldoSuficiente`, `getDizimosByMembro`. **Padrão de service + Camada 3 RBAC.**
- [`app/lib/rbac.server.ts`](./app/lib/rbac.server.ts) — `FINANCIAL_MODULE_CARGOS`, `DIZIMO_CARGOS`, `assertCanSeeFinancials`. **Estender com `RELATORIOS_CARGOS` + `assertCanSeeRelatorios`.**
- [`app/lib/money.server.ts`](./app/lib/money.server.ts) — `formatBRLFromCents`, `parseBRLToCents`, `assertNonNegative`. **Reusar em todas as agregações.**
- [`app/components/Sidebar.tsx`](./app/components/Sidebar.tsx) — adicionar item "Relatórios" com `roles: ["ADMIN", "PASTOR", "FINANCEIRO"]`.
- [`app/routes/app/financeiro._index.tsx`](./app/routes/app/financeiro._index.tsx) — dashboard financeiro. **Ponto de entrada conceitual para os relatórios.**

### 9.5 Referências visuais (Stitch)

Os 5 HTMLs do Stitch em `/home/kingdev/Downloads/stitch_igrejaconnect/` são **referência visual**, não código-fonte. O ciclo 4 **replica o layout** mas converte Material Symbols → SVG inline (§5.5).

| Página | Stitch base |
|---|---|
| Hub de Relatórios | `hub_de_relat_rios_igrejaconnect/code.html` |
| Balancete Mensal | `balancete_mensal_igrejaconnect/code.html` |
| DRE | `dre_igrejaconnect/code.html` |
| Fluxo de Caixa | `fluxo_de_caixa_igrejaconnect/code.html` |
| Relatório Customizado | `relat_rio_customizado_igrejaconnect/code.html` |

### 9.6 Estado do Harness

- [`.harness/state.json`](./.harness/state.json) — `currentCycle: 4`, `currentPhase: phase.0.briefing`, `cycle4.scope: "Relatórios Financeiros..."`.
- [`.harness/state-machine.json`](./.harness/state-machine.json) — contrato read-only. Não editar.

### 9.7 Pendências conhecidas (para o orchestrator)

| # | Pendência | Origem | Tratamento esperado |
|---|-----------|--------|---------------------|
| 1 | ~~Path-boundary hook bloqueou `brief-relatorios.md` na tentativa 1 (allowlist só continha `brief.md` singular)~~ | task do orchestrator, ciclo 4 attempt 1 | ✅ **RESOLVIDO pelo orchestrator** — `~/.config/opencode/harness-allowlist.json` atualizado para aceitar `brief-*.md`. Tentativa 2 (este brief) escrita com sucesso. |
| 2 | Rota `/app/financeiro/lancamentos` (listagem geral) **não existe** — hoje há apenas `/app/financeiro/lancamentos/novo` (form) e `/app/financeiro/caixas/:id` (extrato). Drill-down (§5.4) pode precisar dessa rota. | gap arquitetural herdado | **Avaliar na Fase 3 (Design):** Opção A (criar rota nova → S13 condicional) ou Opção B (redirecionar para `/app/financeiro/caixas/:id` com query params). PRD/SPEC deve fixar antes de S12. |
| 3 | Tools `harness_status` / `harness_advance` quebradas (`u.split` error em `state.json:183-186`) | resíduo do ciclo 2 | Continuar usando edição direta de `state.json` via Python (workaround já em uso). `briefing` agent não chama essas tools — apenas retorna JSON para o orchestrator. |
| 4 | 74 testes pré-existentes falhando (`MVP-DEBT-001`) e 107 typecheck errors (`MVP-DEBT-003`) — herdados dos ciclos 1–3 | débitos técnicos | **Não-bloqueador para o ciclo 4**, mas o `tester` agent do ciclo 4 deve evitar introduzir novos testes falhando. `qa-gate` deve isolar falhas pré-existentes vs. introduzidas. |
| 5 | Backup `.harness/RAG/brief-relatorios-content.md` (placeholder do attempt 1) deve ser **DELETADO após mover** o conteúdo para `brief-relatorios.md`. | workaround do attempt 1 | ✅ **A ser executado por este `briefing` agent no attempt 2**, imediatamente após `write` bem-sucedido de `brief-relatorios.md`. |

---

## Próxima revisão

- **Quando:** ao final de cada sprint do ciclo 4, ou se regra de negócio / RBAC / RAG mudar.
- **Por quem:** `documenter` agent (Fase 1) ao consolidar; `requirements` e `designer` ao detalhar; `prd-reviewer` ao auditar.
- **Quem consome este brief:** `documenter` (Fase 1) → `requirements` (Fase 2) → `designer` (Fase 3) → `sprint-tasker` (Fase 4) → orchestrator + 5 workers (Fase 5).

---

> **Pedido de aprovação:**
> Aprova este `brief-relatorios.md` para iniciar a **Fase 1 (Documentação)** do ciclo 4 (Relatórios Financeiros)?
>
> - ✅ **Aprovar** — Fase 1 inicia com base neste escopo, decisões e restrições.
> - ✏️ **Editar** — apontar o que ajustar (seções 4, 5, 6, 7 ou 8 são as mais prováveis de iteração).
> - ❌ **Rejeitar** — explicar o motivo para nova rodada de discovery.