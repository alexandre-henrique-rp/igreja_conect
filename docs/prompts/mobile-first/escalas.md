# Mobile First — Módulo Escalas

## Rotas
- `/app/escalas` (`app/routes/app/escalas._index.tsx`)
- `/app/escalas/novo` (`app/routes/app/escalas.novo.tsx`)

---

## 1. Lista de Escalas (`/app/escalas`)

### Estado atual

```
┌────────────────────────────────────────────────────────────────┐
│ Escalas                                                        │
│ [Gerar Todos] [+ Nova Escala]                                  │
│                                                                │
│ [Help text de geração automática]                              │
│                                                                │
│ [Toggle: Próximos Eventos | Por Ministério]                    │
│                                                                │
│ [Tabs de ministérios horizontais em scroll]                    │
│                                                                │
│ Timeline vertical por data:                                    │
│ • Sex, 08/08                                                   │
│   [Card Escala - Louvor]                                       │
│     Preletor / status                                          │
│     Voluntário 1 - função - [Pendente]                         │
│     Voluntário 2 - função - [Confirmado]                       │
│                                                                │
│ Sidebar:                                                       │
│ Total de escalas / Total de voluntários / Ministérios / Auto   │
└────────────────────────────────────────────────────────────────┘
```

### Mobile first

```
┌─────────────────────┐
│ ← Escalas           │
│ Escalas             │
├─────────────────────┤
│ [Gerar Todos]       │
│ [+ Nova Escala]     │  ← ações primárias empilhadas
├─────────────────────┤
│ [Próximos] [Por Min.]│
├─────────────────────┤
│ Ministérios:        │
│ ◄ [Louvor] [Recepção] [Kids] ▶  ← chips horizontais
├─────────────────────┤
│ Sex, 08/08          │
│ •                   │
│ ┌─────────────────┐ │
│ │ 🎵 Louvor       │ │
│ │ Escala 08/08    │ │
│ │ Auto • Culto    │ │
│ │                 │ │
│ │ Voluntários:    │ │
│ │ 👤 João - Vocal │ │
│ │   Pendente      │ │
│ │ 👤 Maria - Tec. │ │
│ │   Confirmado    │ │
│ │                 │ │
│ │ [Editar] [Status]│ │
│ └─────────────────┘ │
│                     │
│ Sáb, 09/08          │
│ •                   │
│ ┌─────────────────┐ │
│ │ 🤝 Recepção     │ │
│ │ ...             │ │
│ └─────────────────┘ │
├─────────────────────┤
│ Resumo de Escalas   │  ← expansível
│ Total: 12           │
│ Voluntários: 45     │
│ Ministérios: 5      │
└─────────────────────┘
```

### Decisões

- **Tabs de ministérios em chips horizontais**: substituir os cards quadrados grandes (w-28 h-20) por chips `rounded-full` com ícone e nome.
- **Timeline em accordion**: data como cabeçalho; cards de escala empilhados.
- **Card de escala como unitário**: mostra nome, ícone do ministério, badges `Auto`/`Culto`/`Evento`, e lista de voluntários com iniciais, função e status.
- **Ações em card**: botão de editar e select de status (Pendente/Confirmada/Realizada/Cancelada) dentro do card.
- **Modo "Por Ministério"**: lista filtrada de cards sem a timeline.
- **Sidebar resumo**: colapsar em um card de resumo que pode ser expandido.

---

## 2. Adicionar/Editar Escala (`/app/escalas/novo`)

### Mobile first

```
┌─────────────────────┐
│ ← Nova Escala       │
│                     │
│ Ministério *        │
│ ▼ Louvor            │
│                     │
│ Data *              │
│ [__/__/____]        │
│                     │
│ Vincular a evento/culto│
│ ▼ Nenhum            │
│                     │
│ Funções / Voluntários│
│ ┌─────────────────┐ │
│ │ Vocal Principal │ │
│ │ ▼ João          │ │
│ └─────────────────┐ │
│ ┌─────────────────┐ │
│ │ Teclado         │ │
│ │ ▼ Maria         │ │
│ └─────────────────┐ │
│                     │
│ [+ Adicionar função]│
│                     │
│ [Salvar Escala]     │
└─────────────────────┘
```

### Decisões

- **Cada função como um mini-card**: select de membro por função; opção de remover com ícone de lixeira.
- **Adicionar função**: botão secundário que insere mais um select.
- **Teclado de data**: `input type="date"`.
