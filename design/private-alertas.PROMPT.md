# Central de Alertas — Frontend Implementation Prompt

## Capability grant

- **Paths de escrita:**
  - `app/routes/app/alertas._index.tsx`
  - `app/components/TabsFiltroAlertas.tsx`
  - `app/components/CardAlerta.tsx`
  - `app/components/RelativeTime.tsx`
  - `app/lib/schemas/alertas.ts`
  - `app/lib/alerts.server.ts` (service: `listAlertas`, `marcarLido`, `marcarResolvido`)
- **Paths de leitura:** PRD, SPEC, AGENTS, RAGs, schema.
- **Boundary:** não acessar alertas de outros usuários (RN-MEM-05).

## Contexto

Central de alertas. Lista alertas do usuário, permite marcar como lido/resolvido.

- **Design:** [`design/private-alertas.DESIGN.md`](./private-alertas.DESIGN.md)
- **PRD:** US-MEM-001 (alerta aparece após cadastrar visitante), UC-06 (marcar como lido/resolvido).
- **SPEC:** §6.8 (geração de alerta), §10 (endpoints).
- **RAG `lgpd-igreja-conect.md` §2.5:** `safeLog` nas actions.

## Tarefas

### T1. Criar `app/lib/schemas/alertas.ts`

- **Path:** `app/lib/schemas/alertas.ts`
- **Schemas:** `MarcarLidoSchema`, `MarcarResolvidoSchema`.

### T2. Criar `app/lib/alerts.server.ts`

- **Path:** `app/lib/alerts.server.ts`
- **Funções:**
  - `listAlertas(user, filter): Promise<{ items: AlertaWithDestinatario[], counts: { todos, naoLidos, resolvidos } }>`.
    - `where: { destinatarios: { some: { membroId: user.id } } }`.
    - Filtro adicional: `nao_lidos` → `lido: false, resolvido: false`; `resolvidos` → `resolvido: true`.
    - `orderBy: { createdAt: "desc" }`.
    - Counts: 3 `count` em paralelo.
  - `marcarLido(alertaId, user): Promise<void>`.
    - `update({ where: { id, destinatario: { membroId: user.id } }, data: { lido: true } })`.
    - Se 0 rows affected → 404 ou 403.
  - `marcarResolvido(alertaId, user): Promise<void>`.
    - Idem, `data: { resolvido: true, lido: true }` (resolver implica ler).
- **JSDoc completo** (obrigatório).

### T3. Criar `<RelativeTime>`

- **Path:** `app/components/RelativeTime.tsx`
- **Props:** `date: Date | string` (parse se string).
- **Lógica:**
  - < 1 min: "agora".
  - < 1 hora: "há X minutos".
  - < 24h mesmo dia: "há X horas".
  - ontem: "ontem".
  - < 7 dias: "há X dias".
  - senão: `format(date, "dd/MM/yyyy")` com `Intl.DateTimeFormat("pt-BR")`.
- **`<time>`** semântico: `<time dateTime={isoString}>{text}</time>`.

### T4. Criar `<CardAlerta>`

- **Path:** `app/components/CardAlerta.tsx`
- **Props:** `alerta: { id, titulo, mensagem, createdAt, destinatario: { lido, resolvido } }`, `onMarcarLido`, `onMarcarResolvido`, `membroId` (do visitante, para link).
- **Estado visual:**
  - Não lido: borda esquerda `border-l-4 border-cyan-600`, ícone 🔵.
  - Lido: ícone ⚪.
  - Resolvido: ícone ✓, opacidade 75%.
- **Estrutura:** `<article className={cn("border border-slate-200 rounded-lg bg-white p-4", !lido && "border-l-4 border-l-cyan-600", resolvido && "opacity-75")}><header className="flex items-start justify-between"><h3 className="font-medium text-slate-900 flex items-center gap-2"><span aria-hidden="true">{icon}</span>{alerta.titulo}</h3><RelativeTime date={alerta.createdAt} /></header><p className="text-sm text-slate-700 mt-2">{alerta.mensagem}</p>{membroId && <p className="mt-2"><Link to={`/app/membros/${membroId}`} className="text-sm text-cyan-700 hover:underline">Ver membro</Link></p>}<footer className="mt-3 flex gap-2">{!lido && <Form method="post"><input type="hidden" name="intent" value="lido" /><input type="hidden" name="alertaId" value={alerta.id} /><Button type="submit" variant="secondary" size="sm">Marcar como lido</Button></Form>}{!resolvido && <Form method="post"><input type="hidden" name="intent" value="resolver" /><input type="hidden" name="alertaId" value={alerta.id} /><Button type="submit" variant="primary" size="sm">Marcar como resolvido</Button></Form>}</footer></article>`.

### T5. Criar `<TabsFiltroAlertas>`

- **Path:** `app/components/TabsFiltroAlertas.tsx`
- **Props:** `active: "todos" | "nao_lidos" | "resolvidos"`, `counts: { todos, naoLidos, resolvidos }`.
- **Estrutura:** `<div role="tablist" className="flex gap-1 border-b border-slate-200"><Link to="?filter=todos" role="tab" aria-selected={active === "todos"} className={tabClass}>Todos ({counts.todos})</Link><Link to="?filter=nao_lidos" role="tab" ...>Não lidos ({counts.naoLidos})</Link><Link to="?filter=resolvidos" role="tab" ...>Resolvidos ({counts.resolvidos})</Link></div>`.

### T6. Criar `app/routes/app/alertas._index.tsx`

- **Path:** `app/routes/app/alertas._index.tsx`
- **Loader:**
  - Lê `?filter=` (default = "todos" se primeiro acesso, mas default = "nao_lidos" se há não lidos — decidir simples: sempre "todos").
  - Chama `listAlertas(user, filter)`.
  - Retorna `{ items, counts, activeFilter }`.
- **Action:**
  - `intent === "lido"`: `marcarLido(alertaId, user)`.
  - `intent === "resolver"`: `marcarResolvido(alertaId, user)`.
  - `safeLog` em ambos: `{ userId, action: "alerta_marcar_lido" | "alerta_resolver", alertaId, result: "ok" | "fail" }`.
- **Default export:**
  - `<PageHeader title="Alertas" />`.
  - `<TabsFiltroAlertas active={activeFilter} counts={counts} />`.
  - Se `items.length === 0`: empty state contextual (por filtro).
  - Senão: lista de `<CardAlerta>` (com `key={alerta.id}`).
- **RR7 revalidação:** action retorna `null` (RR7 re-roda loader por padrão).

## Validações e regras

- **Zod:** valida `alertaId`.
- **Escopo:** `listAlertas` filtra por `destinatario.membroId = user.id`. `marcarLido`/`marcarResolvido` validam o mesmo.
- **Privacidade:** `safeLog` nunca loga `mensagem` do alerta (pode ter nome + telefone do visitante).
- **Idempotência:** marcar 2x como lido é no-op (UPDATE WHERE lido = false).

## Testes (TDD)

### T6.1. Teste de `listAlertas` (integration)

- Cria 3 alertas para user A. 1 alerta para user B.
- `listAlertas(userA, "todos")` retorna 3.
- `listAlertas(userB, "todos")` retorna 1.

### T6.2. Teste de `marcarLido` (integration)

- Cria alerta. `marcarLido(id, user)` muda `lido = true`.
- `marcarLido(id, outroUser)` falha (escopo).

### T6.3. Teste E2E — `e2e/alertas.spec.ts`

- Login → cadastra visitante → responsável vê alerta em < 1s.
- Click "Marcar como resolvido" → card some.
- Click "Marcar como lido" → badge muda.

### T6.4. Teste de privacidade (LGPD)

- Grep no `safeLog`: `mensagem` → 0 resultados.
- Grep no payload de `/app/alertas`: `email` → 0 resultados.

## Critérios de pronto

- [ ] Cobertura ≥ 85%.
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] `safeLog` sem PII (gate `lgpd-officer`).
- [ ] `pnpm typecheck` passa.
- [ ] Reatividade: marcar como resolvido atualiza a lista (RR7 revalidação).

## Armadilhas comuns (RAGs)

- **RAG `lgpd-igreja-conect.md` §2.5:** `safeLog` com allowlist. `mensagem` do alerta tem PII (nome + telefone) — **NÃO logar**.
- **RAG `security-rbac-matrix.md`:** defesa em 3 camadas também para alertas. Loader filtra por destinatário, action revalida.
- **AGENTS §"YAGNI":** NÃO criar sistema de prioridades visuais (cores por urgência). Todos são urgentes no MVP.
- **Erro comum:** `resolve` implica `lido = true` mas esquecer de setar. Service deve setar ambos.
- **Erro comum:** loader não filtra por destinatário. Vaza dados.
- **Erro comum:** empty state genérico para "sem alertas" e "filtro vazio". Diferenciar.
