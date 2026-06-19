# Design — Patrimônio Manutenção (Cycle 3, S12)

## Rota
`/app/patrimonio/:id/manutencao` — Enviar item do patrimônio para manutenção

## Componentes
- `<PageHeader title="Enviar para manutenção">`
- `<CardPatrimonioResumo>` thumbnail + nome + status atual
- `<FormManutencao>` com:
  - Data de envio (default hoje)
  - Previsão de retorno (date picker)
  - Custo estimado (R$ centavos)
  - Descrição do problema (textarea, max 500 chars)
  - Submit "Enviar"
- `<HistoricoManutencoes>` tabela abaixo

## RBAC Camada 1
- Apenas ADMIN pode enviar para manutenção
- Outros perfis veem apenas histórico (read-only)

## Visual
- Card `bg-yellow-50 border-yellow-300` (warning state)
- Form com `gap-4 flex flex-col`
- Tabela histórico: Data envio | Previsão | Custo | Status | Ações

## Acessibilidade
- Date picker acessível
- `<label>` em cada campo
- `aria-required` em campos obrigatórios
- Mensagem de erro inline por campo

## Fluxo
1. User clica "Enviar para manutenção" no detalhe do patrimônio
2. Form pré-preenchido com data de envio = hoje
3. Submit → criar ManutencaoAtivo + atualizar statusItem para EM_MANUTENCAO
4. Sucesso → redirect para detalhe com mensagem de confirmação
