# Detalhe do Caixa (`/app/financeiro/caixas/:id`) — Frontend Implementation Prompt

## Capability grant

- **Paths de escrita:**
  - `app/routes/app/financeiro.caixas.$id.tsx`
  - `app/components/CaixaHeader.tsx`
  - `app/components/ExtratoFiltros.tsx`
  - `app/components/ExtratoCaixa.tsx`
  - `app/components/CardLancamento.tsx`
  - `app/lib/caixas.server.ts` (estender: `getCaixaDetalhe`)
  - `app/lib/lancamentos.server.ts` (NOVO — `listarPorCaixa`)
  - `app/lib/schemas/lancamentos.ts` (NOVO — `ExtratoFiltrosSchema`)
- **Paths de leitura:** PRD, SPEC, AGENTS, ARCH, RAGs ciclo 2, schema.prisma, `app/lib/money.server.ts`, `app/lib/audit.server.ts`, `app/lib/pagination-helpers.ts` (se existir do ciclo 1), `design/private-financeiro-caixas-detalhe.DESIGN.md`.
- **Boundary:** NÃO escrever `prisma.*` direto em `loader`. NÃO permitir edição de `valorCentavos`/`tipo`/`categoria`/`caixaId` (apenas criar + listar). NÃO logar `valorCentavos` (RAG `lgpd-igreja-conect`).

## Contexto

Página de detalhe de caixa do Módulo Financeiro (ciclo 2). Mostra header do caixa (saldo, status, criado, total), extrato paginado de lançamentos com filtros, e ações de gerenciamento (arquivar/reabrir com RBAC fina).

- **Design:** [`design/private-financeiro-caixas-detalhe.DESIGN.md`](./private-financeiro-caixas-detalhe.DESIGN.md)
- **PRD:** Apêndice D §D.3 (F1, F2, F5), §D.4 (aceitação: SECRETARIO vê sem DIZIMO; caixa arquivado rejeita movimentação).
- **SPEC:** Apêndice D §D.4 (`GET /app/financeiro/caixas/:id`).
- **RAGs:**
  - `architecture-financeiro` §4.2 (Lifecycle Lancamento).
  - `pattern-trava-saldo-service` (assertSaldoSuficiente — não muta saldo).
  - `decision-caixa-soft-delete` (soft-delete).
  - `security-rbac-matrix` (`assertCanSeeFinancials`, `assertCanManageCaixa`).
  - `convention-monetary-values` (`formatBRLFromCents`).
  - `lgpd-igreja-conect` (sem PII em log).

## Tarefas

### T1. Criar `app/lib/schemas/lancamentos.ts`

- **Path:** `app/lib/schemas/lancamentos.ts` (NOVO)
- **Schemas:**
  - `ExtratoFiltrosSchema` (já descrito no DESIGN §6.1).
  - `LancamentoCreateSchema` (movido/duplicado do `pattern-trava-saldo-service` §4.1 para cá — vamos definir aqui):
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
      // RN-FIN-05: DIZIMO exige membro; OFERTA permite anônimo; outros = membro null
      if (val.categoria === "DIZIMO" && !val.membroId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Dízimo exige vínculo com membro.", path: ["membroId"] });
      }
      if (val.categoria !== "DIZIMO" && val.categoria !== "OFERTA" && val.membroId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Categoria ${val.categoria} não aceita vínculo com membro.`, path: ["membroId"] });
      }
    });
    ```
- **Tipos:** `export type ExtratoFiltros = z.infer<typeof ExtratoFiltrosSchema>; export type LancamentoCreateInput = z.infer<typeof LancamentoCreateSchema>;`

### T2. Criar `app/lib/lancamentos.server.ts` (NOVO service)

- **Path:** `app/lib/lancamentos.server.ts`
- **Imports:** `prisma`, `assertCanSeeFinancials`, `assertSaldoSuficiente` (de `finance.server.ts`), `assertNonNegative` (de `money.server.ts` ou `finance.server.ts`), `safeLog`, tipos.

#### T2.1. `listarPorCaixa(caixaId, filtros, user)`
- **Camada 3 RBAC (PRIMEIRO):** `assertCanSeeFinancials(user)`.
- **Validação de caixa:** `prisma.caixa.findUnique({ where: { id: caixaId }, select: { id: true } })`. Se `null`, retorna `null` (loader converte para 404).
- **Lógica:**
  - Monta `where` base: `{ caixaId, ...filtrosPeriodo, ...filtrosCategoria }`.
  - **Filtro DIZIMO para SECRETARIO:** se `user.cargo === "SECRETARIO"`, adiciona `categoria: { not: "DIZIMO" }`.
  - Paginação: `skip: (page - 1) * pageSize`, `take: pageSize`.
  - `orderBy: { dataCompetencia: "desc" }` + secundário `{ id: "asc" }` (ordem determinística para transferências).
  - `include: { membro: { select: { id, nome } } }` (para mostrar nome do membro no extrato).
- **Retorno:** `{ caixa, lancamentos, total, page, pageSize }`.
- **JSDoc completo.**

### T3. Estender `app/lib/caixas.server.ts` com `getCaixaDetalhe`

- **Path:** `app/lib/caixas.server.ts` (estender — service já criado em `private-financeiro-caixas.PROMPT.md`)
- **Função:** `getCaixaDetalhe(caixaId, filtros, user)` que internamente chama `listarPorCaixa` (T2.1) + `prisma.caixa.findUnique` + `prisma.lancamento.count` para `totalLancamentos`.
- **Camada 3 RBAC (PRIMEIRO):** `assertCanSeeFinancials(user)`.
- **Retorno:** `{ caixa: CaixaDetalhe, lancamentos: LancamentoExtrato[], total, page, pageSize }` ou `null` se caixa não existe.
- **JSDoc completo.**

### T4. Criar `<CaixaHeader>`

- **Path:** `app/components/CaixaHeader.tsx`
- **Props:** `caixa: CaixaDetalhe`, `podeGerenciar: boolean`.
- **Estrutura:**
  ```tsx
  <section className="bg-white border border-slate-200 rounded-lg p-4 sm:p-6 mb-6">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{caixa.nome}</h2>
        <p className="text-sm text-slate-600 mt-1">Saldo atual: <span className="text-2xl font-bold text-cyan-700 ml-1" data-testid="saldo-atual">{formatBRLFromCents(caixa.saldoCentavos)}</span></p>
        <p className="text-sm text-slate-600 mt-1">Criado em: {formatDate(caixa.createdAt, "dd/MM/yyyy")}</p>
        <p className="text-sm text-slate-600 mt-1">Total de lançamentos: {caixa.totalLancamentos}</p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <BadgeStatus ativo={caixa.ativo} />
        {!caixa.ativo && (
          <InfoBox tone="warning" title="Caixa arquivado">
            Movimentações bloqueadas. Saldo e histórico preservados.
          </InfoBox>
        )}
      </div>
    </div>
  </section>
  ```

### T5. Criar `<ExtratoFiltros>`

- **Path:** `app/components/ExtratoFiltros.tsx`
- **Props:** `defaultPeriodo?: string`, `defaultCategoria?: string`, `caixaId: string` (hidden input).
- **Estrutura:**
  ```tsx
  <Form method="get" className="flex flex-col sm:flex-row gap-2 mb-4">
    <input type="hidden" name="caixaId" value={caixaId} />
    <Select name="periodo" defaultValue={defaultPeriodo ?? ""} options={[
      { value: "", label: "Todos os períodos" },
      { value: "mes_atual", label: "Mês atual" },
      { value: "mes_passado", label: "Mês passado" },
      { value: "ano_atual", label: "Ano atual" },
    ]} placeholder="Período" />
    <Select name="categoria" defaultValue={defaultCategoria ?? ""} options={[
      { value: "", label: "Todas as categorias" },
      { value: "DIZIMO", label: "Dízimo" },
      { value: "OFERTA", label: "Oferta" },
      { value: "CAMPANHA", label: "Campanha" },
      { value: "DESPESA_OPERACIONAL", label: "Despesa operacional" },
      { value: "COMPRA_ESTOQUE", label: "Compra de estoque" },
      { value: "MANUTENCAO", label: "Manutenção" },
      { value: "TRANSFERENCIA", label: "Transferência" },
    ]} placeholder="Categoria" />
    <Button type="submit" variant="primary">Filtrar</Button>
    <Button as={Link} to={`/app/financeiro/caixas/${caixaId}`} variant="ghost">Limpar</Button>
  </Form>
  ```

### T6. Criar `<ExtratoCaixa>`

- **Path:** `app/components/ExtratoCaixa.tsx`
- **Props:** `items: LancamentoExtrato[]`, `podeVerMembro: boolean`.
- **Estrutura:**
  ```tsx
  <div className="hidden md:block border border-slate-200 rounded-lg overflow-hidden">
    <table className="w-full">
      <caption className="sr-only">Extrato do caixa</caption>
      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
        <tr>
          <th scope="col" className="px-4 py-2">Data</th>
          <th scope="col" className="px-4 py-2">Tipo</th>
          <th scope="col" className="px-4 py-2">Categoria</th>
          <th scope="col" className="px-4 py-2 text-right">Valor (R$)</th>
          {podeVerMembro && <th scope="col" className="px-4 py-2">Membro</th>}
          <th scope="col" className="px-4 py-2">Descrição</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200">
        {items.map(l => (
          <tr key={l.id} className="hover:bg-slate-50">
            <td className="px-4 py-2 text-slate-600 text-sm">
              <time dateTime={l.dataCompetencia.toISOString()}>{formatDate(l.dataCompetencia, "dd/MM/yyyy")}</time>
            </td>
            <td className="px-4 py-2">
              <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", l.tipo === "ENTRADA" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                {l.tipo}
              </span>
            </td>
            <td className="px-4 py-2 text-slate-700 text-sm">{l.categoria}</td>
            <td className={cn("px-4 py-2 text-right font-mono tabular-nums", l.tipo === "ENTRADA" ? "text-green-700" : "text-red-700")}>
              {l.tipo === "ENTRADA" ? "+" : "-"} {formatBRLFromCents(l.valorCentavos)}
            </td>
            {podeVerMembro && (
              <td className="px-4 py-2 text-slate-700 text-sm">
                {l.membro ? l.membro.nome : (l.categoria === "OFERTA" ? "(anônima)" : "(membro removido)")}
              </td>
            )}
            <td className="px-4 py-2 text-slate-700 text-sm max-w-xs truncate" title={l.descricao}>
              {l.descricao}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  ```

### T7. Criar `<CardLancamento>` (mobile)

- **Path:** `app/components/CardLancamento.tsx`
- **Props:** mesmas de `<ExtratoCaixa>` items.
- **Estrutura:** card com data, badge tipo, categoria, valor (cor por tipo), descrição, membro (se aplicável).

### T8. Criar `app/routes/app/financeiro.caixas.$id.tsx`

- **Path:** `app/routes/app/financeiro.caixas.$id.tsx`
- **Loader:**
  ```ts
  export async function loader({ request, params, context }: Route.LoaderArgs) {
    const user = context.get(userContext);
    assertCanSeeFinancials(user); // Camada 2

    const url = new URL(request.url);
    const filtros = ExtratoFiltrosSchema.parse({
      ...Object.fromEntries(url.searchParams),
      page: url.searchParams.get("page") ?? 1,
      pageSize: url.searchParams.get("pageSize") ?? 25,
    });

    const data = await getCaixaDetalhe(params.id, filtros, user); // Camada 3
    if (!data) throw new Response("Caixa não encontrado.", { status: 404 });
    return { ...data, user, filtros };
  }
  ```
- **Default export:**
  ```tsx
  export default function CaixaDetalhe({ loaderData }: Route.ComponentProps) {
    const { caixa, lancamentos, total, page, pageSize, user, filtros } = loaderData;
    const totalPages = Math.ceil(total / pageSize);
    const podeGerenciar = ["ADMIN", "PASTOR", "FINANCEIRO"].includes(user.cargo);
    const podeVerMembro = ["ADMIN", "PASTOR", "FINANCEIRO"].includes(user.cargo);
    const [modal, setModal] = useState<{ type: "arquivar" | "reabrir" } | null>(null);
    const fetcher = useFetcher();

    const handleConfirm = () => {
      if (!modal) return;
      fetcher.submit(null, {
        method: "post",
        action: `/app/financeiro/caixas/${caixa.id}/transicao?_op=${modal.type}`,
      });
      setModal(null);
    };

    return (
      <ShellAutenticado>
        <PageHeader
          title={caixa.nome}
          breadcrumb={
            <Breadcrumb items={[
              {label:"Financeiro", href:"/app/financeiro"},
              {label:"Caixas", href:"/app/financeiro/caixas"},
              {label:caixa.nome}
            ]} />
          }
          action={
            caixa.ativo && podeGerenciar && (
              <Button as={Link} to={`/app/financeiro/lancamentos/novo?caixaId=${caixa.id}`} variant="primary">
                + Novo Lançamento
              </Button>
            )
          }
        />

        <CaixaHeader caixa={caixa} podeGerenciar={podeGerenciar} />

        {!caixa.ativo && (
          <InfoBox tone="info" className="mb-4">
            Este caixa está arquivado. Movimentações estão bloqueadas. Saldo e histórico preservados.
          </InfoBox>
        )}

        <ExtratoFiltros
          defaultPeriodo={filtros.periodo}
          defaultCategoria={filtros.categoria}
          caixaId={caixa.id}
        />

        {lancamentos.length === 0 ? (
          <EmptyState
            title="Nenhuma movimentação neste caixa"
            description="Lance o primeiro dízimo, oferta ou despesa para começar."
            action={
              caixa.ativo && (
                <Button as={Link} to={`/app/financeiro/lancamentos/novo?caixaId=${caixa.id}`} variant="primary">
                  + Novo Lançamento
                </Button>
              )
            }
          />
        ) : (
          <>
            <ExtratoCaixa items={lancamentos} podeVerMembro={podeVerMembro} />
            <CardLancamento items={lancamentos} podeVerMembro={podeVerMembro} />
            <Pagination
              current={page}
              total={totalPages}
              basePath={`/app/financeiro/caixas/${caixa.id}`}
              searchParams={new URLSearchParams(filtros as any)}
            />
          </>
        )}

        {podeGerenciar && (
          <section className="mt-8 border-t border-slate-200 pt-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Ações de gerenciamento</h2>
            <div className="flex flex-col sm:flex-row gap-2">
              {caixa.ativo ? (
                <Button variant="danger" onClick={() => setModal({ type: "arquivar" })} data-testid="btn-arquivar">
                  📦 Arquivar caixa
                </Button>
              ) : (
                <Button variant="primary" onClick={() => setModal({ type: "reabrir" })} data-testid="btn-reabrir">
                  🔓 Reabrir caixa
                </Button>
              )}
            </div>
          </section>
        )}

        {modal && (
          <ModalConfirmar
            open={!!modal}
            onClose={() => setModal(null)}
            onConfirm={handleConfirm}
            title={modal.type === "arquivar" ? `Arquivar caixa "${caixa.nome}"?` : `Reabrir caixa "${caixa.nome}"?`}
            description={
              modal.type === "arquivar"
                ? "Movimentações serão bloqueadas. Saldo e histórico preservados. Esta ação é reversível (Reabrir)."
                : "Movimentações serão liberadas. Saldo histórico preservado."
            }
            confirmLabel={modal.type === "arquivar" ? "Arquivar" : "Reabrir"}
            variant={modal.type === "arquivar" ? "danger" : "primary"}
          />
        )}
      </ShellAutenticado>
    );
  }
  ```
- **ErrorBoundary:** 404 se caixa não existe; 403 se user sem permissão.

## Validações e regras

- **Zod:** `ExtratoFiltrosSchema` valida query string.
- **RBAC:** 3 camadas (loader + service + UI).
- **Filtro DIZIMO para SECRETARIO:** service filtra automaticamente.
- **Caixa arquivado:** botões "Lançar"/"Transferir" **ocultos**; extrato é read-only.
- **`safeLog`:** `action: "view_extrato"`, `resource: "caixa:<id>"`, `userId: user.id`. **Sem `valorCentavos` ou `nome` no log.**

## Testes (TDD)

### T8.1. Unit (sem DB)

- `ExtratoFiltrosSchema`:
  - Aceita `{}`, `{ periodo: "mes_atual" }`, `{ categoria: "DIZIMO" }`, `{ page: 2 }`.
  - Rejeita `periodo: "invalido"`, `categoria: "INVALIDA"`, `page: 0`.

### T8.2. Integração (com DB, `setupTestDb`)

- Setup: seed Caixa Geral. Cria 10 lançamentos variados (DIZIMO, OFERTA, DESPESA, TRANSFERENCIA).
- `getCaixaDetalhe(caixaGeralId, {}, adminUser)`:
  - Retorna 10 lançamentos paginados (page 1: 10 itens).
  - Ordem decrescente por `dataCompetencia`.
- `getCaixaDetalhe(caixaGeralId, { categoria: "DIZIMO" }, adminUser)`:
  - Retorna apenas DIZIMO.
- `getCaixaDetalhe(caixaGeralId, { periodo: "mes_atual" }, adminUser)`:
  - Apenas lançamentos do mês corrente.
- `getCaixaDetalhe(caixaGeralId, {}, secretarioUser)`:
  - Lista **não inclui DIZIMO** (apenas OFERTA anônima, DESPESA, TRANSFERENCIA).
- `getCaixaDetalhe(caixaInvalida, {}, adminUser)` → retorna `null` (loader converte para 404).
- `getCaixaDetalhe(caixaGeralId, {}, discipuladorUser)` → lança `Response(403)`.
- Dízimo órfão (membro deletado): `membro: null` no extrato. UI exibe "(membro removido)".
- Caixa arquivado: `caixa.ativo = false`. Extrato **ainda acessível** (read-only).

### T8.3. E2E (Playwright) — `e2e/financeiro-caixa-detalhe.spec.ts`

- Login `financeiro@igreja.local` → `/app/financeiro` → click "Ver extrato" do Caixa Geral → `/app/financeiro/caixas/<id>`.
- Vê header com saldo, badge "Ativo", 0 lançamentos (estado inicial), CTA "+ Novo Lançamento".
- Clica CTA → `/app/financeiro/lancamentos/novo?caixaId=<id>` (pré-preenchido).
- Volta → vê 1 lançamento (dízimo recém-criado).
- Click "📦 Arquivar caixa" → modal → confirma → toast + redirect para lista.
- Volta para o caixa arquivado → vê badge "Arquivado" + aviso + **botões "Lançar"/"Transferir" ocultos** + botão "🔓 Reabrir" visível.
- **SECRETARIO test:** login `secretario@igreja.local` → mesmo caixa → extrato **sem DIZIMO**.
- **DISCIPULADOR bypass:** login `discipulador@igreja.local` → `/app/financeiro/caixas/<id>` → 403.

## Critérios de pronto (Definition of Done — gate Phase 5)

- [ ] Cobertura de `lancamentos.server.ts` ≥ 100% (gate RN-FIN-01/04/05).
- [ ] Cobertura global ≥ 85%.
- [ ] Filtros (período, categoria) funcionam via URL state.
- [ ] Paginação 25/página, preserva filtros.
- [ ] Dízimo órfão (membro deletado) exibe "(membro removido)".
- [ ] Transferência mostra 2 linhas (SAIDA + ENTRADA) na mesma data.
- [ ] SECRETARIO **não** vê DIZIMO no extrato (filtro service).
- [ ] Caixa arquivado: saldo congelado, botões "Lançar"/"Transferir" ocultos, "Reabrir" visível.
- [ ] SECRETARIO **não** vê botões "Arquivar"/"Reabrir" (Camada 1).
- [ ] Modal de confirmação antes de arquivar/reabrir.
- [ ] `pnpm typecheck` passa.
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] Sem PII em log.

## Armadilhas comuns (RAGs)

- **RAG `lesson-route-service-bypass`:** NUNCA `prisma.*` direto em `loader`. SEMPRE via `getCaixaDetalhe`.
- **RAG `pattern-3-layer-rbac`:** `assertCanSeeFinancials` no service (Camada 3) é redundante com loader, mas é a única segurança real.
- **RAG `pattern-trava-saldo-service`:** esta página é read-only, mas caixa arquivado rejeita mutações (Camada 3 service `criarLancamento`).
- **RAG `convention-monetary-values`:** `Int` em centavos; `formatBRLFromCents` na UI.
- **RAG `lgpd-igreja-conect` §2.5:** `safeLog` com allowlist; nunca `valorCentavos` em log.
- **Erro comum:** `loader` busca `prisma.caixa.findUnique` direto (deve ser via `getCaixaDetalhe`).
- **Erro comum:** SECRETARIO vê DIZIMO no extrato (esquecer de filtrar no service).
- **Erro comum:** ordem de transferências é não-determinística (deve ser `dataCompetencia DESC + id ASC`).

## Próximos passos

- Implementar form de novo lançamento (`/app/financeiro/lancamentos/novo`) — `private-financeiro-lancamento-novo.DESIGN.md` (próximo design).
- Implementar form de nova transferência — `private-financeiro-transferencia-nova.DESIGN.md`.
- Atualizar aba Fidelidade Financeira — `private-membros-fidelidade-update.DESIGN.md`.
