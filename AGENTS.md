# AGENTS.md — Igreja Conect

Mapa de contexto carregado automaticamente por agentes do harness. **Ler antes de qualquer tool call.**

## Propósito
Sistema de gestão para igrejas: membros, ministérios, finanças, escalas, cultos, estoque, patrimônio, alertas, células, eventos e storage. **RR7 SSR + Prisma 7 + SQLite + Tailwind v4.** Monólito modular, 1 processo Node, 12+ models Prisma.

## Dependências
- **Runtime:** Node 24, React 19, React Router 7.16, Prisma 7.8 + `@prisma/adapter-better-sqlite3`.
- **Server:** bcryptjs (hash), zod v4, dotenv, AWS SDK S3.
- **UI:** Tailwind v4 (`@tailwindcss/vite`), Inter em [app/root.tsx](file:///home/kingdev/Documentos/igreja_conect/app/root.tsx).
- **Qualidade:** Vitest 4 + jsdom, Playwright 1.60, `@vitest/coverage-v8`.
- **Env (`.env`):** `SESSION_SECRET` (≥32 chars), `DATABASE_URL`, `BASE_URL`, `ADMIN_*`, `STORAGE_*`.

## Mapa de Arquivos (raiz)
- [README.md](file:///home/kingdev/Documentos/igreja_conect/README.md) — Quick start + stack.
- [docs/REGRAS_DE_NEGOCIO.md](file:///home/kingdev/Documentos/igreja_conect/docs/REGRAS_DE_NEGOCIO.md) — **RN-XXX**: regras operacionais.
- [docs/DESCRIÇÃO_DOS_MODULOS.md](file:///home/kingdev/Documentos/igreja_conect/docs/DESCRIÇÃO_DOS_MODULOS.md) — Matriz RBAC + escopo.
- [docs/GUIDELINES.md](file:///home/kingdev/Documentos/igreja_conect/docs/GUIDELINES.md) — **Convenções de código e processo**.
- [docs/architecture/ARCH.md](file:///home/kingdev/Documentos/igreja_conect/docs/architecture/ARCH.md) — Arquitetura técnica.
- [prisma/schema.prisma](file:///home/kingdev/Documentos/igreja_conect/prisma/schema.prisma) — Schema (27 models, 14 enums).
- [package.json](file:///home/kingdev/Documentos/igreja_conect/package.json) — Scripts (`dev`, `build`, `test`, `db:*`).
- [.harness/](file:///home/kingdev/Documentos/igreja_conect/.harness/) — Harness v6: state, RAG, sprints.

## Mapa de Subpastas
- [app/](file:///home/kingdev/Documentos/igreja_conect/app/AGENTS.md) — Entry points + subdomínios.
- [app/components/ds/](file:///home/kingdev/Documentos/igreja_conect/app/components/ds/) — **Design System (30+ primitivos)**.
- [app/components/_old/](file:///home/kingdev/Documentos/igreja_conect/app/components/_old/) — Componentes legados (não usar em código novo).
- [app/lib/](file:///home/kingdev/Documentos/igreja_conect/app/lib/AGENTS.md) — Services server-only + schemas Zod.
- [app/routes/](file:///home/kingdev/Documentos/igreja_conect/app/routes/AGENTS.md) — Entry points + layouts top-level.
- [app/routes/app/](file:///home/kingdev/Documentos/igreja_conect/app/routes/app/AGENTS.md) — **Rotas autenticadas `/app/**`**.
- [app/components/](file:///home/kingdev/Documentos/igreja_conect/app/components/AGENTS.md) — UI específica do domínio.
- [app/lib/storage/](file:///home/kingdev/Documentos/igreja_conect/app/lib/storage/) — Pipeline de uploads.

## Design System (obrigatório)

**Toda UI passa pelos tokens semânticos.** Cores literais Tailwind (`bg-cyan-700`, `text-blue-600`, `bg-red-50`, `slate-*`) são proibidas fora dos primitivos.

- **Tokens:** `app/app.css` (`@theme` com OKLCH). Utilities: `bg-accent`, `text-fg`, `bg-surface`, `border-border`, `bg-success-soft`, `text-danger`, `bg-warning`, etc.
- **Catálogo:** `app/components/ds/` — 30+ primitivos (`Button`, `Card`, `Field`, `Input`, `Select`, `Badge`, `Avatar`, `Tabs`, `Stepper`, `KpiCard`, `PageHeader`, `Section`, `FormSection`, etc.).
- **Skill do projeto:** [.opencode/skills/ds-master/SKILL.md](file:///home/kingdev/Documentos/igreja_conect/.opencode/skills/ds-master/SKILL.md) — catálogo + regras + exemplos de endpoint.
- **Dark mode:** automático via `prefers-color-scheme` + toggle manual em `TopbarAutenticada`. Provider em [app/lib/theme.client.tsx](file:///home/kingdev/Documentos/igreja_conect/app/lib/theme.client.tsx).
- **Padrão de endpoint autenticado:** `<PageHeader>` → `<Section>` → `<Card>` + `<FormSection>` / `<FormFooter>`.
- **Padrão de endpoint público:** `<AuthLayout>` ou `<LandingLayout>`.

## Convenções Críticas (detalhes em [docs/GUIDELINES.md](file:///home/kingdev/Documentos/igreja_conect/docs/GUIDELINES.md))
- **Sufixo `.server.ts`** = server-only (tree-shaking). **`.client.ts`** = client-only. Sem sufixo = isomorphic.
- **Valores monetários:** `Int` em **centavos** (`*Centavos`). NUNCA `Float`/`Decimal`. Helpers em [app/lib/money.server.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/money.server.ts).
- **RBAC em 3 camadas:** UI → loader/action (`requireRole`/`assertCan*`) → service. Single source: [app/lib/rbac.server.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/rbac.server.ts).
- **LGPD:** IPs como SHA-256; dízimos só ADMIN/PASTOR/FINANCEIRO (RN-MEM-03); soft-delete em `Upload`.
- **Idempotência:** transferências entre caixas com `idempotencyKey` UUID v4.
- **TDD:** obrigatório (Strict) ou recomendado (Lean) — ver `.harness/state.json`.

## Workflow do Harness v6
1. **Fase 0 Briefing** → `brief.md` aprovado.
2. **Fase 1 Documentação** → `AGENTS.md` + RAGs.
3. **Fase 2 Requisitos** → `PRD.md` + `SPEC.md`.
4. **Fase 3 Design** → `<page>.DESIGN.md` + `<page>.PROMPT.md`.
5. **Fase 4 Planejamento** → `sprints/S*.json`.
6. **Fase 5 Build + QA** → 6 workers paralelos (backend + frontend + tester + security + lgpd + code-reviewer).
7. **Fase 6 UX Gate** → Aprovação humana do marco.
