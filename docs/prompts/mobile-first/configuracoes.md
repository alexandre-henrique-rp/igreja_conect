# Mobile First — Configurações

## Rotas
- `/app/config/acolhimento` (`app/routes/app/config.acolhimento.tsx`)

---

## 1. Configuração de Acolhimento

### Estado atual

```
┌─────────────────────────────────────────────────────────────┐
│ Configurações                               Acolhimento     │
│                                                             │
│ [Sidebar de categorias: Acolhimento, Notificações, Segur.] │
│                                                             │
│ [Card: Config atual]                                        │
│ Responsável por visitantes:                                 │
│ Tipo: MEMBRO / João da Silva                                │
│                                                             │
│ [Formulário de edição]                                      │
│ Tipo de responsável *                                       │
│ ( ) Membro específico  ( ) Ministério                       │
│                                                             │
│ Se membro: ▼ João                                           │
│ Se ministério: ▼ Recepção                                   │
│ [Salvar]                                                    │
└─────────────────────────────────────────────────────────────┘
```

### Mobile first

```
┌─────────────────────┐
│ ← Configurações     │
│ Configurações       │
├─────────────────────┤
│ Categorias:         │
│ ◄ Acolhimento · Notif. · Seg. ►  ← tabs horizontais scroll
├─────────────────────┤
│ Configuração atual  │
│ Responsável por     │
│ visitantes          │
│                     │
│ Tipo: Membro        │
│ João da Silva       │
├─────────────────────┤
│ Editar              │
│                     │
│ Tipo de responsável*│
│ ( ) Membro          │
│ ( ) Ministério      │
│                     │
│ Membro              │
│ ▼ João da Silva     │
│                     │
│ [Salvar]            │
└─────────────────────┘
```

### Decisões

- **Sidebar de categorias em tabs horizontais**: substituir a coluna lateral por tabs scrolláveis.
- **Card de config atual mantido**: mostrar a configuração ativa em destaque antes do formulário.
- **Formulário condicional**: quando selecionado “Membro”, exibe select de membros; quando “Ministério”, exibe select de ministérios.
- **Apenas ADMIN edita**: para não-admin, esconder o formulário e exibir `InfoBox` informando que a alteração é restrita.
