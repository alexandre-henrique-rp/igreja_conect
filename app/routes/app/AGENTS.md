# AGENTS.md — app/routes/app/

Mapa de contexto carregado automaticamente. **Todas as rotas autenticadas `/app/**`** — middleware de auth é obrigatório (defense in depth).

## Propósito
Páginas internas do sistema: Membros, Financeiro (caixas, lançamentos, transferências, relatórios), Ministérios, Escalas, Cultos, Estoque, Alertas, Eventos, Células, Config. Layout compartilhado aplicado em `app/routes.ts:46` (`layout("routes/app/_middleware.tsx", [...])`).

## Dependências
- [app/routes/app/_middleware.tsx](file:///home/kingdev/Documentos/igreja_conect/app/routes/app/_middleware.tsx) — Auth middleware (lê cookie, seta `userContext`; redirect `/login?next=...` se anônimo).
- [app/lib/user-context.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/user-context.ts) — `createContext<SessionUser>` type-safe.
- [app/lib/members.server.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/members.server.ts) — `getMembroById`, `deleteMembro` (RN-MEM-04; escopo RBAC).
- [app/lib/convite.server.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/convite.server.ts) — `criarConvite` / `validarConvite` / `usarConvite` (RN-MEM-07).
- [app/lib/errors.ts](file:///home/kingdev/Documentos/igreja_conect/app/lib/errors.ts) — `BusinessRuleError`, `NotFoundError`.
- [app/components/](file:///home/kingdev/Documentos/igreja_conect/app/components/) — `Button`, `Modal`, `Tabs`, `TabelaMembros`, `FormMembro`, etc.

## Mapa de Arquivos
- [membros.$id.tsx](file:///home/kingdev/Documentos/igreja_conect/app/routes/app/membros.$id.tsx) — Detalhe (RBAC, modal convite, abas fidelidade/discipulado).
- [membros.$id.editar.tsx](file:///home/kingdev/Documentos/igreja_conect/app/routes/app/membros.$id.editar.tsx) — Edição do membro.
- [membros._index.tsx](file:///home/kingdev/Documentos/igreja_conect/app/routes/app/membros._index.tsx) — Lista com filtros e paginação.
- [membros.novo.tsx](file:///home/kingdev/Documentos/igreja_conect/app/routes/app/membros.novo.tsx) — Criação.
- [membros.$id.{discipulado,discipulador,ministerios,tipo}.tsx](file:///home/kingdev/Documentos/igreja_conect/app/routes/app/) — Abas internas do membro.
- [_middleware.tsx](file:///home/kingdev/Documentos/igreja_conect/app/routes/app/_middleware.tsx) — Auth (defense in depth).
- [_index.tsx](file:///home/kingdev/Documentos/igreja_conect/app/routes/app/_index.tsx) — Dashboard.
- **Membros**: `_index`, `membros.*`, `visitantes.*` (`_index`, `novo`, `$id` — Membro tipo VISITANTE).
- **Financeiro**: `financeiro._index`, `financeiro.caixas.*`, `financeiro.lancamentos.*`, `financeiro.transferencia-nova`, `financeiro.transferencias.*`, `financeiro.relatorios.*` (5 relatórios).
- **Ministérios**: `ministerios.*` (com `funcoesMinisterio`, `atividades`, `indisponibilidades`).
- **Escalas**: `escalas.*`, `escalas.novo`, `escalas.$id.editar`.
- **Estoque/Patrimônio**: `estoque.*` (com `movimentar`, `manutencao`, `retorno`, `baixa`, `_transicao`), `estoque.requisicoes.*`, `patrimonio.*` (`_index`, `novo`, `$id`).
- **Alertas**: `alertas._index`.
- **Eventos**: `eventos._index`, `eventos.novo`.
- **Células**: `celulas._index`, `celulas.novo`, `celulas.$id`, `celulas.$id.editar`.
- **Config**: `config.acolhimento`.