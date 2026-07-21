# AGENTS.md — app/routes/

Mapa de contexto carregado automaticamente. Apenas entry points + layouts top-level — rotas autenticadas vivem em `routes/app/`.

## Propósito
Páginas e layouts de borda do app: institucional (`/`), `/login`, `/logout`, aceite de convite (`/convite/:token`), shell raiz autenticado `/app`. Config declarativa de rotas.

## Dependências
- [app/lib/session.server.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/session.server.ts) — `sessionCookie`, `getUserFromRequest`, `deleteSession`.
- [app/lib/audit.server.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/audit.server.ts) — `safeLog` (LGPD: nunca loga sid puro).
- [app/lib/convite.server.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/convite.server.ts) — `validarConvite` / `usarConvite` consumidos por `public/convite.$token.tsx`.
- `react-router` (`Outlet`, `redirect`, `Form`, `data`, `useNavigation`, `useLoaderData`).

## Mapa de Arquivos
- [routes.ts](file:///home/kingdev/Documentos/igreja_conect/app/routes.ts) — Registra todas as rotas; layout `_middleware.tsx` envolve `/app/**`.
- [home.tsx](file:///home/kingdev/Documentos/igreja_conect/app/routes/home.tsx) — Boilerplate RR (`<Welcome />`), não usado em produção.
- [logout.tsx](file:///home/kingdev/Documentos/igreja_conect/app/routes/logout.tsx) — `/logout` (action + loader idempotentes; `Set-Cookie Max-Age=0`).
- [app.tsx](file:///home/kingdev/Documentos/igreja_conect/app/routes/app.tsx) — Shell `/app`: `Sidebar` + `TopbarAutenticada` + `<Outlet />`; loader conta `alertasNaoLidos`.
- [public/](file:///home/kingdev/Documentos/igreja_conect/app/routes/public/) — `/login`, `/convite/:token`, landing institucional.
- [private/](file:///home/kingdev/Documentos/igreja_conect/app/routes/private/) — Reservado (vazio).
- [app/](file:///home/kingdev/Documentos/igreja_conect/app/routes/app/) — Rotas autenticadas (ver `routes/app/AGENTS.md`).