# Mobile First — Módulo Células

## Rotas
- `/app/celulas` (`app/routes/app/celulas._index.tsx`)
- `/app/celulas/novo` (se existir)

---

## 1. Lista de Células (`/app/celulas`)

### Estado atual

```
┌─────────────────────────────────────────────────────────────┐
│ Células                                     [+ Nova Célula] │
│                                                             │
│ [KPIs: Total | Ativas | Total de Membros]                  │
│                                                             │
│ [Grid de cards 3 colunas]                                  │
│ Card: cor | nome | ATIVA | líder | local | dia/horário | memb.│
└─────────────────────────────────────────────────────────────┘
```

### Mobile first

```
┌─────────────────────┐
│ ← Células           │
│ Células             │
│ [+ Nova Célula]     │
├─────────────────────┤
│ ┌───────────────┐   │
│ │ Total: 5      │   │
│ └───────────────┘   │
│ ┌───────────────┐   │
│ │ Ativas: 5     │   │
│ └───────────────┘   │
│ ┌───────────────┐   │
│ │ Membros: 47   │   │
│ └───────────────┘   │  ← KPIs em grid 2 + 1
├─────────────────────┤
│ ┌─────────────────┐ │
│ ██████ cor        │ │
│ │                 │ │
│ │ Nome da Célula  │ │
│ │ ATIVA           │ │
│ │                 │ │
│ │ 👤 Líder: João  │ │
│ │ 📍 Rua ABC, 123 │ │
│ │ 🕐 Sexta 20h    │ │
│ │                 │ │
│ │ 👥 12 membros   │
│ │ Detalhes →      │ │
│ └─────────────────┘ │
└─────────────────────┘
```

### Decisões

- **Cards com informações de contato**: destaque para líder, local e dia/horário, que são os dados mais consultados no mobile.
- **Ação de detalhes como link “Detalhes →”** no rodapé do card.
- **KPIs**: grid 2 colunas no mobile (Total/Ativas) e o terceiro em linha única ou grid 3 em 480+ px.
