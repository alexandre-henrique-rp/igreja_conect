# AGENTS.md — app/components/

Mapa de contexto dos componentes reutilizáveis da interface autenticada e pública.

## Propósito
Primitivos, formulários, navegação, tabelas, modais e feedback visual da aplicação React Router.

## Dependências
- `react-router` para `Link`, `NavLink` e `Form`.
- `~/lib/cn` para composição de classes Tailwind.
- `~/lib/session.types` para o usuário autenticado.
- Tailwind v4; siga os padrões visuais existentes até a consolidação de tokens.

## Mapa de Arquivos
- [Sidebar.tsx](file:///home/kingdev/Documentos/igreja_conect/app/components/Sidebar.tsx) — Navegação desktop e conteúdo compartilhado com itens, RBAC e badges.
- [MobileNavigation.tsx](file:///home/kingdev/Documentos/igreja_conect/app/components/MobileNavigation.tsx) — Drawer mobile acessível com foco contido, Escape e scroll lock.
- [TopbarAutenticada.tsx](file:///home/kingdev/Documentos/igreja_conect/app/components/TopbarAutenticada.tsx) — Barra autenticada, alertas e avatar.
- [Dialog.tsx](file:///home/kingdev/Documentos/igreja_conect/app/components/Dialog.tsx) — Modal acessível base.
- [Button.tsx](file:///home/kingdev/Documentos/igreja_conect/app/components/Button.tsx) — Botão reutilizável com variantes e loading.
- [PageHeader.tsx](file:///home/kingdev/Documentos/igreja_conect/app/components/PageHeader.tsx) — Cabeçalho responsivo de página.
- [TabelaMembros.tsx](file:///home/kingdev/Documentos/igreja_conect/app/components/TabelaMembros.tsx) — Tabela desktop de membros.
- [CardMembro.tsx](file:///home/kingdev/Documentos/igreja_conect/app/components/CardMembro.tsx) — Cartão mobile de membro.

## Convenções
- Todo controle interativo tem foco visível e rótulo acessível.
- Links navegam; botões executam ações.
- Não duplicar a configuração de navegação entre desktop e mobile.
- Arquivos `*.test.tsx` são mantidos pelo agente tester.
