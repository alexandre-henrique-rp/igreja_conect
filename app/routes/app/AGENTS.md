# AGENTS.md — app/routes/app/

Mapa de contexto carregado automaticamente. **Todas as rotas autenticadas `/app/**`** — middleware de auth é obrigatório (defense in depth).

## Propósito
Páginas internas do sistema: Membros, Financeiro (caixas, lançamentos, transferências, relatórios), Ministérios, Escalas, Cultos, Estoque, Alertas, Eventos, Células, Config. Layout compartilhado aplicado em `app/routes.ts:46` (`layout("routes/app/_middleware.tsx", [...])`).

## Dependências
- [app/routes/app/_middleware.tsx](file:///home/kingdev/Documentos/igreja_conect/app/routes/app/_middleware.tsx) — Auth middleware (lê cookie, seta `userContext`; redirect `/login?next=...` se anônimo).
- [app/lib/user-context.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/user-context.ts) — `createContext<SessionUser>` type-safe.
- [app/lib/members.server.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/members.server.ts) — `getMembroById`, `deleteMembro` (RN-MEM-04; escopo RBAC).
- [app/lib/convite.server.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/convite.server.ts) — `criarConvite` (★ alvo da próxima task).
- [app/lib/errors.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/errors.ts) — `BusinessRuleError`, `NotFoundError`.
- [app/components/](file:///home/kingdev/Documentos/igreja_conect/app/components/) — `Button`, `Modal`, `Tabs`, `TabelaMembros`, `FormMembro`, etc.

## Mapa de Arquivos (★ = alvo da próxima task)
- [membros.$id.tsx](file:///home/kingdev/Documentos/igreja_conect/app/routes/app/membros.$id.tsx) — ★ **Alvo**. Loader (RBAC), action com `intent=gerar-convite` (linhas 136–157), modal convite (linhas 394–449) + `handleCopy` (210–215) copia `textoConvite` bruto.
- [membros.$id.editar.tsx](file:///home/kingdev/Documentos/igreja_conect/app/routes/app/membros.$id.editar.tsx) — Edição do membro.
- [membros._index.tsx](file:///home/kingdev/Documentos/igreja_conect/app/routes/app/membros._index.tsx) — Lista com filtros e paginação.
- [membros.novo.tsx](file:///home/kingdev/Documentos/igreja_conect/app/routes/app/membros.novo.tsx) — Criação.
- [membros.$id.{discipulado,discipulador,ministerios,tipo}.tsx](file:///home/kingdev/Documentos/igreja_conect/app/routes/app/) — Abas internas do membro.
- [_middleware.tsx](file:///home/kingdev/Documentos/igreja_conect/app/routes/app/_middleware.tsx) — Auth (defense in depth).
- [_index.tsx](file:///home/kingdev/Documentos/igreja_conect/app/routes/app/_index.tsx) — Dashboard placeholder.
- Demais: `financeiro.*.tsx`, `ministerios.*.tsx`, `escalas.*.tsx`, `cultos.*.tsx`, `estoque.*.tsx`, `eventos._index.tsx`, `alertas._index.tsx`, `celulas._index.tsx`, `config.acolhimento.tsx`, `patrimonio.tsx`.