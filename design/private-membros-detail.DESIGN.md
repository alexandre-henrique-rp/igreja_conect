# Detalhe do Membro — Design

## 1. Propósito

Tela de **ficha completa** de um único membro. Mostra todos os dados cadastrais, o vínculo de discipulado, os ministérios que participa, e — **condicionalmente** — a aba "Fidelidade Financeira". Acessível em `/app/membros/:id`.

**Persona-alvo:** qualquer perfil autenticado. Esta é a tela mais acessada do sistema (toda ação termina aqui ou começa daqui).

**Caso de uso primário:** Pastor ou Secretário clica no nome de um membro na lista e quer ver / editar / consultar.

**Casos secundários:**
- Vincular/desvincular discípulo (botão "Gerenciar discipulado").
- Vincular/desvincular ministérios (botão "Gerenciar ministérios").
- Editar dados (botão "Editar").
- Excluir membro (botão "Excluir" — visível só para ADMIN/PASTOR).
- Marcar visita (futuro, fora do MVP).
- Ver aba Fidelidade Financeira (apenas ADMIN/PASTOR/FINANCEIRO).
- Transicionar tipo (VISITANTE → CONGREGADO → MEMBRO_ATIVO) manualmente.

**Restrição crítica (RN-MEM-03):** a aba "Fidelidade Financeira" **NÃO é renderizada** para `SECRETARIO`, `DISCIPULADOR`, `LIDER_MINISTERIO`. Defesa em 3 camadas: UI esconde, loader barra com 403 se URL direta, service lança `ForbiddenError`.

---

## 2. Wireframe

### 2.1 Desktop (≥ 1024px) — com aba Fidelidade visível (ADMIN/PASTOR/FINANCEIRO)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Topbar + Sidebar                                                       │
├────────────┬─────────────────────────────────────────────────────────────┤
│ Sidebar    │ Membros > Maria da Silva              [Editar] [Excluir]   │ ← breadcrumb + ações
│            │                                                             │
│            │ ┌─────────────────────────────┬────────────────────────┐  │
│            │ │ Maria da Silva               │ 📊 KPIs                │  │
│            │ │ VISITANTE • cadastrada há 2d  │ Membro há: 2 dias     │  │
│            │ │ maria.silva@email.com        │ Tipo: VISITANTE        │  │
│            │ │ (11) 98765-4321              │ Discipulador: —        │  │
│            │ │                              │ Ministérios: 1         │  │
│            │ │ Rua das Flores, 123          │                        │  │
│            │ │ Centro - São Paulo/SP        │                        │  │
│            │ │ CEP 01000-000                │                        │  │
│            │ └─────────────────────────────┴────────────────────────┘  │
│            │                                                             │
│            │ ┌─ Abas ───────────────────────────────────────────────┐  │
│            │ │ [Dados] [Discipulado] [Ministérios] [Fidelidade]    │  │ ← abas
│            │ ├──────────────────────────────────────────────────────┤  │
│            │ │                                                      │  │
│            │ │  [Conteúdo da aba ativa — Dados Pessoais aqui]      │  │
│            │ │                                                      │  │
│            │ │  Data de conversão: 01/03/2024                       │  │
│            │ │  Data de batismo: 15/06/2024                         │  │
│            │ │  Profissão: Professora (opcional)                    │  │
│            │ │  Estado civil: Casada (opcional)                     │  │
│            │ │                                                      │  │
│            │ │  ────────────────────────────────────────────────    │  │
│            │ │                                                      │  │
│            │ │  Tipo: VISITANTE  [Promover → CONGREGADO]            │  │ ← transição manual
│            │ │                                                      │  │
│            │ └──────────────────────────────────────────────────────┘  │
└────────────┴─────────────────────────────────────────────────────────────┘
```

### 2.2 Mesma tela, mas para perfis SEM permissão financeira (SECRETARIO, DISCIPULADOR, LIDER_MINISTERIO)

A única diferença: **a aba "Fidelidade" não aparece.** As outras 3 abas continuam.

```
│ ┌─ Abas ───────────────────────────────────────────────┐
│ │ [Dados] [Discipulado] [Ministérios]                  │  ← SEM [Fidelidade]
│ ├──────────────────────────────────────────────────────┤
```

### 2.3 Mobile

```
┌──────────────────────────────┐
│ ‹ Membros                    │ ← back link
├──────────────────────────────┤
│ Maria da Silva               │ ← h1
│ VISITANTE                    │ ← badge tipo
│ maria.silva@email.com        │
│ (11) 98765-4321              │
│                              │
│ Rua das Flores, 123          │
│ Centro - São Paulo/SP        │
│ CEP 01000-000                │
│                              │
│ [Editar] [Excluir]           │
│                              │
│ ──── Abas (tabs scrollable) ──│
│ [Dados][Discip.][Min.][Fid.]│
│                              │
│ Data conversão: 01/03/2024  │
│ ...                          │
│                              │
│ [Promover → CONGREGADO]      │
└──────────────────────────────┘
```

---

## 3. Componentes

| Componente | Fonte | Props | Localização |
|---|---|---|---|
| `<ShellAutenticado>` | shared | `user` | `app/components/ShellAutenticado.tsx` |
| `<Breadcrumb>` | shared | `items: { label, href? }[]` | `app/components/Breadcrumb.tsx` |
| `<AcoesMembro>` | novo | `membro`, `user` (para canEdit, canDelete) | `app/components/AcoesMembro.tsx` |
| `<ResumoMembro>` | novo | `membro` (nome, tipo, contato, endereço, KPIs) | `app/components/ResumoMembro.tsx` |
| `<TabsMembro>` | novo | `activeTab: "dados" \| "discipulado" \| "ministerios" \| "fidelidade"`, `canSeeFinancials: boolean`, `membroId` | `app/components/TabsMembro.tsx` |
| `<TabDadosPessoais>` | novo | `membro`, `onPromover: (novoTipo) => void` | `app/components/TabDadosPessoais.tsx` |
| `<TabDiscipulado>` | novo | `membro`, `discipulador: Membro \| null`, `discipulos: Membro[]`, `canEdit` | `app/components/TabDiscipulado.tsx` |
| `<TabMinisterios>` | novo | `membro`, `ministerios: Ministerio[]`, `canEdit` | `app/components/TabMinisterios.tsx` |
| `<TabFidelidadeFinanceira>` | novo | `membroId`, `placeholder: boolean` (no MVP, sempre true) | `app/components/TabFidelidadeFinanceira.tsx` |
| `<Can>` | shared | `user`, `allow` | `app/components/Can.tsx` |
| `<EmptyState>` | shared | `title`, `description`, `action?` | `app/components/EmptyState.tsx` |

**Hierarquia:**
- `app/routes/app/membros.$id.tsx`.
  - loader: chama `getMembroById(id, user)` (filtra por escopo RBAC). Retorna `{ membro, discipulador, discipulos, ministerios, canSeeFinancials }`.
  - **Camada 2 RBAC:** se perfil não tem acesso ao membro (ex: DISCIPULADOR tentando ver membro de outra célula), lança 403.
  - URL: `?tab=dados|discipulado|ministerios|fidelidade` (default = "dados").

---

## 4. Estados

| Estado | Quando | Render |
|---|---|---|
| **Initial (dados)** | Default | Resumo + aba Dados ativa. |
| **Initial (discipulado)** | `?tab=discipulado` | Resumo + aba Discipulado ativa com discipulador e discípulos. |
| **Initial (ministérios)** | `?tab=ministerios` | Resumo + aba Ministérios ativa. |
| **Initial (fidelidade)** | `?tab=fidelidade` E `canSeeFinancials === true` | Resumo + aba Fidelidade ativa (placeholder no MVP). |
| **Bypass via URL `?tab=fidelidade` SEM permissão** | DISCIPULADOR/SECRETARIO/LIDER_MINISTERIO acessa `?tab=fidelidade` | Loader checa, vê que não tem permissão → 403 (ou redirect com mensagem). **Decisão:** 403 com ErrorBoundary explicando. |
| **Membro não encontrado** | ID inválido | 404 com ErrorBoundary "Membro não encontrado". |
| **Membro existe, mas sem permissão de leitura** | DISCIPULADOR de outra célula | 403 com ErrorBoundary. |
| **Loading** | Loader em andamento | Skeleton do resumo + tabs. |
| **Ação de promoção em andamento** | "Promover" clicado | Botão vira loading; toast de sucesso ao terminar. |
| **Ação de exclusão confirmada** | Modal "Excluir?" → Confirmar | Redirect para `/app/membros` + toast. |
| **Ação de desvincular em andamento** | "Desvincular discípulo" clicado | Recarrega dados, toast. |

**Detalhe sobre o bypass:** a URL `?tab=fidelidade` é interceptada no **loader** (camada 2). Se `canSeeFinancials === false` e `tab === "fidelidade"`, o loader **força** `tab = "dados"` e não retorna nada financeiro. **Não** deixa a aba "Fidelidade" renderizar mesmo com URL direta. Esta é a defesa em 3 camadas.

---

## 5. Interações

| Elemento | Evento | Comportamento |
|---|---|---|
| Breadcrumb "Membros" | Click | Volta para `/app/membros` (preserva filtros? Não — simplicidade). |
| Botão "Editar" | Click | Navega para `/app/membros/:id/editar`. |
| Botão "Excluir" | Click | Abre `<Dialog>` de confirmação. Se confirmar, action DELETE, redirect `/app/membros` + toast. |
| Aba "Dados" | Click | Atualiza URL `?tab=dados` (RR7 navigation). |
| Aba "Discipulado" | Click | Atualiza URL `?tab=discipulado`. |
| Aba "Ministérios" | Click | Atualiza URL `?tab=ministerios`. |
| Aba "Fidelidade" | Click | Atualiza URL `?tab=fidelidade` (só renderiza se tem permissão). |
| Botão "Gerenciar discipulado" (na aba) | Click | Navega para `/app/membros/:id/discipulado`. |
| Botão "Gerenciar ministérios" (na aba) | Click | Abre modal/sheet com checkboxes de ministérios + botão Salvar. |
| Botão "Promover → CONGREGADO" | Click | Action PATCH `/app/membros/:id/tipo`. Toast de sucesso. |
| Botão "Vincular a mim" (se DISCIPULADOR vendo discípulo) | Click | Action POST `/app/membros/:id/discipulador` com `discipuladorId = user.id`. |
| Botão "Desvincular" (discipulador ou min.) | Click | Confirmação inline, action DELETE. |

**Navegação por teclado:**
- Tab: ações topo → abas → conteúdo da aba → ações da aba.
- Setas ←/→ em tabs para trocar de aba (UX avançada, opcional no MVP).
- Esc no modal de exclusão = fecha sem excluir.

---

## 6. Validações e regras

### 6.1 Regras de negócio

- **RN-MEM-01:** qualquer perfil autenticado pode ler. Service `getMembroById` aplica escopo (DISCIPULADOR só vê seus).
- **RN-MEM-03:** aba Fidelidade só para ADMIN/PASTOR/FINANCEIRO. Service `getDizimosByMembro` chama `assertCanSeeFinancials` (camada 3).
- **RN-MEM-04:** desabilitar "Vincular discípulo" se discipulador já tem 12 (UI disabled, mas o action revalida).
- **RN-MEM-06:** transição de tipo **manual**, sem job. Loader inclui `count(Membro where tipo != MEMBRO_ATIVO)` para mostrar o tipo atual.

### 6.2 Edge cases

- **Membro excluído enquanto a página carrega:** loader retorna 404, ErrorBoundary.
- **Discipulador excluído (Restrict):** não pode excluir (RN-MEM-04) — message "Este membro é discipulador de N discípulos. Reatribua antes de excluir." Botão "Excluir" fica disabled com tooltip explicativo.
- **URL com `tab` inválido (ex: `?tab=foo`):** loader normaliza para `dados`.

---

## 7. RBAC

| Perfil | Pode ver | Pode editar | Pode excluir | Vê Fidelidade |
|---|:-:|:-:|:-:|:-:|
| ADMIN | ✅ | ✅ | ✅ | ✅ |
| PASTOR | ✅ | ✅ | ✅ | ✅ |
| SECRETARIO | ✅ | ✅ | ❌ | ❌ |
| DISCIPULADOR | ✅ (escopo: seus discípulos) | ✅ (escopo) | ❌ | ❌ |
| LIDER_MINISTERIO | ✅ (escopo MVP: todos) | ✅ (escopo) | ❌ | ❌ |
| FINANCEIRO | ✅ | ✅ | ❌ | ✅ |

**Defesa em profundidade:**
- **UI:** botões escondidos via `<Can>`. Abas condicionalmente renderizadas.
- **Loader:** `getMembroById(id, user)` checa escopo; se não bate, throw 403.
- **Action:** `updateMembro`, `deleteMembro`, `assignDisciple` revalidam perfil + escopo.

---

## 8. Acessibilidade

- **`<h1>`** = nome do membro.
- **Breadcrumb** com `aria-label="Trilha de navegação"`.
- **Tabs** implementadas com `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`. Setas ←/→ para trocar de aba.
- **Modal de exclusão** com `role="dialog"`, `aria-modal="true"`, `aria-labelledby` apontando para o título, foco preso dentro (focus trap).
- **Toast** com `role="status"` (info) ou `role="alert"` (erro).
- **Hierarquia:** `<h1>` (nome) → `<h2>` (Resumo, Abas) → `<h3>` (KPIs, seções da aba ativa).
- **Contraste** AA+ em tudo.

---

## 9. Mobile

- **Tabs** viram `<Tabs>` scrolláveis horizontalmente (overflow-x-auto) com indicador de aba ativa.
- **Resumo** colapsa: nome + tipo + botão de ações no topo; detalhes em "Ver mais".
- **Ações** no topo viram menu dropdown (3 pontos) para economizar espaço.
- **Modal de exclusão** é full-screen sheet em vez de modal central.

---

## 10. Critérios de aceite (testáveis)

### 10.1 Funcionais

- [ ] `GET /app/membros/:id` (com ID válido) retorna 200 e renderiza resumo + abas.
- [ ] `GET /app/membros/:id` (com ID inválido) retorna 404.
- [ ] `?tab=discipulado` carrega direto na aba Discipulado.
- [ ] `?tab=fidelidade` para DISCIPULADOR: **NÃO renderiza** a aba, e loader não retorna nada financeiro.
- [ ] Botão "Editar" navega para `/app/membros/:id/editar`.
- [ ] Botão "Excluir" (ADMIN) abre modal; confirmar chama action DELETE e redireciona.
- [ ] Botão "Excluir" (SECRETARIO) **NÃO aparece** na UI; chamada direta via action retorna 403.
- [ ] Transição de tipo (VISITANTE → CONGREGADO) atualiza o badge e o tipo sem reload completo (RR7 revalidação).
- [ ] DISCIPULADOR acessando membro de outra célula recebe 403.

### 10.2 Segurança (RN-MEM-03)

- [ ] HTML de SECRETARIO logado **não contém** string "Fidelidade", "dízimo", "Lancamento", "valorCentavos" em payload SSR.
- [ ] `?tab=fidelidade` direta para SECRETARIO → 403, não renderiza.
- [ ] Service `getDizimosByMembro` chamado por SECRETARIO lança `ForbiddenError`.

### 10.3 Qualidade

- [ ] Lighthouse Accessibility ≥ 95.
- [ ] Cobertura ≥ 85%.
- [ ] `pnpm typecheck` passa.
- [ ] Payload SSR nunca inclui `senhaHash`.
- [ ] Modal de exclusão tem foco preso + Esc para fechar.
- [ ] Tab navigation cobre todas as ações.
