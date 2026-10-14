# Mobile First — Módulo Financeiro

## Rotas
- `/app/financeiro` (`app/routes/app/financeiro._index.tsx`)
- `/app/financeiro/lancamentos/novo` e `/:id`
- `/app/financeiro/caixas` e sub-rotas
- `/app/financeiro/transferencias` e `/nova`
- `/app/financeiro/relatorios` (`_index`, `balancete`, `dre`, `fluxo-caixa`, `customizado`)

---

## 1. Dashboard Financeiro (`/app/financeiro`)

### Estado atual

```
┌────────────────────────────────────────────────────────────────────┐
│ Gestão Financeira                                                  │
│                                                                    │
│ [Entradas]      [Saídas]         [Saldo Disponível]               │
│ R$ ...          R$ ...           R$ ...                            │
│                                                                    │
│ Caixas Ativos (n)                                                  │
│ [Card Caixa 1] [Card Caixa 2] [Card Caixa 3]                       │
│                                                                    │
│ Contribuições | Despesas | Aprovações[n] | Solicitações           │
│ [Nova Caixa] [Transferência] [Novo Lançamento]                    │
│                                                                    │
│ [Buscar....................] [filter] [sort]                      │
│                                                                    │
│ Tabela: Descrição | Categoria | Data | Valor | Status | Ações     │
│                                                                    │
│ 1 2 3 ... Próximo                                                  │
│                                                                    │
│ [Resumo Anual - gráfico de barras 12 meses]                       │
│ [Relatórios Inteligentes - cards]                                 │
└────────────────────────────────────────────────────────────────────┘
```

### Mobile first

```
┌─────────────────────┐
│ ← Financeiro        │
│ Gestão Financeira   │
├─────────────────────┤
│ ◄ [Resumo cards] ►  │  ← carrossel de KPIs
│ Entradas · Saídas · │
│ Saldo               │
├─────────────────────┤
│ Caixas Ativos       │
│ ┌───────────────┐   │
│ │ Nome do caixa │   │
│ │ R$ 1.234,56   │   │
│ └───────────────┘   │  ← cards verticais
├─────────────────────┤
│ Contrib · Despesas  │
│ Aprov · Solicit     │  ← tabs scroll horizontal
├─────────────────────┤
│ [Buscar lançamentos]│
│ ┌─────────────────┐ │
│ │                 │ │
│ └─────────────────┘ │
│ [Filtro] [A-Z]      │
├─────────────────────┤
│ [+] Novo Lançamento │ ← CTA flutuante ou barra inferior
│ [+] Nova Transferência│
├─────────────────────┤
│ [Card lançamento]   │
│ + R$ 500,00         │
│ Dízimo · 05/08/2026 │
│ Confirmado          │
│                     │
│ [Card lançamento]   │
│ - R$ 120,00         │
│ Compra estoque      │
├─────────────────────┤
│ ◀ 1 2 3 ▶          │
├─────────────────────┤
│ Resumo Anual        │
│ [mini gráfico]      │  ← barras finas, scroll horizontal
├─────────────────────┤
│ Relatórios          │
│ Balancete · DRE ·   │
│ Fluxo de Caixa ·    │
│ Customizado         │
└─────────────────────┘
```

### Decisões

- **KPIs carrossel**: 3 cards, 1 visível em 320 px, 2 em 360 px, com `snap-x`.
- **Caixas como lista vertical**: card com nome, saldo e mini gráfico de barra de progresso.
- **Ações primárias em barra inferior fixa**: botões “Novo Lançamento” e “Transferência” fixos no rodapé (`sticky bottom-4`) para acesso rápido em listas longas.
- **Tabela → cards de lançamento**: cada linha vira um card com ícone de entrada/saída, valor em cor correspondente, categoria, data e status badge.
- **Gráfico anual**: reduzir para 6 barras visíveis com scroll horizontal; tooltip no hover/touch.

---

## 2. Lançamentos — Novo/Editar

### Mobile first

```
┌─────────────────────┐
│ ← Novo Lançamento   │
│                     │
│ Tipo *              │
│ ( ) Entrada   ( ) Saída │
│                     │
│ Categoria *         │
│ ┌───────────────┐   │
│ ▼ Dízimo        │   │
│ └───────────────┘   │
│                     │
│ Valor *             │
│ R$ 0,00             │
│                     │
│ Caixa *             │
│ ▼ Dízimo geral      │
│                     │
│ Data da competência │
│ 13/08/2026          │
│                     │
│ Membro (opcional)   │
│ Descrição           │
│                     │
│ [Salvar Lançamento] │
└─────────────────────┘
```

### Decisões

- **Radio de tipo em linha ou coluna**: em 320 px pode ser coluna; em 360+ px, 2 colunas.
- **Valor com teclado numérico**: `input type="number"`/`tel` para abrir teclado numérico.
- **Campos empilhados**: manter 1 coluna; select de caixa com altura 48 px.
- **Salvar fixo na base**: em telas pequenas, manter botão visível ao rolar.

---

## 3. Transferências (`/app/financeiro/transferencias` e `/nova`)

### Mobile first

```
┌─────────────────────┐
│ ← Nova Transferência│
│                     │
│ Origem *            │
│ ▼ Caixa A           │
│                     │
│ Destino *           │
│ ▼ Caixa B           │
│                     │
│ Valor *             │
│ R$ 0,00             │
│                     │
│ Data *              │
│                     │
│ Chave de idempotência│
│ [ UUID gerado ]     │
│                     │
│ [Confirmar Transferência]│
└─────────────────────┘
```

### Decisões

- **Confirmação em modal simplificado**: mobile mostra um `Dialog` compacto perguntando “Confirmar transferência de R$ X de A para B?”.
- **Idempotência visível**: campo `idempotencyKey` em modo leitura com botão de copiar.

---

## 4. Relatórios (`/app/financeiro/relatorios`)

### Mobile first

```
┌─────────────────────┐
│ ← Relatórios        │
│                     │
│ Balancete           │
│ DRE                 │  ← lista de cards/links
│ Fluxo de Caixa      │
│ Customizado         │
│                     │
│ Filtro por data     │
│ de __/__/____       │
│ até __/__/____      │
├─────────────────────┤
│ [Selecionado]       │
│ Resumo              │
│ [dados]             │
│                     │
│ Tabela resumida     │
│ expandível          │
└─────────────────────┘
```

### Decisões

- **Relatórios como menu de cards**: em vez de abas, cada relatório vira um card que abre uma tela separada.
- **Tabelas de relatórios**: resumir a 3 colunas; linhas clicáveis para expandir detalhes.
- **Exportar**: botão de ação no header da tela de relatório.
