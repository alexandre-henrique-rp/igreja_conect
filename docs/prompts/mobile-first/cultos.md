# Mobile First — Módulo Cultos

## Rotas
- `/app/cultos` (`app/routes/app/cultos._index.tsx`)
- `/app/cultos/novo` (`app/routes/app/cultos.novo.tsx`)
- `/app/cultos/:id/editar` (`app/routes/app/cultos.$id.editar.tsx`)

---

## 1. Lista de Cultos (`/app/cultos`)

### Estado atual

```
┌─────────────────────────────────────────────────────────────┐
│ Cultos                                       [+ Novo Culto] │
│                                                             │
│ [Total de Cultos]          [Online]                        │
│                                                             │
│ Programação de Cultos          [filter] [more]              │
├─────────────────────────────────────────────────────────────┤
│ Tabela: Nome | Data | Horário | Tipo | Status | Ações      │
│                                                             │
│ Nome do culto                                               │
│ Preletor: X · Ministério: Louvor                            │
│ 08/08/2026 | 19h | Presencial | Confirmado | ✓ ✎ 🗑        │
└─────────────────────────────────────────────────────────────┘
```

### Mobile first

```
┌─────────────────────┐
│ ← Cultos            │
│ Cultos              │
│ [+ Novo Culto]      │  ← botão full width abaixo do título
├─────────────────────┤
│ ┌───────────────┐   │
│ │ Total: 8      │   │
│ └───────────────┘   │
│ ┌───────────────┐   │
│ │ Online: 2     │   │
│ └───────────────┘   │  ← KPIs em grid 2 colunas
├─────────────────────┤
│ Programação         │
│ [Filtro] [Mais]     │
├─────────────────────┤
│ ┌─────────────────┐ │
│ │ Culto de Celeb. │ │
│ │ Preletor: Pr. X │ │
│ │ Louvor          │ │
│ │                 │ │
│ │ 08/08/26 · 19h  │ │
│ │ Presencial      │ │
│ │ Confirmado      │ │
│ │                 │ │
│ │ [✓] [✎] [🗑]   │ │
│ └─────────────────┘ │
│                     │
│ ┌─────────────────┐ │
│ │ Culto Online    │ │
│ │ 09/08/26 · 20h  │ │
│ │ Online          │ │
│ └─────────────────┘ │
├─────────────────────┤
│ Transmissão em destaque│
│ [imagem]            │
│ Configurar →        │
└─────────────────────┘
```

### Decisões

- **Título + CTA empilhados**: título e botão “+ Novo Culto” em coluna; botão `w-full`.
- **KPIs em grid 2 colunas**: cards simples, sem avatar de ícone grande.
- **Tabela → cards verticais**: cada culto vira card com nome, preletor, ministério badge, data, horário, tipo com ícone e status badge.
- **Ações em linha**: botões de executar/editar/excluir em linha no rodapé do card, com touch target de 44×44 px.
- **Transmissão em destaque**: imagem em `w-full h-40 object-cover` com texto sobreposto ou abaixo.

---

## 2. Novo/Editar Culto (`/app/cultos/novo` e `/:id/editar`)

### Mobile first

```
┌─────────────────────┐
│ ← Novo Culto        │
│                     │
│ Título *            │
│                     │
│ Preletor            │
│                     │
│ Ministério          │
│ ▼ Louvor            │
│                     │
│ Data *              │
│ [__/__/____]        │
│                     │
│ Horário *           │
│ [__:__]             │
│                     │
│ Local               │
│                     │
│ Tipo                │
│ ( ) Presencial  ( ) Híbrido  ( ) Online│
│                     │
│ Link da transmissão │
│                     │
│ Status              │
│ ▼ Agendado          │
│                     │
│ [Salvar Culto]      │
└─────────────────────┘
```

### Decisões

- **Tipo em radio horizontal com wrap**: em 320 px pode ser coluna, em 360+ px, linha com `flex-wrap`.
- **Campo de horário**: `input type="time"` nativo; fallback para máscara `__:__`.
- **Link de transmissão**: aparecer apenas quando tipo é `ONLINE` ou `HIBRIDO`.
