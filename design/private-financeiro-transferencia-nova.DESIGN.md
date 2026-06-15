# Nova Transferência (`/app/financeiro/transferencias/nova`) — Design

## 1. Contexto

Formulário de **criação de Transferência entre Caixas**. Acessível em `/app/financeiro/transferencias/nova`. Operação composta e **atômica** que gera 1 registro em `TransferenciaCaixa` (imutável, carimbo do operador) + 2 lançamentos espelho (SAIDA origem + ENTRADA destino, ambos `categoria = TRANSFERENCIA`).

**Persona-alvo:** perfis com `canSeeFinancials` (4 perfis — `ADMIN`, `PASTOR`, `FINANCEIRO`, `SECRETARIO`).

**Caso de uso primário (F4 — Transferências entre Caixas, RN-FIN-02):** `SECRETARIO` transfere R$ 100 do Caixa Geral para Caixa Cantina. Saldos refletem imediatamente (origem -100, destino +100). Registro imutável `TransferenciaCaixa` + 2 lançamentos espelho criados atomicamente.

**Casos secundários:**
- Pré-preenchimento via `?caixaOrigemId=<uuid>` (vindo do detalhe do caixa).
- Listagem de transferências (página separada, futura — backlog; foco do ciclo 2 é só o form).
- Auditoria: ver `executadoPorId` (carimbo do operador) e `dataHora` exata.

**Restrições críticas:**
- **RN-FIN-02 (rastreabilidade):** 1 `TransferenciaCaixa` (imutável) + 2 `Lancamento` espelho. `executadoPorId = user.id` (nunca do form). `dataHora = now()` (pode aceitar custom? **Decisão:** default = now, mas pode aceitar custom para ajustes retroativos).
- **RN-FIN-04 (trava saldo):** bloqueia se `caixaOrigem.saldoCentavos < valorCentavos`. **Crítico** — atomicidade obrigatória.
- **RN-FIN-01 + decisão `Caixa.ativo`:** caixas arquivados rejeitam (origem ou destino).
- **Origem ≠ destino:** validado no Zod (não faz sentido transferir de/para o mesmo caixa).
- **Valor > 0:** validado no Zod.
- **5 mutações em 1 `$transaction`:** `transferenciaCaixa.create` + `lancamento.create` × 2 + `caixa.update` × 2. Sem exceção.
- **Re-leitura do saldo DENTRO do `$transaction`** (anti-TOCTOU) — não confia na leitura do helper.

---

## 2. Wireframe

### 2.1 Desktop (≥ 1024px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Topbar + Sidebar (com "Financeiro" ativo)                                │
├────────────┬─────────────────────────────────────────────────────────────┤
│ Sidebar    │  Financeiro > Nova Transferência                            │ ← breadcrumb
│            │                                                             │
│            │  ┌─ Caixas e Valor ──────────────────────────────────────┐  │
│            │  │ Caixa de Origem *  [▼ Caixa Geral (R$ 1.000,00)]    │  │ ← saldo inline
│            │  │ Caixa de Destino * [▼ Caixa Cantina (R$ 234,56)]    │  │
│            │  │                                                        │  │
│            │  │ Valor (R$) *        [100,00]                          │  │ ← MoneyInput
│            │  │ Data/Hora           [14/06/2026 14:30]                │  │ ← default = now
│            │  │ Descrição (opcional) [Transferência para Cantina...]│  │ ← max 500
│            │  └────────────────────────────────────────────────────────┘  │
│            │                                                             │
│            │  InfoBox (warning): "Saldo insuficiente no Caixa Geral.     │
│            │  Disponível: R$ 50,00. Necessário: R$ 100,00."              │ ← condicional (se SAIDA bloqueada)
│            │                                                             │
│            │  InfoBox (info): "Esta operação é atômica. Será registrada  │
│            │  como 1 transferência + 2 lançamentos espelho (SAIDA         │
│            │  origem + ENTRADA destino)."                                │ ← sempre visível
│            │                                                             │
│            │  [Cancelar]    [Transferir R$ 100,00]                        │
│            │                                                             │
└────────────┴─────────────────────────────────────────────────────────────┘
```

### 2.2 Mobile

```
┌──────────────────────────────┐
│ [☰] Nova Transferência       │
├──────────────────────────────┤
│ Caixa de Origem *            │
│ [▼ Caixa Geral (R$ 1.000,00)]│
│                              │
│ Caixa de Destino *           │
│ [▼ Caixa Cantina (R$ 234,56)]│
│                              │
│ Valor (R$) *                 │
│ [100,00]                     │
│                              │
│ Data/Hora                    │
│ [14/06/2026 14:30]           │
│                              │
│ Descrição (opcional)         │
│ [Transferência para Cantina] │
│                              │
│ [Cancelar]                   │
│ [Transferir]                 │
└──────────────────────────────┘
```

---

## 3. Componentes

| Componente | Fonte | Props | Localização |
|---|---|---|---|
| `<ShellAutenticado>` | shared (ciclo 1) | — | (já existe) |
| `<PageHeader>` | shared (ciclo 1) | `title`, `breadcrumb?` | (já existe) |
| `<FormTransferencia>` | novo | `caixas: CaixaOption[]`, `defaultCaixaOrigemId?: string`, `formError?: string`, `fieldErrors?: Record<string, string[]>` | `app/components/FormTransferencia.tsx` |
| `<MoneyInput>` | (criado em `private-financeiro-lancamento-novo.PROMPT.md §T5`) | (já existe) | (já existe) |
| `<InfoBox>` | shared (ciclo 1) | `tone`, `title?`, `children` | (já existe) |
| `<Input>` | shared (ciclo 1) | `type="datetime-local"`, `label`, etc. | (já existe) |

**Hierarquia:**
- `app/routes/app/financeiro.transferencias.novo.tsx` (rota `/app/financeiro/transferencias/nova`).
- Service `transferirEntreCaixas(input, user)` em `app/lib/transferencias.server.ts` (NOVO).

---

## 4. Estados

| Estado | Quando | Render |
|---|---|---|
| **Initial (caixa origem pré-preenchido)** | `?caixaOrigemId=<uuid>` | Select de origem pré-selecionado. |
| **Initial (sem pré-preenchimento)** | URL sem query | Form vazio. |
| **Origem = Destino** | selected | InfoBox (warning): "Origem e destino devem ser caixas diferentes." Botão submit **desabilitado** (UX) **e** Zod rejeita (400). |
| **Saldo insuficiente (origem)** | valor > saldoOrigem | InfoBox (warning): "Saldo insuficiente no Caixa Geral. Disponível: R$ X,XX. Necessário: R$ Y,YY." Botão submit **desabilitado** (UX) **e** service bloqueia com 409. |
| **Caixa arquivado (origem OU destino)** | selected | InfoBox (warning): "Caixa arquivado. Movimentações bloqueadas." Submit desabilitado. |
| **Loading submit** | Click "Transferir" | Botão vira `<Spinner />` + "Transferindo...", campos `disabled`. |
| **Sucesso** | Action OK | Toast: "Transferência de R$ 100,00 do Caixa Geral para Caixa Cantina registrada." + redirect para `/app/financeiro/transferencias` (lista, futura) **ou** `/app/financeiro` (dashboard). **Decisão:** redirect para `/app/financeiro/transferencias` (futuro — ciclo 3+). Para ciclo 2, redirect para `/app/financeiro` (dashboard) é mais simples. |
| **Erro 422 (Zod)** | Action retorna 422 | Campos com erro destacados, mensagens inline. |
| **Erro 409 (saldo insuficiente)** | Action retorna 409 | InfoBox no topo: "Saldo insuficiente no caixa de origem. Disponível: R$ X,XX." + form mantém. |
| **Erro 409 (caixa arquivado)** | Action retorna 409 | InfoBox no topo: "Caixa arquivado. Movimentações bloqueadas." |
| **Erro 400 (origem = destino)** | Action retorna 400 | InfoBox inline: "Origem e destino devem ser caixas diferentes." |

---

## 5. Fluxos de interação

| Elemento | Evento | Comportamento |
|---|---|---|
| Select "Caixa de Origem" | Change | Atualiza InfoBox de saldo da origem (se aplicável). Verifica se origem = destino. |
| Select "Caixa de Destino" | Change | Verifica se destino = origem. Verifica se destino está arquivado. |
| `<MoneyInput>` "Valor" | Input | Aplica máscara BRL. UX inline: mostra "Saldo disponível: R$ X,XX" + "Necessário: R$ Y,YY" se saldo < valor. |
| Input "Data/Hora" | Change | `<input type="datetime-local">` nativo. Default = now. Aceita passado (auditoria retroativa). |
| Input "Descrição" | Change | Opcional. Max 500 chars. Placeholder: "Ex: Transferência para Cantina (Páscoa 2026)". |
| Botão "Cancelar" | Click | Volta para `/app/financeiro` (dashboard). |
| Botão "Transferir R$ X,XX" | Click | Valida Zod, submete, redirect. |

**Navegação por teclado:** Tab: Origem → Destino → Valor → Data → Descrição → Cancelar → Submit.

**MoneyInput com saldo inline (UX, não segurança):**

```tsx
const saldoOrigem = caixas.find(c => c.id === caixaOrigemId)?.saldoCentavos ?? 0;
const valorCentavos = parseBRLToCents(valorDisplay); // client-side preview
const saldoInsuficiente = valorCentavos > saldoOrigem;
```

Botão "Transferir" fica `disabled` se `saldoInsuficiente === true` (UX, mas service barra bypass).

---

## 6. Validações e regras

### 6.1 Schema Zod

```ts
// app/lib/schemas/transferencias.ts
export const TransferenciaCreateSchema = z.object({
  caixaOrigemId: z.string().uuid("Caixa de origem inválido."),
  caixaDestinoId: z.string().uuid("Caixa de destino inválido."),
  valorCentavos: z.number().int().positive("Valor deve ser maior que zero."),
  dataHora: z.coerce.date().default(() => new Date()),
  descricao: z.string().max(500).optional().or(z.literal("")),
}).strict().superRefine((val, ctx) => {
  if (val.caixaOrigemId === val.caixaDestinoId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Origem e destino devem ser caixas diferentes.",
      path: ["caixaDestinoId"],
    });
  }
});
```

### 6.2 Regras de negócio

- **RN-FIN-02 (rastreabilidade):** 1 `TransferenciaCaixa` (imutável, `executadoPorId: user.id`, `dataHora`) + 2 `Lancamento` espelho (SAIDA origem, ENTRADA destino, `categoria: TRANSFERENCIA`).
- **RN-FIN-04 (trava saldo):** `assertSaldoSuficiente(caixaOrigemId, valorCentavos, ...)` chamado **antes** do `$transaction`. Re-leitura dentro da transação (anti-TOCTOU).
- **Decisão `Caixa.ativo`:** se `caixaOrigem.ativo === false` OU `caixaDestino.ativo === false`, rejeita com 409.
- **Origem ≠ destino:** validado no Zod `superRefine`.
- **Valor > 0:** validado no Zod (`.int().positive()`).
- **Atomicidade:** 5 mutações em 1 `$transaction` (1 `TransferenciaCaixa.create` + 2 `Lancamento.create` + 2 `Caixa.update`).

### 6.3 Edge cases

- **Origem = destino (bypass via DevTools):** Zod rejeita, action retorna 400.
- **Valor = 0 ou negativo:** Zod rejeita, action retorna 400.
- **Saldo exato:** `valorCentavos = saldoOrigem` → `assertSaldoSuficiente` passa (>=). Saldo origem zera, destino += valor. OK.
- **Data futura:** permitida? **Decisão:** bloquear data futura (RN-FIN-02: carimbo temporal = "quando foi executada"). Validação adicional no action.
- **Descrição vazia:** permitida (opcional). Service gera descrição-padrão se vazia: `Transferência #<transfIdCurto> → caixa destino`.
- **Caixa de destino com saldo negativo inicial (impossível após `pnpm db:reset`):** transferência aumenta saldo (não subtrai). OK.
- **Concorrência:** 2 transferências simultâneas da mesma origem com saldo justo para 1. SQLite serializa (1 writer), mas o `$transaction` cobre.

### 6.4 Integrações externas

Nenhuma.

---

## 7. RBAC (defesa em 3 camadas)

| Operação | ADMIN | PASTOR | FINANCEIRO | SECRETARIO | DISCIPULADOR | LIDER_MIN. |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Ver formulário | ✅ | ✅ | ✅ | ✅ | 🚫 | 🚫 |
| Submeter (criar transferência) | ✅ | ✅ | ✅ | ✅ | 🚫 (403) | 🚫 (403) |

**Defesa em 3 camadas:**
- **UI:** link "+ Nova Transferência" no dashboard / detalhe do caixa **só aparece** para perfis com `canSeeFinancials`.
- **Loader/Action (Camada 2):** `assertCanSeeFinancials(user)`.
- **Service (Camada 3):** `transferirEntreCaixas` chama `assertCanSeeFinancials` como PRIMEIRA linha.

---

## 8. Dados (loader + service)

### 8.1 Loader

```ts
// app/routes/app/financeiro.transferencias.novo.tsx
export async function loader({ request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  assertCanSeeFinancials(user);

  const url = new URL(request.url);
  const defaultCaixaOrigemId = url.searchParams.get("caixaOrigemId") ?? undefined;

  const caixas = await listarCaixasParaSelect(user);
  return { user, caixas, defaultCaixaOrigemId };
}
```

### 8.2 Action

```ts
export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  assertCanSeeFinancials(user);

  const form = await request.formData();
  const valorBRL = (form.get("valorBRL") as string) ?? "";
  let valorCentavos: number;
  try {
    valorCentavos = parseBRLToCents(valorBRL);
  } catch (e) {
    return { formError: null, fieldErrors: { valorCentavos: ["Valor inválido."] }, defaultValues: Object.fromEntries(form) };
  }

  const rawInput = {
    caixaOrigemId: form.get("caixaOrigemId"),
    caixaDestinoId: form.get("caixaDestinoId"),
    valorCentavos,
    dataHora: form.get("dataHora") || new Date().toISOString(),
    descricao: form.get("descricao") ?? "",
  };

  const parsed = TransferenciaCreateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { formError: null, fieldErrors: parsed.error.flatten().fieldErrors, defaultValues: Object.fromEntries(form) };
  }

  try {
    await transferirEntreCaixas(parsed.data, user);
    return redirect("/app/financeiro");
  } catch (e) {
    if (e instanceof Response) {
      const status = e.status;
      const message = await e.text();
      if (status === 409 || status === 400) {
        return { formError: message, fieldErrors: {}, defaultValues: Object.fromEntries(form) };
      }
    }
    throw e;
  }
}
```

### 8.3 Service contract (`app/lib/transferencias.server.ts` — NOVO)

```ts
/**
 * @description Transfere valor entre dois caixas. Operação composta atômica:
 * 1 TransferenciaCaixa (imutável, auditoria, executadoPorId) + 2 Lancamento espelho
 * (SAIDA origem, ENTRADA destino, ambos categoria TRANSFERENCIA) + 2 Caixa.update
 * (decrement/increment). Total: 5 mutações em 1 prisma.$transaction.
 * @param {TransferenciaCreateInput} input - Validado por TransferenciaCreateSchema.
 * @param {SessionUser} user - Operador autenticado.
 * @returns {Promise<TransferenciaCaixa>} Registro imutável criado.
 * @throws {Response} 400 (origem=destino, valor ≤ 0, Zod), 403 (RBAC), 404 (caixa não existe), 409 (saldo origem insuficiente ou caixa arquivado).
 */
export async function transferirEntreCaixas(
  input: TransferenciaCreateInput,
  user: SessionUser
): Promise<TransferenciaCaixa>;
```

**Implementação canônica (ver `pattern-transferencia-caixas` §2.2):**

1. `assertCanSeeFinancials(user)` — Camada 3 RBAC.
2. `assertSaldoSuficiente(input.caixaOrigemId, input.valorCentavos, "Transferência entre caixas")` — já checa `caixaOrigem.ativo === false`.
3. `prisma.$transaction(async (tx) => {...})`:
   - **Re-leitura anti-TOCTOU:** `tx.caixa.findUniqueOrThrow({ where: { id: input.caixaOrigemId }, select: { saldoCentavos: true, ativo: true } })`. Se `ativo === false` ou `saldoCentavos < valorCentavos`, lança 409.
   - **Re-leitura destino:** `tx.caixa.findUniqueOrThrow({ where: { id: input.caixaDestinoId }, select: { ativo: true } })`. Se `ativo === false`, lança 409.
   - **Mutação 1:** `tx.transferenciaCaixa.create({ data: { ..., executadoPorId: user.id, dataHora: input.dataHora } })`.
   - **Mutação 2:** `tx.lancamento.create({ tipo: "SAIDA", categoria: "TRANSFERENCIA", caixaId: input.caixaOrigemId, valorCentavos: input.valorCentavos, dataCompetencia: input.dataHora, descricao: input.descricao || \`Transferência #<transfIdCurto> → caixa destino\` }})`.
   - **Mutação 3:** `tx.lancamento.create({ tipo: "ENTRADA", categoria: "TRANSFERENCIA", caixaId: input.caixaDestinoId, valorCentavos: input.valorCentavos, dataCompetencia: input.dataHora, descricao: input.descricao || \`Transferência #<transfIdCurto> ← caixa origem\` }})`.
   - **Mutação 4:** `tx.caixa.update({ where: { id: input.caixaOrigemId }, data: { saldoCentavos: { decrement: input.valorCentavos } } })`.
   - **Mutação 5:** `tx.caixa.update({ where: { id: input.caixaDestinoId }, data: { saldoCentavos: { increment: input.valorCentavos } } })`.
4. `safeLog({ action: "transferir_caixa", resource: "caixa_origem:<id>->caixa_destino:<id>", userId: user.id, result: "ok" })` — **sem `valorCentavos` no log** (RN-MEM-03 + RAG `lgpd-igreja-conect`).

---

## 9. Testes sugeridos (TDD)

### 9.1 Unit (sem DB)

- `TransferenciaCreateSchema`:
  - Aceita origem ≠ destino, valor > 0, data válida.
  - Rejeita origem = destino (400).
  - Rejeita valor 0 ou negativo.
  - Rejeita `valorCentavos: 50.5` (não int).
  - Aceita descricao opcional vazia.

### 9.2 Integração (com DB, `setupTestDb`)

- Setup: 2 caixas (Geral saldo 10000, Cantina saldo 0).
- `transferirEntreCaixas({ caixaOrigemId: geralId, caixaDestinoId: cantinaId, valorCentavos: 3000 }, adminUser)`:
  - Cria 1 `TransferenciaCaixa` (imutável, `executadoPorId: adminUser.id`).
  - Cria 2 `Lancamento` (SAIDA Geral, ENTRADA Cantina, ambos `categoria: TRANSFERENCIA`).
  - Saldo Geral = 7000. Saldo Cantina = 3000.
- `transferirEntreCaixas({ caixaOrigemId: geralId, caixaDestinoId: cantinaId, valorCentavos: 0 }, adminUser)`:
  - Lança `Response(400)` (Zod valor > 0).
- `transferirEntreCaixas({ caixaOrigemId: geralId, caixaDestinoId: cantinaId, valorCentavos: -100 }, adminUser)`:
  - Lança `Response(400)`.
- `transferirEntreCaixas({ caixaOrigemId: geralId, caixaDestinoId: geralId, valorCentavos: 100 }, adminUser)`:
  - Lança `Response(400)` (Zod origem = destino).
- `transferirEntreCaixas({ caixaOrigemId: geralId, caixaDestinoId: cantinaId, valorCentavos: 20000 }, adminUser)` (saldo 10000):
  - Lança `Response(409, "Saldo insuficiente...")`. Saldos intactos.
- **Atomicidade (rollback):** mock falha no 2º `tx.lancamento.create`. Verifica que:
  - Saldo origem intacto.
  - Saldo destino intacto.
  - 0 `TransferenciaCaixa`.
  - 0 `Lancamento` TRANSFERENCIA.
- `transferirEntreCaixas({ ..., caixaOrigemId: caixaArquivadoId }, adminUser)`:
  - Lança `Response(409, "Caixa de origem arquivado.")`.
- `transferirEntreCaixas({ ..., caixaDestinoId: caixaArquivadoId }, adminUser)`:
  - Lança `Response(409, "Caixa de destino arquivado.")`.
- `transferirEntreCaixas({ ... }, discipuladorUser)`:
  - Lança `Response(403)`.
- `transferirEntreCaixas({ ... }, secretarioUser)`:
  - OK (RN-FIN-03 — autonomia por saldo).

### 9.3 E2E (Playwright) — `e2e/financeiro-transferencia.spec.ts`

- Login `secretario@igreja.local` → `/app/financeiro/transferencias/nova`.
- Preenche: origem=Caixa Geral, destino=Caixa Cantina, valor=100,00.
- Submit → toast: "Transferência de R$ 100,00 do Caixa Geral para Caixa Cantina registrada." + redirect para `/app/financeiro`.
- Volta para `/app/financeiro` → vê Caixa Geral com R$ 900,00 e Caixa Cantina com R$ 100,00.
- **Saldo insuficiente:** tentar transferir R$ 200,00 com saldo R$ 100,00 → 409 inline.
- **Origem = destino:** selecionar mesmo caixa nos 2 selects → submit desabilitado (UX) + Zod rejeita.
- **Bypass DISCIPULADOR:** login `discipulador@igreja.local` → `/app/financeiro/transferencias/nova` → 403.

---

## 10. Critérios de aceite (gate Phase 5)

- [ ] Loader chama `assertCanSeeFinancials` antes de I/O.
- [ ] `transferirEntreCaixas` chama `assertCanSeeFinancials` como PRIMEIRA linha.
- [ ] `assertSaldoSuficiente` chamado **antes** do `$transaction`.
- [ ] **5 mutações em 1 `$transaction`** (verificável via log ou teste).
- [ ] Re-leitura do saldo **dentro** do `$transaction` (anti-TOCTOU).
- [ ] Caixas arquivados (origem OU destino) rejeitam com 409.
- [ ] Origem ≠ destino validado no Zod.
- [ ] Valor > 0 validado no Zod.
- [ ] `executadoPorId = user.id` (não do form).
- [ ] `categoria = TRANSFERENCIA` exclusiva do `transferirEntreCaixas` (verificável via teste estático: `grep` confirma que `criarLancamento` rejeita essa categoria).
- [ ] `safeLog` sem `valorCentavos` ou `descricao` (RN-MEM-03).
- [ ] Cobertura do service ≥ 100% (gate RN-FIN-02/04).
- [ ] 12 testes de borda do brief §7.3 **todos verdes** (este design cobre 3: origem=destino, valor=0, valor negativo).

---

## 11. Acessibilidade

- **`<h1>`** = "Nova Transferência".
- **`<fieldset>`** com `<legend>` para "Caixas e Valor".
- **Labels** associadas via `<label htmlFor>`.
- **InfoBox "saldo insuficiente"** com `role="alert"` quando aparece.
- **Botão "Transferir"** com `aria-busy="true"` durante loading.
- **Tab order** natural.

---

## 12. Mobile

- **Layout vertical** (campos empilhados).
- **Inputs full-width**, `min-h-[44px]`.
- **Botões** full-width, empilhados.

---

## 13. Cross-references

- **PRD:** [Apêndice D §D.3 F4 (Transferências)](./PRD.html#c2-features), §D.4 (3 testes de borda: origem=destino, valor=0, valor negativo).
- **SPEC:** [Apêndice D §D.4 (`POST /app/financeiro/transferencias`)](./SPEC.html#c2-endpoints), §D.3 (5 mutações).
- **AGENTS:** [§"Módulo Financeiro (ciclo 2)" §"Exemplo de service signature"](./agents/AGENTS.md).
- **ARCH:** [§8.3 (Fluxo crítico 2: Transferência), §8.6 (Models), §8.7 (RBAC)](./docs/architecture/ARCH.md).
- **RAGs:**
  - [`.harness/RAG/architecture-financeiro.md`](./.harness/RAG/architecture-financeiro.md) §3.2 (Fluxo Criar Transferência).
  - [`.harness/RAG/pattern-transferencia-caixas.md`](./.harness/RAG/pattern-transferencia-caixas.md) §2.2 (service canônico), §4.3 (teste rollback).
  - [`.harness/RAG/pattern-trava-saldo-service.md`](./.harness/RAG/pattern-trava-saldo-service.md) §2.5 (atomicidade em transferências).
  - [`.harness/RAG/security-rbac-matrix.md`](./.harness/RAG/security-rbac-matrix.md) — RN-FIN-03 (autonomia por saldo).
  - [`.harness/RAG/convention-monetary-values.md`](./.harness/RAG/convention-monetary-values.md) — `parseBRLToCents`.
  - [`.harness/RAG/decision-caixa-soft-delete.md`](./.harness/RAG/decision-caixa-soft-delete.md) — cheque de `ativo` de ambos os caixas.
  - [`.harness/RAG/lgpd-igreja-conect.md`](./.harness/RAG/lgpd-igreja-conect.md) — sem PII em log.
  - [`.harness/RAG/convention-prisma-sqlite.md`](./.harness/RAG/convention-prisma-sqlite.md) §2.6 (`$transaction` workflow).
