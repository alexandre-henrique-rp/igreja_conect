# Lista de Ministérios — Design

## 1. Propósito

Tela de **gestão de ministérios** (grupos da igreja: louvor, infantil, diaconal, etc.) e **vinculação de membros** a ministérios. Acessível em `/app/ministerios`.

**Persona-alvo:** ADMIN/PASTOR/SECRETARIO para gestão de ministérios; qualquer perfil para ver quem está em cada ministério.

**Caso de uso primário:** Pastor consulta "quem está no louvor?" e precisa adicionar/remover membros.

**Casos secundários:**
- **Criar novo ministério** (ADMIN) — nome + descrição.
- **Editar ministério** (ADMIN).
- **Excluir ministério** (ADMIN, se não tiver membros).
- **Vincular membro a ministério** (qualquer perfil).
- **Desvincular membro** (qualquer perfil).
- **Definir um ministério como responsável pelo acolhimento** (ADMIN only — integrado com `/app/config/acolhimento`, não nesta tela diretamente).

**Restrição:** ministérios podem ter **vínculo com acolhimento de visitantes** (RN-MEM-05), mas essa configuração é em `/app/config/acolhimento`, não aqui.

---

## 2. Wireframe

### 2.1 Desktop (≥ 1024px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Topbar + Sidebar                                                       │
├────────────┬─────────────────────────────────────────────────────────────┤
│ Sidebar    │  Ministérios                            [+ Novo ministério]  │ ← h1 + CTA
│            │                                                             │
│            │  ┌─ Louvor (12 membros) ──────────────────────────────────┐ │
│            │  │ Coordenação: João Silva                               │ │
│            │  │                                                        │ │
│            │  │ Membros:                                               │ │
│            │  │  • Ana Pereira                  [Desvincular]          │ │
│            │  │  • Carlos Souza                 [Desvincular]          │ │
│            │  │  • ...                       [+ Adicionar membro]     │ │
│            │  │                                                        │ │
│            │  │                              [Editar] [Excluir]        │ │
│            │  └────────────────────────────────────────────────────────┘ │
│            │                                                             │
│            │  ┌─ Infantil (8 membros) ────────────────────────────────┐  │
│            │  │ ... (mesmo padrão)                                     │  │
│            │  └────────────────────────────────────────────────────────┘ │
│            │                                                             │
│            │  ┌─ Diaconal (5 membros) ────────────────────────────────┐   │
│            │  │ ...                                                     │   │
│            │  └────────────────────────────────────────────────────────┘   │
└────────────┴─────────────────────────────────────────────────────────────┘
```

### 2.2 Mobile

```
┌──────────────────────────────┐
│ Ministérios      [+ Novo]    │
├──────────────────────────────┤
│                              │
│ ┌──────────────────────────┐ │
│ │ Louvor                   │ │
│ │ 12 membros               │ │
│ │ Coord: João Silva        │ │
│ │ [Ver membros]            │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Infantil                 │ │
│ │ 8 membros                │ │
│ │ ...                      │ │
│ └──────────────────────────┘ │
│                              │
│ (click expande para ver     │
│  membros)                    │
└──────────────────────────────┘
```

---

## 3. Componentes

| Componente | Fonte | Props | Localização |
|---|---|---|---|
| `<ShellAutenticado>` | shared | — | (já existe) |
| `<PageHeader>` | shared | — | (já existe) |
| `<CardMinisterio>` | novo | `ministerio`, `membros`, `onAddMembro`, `onRemoveMembro`, `canEdit`, `canDelete` | `app/components/CardMinisterio.tsx` |
| `<ModalCriarMinisterio>` | novo | `open`, `onClose`, `onCreated` | `app/components/ModalCriarMinisterio.tsx` |
| `<ModalVincularMembro>` | novo | `open`, `onClose`, `ministerioId`, `onLinked` (autocomplete + select) | `app/components/ModalVincularMembro.tsx` |
| `<EmptyState>` | shared | — | (já existe) |
| `<Can>` | shared | — | (já existe) |

**Hierarquia:**
- `app/routes/app/ministerios._index.tsx`.
  - loader: `listMinisterios(user)` (com `membros` count e primeiros 5 membros de cada).
  - action: `createMinisterio`, `updateMinisterio`, `deleteMinisterio`, `addMembroToMinisterio`, `removeMembroFromMinisterio` (1 action com `intent`).

---

## 4. Estados

| Estado | Quando | Render |
|---|---|---|
| **Initial (com ministérios)** | Sistema tem ministérios cadastrados | Lista de cards. |
| **Empty (sistema novo)** | 0 ministérios | `<EmptyState title="Nenhum ministério cadastrado" description="Crie o primeiro." action={<Button>+ Novo ministério</Button>} />`. |
| **Loading** | Loader em andamento | Skeleton de 3 cards. |
| **Erro (500)** | Loader falhou | ErrorState com retry. |
| **Modal criar aberto** | Click "+ Novo ministério" | Modal com form (nome + descrição). |
| **Modal vincular aberto** | Click "+ Adicionar membro" | Modal com select de membros (autocomplete). |
| **Sucesso criar** | Action OK | Toast "Ministério criado." + modal fecha + lista atualiza. |
| **Sucesso vincular** | Action OK | Toast "Membro vinculado." + card atualiza. |
| **Sucesso excluir** | Action OK | Toast "Ministério excluído." + card some. |
| **Erro de validação** | Nome vazio, nome duplicado | Mensagem inline no campo. |
| **Tentativa de excluir com membros** | Click "Excluir" em ministério com membros | Bloqueio no service (constraint). UI mostra erro "Desvincule os N membros antes de excluir.". |

---

## 5. Interações

| Elemento | Evento | Comportamento |
|---|---|---|
| Botão "+ Novo ministério" | Click | Abre modal. |
| Card de ministério (mobile) | Click | Expande para mostrar membros. |
| Botão "+ Adicionar membro" (no card) | Click | Abre modal de vincular. |
| Botão "Desvincular" (por linha de membro) | Click | Confirmação, action. |
| Botão "Editar" (no rodapé do card) | Click | Abre modal de edição (mesmo do criar, com `defaultValues`). |
| Botão "Excluir" (no rodapé do card) | Click | Modal de confirmação com aviso se tem membros. |
| Input de busca no modal vincular | `change` (debounce 300ms) | Filtra membros. |
| Botão "Salvar" no modal criar/editar | Click | Valida, submete. |
| Esc / click fora do modal | — | Fecha modal sem salvar. |

**Navegação por teclado:**
- Tab: header → card 1 (botões) → card 2 → ... → CTA global.
- No modal: foco preso.

---

## 6. Validações e regras

### 6.1 Schema Zod (`app/lib/schemas/ministerios.ts`)

```ts
export const MinisterioCreateSchema = z.object({
  nome: z.string().min(2, "Nome deve ter ao menos 2 caracteres.").max(80, "Nome muito longo (máx 80)."),
  descricao: z.string().max(500).optional(),
});

export const MinisterioUpdateSchema = MinisterioCreateSchema.partial();

export const VincularMembroSchema = z.object({
  ministerioId: z.string().uuid(),
  membroId: z.string().uuid(),
});
```

### 6.2 Regras de negócio

- **RN-MEM-01:** qualquer perfil autenticado pode criar/editar/vincular (MVP — refinar em sprint 2+).
- **Nome único:** `Ministerio.nome @unique`. Duplicata retorna erro legível.
- **Excluir com membros:** `@@unique([membroId, ministerioId])` na junção. Cascade apaga a junção mas mantém membros. Bloquear exclusão no service se `count(membros) > 0` (UX melhor que cascade silencioso).
- **Vincular mesmo membro 2x:** o `@@unique` impede, mas action captura `P2002` e retorna erro claro "Este membro já está neste ministério.".

### 6.3 Edge cases

- **Ministério sem membros:** mostra "Nenhum membro vinculado." + CTA "Adicionar primeiro membro".
- **Excluir último ministério:** ação destrutiva mas permitida. Toast de confirmação.
- **Editar nome para um que já existe:** erro "Já existe um ministério com este nome.".

---

## 7. RBAC

| Perfil | Pode criar | Pode editar | Pode excluir | Pode vincular membro |
|---|:-:|:-:|:-:|:-:|
| ADMIN | ✅ | ✅ | ✅ | ✅ |
| PASTOR | ✅ | ✅ | ✅ | ✅ |
| SECRETARIO | ✅ | ✅ | ✅ | ✅ |
| DISCIPULADOR | 👁 lê | ❌ | ❌ | ❌ |
| LIDER_MINISTERIO | 👁 lê | ❌ | ❌ | ❌ (no MVP) |
| FINANCEIRO | 👁 lê | ❌ | ❌ | ❌ |

**Decisão (registrar):** LIDER_MINISTERIO pode **vincular membros do seu ministério** no MVP? **Padrão conservador:** não. Vincular é tarefa do Secretário/Admin. Líder lê mas não escreve. Refinar em sprint 2+ quando model `LiderMinisterio` entrar.

---

## 8. Acessibilidade

- **`<h1>`** = "Ministérios".
- **`<h2>`** = nome do ministério (dentro de cada card).
- **Lista de membros** como `<ul>` com `<li>`.
- **Botão "Adicionar membro"** com `aria-label="Adicionar membro ao ministério {nome}"`.
- **Modal** com `role="dialog"`, foco preso, Esc fecha.
- **Confirmação de exclusão** lê "Excluir {nome}? Esta ação afeta N membros." (não usa `window.confirm`).

---

## 9. Mobile

- **Cards viram acordeão**: click no header expande, click de novo fecha. Em default, mostra apenas o header + contador.
- **Modal** full-screen.
- **Botões de ação** (editar, excluir) ficam em menu dropdown (3 pontos) para economizar espaço.

---

## 10. Critérios de aceite (testáveis)

### 10.1 Funcionais

- [ ] `GET /app/ministerios` retorna 200 e renderiza lista de ministérios.
- [ ] ADMIN clica "+ Novo ministério" → modal abre.
- [ ] Submit com nome duplicado: 422 com mensagem inline.
- [ ] Vincular membro já vinculado: 422 com erro.
- [ ] Excluir ministério com membros: bloqueado com mensagem clara.
- [ ] Excluir ministério vazio: 302 OK, card some.
- [ ] LIDER_MINISTERIO não vê botões de criar/editar/excluir.

### 10.2 Qualidade

- [ ] Cobertura ≥ 85%.
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] `pnpm typecheck` passa.
- [ ] Modal tem foco preso.
- [ ] Toast de sucesso/erro.
- [ ] Em mobile, acordeão funciona com toque e teclado.
