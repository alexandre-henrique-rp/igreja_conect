# PROMPT — Implementar Envio para Manutenção (S12-T04)

## Task
Implementar rota `/app/patrimonio/:id/manutencao` (envio para manutenção externa).

## Escopo
- Loader: assertCanSendToMaintenance (ADMIN only) + getPatrimonioDetalhe
- Action: validar Zod + criar ManutencaoAtivo + atualizar ItemEstoque.statusItem = EM_MANUTENCAO
- UI: form com data envio + previsão retorno + custo + descrição

## Acceptance Criteria
- [ ] Apenas ADMIN pode acessar (outros 403)
- [ ] Não pode enviar item já EM_MANUTENCAO (409)
- [ ] Não pode enviar item BAIXADO (409)
- [ ] Data de envio <= previsão retorno (validação Zod)
- [ ] Custo ≥ 0
- [ ] Descrição obrigatória (min 10 chars)
- [ ] Após sucesso, status do item = EM_MANUTENCAO
- [ ] Histórico mostra nova manutenção no topo

## TDD Instructions
1. Red: teste `criarManutencaoAtivo` com happy path
2. Red: teste com item já em manutenção → 409
3. Red: teste com SECRETARIO → 403
4. Green: implementar service + action + UI
5. Refactor

## JSDoc Obrigatório
- Service `criarManutencaoAtivo(id, input, user)` completo
- Helper `assertCanSendToMaintenance(user)` em rbac.server.ts

## Output Esperado
- `app/routes/app/patrimonio.$id.manutencao.tsx`
- `app/components/patrimonio/FormManutencao.tsx`
- `app/components/patrimonio/CardPatrimonioResumo.tsx`
- `app/components/patrimonio/HistoricoManutencoes.tsx`
- Atualizar `app/lib/patrimonio.server.ts`
- Atualizar `app/lib/rbac.server.ts` (assertCanSendToMaintenance)
- Tests para todos
