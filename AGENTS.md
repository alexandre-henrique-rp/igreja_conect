# AGENTS.md — Igreja Conect

Mapa de contexto carregado automaticamente por agentes do harness.

## Propósito
Sistema de gestão para igrejas: membros, ministérios, finanças, escalas, cultos, estoque, alertas. RR7 SSR + Prisma + SQLite + Tailwind v4.

## Dependências
- **Runtime:** Node 24, React 19, React Router 7.16 (`react-router.config.ts`), Prisma 7 + `@prisma/adapter-better-sqlite3`.
- **Server:** bcryptjs, zod (v4), dotenv.
- **UI/estilo:** Tailwind v4 (`@tailwindcss/vite`), Inter via Google Fonts em [app/root.tsx](file:///home/kingdev/Documentos/igreja_conect/app/root.tsx).
- **Qualidade:** Vitest 4 + jsdom, Playwright 1.60, `@vitest/coverage-v8`.
- **Env (`.env`):** `SESSION_SECRET` (obrigatório em prod, ≥32 chars), `DATABASE_URL`, `BASE_URL` (define host do convite).

## Mapa de Arquivos
- [app/root.tsx](file:///home/kingdev/Documentos/igreja_conect/app/root.tsx) — Layout HTML + ErrorBoundary.
- [app/routes.ts](file:///home/kingdev/Documentos/igreja_conect/app/routes.ts) — Config declarativa de rotas.
- [react-router.config.ts](file:///home/kingdev/Documentos/igreja_conect/react-router.config.ts) — SSR + flags v8.
- [prisma/schema.prisma](file:///home/kingdev/Documentos/igreja_conect/prisma/schema.prisma) — Schema do banco (SQLite).
- [.env](file:///home/kingdev/Documentos/igreja_conect/.env) — `BASE_URL=https://appalianca.esmirna.com.br` (origem do link do convite).
- [package.json](file:///home/kingdev/Documentos/igreja_conect/package.json) — Scripts (`dev`, `build`, `test`, `db:*`).
- [app/lib/convite.server.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/convite.server.ts) — ★ Alvo da próxima task (base URL + texto Markdown `*bold*`).
- [app/routes/app/membros.$id.tsx](file:///home/kingdev/Documentos/igreja_conect/app/routes/app/membros.$id.tsx) — ★ Alvo (modal de convite, render Markdown preservando cópia bruta).