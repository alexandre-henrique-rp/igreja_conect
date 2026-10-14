# Planejamento Mobile First — Igreja Conect

## Resumo executivo

Este diretório contém o planejamento de interface **mobile first** para cada tela do sistema Igreja Conect. Cada arquivo representa uma página (ou grupo de páginas correlatas) com:

- **Wireframe do estado atual (desktop/tablet)** — descrição estrutural do layout como está hoje.
- **Wireframe mobile first proposto** — reorganização dos elementos para telas pequenas, priorizando ação, legibilidade e polegar único.
- **Tokens de cores e tipografia** — com base no tema atual.
- **Decisões de UX** — por que determinados elementos foram movidos, ocultos ou transformados.

## Tokens de design (garantia de consistência)

| Token | Valor atual | Uso mobile |
|-------|-------------|------------|
| Fonte | `Inter`, `ui-sans-serif`, `system-ui` | Mantida em todos os textos; `font-sans` do Tailwind. |
| Cor primária | `blue-600` (#2563EB) | CTA, links, abas ativas, botões primários. |
| Cor de sucesso | `emerald-500/600` | Saldos, status positivos, confirmações. |
| Cor de alerta | `amber-500/600` | Badges de alertas, pendências. |
| Cor de perigo | `red-500/600` | Exclusão, estoque crítico, erros. |
| Fundo | `slate-50` | Body mobile. |
| Cards | `white`, borda `slate-200` | Mantidos, com sombra leve (`shadow-sm`). |
| Sidebar | `bg-[#0F172A]`, texto `slate-300` | Convertida em drawer hamburger (já existe componente `MobileNavigation`). |
| Topbar | `white`, borda `slate-200` | Fixa, 56–64 px, com hamburger, alertas e avatar. |

## Padrões transversais de mobile first

1. **Hamburger fixo + drawer**: todas as telas usam o `TopbarAutenticada` e `MobileNavigation` existentes.
2. **KPIs em carrossel ou grid 2-colunas**: nas dashboards, os cards de indicadores viram `scroll-snap` horizontal ou grid 2-colunas em telas < 640 px.
3. **Tabelas viram cards**: listagens complexas (`TabelaMembros`, `TabelaItensEstoque`, tabela de lançamentos) são convertidas para cards verticais com ações empilhadas.
4. **Modais em tela cheia**: em telas < 640 px, modais com formulários longos viram páginas dedicadas ou sheets de altura total.
5. **CTA flutuante (FAB)**: ações principais de criação podem migrar de botão no header para um FAB na parte inferior direita, evitando empurrar conteúdo para baixo.
6. **Abas com scroll horizontal**: quando há muitas abas (`financeiro._index`, `membros._index`), elas ficam com `overflow-x-auto` e sem quebra.
7. **Campos de formulário empilhados 1 coluna**: nunca 2 colunas em mobile; labels acima do input; teclado adaptado por tipo.
8. **Bottom bar de ações rápidas**: em listas longas, filtro e busca podem viver em uma barra flutuante inferior.

## Mapa de arquivos

- [`_index.md`](_index.md) — Dashboard (`/app`)
- [`membros.md`](membros.md) — Membros (`/app/membros`, `/app/membros/:id`, `/app/membros/novo`, `/app/membros/:id/editar`)
- [`financeiro.md`](financeiro.md) — Financeiro (`/app/financeiro` e sub-rotas)
- [`estoque.md`](estoque.md) — Estoque e Patrimônio (`/app/estoque`, `/app/estoque/requisicoes`)
- [`escalas.md`](escalas.md) — Escalas (`/app/escalas`, `/app/escalas/novo`)
- [`cultos.md`](cultos.md) — Cultos (`/app/cultos`, `/app/cultos/novo`)
- [`ministerios.md`](ministerios.md) — Ministérios (`/app/ministerios`, `/app/ministerios/:id`, `/app/ministerios/novo`)
- [`eventos.md`](eventos.md) — Eventos (`/app/eventos`, `/app/eventos/novo`)
- [`alertas.md`](alertas.md) — Alertas (`/app/alertas`)
- [`celulas.md`](celulas.md) — Células (`/app/celulas`, `/app/celulas/novo`)
- [`configuracoes.md`](configuracoes.md) — Config. Acolhimento (`/app/config/acolhimento`)

## Breakpoints de referência

- **Mobile pequeno**: 320–375 px
- **Mobile padrão**: 376–767 px
- **Tablet**: 768–1023 px
- **Desktop**: 1024 px+ (estado atual)

A estratégia é **mobile first**: os componentes são projetados para o menor breakpoint e escalam via `sm:`, `md:`, `lg:` do Tailwind.
