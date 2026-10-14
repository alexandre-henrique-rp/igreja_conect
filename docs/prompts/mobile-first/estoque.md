# Mobile First — Módulo Estoque

## Rotas
- `/app/estoque` (`app/routes/app/estoque._index.tsx`)
- `/app/estoque/novo`, `/:id`, `/:id/baixa`, `/:id/manutencao`, `/:id/movimentar`, `/:id/retorno`
- `/app/estoque/requisicoes` e sub-rotas
- `/app/patrimonio` (redireciona para `/app/estoque?tipo=PATRIMONIO`)

---

## 1. Dashboard de Estoque (`/app/estoque`)

### Estado atual

```
┌────────────────────────────────────────────────────────────────┐
│ Estoque                                                        │
│ [Requisições] [Arquivados] [Cadastro Rápido]                   │
│                                                                │
│ [KPIs: Total, Crítico, Disponível, Manutenção]                 │
│                                                                │
│ [Lista de produtos em tabela: Nome, Tipo, Qtd, Local, Ações]   │
│                                                                │
│ [Nova Movimentação]                                            │
└────────────────────────────────────────────────────────────────┘
```

### Mobile first

```
┌─────────────────────┐
│ ← Estoque           │
│ Estoque             │
├─────────────────────┤
│ [KPIs scroll]       │
│ Total · Crítico ·   │
│ Disponível · Manut. │
├─────────────────────┤
│ ┌─────────────────┐ │
│ 🔍 Pesquisar prod.│ │
│ └─────────────────┘ │
│ [Filtro tipo] [Arq] │ ← filtros compactos em linha
├─────────────────────┤
│ [Produto 1]         │
│ Nome do item        │
│ Consumo · Cozinha   │
│ Qtd: 45  Mín: 10    │
│ [Movimentar] [Editar]│
│                     │
│ [Produto 2]         │
│ Nome do item        │
│ Patrimônio · Sonor. │
│ Qtd: 12             │
├─────────────────────┤
│ [+] Nova Movimentação│ ← FAB fixo inferior
│ [+] Cadastro Rápido  │
└─────────────────────┘
```

### Decisões

- **KPIs em carrossel**: 4 indicadores de estoque em scroll horizontal.
- **Busca + filtros em barra flutuante**: campo de busca + chips de filtro por tipo (`CONSUMO`/`PATRIMONIO`) e arquivados.
- **Tabela → cards de produto**: cada linha vira card com nome, tipo badge, local, quantidade atual vs. mínima, e botões de ação.
- **Itens críticos**: destaque com borda `red-200`, fundo `red-50` e badge de alerta.
- **FABs**: “Nova Movimentação” e “Cadastro Rápido” em barra fixa inferior.

---

## 2. Modais de Estoque em Mobile

Os modais atuais (`Nova Movimentação`, `Novo Produto`, `Editar Produto`) são centralizados. Em mobile, converter para **sheets de altura total** ou **páginas dedicadas**.

### Nova Movimentação (mobile)

```
┌─────────────────────┐
│ ✕ Nova Movimentação │
├─────────────────────┤
│ Produto *           │
│ ▼ Selecione...      │
│                     │
│ Tipo                │
│ ( ) Entrada  ( ) Saída│
│                     │
│ Quantidade          │
│ [ 1 ]               │
│                     │
│ Data                │
│ [__/__/____]        │
│                     │
│ Retirante           │
│ Nome                │
│                     │
│ Observação          │
│                     │
│ [Salvar]            │
└─────────────────────┘
```

### Novo Produto (mobile)

```
┌─────────────────────┐
│ ✕ Novo Produto      │
├─────────────────────┤
│ Nome do produto *   │
│                     │
│ Tipo *              │
│ Consumo / Patrimônio│
│                     │
│ Setor *             │
│ ▼ Cozinha           │
│                     │
│ Quantidade inicial  │
│ Qtd mínima (alerta) │
│ Número de série     │  ← somente patrimônio
│                     │
│ Descrição           │
│                     │
│ [Salvar]            │
└─────────────────────┘
```

### Decisões

- **Modais em tela cheia**: header fixo com título e “X”, conteúdo rolável, botão fixo na base.
- **Campos condicionais**: número de série aparece apenas quando tipo = `PATRIMONIO`.
- **Teclado numérico** para quantidades.

---

## 3. Requisições (`/app/estoque/requisicoes`)

### Mobile first

```
┌─────────────────────┐
│ ← Requisições       │
│ Requisições         │
├─────────────────────┤
│ [Pendentes] [Aprov.]│
│ [Todas]             │
├─────────────────────┤
│ [Requisição 1]      │
│ Solicitante         │
│ 3 itens · 12/08/26  │
│ Status: Pendente    │
│ [Aprovar] [Ver]     │
│                     │
│ [Requisição 2]      │
│ Solicitante         │
│ 1 item · 10/08/26   │
│ Status: Aprovada    │
│ [Ver]               │
├─────────────────────┤
│ [+] Nova Requisição │
└─────────────────────┘
```

### Decisões

- **Status badges**: `Pendente` (amber), `Aprovada` (emerald), `Rejeitada` (red).
- **Ações contextuais**: cada card exibe botões permitidos pelo RBAC.
- **Detalhe**: expandir card ou abrir tela dedicada.

---

## 4. Patrimônio

Como `/app/patrimonio` redireciona para `/app/estoque?tipo=PATRIMONIO`, a mesma tela de estoque é aplicada com o filtro `PATRIMONIO` pré-selecionado. Adicionar um **chip ativo** no topo e manter ações específicas de patrimônio (manutenção, baixa, retorno).

### Decisões

- **Filtro pré-selecionado**: chip `Patrimônio` ativo ao carregar.
- **Ações por item**: em mobile, menu de ações (`...`) com opções: `Movimentar`, `Manutenção`, `Baixa`, `Retorno`.
