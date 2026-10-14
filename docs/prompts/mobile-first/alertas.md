# Mobile First — Módulo Alertas

## Rotas
- `/app/alertas` (`app/routes/app/alertas._index.tsx`)

---

## 1. Central de Alertas (`/app/alertas`)

### Estado atual

```
┌─────────────────────────────────────────────────────────────┐
│ Alertas                                                     │
│                                                             │
│ [Todos (n)] [Não lidos (n)] [Resolvidos (n)]               │
│                                                             │
│ [Lista de cards]                                            │
│ Título                                                      │
│ Mensagem                                                    │
│ Data · Não lido                                             │
│ [Marcar lido] [Resolver] (se admin)                         │
└─────────────────────────────────────────────────────────────┘
```

### Mobile first

```
┌─────────────────────┐
│ ← Alertas           │
│ Alertas             │
├─────────────────────┤
│ ◄ Todos · Não lidos · Resolvidos ►  ← tabs scroll horizontal
├─────────────────────┤
│ ┌─────────────────┐ │
│ │ 🔔 Título       │ │
│ │ Mensagem do     │ │
│ │ alerta em texto │ │
│ │ resumido.       │ │
│ │                 │ │
│ │ 13/08/26 · 10h  │ │
│ │ Não lido        │ │
│ │                 │ │
│ │ [Marcar lido]   │ │
│ │ [Resolver]      │ │
│ └─────────────────┘ │
│                     │
│ ┌─────────────────┐ │
│ │ Título 2        │ │
│ │ Mensagem...     │ │
│ │ Lido · 12/08/26 │ │
│ └─────────────────┘ │
└─────────────────────┘
```

### Decisões

- **Tabs filtro com counts**: `Todos`, `Não lidos`, `Resolvidos` em scroll horizontal, exibindo os contadores em badges.
- **Cards de alerta**: ícone de alerta, título em negrito, mensagem truncada, data e status.
- **Ações dependem do filtro e RBAC**:
  - Se não lido: mostrar `Marcar como lido`.
  - Se não resolvido e admin: mostrar `Resolver`.
  - Se resolvido: mostrar `Resolvido` em badge e desabilitar ações.
- **Swipe (opcional avançado)**: futuramente permitir swipe right para “marcar lido” e swipe left para “resolver”.
