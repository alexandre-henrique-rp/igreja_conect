# Central de Alertas — Design

## 1. Propósito

Tela única que lista os **alertas do usuário logado**. No MVP, o único gatilho é **"novo visitante cadastrado"** (RN-MEM-05), mas a estrutura foi pensada para escalar para outros tipos em sprints futuras.

Acessível em `/app/alertas`.

**Persona-alvo:** qualquer perfil autenticado. O caso de uso primário é do **responsável pelo acolhimento** (Membro ou Ministério configurado pelo Admin).

**Caso de uso primário (US-MEM-001 + UC-06 do PRD):** responsável vê "Maria da Silva cadastrada como visitante, precisa de acolhimento" e marca como lido/resolvido após contatá-la.

**Casos secundários:**
- Marcar como lido (não remove, só marca).
- Marcar como resolvido (fecha o ciclo).
- Ver histórico (alertas já resolvidos ficam visíveis).
- Filtro "não lidos" / "todos" — **decisão:** incluir filtro simples "Não lidos" no MVP (PRD §3.3 diz "sem filtros no MVP", mas UX básica de "ver só os pendentes" é muito útil e tem baixo custo).

**Restrição:**
- Usuário vê **apenas seus próprios alertas** (`AlertaDestinatario.membroId === user.id`).
- Sem push, sem e-mail (PRD §4).
- Sem priorização visual (todos têm mesma importância no MVP).

---

## 2. Wireframe

### 2.1 Desktop (≥ 1024px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Topbar + Sidebar                                                       │
├────────────┬─────────────────────────────────────────────────────────────┤
│ Sidebar    │  Alertas                                                     │ ← h1
│            │  ┌──────────────────────────────────────────────────────┐   │
│            │  │ [Todos (5)] [Não lidos (2)] [Resolvidos (3)]         │   │ ← tabs/filtro
│            │  └──────────────────────────────────────────────────────┘   │
│            │                                                             │
│            │  ┌──────────────────────────────────────────────────────┐   │
│            │  │ 🔵 Novo visitante cadastrado          há 2 horas   │   │ ← não lido
│            │  │    Maria da Silva precisa de acolhimento.             │   │
│            │  │    Telefone: (11) 98765-4321                          │   │
│            │  │                                                       │   │
│            │  │    [Marcar como lido] [Marcar como resolvido]         │   │
│            │  └──────────────────────────────────────────────────────┘   │
│            │                                                             │
│            │  ┌──────────────────────────────────────────────────────┐   │
│            │  │ 🔵 Novo visitante cadastrado          ontem         │   │ ← não lido
│            │  │    Pedro Santos...                                    │   │
│            │  │    [Marcar como lido] [Marcar como resolvido]         │   │
│            │  └──────────────────────────────────────────────────────┘   │
│            │                                                             │
│            │  ┌──────────────────────────────────────────────────────┐   │
│            │  │ ⚪ Novo visitante cadastrado          há 3 dias      │   │ ← lido, não resolvido
│            │  │    Ana Pereira...                                     │   │
│            │  │    [Marcar como resolvido]                            │   │
│            │  └──────────────────────────────────────────────────────┘   │
│            │                                                             │
│            │  ┌──────────────────────────────────────────────────────┐   │
│            │  │ ✓  Visitante acolhido                há 5 dias      │   │ ← resolvido
│            │  │    Carlos Souza - resolvido por você                 │   │
│            │  └──────────────────────────────────────────────────────┘   │
└────────────┴─────────────────────────────────────────────────────────────┘
```

### 2.2 Mobile

```
┌──────────────────────────────┐
│ Alertas                      │
├──────────────────────────────┤
│ [Todos] [Não lidos] [Resolv.]│ ← tabs scrollable
│                              │
│ ┌──────────────────────────┐ │
│ │ 🔵 Novo visitante        │ │
│ │ Maria da Silva           │ │
│ │ há 2 horas               │ │
│ │ [Marcar como lido]       │ │
│ │ [Marcar como resolvido]  │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ 🔵 Novo visitante        │ │
│ │ Pedro Santos             │ │
│ │ ontem                    │ │
│ │ ...                      │ │
│ └──────────────────────────┘ │
│ ...                          │
└──────────────────────────────┘
```

---

## 3. Componentes

| Componente | Fonte | Props | Localização |
|---|---|---|---|
| `<ShellAutenticado>` | shared | — | (já existe) |
| `<PageHeader>` | shared | `title="Alertas"` | (já existe) |
| `<TabsFiltroAlertas>` | novo | `active: "todos" \| "nao_lidos" \| "resolvidos"`, `counts: { todos, naoLidos, resolvidos }` | `app/components/TabsFiltroAlertas.tsx` |
| `<CardAlerta>` | novo | `alerta: Alerta & { destinatario: AlertaDestinatario }`, `onMarcarLido`, `onMarcarResolvido` | `app/components/CardAlerta.tsx` |
| `<EmptyState>` | shared | — | (já existe) |
| `<RelativeTime>` | novo | `date: Date` (formata como "há 2 horas", "ontem", "12/06") | `app/components/RelativeTime.tsx` |

**Hierarquia:**
- `app/routes/app/alertas._index.tsx`.
  - loader: `listAlertas(user, filter)` retorna `{ items, counts }`.
  - action: `marcarLido(alertaId, user)` ou `marcarResolvido(alertaId, user)`.
- URL: `?filter=todos|nao_lidos|resolvidos` (default = "nao_lidos" se não resolvidos; senão "todos").

---

## 4. Estados

| Estado | Quando | Render |
|---|---|---|
| **Initial (com alertas)** | Há alertas para o usuário | Lista de cards. |
| **Initial (sem alertas)** | 0 alertas | `<EmptyState title="Nenhum alerta" description="Quando um visitante novo for cadastrado, você verá o aviso aqui." />`. |
| **Empty no filtro "Não lidos"** | Filtro ativo, 0 não lidos | "Nenhum alerta pendente. Tudo em dia. 🎉" (emoji opcional). |
| **Loading** | Loader em andamento | Skeleton de 3 cards. |
| **Marcar como lido em andamento** | Click "Marcar como lido" | Botão vira loading; após sucesso, card fica "lido" (badge muda). |
| **Marcar como resolvido em andamento** | Click "Marcar como resolvido" | Card some ou vai para tab "Resolvidos". |
| **Sucesso (lido)** | Action OK | Toast discreto "Marcado como lido." (pode omitir — atualização visual já é feedback). |
| **Sucesso (resolvido)** | Action OK | Toast "Marcado como resolvido." + card some da lista atual. |
| **Erro (500)** | Action falhou | Toast de erro, card mantém estado. |
| **Usuário sem permissão (impossível, mas)** | Defesa em profundidade: action sempre chama `getAlertaById(id, user)` que valida `destinatario.membroId === user.id`. Se não bate, 403. |

---

## 5. Interações

| Elemento | Evento | Comportamento |
|---|---|---|
| Tab "Todos" | Click | URL `?filter=todos` → loader retorna todos. |
| Tab "Não lidos" | Click | URL `?filter=nao_lidos` → loader filtra `lido = false and resolvido = false`. |
| Tab "Resolvidos" | Click | URL `?filter=resolvidos` → loader filtra `resolvido = true`. |
| Botão "Marcar como lido" | Click | Action PATCH `/app/alertas/:id/lido`. |
| Botão "Marcar como resolvido" | Click | Action PATCH `/app/alertas/:id/resolver`. |
| Click no card (área do nome do visitante) | Click | Navega para `/app/membros/:id` (atalho). |
| Click no nome do visitante (link) | Click | Mesmo — vai para o detalhe do membro. |

**Decisão de UX:** ao marcar como resolvido, o card **desaparece** da tab atual (resolve = sai do "pendente"). RR7 re-roda o loader automaticamente (revalidação padrão).

**Navegação por teclado:**
- Tab: tab filtro → card 1 ações → card 2 ações → ... 
- Enter no botão = submete.

---

## 6. Validações e regras

### 6.1 Schema Zod (`app/lib/schemas/alertas.ts`)

```ts
export const MarcarLidoSchema = z.object({
  alertaId: z.string().uuid(),
});

export const MarcarResolvidoSchema = z.object({
  alertaId: z.string().uuid(),
});
```

### 6.2 Regras de negócio

- **RN-MEM-05:** alerta é gerado na mesma transação que o cadastro do visitante. Se a transação falha, **nem visitante nem alerta** são criados.
- **Privacidade do destinatário:** `AlertaDestinatario.membroId` é por usuário. Service `listAlertas` filtra por `membroId = user.id`. Usuário **nunca** vê alertas de outros.
- **Marcar como lido / resolvido:** só o próprio destinatário. Action valida `destinatario.membroId === user.id`.

### 6.3 Conteúdo do alerta

- **Título:** "Novo visitante cadastrado" (fixo no MVP).
- **Mensagem:** `"Maria da Silva precisa de acolhimento. Telefone: (11) 98765-4321."` — inclui nome + telefone. **NÃO inclui** email nem endereço completo (LGPD — minimização, RAG `lgpd-igreja-conect.md §2.5`).
- **Se responsável é um Ministério (não um Membro):** alerta é criado com `AlertaDestinatario` para **cada membro** do ministério (N:N). Cada um recebe individualmente.

### 6.4 Edge cases

- **Alerta para membro excluído (Cascade):** se o destinatário for excluído, `AlertaDestinatario` é removido por cascade. Alerta "pai" continua existindo (sem destinatário, mas isso é uma anomalia que não acontece em prática — a exclusão de admin não deveria acontecer no MVP).
- **Marcar 2x como lido:** idempotente (UPDATE ... SET lido = true WHERE lido = false).
- **Marcar resolvido sem marcar lido antes:** permitido (resolver implica ler).

---

## 7. RBAC

| Perfil | Vê seus alertas | Marca como lido | Marca como resolvido |
|---|:-:|:-:|:-:|
| Todos os 6 perfis | ✅ | ✅ | ✅ |
| Membro comum | ❌ middleware | — | — |

**Defesa em profundidade:**
- **UI:** vê só os próprios.
- **Loader:** filtra por `membroId = user.id`.
- **Action:** chama `getAlertaDestinatario(alertaId, user.id)` que retorna 403 se não bate.

---

## 8. Acessibilidade

- **`<h1>`** = "Alertas".
- **Tabs** com `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`.
- **Card de alerta** com `aria-live="polite"` para mudanças (anuncia "Novo alerta" quando aparece).
- **Contadores** nas tabs com `aria-label="2 alertas não lidos"`.
- **Botões** com `aria-label="Marcar alerta 'Maria da Silva' como lido"` (mais específico).
- **Ícone de status (🔵/⚪/✓)** com `aria-hidden` (o texto/badge já comunica).
- **Lista** como `<ul>` com `<li>`.

---

## 9. Mobile

- **Tabs** viram `<Tabs>` scrolláveis horizontalmente.
- **Cards** full-width.
- **Botões** empilhados: "Marcar como lido" em cima, "Marcar como resolvido" embaixo (ou inline se couber).
- **Timestamp** relativo ("há 2h") — formato compacto em mobile.
- **Pull-to-refresh** fora do MVP (RR7 não tem nativo; YAGNI).

---

## 10. Critérios de aceite (testáveis)

### 10.1 Funcionais

- [ ] `GET /app/alertas` retorna 200 e lista alertas do usuário.
- [ ] Usuário A não vê alertas de B (escopo por destinatário).
- [ ] `?filter=nao_lidos` filtra para não lidos.
- [ ] `?filter=resolvidos` filtra para resolvidos.
- [ ] Marcar como lido: card muda badge de 🔵 para ⚪.
- [ ] Marcar como resolvido: card sai da tab "Não lidos".
- [ ] ADMIN cadastra visitante → responsável configurado vê alerta em < 1s.
- [ ] Action `lido` chamado por usuário não-destinatário: 403.

### 10.2 Privacidade

- [ ] Payload **nunca** inclui email do visitante (apenas nome + telefone).
- [ ] Payload **nunca** inclui `AlertaDestinatario` de outros usuários.
- [ ] `safeLog` registra `userId, action="marcar_lido", result` — sem PII.

### 10.3 Qualidade

- [ ] Cobertura ≥ 85%.
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] `pnpm typecheck` passa.
- [ ] Tempo de loader < 200ms p95.
- [ ] RR7 revalidação ao voltar de outra rota (loader re-roda).
