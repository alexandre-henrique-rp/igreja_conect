# Novo Lançamento (`/app/financeiro/lancamentos/novo`) — Design

## 1. Contexto

Formulário de **criação de Lançamento financeiro**. Acessível em `/app/financeiro/lancamentos/novo`. Suporta 6 das 7 categorias de `Lancamento` (a 7ª, `TRANSFERENCIA`, é exclusiva do `transferirEntreCaixas` e não tem UI — ver §7.10 do `PRODUCT.md`).

**Persona-alvo:** perfis com `canSeeFinancials` (4 perfis — `ADMIN`, `PASTOR`, `FINANCEIRO`, `SECRETARIO`).

**Caso de uso primário (métrica macro do ciclo 2, brief §7.1):** `FINANCEIRO` clica em "+ Novo Lançamento" no dashboard ou no detalhe do Caixa Geral, seleciona `tipo = ENTRADA`, `categoria = DIZIMO`, digita R$ 50,00, escolhe o Membro Maria, submete. Saldo do Caixa Geral reflete a entrada (R$ 50,00). Toast: "Dízimo de Maria registrado." PASTOR abre a aba Fidelidade do Membro Maria e vê o dízimo. **Tudo em menos de 2 minutos.**

**Casos secundários:**
- Lançar oferta anônima (`OFERTA`, sem `membroId`).
- Lançar despesa operacional (`DESPESA_OPERACIONAL`, com trava de saldo).
- Lançar campanha (`CAMPANHA`).
- Lançar compra de estoque / manutenção (categorias especiais — usadas pelo Módulo Estoque em ciclo 3+; permitidas no ciclo 2 para fins de auditoria).
- Pré-preenchimento via `?caixaId=<uuid>` (vindo do dashboard ou detalhe do caixa).

**Restrições críticas:**
- **RN-FIN-04 (trava de saldo):** `tipo = SAIDA` rejeita se `caixa.saldoCentavos < valorCentavos`. Bloqueio com 409 + mensagem clara.
- **RN-FIN-05 (dízimo exige membro; oferta aceita anônimo):** validação no Zod `superRefine`.
- **RN-MEM-03 (privacidade):** SECRETARIO pode criar (RN-FIN-01), mas o histórico de DIZIMO é restrito. `criarLancamento` não filtra — o filtro é na **leitura** (extrato, aba Fidelidade).
- **Decisão `Caixa.ativo`:** se o caixa está arquivado, `criarLancamento` rejeita com 409.
- **`categoria = TRANSFERENCIA` é exclusiva** do `transferirEntreCaixas` — **NÃO** aparece no `<Select>` de categoria. Service valida com erro explícito (Zod reject ou service 400).

---

## 2. Wireframe

### 2.1 Desktop (≥ 1024px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Topbar + Sidebar (com "Financeiro" ativo)                                │
├────────────┬─────────────────────────────────────────────────────────────┤
│ Sidebar    │  Financeiro > Novo Lançamento                               │ ← breadcrumb
│            │                                                             │
│            │  ┌─ Identificação ──────────────────────────────────────┐  │
│            │  │ Tipo * [▼ ENTRADA]  Categoria * [▼ Dízimo]         │  │ ← 2 selects
│            │  │                                                        │  │
│            │  │ ┌─ Valor e Data ───────────────────────────────────┐  │  │
│            │  │ │ Valor (R$) *  [50,00]                            │  │  │ ← mask BRL
│            │  │ │ Data *           [14/06/2026]                      │  │  │ ← type=date
│            │  │ │ Caixa *          [▼ Caixa Geral]                  │  │  │
│            │  │ │ Membro *         [🔍 Buscar membro...     ▼]     │  │  │ ← obrigatório p/ DIZIMO
│            │  │ └────────────────────────────────────────────────────┘  │  │
│            │  │                                                        │  │
│            │  │ ┌─ Descrição ───────────────────────────────────────┐  │  │
│            │  │ │ [Dízimo mensal de Maria da Silva_____________]  │  │  │
│            │  │ └────────────────────────────────────────────────────┘  │
│            │  │                                                        │  │
│            │  │  [Cancelar]    [Registrar lançamento]                 │  │
│            │  └────────────────────────────────────────────────────────┘  │
│            │                                                             │
│            │  InfoBox: "Caixa arquivado — escolha outro caixa."         │ ← condicional
│            │  InfoBox: "Saldo insuficiente: R$ 5,00 disponíveis."      │ ← condicional (SAIDA)
└────────────┴─────────────────────────────────────────────────────────────┘
```

### 2.2 Mobile

```
┌──────────────────────────────┐
│ [☰] Novo Lançamento          │
├──────────────────────────────┤
│ Tipo *                       │
│ [▼ ENTRADA]                  │
│                              │
│ Categoria *                  │
│ [▼ Dízimo]                   │
│                              │
│ Valor (R$) *                 │
│ [50,00]                      │
│                              │
│ Data *                       │
│ [14/06/2026]                 │
│                              │
│ Caixa *                      │
│ [▼ Caixa Geral]              │
│                              │
│ Membro *                     │
│ [🔍 Buscar membro...     ▼] │
│                              │
│ Descrição                    │
│ [Dízimo mensal de Maria...] │
│                              │
│ [Cancelar]                   │
│ [Registrar]                  │
└──────────────────────────────┘
```

---

## 3. Componentes

| Componente | Fonte | Props | Localização |
|---|---|---|---|
| `<ShellAutenticado>` | shared (ciclo 1) | — | (já existe) |
| `<PageHeader>` | shared (ciclo 1) | `title`, `breadcrumb?` | (já existe) |
| `<FormLancamento>` | novo | `caixas: CaixaOption[]`, `membros: MembroOption[]`, `defaultCaixaId?: string`, `defaultTipo?: TipoLancamento`, `defaultCategoria?: CategoriaLancamento`, `formError?: string`, `fieldErrors?: Record<string, string[]>` | `app/components/FormLancamento.tsx` |
| `<Select>` | shared (ciclo 1) | (já existe) | (já existe) |
| `<Input>` | shared (ciclo 1) | (já existe) | (já existe) |
| `<Section>` | shared (ciclo 1) | (já existe) | (já existe) |
| `<InfoBox>` | shared (ciclo 1) | `tone`, `title?`, `children` | (já existe) |
| `<MoneyInput>` | novo (ou reusar do ciclo 1 se existir) | `name`, `label`, `defaultValue?`, `placeholder?` | `app/components/MoneyInput.tsx` |

**Hierarquia:**
- `app/routes/app/financeiro.lancamentos.novo.tsx` (rota `/app/financeiro/lancamentos/novo`).
- Service `criarLancamento(input, user)` em `app/lib/lancamentos.server.ts` (estender).

---

## 4. Estados

| Estado | Quando | Render |
|---|---|---|
| **Initial (caixa pré-preenchido)** | `?caixaId=<uuid>` | Form com caixa selecionado. |
| **Initial (sem pré-preenchimento)** | URL sem query | Form vazio. |
| **Categoria = DIZIMO** | Selected | Campo "Membro" **visível e obrigatório** (label com `*`, validação Zod). |
| **Categoria = OFERTA** | Selected | Campo "Membro" **visível mas opcional** (label "(opcional)"). Placeholder "Deixe vazio para oferta anônima". |
| **Categoria = CAMPANHA / DESPESA_OPERACIONAL / COMPRA_ESTOQUE / MANUTENCAO** | Selected | Campo "Membro" **oculto** (não faz sentido). |
| **Categoria = TRANSFERENCIA** | (NUNCA aparece no select) | Não listado. Se Zod falhar (bypass via DevTools), service lança 400 com mensagem clara. |
| **Tipo = SAIDA** | Selected | InfoBox (se caixa selecionado): "Saldo atual: R$ X,XX. Saída bloqueará se saldo insuficiente." (UX, não segurança). |
| **Caixa arquivado** | Selected | InfoBox (warning): "Caixa arquivado. Movimentações bloqueadas. Escolha outro caixa." (Zod permite selecionar, mas service barra com 409). |
| **Loading submit** | Click "Registrar" | Botão vira `<Spinner />` + "Registrando...", campos `disabled`. |
| **Sucesso** | Action OK | Toast: "Lançamento registrado." + redirect para `/app/financeiro/caixas/<caixaId>` (volta para o extrato). |
| **Erro 422 (Zod)** | Action retorna 422 | Campos com erro destacados, mensagens inline. |
| **Erro 400 (DIZIMO sem membro)** | Action retorna 400 | Mensagem inline no campo "Membro": "Dízimo exige vínculo com membro." |
| **Erro 409 (saldo insuficiente)** | Action retorna 409 | InfoBox no topo: "Saldo insuficiente no caixa de origem. Disponível: R$ X,XX." + form mantém. |
| **Erro 409 (caixa arquivado)** | Action retorna 409 | InfoBox no topo: "Caixa arquivado. Movimentações bloqueadas." + form mantém. |

---

## 5. Fluxos de interação

| Elemento | Evento | Comportamento |
|---|---|---|
| Select "Tipo" | Change | UX inline: se `SAIDA`, mostra saldo atual do caixa selecionado (loader já busca). Não bloqueia submit (Camada 3 service). |
| Select "Categoria" | Change | Mostra/oculta campo "Membro" condicionalmente. Reseta o valor de `membroId` se a categoria mudou (ex: DIZIMO → CAMPANHA). |
| `<MoneyInput>` | Input | Aplica máscara BRL: "R$ X,XXX.XX". Converte para `valorCentavos: Int` antes de submit. |
| Input "Data" | Change | `<input type="date">` nativo. Default = hoje. Aceita passado e futuro (pode agendar batismo, etc.). |
| Select "Caixa" | Change | Atualiza InfoBox de saldo (se tipo = SAIDA) ou status arquivado (se aplicável). |
| Autocomplete "Membro" | Type | Filtra por nome (mín. 2 chars). Loader pode pré-carregar top 20 membros. |
| Botão "Cancelar" | Click | Volta para `/app/financeiro/caixas/<caixaId>` se `?caixaId`; senão, volta para `/app/financeiro`. |
| Botão "Registrar lançamento" | Click | Valida tudo (Zod), submete, redirect para extrato. |

**Navegação por teclado:**
- Tab: Tipo → Categoria → Valor → Data → Caixa → Membro (se visível) → Descrição → Cancelar → Submit.
- Enter em qualquer campo = submete (comportamento padrão de form).

**Máscara BRL:** `50,00` no display → `5000` (centavos) no submit. Implementação: `useState` + `parseBRLToCents` (helper de `money.server.ts`, mas usado client-side via re-export em `~/lib/money.client.ts` ou import direto se for SSR-safe).

---

## 6. Validações e regras

### 6.1 Schema Zod (`LancamentoCreateSchema`)

Já definido em `private-financeiro-caixas-detalhe.PROMPT.md §T1` e em `pattern-trava-saldo-service §4.1`:

```ts
export const LancamentoCreateSchema = z.object({
  tipo: z.enum(["ENTRADA", "SAIDA"]),
  categoria: z.enum(["DIZIMO", "OFERTA", "CAMPANHA", "DESPESA_OPERACIONAL", "COMPRA_ESTOQUE", "MANUTENCAO", "TRANSFERENCIA"]),
  valorCentavos: z.number().int().positive(),
  caixaId: z.string().uuid(),
  membroId: z.string().uuid().optional().nullable(),
  dataCompetencia: z.coerce.date(),
  descricao: z.string().min(1).max(500),
}).strict().superRefine((val, ctx) => {
  if (val.categoria === "DIZIMO" && !val.membroId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Dízimo exige vínculo com membro.", path: ["membroId"] });
  }
  if (val.categoria !== "DIZIMO" && val.categoria !== "OFERTA" && val.membroId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Categoria ${val.categoria} não aceita vínculo com membro.`, path: ["membroId"] });
  }
});
```

### 6.2 Regras de negócio

- **RN-FIN-04 (trava de saldo):** se `tipo = SAIDA`, `assertSaldoSuficiente(caixaId, valorCentavos, context)` chamado **antes** do `$transaction`. Helper em `app/lib/finance.server.ts`.
- **RN-FIN-05 (dízimo exige membro; oferta aceita anônimo):** validado no Zod `superRefine` (Bloqueio 400).
- **Decisão `Caixa.ativo`:** se `caixa.ativo === false`, `assertSaldoSuficiente` rejeita com 409 (helper já antecipou a checagem).
- **Sem `categoria: TRANSFERENCIA`:** Zod aceita (enum inclui), mas service `criarLancamento` rejeita explicitamente com 400: "Categoria TRANSFERENCIA é exclusiva do sistema de transferências. Use a página de Nova Transferência."
- **Imutabilidade após criação:** valor, tipo, categoria, caixaId **NÃO** podem ser editados. Editar `valorCentavos` violaria RN-FIN-04 (rastreabilidade). Edição é apenas descritivo (futuro, fora do ciclo 2).

### 6.3 Edge cases

- **Valor com vírgula vs ponto:** `MoneyInput` aceita `50,00` e `50.00`; converte para `5000` (centavos). `parseBRLToCents("50,00")` retorna 5000.
- **Valor com mais de 2 casas decimais:** `parseBRLToCents("50,001")` arredonda para 5000 (ou 5001? — decisão: arredondar para o centavo mais próximo, banker's rounding não, simples `Math.round`).
- **Data futura:** permitida (agendamento de dízimo, por exemplo). PRD não veda.
- **Data no passado distante (> 1 ano):** permitida. Auditoria cobre.
- **Membro deletado:** `membroId` é UUID válido (não deletedAt check). Se membro foi deletado mas UUID ainda existe (impossível: `onDelete: Restrict` para lançamentos), erro.
- **Caixa com saldo exato:** `valorCentavos = saldoCentavos` → `assertSaldoSuficiente` passa (>=, não >). Saldo zera, não vira negativo. **Caso de borda importante** (teste de borda #3 do brief).
- **Saldo = 0, SAIDA de 1 centavo:** `assertSaldoSuficiente` rejeita com 409. **Caso de borda bloqueador de sprint** (teste de borda #3).

### 6.4 Integrações externas

Nenhuma.

---

## 7. RBAC (defesa em 3 camadas)

| Operação | ADMIN | PASTOR | FINANCEIRO | SECRETARIO | DISCIPULADOR | LIDER_MIN. |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Ver formulário | ✅ | ✅ | ✅ | ✅ | 🚫 | 🚫 |
| Submeter (criar lançamento) | ✅ | ✅ | ✅ | ✅ | 🚫 (403) | 🚫 (403) |

**Defesa em 3 camadas:**
- **UI (Camada 1):** link "+ Novo Lançamento" no menu lateral / dashboard / detalhe do caixa **só aparece** para perfis com `canSeeFinancials` (`<Can allow={[...]}>`).
- **Loader/Action (Camada 2):** `assertCanSeeFinancials(user)` no início do `loader` e `action`.
- **Service (Camada 3):** `criarLancamento` chama `assertCanSeeFinancials` como PRIMEIRA linha, **antes** de qualquer `prisma.*`.

---

## 8. Dados (loader + service)

### 8.1 Loader

```ts
// app/routes/app/financeiro.lancamentos.novo.tsx
export async function loader({ request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  assertCanSeeFinancials(user); // Camada 2

  const url = new URL(request.url);
  const defaultCaixaId = url.searchParams.get("caixaId");

  // Buscar caixas ativos + top 20 membros (para autocomplete)
  const [caixas, membros] = await Promise.all([
    prisma.caixa.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id, nome, saldoCentavos, ativo: true } }),
    prisma.membro.findMany({ where: { cargo: { not: null } }, orderBy: { nome: "asc" }, take: 50, select: { id, nome } }), // top 50 para o autocomplete
  ]);

  return { user, caixas, membros, defaultCaixaId };
}
```

**Decisão:** loader pode usar `prisma.*` direto? **NÃO** — deve passar por service (RAG `lesson-route-service-bypass`). Mas para read-only de "lista de caixas ativos" + "lista de membros", é um caso edge. Decisão: criar `listarCaixasParaSelect(user)` em `caixas.server.ts` (reutiliza `listarCaixas` sem `q` e `apenasAtivos: true`) e `listarMembrosParaAutocomplete()` em `members.server.ts` (existente do ciclo 1, ou estender).

### 8.2 Action

```ts
export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  assertCanSeeFinancials(user); // Camada 2

  const form = await request.formData();
  
  // Converter valorBRL (string "50,00") para valorCentavos (Int 5000)
  const valorBRL = form.get("valorBRL") as string;
  let valorCentavos: number;
  try {
    valorCentavos = parseBRLToCents(valorBRL);
  } catch (e) {
    return { fieldErrors: { valorCentavos: ["Valor inválido."] }, formError: null, defaultValues: Object.fromEntries(form) };
  }

  const rawInput = {
    tipo: form.get("tipo"),
    categoria: form.get("categoria"),
    valorCentavos,
    caixaId: form.get("caixaId"),
    membroId: form.get("membroId") || null,
    dataCompetencia: form.get("dataCompetencia"),
    descricao: form.get("descricao"),
  };

  const parsed = LancamentoCreateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors, formError: null, defaultValues: Object.fromEntries(form) };
  }

  try {
    await criarLancamento(parsed.data, user); // Camada 3
    return redirect(`/app/financeiro/caixas/${parsed.data.caixaId}`);
  } catch (e) {
    // 400 (DIZIMO sem membro) ou 409 (saldo/arquivado)
    if (e instanceof Response) {
      const status = e.status;
      const message = await e.text();
      if (status === 409) {
        return { formError: message, fieldErrors: {}, defaultValues: Object.fromEntries(form) };
      }
      if (status === 400) {
        return { formError: message, fieldErrors: { membroId: [message] }, defaultValues: Object.fromEntries(form) };
      }
    }
    throw e;
  }
}
```

### 8.3 Service contract (estender `app/lib/lancamentos.server.ts`)

```ts
/**
 * @description Cria um novo lançamento (entrada ou saída) e atualiza o saldo do caixa.
 * RBAC: assertCanSeeFinancials (Camada 3).
 * Trava: assertSaldoSuficiente se tipo=SAIDA (RN-FIN-04).
 * Validação Zod: LancamentoCreateSchema (RN-FIN-05).
 * Decisão Caixa.ativo: bloqueia se caixa arquivado.
 * @param {LancamentoCreateInput} input - Validado por LancamentoCreateSchema.
 * @param {SessionUser} user - Operador autenticado.
 * @returns {Promise<Lancamento>} Lançamento criado (com caixaId).
 * @throws {Response} 400 (TRANSFERENCIA rejeitada), 400 (DIZIMO sem membro — Zod), 403 (RBAC), 404 (caixa não existe), 409 (saldo insuficiente ou caixa arquivado).
 */
export async function criarLancamento(
  input: LancamentoCreateInput,
  user: SessionUser
): Promise<Lancamento>;
```

**Implementação canônica (ver `pattern-trava-saldo-service` §4.1):**
1. `assertCanSeeFinancials(user)` — Camada 3 RBAC.
2. **Bloqueio explícito de TRANSFERENCIA:** se `input.categoria === "TRANSFERENCIA"`, lança `Response("Categoria TRANSFERENCIA é exclusiva do sistema de transferências.", { status: 400 })`.
3. `assertNonNegative(input.valorCentavos, "Lançamento")`.
4. Se `input.tipo === "SAIDA"`: `await assertSaldoSuficiente(input.caixaId, input.valorCentavos, \`Lançamento de saída (\${input.categoria})\`)`. (Helper já checa `ativo: false` — RAG `decision-caixa-soft-delete` §2.4 antecipou.)
5. **Re-leitura dentro do `$transaction`** (anti-TOCTOU): confirmar `caixa.ativo === true` e `saldoCentavos >= valorCentavos` (se SAIDA).
6. `prisma.$transaction(async (tx) => { ... })`:
   - `tx.lancamento.create({ data: input })`.
   - `tx.caixa.update({ where: { id: input.caixaId }, data: { saldoCentavos: { increment } } })` (ENTRADA) ou `{ decrement }` (SAIDA).
7. `safeLog({ action: "create_lancamento", resource: "lancamento:<id>", userId: user.id, result: "ok" })` — **sem `valorCentavos` ou `membroId`**.

---

## 9. Testes sugeridos (TDD)

### 9.1 Unit (sem DB)

- `LancamentoCreateSchema`:
  - Aceita DIZIMO com membroId.
  - Rejeita DIZIMO sem membroId (400).
  - Aceita OFERTA sem membroId (anônimo).
  - Rejeita OFERTA com membroId preenchido (warning? não — aceita, é só opcional. Remover essa asserção.)
  - Rejeita DESPESA_OPERACIONAL com membroId (400).
  - Rejeita valor 0 ou negativo.
  - Rejeita `categoria: TRANSFERENCIA` no service (não no Zod, mas service explicitamente).
  - Rejeita `descricao` vazia.

### 9.2 Integração (com DB, `setupTestDb`)

- `criarLancamento({ tipo: "ENTRADA", categoria: "DIZIMO", valorCentavos: 5000, caixaId, membroId, ... }, adminUser)`:
  - Cria lançamento.
  - Saldo do caixa = 5000.
- `criarLancamento({ tipo: "ENTRADA", categoria: "DIZIMO", ... sem membroId }, adminUser)`:
  - Lança `Response(400)` (DIZIMO exige membro — Zod).
- `criarLancamento({ tipo: "ENTRADA", categoria: "OFERTA", ... sem membroId }, adminUser)`:
  - Cria lançamento (anônimo).
- `criarLancamento({ tipo: "ENTRADA", categoria: "TRANSFERENCIA", ... }, adminUser)`:
  - Lança `Response(400)` (TRANSFERENCIA exclusiva).
- **Trava de saldo (teste de borda #3 — BLOQUEADOR):**
  - `caixa.saldoCentavos = 0`.
  - `criarLancamento({ tipo: "SAIDA", valorCentavos: 1, ... }, adminUser)`:
  - Lança `Response(409, "Saldo insuficiente no caixa de origem. Disponível: R$ 0,00.")`.
  - Saldo permanece 0.
- `criarLancamento({ tipo: "SAIDA", valorCentavos: 1000 }, adminUser)` com saldo = 1000:
  - Cria lançamento. Saldo = 0.
- `criarLancamento({ tipo: "SAIDA", valorCentavos: 1001 }, adminUser)` com saldo = 1000:
  - Lança `Response(409)`.
- `criarLancamento({ ..., caixaId: caixaArquivado.id }, adminUser)`:
  - Lança `Response(409, "Caixa arquivado. Movimentações bloqueadas.")`.
- `criarLancamento({ ... }, secretarioUser)`:
  - Cria lançamento OK (RN-FIN-01 — SECRETARIO pode lançar despesa).
  - DIZIMO: SECRETARIO **pode** criar (criação não filtra, leitura filtra — RN-MEM-03).
- `criarLancamento({ ... }, discipuladorUser)`:
  - Lança `Response(403)`.

### 9.3 E2E (Playwright) — `e2e/financeiro-lancamento-novo.spec.ts`

- Login `financeiro@igreja.local` → `/app/financeiro/caixas/<id>` → click "+ Novo Lançamento" → `/app/financeiro/lancamentos/novo?caixaId=<id>`.
- Form pré-preenchido com caixa.
- Seleciona `tipo=ENTRADA`, `categoria=DIZIMO`, valor `50,00`, membro Maria → submit.
- Toast: "Dízimo de Maria registrado." + redirect para extrato do caixa.
- Extrato mostra 1 lançamento.
- **Métrica macro (brief §7.1):** PASTOR loga em outra aba, abre `/app/membros/<maria.id>?tab=fidelidade`, vê o dízimo recém-criado. **Tudo < 2 min.**
- **Saldo insuficiente:** tentar SAIDA de R$ 100,00 com saldo R$ 50,00 → 409 inline.
- **DIZIMO sem membro:** submeter sem selecionar membro → 400 inline no campo Membro.
- **DISCIPULADOR bypass:** login `discipulador@igreja.local` → `/app/financeiro/lancamentos/novo` direto na URL → 403.

---

## 10. Critérios de aceite (gate Phase 5)

- [ ] Loader chama `assertCanSeeFinancials` **antes** de I/O.
- [ ] `criarLancamento` chama `assertCanSeeFinancials` como PRIMEIRA linha (Camada 3).
- [ ] `assertSaldoSuficiente` chamado **antes** do `$transaction` se `tipo = SAIDA` (RN-FIN-04).
- [ ] Re-leitura do saldo **dentro** do `$transaction` (anti-TOCTOU).
- [ ] Caixas arquivados rejeitam com 409 (decisão `Caixa.ativo`).
- [ ] `categoria: TRANSFERENCIA` rejeitada com 400 (exclusiva do `transferirEntreCaixas`).
- [ ] DIZIMO sem membro rejeitado com 400 (RN-FIN-05).
- [ ] OFERTA sem membro OK (anônimo, RN-FIN-05).
- [ ] Campo "Membro" condicional à categoria.
- [ ] Pré-preenchimento via `?caixaId=<uuid>` funciona.
- [ ] MoneyInput converte "50,00" → 5000 cents.
- [ ] Saldo atualizado atomicamente (`$transaction`).
- [ ] `safeLog` sem `valorCentavos` ou `membroId`.
- [ ] Cobertura do service ≥ 100% (gate RN-FIN-04/05).
- [ ] Lighthouse Accessibility ≥ 95.

---

## 11. Acessibilidade

- **`<h1>`** = "Novo Lançamento".
- **`<fieldset>`** com `<legend>` para cada seção (Identificação, Valor e Data, Descrição).
- **Labels** associadas via `<label htmlFor>`.
- **Asterisco vermelho** em campos obrigatórios, com `<span aria-label="obrigatório">*</span>`.
- **Mensagens de erro** com `role="alert"`, `aria-describedby` apontando para a mensagem.
- **Campo "Membro"** com `aria-required="true"` quando `categoria = DIZIMO`.
- **Tab order** natural (DOM order).
- **Submit desabilitado** (loading) tem `aria-busy="true"`.
- **InfoBox** com `role="status"` (informativo).

---

## 12. Mobile

- **Layout vertical** (campos empilhados).
- **Inputs full-width**, `min-h-[44px]`.
- **Botões** full-width, empilhados: "Cancelar" (ghost) em cima, "Registrar" (primary) embaixo.
- **Teclado virtual:** `inputMode="decimal"` no valor, `inputMode="text"` no membro.

---

## 13. Cross-references

- **PRD:** [Apêndice D §D.3 F2, F3, F5 (CRUD Lançamentos + Dízimos + Trava saldo)](./PRD.html#c2-features), §D.4 (métrica macro).
- **SPEC:** [Apêndice D §D.4 (`POST /app/financeiro/lancamentos`)](./SPEC.html#c2-endpoints), §D.3 (services).
- **AGENTS:** [§"Módulo Financeiro (ciclo 2)" §"Exemplo de service signature"](./agents/AGENTS.md).
- **ARCH:** [§8.2 (Fluxo crítico 1: Criar Dízimo), §8.4 (Trava de Saldo)](./docs/architecture/ARCH.md).
- **RAGs:**
  - [`.harness/RAG/architecture-financeiro.md`](./.harness/RAG/architecture-financeiro.md) §3.1 (Fluxo Criar Dízimo).
  - [`.harness/RAG/pattern-trava-saldo-service.md`](./.harness/RAG/pattern-trava-saldo-service.md) §2 (helper canônico), §4.1 (exemplo completo).
  - [`.harness/RAG/security-rbac-matrix.md`](./.harness/RAG/security-rbac-matrix.md) — `assertCanSeeFinancials`.
  - [`.harness/RAG/pattern-3-layer-rbac.md`](./.harness/RAG/pattern-3-layer-rbac.md) — 3 camadas.
  - [`.harness/RAG/convention-monetary-values.md`](./.harness/RAG/convention-monetary-values.md) — `parseBRLToCents`, `formatBRLFromCents`.
  - [`.harness/RAG/decision-caixa-soft-delete.md`](./.harness/RAG/decision-caixa-soft-delete.md) — caixa arquivado rejeita.
  - [`.harness/RAG/lgpd-igreja-conect.md`](./.harness/RAG/lgpd-igreja-conect.md) — sem PII em log.
  - [`.harness/RAG/lesson-prisma-7-commit-settle-e2e.md`](./.harness/RAG/lesson-prisma-7-commit-settle-e2e.md) — workaround E2E se flaky.
