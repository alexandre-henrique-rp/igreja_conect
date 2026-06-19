# Design — Patrimônio Baixa por Perda (Cycle 3, S12)

## Rota
`/app/patrimonio/:id/baixa` — Dar baixa em item por perda/roubo/dano

## Componentes
- `<PageHeader title="Dar baixa por perda">` com warning
- `<CardPatrimonioResumo>` dados do item
- `<FormBaixa>` com:
  - Motivo da baixa (textarea obrigatório, min 20 chars)
  - Data da perda (date, default hoje)
  - Tipo da perda (select: ROUBO | DANO | OBSOLESCENCIA | OUTRO)
  - Confirmação dupla (checkbox "Confirmo que este item será removido do patrimônio")
  - Submit "Confirmar baixa" (vermelho)
- `<AvisoPermanente>` alert dizendo que ação é irreversível

## RBAC Camada 1
- Apenas ADMIN pode dar baixa
- Botão confirmar desabilitado até checkbox marcado

## Visual
- Página com `bg-red-50` header (atenção)
- Form `flex flex-col gap-4`
- Botão submit `bg-red-700 text-white hover:bg-red-800`
- Alert "Esta ação não pode ser desfeita" com ícone

## Acessibilidade
- `<label>` em cada campo
- `aria-required` em obrigatórios
- Foco no campo "Motivo" ao carregar
- Mensagem de confirmação antes de submeter

## Fluxo
1. User clica "Dar baixa" no detalhe do patrimônio
2. Form pede motivo (obrigatório, texto longo)
3. Tipo da perda (enum)
4. Checkbox de confirmação
5. Submit → soft-delete (RN-EST-05): ItemEstoque.ativo = false + statusItem = BAIXADO + audit log
6. Redirect para `/app/patrimonio` com mensagem
