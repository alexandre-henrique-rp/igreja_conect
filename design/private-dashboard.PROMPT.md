# Dashboard — Frontend Implementation Prompt

## Capability grant (paths allowlist do agent)

- **Paths de escrita:**
  - `app/routes/app.tsx` (layout)
  - `app/routes/app/_index.tsx` (dashboard)
  - `app/components/ShellAutenticado.tsx`
  - `app/components/Sidebar.tsx`
  - `app/components/TopbarAutenticada.tsx`
  - `app/components/CardKpi.tsx`
  - `app/components/Atalho.tsx`
  - `app/components/ListaRecente.tsx`
  - `app/components/Saudacao.tsx`
  - `app/components/EmptyState.tsx`
  - `app/components/Skeleton.tsx`
  - `app/lib/dashboard.server.ts` (service que agrega KPIs)
- **Paths de leitura:** `app/root.tsx`, `app/app.css`, `prisma/schema.prisma`, todos os RAGs, `design/private-dashboard.DESIGN.md`.
- **Boundary:** não criar `lib/auth.server.ts` ou `lib/session.server.ts` (responsabilidade do backend agent). Não tocar em migrations.

## Contexto

Painel inicial exibido logo após o login (`/app`). Mostra KPIs e atalhos rápidos.

- **Design detalhado:** [`design/private-dashboard.DESIGN.md`](./private-dashboard.DESIGN.md)
- **PRD:** [`PRD.html`](../../PRD.html) — UC-02 (consulta rápida) implícito.
- **SPEC:** [`SPEC.html`](../../SPEC.html) §3 (autenticação), §6 (membros), §7 (RBAC).
- **AGENTS:** [`agents/AGENTS.md`](../../agents/AGENTS.md) — paths, padrões.
- **RAGs relevantes:**
  - [`security-rbac-matrix.md`](../../.harness/RAG/security-rbac-matrix.md) — RBAC fina por escopo.
  - [`architecture-monolith-modular.md`](../../.harness/RAG/architecture-monolith-modular.md) — fronteira routes → lib.

## Tarefas

### T1. Criar `<Saudacao>`

- **Path:** `app/components/Saudacao.tsx`
- **Props:** `nome: string`, `data?: Date` (default = `new Date()`).
- **Lógica:** retorna "Bom dia" se hora < 12, "Boa tarde" se < 18, "Boa noite" caso contrário.
- **Output:** `<h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Olá, {nome}. {periodo}.</h1>`.

### T2. Criar `<ShellAutenticado>` (layout)

- **Path:** `app/components/ShellAutenticado.tsx`
- **Props:** `user: SessionUser`, `currentPath: string`, `alertasNaoLidos: number`, `children: ReactNode`.
- **Estrutura:** `<div className="min-h-screen bg-slate-50 flex flex-col"><TopbarAutenticada user={user} alertasNaoLidos={alertasNaoLidos} /><div className="flex-1 flex"><Sidebar user={user} currentPath={currentPath} /><main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">{children}</main></div></div>`.
- **Responsivo:** em `<lg`, sidebar some (substituída por drawer — implementar no `<Sidebar>`).

### T3. Criar `<Sidebar>`

- **Path:** `app/components/Sidebar.tsx`
- **Props:** `user: SessionUser`, `currentPath: string`.
- **Estrutura:** `<aside className="hidden lg:block w-60 border-r border-slate-200 bg-white p-4"><nav aria-label="Navegação principal"><ul className="space-y-1">{items.map(item => <li><NavLink to={item.href} className={...}>{item.label}</NavLink></li>)}</ul></nav></aside>`.
- **Itens do menu (sempre visíveis):**
  - `/app` → "Dashboard" (ícone: `<HomeIcon />`)
  - `/app/membros` → "Membros" (ícone: `<UsersIcon />`)
  - `/app/ministerios` → "Ministérios" (ícone: `<BuildingIcon />`)
  - `/app/alertas` → "Alertas" (ícone: `<BellIcon />`)
  - `/app/config/acolhimento` → "Configurações" (ícone: `<CogIcon />`)
- **Item ativo:** `<NavLink>` com className que adiciona `bg-cyan-50 text-cyan-900 font-medium` quando `currentPath === href`.
- **Logout** no rodapé do sidebar: `<form method="post" action="/logout"><button>Sair</button></form>`.

### T4. Criar `<TopbarAutenticada>`

- **Path:** `app/components/TopbarAutenticada.tsx`
- **Props:** `user: SessionUser`, `alertasNaoLidos: number`.
- **Estrutura:** `<header className="bg-white border-b border-slate-200 h-14 flex items-center px-4 sm:px-6 justify-between sticky top-0 z-10"><div className="flex items-center gap-2"><Link to="/app" className="font-semibold">Igreja Conect</Link></div><div className="flex items-center gap-2 sm:gap-3"><Link to="/app/alertas" aria-label={`${alertasNaoLidos} alertas não lidos`} className="relative p-2"><BellIcon />{alertasNaoLidos > 0 && <span className="absolute top-0 right-0 bg-amber-600 text-white text-xs rounded-full h-5 min-w-5 px-1 flex items-center justify-center">{alertasNaoLidos}</span>}</Link><Avatar user={user} /></div></header>`.

### T5. Criar `<CardKpi>`

- **Path:** `app/components/CardKpi.tsx`
- **Props:** `label: string`, `value: number | string`, `hint?: string`, `href?: string`, `tone?: "neutral" | "attention"` (default "neutral").
- **Estrutura:** se `href`, renderiza `<Link to={href} className="block p-4 border border-slate-200 rounded-lg bg-white hover:border-cyan-300 transition">`; senão `<div className="p-4 border border-slate-200 rounded-lg bg-white">`. Dentro: `<p className="text-sm text-slate-600">{label}</p><p className={cn("text-2xl font-bold mt-1", tone === "attention" ? "text-amber-700" : "text-slate-900")}>{value}</p>{hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}`.

### T6. Criar `<Atalho>`

- **Path:** `app/components/Atalho.tsx`
- **Props:** `label: string`, `icon: ReactNode`, `href: string`, `variant?: "primary" | "secondary"` (default "primary").
- **Estrutura:** `<Link to={href} className={cn("flex items-center gap-2 p-3 sm:p-4 rounded-lg border text-sm font-medium", variant === "primary" ? "bg-cyan-700 text-white border-cyan-700 hover:bg-cyan-800" : "bg-white text-slate-900 border-slate-300 hover:bg-slate-50")}>{icon}<span>{label}</span></Link>`.

### T7. Criar `<ListaRecente>`

- **Path:** `app/components/ListaRecente.tsx`
- **Props:** `items: { id: string, nome: string, badge: string, timestamp: string, href: string }[]`, `emptyMessage?: string`.
- **Estrutura:** se `items.length === 0`, mostra empty state. Senão: `<ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white">{items.map(item => <li key={item.id}><Link to={item.href} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"><div className="flex-1 min-w-0"><p className="font-medium text-slate-900 truncate">{item.nome}</p><p className="text-xs text-slate-500">{item.badge}</p></div><span className="text-sm text-slate-500 ml-2">{item.timestamp}</span><ChevronRight className="ml-2 h-4 w-4 text-slate-400" /></Link></li>)}</ul>`.

### T8. Criar `app/lib/dashboard.server.ts` (service)

- **Path:** `app/lib/dashboard.server.ts`
- **Função principal:** `getDashboardData(user: SessionUser): Promise<DashboardData>`.
- **Lógica:**
  - Define `where` base com escopo RBAC:
    - `DISCIPULADOR`: `discipuladorId = user.id` para filtros de discípulo; sem filtro para "membros ativos" total.
    - Outros: sem filtro (vê todos).
  - Faz 3 `count()` em paralelo via `Promise.all`:
    - `countMembrosAtivos = count(Membro where tipo = MEMBRO_ATIVO [+ escopo])`.
    - `countVisitantesMes = count(Membro where tipo = VISITANTE and createdAt >= firstDayOfMonth)`.
    - `countAlertasNaoLidos = count(AlertaDestinatario where membroId = user.id and lido = false)`.
  - Faz `findMany` para últimos 5 visitantes: `orderBy: { createdAt: "desc" }, take: 5`.
  - Retorna `{ kpis: { membrosAtivos, visitantesMes, alertasNaoLidos }, ultimosVisitantes: [...] }`.
- **JSDoc completo** (obrigatório).

### T9. Criar `app/routes/app.tsx` (layout)

- **Path:** `app/routes/app.tsx`
- **Loader:** chama `getUserFromRequest(request)` (backend agent cria). Se `null`, `throw redirect("/login?next=/app")`. Retorna `{ user, alertasNaoLidos }` (este último pode ser parte do helper do backend, ou calculado aqui via `count(AlertaDestinatario where membroId = user.id and lido = false)`).
- **Default export:** `<ShellAutenticado user={user} alertasNaoLidos={alertasNaoLidos} currentPath={location.pathname}><Outlet /></ShellAutenticado>`.
- **useLoaderData** no cliente.

### T10. Criar `app/routes/app/_index.tsx` (dashboard)

- **Path:** `app/routes/app/_index.tsx`
- **Loader:** chama `getDashboardData(user)`. Retorna `{ kpis, ultimosVisitantes }`.
- **Default export:**
  - `<Saudacao nome={user.nome} />`.
  - `<section><h2 className="sr-only">Indicadores</h2><div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-6"><CardKpi label="Membros ativos" value={kpis.membrosAtivos} href="/app/membros?tipo=MEMBRO_ATIVO" /><CardKpi label="Visitantes este mês" value={kpis.visitantesMes} href="/app/membros?tipo=VISITANTE" /><CardKpi label="Alertas não lidos" value={kpis.alertasNaoLidos} href="/app/alertas" tone={kpis.alertasNaoLidos > 0 ? "attention" : "neutral"} /></div></section>`.
  - `<section><h2 className="text-lg font-semibold mt-8 mb-3">Atalhos rápidos</h2><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><Atalho label="+ Cadastrar membro" href="/app/membros/novo" icon={<PlusIcon />} /><Atalho label="Ver alertas" href="/app/alertas" icon={<BellIcon />} variant="secondary" /><Atalho label="Ver membros" href="/app/membros" icon={<UsersIcon />} variant="secondary" /></div></section>`.
  - `<section><h2 className="text-lg font-semibold mt-8 mb-3">Últimos visitantes cadastrados</h2><ListaRecente items={ultimosVisitantes.map(v => ({ id: v.id, nome: v.nome, badge: "Visitante", timestamp: formatRelative(v.createdAt), href: `/app/membros/${v.id}` }))} emptyMessage="Nenhum visitante recente." /></section>`.

### T11. Helpers de UI

- `app/lib/format-date.ts`: `formatRelative(date: Date): string` (retorna "há 2 horas", "ontem", "12/06/2026"). **Helper puro, sem `Date.now()` em render** (passa data como prop).
- `app/lib/cn.ts`: pequeno utilitário para concatenar classes condicionalmente (5 linhas, sem `clsx` lib).

### T12. Registrar layout em `app/routes.ts`

- Verificar se há `layout("routes/app.tsx")` que engloba `routes/app/_index.tsx` e outras rotas `/app/**`. Se não, adicionar.

## Validações e regras

- **Nenhuma validação de payload** (read-only).
- **RBAC fina:** `getDashboardData(user)` aplica escopo automaticamente. UI não decide nada disso.

## Testes (TDD)

### T12.1. Teste do `formatRelative` (unit, puro)

- **Path:** `app/lib/format-date.test.ts`
- **Primeiro teste:** `formatRelative(new Date(Date.now() - 2 * 60 * 60 * 1000))` retorna string contendo "hora".

### T12.2. Teste do `<CardKpi>` (unit)

- Renderiza com `value={5}`, espera encontrar "5".

### T12.3. Teste do `<Saudacao>` (unit)

- Renderiza com `nome="João"` e `data={new Date("2026-06-12T10:00:00")}`, espera "Bom dia".

### T12.4. Teste do `getDashboardData` (integration, com DB em memória)

- Cria 3 membros (1 MEMBRO_ATIVO, 1 VISITANTE, 1 CONGREGADO), 1 alerta para o user.
- Chama service, espera `kpis.membrosAtivos === 1`, `kpis.alertasNaoLidos === 1`.

### T12.5. Teste E2E (Playwright) — `e2e/dashboard.spec.ts`

- Login com admin seed → `GET /app` → encontra saudação, 3 KPIs, 3 atalhos.
- Click em KPI "Membros ativos" → navega para `/app/membros?tipo=MEMBRO_ATIVO`.
- Click no item de "último visitante" → navega para o detalhe.

## Critérios de pronto

- [ ] Todos os testes passam.
- [ ] Cobertura ≥ 85% (componentes + service).
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] Lighthouse Best Practices ≥ 95.
- [ ] `pnpm typecheck` passa.
- [ ] Sem dado financeiro em payload (verificável via DevTools Network).
- [ ] Tempo de loader < 300ms p95 com 1k membros.

## Armadilhas comuns (RAGs relevantes)

- **RAG `architecture-monolith-modular.md`:** service em `lib/dashboard.server.ts` (sufixo `.server.ts`!). Componentes puros em `app/components/`. Rota chama service, nunca `db` direto.
- **RAG `security-rbac-matrix.md`:** `DISCIPULADOR` filtra por `discipuladorId === user.id`. Service aplica; UI só renderiza o resultado.
- **AGENTS §"YAGNI":** NÃO criar componentes de "loading shimmer" elaborados. Skeleton simples (5 linhas). NÃO criar dashboard "configurável" (filtros de KPI, etc.). MVP = 3 KPIs fixos.
- **Erro comum:** chamar `Date.now()` em render (quebra SSR). `formatRelative` recebe `Date` como prop.
- **Erro comum:** `currentPath` em prop em vez de `useLocation()`. O Shell recebe do loader para ser determinístico no SSR.
