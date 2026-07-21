# AGENTS.md — app/

Mapa de contexto carregado automaticamente. Subpastas têm AGENTS.md próprio.

## Propósito
Diretório da aplicação RR7 (framework mode): entry points (`root.tsx`), config de rotas (`routes.ts`), CSS global e subdomínios por responsabilidade (routes, components, lib, db, api, welcome).

## Dependências
- **Aliases:** `~/*` resolve para `app/*` (definido em `tsconfig.json` + vite). Tipos RR7 via `./+types/<arquivo>` (gerados por `react-router typegen` em `npm run typecheck`).
- **Convenção de sufixos:** `.server.ts` → server-only (tree-shaking do client); `.client.ts` → client-only; sem sufixo → isomorphic.
- **Runtime:** `react-router` 7.16, `react`/`react-dom` v19, `tailwindcss/vite` v4.

## Mapa de Arquivos
- [root.tsx](file:///home/kingdev/Documentos/igreja_conect/app/root.tsx) — `<html lang="en">`, `Layout`, `ErrorBoundary`, `<Outlet />`.
- [routes.ts](file:///home/kingdev/Documentos/igreja_conect/app/routes.ts) — `RouteConfig` declarativa (registra `/`, `/login`, `/logout`, `/convite/:token`, `/app/**`).
- [app.css](file:///home/kingdev/Documentos/igreja_conect/app/app.css) — Entry CSS Tailwind v4.
- [db/prisma.server.ts](file:///home/kingdev/Documentos/igreja_conect/app/db/prisma.server.ts) — Singleton Prisma (better-sqlite3) + `globalThis.__prisma` em dev.
- [routes/](file:///home/kingdev/Documentos/igreja_conect/app/routes/) — Páginas e layouts (ver `routes/AGENTS.md`).
- [lib/](file:///home/kingdev/Documentos/igreja_conect/app/lib/) — Services server-only, utils, schemas Zod, hooks (ver `lib/AGENTS.md`).
- [components/](file:///home/kingdev/Documentos/igreja_conect/app/components/) — UI primitivos e compostos (~80 componentes).
- [api/auth/](file:///home/kingdev/Documentos/igreja_conect/app/api/auth/) — Endpoints não-RR7.
- [welcome/](file:///home/kingdev/Documentos/igreja_conect/app/welcome/) — Boilerplate RR (rota legada `/home`).