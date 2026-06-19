# PROMPT — Implementar Baixa por Perda (S12-T05)

## Task
Implementar rota `/app/patrimonio/:id/baixa` (baixa por perda/roubo/dano).

## Escopo
- Loader: assertCanBaixarPatrimonio (ADMIN only) + getPatrimonioDetalhe
- Action: validar Zod + soft-delete (RN-EST-05: ativo=false + statusItem=BAIXADO) + audit log
- UI: form com motivo + tipo perda + checkbox confirmação

## Acceptance Criteria
- [ ] Apenas ADMIN pode acessar (outros 403)
- [ ] Não pode dar baixa em item já BAIXADO (409)
- [ ] Motivo ≥ 20 chars (validação Zod)
- [ ] Tipo da perda ∈ enum TipoPerdaPatrimonio
- [ ] Checkbox obrigatório para habilitar submit
- [ ] Após sucesso: ItemEstoque.ativo = false, statusItem = BAIXADO
- [ ] Audit log com action="baixa_patrimonio", resource, motivo
- [ ] Soft delete (não hard delete) — histórico preservado

## TDD Instructions
1. Red: teste `darBaixaPatrimonio` happy path → 200, ativo=false, statusItem=BAIXADO
2. Red: teste SECRETARIO → 403
3. Red: teste item já BAIXADO → 409
4. Red: teste motivo < 20 chars → 400
5. Red: teste sem confirmação → 400
6. Green: implementar
7. Refactor

## JSDoc Obrigatório
- Service `darBaixaPatrimonio(id, input, user)` completo
- Helper `assertCanBaixarPatrimonio(user)` em rbac.server.ts
- Zod `BaixaSchema` com .strict()

## Output Esperado
- `app/routes/app/patrimonio.$id.baixa.tsx`
- `app/components/patrimonio/FormBaixa.tsx`
- `app/components/patrimonio/AvisoPermanente.tsx`
- Atualizar `app/lib/patrimonio.server.ts` (darBaixaPatrimonio)
- Atualizar `app/lib/rbac.server.ts` (assertCanBaixarPatrimonio)
- Atualizar `app/lib/schemas/patrimonio.ts` (BaixaSchema)
- Tests para todos
