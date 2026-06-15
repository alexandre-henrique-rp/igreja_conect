# Lista de Caixas (`/app/financeiro/caixas`) — Design

## 1. Contexto

Página de **gerenciamento de Caixas** do Módulo Financeiro. Acessível em `/app/financeiro/caixas`. Lista todos os caixas (ativos + arquivados, com toggle), com busca textual, e ações de criar/arquivar/reabrir (RBAC fina).

**Persona-alvo:** perfis com `canSeeFinancials` (4 perfis — `ADMIN`, `PASTOR`, `FINANCEIRO`, `SECRETARIO`). **DISCIPULADOR** e **LIDER_MINISTERIO** recebem 403 em todas as 3 camadas.

**Caso de uso primário (F1 — CRUD de Caixas, RN-FIN-01):** `ADMIN` cria caixa "Cantina" para a campanha de Páscoa. `FINANCEIRO` arquiva caixa "Campanha Natal 2025" após o fim da campanha (soft-delete, RN-FIN-01 + decisão `Caixa.ativo`).

**Casos secundários:**
- Ver histórico de saldos congelados (caixas arquivados mantêm saldo, não aceitam movimentação).
- Toggle "Mostrar arquivados" (só ADMIN/PASTOR/FINANCEIRO — SECRETARIO não gerencia estrutura).
- Busca textual por nome do caixa.
- Ação rápida: "Novo Lançamento" direto da lista (vai para `/app/financeiro/lancamentos/novo?caixaId=<id>`).
- Ação rápida: "Ver Extrato" (vai para `/app/financeiro/caixas/:id`).

**Restrições críticas:**
- **RN-FIN-01 + decisão `Caixa.ativo`:** caixas arquivados não somem do banco (histórico preservado), só da listagem padrão. Toggle "Mostrar arquivados" revela.
- **RN-FIN-02 (rastreabilidade):** ao arquivar, mantém-se o histórico de `saldoCentavos` e lançamentos. Saldo congelado.
- **RAG `lesson-route-service-bypass`:** nunca `prisma.*` direto no loader — sempre via service.

---

## 2. Wireframe

### 2.1 Desktop (≥ 1024px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Topbar + Sidebar (com "Financeiro > Caixas" destacado)                  │
├────────────┬─────────────────────────────────────────────────────────────┤
│ Sidebar    │  Financeiro > Caixas                       [+ Nova Caixa]   │ ← h1 + breadcrumb + CTA
│            │  ┌──────────────────────────────────────────────────────┐  │
│ • Financei-│  │ 🔍 Buscar caixa...   [☐ Mostrar arquivados]         │  │ ← busca + toggle
│   ro(ativo)│  └──────────────────────────────────────────────────────┘  │
│ • Caixas   │                                                             │
│   (ativo)  │  3 caixas encontrados                  Mostrando 1-3        │
│            │  ┌──────────────────────────────────────────────────────┐  │
│            │  │ Nome         │ Saldo (R$)     │ Lanç. │ Status  │ Aç.│  │ ← tabela
│            │  ├──────────────────────────────────────────────────────┤  │
│            │  │ Caixa Geral  │ 1.000,00       │ 5     │ Ativo   │👁📦│  │
│            │  │ Caixa Cantina│ 234,56         │ 2     │ Ativo   │👁📦│  │
│            │  │ Caixa Missões│ 0,00           │ 0     │ Ativo   │👁📦│  │
│            │  └──────────────────────────────────────────────────────┘  │
│            │                                                             │
│            │  ── Mostrando arquivados (1) ──                            │ ← seção separada
│            │  ┌──────────────────────────────────────────────────────┐  │
│            │  │ Campanha Natal 2025 │ 0,00  │ 12  │ Arquivado │🔓│  │  │ ← ação "Reabrir"
│            │  └──────────────────────────────────────────────────────┘  │
└────────────┴─────────────────────────────────────────────────────────────┘
```

### 2.2 Mobile (< 768px)

```
┌──────────────────────────────┐
│ [☰] Caixas         [+ Nova]  │
├──────────────────────────────┤
│ 🔍 Buscar...                 │
│ [☐ Mostrar arquivados]       │
│                              │
│ 3 caixas encontrados         │
│ ┌──────────────────────────┐ │
│ │ Caixa Geral              │ │
│ │ R$ 1.000,00              │ │
│ │ 5 lanç. • Ativo          │ │
│ │ [👁 Ver] [📦 Arquivar]   │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Caixa Cantina            │ │
│ │ R$ 234,56                │ │
│ │ 2 lanç. • Ativo          │ │
│ │ [👁 Ver] [📦 Arquivar]   │ │
│ └──────────────────────────┘ │
│ [Ver arquivados (1)]         │ ← expansível
│                              │
└──────────────────────────────┘
```

---

## 3. Componentes

| Componente | Fonte | Props | Localização |
|---|---|---|---|
| `<ShellAutenticado>` | shared (ciclo 1) | — | (já existe) |
| `<PageHeader>` | shared (ciclo 1) | `title`, `action?` | (já existe) |
| `<Breadcrumb>` | shared (ciclo 1) | `items` | (já existe) |
| `<CaixaSearchBar>` | novo | `defaultQ?: string`, `defaultMostrarArquivados?: boolean` | `app/components/CaixaSearchBar.tsx` |
| `<TabelaCaixas>` | novo | `items: CaixaListItem[]`, `podeGerenciar: boolean`, `podeVerMembro: boolean` | `app/components/TabelaCaixas.tsx` |
| `<CardCaixa>` | novo (mobile) | mesmas props | `app/components/CardCaixa.tsx` |
| `<BadgeStatus>` | novo | `ativo: boolean` | `app/components/BadgeStatus.tsx` |
| `<ModalConfirmar>` | reusar (criar se não existir) | `open`, `onClose`, `title`, `description`, `onConfirm`, `variant?` | `app/components/ModalConfirmar.tsx` |

**Hierarquia:**
- `app/routes/app/financeiro.caixas._index.tsx` (rota `/app/financeiro/caixas`).
- Service `caixas.server.ts` (NOVO) com `listarCaixas({ apenasAtivos, q? }, user)`, `criarCaixa(input, user)`, `arquivarCaixa(id, user)`, `reabrirCaixa(id, user)`.

---

## 4. Estados

| Estado | Quando | Render |
|---|---|---|
| **Initial (com caixas)** | Sistema tem ≥ 1 caixa | Tabela de ativos + (se toggle on) seção de arquivados. |
| **Initial (sistema novo)** | Após `db:reset`, 1 caixa (Caixa Geral) | Tabela mostra 1 caixa (Caixa Geral, R$ 0,00). |
| **Empty (sistema realmente vazio)** | 0 caixas no DB (improvável após seed) | EmptyState: "Nenhum caixa cadastrado. O Caixa Geral deveria ter sido criado pelo seed." + CTA "Rodar pnpm db:seed". |
| **Empty (todos arquivados, toggle off)** | Todos os caixas com `ativo = false` | EmptyState: "Nenhum caixa ativo. Ative um caixa arquivado ou crie um novo." + CTA "+ Nova Caixa" (só ADMIN/PASTOR/FINANCEIRO). |
| **Empty (busca não retorna)** | `?q=...` filtra e 0 resultados | EmptyState: "Nenhum caixa encontrado com \"{q}\"." + botão "Limpar busca". |
| **Mostrar arquivados (toggle on)** | `?mostrarArquivados=true` | Seção separada "Arquivados" abaixo dos ativos, com botão "Reabrir" (só ADMIN/PASTOR/FINANCEIRO). |
| **Modal de confirmação (arquivar)** | Click em "📦 Arquivar" | Modal: "Arquivar caixa \"X\"? Movimentações serão bloqueadas; histórico preservado. Esta ação é reversível (Reabrir)." + Botões "Cancelar" / "Arquivar" (danger). |
| **Modal de confirmação (reabrir)** | Click em "🔓 Reabrir" | Modal: "Reabrir caixa \"X\"? Movimentações serão liberadas. Saldo histórico preservado." + Botões "Cancelar" / "Reabrir" (primary). |
| **Loading** | Loader em andamento | Skeleton: 5 linhas com `animate-pulse`. |
| **Error (500)** | Loader falhou | ErrorState + "Tentar novamente". |
| **Toast sucesso (arquivar)** | Após `arquivarCaixa` OK | Toast: "Caixa \"X\" arquivado. Movimentações bloqueadas; histórico preservado." |
| **Toast sucesso (reabrir)** | Após `reabrirCaixa` OK | Toast: "Caixa \"X\" reaberto. Movimentações liberadas." |
| **Toast sucesso (criar)** | Após `criarCaixa` OK | Toast: "Caixa \"X\" criado com sucesso." + redirect para `/app/financeiro/caixas/<id>` (detalhe). |
| **Erro 409 (nome duplicado)** | `Caixa.nome` unique constraint | Mensagem inline no form: "Já existe um caixa com este nome." |

---

## 5. Fluxos de interação

| Elemento | Evento | Comportamento |
|---|---|---|
| Input "Buscar" | Submit (Enter ou click em "Filtrar") | Atualiza URL `?q=...`. Recarrega lista. |
| Toggle "Mostrar arquivados" | Change | Atualiza URL `?mostrarArquivados=true/false`. Recarrega lista. |
| Botão "Limpar" | Click | Limpa `?q=...` e `?mostrarArquivados=false`. Volta para listagem padrão. |
| Link do nome do caixa | Click | Navega para `/app/financeiro/caixas/<id>` (detalhe/extrato). |
| Botão "👁 Ver" (ação) | Click | Navega para `/app/financeiro/caixas/<id>`. |
| Botão "📦 Arquivar" | Click | Abre `<ModalConfirmar>` com texto padrão. Confirmar → POST `/app/financeiro/caixas/<id>/arquivar`. |
| Botão "🔓 Reabrir" (em arquivado) | Click | Abre `<ModalConfirmar>`. Confirmar → POST `/app/financeiro/caixas/<id>/reabrir`. |
| Botão "+ Nova Caixa" (header) | Click | Navega para `/app/financeiro/caixas/novo` (formulário). |
| Botão "Sair sem salvar" (form nova caixa) | Click | Volta para `/app/financeiro/caixas` (lista). |

**Navegação por teclado:**
- Tab: breadcrumb > busca > toggle > tabela (1 linha por vez) > ações por linha.
- Foco visível em todos os botões e links.

**Modal:** `Esc` fecha. Click fora fecha. Foco vai para o botão "Confirmar" ao abrir (autofocus).

---

## 6. Validações e regras

### 6.1 Schema Zod (criar caixa)

```ts
// app/lib/schemas/caixas.ts
export const CaixaCreateSchema = z.object({
  nome: z.string()
    .min(2, "Nome deve ter ao menos 2 caracteres.")
    .max(80, "Nome muito longo (máx 80).")
    .regex(/^[\w\sÀ-ÿ-]+$/, "Nome inválido (use letras, números, espaços e hífens)."),
}).strict();
```

**Decisão:** regex `[\w\sÀ-ÿ-]+` permite acentuação PT-BR (À-ÿ = Latin-1 Supplement) + hífen. Sem aspas, sem caracteres especiais.

### 6.2 Regras de negócio

- **RN-FIN-01:** `Caixa.nome` é `@unique`. Criar duplicado → 409 (Zod rejeita; captura `P2002` do Prisma).
- **Decisão `Caixa.ativo`:** arquivar seta `ativo = false`; reabrir seta `ativo = true`. Saldo nunca é mutado por essas ações.
- **RBAC criar/arquivar/reabrir:** apenas `ADMIN`, `PASTOR`, `FINANCEIRO` (matriz §4.8 do brief). `SECRETARIO` **não** pode (apenas opera dentro dos caixas existentes).
- **Toggle "Mostrar arquivados":** visível para todos os 4 perfis com `canSeeFinancials`. Ação "Reabrir" só aparece para ADMIN/PASTOR/FINANCEIRO. SECRETARIO vê arquivados (read-only) mas não pode reabrir.
- **Sem upload de imagem/descrição do caixa:** nome é o único campo. Decisão YAGNI: descrição textual longa, sem necessidade no ciclo 2.
- **Sem edição de `saldoCentavos` via UI:** saldo é **sempre** atualizado por `criarLancamento` ou `transferirEntreCaixas`. Não há "ajuste manual" no ciclo 2 (auditoria forte, RN-FIN-04).

### 6.3 Edge cases

- **Nome duplicado:** Zod `.regex` aceita, mas Prisma `P2002` rejeita. Capturar no service e retornar erro legível.
- **Arquivar caixa com saldo ≠ 0:** permitido (saldo congelado, histórico preservado). UI exibe aviso no modal: "Este caixa tem saldo R$ X,XX. Ele será preservado no extrato."
- **Arquivar caixa que é origem/destino de transferências pendentes (impossível no MVP):** transferências já são atômicas no momento de criação. Sem "pendente".
- **Reabrir caixa que tem `Caixa.ativo = true` (idempotência):** service checa antes; se já ativo, retorna OK sem mutar (ou lança 409 — YAGNI, idempotência é mais simples).
- **Reabrir caixa cujo nome agora conflita com outro ativo:** impossível (`Caixa.nome` é `@unique`). Não há cenário de conflito.

---

## 7. RBAC (defesa em 3 camadas)

| Operação | ADMIN | PASTOR | FINANCEIRO | SECRETARIO | DISCIPULADOR | LIDER_MIN. |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Ver lista de caixas | ✅ | ✅ | ✅ | ✅ | 🚫 | 🚫 |
| Ver toggle "Mostrar arquivados" | ✅ | ✅ | ✅ | ✅ | 🚫 | 🚫 |
| Ver caixas arquivados (read-only) | ✅ | ✅ | ✅ | ✅ | 🚫 | 🚫 |
| Botão "+ Nova Caixa" (header) | ✅ | ✅ | ✅ | 🚫 | 🚫 | 🚫 |
| Botão "📦 Arquivar" (por linha) | ✅ | ✅ | ✅ | 🚫 | 🚫 | 🚫 |
| Botão "🔓 Reabrir" (por linha, em arquivados) | ✅ | ✅ | ✅ | 🚫 | 🚫 | 🚫 |
| `POST /app/financeiro/caixas` (action) | ✅ | ✅ | ✅ | 🚫 (403) | 🚫 (403) | 🚫 (403) |
| `PATCH /app/financeiro/caixas/:id/arquivar` | ✅ | ✅ | ✅ | 🚫 (403) | 🚫 (403) | 🚫 (403) |
| `PATCH /app/financeiro/caixas/:id/reabrir` | ✅ | ✅ | ✅ | 🚫 (403) | 🚫 (403) | 🚫 (403) |

**Defense em 3 camadas:**
- **UI (Camada 1):** `<Can allow={[...]}>` esconde botões para SECRETARIO/DISCIPULADOR/LIDER_MINISTERIO.
- **Loader/Action (Camada 2):** `assertCanManageCaixa(user)` no início de cada action/loader antes de I/O. Helper novo em `app/lib/rbac.server.ts`.
- **Service (Camada 3):** `criarCaixa`, `arquivarCaixa`, `reabrirCaixa` chamam `assertCanManageCaixa(user)` como PRIMEIRA linha.

**Helper novo (a ser criado no ciclo 2):**

```ts
// app/lib/rbac.server.ts (extensão do ciclo 1)
export function assertCanManageCaixa(user: SessionUser): void {
  const allowed: Cargo[] = ["ADMIN", "PASTOR", "FINANCEIRO"];
  if (!user.cargo || !allowed.includes(user.cargo)) {
    throw new Response("Você não tem permissão para criar ou arquivar caixas.", { status: 403 });
  }
}
```

---

## 8. Dados (loader + service)

### 8.1 Loader

```ts
// app/routes/app/financeiro.caixas._index.tsx
export async function loader({ request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  // Camada 2 RBAC
  assertCanSeeFinancials(user);

  // Parse query string
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() || undefined;
  const apenasAtivos = url.searchParams.get("mostrarArquivados") !== "true"; // default: só ativos

  // Camada 3 (service)
  const data = await listarCaixas({ apenasAtivos, q }, user);
  return { ...data, user, q, apenasAtivos };
}
```

### 8.2 Service contract (`app/lib/caixas.server.ts` — NOVO)

```ts
/**
 * @description Lista caixas ativos (ou todos) com filtro opcional por nome.
 * RBAC: qualquer perfil com canSeeFinancials.
 * @param {object} options
 * @param {boolean} options.apenasAtivos - Se true, filtra where: { ativo: true }. Default: true.
 * @param {string} [options.q] - Filtro de busca textual (case-insensitive, contains).
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<{ ativos: CaixaResumo[], arquivados: CaixaResumo[] }>}
 * @throws {Response} 403 se user sem perfil financeiro (Camada 3).
 */
export async function listarCaixas(
  options: { apenasAtivos?: boolean; q?: string },
  user: SessionUser
): Promise<{ ativos: CaixaResumo[]; arquivados: CaixaResumo[] }>;

/**
 * @description Cria um novo caixa. Apenas ADMIN/PASTOR/FINANCEIRO.
 * @param {CaixaCreateInput} input - Validado por CaixaCreateSchema.
 * @param {SessionUser} user - Operador autenticado.
 * @returns {Promise<Caixa>} Caixa criado com ativo: true.
 * @throws {Response} 400 se nome duplicado (P2002), 403 se cargo inválido, 422 se Zod falhar.
 */
export async function criarCaixa(input: CaixaCreateInput, user: SessionUser): Promise<Caixa>;

/**
 * @description Arquiva um caixa (soft-delete, ativo: false). Apenas ADMIN/PASTOR/FINANCEIRO.
 * @param {string} id - UUID do caixa.
 * @param {SessionUser} user - Operador autenticado.
 * @returns {Promise<Caixa>} Caixa atualizado.
 * @throws {Response} 403, 404, 409 se caixa já arquivado.
 */
export async function arquivarCaixa(id: string, user: SessionUser): Promise<Caixa>;

/**
 * @description Reabre um caixa arquivado (ativo: true). Apenas ADMIN/PASTOR/FINANCEIRO.
 * @param {string} id - UUID do caixa.
 * @param {SessionUser} user - Operador autenticado.
 * @returns {Promise<Caixa>} Caixa atualizado.
 * @throws {Response} 403, 404, 409 se caixa já ativo.
 */
export async function reabrirCaixa(id: string, user: SessionUser): Promise<Caixa>;
```

**`CaixaResumo` type:**

```ts
type CaixaResumo = {
  id: string;
  nome: string;
  saldoCentavos: number;
  ativo: boolean;
  lancamentosMes: number; // COUNT WHERE dataCompetencia >= firstDayOfMonth
  createdAt: Date;
};
```

### 8.3 Edge cases do service

- **0 caixas:** `ativos: []`, `arquivados: []`. UI renderiza empty state.
- **Busca `q`:** `where: { nome: { contains: q } }` (case-insensitive via SQLite collation default).
- **Caracteres especiais em `q`:** `contains` do Prisma escapa automaticamente. Sem `mode: "insensitive"` (não suportado em SQLite).
- **Toggle `apenasAtivos = false`:** retorna **ambos** arrays. Service decide: separa por `ativo`.

---

## 9. Testes sugeridos (TDD)

### 9.1 Unit (sem DB)

- `CaixaCreateSchema`:
  - Aceita `"Caixa Geral"`, `"Cantina"`, `"Missão 2026"`.
  - Rejeita `""` (vazio).
  - Rejeita `"a"` (1 char).
  - Rejeita `nome` com 81+ chars.
  - Rejeita `nome` com aspas ou caracteres especiais.
- `assertCanManageCaixa(adminUser)` → **não lança**.
- `assertCanManageCaixa(secretarioUser)` → lança `Response(403)`.
- `assertCanManageCaixa(discipuladorUser)` → lança `Response(403)`.

### 9.2 Integração (com DB, `setupTestDb`)

- `listarCaixas({ apenasAtivos: true }, adminUser)`:
  - Retorna 3 caixas (1 seed + 2 criados).
  - Não inclui arquivados.
- `listarCaixas({ apenasAtivos: false }, adminUser)`:
  - Retorna 3 ativos + 1 arquivado (separados em 2 arrays).
- `listarCaixas({ q: "Cantina" }, adminUser)`:
  - Retorna apenas 1 caixa.
- `criarCaixa({ nome: "Nova Caixa" }, adminUser)`:
  - Cria caixa com `ativo: true`, `saldoCentavos: 0`.
- `criarCaixa({ nome: "Caixa Geral" }, adminUser)` → lança erro (P2002, 409).
- `criarCaixa({ nome: "X" }, secretarioUser)` → lança `Response(403)`.
- `arquivarCaixa(caixaId, adminUser)`:
  - Seta `ativo: false`.
  - Saldo preservado.
- `arquivarCaixa(caixaId, secretarioUser)` → lança `Response(403)`.
- `reabrirCaixa(caixaId, adminUser)`:
  - Seta `ativo: true`.
- `reabrirCaixa(caixaId, adminUser)` em caixa já ativo → idempotente (ou 409 — decisão).

### 9.3 E2E (Playwright) — `e2e/financeiro-caixas.spec.ts`

- Login `financeiro@igreja.local` → `/app/financeiro/caixas` → vê 1 caixa (Caixa Geral).
- Click "+ Nova Caixa" → `/app/financeiro/caixas/novo` → preenche "Cantina" → submit → 302 para `/app/financeiro/caixas/<id>`.
- Volta para lista → vê 2 caixas.
- Click "📦 Arquivar" em "Cantina" → modal aparece → confirma → toast "Cantina arquivado".
- Toggle "Mostrar arquivados" → seção "Arquivados" mostra "Cantina".
- **Bypass SECRETARIO:** login `secretario@igreja.local` → `/app/financeiro/caixas` → 200, mas **botão "+ Nova Caixa" ausente** (Camada 1 UI) **e** URL direta em `/app/financeiro/caixas/novo` → 403 (Camada 2).
- **Bypass DISCIPULADOR:** login `discipulador@igreja.local` → `/app/financeiro/caixas` direto na URL → 403.

---

## 10. Critérios de aceite (gate Phase 5)

- [ ] Loader chama `assertCanSeeFinancials` **antes** de qualquer I/O.
- [ ] Service `listarCaixas`, `criarCaixa`, `arquivarCaixa`, `reabrirCaixa` com JSDoc completo.
- [ ] `assertCanManageCaixa` é helper novo em `rbac.server.ts`.
- [ ] Toggle "Mostrar arquivados" filtra via `where: { ativo: true/false }`.
- [ ] SECRETARIO **não** vê botões "Nova Caixa", "Arquivar", "Reabrir" (Camada 1).
- [ ] SECRETARIO **não** consegue bypass via URL direta (Camada 2 403).
- [ ] Caixas arquivados preservam `saldoCentavos` e histórico de lançamentos.
- [ ] Reabrir restaura `ativo = true`, saldo preservado.
- [ ] Nome duplicado → 409 com mensagem inline.
- [ ] Modal de confirmação com texto explicativo (UX de "reversível").
- [ ] Empty states amigáveis (sem caixas, busca vazia, todos arquivados).
- [ ] Cobertura do service ≥ 100% (gate RN-FIN-01).
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] `pnpm typecheck` passa.
- [ ] Sem dado sensível em log (`safeLog`).

---

## 11. Acessibilidade

- **`<h1>`** = "Caixas" (subordinado ao `<h1>` "Financeiro" da página pai).
- **`<h2>`** para "Caixas ativos (N)" e "Arquivados (M)".
- **`<table>`** com `<caption className="sr-only">`, `<th scope="col">`.
- **Toggle "Mostrar arquivados"** com `<label>` associada via `htmlFor`.
- **Botão "📦 Arquivar"** com `aria-label="Arquivar caixa {nome}"` (ícone de emoji é decorativo, texto é nome).
- **Modal** com `role="dialog"`, `aria-modal="true"`, `aria-labelledby` apontando para o título.
- **Foco preso dentro do modal** enquanto aberto (Tab cycle).
- **Foco volta para o botão "Arquivar"** ao fechar o modal.
- **Toast** com `role="status"`, `aria-live="polite"`.

---

## 12. Mobile

- **Toggle "Mostrar arquivados"** acima da lista, full-width.
- **Lista de caixas** vira `<CardCaixa>` (não tabela).
- **Botão "📦 Arquivar"** em cada card, full-width.
- **Modal de confirmação** ocupa 90% da tela em mobile.
- **Targets de toque** ≥ 44×44px.

---

## 13. Cross-references

- **PRD:** [Apêndice D §D.3 F1 (CRUD de Caixas)](./PRD.html#c2-features), §D.4 (aceitação).
- **SPEC:** [Apêndice D §D.4 (`GET /app/financeiro/caixas`, `POST /app/financeiro/caixas`, `PATCH .../arquivar`, `PATCH .../reabrir`)](./SPEC.html#c2-endpoints).
- **AGENTS:** [§"Módulo Financeiro (ciclo 2)" §"Onde mora cada trava"](./agents/AGENTS.md).
- **ARCH:** [§8.1 (Camadas), §8.6 (Models), §8.7 (RBAC fina)](./docs/architecture/ARCH.md).
- **RAGs:**
  - [`.harness/RAG/architecture-financeiro.md`](./.harness/RAG/architecture-financeiro.md) §4.1 (Lifecycle de Caixa).
  - [`.harness/RAG/decision-caixa-soft-delete.md`](./.harness/RAG/decision-caixa-soft-delete.md) §2 (decisão completa, **APPROVED**).
  - [`.harness/RAG/security-rbac-matrix.md`](./.harness/RAG/security-rbac-matrix.md) — matriz + `assertCanManageCaixa` (helper novo).
  - [`.harness/RAG/pattern-3-layer-rbac.md`](./.harness/RAG/pattern-3-layer-rbac.md) — UI / loader / service.
  - [`.harness/RAG/convention-monetary-values.md`](./.harness/RAG/convention-monetary-values.md) — `formatBRLFromCents`.
  - [`.harness/RAG/lgpd-igreja-conect.md`](./.harness/RAG/lgpd-igreja-conect.md) — sem PII em log.
