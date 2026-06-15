# Igreja Conect — PRODUCT.md

> **Documento macro de produto (design).** Visão geral do que o sistema é, como se navega, como o RBAC aparece na UI, quais padrões de formulário/listagem/feedback usamos, e quais decisões de design estão consolidadas.
>
> **Público-alvo:** devs frontend, designers de produto, novos agentes do Harness, e Product Managers da igreja.
>
> **Data:** 2026-06-14 • **Versão:** 0.3 (MVP ciclo 1 + Módulo Financeiro ciclo 2) • **Mantido por:** `designer` agent (Fase 3 do Harness v6).
>
> **Fontes canônicas:**
> - [`PRD.html`](./PRD.html) — requisitos (inclui Apêndice D — Módulo Financeiro)
> - [`SPEC.html`](./SPEC.html) — contratos técnicos (inclui Apêndice D — Módulo Financeiro)
> - [`brief.md`](./brief.md) — brief do ciclo 2 (Módulo Financeiro)
> - [`agents/AGENTS.md`](./agents/AGENTS.md) — stack e convenções (seção "Módulo Financeiro (ciclo 2)")
> - [`docs/architecture/ARCH.md`](./docs/architecture/ARCH.md) §8 — arquitetura do Módulo Financeiro
> - [`.harness/RAG/`](./.harness/RAG/) — 14 RAGs (10 do ciclo 1 + 4 do ciclo 2)
> - Pacote de designs ciclo 1: [`design/*.DESIGN.md`](./design/) (10 páginas)
> - Pacote de designs ciclo 2: [`design/private-financeiro*.DESIGN.md`](./design/) (6 páginas)
>
> **Mudanças desta versão (0.3, 2026-06-14):**
> - Adicionada §9 "Módulo Financeiro (ciclo 2)" com 8 features, 6 personas, métrica macro, fora do escopo, cross-refs.
> - Adicionado índice de 6 novos pares DESIGN+PROMPT em `design/private-financeiro*.{DESIGN,PROMPT}.md`.
> - Atualizado roadmap (§10) com S06-S08 (Caixa, Transferência, Fidelidade).
> - Matriz RBAC (§3.1) estendida com permissões específicas do Módulo Financeiro.

---

## 1. Princípios de UX/UI

### 1.1 Linguagem visual

- **Clean, sem ruído, foco em legibilidade.** Igreja é espaço sóbrio — sistema também. Sem gradientes chamativos, sombras pesadas, animações decorativas.
- **Inspiração de produto:** ferramentas administrativas internas (Linear, Notion, ERPs médicos). Densidade de informação média-alta, mas com respiro.
- **Tom da copy:** PT-BR, segunda pessoa do singular ou tratamento respeitoso (Senhor/Senhora Pastor(a)). Nunca gíria, nunca emoji em mensagens formais. Emoji só em empty states amigáveis (ex: "Nenhum membro por aqui ainda 🎈" — *opcional*).
- **Fé sem proselitismo técnico:** o sistema serve a operação, não faz marketing da igreja. Sem versículos na UI, sem "Deus abençoe este deploy".

### 1.2 Sistema de design

- **Tailwind 4 utility-first.** Sem `@apply` em CSS novo. Tokens via `@theme`.
- **Paleta:**
  - **Primária:** `cyan-700` (`#0e7490`) — sóbria. Botões primários, links, ícones de status.
  - **Neutros:** `slate-50` a `slate-900` (background, texto, bordas).
  - **Semântica:**
    - `green-700` (`#047857`) — sucesso, validado.
    - `amber-700` (`#b45309`) — atenção, regra de negócio próxima do limite.
    - `red-700` (`#b91c1c`) — erro, bloqueio.
  - **Modo escuro:** fora do MVP (registrar como item de roadmap).
- **Tipografia:** stack do sistema (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial`). Sem Google Fonts (LGPD). Tamanhos: `text-sm` (formulários), `text-base` (corpo), `text-lg` (subtítulos), `text-xl` (títulos de seção), `text-2xl` (h1).
- **Espaçamento:** grid de 4px. Escala: `0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16` (rem). Containers com `max-w-6xl` e `px-4 sm:px-6`.
- **Componentes base (sem dependência externa de lib):**
  - `<Button variant="primary|secondary|ghost|danger" size="sm|md" />`
  - `<Input label="" hint="" error="" leadingIcon="" />`
  - `<Select options={[]} />`
  - `<Card />` (container neutro com `border` + `rounded-lg` + `p-4`)
  - `<Badge tone="neutral|success|warning|danger" />`
  - `<EmptyState title="" description="" action={} />`
  - `<Spinner />`, `<Skeleton rows={3} />`
  - `<Toast />` (sistema interno)
  - **Específicos do Financeiro (ciclo 2):** `<CardSaldoCaixa />`, `<ExtratoCaixa />`, `<FormLancamento />`, `<FormTransferencia />`, `<FormCaixa />`.
  - **Justificativa do "sem lib de UI":** evita dependency drift, mantém bundle pequeno, força clareza. Quando a 3ª tela precisar de `<Dialog>`, aí sim avaliar lib focada.

### 1.3 Acessibilidade (LGPD art. 6° + WCAG 2.1 AA)

- **Contraste mínimo AA** (4.5:1 texto normal, 3:1 texto grande). Auditar com Lighthouse no PR.
- **Foco visível** em todo elemento interativo (`focus-visible:ring-2 ring-cyan-700 ring-offset-2`).
- **Navegação por teclado completa** (Tab/Shift+Tab/Enter/Esc). Ordem segue ordem visual.
- **Labels associados** via `<label htmlFor>`. `aria-describedby` para hint e erro.
- **`aria-invalid`** em campos com erro. **`aria-live="polite"`** em toasts.
- **Ícones decorativos** com `aria-hidden="true"`. Ícones com significado precisam de `aria-label`.
- **Hierarquia de headings** correta (`h1` por página, `h2` por seção).
- **Tabelas** com `<caption>`, `<th scope="col">`, e cabeçalhos de linha quando apropriado.
- **Sem dependência de cor apenas** para feedback.

### 1.4 Responsividade (mobile-first)

- **Breakpoints Tailwind:** `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px).
- **Layout principal autenticado:** sidebar em `lg+`, topbar com hamburger em `sm/md`.
- **Tabelas:** em mobile viram **cards** (não scroll horizontal).
- **Formulários:** full-width em mobile, `max-w-md` em tablet, `max-w-2xl` em desktop.
- **Targets de toque:** mínimo 44×44px (Apple HIG).

### 1.5 Internacionalização

- **PT-BR único.** Sem `i18n`, sem `react-intl`. Copy hardcoded em português.
- **Datas e números** com `Intl.DateTimeFormat("pt-BR")` e `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`.
- **URLs em PT-BR sem acentos:** `/app/financeiro`, `/app/financeiro/caixas/:id`, `/app/financeiro/transferencias/nova`.

---

## 2. Estrutura de navegação global

### 2.1 Diagrama de rotas (ciclo 1 + ciclo 2)

```mermaid
graph TB
  subgraph PUBLIC["Públicas (sem auth)"]
    LANDING["/ (Landing)"]
    LOGIN["/login"]
  end

  subgraph PRIVATE["Privadas (/app/**)"]
    DASH["/app (Dashboard)"]
    MEMBROS["/app/membros (Lista)"]
    MEMBRO_NOVO["/app/membros/novo"]
    MEMBRO_DET["/app/membros/:id"]
    MEMBRO_EDIT["/app/membros/:id/editar"]
    MEMBRO_DIS["/app/membros/:id/discipulado"]
    MINISTERIOS["/app/ministerios"]
    ALERTAS["/app/alertas"]
    CONFIG_ACO["/app/config/acolhimento"]
    subgraph FIN["Módulo Financeiro (ciclo 2)"]
      FIN_IDX["/app/financeiro (Dashboard de saldos)"]
      FIN_CXS["/app/financeiro/caixas (Lista)"]
      FIN_CX_NOVO["/app/financeiro/caixas/novo"]
      FIN_CX_DET["/app/financeiro/caixas/:id (Extrato)"]
      FIN_LAN_NOVO["/app/financeiro/lancamentos/novo"]
      FIN_TR["/app/financeiro/transferencias (Lista)"]
      FIN_TR_NOVO["/app/financeiro/transferencias/nova"]
    end
  end

  LOGOUT["/logout (POST)"]

  PUBLIC -.redireciona.-> DASH
  DASH --> MEMBROS
  DASH --> MINISTERIOS
  DASH --> ALERTAS
  DASH --> CONFIG_ACO
  DASH --> FIN_IDX
  FIN_IDX --> FIN_CXS
  FIN_IDX --> FIN_LAN_NOVO
  FIN_IDX --> FIN_TR_NOVO
  FIN_CXS --> FIN_CX_NOVO
  FIN_CXS --> FIN_CX_DET
  FIN_CX_DET --> FIN_LAN_NOVO
  FIN_LAN_NOVO -.volta.-> FIN_CX_DET
  FIN_TR --> FIN_TR_NOVO
  MEMBRO_DET -.tab=fidelidade.->|"ADMIN/PASTOR/FINANCEIRO"| TAB_FID["Tab Fidelidade Financeira (RN-MEM-03)"]
```

**Convenção:** rotas privadas em `app/routes/app/**`, públicas em `app/routes/public/**`. Módulo Financeiro em `app/routes/app/financeiro/**`. **NÃO** em `app/routes/private/` (vazio, artefato antigo).

### 2.2 Layout do shell autenticado (continua ciclo 1)

Sidebar fixa em `lg+` (240px), drawer em `sm/md`. Topbar 100% width. **Item novo na sidebar (ciclo 2):** "Financeiro" (ícone de cifrão), exibido apenas para perfis com `canSeeFinancials` (ADMIN, PASTOR, FINANCEIRO, SECRETARIO — não DISCIPULADOR/LIDER_MINISTERIO).

### 2.3 Padrão de breadcrumb

- `Financeiro > Caixas > Caixa Geral > Lançamentos`
- `Financeiro > Caixas > Novo caixa`
- `Financeiro > Transferências > Nova transferência`
- `Membros > João da Silva > Fidelidade Financeira`

---

## 3. RBAC e visibilidade na UI

### 3.1 Matriz perfil × visibilidade de UI (ciclo 1 + ciclo 2)

| Tela / Componente | ADMIN | PASTOR | SECRETARIO | DISCIPULADOR | LIDER_MIN. | FINANCEIRO |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| **Sidebar — Dashboard, Membros, Ministérios, Alertas, Config** | 👁 | 👁 | 👁 | 👁 | 👁 | 👁 |
| **Sidebar — Financeiro** (ciclo 2) | 👁 | 👁 | 👁 | 🚫 | 🚫 | 👁 |
| **Membros — Fidelidade Financeira** (RN-MEM-03) | 👁 | 👁 | 🚫 | 🚫 | 🚫 | 👁 |
| **/app/financeiro (dashboard de saldos)** | 👁 | 👁 | 👁 | 🚫 | 🚫 | 👁 |
| **Botão "Criar caixa"** | ✅ | ✅ | 🚫 | 🚫 | 🚫 | ✅ |
| **Botão "Arquivar/Reabrir caixa"** | ✅ | ✅ | 🚫 | 🚫 | 🚫 | ✅ |
| **Botão "Novo lançamento"** | ✅ | ✅ | ✅ | 🚫 | 🚫 | ✅ |
| **Botão "Nova transferência"** | ✅ | ✅ | ✅ | 🚫 | 🚫 | ✅ |
| **Botão "Lançar dízimo"** (com membro) | ✅ | ✅ | ✅ | 🚫 | 🚫 | ✅ |
| **Botão "Lançar oferta"** (anônima) | ✅ | ✅ | ✅ | 🚫 | 🚫 | ✅ |
| **Botão "Lançar despesa/saída"** | ✅ | ✅ | ✅ | 🚫 | 🚫 | ✅ |
| **Ver extrato de caixa alheio** | ✅ | ✅ | ✅ | 🚫 | 🚫 | ✅ |

> 👁 = visível (read-only) • ✅ = ação permitida • 🚫 = oculta completamente (defesa em profundidade).

### 3.2 Componente `<Can>` (camada 1)

```tsx
type Cargo = "ADMIN" | "PASTOR" | "SECRETARIO" | "DISCIPULADOR" | "FINANCEIRO" | "LIDER_MINISTERIO";

export function Can({ user, allow, children, fallback = null }: CanProps) {
  if (!user.cargo || !allow.includes(user.cargo)) return <>{fallback}</>;
  return <>{children}</>;
}
```

**Uso (ciclo 2):**

```tsx
<Can user={user} allow={["ADMIN", "PASTOR", "FINANCEIRO", "SECRETARIO"]}>
  <CardSaldoCaixa caixa={caixa} onClickNovaSaida={...} />
</Can>

<Can user={user} allow={["ADMIN", "PASTOR", "FINANCEIRO"]}>
  <BotaoCriarCaixa />
</Can>
```

### 3.3 Helpers `rbac.server.ts` (camada 3)

Helpers canônicos:
- `assertCanSeeFinancials(user)` — lança `Response(403)` se user não tem perfil financeiro (RN-MEM-03 / matriz do módulo).
- `assertCanManageCaixa(user)` — lança `Response(403)` se user não tem permissão de criar/arquivar caixa (ADMIN, PASTOR, FINANCEIRO). **NOVO ciclo 2.**
- `assertCanWriteMembers(user)` — já existe (ciclo 1).

> **Princípio:** UI **esconde** controles (UX), mas o **bloqueio real** está no loader/action/service. Camada 3 é a única segurança mandatória.

---

## 4. Padrões de formulário

### 4.1 Stack: Zod + react-hook-form (mantido do ciclo 1)

Schemas em `app/lib/schemas/<domínio>.ts` (1 arquivo por domínio). Exporta `Schema` (Zod) + `Input` (tipo inferido). Formulários com `react-hook-form` + `zodResolver`. `useFetcher().submit` raw só com revalidação server-side.

**Específico do Financeiro (ciclo 2):**
- `app/lib/schemas/caixas.ts` — `CaixaCreateSchema`, `CaixaUpdateSchema`.
- `app/lib/schemas/lancamentos.ts` — `LancamentoCreateSchema` (com `superRefine` para RN-FIN-05: DIZIMO exige membroId, OFERTA aceita null, outros null).
- `app/lib/schemas/transferencias.ts` — `TransferenciaCreateSchema` (com `superRefine` origem≠destino).

### 4.2 Mensagens de erro (PT-BR, claras) — adições do ciclo 2

| Validação | Mensagem |
|---|---|
| Nome de caixa curto | "Nome do caixa deve ter ao menos 2 caracteres." |
| Nome de caixa duplicado | "Já existe um caixa com este nome." |
| Valor não numérico | "Informe um valor em reais (ex: 50,00)." |
| Valor ≤ 0 | "Valor deve ser maior que zero." |
| Origem = destino (transferência) | "Origem e destino devem ser caixas diferentes." |
| Saldo insuficiente | "Saldo insuficiente no caixa de origem. Disponível: R$ X,XX." |
| Caixa arquivado | "Caixa \"X\" está arquivado e não aceita movimentações." |
| Dízimo sem membro | "Dízimo exige vínculo com membro." |
| Categoria não aceita membro | "Categoria X não aceita vínculo com membro." |
| Membro não encontrado | "Membro não encontrado." |
| Caixa não encontrado | "Caixa não encontrado." |
| Sem permissão | "Você não tem permissão para esta operação." |

### 4.3 Confirmação de ações destrutivas

- **Arquivar caixa** (soft-delete): modal inline de confirmação.
- **Reabrir caixa**: sem confirmação (reversível, sem perda de dados).
- **Excluir caixa**: **não implementado** no ciclo 2 (RN-FIN-01: integridade histórica; `onDelete: Restrict` no schema). Caixas são **arquivados**, não deletados.

### 4.4 Loading states (mantido)

Submit vira `<Spinner />` + "Salvando...". Desabilita para evitar double-submit. Topbar mostra barra fina de progresso (1px cyan). Skeleton em listagens.

---

## 5. Padrões de listagem (mantido + extensões do ciclo 2)

### 5.1 Filtros em URL state (mantido)

Filtros em **search params**, não em estado React. Compartilhável, refresh-safe, back/forward funciona.

**Específico do Financeiro:**
- `/app/financeiro/caixas?apenasAtivos=true` — toggle "Mostrar arquivados".
- `/app/financeiro/caixas/:id?periodo=2026-06&categoria=DIZIMO` — filtros do extrato.
- `/app/financeiro/transferencias?periodo=2026-06&caixaOrigemId=<uuid>`.

### 5.2 Paginação (mantido)

25 itens/página. URL `?page=2`. Reset ao mudar filtro.

### 5.3 Empty state / loading / error (padrão consistente)

**Adaptações do ciclo 2:**
- **Empty state — sem caixas** (sistema novo): "Nenhum caixa cadastrado. O Caixa Geral foi criado automaticamente. Crie caixas temáticos (Cantina, Missões) para organizar as finanças." + CTA "Criar caixa" (só para perfis com `assertCanManageCaixa`).
- **Empty state — sem lançamentos no extrato**: "Nenhuma movimentação neste caixa ainda. Lançar dízimo, oferta ou despesa." + CTA "Novo lançamento".
- **Empty state — sem transferências**: "Nenhuma transferência registrada. Movimente valores entre caixas para organizar as finanças." + CTA "Nova transferência".
- **Empty state — sem dízimos (aba Fidelidade)**: "Este membro ainda não tem dízimos registrados. Lançamento é feito pelo Financeiro em /app/financeiro/lancamentos/novo." (sem CTA inline, pois o lançamento não é feito a partir da aba do membro).

---

## 6. Padrões de feedback (mantido + ciclo 2)

### 6.1 Toasts (mantido)

Sistema próprio. `toast({ tone, title, description })`. Posição canto inferior direito, `aria-live="polite"`, auto-dismiss 5s (exceto `error`).

**Mensagens-padrão do ciclo 2:**
- **Sucesso — dízimo:** "Dízimo de Maria registrado. Saldo do Caixa Geral atualizado."
- **Sucesso — oferta:** "Oferta registrada no Caixa Cantina."
- **Sucesso — despesa:** "Saída de R$ 100,00 registrada no Caixa Geral."
- **Sucesso — transferência:** "Transferência de R$ 100,00 do Caixa Geral para Caixa Cantina registrada."
- **Sucesso — caixa criado:** "Caixa Cantina criado com sucesso."
- **Sucesso — caixa arquivado:** "Caixa Cantina arquivado. Movimentações bloqueadas; histórico preservado."
- **Sucesso — caixa reaberto:** "Caixa Cantina reaberto. Movimentações liberadas."
- **Erro — saldo:** "Saldo insuficiente no caixa de origem. Disponível: R$ X,XX."
- **Erro — dízimo sem membro:** "Dízimo exige vínculo com membro."
- **Erro — caixa arquivado:** "Caixa arquivado não aceita movimentações."

### 6.2 Confirmação visual (mantido)

Submit OK → toast + redirect. Submit com erro de validação → form mantém, erros inline. Erro de regra → toast + mantém. Erro 500 → toast + retry.

---

## 7. Decisões de design (ciclo 1 mantidas + ciclo 2 novas)

### 7.1 a 7.8 — Decisões do ciclo 1 (mantidas, ver [`design/PRODUCT.md` §7](./design/PRODUCT.md) para detalhes)

7.1 Zod • 7.2 TTL 7d sliding / 30d abs • 7.3 Senha ≥ 8 chars • 7.4 Aba Fidelidade não renderiza para perfis bloqueados • 7.5 Rate limit 5/15min/IP • 7.6 Model Session • 7.7 Duplicata prisma.config • 7.8 Resource route /api/auth/login.

### 7.9 — Decisão de modelagem do ciclo 2: `Caixa.ativo: Boolean @default(true)` (APROVADA 2026-06-14)

- **Decisão:** adicionar campo `ativo: Boolean @default(true)` ao model `Caixa` + `@@index([ativo])` para soft-delete (arquivamento).
- **Status:** **APPROVED** pelo `prd-reviewer` (2026-06-14, score 90). Ver [.harness/RAG/decision-caixa-soft-delete.md](./.harness/RAG/decision-caixa-soft-delete.md).
- **Consequência na UI:**
  - Caixas arquivados somem da listagem padrão.
  - Toggle **"Mostrar arquivados"** na lista de caixas (só ADMIN/PASTOR/FINANCEIRO veem).
  - Ação **"Reabrir"** no detalhe do caixa arquivado (só ADMIN/PASTOR/FINANCEIRO).
  - Caixas arquivados rejeitam movimentação (criação de lançamento, transferência) com 409 + mensagem clara.

### 7.10 — Decisão de modelagem do ciclo 2: `Lancamento.categoria: TRANSFERENCIA` é exclusiva do espelho

- **Decisão:** `criarLancamento` (UI form) **NÃO aceita** `categoria = TRANSFERENCIA`. Esta categoria é exclusiva do `transferirEntreCaixas` (gera 2 lançamentos espelho: SAIDA origem + ENTRADA destino, ambos `categoria = TRANSFERENCIA`).
- **Consequência na UI:** o `<Select>` de categoria no `<FormLancamento>` **não mostra** a opção "Transferência". Categorias visíveis: `DIZIMO`, `OFERTA`, `CAMPANHA`, `DESPESA_OPERACIONAL`, `COMPRA_ESTOQUE`, `MANUTENCAO`.
- **Garantia em runtime:** o Zod `LancamentoCreateSchema` rejeita `categoria: TRANSFERENCIA` com 400.

### 7.11 — Decisão de modelagem do ciclo 2: Membro null em OFERTA, obrigatório em DIZIMO

- **Decisão:** `Lancamento.membroId` é **obrigatório** se `categoria = DIZIMO`; **opcional** se `categoria = OFERTA`; **null** para todas as outras categorias. RN-FIN-05.
- **Consequência na UI:** o campo "Membro" no `<FormLancamento>` aparece condicionalmente:
  - DIZIMO: campo visível e **obrigatório** (autocomplete de membros).
  - OFERTA: campo visível e **opcional** (label "Membro (opcional)"); se vazio, oferta é anônima.
  - Outras: campo **oculto** (não tem sentido).

### 7.12 — Decisão do ciclo 2: `assertCanManageCaixa` é helper novo (espelho de `assertCanSeeFinancials`)

- **Decisão:** criar `assertCanManageCaixa(user)` em `app/lib/rbac.server.ts`. Lança `Response(403)` se user não tem permissão de criar/arquivar caixa (ADMIN, PASTOR, FINANCEIRO).
- **Justificativa:** espelha o padrão de `assertCanSeeFinancials` (separação RBAC de "ver" vs "gerenciar estrutura"). Documentado em [brief.md §5.3](./brief.md) e [PRD.html Apêndice D.3 §F1](./PRD.html#c2-features).

---

## 8. Personas (ciclo 1 + ciclo 2)

| Persona | Cargo | No Módulo Financeiro (ciclo 2) | Frequência |
|---|---|---|---|
| **Pastor-presidente / TI** | `ADMIN` | CRUD total + auditoria + cria/arquiva caixas | Sob demanda |
| **Pastor titular** | `PASTOR` | CRUD total + auditoria + cria/arquiva caixas | Semanal |
| **Tesoureiro(a)** | `FINANCEIRO` | Operador dia-a-dia: dízimos, ofertas, despesas, transferências; cria/arquiva caixas | Diária |
| **Secretário(a)** | `SECRETARIO` | Lança despesas operacionais e transferências (com trava de saldo, RN-FIN-03). **NÃO** vê dízimos. **NÃO** cria/arquiva caixas. | Diária |
| **Discipulador** | `DISCIPULADOR` | **BLOQUEADO** em todo o módulo Financeiro (RN-MEM-03) | — |
| **Líder de Ministério** | `LIDER_MINISTERIO` | **BLOQUEADO** em todo o módulo Financeiro (RN-MEM-03) | — |

---

## 9. Módulo Financeiro (ciclo 2)

> **Escopo único do ciclo 2 (2026-06-14+):** Caixas + Lançamentos + Dízimos + Ofertas + Transferências + Trava de Saldo + aba Fidelidade Financeira.
>
> **Métrica macro (brief §7.1):** *O ciclo 2 é bem-sucedido quando um `FINANCEIRO` consegue, em menos de 2 minutos, registrar um dízimo de `Membro X` no `Caixa Geral`, ver o saldo do caixa refletir a entrada, e o `PASTOR` consegue abrir a aba "Fidelidade Financeira" do `Membro X` e ver o dízimo recém-lançado.*

### 9.1 Visão de produto

Substitui planilhas paralelas, cadernos físicos ou memória do tesoureiro. Centraliza:

- **Caixas** apartados (Geral, Cantina, Missões, ...) com saldo em **centavos** (`Int`).
- **Lançamentos** com 7 categorias (DIZIMO, OFERTA, CAMPANHA, DESPESA_OPERACIONAL, COMPRA_ESTOQUE, MANUTENCAO, TRANSFERENCIA).
- **Transferências** entre caixas (1 `TransferenciaCaixa` imutável + 2 `Lancamento` espelho em `$transaction` atômico).
- **Trava de saldo** obrigatória no service (RN-FIN-04) — saldo negativo é proibido.
- **Aba Fidelidade Financeira** no perfil do membro, restrita a ADMIN/PASTOR/FINANCEIRO (RN-MEM-03).

### 9.2 Features (8 entregáveis — PRD Apêndice D §D.3)

| # | Feature | Dono do Perfil | RN |
|---|---|---|---|
| **F1** | CRUD de Caixas (criar, listar, editar, arquivar, reabrir) | ADMIN, PASTOR, FINANCEIRO | RN-FIN-01 |
| **F2** | CRUD de Lançamentos (criar, listar, editar descritivo — valor/tipo imutáveis) | ADMIN, PASTOR, FINANCEIRO, SECRETARIO | RN-FIN-01, 04, 05 |
| **F3** | Dízimos vinculados a Membro (DIZIMO exige; OFERTA aceita anônimo) | ADMIN, PASTOR, FINANCEIRO, SECRETARIO | RN-FIN-05 |
| **F4** | Transferências entre Caixas (1+2 em `$transaction` atômico) | ADMIN, PASTOR, FINANCEIRO, SECRETARIO | RN-FIN-02 |
| **F5** | Trava de Saldo no service (Camada 3) | Todos que mutam saldo | RN-FIN-04 |
| **F6** | Aba "Fidelidade Financeira" integrada (substituir placeholder) | ADMIN, PASTOR, FINANCEIRO | RN-MEM-03 |
| **F7** | Dashboard de saldos (raiz do módulo) | ADMIN, PASTOR, FINANCEIRO, SECRETARIO | RN-FIN-01 |
| **F8** | RBAC fina (matriz completa, 3 camadas) | Defense in depth | RN-MEM-03, RN-FIN-03 |

### 9.3 Métricas de qualidade (gate Phase 5)

- Cobertura ≥ 85% global, **100% em services de regra de negócio** (`caixas.server.ts`, `lancamentos.server.ts`, `transferencias.server.ts`).
- 0 vuln critical/high.
- `planning-reviewer` score ≥ 70.
- LGPD compliant: dízimos restritos por perfil, **logs sem `valorCentavos`** (RAG `lgpd-igreja-conect`).
- 12 testes de borda obrigatórios (brief §7.3) **todos verdes**.

### 9.4 Fora do escopo (12 itens, brief §8)

- ❌ Gateway de pagamento (Pix, cartão, boleto).
- ❌ Conciliação bancária automática.
- ❌ Relatórios PDF/Excel.
- ❌ Multi-igreja / multi-tenant.
- ❌ Multi-moeda (apenas BRL).
- ❌ Recibo por e-mail.
- ❌ Notificações de saldo baixo (sem cron).
- ❌ Aprovação multi-nível para saídas grandes.
- ❌ Upload de comprovantes (sem S3).
- ❌ Módulo de Estoque (ciclo 3+).
- ❌ Criar/editar regras via UI.
- ❌ Perfil "auditor" RBAC.

### 9.5 Páginas do Módulo Financeiro (entregues nesta fase)

| Rota | Componente | DESIGN | PROMPT | Sprint |
|---|---|---|---|---|
| `/app/financeiro` | Dashboard de saldos | [design/private-financeiro-index.DESIGN.md](design/private-financeiro-index.DESIGN.md) | [design/private-financeiro-index.PROMPT.md](design/private-financeiro-index.PROMPT.md) | S06 |
| `/app/financeiro/caixas` | Lista de caixas | [design/private-financeiro-caixas.DESIGN.md](design/private-financeiro-caixas.DESIGN.md) | [design/private-financeiro-caixas.PROMPT.md](design/private-financeiro-caixas.PROMPT.md) | S06 |
| `/app/financeiro/caixas/:id` | Detalhe do caixa (extrato + arquivar) | [design/private-financeiro-caixas-detalhe.DESIGN.md](design/private-financeiro-caixas-detalhe.DESIGN.md) | [design/private-financeiro-caixas-detalhe.PROMPT.md](design/private-financeiro-caixas-detalhe.PROMPT.md) | S06 |
| `/app/financeiro/lancamentos/novo` | Novo lançamento | [design/private-financeiro-lancamento-novo.DESIGN.md](design/private-financeiro-lancamento-novo.DESIGN.md) | [design/private-financeiro-lancamento-novo.PROMPT.md](design/private-financeiro-lancamento-novo.PROMPT.md) | S06 |
| `/app/financeiro/transferencias/nova` | Nova transferência | [design/private-financeiro-transferencia-nova.DESIGN.md](design/private-financeiro-transferencia-nova.DESIGN.md) | [design/private-financeiro-transferencia-nova.PROMPT.md](design/private-financeiro-transferencia-nova.PROMPT.md) | S07 |
| `/app/membros/:id?tab=fidelidade` | Aba Fidelidade Financeira (atualizar) | [design/private-membros-fidelidade-update.DESIGN.md](design/private-membros-fidelidade-update.DESIGN.md) | [design/private-membros-fidelidade-update.PROMPT.md](design/private-membros-fidelidade-update.PROMPT.md) | S08 |

### 9.6 Cross-references obrigatórias

- **Brief:** [`brief.md`](./brief.md) §4 (Escopo), §5 (Decisões), §6 (Restrições), §7 (Sucesso), §8 (Não-objetivos).
- **PRD:** [`PRD.html` Apêndice D](./PRD.html#c2-apendice) — D.1 a D.9.
- **SPEC:** [`SPEC.html` Apêndice D](./SPEC.html#c2-apendice) — D.1 a D.10.
- **AGENTS:** [`agents/AGENTS.md` §"Módulo Financeiro (ciclo 2)"](./agents/AGENTS.md).
- **ARCH:** [`docs/architecture/ARCH.md` §8](./docs/architecture/ARCH.md) — fluxos, lifecycles, RBAC fina.
- **RAGs do ciclo 2 (4):**
  - [`.harness/RAG/architecture-financeiro.md`](./.harness/RAG/architecture-financeiro.md) (high) — visão macro.
  - [`.harness/RAG/pattern-trava-saldo-service.md`](./.harness/RAG/pattern-trava-saldo-service.md) (critical) — `assertSaldoSuficiente`.
  - [`.harness/RAG/pattern-transferencia-caixas.md`](./.harness/RAG/pattern-transferencia-caixas.md) (high) — 1+2 em `$transaction`.
  - [`.harness/RAG/decision-caixa-soft-delete.md`](./.harness/RAG/decision-caixa-soft-delete.md) (approved 2026-06-14) — `Caixa.ativo`.
- **RAGs transversais relevantes:**
  - `security-rbac-matrix` (critical) — RBAC fina.
  - `convention-monetary-values` (high) — `Int` em centavos.
  - `pattern-3-layer-rbac` (critical) — UI / loader / service.
  - `lgpd-igreja-conect` (critical) — sem PII em log.
  - `convention-prisma-sqlite` (high) — `$transaction` workflow.
  - `lesson-route-service-bypass` (high) — `prisma.*` direto na rota é antipadrão.
  - `lesson-prisma-7-commit-settle-e2e` (medium) — commit assíncrono em E2E.

---

## 10. Roadmap de design

### 10.1 MVP (ciclo 1, FECHADO 2026-06-13)

**10 páginas** (2 públicas + 8 privadas) — ver `design/PRODUCT.md` (espelho da versão 0.1, preservado).

### 10.2 Módulo Financeiro (ciclo 2, em andamento 2026-06-14+)

**6 páginas** entregues nesta fase (ver §9.5):
- S06: `/app/financeiro`, `/app/financeiro/caixas`, `/app/financeiro/caixas/novo` (form), `/app/financeiro/caixas/:id`, `/app/financeiro/lancamentos/novo`.
- S07: `/app/financeiro/transferencias/nova`, `/app/financeiro/transferencias` (lista).
- S08: atualização da aba Fidelidade Financeira no detalhe do membro.

### 10.3 Sprint futura (registro, sem design)

- **Estoque — consumo:** `/app/estoque`, `/app/estoque/itens/:id`, `/app/estoque/movimentacoes`. Quando: ciclo 3+.
- **Estoque — patrimônio:** `/app/estoque/patrimonio`, `/app/estoque/patrimonio/:id/manutencao`. Quando: ciclo 4+.
- **Manutenção + cron:** `/app/manutencao`, escalonamento automático. Quando: ciclo 4+.
- **Privacidade do titular (LGPD art. 18):** `/app/privacidade/pedidos`. Quando: ciclo 3+.
- **Auditoria de leitura (LGPD art. 37):** `/app/admin/auditoria`. Quando: ciclo 3+.

### 10.4 Melhorias visuais (registro)

- **Modo escuro.** Avaliar quando LGPD art. 18 entrar.
- **Tour guiado** para primeiro acesso.
- **Atalhos de teclado** (j/k, /).
- **Reconciliação semanal de caixa** (futuro): tela `/app/financeiro/auditoria` para ADMIN comparar `saldoCentavos` com `SUM(lancamentos)`.

---

## Índice de designs deste pacote

### Ciclo 1 (MVP, FECHADO 2026-06-13)

10 páginas (2 públicas + 8 privadas) — preservados em [`design/`](./design/). Ver `design/PRODUCT.md` §índice.

### Ciclo 2 (Módulo Financeiro, EM ANDAMENTO 2026-06-14+)

| Rota | Componente | DESIGN | PROMPT | Sprint |
|---|---|---|---|---|
| `/app/financeiro` | Dashboard de saldos | [design/private-financeiro-index.DESIGN.md](design/private-financeiro-index.DESIGN.md) | [design/private-financeiro-index.PROMPT.md](design/private-financeiro-index.PROMPT.md) | S06 |
| `/app/financeiro/caixas` | Lista de caixas | [design/private-financeiro-caixas.DESIGN.md](design/private-financeiro-caixas.DESIGN.md) | [design/private-financeiro-caixas.PROMPT.md](design/private-financeiro-caixas.PROMPT.md) | S06 |
| `/app/financeiro/caixas/:id` | Detalhe do caixa (extrato + arquivar/reabrir) | [design/private-financeiro-caixas-detalhe.DESIGN.md](design/private-financeiro-caixas-detalhe.DESIGN.md) | [design/private-financeiro-caixas-detalhe.PROMPT.md](design/private-financeiro-caixas-detalhe.PROMPT.md) | S06 |
| `/app/financeiro/lancamentos/novo` | Novo lançamento (DIZIMO/OFERTA/DESPESA) | [design/private-financeiro-lancamento-novo.DESIGN.md](design/private-financeiro-lancamento-novo.DESIGN.md) | [design/private-financeiro-lancamento-novo.PROMPT.md](design/private-financeiro-lancamento-novo.PROMPT.md) | S06 |
| `/app/financeiro/transferencias/nova` | Nova transferência entre caixas | [design/private-financeiro-transferencia-nova.DESIGN.md](design/private-financeiro-transferencia-nova.DESIGN.md) | [design/private-financeiro-transferencia-nova.PROMPT.md](design/private-financeiro-transferencia-nova.PROMPT.md) | S07 |
| `/app/membros/:id?tab=fidelidade` | Aba Fidelidade Financeira (atualizar existente) | [design/private-membros-fidelidade-update.DESIGN.md](design/private-membros-fidelidade-update.DESIGN.md) | [design/private-membros-fidelidade-update.PROMPT.md](design/private-membros-fidelidade-update.PROMPT.md) | S08 |

---

## Próxima revisão

- **Quando:** ao final da Fase 5 (build do Módulo Financeiro) ou se a Fase 4 detectar desvio de PRD/SPEC.
- **Por quem:** `designer` agent, a critério do orchestrator.
- **O que pode mudar:** paleta (se feedback de usuário), padrões de formulário (se react-hook-form mostrar fricção), navegação (se algum fluxo precisar reflow), matriz RBAC do Financeiro (se o usuário adicionar perfil).
