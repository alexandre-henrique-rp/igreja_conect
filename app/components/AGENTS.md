# AGENTS.md — app/components/

Mapa de contexto dos componentes reutilizáveis da interface autenticada e pública.

## Propósito
Primitivos, formulários, navegação, tabelas, modais e feedback visual da aplicação React Router. **Toda UI nova deve ser composta a partir de [app/components/ds/](./ds/) (Design System).**

## Dependências
- `react-router` para `Link`, `NavLink` e `Form`.
- `~/lib/cn` para composição de classes Tailwind.
- `~/lib/session.types` para o usuário autenticado.
- `~/components/ds` para primitivos (`Button`, `Card`, `Field`, etc.).
- Tailwind v4 com tokens semânticos (`bg-accent`, `text-fg`, `border-border`).

## Mapa de Arquivos
- [Sidebar.tsx](file:///home/kingdev/Documentos/igreja_conect/app/components/Sidebar.tsx) — Navegação desktop e conteúdo compartilhado com itens, RBAC e badges.
- [MobileNavigation.tsx](file:///home/kingdev/Documentos/igreja_conect/app/components/MobileNavigation.tsx) — Drawer mobile acessível com foco contido, Escape e scroll lock.
- [TopbarAutenticada.tsx](file:///home/kingdev/Documentos/igreja_conect/app/components/TopbarAutenticada.tsx) — Barra autenticada, alertas, avatar e toggle de tema.
- [TopbarPublica.tsx](file:///home/kingdev/Documentos/igreja_conect/app/components/TopbarPublica.tsx) — Barra pública (landing, login).
- [Dialog.tsx](file:///home/kingdev/Documentos/igreja_conect/app/components/Dialog.tsx) — Modal acessível base.
- [TabelaMembros.tsx](file:///home/kingdev/Documentos/igreja_conect/app/components/TabelaMembros.tsx) — Tabela desktop de membros.
- [CardMembro.tsx](file:///home/kingdev/Documentos/igreja_conect/app/components/CardMembro.tsx) — Cartão mobile de membro.
- [ds/](file:///home/kingdev/Documentos/igreja_conect/app/components/ds/) — **Catálogo de primitivos do Design System**.
- [_old/](file:///home/kingdev/Documentos/igreja_conect/app/components/_old/) — Componentes legados (não usar em código novo).

## Convenções
- **Sempre importar primitivos do DS:** `import { Button, Card, Field } from "~/components/ds"`.
- Todo controle interativo tem foco visível e rótulo acessível.
- Links navegam; botões executam ações.
- Não duplicar a configuração de navegação entre desktop e mobile.
- **Cores literais Tailwind proibidas** (`bg-cyan-700`, `text-blue-600`, `slate-200` etc.) — usar tokens semânticos.
- Arquivos `*.test.tsx` são mantidos pelo agente tester.