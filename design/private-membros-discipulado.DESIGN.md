# Vínculo de Discipulado — Design

## 1. Propósito

Tela dedicada a **gerenciar o vínculo de discipulado** de um membro. Permite:
- **Definir o discipulador** de um membro (escolher da lista de membros com `cargo = DISCIPULADOR` ou de qualquer membro).
- **Desvincular** o discipulador atual.
- **Visualizar a cadeia** (discipulador → discípulo → ... até profundidade razoável).
- **Ver os discípulos atuais** de um discipulador (quando o foco é o discipulador).

Acessível em `/app/membros/:id/discipulado`.

**Persona-alvo:** qualquer perfil autenticado. Mas o uso primário é do **Discipulador** (quer ver seus discípulos) e do **Secretário/Admin** (quer atribuir discípulos).

**Caso de uso primário (US-MEM-002 do PRD):** Discipulador associa um membro a si mesmo. Sistema bloqueia o 13º com mensagem clara.

**Casos secundários:**
- Reatribuir discípulo para outro discipulador (transferir).
- Ver contagem atual do discipulador ("8/12").
- Alertar visualmente quando está perto do limite (≥10/12).
- Visualizar cadeia: "Quem é meu discipulador?" / "Quem são meus discípulos?".

**Restrição crítica (RN-MEM-04):** 1 discipulador ≤ **12 discípulos**. Sistema **bloqueia** o 13º com mensagem clara. Além disso, **anti-loop** (A→B e B→A) e **auto-vínculo** (não posso ser meu próprio discipulador) são bloqueados.

---

## 2. Wireframe

### 2.1 Desktop (≥ 1024px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Topbar + Sidebar                                                       │
├────────────┬─────────────────────────────────────────────────────────────┤
│ Sidebar    │  Membros > Maria da Silva > Discipulado                     │
│            │                                                             │
│            │  ┌─ Situação atual ─────────────────────────────────────┐  │
│            │  │ Maria da Silva não possui discipulador vinculado.    │  │ ← estado vazio
│            │  │                                                       │  │
│            │  │ [Vincular a um discipulador ▼]                       │  │
│            │  └───────────────────────────────────────────────────────┘  │
│            │                                                             │
│            │  ┌─ Discipulador atual ─────────────────────────────────┐  │
│            │  │ 👤 João Silva                                         │  │ ← estado preenchido
│            │  │    8/12 discípulos                                    │  │ ← contador com cor
│            │  │    [Reatribuir] [Desvincular]                         │  │
│            │  └───────────────────────────────────────────────────────┘  │
│            │                                                             │
│            │  ┌─ Discípulos de João Silva (8) ────────────────────────┐  │
│            │  │ • Carlos Souza              [Desvincular]              │  │
│            │  │ • Ana Pereira               [Desvincular]              │  │
│            │  │ • ...                                                  │  │
│            │  └───────────────────────────────────────────────────────┘  │
│            │                                                             │
│            │  ┌─ Cadeia de discipulado ──────────────────────────────┐  │
│            │  │ Pr. Carlos → Disc. João Silva → Maria da Silva       │  │ ← breadcrumb vertical
│            │  └───────────────────────────────────────────────────────┘  │
└────────────┴─────────────────────────────────────────────────────────────┘
```

### 2.2 Modal de seleção de discipulador

```
┌──────────────────────────────────────────┐
│ Selecionar discipulador              [×] │
├──────────────────────────────────────────┤
│ 🔍 Buscar por nome...                    │
│                                          │
│ ⦿ João Silva                  8/12        │ ← radio, mostra contador
│   Pastor titular                          │
│                                          │
│ ○ Maria Santos                12/12 ⚠     │ ← bloqueado (RN-MEM-04)
│   Está no limite                         │
│                                          │
│ ○ Pedro Costa                  0/12       │
│   Discipulador                           │
│                                          │
│ ○ ...                                     │
│                                          │
│           [Cancelar]  [Vincular]          │
└──────────────────────────────────────────┘
```

---

## 3. Componentes

| Componente | Fonte | Props | Localização |
|---|---|---|---|
| `<ShellAutenticado>` | shared | — | (já existe) |
| `<DiscipuladoPainel>` | novo | `membro`, `discipuladorAtual`, `discipulosDoDiscipulador`, `cadeia` | `app/components/DiscipuladoPainel.tsx` |
| `<ContadorDiscipulos>` | novo | `atual`, `max=12` (cor varia com %) | `app/components/ContadorDiscipulos.tsx` |
| `<ModalSelecionarDiscipulador>` | novo | `open`, `onClose`, `onSelect`, `discipuladores: Membro[]`, `membroId` (excluir ele mesmo + descendentes) | `app/components/ModalSelecionarDiscipulador.tsx` |
| `<CadeiaDiscipulado>` | novo | `cadeia: Membro[]` (do mais alto para o mais baixo) | `app/components/CadeiaDiscipulado.tsx` |
| `<ListaDiscípulos>` | novo | `discipulos: Membro[]`, `onDesvincular` | `app/components/ListaDiscipulos.tsx` |
| `<Button>` | shared | — | (já existe) |
| `<Dialog>` | novo (wrapper de modal acessível) | `open`, `onClose`, `title`, `children` | `app/components/Dialog.tsx` (criar quando usado 3+ vezes — aqui é o 1º, mas com __<Dialog>__ como base) |

**Hierarquia:**
- `app/routes/app/membros.$id.discipulado.tsx`.
  - loader: `getDiscipuladoData(membroId, user)` retorna `{ membro, discipuladorAtual, discipulosDoDiscipulador, cadeia, discipuladoresDisponiveis }`.
  - action: `assignDisciple(discId, discipuladorId, user)` ou `unassignDisciple(discId, user)`.

---

## 4. Estados

| Estado | Quando | Render |
|---|---|---|
| **Sem discipulador (vazio)** | Membro nunca foi vinculado | Mensagem "Maria não possui discipulador." + botão "Vincular". |
| **Com discipulador (normal)** | Vinculado, contador < 10 | Painel do discipulador + lista dos discípulos. |
| **Com discipulador (próximo do limite, 10-11)** | 10 ou 11 discípulos | Contador em `text-amber-700` com badge "Atenção". |
| **Com discipulador (no limite, 12)** | 12 discípulos | Contador em `text-amber-800` com ícone ⚠. Discipulador **não pode receber mais** (RN-MEM-04). |
| **Modal aberto** | Click "Vincular" ou "Reatribuir" | Modal com lista filtrada. |
| **Modal — discipulador no limite (12/12)** | Lista inclui alguém com 12 | Item aparece com `disabled`, badge "Limite atingido", e `aria-disabled`. |
| **Modal — bloqueado por ser descendente (anti-loop)** | Tentaria criar loop A→B→A | Item **não aparece** na lista (filtro no service exclui). |
| **Modal — bloqueado por ser o próprio membro** | Tentaria auto-vínculo | Item **não aparece** na lista. |
| **Submit em andamento** | Click "Vincular" no modal | Modal fecha, ação submete, loading na rota. |
| **Sucesso** | Action OK | Toast "Vínculo criado." + reload (loader re-roda, atualiza contagem). |
| **Erro (trava 12 — improvável via UI, possível via API direta)** | Action retorna 422 | Toast de erro com mensagem clara. Mantém na página. |
| **DISCIPULADOR sem acesso ao membro** | DISCIPULADOR de outra célula acessa | 403. |

---

## 5. Interações

| Elemento | Evento | Comportamento |
|---|---|---|
| Botão "Vincular a um discipulador" | Click | Abre modal de seleção. |
| Botão "Reatribuir" | Click | Abre modal (mesmo componente, `mode="reatribuir"`). |
| Botão "Desvincular" | Click | Confirmação inline (`window.confirm`? Não — modal próprio ou inline confirm), action DELETE. |
| Item "Desvincular" da lista de discípulos | Click | Confirmação, action. |
| Input de busca no modal | `change` (debounce 300ms) | Filtra lista por nome. |
| Radio button do discipulador | `change` | Marca seleção. |
| Botão "Vincular" (no modal) | Click | Valida seleção, submete action POST. |
| Click fora do modal / Esc | — | Fecha modal sem submeter. |

**Navegação por teclado:**
- Tab: Vincular/Desvincular → lista discípulos → cada botão.
- No modal: Tab cicla dentro (foco preso). Esc fecha.

---

## 6. Validações e regras

### 6.1 Regras de negócio (RN-MEM-04)

1. **Auto-vínculo bloqueado:** `discipuladorId === discId` → 400.
2. **Trava de 12:** `count(Membro where discipuladorId = X) >= 12` → 422.
3. **Anti-loop:** `discId` é descendente de `discipuladorId` na cadeia → 422.
4. **Membro não existe:** 404.
5. **Membro não-admin tentando vincular** (apesar de RN-MEM-01 liberar): sem restrição.

### 6.2 Schema Zod (`app/lib/schemas/discipulado.ts`)

```ts
export const AssignDiscipleSchema = z.object({
  discipuladorId: z.string().uuid("ID de discipulador inválido."),
});
```

### 6.3 Edge cases

- **Membro excluído enquanto modal está aberto:** action retorna 404, modal fecha com toast de erro.
- **Discipulador excluído (Restrict):** impossível. RN-MEM-04 impede cascade. Se a UI tentar, action retorna erro de domínio.
- **Dois usuários vinculando simultaneamente:** condição de corrida. Service usa `$transaction` com `count` + `update` em sequência (não é atômico, mas é aceitável para 1 igreja; se for problema, adicionar `select for update` no SQLite — YAGNI por ora).
- **Cadeia muito profunda (>5 níveis):** visualização hierárquica, mas aceita qualquer profundidade (não há trava no schema).

---

## 7. RBAC

| Perfil | Pode vincular/desvincular | Escopo |
|---|:-:|---|
| ADMIN, PASTOR, SECRETARIO, FINANCEIRO | ✅ | Qualquer membro. |
| DISCIPULADOR | ✅ | Pode vincular qualquer membro a si mesmo, ou reatribuir seus discípulos. Não pode vincular a outros. |
| LIDER_MINISTERIO | ✅ | Qualquer (MVP), refinamento sprint 2+. |

**Decisão (a confirmar com orchestrator):** DISCIPULADOR pode vincular a si mesmo, ou reatribuir apenas entre seus discípulos? **Default sugerido:** pode vincular qualquer membro a si mesmo (caso comum: novo visitante entra na célula dele), e pode reatribuir seus discípulos para outros. Não pode atribuir discípulos para terceiros (não é sua responsabilidade pastoral). Confirmar na implementação.

---

## 8. Acessibilidade

- **Modal:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, foco preso (focus trap), Esc fecha.
- **Radio group:** `<fieldset>` com `<legend>` "Selecionar discipulador".
- **Lista de discípulos:** `<ul>` com `<li>`. Cada item é um card com nome e ações.
- **Contador** com `aria-label="8 de 12 discípulos — 4 vagas restantes"`.
- **Badge de atenção/limite** com `aria-label="Atenção: próximo do limite"` ou `"Limite atingido"`.
- **Cadeia de discipulado** como `<ol>` (sequência), não breadcrumb visual.

---

## 9. Mobile

- **Modal full-screen** em vez de central.
- **Contador** maior e mais visível.
- **Lista de discípulos** vira accordion expansível (default: 3 itens, "Ver todos" expande).
- **Botões de ação** full-width no painel.
- **Busca no modal** sempre visível (não colapsada).

---

## 10. Critérios de aceite (testáveis)

### 10.1 Funcionais (US-MEM-002 do PRD)

- [ ] Vincular 1º ao 12º discípulo a um discipulador: 302 OK.
- [ ] Tentar vincular o 13º: 422 com mensagem "Discipulador já possui 12 discípulos ativos. Reatribua antes de vincular mais.".
- [ ] Tentar auto-vínculo: 400 (ou 422) com mensagem "Você não pode ser seu próprio discipulador.".
- [ ] Tentar loop A→B e B→A: 422 com mensagem de loop.
- [ ] Desvincular: 302 OK, contador decrementa.
- [ ] Reatribuir: transfere sem precisar desvincular antes.

### 10.2 UX

- [ ] Modal abre com foco no input de busca.
- [ ] Esc fecha o modal.
- [ ] Click fora do modal fecha.
- [ ] Contador muda de cor: `slate-700` (< 10), `amber-700` (10-11), `amber-800` (12).
- [ ] Lista de discípulos carrega em < 200ms.
- [ ] Cadeia de discipulado renderiza corretamente para profundidade 1, 2, 3, 4.

### 10.3 Qualidade

- [ ] Cobertura ≥ 85% (loader + service + componentes).
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] `pnpm typecheck` passa.
- [ ] Modal tem foco preso (testar com Tab repetido).
- [ ] Toast de sucesso/erro funcional.
