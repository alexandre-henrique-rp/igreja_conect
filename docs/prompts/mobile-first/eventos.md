# Mobile First — Módulo Eventos

## Rotas
- `/app/eventos` (`app/routes/app/eventos._index.tsx`)
- `/app/eventos/novo` (`app/routes/app/eventos.novo.tsx`)
- `/app/eventos/:id` (se existir)

---

## 1. Lista de Eventos (`/app/eventos`)

### Estado atual

```
┌─────────────────────────────────────────────────────────────┐
│ Eventos                                      [+ Novo Evento]│
│                                                             │
│ [KPIs: Total | Confirmados | Em Planejamento]              │
│                                                             │
│ [Grid de cards 3 colunas]                                  │
│ Card: cor | tipo | título | status | data | local | detalh.│
└─────────────────────────────────────────────────────────────┘
```

### Mobile first

```
┌─────────────────────┐
│ ← Eventos           │
│ Eventos             │
│ [+ Novo Evento]     │
├─────────────────────┤
│ ┌───────────────┐   │
│ │ Total: 6      │   │
│ └───────────────┘   │
│ ┌───────────────┐   │
│ │ Confirmados: 3│   │
│ └───────────────┘   │
│ ┌───────────────┐   │
│ │ Planejamento: 2│  │
│ └───────────────┘   │  ← KPIs em grid 2 + 1
├─────────────────────┤
│ ┌─────────────────┐ │
│ ██████ cor        │ │
│ │                 │ │
│ │ [tipo ícone]    │ │
│ │ Título do evento│ │
│ │ Publicado       │ │
│ │                 │ │
│ │ 📅 12/08/26 19h │ │
│ │ 📍 Local X      │ │
│ │                 │ │
│ │ Detalhes →      │ │
│ └─────────────────┘ │
│                     │
│ ┌─────────────────┐ │
│ ██████ cor        │ │
│ │ Retiro          │ │
│ │ Rascunho        │ │
│ │ ...             │ │
│ └─────────────────┘ │
├─────────────────────┤
│ Estado vazio (se 0) │
│ Ilustração + CTA    │
└─────────────────────┘
```

### Decisões

- **KPIs em grid 2 colunas (e o terceiro centralizado ou full)**: mantém a leitura rápida sem carrossel desnecessário.
- **Cards de evento**: barra de cor no topo, título, badge de status, data e local com ícones, e link de detalhes.
- **Status badges**: `Publicado` (emerald), `Rascunho` (amber), `Realizado` (blue), `Cancelado` (red).
- **Empty state**: ilustração centralizada + botão de criação.

---

## 2. Novo/Editar Evento (`/app/eventos/novo`)

### Mobile first

```
┌─────────────────────┐
│ ← Novo Evento       │
│                     │
│ Título *            │
│                     │
│ Tipo *              │
│ ▼ Especial          │
│                     │
│ Data e hora de início*│
│ [__/__/____] [__:__]│
│                     │
│ Data e hora de fim  │
│ [__/__/____] [__:__]│
│                     │
│ Local *             │
│                     │
│ Descrição           │
│                     │
│ Responsável         │
│ ▼ Membro            │
│                     │
│ Status              │
│ ( ) Rascunho  ( ) Publicado│
│                     │
│ [Salvar Evento]     │
└─────────────────────┘
```

### Decisões

- **Data e hora lado a lado em 360+ px**: abaixo de 360, empilhados.
- **Select de tipo e responsável** com altura 48 px.
- **Status como radio simples**: apenas 2 opções principais no formulário de criação.
