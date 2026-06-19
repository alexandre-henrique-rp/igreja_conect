# Design — Estoque Index Dashboard (Cycle 3, S11)

## Rota
`/app/estoque` — Dashboard de estoque (consumo + patrimônio)

## Componentes
- `<PageHeader title="Estoque">` com filtros
- `<KpiEstoque>` 4 cards (total itens, ativos, em manutenção, alertas críticos)
- `<ListaItensCard>` grid com thumbnail, nome, tipo (Estoque/Patrimônio), status, quantidade
- `<FiltroPorTipo>` (Estoque | Patrimônio | Todos)
- `<BuscaPorNome>` input com debounce

## RBAC Camada 1
- `<Can user={user} allow={["ADMIN","PASTOR","SECRETARIO","FINANCEIRO","DISCIPULADOR","LIDER_MINISTERIO"]}>`
- "Novo Item" botão: apenas ADMIN, SECRETARIO
- "Alertas Críticos" badge: todos veem

## Visual (Tailwind 4)
- Grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`
- Cards `bg-white rounded-lg border border-slate-200 p-4`
- Status badges:
  - DISPONIVEL → `bg-green-100 text-green-800`
  - EM_USO → `bg-blue-100 text-blue-800`
  - EM_MANUTENCAO → `bg-yellow-100 text-yellow-800`
  - BAIXADO → `bg-slate-200 text-slate-600`
  - QUANTIDADE_BAIXA → `bg-red-100 text-red-800`

## Acessibilidade
- `aria-label="Lista de itens em estoque"`
- Cards focáveis com `tabIndex={0}`
- Empty state com mensagem clara
- Filtros com `aria-describedby`
