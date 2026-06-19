# PROMPT — Implementar Estoque Index Dashboard

## Task
Implementar rota `/app/estoque` (Dashboard de Estoque + Patrimônio).

## Escopo
- Loader: assertCanSeeEstoque + listarItensEstoque({ tipo, busca })
- UI: 4 KPIs + grid de itens + filtros
- Componentes: `<KpiEstoque>`, `<ListaItensCard>`, `<FiltroPorTipo>`, `<BuscaPorNome>`

## Acceptance Criteria
- [ ] ADMIN/SECRETARIO/PATOR/FINANCEIRO/DISCIPULADOR/LIDER veem dashboard
- [ ] Filtros por tipo (Estoque | Patrimônio) e busca por nome funcionam
- [ ] KPIs calculados corretamente (total, ativos, em manutenção, alertas)
- [ ] Empty state quando 0 itens
- [ ] Loading state visível
- [ ] RBAC 3 camadas (UI esconde "Novo Item" para não-ADMIN/SECRETARIO)

## TDD Instructions
1. Red: teste do service `listarItensEstoque` com filtros
2. Red: teste do componente `<KpiEstoque>` renderizando números
3. Red: teste do loader verificando assertCanSeeEstoque
4. Green: implementar service + UI + loader
5. Refactor: limpar

## JSDoc Obrigatório
- Service `listarItensEstoque` com `@description`, `@param`, `@returns`, `@throws`
- Loader com `@description` mencionando assertCanSeeEstoque
- Componentes com prop types documentados

## Output Esperado
- `app/routes/app/estoque._index.tsx`
- `app/components/estoque/KpiEstoque.tsx`
- `app/components/estoque/ListaItensCard.tsx`
- `app/components/estoque/FiltroPorTipo.tsx`
- `app/components/estoque/BuscaPorNome.tsx`
- `app/lib/estoque.server.ts` (service)
- Tests para todos
- Build passa
