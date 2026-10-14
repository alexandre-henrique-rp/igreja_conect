# Mobile First — Módulo Ministérios

## Rotas
- `/app/ministerios` (`app/routes/app/ministerios._index.tsx`)
- `/app/ministerios/:id` (`app/routes/app/ministerios.$id.tsx`)
- `/app/ministerios/novo` (`app/routes/app/ministerios.novo.tsx`)

---

## 1. Lista de Ministérios (`/app/ministerios`)

### Estado atual

```
┌─────────────────────────────────────────────────────────────┐
│ Ministérios                                 [+ Novo Minist.]│
│                                                             │
│ [KPIs: Total | Ativos | Com Líder]                         │
│                                                             │
│ [Grid de cards 3 colunas]                                  │
│ Card: barra cor | nome | status | descrição | líder | memb.│
│ + ações (adicionar membro, editar, excluir)                │
│                                                             │
│ Paginação                                                  │
└─────────────────────────────────────────────────────────────┘
```

### Mobile first

```
┌─────────────────────┐
│ ← Ministérios       │
│ Ministérios         │
│ [+ Novo Ministério] │
├─────────────────────┤
│ [KPIs scroll]       │
│ Total · Ativos ·    │
│ Com Líder           │
├─────────────────────┤
│ ┌─────────────────┐ │
│ ████████ (cor)    │
│ │                 │ │
│ │ Louvor        ATIVO│
│ │                 │ │
│ │ Equipe de música│ │
│ │                 │ │
│ │ Líder: João     │ │
│ │ Membros: 12     │ │
│ │                 │ │
│ │ [+ Membro] [✎] [🗑]│
│ └─────────────────┘ │
│                     │
│ ┌─────────────────┐ │
│ ████████ (cor)    │
│ │ Recepção      ATIVO│
│ │ ...             │ │
│ └─────────────────┘ │
├─────────────────────┤
│ ◀ 1 2 3 ▶          │
└─────────────────────┘
```

### Decisões

- **Cards em 1 coluna**: todos os cards empilhados, com barra de cor no topo, nome e status em linha, descrição truncada (`line-clamp-3`), e rodapé com líder e total de membros.
- **Ações simplificadas**: “+ Membro” como link de texto, editar e excluir como ícones 44×44 px.
- **Paginação compacta**: botões `Anterior`/`Próximo` + número de página central.

---

## 2. Novo/Editar Ministério (`/app/ministerios/novo` e `/:id`)

### Mobile first

```
┌─────────────────────┐
│ ← Novo Ministério   │
│                     │
│ Nome *              │
│                     │
│ Descrição           │
│                     │
│ Funções / Atividades│
│ [+] Adicionar função│
│                     │
│ Membros             │
│ [+] Adicionar membro│
│                     │
│ [Salvar]            │
└─────────────────────┘
```

### Detalhe (`/app/ministerios/:id`)

```
┌─────────────────────┐
│ ← Louvor            │
│                     │
│ [Avatar cor]        │
│ Louvor              │
│ ATIVO               │
│                     │
│ [Editar]            │
│ [Excluir]           │
├─────────────────────┤
│ Sobre               │
│ Descrição aqui.     │
├─────────────────────┤
│ Líder               │
│ João                │
├─────────────────────┤
│ Membros (12)        │
│ • Maria             │
│ • Pedro             │
│ • ...               │
├─────────────────────┤
│ Funções             │
│ • Vocal Principal   │
│ • Backing Vocal     │
│ • ...               │
├─────────────────────┤
│ Atividades          │
│ • 08/08 Ensaio      │
│ • 10/08 Culto       │
└─────────────────────┘
```

### Decisões

- **Tela de detalhe em seções**: cada seção vira um card expansível com título e conteúdo.
- **Listas de membros/funções**: scroll interno ou “Ver todos” quando muitos itens.
- **Adicionar membro/função em modal/page**: em mobile, tela cheia com busca e select.
