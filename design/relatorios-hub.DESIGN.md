# Design — Hub de Relatórios (ciclo 4)

> **Rota:** `/app/financeiro/relatorios`
> **RBAC:** ADMIN, PASTOR, FINANCEIRO (SECRETARIO BLOQUEADO)
> **Stitch base:** `~/Downloads/stitch_igrejaconnect/hub_de_relat_rios_igrejaconnect/code.html`
> **Cross-refs:** PRD §3.1, SPEC §5.1 EP-001, brief §4.2.1

---

## 1. Contexto

Página-raiz do **módulo Relatórios Financeiros** (ciclo 4). É o "ponto de entrada" para 4 relatórios estruturados (DRE, Balancete, Fluxo de Caixa, Customizado) mais um bloco secundário "Relatório de Transparência 2024" (placeholder visual, sem ação).

**Persona-alvo:** Tesoureiro (FINANCEIRO) — usa para fechamento mensal. Pastor (PASTOR) — usa para aconselhamento estratégico e conselho. Administrador (ADMIN) — usa para auditoria e assembleia anual.

**Quem NÃO acessa:** SECRETARIO (RN-REL-01 — bloqueado em defesa de 3 camadas), DISCIPULADOR e LIDER_MINISTERIO (RN-MEM-03).

**Caso de uso primário (métrica macro, brief §7.1):** `FINANCEIRO` entra no hub, identifica qual relatório precisa, clica em "Gerar Relatório" do card correspondente e em menos de 2 minutos tem KPIs renderizados.

---

## 2. Layout (estrutura visual)

### 2.1 Desktop (≥ 1024px)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Topbar + Sidebar (item "Relatórios" ativo)                          │
├────────────┬─────────────────────────────────────────────────────────┤
│ Sidebar    │ Relatórios Financeiros                                   │ ← h1
│            │ "Visão consolidada para prestação de contas..."          │ ← subtítulo
│ • Dashboard│                                                            │
│ • Membros  │ ┌──────────────────┐  ┌──────────────────┐              │
│ • Financei-│ │ 📊 DRE           │  │ 📋 Balancete     │              │ ← grid 2×2
│ • Relató-  │ │ (ícone azul)     │  │ (ícone verde)    │              │
│   rios(ati)│ │ Demonstração do  │  │ Resumo mensal    │              │
│ • Ministé- │ │ Resultado do     │  │ com saldo        │              │
│   rios     │ │ Exercício        │  │ anterior e atual │              │
│ • Alertas  │ │                  │  │                  │              │
│            │ │ [Gerar Relatório]│  │ [Gerar Relatório]│              │
│ ─────      │ └──────────────────┘  └──────────────────┘              │
│ Sair       │                                                            │
│            │ ┌──────────────────┐  ┌──────────────────┐              │
│            │ │ 📈 Fluxo Caixa   │  │ ⚙ Customizado    │              │
│            │ │ (ícone índigo)   │  │ (ícone laranja)  │              │
│            │ │ Histórico de     │  │ Filtros avançados│              │
│            │ │ entradas/saídas  │  │ + export CSV     │              │
│            │ │                  │  │                  │              │
│            │ │ [Gerar Relatório]│  │ [Gerar Relatório]│              │
│            │ └──────────────────┘  └──────────────────┘              │
│            │                                                            │
│            │ ┌──────────────────────────────────────────────────────┐│
│            │ │ 🏛 Relatório de Transparência 2024                  ││ ← bloco 2º
│            │ │ Prestação de contas anual à assembleia (placeholder)││
│            │ │ [Ver Demo] (desabilitado)                            ││
│            │ └──────────────────────────────────────────────────────┘│
└────────────┴─────────────────────────────────────────────────────────┘
```

### 2.2 Mobile (< 768px)

```
┌──────────────────────────────┐
│ [☰] [Relatórios]    [🔔] [👤]│
├──────────────────────────────┤
│ Relatórios Financeiros       │
│ Visão consolidada para...    │
│                              │
│ ┌──────────────────────────┐ │
│ │ 📊 DRE                   │ │
│ │ Demonstração do Resultado│ │
│ │ [Gerar Relatório]        │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ 📋 Balancete             │ │
│ │ Resumo mensal...         │ │
│ │ [Gerar Relatório]        │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ 📈 Fluxo de Caixa        │ │
│ │ [Gerar Relatório]        │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ ⚙ Customizado            │ │
│ │ [Gerar Relatório]        │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

---

## 3. Componentes utilizados

| Componente | Fonte | Props customizadas | Localização |
|---|---|---|---|
| `<ShellAutenticado>` | shared (ciclo 1) | — | (já existe) |
| `<PageHeader>` | shared (ciclo 1) | `title`, `subtitle` | (já existe) |
| `<RelatorioCard>` | novo (ciclo 4) | `titulo`, `descricao`, `icone`, `cor`, `href` | `app/components/RelatorioCard.tsx` |
| `<IconDRE>` | novo (ciclo 4) | — | `app/components/icons/FinanceIcons.tsx` |
| `<IconBalancete>` | novo (ciclo 4) | — | `app/components/icons/FinanceIcons.tsx` |
| `<IconFluxoCaixa>` | novo (ciclo 4) | — | `app/components/icons/FinanceIcons.tsx` |
| `<IconCustomizado>` | novo (ciclo 4) | — | `app/components/icons/FinanceIcons.tsx` |
| `<IconAutoAwesome>` | novo (ciclo 4) | — | `app/components/icons/FinanceIcons.tsx` |
| `<Can>` | shared (ciclo 1) | `user`, `allow` | (já existe) |

**Cores dos ícones (4 cards):**
- DRE → `cyan-700` (#0e7490) — azul da paleta primária.
- Balancete → `green-700` (#047857) — semântico positivo.
- Fluxo de Caixa → `indigo-700` (#4338ca) — destaque secundário.
- Customizado → `amber-700` (#b45309) — atenção/configuração.

---

## 4. Estados visuais

| Estado | Quando | Render |
|---|---|---|
| **Initial (logado ADMIN/PASTOR/FINANCEIRO)** | Acesso normal | 4 cards + bloco "Transparência 2024" placeholder. |
| **SECRETARIO logado** | Tentativa de acesso | **403** — ErrorBoundary "Acesso restrito a ADMIN/PASTOR/FINANCEIRO". Item "Relatórios" some do Sidebar (Camada 1). |
| **DISCIPULADOR / LIDER_MINISTERIO** | Tentativa de acesso | **403** — mesmas 3 camadas. |
| **Loading** | Loader em 1ª carga | Skeleton: 4 retângulos `animate-pulse` + 1 retângulo maior para bloco secundário. |
| **Error (500)** | Loader falhou | ErrorState central + botão "Recarregar". |
| **Empty** | N/A (sempre há 4 cards) | Não aplicável. |

---

## 5. Interatividade

| Elemento | Evento | Comportamento |
|---|---|---|
| Card "DRE" | Click em "Gerar Relatório" | Navega para `/app/financeiro/relatorios/dre` (mesma janela). |
| Card "Balancete" | Click em "Gerar Relatório" | Navega para `/app/financeiro/relatorios/balancete`. |
| Card "Fluxo de Caixa" | Click em "Gerar Relatório" | Navega para `/app/financeiro/relatorios/fluxo-caixa`. |
| Card "Customizado" | Click em "Gerar Relatório" | Navega para `/app/financeiro/relatorios/customizado`. |
| Bloco "Transparência 2024" | Click em "Ver Demo" | **Placeholder** — botão desabilitado, sem ação (brief §4.2.1 + §8). |
| Sidebar item "Relatórios" | Click | Marca como ativo (estilo `bg-cyan-50 text-cyan-700` ou similar). |

**Navegação por teclado:**
- Tab: card 1 → card 2 → card 3 → card 4 → bloco secundário → sidebar.
- Foco visível em todos os botões "Gerar Relatório".
- Ordem segue fluxo visual.

---

## 6. RBAC (defesa em 3 camadas)

| Camada | Onde | Verifica | Falha → |
|---|---|---|---|
| **1 — UI** | `<Can allow={["ADMIN","PASTOR","FINANCEIRO"]}>` envolvendo o grid inteiro | Render condicional | SECRETARIO vê 403 (loader). Item "Relatórios" some do Sidebar. |
| **2 — Loader** | `assertCanSeeRelatorios(user)` como 1ª linha do loader | Lança `Response(403)` | ErrorBoundary 403 |
| **3 — Service** | Helper `assertCanSeeRelatorios` em cada chamada de service (Camada 3 redundante) | Mesmo helper | Lança `Response(403)` (defesa em profundidade) |

**Matriz:**
- **ADMIN, PASTOR, FINANCEIRO:** hub completo. Vê 4 cards + bloco secundário.
- **SECRETARIO, DISCIPULADOR, LIDER_MINISTERIO:** **403** em todas as 3 camadas.

---

## 7. Cross-references

- **Brief:** `brief-relatorios.md` §3 (personas), §4.2.1 (Hub de Relatórios), §5.3 (RBAC).
- **PRD:** `PRD.html` §3.1 Hub (US-REL-001 a 004), §4.2 (segurança).
- **SPEC:** `SPEC.html` §3.2.1, §4.1 (fluxo defesa 3 camadas), §5.1 EP-001.
- **AGENTS:** `agents/AGENTS.md` §Módulo Relatórios Financeiros.
- **ARCH:** `docs/architecture/ARCH.md` §10 — Relatórios Financeiros.
- **RAGs:**
  - `.harness/RAG/pattern-3-layer-rbac.md` — defesa em 3 camadas.
  - `.harness/RAG/security-rbac-matrix.md` — matriz 6 perfis × domínios.
  - `.harness/RAG/pattern-relatorios-aggregations.md` — padrão `groupBy` + soma em cents.
  - `.harness/RAG/convention-monetary-values.md` — `formatBRLFromCents`.
  - `.harness/RAG/lgpd-igreja-conect.md` — sem PII em log, sem cache.

---

## 8. Pendências da Fase 3 (drill-down)

- **Rota `/app/financeiro/lancamentos` (listagem geral) não existe hoje** (brief §9.6 item #2). Drill-down dos relatórios (DRE, Balancete) aponta para essa rota, que precisa ser decidida:
  - **Opção A:** criar `app/routes/app/financeiro.lancamentos._index.tsx` (S13 condicional).
  - **Opção B:** redirecionar para `/app/financeiro/caixas/:id` com query params (UX perde filtros entre caixas).
  - **Decisão esperada:** Fase 4 (sprint-tasker) ou validação do usuário antes de S12.

---

## 9. Critérios de aceite (gate Phase 5)

- [ ] Loader chama `assertCanSeeRelatorios` antes de qualquer I/O.
- [ ] 4 cards renderizam com `<RelatorioCard>` + ícones SVG coloridos (DRE azul, Balancete verde, Fluxo índigo, Customizado laranja).
- [ ] Bloco "Transparência 2024" renderiza com botão "Ver Demo" **desabilitado** (placeholder).
- [ ] Click em "Gerar Relatório" do card DRE navega para `/app/financeiro/relatorios/dre`.
- [ ] SECRETARIO recebe 403 ao acessar (Camada 2 + 3).
- [ ] SECRETARIO NÃO vê item "Relatórios" no Sidebar (Camada 1).
- [ ] DISCIPULADOR e LIDER_MINISTERIO recebem 403 ao acessar.
- [ ] Sidebar destaca item "Relatórios" quando ativo.
- [ ] Empty/Loading/Error states implementados.
- [ ] Cobertura do loader ≥ 100%.
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] `pnpm typecheck` passa.
- [ ] Sem dado sensível em log (`safeLog`, sem `valorCentavos`).