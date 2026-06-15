# Lista de Membros — Design

## 1. Propósito

Tela principal do **Módulo de Membros**. Lista todos os membros cadastrados no sistema (com escopo RBAC), com busca textual e filtros por tipo, ministério e discipulador. Acessível em `/app/membros`.

**Persona-alvo:** qualquer perfil autenticado. O caso de uso primário é do Secretário consultando quem está cadastrado, mas Pastor, Admin, Discipulador, Líder de Ministério e Financeiro também usam (cada um com escopo diferente — ver §7).

**Caso de uso primário (US-MEM-003 do PRD):** Secretário consulta a lista, aplica filtros (tipo, ministério, discipulador) e busca por nome.

**Casos secundários:**
- Paginação.
- Ações rápidas por linha (ver detalhe, editar — se permitido).
- Ações em lote (futuro, fora do MVP).
- Export (PRD §4 — fora do MVP).
- Empty state para sistema novo ou filtros que não retornam nada.

**Restrição crítica:** a **aba "Fidelidade Financeira"** não existe nesta página (vive no detalhe do membro). Aqui só dados cadastrais + discipulado + ministérios.

---

## 2. Wireframe

### 2.1 Desktop (≥ 1024px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Topbar + Sidebar (com "Membros" destacado)                              │
├────────────┬─────────────────────────────────────────────────────────────┤
│ Sidebar    │  Membros                                  [+ Novo membro]   │ ← h1 + CTA
│            │  ┌──────────────────────────────────────────────────────┐  │
│ • Dashboard│  │ 🔍 Buscar por nome...     [Tipo ▼] [Ministério ▼]   │  │ ← filtros
│ • Membros  │  │ [Discipulador ▼]  [Limpar]                            │  │
│   (ativo)  │  └──────────────────────────────────────────────────────┘  │
│ • Ministé- │                                                             │
│   rios     │  47 membros encontrados                  Mostrando 1-25    │ ← contagem
│ • Alertas  │  ┌──────────────────────────────────────────────────────┐  │
│ • Config   │  │ Nome           │ Tipo         │ Discipulador │ Ações │  │ ← tabela
│            │  ├──────────────────────────────────────────────────────┤  │
│ ─────      │  │ Ana Pereira    │ MEMBRO_ATIVO │ João Silva   │ 👁 ✏│  │
│ Sair       │  │ Carlos Souza   │ CONGREGADO   │ —            │ 👁 ✏│  │
│            │  │ Maria Silva    │ VISITANTE    │ —            │ 👁 ✏│  │
│            │  │ ...                                                      │  │
│            │  └──────────────────────────────────────────────────────┘  │
│            │                                                             │
│            │              ‹ 1 2 3 ... 5 ›      Por página: 25 ▼        │ ← paginação
│            │                                                             │
└────────────┴─────────────────────────────────────────────────────────────┘
```

### 2.2 Mobile (< 768px)

```
┌──────────────────────────────┐
│ [☰] [Logo]    [🔔] [Avatar ▼]│
├──────────────────────────────┤
│ Membros        [+ Novo]      │ ← header compacto
│                              │
│ 🔍 Buscar...                 │
│ [Filtros ▼]                  │ ← filtros colapsáveis
│                              │
│ 47 encontrados               │
│                              │
│ ┌──────────────────────────┐ │
│ │ Ana Pereira              │ │ ← cards em vez de tabela
│ │ MEMBRO_ATIVO • J. Silva  │ │
│ │ [👁 Ver]    [✏ Editar]   │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Carlos Souza             │ │
│ │ CONGREGADO               │ │
│ │ [👁 Ver]    [✏ Editar]   │ │
│ └──────────────────────────┘ │
│ ...                          │
│                              │
│ [Carregar mais]              │ ← "Load more" (infinito) OU paginação clássica
│                              │
└──────────────────────────────┘
```

---

## 3. Componentes

| Componente | Fonte | Props | Localização |
|---|---|---|---|
| `<ShellAutenticado>` | shared | `user`, `currentPath` | `app/components/ShellAutenticado.tsx` |
| `<PageHeader>` | novo | `title`, `action?: ReactNode` (botão à direita) | `app/components/PageHeader.tsx` |
| `<FiltrosMembros>` | novo | `defaultValues: { tipo?, ministerioId?, discipuladorId?, q? }`, `ministerios: Ministerio[]`, `discipuladores: Membro[]` | `app/components/FiltrosMembros.tsx` |
| `<InputSearch>` | shared (estende Input) | `placeholder`, `name="q"`, `defaultValue` | reusa `<Input>` |
| `<Select>` | novo | `name`, `value`, `onChange`, `options: { value, label }[]`, `placeholder` | `app/components/Select.tsx` |
| `<TabelaMembros>` | novo | `items: Membro[]`, `canEdit: boolean`, `currentUserCargo` | `app/components/TabelaMembros.tsx` |
| `<CardMembro>` | novo | `membro`, `canEdit` (usado em mobile) | `app/components/CardMembro.tsx` |
| `<Pagination>` | novo | `current`, `total`, `basePath`, `searchParams` (preserva filtros) | `app/components/Pagination.tsx` |
| `<EmptyState>` | shared | `title`, `description`, `action?` | `app/components/EmptyState.tsx` |
| `<Skeleton>` | shared | `rows`, `variant: "row" \| "card"` | `app/components/Skeleton.tsx` |

**Hierarquia:**
- `app/routes/app/membros._index.tsx` (rota `/app/membros`).
  - loader: `listMembros(filter, user)` (service).
  - `<PageHeader title="Membros" action={<Button as={Link} to="/app/membros/novo">+ Novo membro</Button>} />`.
  - `<FiltrosMembros defaultValues={...} ministerios={...} discipuladores={...} />`.
  - Conditional: `<TabelaMembros />` (desktop/tablet) ou `<CardMembro />` (mobile).
  - `<Pagination />`.

> **Decisão de rota:** uso o padrão de "flat routes" do RR7 — `membros._index.tsx` para a lista, `membros.novo.tsx` para criar, `membros.$id.tsx` para detalhe, `membros.$id.editar.tsx` para editar. Cada um é uma rota independente, mas compartilham layout do `app/routes/app/membros.tsx` (que só renderiza `<Outlet />`).

---

## 4. Estados

| Estado | Quando | Render |
|---|---|---|
| **Initial** | Loader OK, há membros | Tabela/cards com membros. |
| **Loading** | Loader em andamento | `<Skeleton variant="row" rows={5} />` (ou `card` em mobile). |
| **Empty (sistema novo)** | Nenhum membro cadastrado | `<EmptyState title="Nenhum membro por aqui ainda" description="Cadastre o primeiro membro para começar." action={<Button>+ Cadastrar membro</Button>} />`. |
| **Empty (filtro não retornou)** | Filtros aplicados mas 0 resultados | `<EmptyState title="Nenhum membro encontrado" description="Tente ajustar os filtros ou limpar a busca." action={<Button variant="ghost" onClick={clearFilters}>Limpar filtros</Button>} />`. |
| **Error (500)** | Loader falhou | `<ErrorState title="Não foi possível carregar os membros" description={error.message} action={<Button>Recarregar</Button>} />`. |
| **DISCIPULADOR sem discípulos** | Perfil com escopo vazio | Empty state customizado: "Você ainda não tem discípulos. Vincule membros a você para começar." |
| **LIDER_MINISTERIO sem membros do min.** | (futuro) Escopo vazio | Empty state customizado: "Seu ministério ainda não tem membros." |

---

## 5. Interações

| Elemento | Evento | Comportamento |
|---|---|---|
| Input de busca | `change` (debounce 300ms) | Atualiza URL `?q=...` via `useSubmit()` (RR7). |
| Select "Tipo" | `change` | Submete form (Form method="get") → URL atualiza. |
| Select "Ministério" | `change` | Mesmo. |
| Select "Discipulador" | `change` | Mesmo. |
| Botão "Limpar" | Click | Navega para `/app/membros` (limpa todos os filtros). |
| Linha da tabela | Click (em qualquer célula exceto Ações) | Navega para `/app/membros/:id`. |
| Botão 👁 (ver) | Click | Navega para `/app/membros/:id`. |
| Botão ✏ (editar) | Click | Navega para `/app/membros/:id/editar`. |
| Botão + Novo membro | Click | Navega para `/app/membros/novo`. |
| Paginação | Click | Navega para `?page=N` mantendo os outros filtros. |
| "Por página" | `change` | Navega para `?pageSize=N`. |

**Debounce na busca:** o input `q` usa `useDebouncedCallback` (10 linhas, sem lib) com delay 300ms. Submeter atualiza URL e loader re-roda.

**Navegação por teclado:**
- Tab: filtros → filtros → ... → botão Limpar → linha 1 → linha 2 → ... → paginação.
- Setas ↑/↓ em desktop não fazem nada (tabela não é navegável por seta no MVP — usar Tab).
- Enter no input de busca = submit.

---

## 6. Validações e regras

### 6.1 Filtros (Zod opcional — viram search params)

URL search params aceitos:
- `tipo: "VISITANTE" | "CONGREGADO" | "MEMBRO_ATIVO"`
- `ministerioId: string (UUID)`
- `discipuladorId: string (UUID)`
- `q: string (1-100 chars)`
- `page: number (default 1)`
- `pageSize: number (default 25, max 100)`

Validação no service `listMembros` — se `pageSize > 100`, clamp para 100 (anti-DoS).

### 6.2 Regras de negócio (RN-MEM-01 + RBAC)

- **Escopo por perfil:**
  - `ADMIN, PASTOR, SECRETARIO, FINANCEIRO` → veem todos os membros.
  - `DISCIPULADOR` → veem apenas membros onde `discipuladorId === user.id`.
  - `LIDER_MINISTERIO` → veem todos no MVP (decisão SPEC §12.2 — refinar em sprint 2+ quando `LiderMinisterio` entrar).
- **Sanitização de `q`:** trim + escape de `%` e `_` (SQLite `LIKE` usa esses wildcards). O service usa `contains` do Prisma que escapa internamente, mas por segurança extra o loader chama `q.trim().slice(0, 100)`.

### 6.3 Edge cases

- **`q` com acentos:** o `contains` do Prisma no SQLite é case-insensitive **por padrão** mas não trata acentos (ex: "joao" não acha "João"). **Decisão:** usar `mode: "insensitive"` (PostgreSQL) **NÃO** funciona no SQLite. **Alternativa:** normalizar com `String.prototype.normalize("NFD").replace(/[\u0300-\u036f]/g, "")` antes de buscar (tira acentos). Implementar no service.
- **`q` com `%` ou `_`:** o escape do Prisma trata.
- **Filtros combinados:** todos os filtros se aplicam com AND. Se nenhum filtro, retorna todos (até a paginação).

---

## 7. RBAC

| Perfil | Permissões nesta página |
|---|---|
| ADMIN, PASTOR, SECRETARIO, FINANCEIRO | 👁 Ver todos. ✅ Criar, editar (botão visível). |
| DISCIPULADOR | 👁 Ver apenas seus discípulos. ✅ Criar, editar (escopo respeitado no service). ❌ Excluir (RN-MEM-04). |
| LIDER_MINISTERIO | 👁 Ver todos (MVP) ou seu min. (sprint 2+). ✅ Criar, editar. |
| Membro comum | ❌ Middleware barra. |

**Defesa em profundidade:**
- **UI:** o loader retorna `items` já filtrado pelo service. A UI não tem como mostrar algo que o service não mandou.
- **Service:** `listMembros(filter, user)` aplica `where` adicional com base em `user.cargo`.
- **Loader:** chama `assertCanWriteMembers(user)` (helper em `rbac.server.ts`) — qualquer um autenticado passa (RN-MEM-01).

---

## 8. Acessibilidade

- **`<h1>`** = "Membros".
- **`<h2>`** escondidos visualmente (`sr-only`) para "Filtros", "Lista", "Paginação" — para navegação por screen reader.
- **Inputs de filtro** com `<label>` (em mobile, label `sr-only` + `placeholder`).
- **Tabela** com `<caption className="sr-only">Lista de membros</caption>` e `<th scope="col">`.
- **Linhas da tabela** são `<tr>` clicáveis (envoltório `<Link>` semântico? Não — RR7 não suporta `<tr as={Link}>`. Solução: cada linha tem um link na primeira célula "Nome", que é o ponto focal. Outras células não são clicáveis, mas a linha inteira é focável via JS: `<tr role="link" tabIndex={0} onKeyDown={Enter → navigate}>` — **decisão:** implementar isso é YAGNI no MVP. Foco no nome é suficiente.)
- **Botões de ação** com `aria-label="Ver Ana Pereira"` / `"Editar Ana Pereira"`.
- **Paginação** é `<nav aria-label="Paginação">` com `<ol>` e `<li>`.
- **Mensagem de contagem** (`47 membros encontrados`) com `aria-live="polite"` (anuncia mudanças).

---

## 9. Mobile

- **Filtros colapsáveis:** em mobile, filtros ficam dentro de um `<details>` (toggle nativo) ou `<Sheet>`. Default: fechado. Botão "Filtros" no topo abre.
- **Tabela vira cards** (`<CardMembro>`): 1 card por membro, com nome (h3), tipo, discipulador, ações em rodapé.
- **Paginação:** botão "Carregar mais" (infinite scroll manual) em vez de "1 2 3 4 5" — UX mobile é scroll, não número de página. **Trade-off aceito:** menos controle sobre "pular para página N", mas mobile-first prioriza scroll contínuo.
- **Ordenação:** no MVP, sempre `orderBy: { nome: "asc" }`. Sem sort UI. (YAGNI — sem demanda de produto para ordenar.)

---

## 10. Critérios de aceite (testáveis)

### 10.1 Funcionais

- [ ] `GET /app/membros` (autenticado) retorna 200 e renderiza a lista.
- [ ] `GET /app/membros?tipo=VISITANTE` filtra para apenas visitantes.
- [ ] `GET /app/membros?q=maria` filtra para nomes contendo "maria" (case-insensitive).
- [ ] `GET /app/membros?q=joao` **também** acha "João" (normalização de acentos).
- [ ] `GET /app/membros?page=2&pageSize=25` retorna a 2ª página.
- [ ] DISCIPULADOR logado recebe apenas seus discípulos (escopo).
- [ ] ADMIN recebe todos.
- [ ] Paginação mostra "‹ 1 2 3 ›" com 47 membros e pageSize 25 → 2 páginas.
- [ ] Botão "Limpar" volta para `/app/membros` sem filtros.
- [ ] Filtros são preservados ao paginar (URL state).

### 10.2 Qualidade

- [ ] Lighthouse Accessibility ≥ 95.
- [ ] Cobertura ≥ 85% (loader + service + componentes).
- [ ] `pnpm typecheck` passa.
- [ ] Payload **nunca** inclui `senhaHash` (verificável com `grep` no response).
- [ ] Tempo de loader < 300ms p95 com 1k membros.

### 10.3 UX

- [ ] Empty state para sistema novo mostra CTA grande.
- [ ] Empty state para "filtro sem resultado" mostra botão "Limpar".
- [ ] Loading skeleton visível durante navegação.
- [ ] Em mobile (375px), cards ficam full-width sem scroll horizontal.
- [ ] Tab navega de filtro em filtro e depois para a lista.
- [ ] Click no nome do membro navega para o detalhe.
