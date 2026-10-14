# Mobile First — Módulo Membros

## Rotas
- `/app/membros` (`app/routes/app/membros._index.tsx`)
- `/app/membros/novo` (`app/routes/app/membros.novo.tsx`)
- `/app/membros/:id` (`app/routes/app/membros.$id.tsx`)
- `/app/membros/:id/editar` (`app/routes/app/membros.$id.editar.tsx`)

---

## 1. Lista de Membros (`/app/membros`)

### Estado atual

```
┌────────────────────────────────────────────────────────────┐
│ Membros                                                    │
│ [Search........................] [+ Novo Membro]          │
│                                                            │
│ [TOTAL] [ATIVOS] [VISITANTES] [CONGREGADOS]               │
│                                                            │
│ Todos | Ativos | Visitantes | Congregados                 │
│                                                            │
│ Tabela: Nome | Tipo | Cargo | Contato | Ações             │
└────────────────────────────────────────────────────────────┘
```

### Mobile first

```
┌─────────────────────┐
│ Membros             │
│ ┌─────────────────┐ │
│ │ 🔍 Pesquisar... │ │
│ └─────────────────┘ │
│ [+ Novo]           │ ← botão primário full width abaixo da busca
├─────────────────────┤
│ [KPIs scroll]      │
│ Total · Ativos ·    │
│ Visitantes · Congr. │
├─────────────────────┤
│ Todos · Ativos ·    │
│ Visitantes · Congr. │ ← tabs horizontais scroll
├─────────────────────┤
│ [Avatar] Nome       │
│ Visitante • Tel     │
│ [Ver] [Editar]      │ ← card por membro
│                     │
│ [Avatar] Nome       │
│ Membro ativo • Tel  │
│ [Ver] [Editar]      │
│                     │
│ ◀ 1 2 3 ▶          │
└─────────────────────┘
```

### Decisões

- **Busca e novo empilhados**: em mobile, o botão “+ Novo Membro” fica abaixo do campo de busca, `w-full`.
- **KPIs em scroll horizontal**: 4 cards não cabem; `snap-x` com 2 colunas em 360+ px.
- **Tabela → cards**: cada membro vira um card com avatar circular, nome, badge de tipo e botões de ação secundários (`Ver`, `Editar`).
- **Tabs**: `overflow-x-auto` para as categorias; manter a mesma cor ativa `border-blue-600 text-blue-600`.

---

## 2. Detalhe do Membro (`/app/membros/:id`)

### Estado atual

```
┌──────────────────────────────────────────────┐
│ [Avatar 96px] Nome          [Editar][Excluir]│
│ Membros › Nome                               │
├──────────────────────────────────────────────┤
│ Dados cadastrais        │ KPIs              │
│ Tipo: Visitante         │ Cadastrado em     │
│ E-mail | Tel | Profissão│ Atualizado em     │
│ Endereço                │ Cargo             │
│                         │                   │
│ Discipulado             │ Ministérios       │
│ Ministérios             │ Auditoria (admin) │
│                         │ IP bloqueado      │
└──────────────────────────────────────────────┘
```

### Mobile first

```
┌─────────────────────┐
│ ← Membros           │
│                     │
│   [Avatar 80px]     │
│    Nome do Membro   │
│    Visitante        │
│                     │
│ [Editar]            │
│ [Tornar Discipulador]│
│ [Gerar Convite]     │
│ [Excluir]           │ ← ações empilhadas full width
├─────────────────────┤
│ 📋 Dados cadastrais │
│ E-mail              │
│ Telefone            │
│ Profissão           │
│ Estado civil        │
│ Endereço            │
├─────────────────────┤
│ 🙌 Discipulado      │
│ Discipulador: nome  │
│ Discípulos (n)      │
├─────────────────────┤
│ 🏛 Ministérios       │
│ Louvor • Líder      │
│ Recepção            │
├─────────────────────┤
│ ℹ️ Informações       │
│ Cadastrado em       │
│ Atualizado em       │
│ Cargo               │
├─────────────────────┤
│ 🔒 Bloqueio de IP   │  ← apenas ADMIN
│ 192.168.x • Desbloq.│
└─────────────────────┘
```

### Decisões

- **Avatar centralizado + ações empilhadas**: respeita o polegar único; botões primários/ghost/danger em stack de 48 px cada.
- **Sidebar direita como seções verticais**: KPIs, ministérios, auditoria e IP vêm depois do conteúdo principal, cada um em seu card `border border-slate-200 rounded-xl p-4`.
- **Breadcrumb simplificado**: seta + “Membros” no topo, mantendo navegação.
- **Modal de convite**: ocupa tela cheia em mobile com botão de copiar fixo na parte inferior.

---

## 3. Criar/Editar Membro (`/app/membros/novo` e `/:id/editar`)

### Estado atual

```
┌─────────────────────────────────────────────────────────┐
│ Formulário em grid de colunas (2 cols em sm+)           │
│ Nome *          E-mail *                                │
│ Telefone        Profissão                               │
│ ...                                                     │
│ [Salvar]                                                │
└─────────────────────────────────────────────────────────┘
```

### Mobile first

```
┌─────────────────────┐
│ ← Novo Membro       │
│                     │
│ Foto do perfil      │
│   [Avatar]          │
│   [Alterar foto]    │
│                     │
│ Nome *              │
│ ┌─────────────────┐ │
│ │                 │ │
│ └─────────────────┘ │
│ E-mail *            │
│ ┌─────────────────┐ │
│ │                 │ │
│ └─────────────────┘ │
│ Telefone            │
│ Profissão           │
│ Estado civil        │  ← cada campo em linha própria
│ Data de conversão   │
│ Data de batismo     │
│                     │
│ Tipo *              │
│ (○) Visitante       │
│ (○) Congregado      │
│ (○) Membro ativo    │
│                     │
│ Endereço            │
│ Logradouro          │
│ Número · Bairro     │
│ Cidade · Estado     │
│ CEP                 │
│                     │
│ [Salvar]            │
└─────────────────────┘
```

### Decisões

- **Formulário em 1 coluna absoluta** em mobile; endereço com campos sequenciais; número/bairro podem ficar lado a lado em `sm:`.
- **Campos de data**: uso de `input type="date"` com ícone de calendário nativo; altura 44 px mínima.
- **Botão Salvar fixo opcional**: em formulários muito longos, fixar o botão na parte inferior dentro de um card com fundo `white` e sombra leve.
- **Upload de avatar**: preview circular abaixo do título, com touch target mínimo 44×44 px.
- **Modal de convite**: em mobile, exibir o texto em `textarea` somente leitura com botão `Copiar` grande.

### Tokens

- Inputs: `w-full p-3 border border-slate-200 rounded-xl bg-white text-sm`.
- Labels: `text-sm font-semibold text-slate-700 mb-1.5`.
- Seções de formulário: separadores `border-t border-slate-200 pt-4`.
