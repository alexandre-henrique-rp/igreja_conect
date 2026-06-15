# Dashboard — Design

## 1. Propósito

Painel inicial exibido **logo após o login** (`/app`). Funciona como "home" do sistema autenticado: mostra uma visão resumida do estado pastoral e aponta atalhos para as áreas mais usadas.

**Persona-alvo:** qualquer um dos 6 perfis administrativos autenticados. O conteúdo é o mesmo para todos (cards genéricos), mas a **quantidade** pode variar por perfil (ex: `DISCIPULADOR` vê contagem dos seus discípulos; `LIDER_MINISTERIO` vê contagem do seu ministério — a confirmar quando model LiderMinisterio entrar).

**Caso de uso primário:** usuário entra no sistema e precisa de 30 segundos para decidir o que fazer.

**Casos secundários:**
- Ver contagens rápidas (quantos membros, quantos visitantes, quantos alertas não lidos).
- Atalho para cadastrar novo membro (1 click).
- Atalho para resolver alertas (1 click).
- Bem-vindo personalizado com nome do usuário.

**Restrições:**
- **Sem métricas financeiras** no MVP (PRD §4 — Financeiro fora de escopo). Nenhum KPI envolvendo dízimos ou caixa.
- **Sem priorização/personalização** complexa no MVP. 1 layout para todos.
- Performance: loader deve ser < 300ms p95 com 1k membros (SPEC §13).

---

## 2. Wireframe

### 2.1 Desktop (≥ 1024px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Topbar (logo • busca • 🔔3 • Avatar ▼)                                  │ ← 56px
├────────────┬─────────────────────────────────────────────────────────────┤
│ Sidebar    │  Olá, Pastor João. Bom dia.                                │ ← saudação
│            │                                                             │
│ • Dashboard│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │ ← KPIs
│ • Membros  │  │ 47           │ │ 12           │ │ 3            │        │
│ • Ministé- │  │ Membros      │ │ Visitantes   │ │ Alertas não  │        │
│   rios     │  │ ativos       │ │ este mês     │ │ lidos        │        │
│ • Alertas  │  └──────────────┘ └──────────────┘ └──────────────┘        │
│ • Config   │                                                             │
│            │  Atalhos rápidos                                             │ ← atalhos
│ ─────      │  ┌────────────┐ ┌────────────┐ ┌────────────┐               │
│ Sair       │  │ + Cadastrar│ │  Ver       │ │  Ver       │               │
│            │  │  Membro    │ │  Alertas   │ │  Membros   │               │
│            │  └────────────┘ └────────────┘ └────────────┘               │
│            │                                                             │
│            │  Últimos visitantes cadastrados                             │ ← lista opcional
│            │  ┌─────────────────────────────────────────────────────┐  │
│            │  │ Maria da Silva    Visitante   há 2 horas    →      │  │
│            │  │ Pedro Santos      Visitante   ontem         →      │  │
│            │  │ Ana Pereira       Visitante   2 dias atrás  →      │  │
│            │  └─────────────────────────────────────────────────────┘  │
│            │                                                             │
└────────────┴─────────────────────────────────────────────────────────────┘
```

### 2.2 Mobile (< 768px)

```
┌──────────────────────────────┐
│ [Logo]      [🔔3] [Avatar ▼]│
├──────────────────────────────┤
│ Olá, João. Bom dia.         │
│                              │
│ ┌──────────┐ ┌──────────┐    │
│ │ 47       │ │ 12       │    │
│ │ Membros  │ │ Visitan- │    │
│ │ ativos   │ │ tes/mês  │    │
│ └──────────┘ └──────────┘    │
│ ┌──────────┐                  │
│ │ 3        │                  │
│ │ Alertas  │                  │
│ │ não lidos│                  │
│ └──────────┘                  │
│                              │
│ Atalhos                      │
│ [ + Cadastrar membro ]       │
│ [ Ver alertas     ]          │
│ [ Ver membros     ]          │
│                              │
│ Últimos visitantes           │
│ • Maria da Silva   há 2h →   │
│ • Pedro Santos     ontem →   │
│                              │
├──────────────────────────────┤
│ [☰ Menu] [🏠] [🔔] [👤]      │ ← bottom nav opcional (YAGNI no MVP)
└──────────────────────────────┘
```

---

## 3. Componentes

| Componente | Fonte | Props customizadas | Localização |
|---|---|---|---|
| `<ShellAutenticado>` | novo | layout com sidebar + topbar + `<Outlet />` | `app/components/ShellAutenticado.tsx` |
| `<Sidebar>` | novo | `user: SessionUser`, `currentPath: string` (para highlight) | `app/components/Sidebar.tsx` |
| `<TopbarAutenticada>` | novo | `user`, `alertasNaoLidos: number` | `app/components/TopbarAutenticada.tsx` |
| `<CardKpi>` | novo | `label`, `value`, `hint?`, `href?` (se clicável) | `app/components/CardKpi.tsx` |
| `<Atalho>` | novo | `label`, `icon`, `href`, `variant?` | `app/components/Atalho.tsx` |
| `<ListaRecente>` | novo | `items: { nome, badge, timestamp, href }[]`, `vazia?` | `app/components/ListaRecente.tsx` |
| `<Saudacao>` | novo | `user: { nome }` — gera "Bom dia/tarde/noite" baseado em hora | `app/components/Saudacao.tsx` |

**Hierarquia da página `/app`:**
- `app/routes/app.tsx` (layout para `/app/**`, contém `<ShellAutenticado>` e `<Outlet />`).
- `app/routes/app/_index.tsx` (página `/app` em si, que é o dashboard).

> **Decisão de estrutura:** o SPEC e o AGENTS mencionam `app/routes/app/_middleware.ts` e `app/routes/app/_index.tsx`. Vou usar `_index.tsx` para o dashboard e o resto das rotas privadas em `app/routes/app/<recurso>/$id.tsx`. **Esclarecer com orchestrator se o caminho preferido for outro** (ex: `app/routes/private/...` como o AGENTS sugere).

---

## 4. Estados

| Estado | Quando | Render |
|---|---|---|
| **Initial** | Loader OK, há dados | Saudação + 3 KPIs + 3 atalhos + lista de visitantes. |
| **Loading** | Loader em andamento (1ª carga) | Skeleton: 3 cards vazios com `animate-pulse` + 3 retângulos. |
| **Empty (sistema novo)** | Nenhum membro cadastrado | KPIs mostram "0". Lista de visitantes diz "Nenhum visitante recente. Cadastre o primeiro." + CTA grande "+ Cadastrar membro". |
| **Empty (DISCIPULADOR sem discípulos)** | Logado como DISCIPULADOR, 0 discípulos | KPIs mostram "0" para "Meus discípulos" (específico). Atalhos incluem "Ver meus discípulos". |
| **Error (500)** | Loader falhou | Mensagem central: "Não foi possível carregar o painel. Tente novamente." + botão "Recarregar". |
| **Sessão próxima de expirar** | (futuro) Faltam < 24h para expirar | Toast informativo: "Sua sessão expira em breve." (não no MVP, registrado para sprint futura) |

**Detalhe:** para o MVP, as contagens são **agregados simples** (COUNT no Prisma). Se virar gargalo (> 10k membros), aí sim avaliar cache ou denormalização. Sem premature optimization.

---

## 5. Interações

| Elemento | Evento | Comportamento |
|---|---|---|
| Card KPI "Membros ativos" | Click | Navega para `/app/membros?tipo=MEMBRO_ATIVO`. |
| Card KPI "Visitantes este mês" | Click | Navega para `/app/membros?tipo=VISITANTE`. |
| Card KPI "Alertas não lidos" | Click | Navega para `/app/alertas?filtro=nao_lidos`. |
| Atalho "+ Cadastrar membro" | Click | Navega para `/app/membros/novo`. |
| Atalho "Ver alertas" | Click | Navega para `/app/alertas`. |
| Atalho "Ver membros" | Click | Navega para `/app/membros`. |
| Item da lista de visitantes | Click | Navega para `/app/membros/:id`. |
| Avatar dropdown | Click | Abre menu: "Sair" (logout). "Meu perfil" fora do MVP. |
| Ícone 🔔 com badge "3" | Click | Navega para `/app/alertas`. Badge some após leitura (atualiza via revalidação do RR7). |

**Navegação por teclado:**
- Tab: atalho → atalho → atalho → item lista → item lista → ... → avatar.
- Foco visível em todos os elementos clicáveis (são `<Link>` ou `<button>`, recebem `:focus-visible`).

---

## 6. Validações e regras

- **Nenhuma validação de payload** (página é só leitura).
- **Nenhuma mutação** (read-only). Sem action.
- **Regra de RBAC fina (DISCIPULADOR/LIDER_MINISTERIO):** as contagens devem respeitar o escopo. `DISCIPULADOR` vê "Meus discípulos" em vez de "Membros ativos" geral. **Implementação:** o loader consulta `user.cargo` e ajusta os filtros do `count()`.

---

## 7. RBAC

| Perfil | Visibilidade |
|---|---|
| ADMIN, PASTOR, SECRETARIO, FINANCEIRO | ✅ Vê dashboard com KPIs globais. |
| DISCIPULADOR | ✅ Vê dashboard com KPIs filtrados para seus discípulos (ex: "Meus discípulos: 8" em vez de "Membros ativos: 47"). Atalhos incluem "Meus discípulos". |
| LIDER_MINISTERIO | ✅ Vê dashboard com KPIs do seu ministério (a refinar quando model LiderMinisterio entrar — Sprint 2+). Por ora, vê KPIs globais + nota "Em breve: contagens por ministério". |
| Membro comum (sem cargo) | ❌ Middleware barra (não-admin). |

**Defesa em profundidade:** loader exige `user` (middleware já fez). Service `getDashboardData(user)` faz a RBAC fina (filtra `where` por `discipuladorId === user.id` para DISCIPULADOR).

**Decisão a confirmar:** LIDER_MINISTERIO no MVP fica com KPIs globais (sem filtro por ministério), com mensagem informativa na UI. Decisão registrada na SPEC §12.2 e marcada como sprint 2+.

---

## 8. Acessibilidade

- **`<h1>`** = saudação dinâmica ("Olá, João").
- **`<h2>`** para cada seção ("Indicadores", "Atalhos rápidos", "Últimos visitantes").
- **Cards KPI** são `<Link>` semânticos (não `<div onClick>`).
- **Lista de visitantes** é `<ul>` com `<li>` — não `<table>` (poucos itens, não é dado tabular denso).
- **Badge de alertas** com `aria-label="3 alertas não lidos"` (não "3" nu).
- **Ícones** decorativos com `aria-hidden="true"`.
- **Saudação** com `aria-live="polite"` (anuncia dinamicamente? Talvez não — não muda com frequência).

---

## 9. Mobile

- **Sidebar vira drawer** (hamburger na topbar). Implementação: Sheet/Drawer RR7 (verificar se há nativo; senão, criar overlay simples).
- **KPIs em grid 2 colunas** (`grid-cols-2 lg:grid-cols-3`). Em `sm`, 1 coluna seria denso demais — 2 colunas com 3 KPIs fica 1 linha de 2 + 1 linha de 1.
- **Atalhos em coluna** (não grid 3-col, que ficaria apertado em 375px).
- **Lista de visitantes** com nome + timestamp, sem badge lateral (otimiza largura).
- **Topbar mantém hamburger** para abrir drawer.

---

## 10. Critérios de aceite (testáveis)

### 10.1 Funcionais

- [ ] `GET /app` (autenticado) retorna 200 e renderiza dashboard.
- [ ] `GET /app` (anônimo) → 302 para `/login?next=/app`.
- [ ] Saudação reflete `user.nome` corretamente.
- [ ] Saudação usa "Bom dia" / "Boa tarde" / "Boa noite" baseado em hora local do servidor (ou cliente, decidido na implementação).
- [ ] KPI "Membros ativos" mostra `count(Membro where tipo = MEMBRO_ATIVO)`.
- [ ] KPI "Visitantes este mês" mostra `count(Membro where tipo = VISITANTE and createdAt >= first day of current month)`.
- [ ] KPI "Alertas não lidos" mostra `count(AlertaDestinatario where membroId = user.id and lido = false)`.
- [ ] DISCIPULADOR logado vê "Meus discípulos" com `count` filtrado por `discipuladorId === user.id`.
- [ ] Lista "Últimos visitantes" mostra até 5 visitantes mais recentes, ordenados por `createdAt desc`.

### 10.2 Qualidade

- [ ] Lighthouse Accessibility ≥ 95.
- [ ] Lighthouse Best Practices ≥ 95.
- [ ] Tempo de carregamento do loader < 300ms p95 com 1k membros.
- [ ] Cobertura de testes ≥ 85%.
- [ ] `pnpm typecheck` passa.
- [ ] Sem dado financeiro (dízimo, caixa) no payload da página.

### 10.3 UX

- [ ] Em viewport 375×667, todos os elementos visíveis sem scroll horizontal.
- [ ] Atalhos e KPIs são focáveis via Tab.
- [ ] Click em KPI navega corretamente.
- [ ] Lista de visitantes com 0 itens mostra estado vazio com CTA.
- [ ] Estado de loading visível durante a 1ª carga (skeleton).
