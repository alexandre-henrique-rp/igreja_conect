# Nova Transferência (`/app/financeiro/transferencias/nova`) — Frontend Implementation Prompt

## Capability grant

- **Paths de escrita:**
  - `app/routes/app/financeiro.transferencias.novo.tsx`
  - `app/components/FormTransferencia.tsx`
  - `app/lib/transferencias.server.ts` (NOVO — `transferirEntreCaixas`)
  - `app/lib/schemas/transferencias.ts` (NOVO — `TransferenciaCreateSchema`)
  - `app/lib/caixas.server.ts` (estender: `listarCaixasParaSelect` — reusar do `private-financeiro-lancamento-novo.PROMPT.md §T3`)
- **Paths de leitura:** PRD, SPEC, AGENTS, ARCH, RAGs ciclo 2, schema.prisma, `app/lib/money.server.ts`, `app/lib/finance.server.ts` (assertSaldoSuficiente), `app/lib/audit.server.ts`, `design/private-financeiro-transferencia-nova.DESIGN.md`.
- **Boundary:** NÃO escrever `prisma.*` direto em `loader`/`action`. SEMPRE **5 mutações em 1 `$transaction`**. NÃO aceitar `executadoPorId` do form (sempre `user.id`). NÃO logar `valorCentavos` ou `descricao` (RAG `lgpd-igreja-conect`).

## Contexto

Formulário de criação de transferência entre caixas (ciclo 2). Operação atômica: 1 `TransferenciaCaixa` (imutável) + 2 `Lancamento` espelho + 2 `Caixa.update` em 1 `$transaction`. Trava de saldo na origem (RN-FIN-04) + cheque de `ativo` de ambos os caixas (decisão `Caixa.ativo`).

- **Design:** [`design/private-financeiro-transferencia-nova.DESIGN.md`](./private-financeiro-transferencia-nova.DESIGN.md)
- **PRD:** Apêndice D §D.3 (F4), §D.4 (3 testes de borda: origem=destino, valor=0, valor negativo).
- **SPEC:** Apêndice D §D.4 (`POST /app/financeiro/transferencias`).
- **RAGs:**
  - `pattern-transferencia-caixas` §2.2 (service canônico), §4.3 (teste rollback).
  - `pattern-trava-saldo-service` §2.5 (atomicidade).
  - `architecture-financeiro` §3.2 (Fluxo Criar Transferência).
  - `decision-caixa-soft-delete` (caixa arquivado rejeita).
  - `convention-monetary-values` (`parseBRLToCents`).
  - `lgpd-igreja-conect` (sem PII em log).

## Tarefas

### T1. Criar `app/lib/schemas/transferencias.ts`

- **Path:** `app/lib/schemas/transferencias.ts`
- **Schema:** (ver DESIGN §6.1)
  ```ts
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
- **Tipo:** `export type TransferenciaCreateInput = z.infer<typeof TransferenciaCreateSchema>;`

### T2. Criar `app/lib/transferencias.server.ts` (NOVO)

- **Path:** `app/lib/transferencias.server.ts`
- **Imports:** `prisma`, `assertCanSeeFinancials`, `assertSaldoSuficiente`, `safeLog`, tipos.
- **Função `transferirEntreCaixas(input, user)`** — implementação canônica (ver `pattern-transferencia-caixas` §2.2):
  ```ts
  export async function transferirEntreCaixas(
    input: TransferenciaCreateInput,
    user: SessionUser
  ): Promise<TransferenciaCaixa> {
    // CAMADA 3 (RBAC) — PRIMEIRO.
    assertCanSeeFinancials(user);

    // CAMADA 3 (RN-FIN-04) — trava na origem ANTES do I/O.
    // assertSaldoSuficiente JÁ checa caixaOrigem.ativo === false (decisão Caixa.ativo).
    await assertSaldoSuficiente(
      input.caixaOrigemId,
      input.valorCentavos,
      "Transferência entre caixas"
    );

    // Mutação atômica: 5 mutações correlacionadas.
    return prisma.$transaction(async (tx) => {
      // Re-leitura do saldo DENTRO da transação (anti-TOCTOU) + cheque de destino arquivado.
      const origem = await tx.caixa.findUniqueOrThrow({
        where: { id: input.caixaOrigemId },
        select: { saldoCentavos: true, ativo: true },
      });
      if (origem.ativo === false) {
        throw new Response("Caixa de origem está arquivado. Transferência bloqueada.", { status: 409 });
      }
      if (origem.saldoCentavos < input.valorCentavos) {
        throw new Response(
          `Saldo insuficiente no caixa de origem (validado dentro da transação). Disponível: R$ ${(origem.saldoCentavos / 100).toFixed(2)}.`,
          { status: 409 }
        );
      }

      const destino = await tx.caixa.findUniqueOrThrow({
        where: { id: input.caixaDestinoId },
        select: { ativo: true },
      });
      if (destino.ativo === false) {
        throw new Response("Caixa de destino está arquivado. Transferência bloqueada.", { status: 409 });
      }

      // 1) Registro imutável (auditoria + carimbo do operador)
      const transf = await tx.transferenciaCaixa.create({
        data: {
          caixaOrigemId: input.caixaOrigemId,
          caixaDestinoId: input.caixaDestinoId,
          valorCentavos: input.valorCentavos,
          executadoPorId: user.id, // SEMPRE do user, NUNCA do form
          dataHora: input.dataHora,
        },
      });

      // 2) Lançamento espelho SAIDA na origem
      await tx.lancamento.create({
        data: {
          tipo: "SAIDA",
          categoria: "TRANSFERENCIA",
          valorCentavos: input.valorCentavos,
          caixaId: input.caixaOrigemId,
          dataCompetencia: input.dataHora,
          descricao: input.descricao || `Transferência #${transf.id.slice(0, 8)} → caixa destino`,
          membroId: null,
        },
      });

      // 3) Lançamento espelho ENTRADA no destino
      await tx.lancamento.create({
        data: {
          tipo: "ENTRADA",
          categoria: "TRANSFERENCIA",
          valorCentavos: input.valorCentavos,
          caixaId: input.caixaDestinoId,
          dataCompetencia: input.dataHora,
          descricao: input.descricao || `Transferência #${transf.id.slice(0, 8)} ← caixa origem`,
          membroId: null,
        },
      });

      // 4) Decremento origem
      await tx.caixa.update({
        where: { id: input.caixaOrigemId },
        data: { saldoCentavos: { decrement: input.valorCentavos } },
      });

      // 5) Incremento destino
      await tx.caixa.update({
        where: { id: input.caixaDestinoId },
        data: { saldoCentavos: { increment: input.valorCentavos } },
      });

      // safeLog (sem PII, sem valorCentavos, sem descricao)
      safeLog({
        action: "transferir_caixa",
        resource: `transferencia:${transf.id}`,
        userId: user.id,
        result: "ok",
      });

      return transf;
    });
  }
  ```
- **JSDoc completo** (obrigatório).

### T3. Criar `<FormTransferencia>`

- **Path:** `app/components/FormTransferencia.tsx`
- **Props:**
  ```ts
  type FormTransferenciaProps = {
    caixas: Array<{ id: string; nome: string; saldoCentavos: number; ativo: boolean }>;
    defaultCaixaOrigemId?: string;
    formError?: string;
    fieldErrors?: Record<string, string[] | undefined>;
  };
  ```
- **Estado interno:** `useState` para `caixaOrigemId`, `caixaDestinoId`, `valorDisplay` (string BRL). Computed: `saldoOrigem`, `saldoInsuficiente`, `origemIgualDestino`.
- **Estrutura:**
  ```tsx
  export function FormTransferencia(props: FormTransferenciaProps) {
    const { caixas, defaultCaixaOrigemId, formError, fieldErrors } = props;
    const [caixaOrigemId, setCaixaOrigemId] = useState(defaultCaixaOrigemId ?? "");
    const [caixaDestinoId, setCaixaDestinoId] = useState("");
    const [valorDisplay, setValorDisplay] = useState("");

    const caixaOrigem = caixas.find(c => c.id === caixaOrigemId);
    const caixaDestino = caixas.find(c => c.id === caixaDestinoId);
    const saldoOrigem = caixaOrigem?.saldoCentavos ?? 0;
    const valorCentavos = safeParseBRLToCents(valorDisplay);
    const saldoInsuficiente = valorCentavos > saldoOrigem;
    const origemIgualDestino = caixaOrigemId !== "" && caixaOrigemId === caixaDestinoId;

    const submitDisabled = !caixaOrigemId || !caixaDestinoId || !valorCentavos || valorCentavos <= 0 || saldoInsuficiente || origemIgualDestino;

    return (
      <Form method="post" className="space-y-6" noValidate>
        {formError && <ErrorAlert message={formError} />}

        <Section title="Caixas e Valor">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              name="caixaOrigemId"
              label="Caixa de Origem *"
              value={caixaOrigemId}
              onChange={(e) => setCaixaOrigemId(e.target.value)}
              options={caixas.map(c => ({ value: c.id, label: `${c.nome} (${formatBRLFromCents(c.saldoCentavos)})` }))}
              required
              error={fieldErrors?.caixaOrigemId?.[0]}
            />
            <Select
              name="caixaDestinoId"
              label="Caixa de Destino *"
              value={caixaDestinoId}
              onChange={(e) => setCaixaDestinoId(e.target.value)}
              options={caixas.filter(c => c.id !== caixaOrigemId).map(c => ({ value: c.id, label: `${c.nome} (${formatBRLFromCents(c.saldoCentavos)})` }))}
              required
              error={fieldErrors?.caixaDestinoId?.[0]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MoneyInput name="valorBRL" label="Valor (R$)" required value={valorDisplay} onChange={setValorDisplay} error={fieldErrors?.valorCentavos?.[0]} />
            <Input name="dataHora" type="datetime-local" label="Data/Hora" defaultValue={new Date().toISOString().slice(0, 16)} />
          </div>

          <Input name="descricao" type="text" label="Descrição (opcional)" maxLength={500} placeholder="Ex: Transferência para Cantina (Páscoa 2026)" />

          {saldoInsuficiente && caixaOrigem && (
            <InfoBox tone="warning" title="Saldo insuficiente">
              Saldo disponível no {caixaOrigem.nome}: R$ {(saldoOrigem / 100).toFixed(2)}. Necessário: R$ {(valorCentavos / 100).toFixed(2)}.
            </InfoBox>
          )}

          {origemIgualDestino && (
            <InfoBox tone="warning" title="Caixas iguais">
              Origem e destino devem ser caixas diferentes.
            </InfoBox>
          )}

          {caixaOrigem && !caixaOrigem.ativo && (
            <InfoBox tone="warning" title="Caixa de origem arquivado">
              Este caixa está arquivado. Transferências serão bloqueadas.
            </InfoBox>
          )}

          {caixaDestino && !caixaDestino.ativo && (
            <InfoBox tone="warning" title="Caixa de destino arquivado">
              Este caixa está arquivado. Transferências serão bloqueadas.
            </InfoBox>
          )}
        </Section>

        <InfoBox tone="info" title="Operação atômica">
          Esta transferência é registrada como 1 registro imutável + 2 lançamentos espelho (SAIDA origem + ENTRADA destino) em uma única transação atômica. Em caso de falha, todas as alterações são revertidas.
        </InfoBox>

        <div className="flex gap-2 justify-end">
          <Button as={Link} to="/app/financeiro" variant="ghost">Cancelar</Button>
          <Button type="submit" variant="primary" disabled={submitDisabled} data-testid="submit-transferencia">
            {valorCentavos > 0 ? `Transferir ${formatBRLFromCents(valorCentavos)}` : "Transferir"}
          </Button>
        </div>
      </Form>
    );
  }
  ```

**Helper `safeParseBRLToCents`** (client-side preview, não authoritative):

```ts
function safeParseBRLToCents(input: string): number {
  if (!input) return 0;
  const cleaned = input.replace(/[^\d,]/g, "").replace(",", ".");
  const reais = parseFloat(cleaned);
  if (isNaN(reais) || reais <= 0) return 0;
  return Math.round(reais * 100);
}
```

### T4. Criar `app/routes/app/financeiro.transferencias.novo.tsx`

- **Path:** `app/routes/app/financeiro.transferencias.novo.tsx`
- **Loader:**
  ```ts
  export async function loader({ request, context }: Route.LoaderArgs) {
    const user = context.get(userContext);
    assertCanSeeFinancials(user);

    const url = new URL(request.url);
    const defaultCaixaOrigemId = url.searchParams.get("caixaOrigemId") ?? undefined;

    const caixas = await listarCaixasParaSelect(user);
    return { user, caixas, defaultCaixaOrigemId };
  }
  ```
- **Action:**
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
      return { formError: null, fieldErrors: { valorCentavos: ["Valor inválido. Use o formato 50,00."] }, defaultValues: Object.fromEntries(form) };
    }

    const rawInput = {
      caixaOrigemId: form.get("caixaOrigemId"),
      caixaDestinoId: form.get("caixaDestinoId"),
      valorCentavos,
      dataHora: form.get("dataHora") || new Date().toISOString(),
      descricao: (form.get("descricao") as string) ?? "",
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
- **Default export:**
  ```tsx
  export default function TransferenciaNova({ loaderData, actionData }: Route.ComponentProps) {
    const { user, caixas, defaultCaixaOrigemId } = loaderData;

    return (
      <ShellAutenticado>
        <PageHeader
          title="Nova Transferência"
          breadcrumb={
            <Breadcrumb items={[
              {label:"Financeiro", href:"/app/financeiro"},
              {label:"Nova Transferência"}
            ]} />
          }
        />

        <FormTransferencia
          caixas={caixas}
          defaultCaixaOrigemId={defaultCaixaOrigemId}
          formError={actionData?.formError}
          fieldErrors={actionData?.fieldErrors}
        />
      </ShellAutenticado>
    );
  }
  ```

## Validações e regras

- **Zod:** `TransferenciaCreateSchema` valida origem ≠ destino, valor > 0, data válida, descricao ≤ 500.
- **Conversão BRL→cents:** `parseBRLToCents` no action.
- **Trava de saldo:** `assertSaldoSuficiente(caixaOrigemId, ...)` antes da transação + re-leitura dentro (anti-TOCTOU).
- **Caixa arquivado:** service barra (origem E destino).
- **Atomicidade:** 5 mutações em 1 `$transaction` (`transferenciaCaixa.create` + 2 `lancamento.create` + 2 `caixa.update`).
- **`executadoPorId = user.id`:** NUNCA do form.
- **`safeLog`:** `action: "transferir_caixa"`, `resource: "transferencia:<id>"`, `userId`, `result: "ok"`. **Sem `valorCentavos` ou `descricao`.**

## Testes (TDD)

### T4.1. Unit (sem DB)

- `TransferenciaCreateSchema`:
  - Aceita origem ≠ destino, valor > 0, data válida.
  - Rejeita origem = destino (`caixaDestinoId` fieldError).
  - Rejeita valor 0 ou negativo.
  - Rejeita `valorCentavos: 50.5` (não int).

### T4.2. Integração (com DB, `setupTestDb`)

- Setup: Geral saldo 10000, Cantina saldo 0. Cria Membro adminUser.
- `transferirEntreCaixas({ caixaOrigemId: geralId, caixaDestinoId: cantinaId, valorCentavos: 3000 }, adminUser)`:
  - 1 `TransferenciaCaixa` criada (`executadoPorId: adminUser.id`).
  - 2 `Lancamento` criados (SAIDA Geral, ENTRADA Cantina, `categoria: TRANSFERENCIA`, `membroId: null`).
  - Saldo Geral = 7000. Saldo Cantina = 3000.
- `transferirEntreCaixas({ ..., valorCentavos: 0 }, adminUser)`:
  - Lança `Response(400)`.
- `transferirEntreCaixas({ ..., valorCentavos: -100 }, adminUser)`:
  - Lança `Response(400)`.
- `transferirEntreCaixas({ ..., caixaOrigemId: geralId, caixaDestinoId: geralId }, adminUser)`:
  - Lança `Response(400)` (Zod).
- `transferirEntreCaixas({ ..., valorCentavos: 20000 }, adminUser)`:
  - Lança `Response(409, "Saldo insuficiente...")`. Saldos intactos.
- **Atomicidade (rollback):** mock `tx.lancamento.create` para falhar na 2ª chamada. Verifica:
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

### T4.3. E2E (Playwright) — `e2e/financeiro-transferencia.spec.ts`

- Login `secretario@igreja.local` → `/app/financeiro/transferencias/nova`.
- Origem=Caixa Geral, destino=Caixa Cantina, valor=100,00.
- Submit → toast: "Transferência de R$ 100,00..." + redirect `/app/financeiro`.
- Volta para dashboard → Geral R$ 900,00, Cantina R$ 100,00.
- Tenta transferir R$ 200,00 com saldo R$ 100,00 → 409 inline.
- Seleciona mesma caixa nos 2 selects → submit desabilitado (UX) + Zod rejeita.
- **Bypass DISCIPULADOR:** login `discipulador@igreja.local` → `/app/financeiro/transferencias/nova` → 403.

## Critérios de pronto (Definition of Done — gate Phase 5)

- [ ] Cobertura de `transferencias.server.ts` ≥ 100% (gate RN-FIN-02/04).
- [ ] Cobertura global ≥ 85%.
- [ ] 12 testes de borda do brief §7.3 **todos verdes** (este design cobre 3: origem=destino, valor=0, valor negativo).
- [ ] 5 mutações em 1 `$transaction` (verificável via teste de atomicidade).
- [ ] `executadoPorId = user.id` (não do form).
- [ ] `categoria: TRANSFERENCIA` exclusiva (teste estático `grep` confirma).
- [ ] `pnpm typecheck` passa.
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] Sem PII em log.

## Armadilhas comuns (RAGs)

- **RAG `lesson-route-service-bypass`:** NUNCA `prisma.*` direto em `action` ou `loader`. SEMPRE via service.
- **RAG `pattern-3-layer-rbac`:** `assertCanSeeFinancials` no service (Camada 3) é redundante com action, mas é a única segurança real.
- **RAG `pattern-transferencia-caixas`:** 5 mutações em 1 `$transaction` é **inegociável**. Sem atomicidade, sistema fica inconsistente.
- **RAG `pattern-trava-saldo-service`:** ordem inegociável: `assertSaldoSuficiente` antes + re-leitura DENTRO da transação. Helper já checa `caixaOrigem.ativo === false`.
- **RAG `convention-monetary-values`:** `parseBRLToCents` no action. `valorCentavos: Int`. Nunca `Float`.
- **RAG `decision-caixa-soft-delete`:** cheque de `ativo` de AMBOS os caixas (origem E destino).
- **RAG `lgpd-igreja-conect` §2.5:** `safeLog` com allowlist. Nunca `valorCentavos` ou `descricao` em log.
- **RAG `convention-prisma-sqlite` §2.6:** `$transaction` workflow.
- **RAG `lesson-prisma-7-commit-settle-e2e`:** em E2E, `page.goto` após transferência pode não ver os lançamentos espelho. Workaround: `dbSettle(100)` ou `waitForLancamentoInDb`.
- **Erro comum:** `executadoPorId` recebendo valor de form (bypass trivial via DevTools). **SEMPRE `user.id`**.
- **Erro comum:** `criarLancamento` aceita `categoria: TRANSFERENCIA` (transfere via form). **Barre** com 400 explícito.
- **Erro comum:** ordem de transferências é não-determinística (origem antes ou depois de destino). O par SAIDA+ENTRADA tem o mesmo `dataCompetencia`, mas a ordem na tabela é por `id ASC` (Prisma default). OK para o extrato.
- **Erro comum:** Atomicidade via `try/catch` + rollback manual. **SEMPRE `$transaction`**.

## Próximos passos

- Atualizar aba Fidelidade Financeira (`/app/membros/:id?tab=fidelidade`) — `private-membros-fidelidade-update.DESIGN.md` (último design).
- (Futuro) Implementar listagem de transferências (`/app/financeiro/transferencias`) — backlog ciclo 3+.
