# Mobile First — Dashboard (`/app`)

## Rota
- `/app` (`app/routes/app/_index.tsx`)

## Estado atual (desktop)

```
┌─────────────────────────────────────────────────────────┐
│ [Sidebar 240px]  │ Topbar: Igreja Conect | alertas | avatar│
├──────────────────┼─────────────────────────────────────────┤
│ Dashboard        │ Título: Dashboard                       │
│                  │ Subtítulo: Bem-vindo de volta...        │
│                  │                                         │
│                  │ [4 KPIs em grid 4 colunas]              │
│                  │ Saldo | Membros | Visitantes | Estoque  │
│                  │                                         │
│                  │ ┌────────────────────┐  ┌─────────────┐ │
│                  │ │ Últimas Contribuições│  │ Agenda &    │ │
│                  │ │ (tabela)             │  │ Escalas     │ │
│                  │ └────────────────────┘  │ (cards)     │ │
│                  │                         └─────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Proposta mobile first

```
┌─────────────────────┐
│ ≡ Igreja Conect  🔔 👤 │  ← topbar fixa, 56 px
├─────────────────────┤
│ Olá, {nome}         │
│ Dashboard           │
│ Resumo de hoje      │
├─────────────────────┤
│ ◄  [KPIs] ►         │  ← carrossel horizontal scroll-snap
│ Saldo • Membros •   │
│ Visitantes • Alertas │
├─────────────────────┤
│ Últimas Contribuições│
│ Ver todas →         │
│ [Card 1]            │
│ [Card 2]            │  ← lista vertical de cards em vez de tabela
│ ...                 │
├─────────────────────┤
│ Agenda & Escalas    │
│ [Mini calendário]   │
│ [Card culto]        │
│ [Card culto]        │
│ Ver Calendário      │
└─────────────────────┘
```

### Detalhamento mobile

| Elemento | Desktop | Mobile |
|----------|---------|--------|
| Sidebar | Fixa 240 px à esquerda | Drawer hamburger (`MobileNavigation`) |
| Header | Título + subtítulo | Mantidos, com padding `p-4` |
| KPIs | Grid 4 colunas (`lg:grid-cols-4`) | Carrossel `snap-x` 1 card visível ou grid 2 colunas (`grid-cols-2`) em 360+ px |
| Tabela de contribuições | `<table>` com 4 colunas | Cards verticais: avatar + nome + tipo badge + data + valor |
| Agenda | Coluna lateral | Lista vertical com bloco de data empilhado |
| Cores | `bg-slate-50` body, cards `white` border `slate-200` | Mantidas; bordas leves para economizar espaço |
| Tipografia | Título `text-3xl` | `text-2xl` (`text-2xl sm:text-3xl`) |

### Decisões

1. **KPIs como carrossel**: em telas < 640 px, 4 cards não cabem sem quebra feia. Usar `overflow-x-auto snap-x` permite deslizar com o polegar.
2. **Tabela → cards**: evita `overflow-x` na tabela e torna os dados escaneáveis verticalmente.
3. **Agenda em lista**: mantém a hierarquia cronológica com blocos de data (`mes/dia`) alinhados à esquerda.
