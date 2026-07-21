# AGENTS.md — app/lib/

Mapa de contexto carregado automaticamente. **Camada de services (server-only) + utils + schemas + hooks.**

## Propósito
Regras de negócio, persistência Prisma, auth/sessão, RBAC, rate-limit, formatação e validação Zod. Sufixo `.server.ts` garante que nada vaze ao bundle do cliente.

## Dependências
- [app/db/prisma.server.ts](file:///home/kingdev/Documentos/igreja_conect/app/db/prisma.server.ts) — `prisma` singleton (better-sqlite3).
- [app/lib/session.server.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/session.server.ts) — `SessionUser`, `sessionCookie` (sliding 7d / absoluto 30d).
- `zod` (v4) para validação em `schemas/`.
- `bcryptjs` via [auth.server.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/auth.server.ts) — `hashPassword`.

## Mapa de Arquivos (★ = alvo da próxima task)
- [convite.server.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/convite.server.ts) — ★ **Alvo**. `import "dotenv/config"` + `getBaseUrl()` lendo `process.env.BASE_URL` dinamicamente (linhas 11–34); gera `textoConvite` com Markdown `*bold*` (linhas 72–82). `criarConvite` / `validarConvite` / `usarConvite`. Token UUID v4, expira 2h, uso único.
- [auth.server.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/auth.server.ts) — `hashPassword`, verificação de credenciais.
- [members.server.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/members.server.ts) — CRUD de membros + escopo RBAC (`MEMBRO_SAFE_SELECT`, nunca expõe `senhaHash`).
- [session.server.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/session.server.ts) — Sliding/absolute TTL; cookie `__session` (`httpOnly`, `sameSite=lax`, `secure` em prod).
- [rbac.server.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/rbac.server.ts) — `assertIsAdmin`, `canAccessMember`, matriz de cargos.
- [rate-limit.server.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/rate-limit.server.ts) — `getBlockedIPs`, `unblockIP`, contadores por IP.
- [errors.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/errors.ts) — `BusinessRuleError`, `NotFoundError`.
- [user-context.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/user-context.ts) — `userContext` (`createContext` RR7).
- [session.types.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/session.types.ts) — Tipo `SessionUser` exportado.
- Utils: [cn.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/cn.ts), [format-date.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/format-date.ts), [money-format.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/money-format.ts), [masks.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/masks.ts), [rbac-frontend.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/rbac-frontend.ts).
- [schemas/](file:///home/kingdev/Documentos/igreja_conect/app/lib/schemas/) — Zod: auth, membros, caixas, financeiro, alertas, estoque, etc.
- [hooks/useClientIP.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/hooks/useClientIP.ts) — Hook client-side.
- Demais services: `alerts`, `caixas`, `celulas`, `cultos`, `escalas`, `eventos`, `finance`, `itemEstoque`, `lancamentos`, `manutencao`, `ministries`, `movimentacao`, `patrimonio`, `relatorios`, `transferencias`, `config`, `discipleship`.