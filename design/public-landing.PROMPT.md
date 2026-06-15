# Landing Pública — Frontend Implementation Prompt

## Capability grant (paths allowlist do agent)

- **Paths de escrita:** `app/routes/public/index.tsx`, `app/components/TopbarPublica.tsx`, `app/components/CardInfo.tsx`, `app/components/Button.tsx` (se ainda não existir), `app/components/index.ts` (barrel).
- **Paths de leitura:** `app/root.tsx`, `app/app.css`, `design/PRODUCT.md`, `design/public-landing.DESIGN.md`, `agents/AGENTS.md`, `docs/architecture/ARCH.md`.
- **Boundary:** não criar pastas em `lib/`, `db/`, `prisma/`. Não tocar em service files. Não criar migrations.

## Contexto

Landing pública do Igreja Conect (sistema interno de gestão eclesiástica). Acessível em `/`. Dois objetivos: (1) identificar a igreja, (2) direcionar para login. **Não é uma página de marketing** — é a entrada operacional de um sistema interno.

- **Design detalhado:** [`design/public-landing.DESIGN.md`](./public-landing.DESIGN.md)
- **PRD:** [`PRD.html`](../../PRD.html) (escopo MVP)
- **AGENTS:** [`agents/AGENTS.md`](../../agents/AGENTS.md) (stack: RR7 7.16, Tailwind 4, path alias `~/*`)
- **RAGs relevantes:** `architecture-monolith-modular.md` (estrutura de pastas), `lgpd-igreja-conect.md` (sem analytics de terceiros)

## Tarefas

### T1. Criar `<TopbarPublica>` (componente compartilhado)

- **Path:** `app/components/TopbarPublica.tsx`
- **Responsabilidade:** topbar sticky com logo à esquerda e slot à direita (botão "Entrar" opcional, controlado por prop).
- **Props:** `entrarHref?: string` — se presente, renderiza `<Link to={entrarHref}>Entrar</Link>`. Se ausente, só o logo.
- **Estrutura:** `<header className="sticky top-0 z-10 bg-white border-b border-slate-200"><div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between"><Link to="/"><Logo /></Link>{entrarHref && <Link to={entrarHref}>...</Link>}</div></header>`.
- **Logo:** SVG inline simples (placeholder `<!-- Igreja Conect -->` por enquanto, ou um `<span className="font-semibold">Igreja Conect</span>`).
- **Acessibilidade:** `<header>` semântico, link do logo com `aria-label="Ir para a página inicial"`.

### T2. Criar `<CardInfo>` (componente reutilizável)

- **Path:** `app/components/CardInfo.tsx`
- **Responsabilidade:** card de informação com título, lista de items, e tom visual (disponível / planejado).
- **Props:** `title: string`, `items: string[]`, `tone: "available" | "planned"`, `description?: string`.
- **Visual:** `<section className="border border-slate-200 rounded-lg p-4 sm:p-6 bg-white"><h2 className="text-lg font-semibold text-slate-900 mb-2">{title}</h2>{description && <p className="text-sm text-slate-600 mb-3">{description}</p>}<ul className="space-y-1 text-sm text-slate-700">{items.map(i => <li key={i} className="flex gap-2"><span className={tone === "available" ? "text-cyan-700" : "text-slate-400"}>•</span><span>{i}</span></li>)}</ul></section>`.
- **Sem `forwardRef`, sem libs externas** — componente puro.

### T3. Criar `<Button>` (componente base, primeiro uso)

- **Path:** `app/components/Button.tsx`
- **Responsabilidade:** botão reutilizável com variantes e suporte a `as={Link}` (do react-router).
- **Props:** `variant: "primary" | "secondary" | "ghost" | "danger"`, `size?: "sm" | "md"`, `fullWidth?: boolean`, `as?: React.ElementType`, `to?: string`, `type?: "button" | "submit" | "reset"`, `disabled?: boolean`, `loading?: boolean`, `children: ReactNode`, mais props HTML padrão via spread.
- **Visual base:** `inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`.
- **Tamanhos:** `sm` = `h-9 px-3 text-sm`, `md` = `h-11 px-4 text-base`.
- **Variantes:**
  - `primary`: `bg-cyan-700 text-white hover:bg-cyan-800 active:bg-cyan-900`.
  - `secondary`: `bg-white text-slate-900 border border-slate-300 hover:bg-slate-50`.
  - `ghost`: `text-slate-700 hover:bg-slate-100`.
  - `danger`: `bg-red-700 text-white hover:bg-red-800`.
- **Loading state:** mostra `<Spinner />` (a ser criado ou inline `<svg className="animate-spin h-4 w-4" />`) antes do `children`, esconde children via opacity. `aria-busy="true"`.
- **Suporte a `as={Link}`:** se `to` for passado, renderiza `<Link to={to}>` com classes. Caso contrário, `<button>`.

### T4. Criar página `app/routes/public/index.tsx`

- **Path:** `app/routes/public/index.tsx`
- **Loader (`Route.LoaderArgs`):** tenta `getUserFromRequest(request)`. Se houver `user`, `throw redirect("/app")`. Senão, retorna `null`.
- **Default export (componente):**
  - Renderiza `<TopbarPublica entrarHref="/login" />`.
  - `<main>` com `max-w-3xl mx-auto px-4 py-12 sm:py-16`.
  - `<h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Igreja Conect</h1>`.
  - `<p className="text-base text-slate-600 mt-1">Sistema de gestão eclesiástica local</p>`.
  - `<CardInfo title="O que está disponível agora" items={[...]} tone="available" />` com 5 bullets (membros, discipulado, ministérios, acolhimento, alertas).
  - `<CardInfo title="Em desenvolvimento" items={[...]} tone="planned" />` com 3 bullets (financeiro, estoque, manutenção).
  - `<Button as={Link} to="/login" variant="primary" size="md" className="mt-6">Entrar no sistema →</Button>`.
  - `<footer>` simples: `© Igreja Conect 2026`.
- **Acessibilidade:** `<main id="main-content">` para skip link.
- **Sem JS pesado** — renderiza o mesmo no SSR e no client.

### T5. Registrar rota em `app/routes.ts`

- Verificar se `app/routes.ts` já tem `index("routes/public/index.tsx")`. Se não, adicionar.
- **Não** duplicar rotas (cuidado com a duplicata do bug pendente #8 do brief — esta rota é de página, não API).

## Validações e regras

- **Nenhuma** validação de payload (página estática).
- Loader é o único ponto de lógica: se autenticado, redirect.

## Testes (TDD — vermelho primeiro)

### T5.1. Teste unitário do `<TopbarPublica>`

- **Path:** `app/components/TopbarPublica.test.tsx`
- **Primeiro teste (red):** renderiza com `entrarHref="/login"`, espera encontrar link "Entrar".
- **Depois:** sem `entrarHref`, espera **não** encontrar link "Entrar".

### T5.2. Teste unitário do `<CardInfo>`

- **Path:** `app/components/CardInfo.test.tsx`
- **Primeiro teste:** renderiza com 3 items, espera encontrar 3 `<li>`.

### T5.3. Teste unitário do `<Button>`

- **Path:** `app/components/Button.test.tsx`
- **Primeiro teste:** renderiza com `variant="primary"`, espera ter classe `bg-cyan-700`.
- **Segundo teste:** com `loading={true}`, espera `aria-busy="true"`.

### T5.4. Teste E2E (Playwright) — `e2e/landing.spec.ts`

- `e2e/landing.spec.ts`
- **Chain 1:** `GET /` → 200, encontra `<h1>Igreja Conect</h1>`.
- **Chain 2:** Clica em "Entrar" → URL muda para `/login`.
- **Chain 3 (autenticado):** login com admin seed → `GET /` → redirect para `/app`.

## Critérios de pronto

- [ ] Todos os testes acima passam.
- [ ] Cobertura da página: ≥ 85% (loader + componentes).
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] Lighthouse Best Practices ≥ 95.
- [ ] Sem uso de `localStorage`, `sessionStorage`, cookies de tracking, analytics.
- [ ] `pnpm typecheck` passa.
- [ ] Build SSR funciona (curl `GET /` retorna HTML completo com `<h1>Igreja Conect</h1>`).

## Armadilhas comuns (RAGs relevantes)

- **RAG `architecture-monolith-modular.md`:** componentes em `app/components/`, **nunca** em `app/lib/`. Loader da rota **pode** chamar `getUserFromRequest` (helper em `lib/`) — é o único caminho aceitável de UI → lib.
- **RAG `lgpd-igreja-conect.md`:** sem tracking, sem fingerprinting. Nada de Google Analytics, Meta Pixel, etc. Apenas o que o usuário pediu.
- **AGENTS §"Tipografia":** `text-2xl sm:text-3xl` no h1, `text-base` no corpo. Não inventar tamanhos fora da escala.
- **YAGNI:** não criar `<Footer>` global, não criar `<Layout>`, não criar sistema de grid. Só o que esta página precisa.
