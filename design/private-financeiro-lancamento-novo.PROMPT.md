# Novo Lançamento (`/app/financeiro/lancamentos/novo`) — Frontend Implementation Prompt

## Capability grant

- **Paths de escrita:**
  - `app/routes/app/financeiro.lancamentos.novo.tsx`
  - `app/components/FormLancamento.tsx`
  - `app/components/MoneyInput.tsx` (criar se não existir)
  - `app/lib/lancamentos.server.ts` (estender: `criarLancamento`)
  - `app/lib/schemas/lancamentos.ts` (criar — pode já ter sido criado em `private-financeiro-caixas-detalhe.PROMPT.md §T1`)
  - `app/lib/caixas.server.ts` (estender: `listarCaixasParaSelect`)
  - `app/lib/members.server.ts` (estender: `listarMembrosParaAutocomplete` — pode já existir)
- **Paths de leitura:** PRD, SPEC, AGENTS, ARCH, RAGs ciclo 2, schema.prisma, `app/lib/money.server.ts`, `app/lib/finance.server.ts` (assertSaldoSuficiente), `app/lib/audit.server.ts`, `design/private-financeiro-lancamento-novo.DESIGN.md`.
- **Boundary:** NÃO escrever `prisma.*` direto em `loader`/`action`. NÃO aceitar `categoria: TRANSFERENCIA` (exclusiva do `transferirEntreCaixas`). NÃO mutar `saldoCentavos` fora de `$transaction`. NÃO logar `valorCentavos` (RAG `lgpd-igreja-conect`).

## Contexto

Formulário de criação de lançamento financeiro (ciclo 2). Suporta 6 das 7 categorias (DIZIMO, OFERTA, CAMPANHA, DESPESA_OPERACIONAL, COMPRA_ESTOQUE, MANUTENCAO; TRANSFERENCIA é exclusiva de `transferirEntreCaixas`). Campo "Membro" condicional à categoria (RN-FIN-05). Trava de saldo (RN-FIN-04) e caixa arquivado (decisão `Caixa.ativo`) bloqueados no service.

- **Design:** [`design/private-financeiro-lancamento-novo.DESIGN.md`](./private-financeiro-lancamento-novo.DESIGN.md)
- **PRD:** Apêndice D §D.3 (F2, F3, F5), §D.4 (métrica macro).
- **SPEC:** Apêndice D §D.4 (`POST /app/financeiro/lancamentos`).
- **RAGs:**
  - `pattern-trava-saldo-service` §4.1 (implementação canônica).
  - `architecture-financeiro` §3.1 (fluxo Criar Dízimo).
  - `convention-monetary-values` (`parseBRLToCents`, `formatBRLFromCents`).
  - `decision-caixa-soft-delete` (caixa arquivado rejeita).
  - `security-rbac-matrix` (`assertCanSeeFinancials`).
  - `lgpd-igreja-conect` (sem PII em log).

## Tarefas

### T1. Criar `app/lib/schemas/lancamentos.ts` (se ainda não existir de `private-financeiro-caixas-detalhe.PROMPT.md`)

- **Schemas:** `LancamentoCreateSchema` + `ExtratoFiltrosSchema` (ver DESIGN §6.1 e `private-financeiro-caixas-detalhe.PROMPT.md §T1`).
- **Tipos:** `LancamentoCreateInput`, `ExtratoFiltros`.
- **JSDoc** em cada schema explicando regras de negócio.

### T2. Estender `app/lib/lancamentos.server.ts` com `criarLancamento`

- **Path:** `app/lib/lancamentos.server.ts` (estender — service já tem `listarPorCaixa` do `private-financeiro-caixas-detalhe.PROMPT.md`).
- **Função:** `criarLancamento(input: LancamentoCreateInput, user: SessionUser): Promise<Lancamento>`.
- **Implementação (canônica — segue `pattern-trava-saldo-service` §4.1):**
  ```ts
  export async function criarLancamento(
    input: LancamentoCreateInput,
    user: SessionUser
  ): Promise<Lancamento> {
    // CAMADA 3 (RBAC) — PRIMEIRO.
    assertCanSeeFinancials(user);

    // Bloqueio explícito de TRANSFERENCIA (exclusiva de transferirEntreCaixas)
    if (input.categoria === "TRANSFERENCIA") {
      throw new Response(
        "Categoria TRANSFERENCIA é exclusiva do sistema de transferências. Use a página /app/financeiro/transferencias/nova.",
        { status: 400 }
      );
    }

    // Validação monetária
    assertNonNegative(input.valorCentavos, "Lançamento");

    // CAMADA 3 (RN-FIN-04) — trava de saldo ANTES do I/O.
    if (input.tipo === "SAIDA") {
      await assertSaldoSuficiente(
        input.caixaId,
        input.valorCentavos,
        `Lançamento de saída (${input.categoria})`
      );
    }

    // Mutação atômica: criar lançamento + atualizar saldo.
    return prisma.$transaction(async (tx) => {
      // Re-leitura anti-TOCTOU (RAG pattern-trava-saldo-service §2.5)
      const caixa = await tx.caixa.findUniqueOrThrow({
        where: { id: input.caixaId },
        select: { ativo: true, saldoCentavos: true },
      });
      if (caixa.ativo === false) {
        throw new Response(
          "Caixa arquivado. Movimentações bloqueadas.",
          { status: 409 }
        );
      }
      if (input.tipo === "SAIDA" && caixa.saldoCentavos < input.valorCentavos) {
        throw new Response(
          `Saldo insuficiente no caixa (validado dentro da transação). Disponível: R$ ${(caixa.saldoCentavos / 100).toFixed(2)}.`,
          { status: 409 }
        );
      }

      const lancamento = await tx.lancamento.create({ data: input });
      await tx.caixa.update({
        where: { id: input.caixaId },
        data: {
          saldoCentavos: input.tipo === "ENTRADA"
            ? { increment: input.valorCentavos }
            : { decrement: input.valorCentavos },
        },
      });

      // safeLog (sem PII, sem valorCentavos)
      safeLog({
        action: "create_lancamento",
        resource: `lancamento:${lancamento.id}`,
        userId: user.id,
        result: "ok",
      });

      return lancamento;
    });
  }
  ```
- **JSDoc completo** (obrigatório): `@description`, `@param`, `@returns`, `@throws`, `@example`.

### T3. Estender `app/lib/caixas.server.ts` com `listarCaixasParaSelect`

- **Path:** `app/lib/caixas.server.ts`
- **Função:** `async function listarCaixasParaSelect(user: SessionUser): Promise<Array<{ id, nome, saldoCentavos, ativo }>>`.
- **Lógica:** chama `listarCaixas({ apenasAtivos: true }, user)` e retorna `ativos` (sem `q`, sem paginação, sem `lancamentosMes`).
- **JSDoc** curto.

### T4. Verificar `app/lib/members.server.ts` tem `listarMembrosParaAutocomplete` (ciclo 1)

- Se já existe: usar. Senão, criar:
  ```ts
  export async function listarMembrosParaAutocomplete(): Promise<Array<{ id, nome }>> {
    return prisma.membro.findMany({
      where: { cargo: { not: null } }, // Apenas membros com cargo (filtra "membro comum" sem acesso)
      orderBy: { nome: "asc" },
      take: 200, // top 200 para autocomplete
      select: { id: true, nome: true },
    });
  }
  ```
- **Nota:** se a lista for > 200, usar typeahead client-side com busca lazy (futuro). 200 é suficiente para 1 igreja.

### T5. Criar `<MoneyInput>`

- **Path:** `app/components/MoneyInput.tsx`
- **Props:** `name: string`, `label: string`, `defaultValue?: string`, `placeholder?: string`, `required?: boolean`, `error?: string`, `hint?: string`, `autoFocus?: boolean`.
- **Estado interno:** `useState<string>` para o valor formatado. `onBlur` formata com `Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })`. Valor enviado: parseBRLToCents (no server, não client).
- **Estrutura:**
  ```tsx
  const formatBRLDisplay = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
  const parseInput = (input: string): string => {
    // Aceita "50,00" e "50.00"; formata como "50,00" no display
    const cleaned = input.replace(/[^\d,.]/g, "").replace(".", ",");
    return cleaned;
  };

  export function MoneyInput({ name, label, defaultValue = "", required, error, hint, autoFocus }: MoneyInputProps) {
    const [value, setValue] = useState(defaultValue);
    return (
      <Field
        label={label + (required ? " *" : "")}
        name={name}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(parseInput(e.target.value))}
        placeholder="0,00"
        required={required}
        error={error}
        hint={hint}
        autoFocus={autoFocus}
        data-testid={`money-input-${name}`}
      />
    );
  }
  ```
- **Importante:** o `<input name="valorBRL">` envia **string** (ex: "50,00"). Service parseBRLToCents converte.

### T6. Criar `<FormLancamento>`

- **Path:** `app/components/FormLancamento.tsx`
- **Props:**
  ```ts
  type FormLancamentoProps = {
    caixas: Array<{ id: string; nome: string; saldoCentavos: number; ativo: boolean }>;
    membros: Array<{ id: string; nome: string }>;
    defaultCaixaId?: string;
    defaultTipo?: "ENTRADA" | "SAIDA";
    defaultCategoria?: "DIZIMO" | "OFERTA" | "CAMPANHA" | "DESPESA_OPERACIONAL" | "COMPRA_ESTOQUE" | "MANUTENCAO";
    defaultValorBRL?: string;
    defaultDataCompetencia?: string; // YYYY-MM-DD
    defaultMembroId?: string;
    defaultDescricao?: string;
    formError?: string;
    fieldErrors?: Record<string, string[] | undefined>;
  };
  ```
- **Estrutura:**
  ```tsx
  export function FormLancamento(props: FormLancamentoProps) {
    const { caixas, membros, defaultCaixaId, defaultTipo = "ENTRADA", defaultCategoria = "DIZIMO", defaultValorBRL = "", defaultDataCompetencia = new Date().toISOString().slice(0, 10), defaultMembroId = "", defaultDescricao = "", formError, fieldErrors } = props;

    const [categoria, setCategoria] = useState<CategoriaLancamento>(defaultCategoria as any);
    const [caixaId, setCaixaId] = useState(defaultCaixaId ?? "");
    const caixaSelecionado = caixas.find(c => c.id === caixaId);
    const categoriaExigeMembro = categoria === "DIZIMO";
    const categoriaAceitaMembroOpcional = categoria === "OFERTA";
    const categoriaEscondeMembro = !categoriaExigeMembro && !categoriaAceitaMembroOpcional;

    return (
      <Form method="post" className="space-y-6" noValidate>
        {formError && <ErrorAlert message={formError} />}

        <Section title="Identificação">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              name="tipo"
              label="Tipo *"
              defaultValue={defaultTipo}
              options={[
                { value: "ENTRADA", label: "Entrada (soma ao caixa)" },
                { value: "SAIDA", label: "Saída (subtrai do caixa, com trava)" },
              ]}
              required
            />
            <Select
              name="categoria"
              label="Categoria *"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as any)}
              options={[
                { value: "DIZIMO", label: "Dízimo" },
                { value: "OFERTA", label: "Oferta" },
                { value: "CAMPANHA", label: "Campanha" },
                { value: "DESPESA_OPERACIONAL", label: "Despesa operacional" },
                { value: "COMPRA_ESTOQUE", label: "Compra de estoque" },
                { value: "MANUTENCAO", label: "Manutenção" },
                // TRANSFERENCIA NÃO APARECE — exclusiva de transferirEntreCaixas
              ]}
              required
            />
          </div>
        </Section>

        <Section title="Valor, Data e Caixa">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MoneyInput name="valorBRL" label="Valor (R$)" required defaultValue={defaultValorBRL} error={fieldErrors?.valorCentavos?.[0]} />
            <Input name="dataCompetencia" type="date" label="Data *" required defaultValue={defaultDataCompetencia} error={fieldErrors?.dataCompetencia?.[0]} />
            <Select
              name="caixaId"
              label="Caixa *"
              value={caixaId}
              onChange={(e) => setCaixaId(e.target.value)}
              options={caixas.map(c => ({ value: c.id, label: `${c.nome} (${formatBRLFromCents(c.saldoCentavos)})` }))}
              required
              error={fieldErrors?.caixaId?.[0]}
            />
          </div>

          {!categoriaEscondeMembro && (
            <Select
              name="membroId"
              label={categoriaExigeMembro ? "Membro *" : "Membro (opcional)"}
              defaultValue={defaultMembroId}
              options={membros.map(m => ({ value: m.id, label: m.nome }))}
              placeholder={categoriaExigeMembro ? "Selecione o membro" : "Deixe vazio para anônimo"}
              required={categoriaExigeMembro}
              error={fieldErrors?.membroId?.[0]}
            />
          )}

          {caixaSelecionado && !caixaSelecionado.ativo && (
            <InfoBox tone="warning" title="Caixa arquivado">
              Este caixa está arquivado. Movimentações serão bloqueadas pelo sistema.
            </InfoBox>
          )}
        </Section>

        <Section title="Descrição">
          <Input
            name="descricao"
            label="Descrição *"
            type="text"
            required
            maxLength={500}
            defaultValue={defaultDescricao}
            error={fieldErrors?.descricao?.[0]}
            placeholder="Ex: Dízimo mensal de Maria da Silva"
          />
        </Section>

        <div className="flex gap-2 justify-end">
          <Button as={Link} to={defaultCaixaId ? `/app/financeiro/caixas/${defaultCaixaId}` : "/app/financeiro"} variant="ghost">
            Cancelar
          </Button>
          <Button type="submit" variant="primary" data-testid="submit-lancamento">
            Registrar lançamento
          </Button>
        </div>
      </Form>
    );
  }
  ```

### T7. Criar `app/routes/app/financeiro.lancamentos.novo.tsx`

- **Path:** `app/routes/app/financeiro.lancamentos.novo.tsx`
- **Loader:**
  ```ts
  export async function loader({ request, context }: Route.LoaderArgs) {
    const user = context.get(userContext);
    assertCanSeeFinancials(user); // Camada 2

    const url = new URL(request.url);
    const defaultCaixaId = url.searchParams.get("caixaId") ?? undefined;

    const [caixas, membros] = await Promise.all([
      listarCaixasParaSelect(user),
      listarMembrosParaAutocomplete(),
    ]);

    return { user, caixas, membros, defaultCaixaId };
  }
  ```
- **Action:**
  ```ts
  export async function action({ request, context }: Route.ActionArgs) {
    const user = context.get(userContext);
    assertCanSeeFinancials(user); // Camada 2

    const form = await request.formData();
    const valorBRL = (form.get("valorBRL") as string) ?? "";
    let valorCentavos: number;
    try {
      valorCentavos = parseBRLToCents(valorBRL);
    } catch (e) {
      return {
        formError: null,
        fieldErrors: { valorCentavos: ["Valor inválido. Use o formato 50,00."] },
        defaultValues: Object.fromEntries(form),
      };
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
      return {
        formError: null,
        fieldErrors: parsed.error.flatten().fieldErrors,
        defaultValues: Object.fromEntries(form),
      };
    }

    try {
      await criarLancamento(parsed.data, user); // Camada 3
      return redirect(`/app/financeiro/caixas/${parsed.data.caixaId}`);
    } catch (e) {
      if (e instanceof Response) {
        const status = e.status;
        const message = await e.text();
        if (status === 409) {
          return { formError: message, fieldErrors: {}, defaultValues: Object.fromEntries(form) };
        }
        if (status === 400) {
          return {
            formError: null,
            fieldErrors: { membroId: [message] },
            defaultValues: Object.fromEntries(form),
          };
        }
      }
      throw e;
    }
  }
  ```
- **Default export:**
  ```tsx
  export default function LancamentoNovo({ loaderData, actionData }: Route.ComponentProps) {
    const { user, caixas, membros, defaultCaixaId } = loaderData;
    const navigation = useNavigation();

    return (
      <ShellAutenticado>
        <PageHeader
          title="Novo Lançamento"
          breadcrumb={
            <Breadcrumb items={[
              {label:"Financeiro", href:"/app/financeiro"},
              {label:"Novo Lançamento"}
            ]} />
          }
        />

        <FormLancamento
          caixas={caixas}
          membros={membros}
          defaultCaixaId={defaultCaixaId}
          formError={actionData?.formError}
          fieldErrors={actionData?.fieldErrors}
        />
      </ShellAutenticado>
    );
  }
  ```

## Validações e regras

- **Zod:** `LancamentoCreateSchema` valida tipo, categoria (não inclui TRANSFERENCIA), valor > 0, data válida, descricao ≥ 1 char, `superRefine` para DIZIMO exige membro.
- **Conversão BRL→cents:** `parseBRLToCents` no action, antes do `safeParse`.
- **Bloqueio TRANSFERENCIA:** service `criarLancamento` rejeita com 400 (Zod aceita a enum, service bloqueia explicitamente).
- **Trava de saldo:** service chama `assertSaldoSuficiente` se `tipo = SAIDA` (helper já checa `caixa.ativo === false`).
- **Atomicidade:** `$transaction` cobre `lancamento.create` + `caixa.update` (re-leitura anti-TOCTOU dentro da transação).
- **`safeLog`:** `action: "create_lancamento"`, `resource: "lancamento:<id>"`, `userId`, `result: "ok"`. **Sem `valorCentavos` ou `membroId` ou `descricao` no log.**

## Testes (TDD)

### T7.1. Unit (sem DB)

- `LancamentoCreateSchema`:
  - Aceita DIZIMO com membroId.
  - Rejeita DIZIMO sem membroId (`membroId` fieldError).
  - Aceita OFERTA sem membroId.
  - Rejeita DESPESA com membroId.
  - Rejeita valor 0 ou negativo.
  - Rejeita `descricao` vazia ou > 500 chars.

### T7.2. Integração (com DB, `setupTestDb`)

- `criarLancamento({ tipo: "ENTRADA", categoria: "DIZIMO", valorCentavos: 5000, caixaId, membroId, descricao: "Dízimo Maria" }, adminUser)`:
  - Cria lançamento.
  - Saldo do caixa += 5000.
- `criarLancamento({ tipo: "ENTRADA", categoria: "DIZIMO", ... sem membroId }, adminUser)`:
  - Lança `Response(400)` (Zod DIZIMO exige membro).
- `criarLancamento({ tipo: "ENTRADA", categoria: "OFERTA", ... sem membroId }, adminUser)`:
  - Cria lançamento (anônimo). Saldo += valor.
- `criarLancamento({ tipo: "ENTRADA", categoria: "TRANSFERENCIA", ... }, adminUser)`:
  - Lança `Response(400, "Categoria TRANSFERENCIA é exclusiva...")`.
- `criarLancamento({ tipo: "ENTRADA", categoria: "DESPESA_OPERACIONAL", membroId: "uuid" }, adminUser)`:
  - Lança `Response(400)` (Zod: DESPESA não aceita membro).
- **Trava de saldo (BLOQUEADOR):**
  - Setup: caixa com `saldoCentavos: 0`.
  - `criarLancamento({ tipo: "SAIDA", categoria: "DESPESA_OPERACIONAL", valorCentavos: 1, caixaId, ... }, adminUser)`:
  - Lança `Response(409, "Saldo insuficiente...")`. Saldo permanece 0.
- **Borda exata:** caixa `saldoCentavos = 1000`. SAIDA de 1000 → OK, saldo = 0.
- **Caixa arquivado:** `criarLancamento({ ..., caixaId: caixaArquivado.id }, adminUser)`:
  - Lança `Response(409, "Caixa arquivado. Movimentações bloqueadas.")`.
- `criarLancamento({ ... }, discipuladorUser)` → lança `Response(403)`.
- `criarLancamento({ ... }, secretarioUser)` → OK (RN-FIN-01 — SECRETARIO pode criar).

### T7.3. E2E (Playwright) — `e2e/financeiro-lancamento-novo.spec.ts`

- **Métrica macro (brief §7.1):**
  1. Login `financeiro@igreja.local`.
  2. Navega para `/app/financeiro/caixas/<caixaGeralId>`.
  3. Click "+ Novo Lançamento".
  4. Preenche: tipo=ENTRADA, categoria=DIZIMO, valor=50,00, membro=Maria.
  5. Submit.
  6. Toast: "Lançamento registrado." + redirect para extrato.
  7. Extrato mostra 1 lançamento (dízimo de Maria, +R$ 50,00).
  8. PASTOR loga em outra sessão, abre `/app/membros/<mariaId>?tab=fidelidade`, vê o dízimo.
  9. **Tudo em < 2 minutos.**
- **DIZIMO sem membro:** submit sem selecionar membro → erro 400 inline no campo.
- **Saldo insuficiente:** tentar SAIDA de R$ 100,00 com saldo R$ 50,00 → erro 409 inline.
- **TRANSFERENCIA:** bypass via DevTools (enviar `categoria=TRANSFERENCIA` no form) → erro 400 inline.
- **Caixa arquivado:** caixa Cantina arquivado. Tentar criar lançamento nele → erro 409 inline.
- **DISCIPULADOR bypass:** login `discipulador@igreja.local` → `/app/financeiro/lancamentos/novo` direto na URL → 403.

## Critérios de pronto (Definition of Done — gate Phase 5)

- [ ] Cobertura de `criarLancamento` ≥ 100% (gate RN-FIN-04/05).
- [ ] Cobertura global ≥ 85%.
- [ ] 12 testes de borda do brief §7.3 **todos verdes** (este design cobre 3):
  - Saldo = 0 + SAIDA 1 centavo → 409.
  - DIZIMO sem membro → 400.
  - OFERTA sem membro → OK.
- [ ] `pnpm typecheck` passa.
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] `safeLog` sem `valorCentavos` ou `membroId`.
- [ ] MoneyInput formata "50,00" → display e converte para `5000` cents no submit.
- [ ] Pré-preenchimento via `?caixaId=<uuid>` funciona.
- [ ] Campo "Membro" aparece/oculta conforme categoria.
- [ ] TRANSFERENCIA rejeitada (Zod permite, service barra).
- [ ] Caixa arquivado rejeita com 409 (helper antecipou).

## Armadilhas comuns (RAGs)

- **RAG `lesson-route-service-bypass`:** NUNCA `prisma.*` direto em `action` ou `loader`. SEMPRE via service.
- **RAG `pattern-3-layer-rbac`:** `assertCanSeeFinancials` no service (Camada 3) é redundante com o action, mas é a única segurança real.
- **RAG `pattern-trava-saldo-service`:** ordem **inegociável** — RBAC → assertSaldoSuficiente → $transaction. Helper `assertSaldoSuficiente` JÁ checa `caixa.ativo === false` (decisão `decision-caixa-soft-delete` §2.4).
- **RAG `convention-monetary-values`:** `parseBRLToCents` no action (form boundary); `formatBRLFromCents` na UI; nunca `Float`. `valorCentavos: Int`.
- **RAG `lgpd-igreja-conect` §2.5:** `safeLog` com allowlist; nunca `valorCentavos`, `membroId`, `descricao` em log.
- **RAG `convention-prisma-sqlite` §7 (commit assíncrono):** em E2E, `page.goto` logo após criarLancamento pode não ver o lançamento. Workaround: `dbSettle(100)` ou `waitForLancamentoInDb(...)`.
- **Erro comum:** `MoneyInput` enviar `Float` em vez de `String`. **SEMPRE** enviar string BRL; converter no server.
- **Erro comum:** `assertSaldoSuficiente` chamado **depois** de `prisma.lancamento.create` (TOCTOU). Ordem: antes.
- **Erro comum:** esquecer de capturar 400 (TRANSFERENCIA) e 409 (saldo/arquivado) no action — UI renderiza 500 genérico.
- **Erro comum:** `categoria: TRANSFERENCIA` aceita no Zod mas service não barra (esquecer o `if` explícito).
- **Erro comum:** SECRETARIO não pode criar dízimo (ciclo 1) — **errado!** SECRETARIO pode (RN-FIN-01); filtro é na leitura (RN-MEM-03).

## Próximos passos

- Implementar form de nova transferência (`/app/financeiro/transferencias/nova`) — `private-financeiro-transferencia-nova.DESIGN.md` (próximo).
- Atualizar aba Fidelidade Financeira — `private-membros-fidelidade-update.DESIGN.md`.
