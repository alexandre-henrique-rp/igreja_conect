# Lista de Caixas (`/app/financeiro/caixas`) — Frontend Implementation Prompt

## Capability grant

- **Paths de escrita:**
  - `app/routes/app/financeiro.caixas._index.tsx`
  - `app/routes/app/financeiro.caixas.novo.tsx` (formulário — YAGNI separado? se preferir, inline no mesmo arquivo)
  - `app/components/CaixaSearchBar.tsx`
  - `app/components/TabelaCaixas.tsx`
  - `app/components/CardCaixa.tsx`
  - `app/components/BadgeStatus.tsx`
  - `app/components/ModalConfirmar.tsx` (criar se não existir do ciclo 1)
  - `app/lib/caixas.server.ts` (NOVO — `listarCaixas`, `criarCaixa`, `arquivarCaixa`, `reabrirCaixa`)
  - `app/lib/rbac.server.ts` (estender: `assertCanManageCaixa`)
  - `app/lib/schemas/caixas.ts` (NOVO — `CaixaCreateSchema`)
- **Paths de leitura:** PRD, SPEC, AGENTS, ARCH, RAGs ciclo 2, schema.prisma, `app/lib/money.server.ts`, `design/private-financeiro-caixas.DESIGN.md`.
- **Boundary:** NÃO escrever `prisma.*` direto em `loader`/`action`. NÃO mutar `saldoCentavos` via `arquivarCaixa`/`reabrirCaixa` (apenas flip do flag). NÃO criar migration (Fase 5 backend agent gera `Caixa.ativo`).

## Contexto

Página de gerenciamento de caixas do Módulo Financeiro (ciclo 2). Lista caixas ativos (default) ou todos (toggle "Mostrar arquivados"), com busca textual. Ações: criar, arquivar, reabrir (RBAC fina: ADMIN/PASTOR/FINANCEIRO).

- **Design:** [`design/private-financeiro-caixas.DESIGN.md`](./private-financeiro-caixas.DESIGN.md)
- **PRD:** Apêndice D §D.3 (F1), §D.4 (aceitação: SECRETARIO criando caixa → 403; toggle "Mostrar arquivados"; 4 testes de borda de `Caixa.ativo`).
- **SPEC:** Apêndice D §D.4 (4 endpoints: GET, POST, PATCH arquivar, PATCH reabrir).
- **RAGs:**
  - `decision-caixa-soft-delete` (APPROVED 2026-06-14) — fluxo completo.
  - `security-rbac-matrix` — `assertCanManageCaixa` (helper novo).
  - `pattern-3-layer-rbac` — UI / loader / service.
  - `convention-monetary-values` — `formatBRLFromCents`.

## Tarefas

### T1. Criar `app/lib/schemas/caixas.ts`

- **Path:** `app/lib/schemas/caixas.ts`
- **Schemas:**
  - `CaixaCreateSchema = z.object({ nome: z.string().min(2).max(80).regex(/^[\w\sÀ-ÿ-]+$/, "Nome inválido."), }).strict();`
  - `CaixaUpdateSchema = CaixaCreateSchema.partial();` (atualizar só nome, YAGNI no ciclo 2 — não usar).
- **Tipos:** `export type CaixaCreateInput = z.infer<typeof CaixaCreateSchema>;`

### T2. Estender `app/lib/rbac.server.ts` com `assertCanManageCaixa`

- **Path:** `app/lib/rbac.server.ts` (extensão do ciclo 1).
- **Helper novo:**
  ```ts
  /**
   * @description Asserta que o usuário pode criar/arquivar/reabrir caixas (RN-FIN-01).
   * Perfis permitidos: ADMIN, PASTOR, FINANCEIRO.
   * @param {SessionUser} user - Usuário autenticado.
   * @throws {Response} 403 se user.cargo não está na lista permitida.
   * @example
   *   assertCanManageCaixa(adminUser); // ok
   *   assertCanManageCaixa(secretarioUser); // throws 403
   */
  export function assertCanManageCaixa(user: SessionUser): void {
    const allowed: Cargo[] = ["ADMIN", "PASTOR", "FINANCEIRO"];
    if (!user.cargo || !allowed.includes(user.cargo)) {
      throw new Response("Você não tem permissão para criar ou arquivar caixas.", { status: 403 });
    }
  }
  ```
- **JSDoc completo.**

### T3. Criar `app/lib/caixas.server.ts` (NOVO service)

- **Path:** `app/lib/caixas.server.ts`
- **Imports:** `prisma`, `assertCanSeeFinancials`, `assertCanManageCaixa`, `CaixaCreateSchema`, `CaixaCreateInput`, `formatBRLFromCents` (opcional, para logging), `safeLog` (auditoria sem PII).
- **Funções:**

#### T3.1. `listarCaixas(options, user)`
- **Camada 3 RBAC (PRIMEIRO):** `assertCanSeeFinancials(user)`.
- **Lógica:**
  - `where: { ativo: options.apenasAtivos !== false ? true : undefined }` (default true).
  - Se `options.q`: `where.nome = { contains: options.q }` (case-insensitive no SQLite por default).
  - `orderBy: { nome: "asc" }`.
  - `select: { id, nome, saldoCentavos, ativo, createdAt }`.
  - Para cada caixa, computar `lancamentosMes` via `prisma.lancamento.count({ where: { caixaId, dataCompetencia: { gte: firstDayOfMonth } } })`.
  - **Sempre retorna AMBOS arrays** (`ativos` e `arquivados`) para suportar toggle on/off sem refetch:
    - Se `apenasAtivos: true`: `ativos = [...], arquivados = []`.
    - Se `apenasAtivos: false`: `ativos = [...ativos], arquivados = [...arquivados]`.
- **JSDoc completo.**
- **Edge case:** 0 caixas → `ativos: []`, `arquivados: []`.

#### T3.2. `criarCaixa(input, user)`
- **Camada 3 RBAC (PRIMEIRO):** `assertCanManageCaixa(user)`.
- **Validação Zod:** `CaixaCreateSchema.parse(input)`. Se falhar, Zod lança `ZodError` (action captura e retorna 422).
- **I/O:** `prisma.caixa.create({ data: { nome, ativo: true, saldoCentavos: 0 } })`.
- **Captura `P2002` (unique constraint):** lança `Error("Já existe um caixa com este nome.")` ou `BusinessRuleError`. Action converte para 409.
- **`safeLog`:** `safeLog({ action: "create_caixa", resource: "caixa:<id>", result: "ok", userId: user.id })`. **SEM `nome` ou `saldoCentavos` no log** (RAG `lgpd-igreja-conect` §2.5).
- **JSDoc completo.**

#### T3.3. `arquivarCaixa(id, user)`
- **Camada 3 RBAC:** `assertCanManageCaixa(user)`.
- **Validação de existência:** `prisma.caixa.findUnique({ where: { id } })`. Se `null`, lança `Response("Caixa não encontrado.", { status: 404 })`.
- **Idempotência:** se `caixa.ativo === false`, lança `Response("Caixa já está arquivado.", { status: 409 })`. (Ou retorna OK idempotente — decisão: 409 é mais explícito.)
- **I/O:** `prisma.caixa.update({ where: { id }, data: { ativo: false } })`. **NÃO** muta `saldoCentavos`.
- **`safeLog`:** `safeLog({ action: "arquivar_caixa", resource: "caixa:<id>", result: "ok", userId: user.id })`.
- **JSDoc completo.**

#### T3.4. `reabrirCaixa(id, user)`
- **Camada 3 RBAC:** `assertCanManageCaixa(user)`.
- **Validação de existência:** mesmo que `arquivarCaixa`.
- **Idempotência:** se `caixa.ativo === true`, lança `Response("Caixa já está ativo.", { status: 409 })`.
- **I/O:** `prisma.caixa.update({ where: { id }, data: { ativo: true } })`. **NÃO** muta `saldoCentavos`.
- **`safeLog`:** idem `arquivarCaixa` com `action: "reabrir_caixa"`.
- **JSDoc completo.**

### T4. Criar `<CaixaSearchBar>`

- **Path:** `app/components/CaixaSearchBar.tsx`
- **Props:** `defaultQ?: string`, `defaultMostrarArquivados?: boolean`.
- **Estrutura:**
  ```tsx
  <Form method="get" className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
    <Input name="q" placeholder="Buscar caixa por nome..." defaultValue={defaultQ} className="flex-1" />
    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
      <input type="checkbox" name="mostrarArquivados" value="true" defaultChecked={defaultMostrarArquivados} className="h-4 w-4" />
      Mostrar arquivados
    </label>
    <Button type="submit" variant="primary">Filtrar</Button>
    <Button as={Link} to="/app/financeiro/caixas" variant="ghost">Limpar</Button>
  </Form>
  ```

### T5. Criar `<BadgeStatus>`

- **Path:** `app/components/BadgeStatus.tsx`
- **Props:** `ativo: boolean`.
- **Estrutura:**
  ```tsx
  <span className={cn(
    "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
    ativo ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-700"
  )}>
    {ativo ? "Ativo" : "Arquivado"}
  </span>
  ```

### T6. Criar `<TabelaCaixas>`

- **Path:** `app/components/TabelaCaixas.tsx`
- **Props:** `items: CaixaResumo[]`, `podeGerenciar: boolean`, `tipo: "ativos" | "arquivados"`.
- **Estrutura:**
  ```tsx
  <div className="hidden md:block border border-slate-200 rounded-lg overflow-hidden">
    <table className="w-full">
      <caption className="sr-only">Lista de caixas {tipo}</caption>
      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
        <tr>
          <th scope="col" className="px-4 py-2">Nome</th>
          <th scope="col" className="px-4 py-2 text-right">Saldo (R$)</th>
          <th scope="col" className="px-4 py-2 text-center">Lançamentos (mês)</th>
          <th scope="col" className="px-4 py-2">Status</th>
          <th scope="col" className="px-4 py-2 text-right">Ações</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200">
        {items.map(c => (
          <tr key={c.id} className="hover:bg-slate-50">
            <td className="px-4 py-2">
              <Link to={`/app/financeiro/caixas/${c.id}`} className="text-cyan-700 hover:underline font-medium">
                {c.nome}
              </Link>
            </td>
            <td className="px-4 py-2 text-right font-mono tabular-nums" data-testid={`saldo-${c.id}`}>
              {formatBRLFromCents(c.saldoCentavos)}
            </td>
            <td className="px-4 py-2 text-center text-slate-600">{c.lancamentosMes}</td>
            <td className="px-4 py-2"><BadgeStatus ativo={c.ativo} /></td>
            <td className="px-4 py-2 text-right">
              <Link to={`/app/financeiro/caixas/${c.id}`} aria-label={`Ver extrato de ${c.nome}`} className="p-1 inline-block">
                <EyeIcon className="h-4 w-4 text-slate-600" />
              </Link>
              {podeGerenciar && tipo === "ativos" && (
                <button
                  type="button"
                  onClick={() => onArquivar(c.id, c.nome)}
                  aria-label={`Arquivar caixa ${c.nome}`}
                  className="p-1 inline-block ml-1"
                >
                  <ArchiveIcon className="h-4 w-4 text-amber-700" />
                </button>
              )}
              {podeGerenciar && tipo === "arquivados" && (
                <button
                  type="button"
                  onClick={() => onReabrir(c.id, c.nome)}
                  aria-label={`Reabrir caixa ${c.nome}`}
                  className="p-1 inline-block ml-1"
                >
                  <UnlockIcon className="h-4 w-4 text-cyan-700" />
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  ```
- **Nota:** as funções `onArquivar`/`onReabrir` vêm via prop. **Decisão:** passar `onArquivar: (id, nome) => void` e `onReabrir: (id, nome) => void` como props adicionais. O componente de página (loader) gerencia o estado do modal.

### T7. Criar `<CardCaixa>` (mobile)

- **Path:** `app/components/CardCaixa.tsx`
- **Props:** mesmas de `<TabelaCaixas>` + handlers.
- **Estrutura:** similar ao `<CardMembro>` do ciclo 1, mas com campos de CaixaResumo.

### T8. Criar `<ModalConfirmar>` (se não existir do ciclo 1)

- **Path:** `app/components/ModalConfirmar.tsx`
- **Props:** `open: boolean`, `onClose: () => void`, `onConfirm: () => void`, `title: string`, `description: ReactNode`, `confirmLabel?: string`, `variant?: "primary" | "danger"`.
- **Estrutura:**
  ```tsx
  <div role="dialog" aria-modal="true" aria-labelledby="modal-titulo" className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <div className="bg-white rounded-lg p-6 max-w-md w-full">
      <h2 id="modal-titulo" className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 text-sm text-slate-700">{description}</div>
      <div className="mt-6 flex gap-2 justify-end">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant={variant ?? "primary"} onClick={onConfirm} data-testid="modal-confirmar">
          {confirmLabel ?? "Confirmar"}
        </Button>
      </div>
    </div>
  </div>
  ```
- **Comportamento:** `Esc` fecha, click no overlay fecha, foco preso no modal.

### T9. Criar `app/routes/app/financeiro.caixas._index.tsx`

- **Path:** `app/routes/app/financeiro.caixas._index.tsx`
- **Loader:**
  ```ts
  export async function loader({ request, context }: Route.LoaderArgs) {
    const user = context.get(userContext);
    assertCanSeeFinancials(user); // Camada 2

    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() || undefined;
    const apenasAtivos = url.searchParams.get("mostrarArquivados") !== "true";

    const data = await listarCaixas({ apenasAtivos, q }, user); // Camada 3
    return { ...data, user, q, apenasAtivos };
  }
  ```
- **Action:** (gerencia arquivar/reabrir via fetch simulado ou formulário com method override)
  - Mais simples: usar `useFetcher` para chamar `PATCH .../arquivar` (criado em T11 abaixo). Componente de página usa `useFetcher` no botão "Arquivar" (T6).
- **Default export (componente):**
  - `useLoaderData()` para acessar dados.
  - `useState` para modal state.
  - `useFetcher` para chamar action.
  - Renderiza `<CaixaSearchBar>`, `<TabelaCaixas>` (ativos), `<TabelaCaixas>` (arquivados, se toggle on), `<CardCaixa>` mobile, `<ModalConfirmar>` quando state ativo.
- **Página:**
  ```tsx
  export default function CaixasLista({ loaderData }: Route.ComponentProps) {
    const { ativos, arquivados, user, apenasAtivos } = loaderData;
    const [modal, setModal] = useState<{ type: "arquivar" | "reabrir"; id: string; nome: string } | null>(null);
    const fetcher = useFetcher();
    const podeGerenciar = ["ADMIN", "PASTOR", "FINANCEIRO"].includes(user.cargo);

    const handleConfirm = () => {
      if (!modal) return;
      fetcher.submit(null, { method: "patch", action: `/app/financeiro/caixas/${modal.id}/${modal.type}` });
      setModal(null);
    };

    return (
      <ShellAutenticado>
        <PageHeader
          title="Caixas"
          breadcrumb={<Breadcrumb items={[{label:"Financeiro", href:"/app/financeiro"}, {label:"Caixas"}]} />}
          action={
            podeGerenciar && (
              <Button as={Link} to="/app/financeiro/caixas/novo" variant="primary">+ Nova Caixa</Button>
            )
          }
        />

        <CaixaSearchBar defaultQ={loaderData.q} defaultMostrarArquivados={!apenasAtivos} />

        {ativos.length === 0 ? (
          <EmptyState title="Nenhum caixa ativo" description="..." action={podeGerenciar && <Button>+ Nova Caixa</Button>} />
        ) : (
          <>
            <TabelaCaixas
              items={ativos}
              podeGerenciar={podeGerenciar}
              tipo="ativos"
              onArquivar={(id, nome) => setModal({ type: "arquivar", id, nome })}
            />
            <CardCaixa items={ativos} podeGerenciar={podeGerenciar} tipo="ativos" onArquivar={...} />
          </>
        )}

        {!apenasAtivos && arquivados.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Arquivados ({arquivados.length})</h2>
            <TabelaCaixas
              items={arquivados}
              podeGerenciar={podeGerenciar}
              tipo="arquivados"
              onReabrir={(id, nome) => setModal({ type: "reabrir", id, nome })}
            />
          </section>
        )}

        {modal && (
          <ModalConfirmar
            open={!!modal}
            onClose={() => setModal(null)}
            onConfirm={handleConfirm}
            title={modal.type === "arquivar" ? `Arquivar caixa "${modal.nome}"?` : `Reabrir caixa "${modal.nome}"?`}
            description={
              modal.type === "arquivar"
                ? "Movimentações serão bloqueadas; histórico preservado. Esta ação é reversível (Reabrir)."
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

### T10. Criar `app/routes/app/financeiro.caixas.novo.tsx` (formulário)

- **Path:** `app/routes/app/financeiro.caixas.novo.tsx`
- **Loader:** `assertCanManageCaixa(user)` (Camada 2). Retorna `{ user }`.
- **Action:**
  ```ts
  export async function action({ request, context }: Route.ActionArgs) {
    const user = context.get(userContext);
    assertCanManageCaixa(user); // Camada 2

    const form = await request.formData();
    const parsed = CaixaCreateSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors, formError: null, defaultValues: Object.fromEntries(form) };
    }
    try {
      const caixa = await criarCaixa(parsed.data, user);
      return redirect(`/app/financeiro/caixas/${caixa.id}`);
    } catch (e) {
      if (e instanceof Error && e.message.includes("Já existe")) {
        return { formError: "Já existe um caixa com este nome.", fieldErrors: {}, defaultValues: Object.fromEntries(form) };
      }
      throw e;
    }
  }
  ```
- **Componente:** form simples com `<Input name="nome" label="Nome do caixa" required />` + botão "Criar caixa" + link "Cancelar".

### T11. Criar `app/routes/app/financeiro.caixas.$id.{arquivar,reabrir}.tsx` (actions PATCH)

- **Decisão (YAGNI):** ao invés de 2 arquivos separados, criar 1 arquivo `financeiro.caixas.$id.transicao.tsx` que lê `_action` do form data e delega.

- **Path:** `app/routes/app/financeiro.caixas.$id.transicao.tsx`
- **Action:**
  ```ts
  export async function action({ request, params, context }: Route.ActionArgs) {
    const user = context.get(userContext);
    const form = await request.formData();
    const op = form.get("_op"); // "arquivar" | "reabrir"

    if (op === "arquivar") {
      await arquivarCaixa(params.id, user);
    } else if (op === "reabrir") {
      await reabrirCaixa(params.id, user);
    } else {
      throw new Response("Operação inválida.", { status: 400 });
    }
    return redirect("/app/financeiro/caixas");
  }
  ```
- **Loader:** 404 (rota é action-only).
- **Atualizar `useFetcher` em T9:** `fetcher.submit({ _op: modal.type }, { method: "post", action: \`/app/financeiro/caixas/${modal.id}/transicao\` })`.

## Validações e regras

- **Zod:** valida nome (2-80 chars, regex `[\w\sÀ-ÿ-]+`).
- **RBAC:** 3 camadas (loader, service, UI).
- **Soft-delete:** arquivar seta `ativo = false` apenas, NUNCA muta `saldoCentavos`.
- **Idempotência:** tentar arquivar caixa já arquivada → 409.
- **`safeLog`:** `action: "create_caixa" | "arquivar_caixa" | "reabrir_caixa"`, `resource: "caixa:<id>"`, `userId: user.id`, `result: "ok"`. **Sem `nome` ou `saldoCentavos` no log.**

## Testes (TDD)

### T11.1. Unit (sem DB)

- `CaixaCreateSchema`:
  - Aceita `"Caixa Geral"`, `"Cantina"`, `"Missão 2026"`, `"Dízimo da Cantina 2026"`.
  - Rejeita `""`, `"a"`, nome com 81+ chars.
  - Rejeita `nome: "Caixa\"Teste\""` (aspas duplas), `"Caixa@Teste"` (caracteres não permitidos).
- `assertCanManageCaixa`:
  - admin/PASTOR/FINANCEIRO → ok.
  - SECRETARIO/DISCIPULADOR/LIDER_MINISTERIO → 403.

### T11.2. Integração (com DB, `setupTestDb`)

- `listarCaixas({ apenasAtivos: true }, adminUser)`:
  - Retorna apenas caixas ativos (1 seed).
- `criarCaixa({ nome: "Cantina" }, adminUser)`:
  - Cria caixa com `ativo: true, saldoCentavos: 0`.
- `criarCaixa({ nome: "Caixa Geral" }, adminUser)` → erro (P2002).
- `criarCaixa({ nome: "X" }, secretarioUser)` → `Response(403)`.
- `arquivarCaixa(caixaId, adminUser)`:
  - `caixa.ativo === false`, `saldoCentavos` preservado.
- `arquivarCaixa(caixaIdJaArquivado, adminUser)` → `Response(409)`.
- `arquivarCaixa(caixaId, secretarioUser)` → `Response(403)`.
- `reabrirCaixa(caixaId, adminUser)`:
  - `caixa.ativo === true`, `saldoCentavos` preservado.
- `reabrirCaixa(caixaIdAtivo, adminUser)` → `Response(409)`.
- `listarCaixas({ apenasAtivos: false }, adminUser)`:
  - Retorna ativos + arquivados separados.

### T11.3. E2E (Playwright) — `e2e/financeiro-caixas.spec.ts`

- Login `financeiro@igreja.local` → `/app/financeiro/caixas` → vê 1 caixa.
- Click "+ Nova Caixa" → form → preenche "Cantina" → submit → 302 → detalhe.
- Volta para lista → 2 caixas.
- Click "📦 Arquivar" em "Cantina" → modal → confirma → toast.
- Toggle "Mostrar arquivados" → vê "Cantina" em seção separada.
- **Bypass SECRETARIO:** login `secretario@igreja.local` → lista 200, mas **botão "+ Nova Caixa" ausente**; URL direta em `/app/financeiro/caixas/novo` → 403.
- **Bypass DISCIPULADOR:** login `discipulador@igreja.local` → `/app/financeiro/caixas` → 403.

## Critérios de pronto (Definition of Done — gate Phase 5)

- [ ] Cobertura de `caixas.server.ts` ≥ 100% (gate RN-FIN-01).
- [ ] Cobertura global ≥ 85%.
- [ ] 4 testes de borda do `Caixa.ativo` verdes (PRD §D.4 F1):
  - caixa arquivado rejeita criarLancamento → 409 (testado em `lancamentos.server.test.ts`, mas service `caixas.server.ts` exporta o filtro).
  - caixa arquivado rejeita transferência → 409 (testado em `transferencias.server.test.ts`).
  - `listarCaixas` padrão esconde arquivados.
  - `reabrirCaixa` restaura acesso.
- [ ] `pnpm typecheck` passa.
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] Sem `nome` ou `saldoCentavos` em log.
- [ ] JSDoc completo em todos os 4 services.
- [ ] Modal de confirmação com `role="dialog"`, `aria-modal="true"`.

## Armadilhas comuns (RAGs)

- **RAG `lesson-route-service-bypass`:** NUNCA `prisma.*` direto em `loader` ou `action` de `/app/financeiro/caixas/**` — sempre via `caixas.server.ts`.
- **RAG `pattern-3-layer-rbac`:** `assertCanManageCaixa` no service (Camada 3) é **redundante** com o action, mas é a única segurança real.
- **RAG `decision-caixa-soft-delete`:** NUNCA deletar `Caixa` (mesmo com `onDelete: Restrict` falhando em teste). Soft-delete é o caminho.
- **RAG `convention-monetary-values`:** `Int` em centavos; nunca `Float`. `formatBRLFromCents` na UI.
- **RAG `lgpd-igreja-conect` §2.5:** `safeLog` com allowlist; nunca logar `nome` ou `saldoCentavos`.
- **Erro comum:** `arquivarCaixa` mutar `saldoCentavos` para 0 (quebra integridade contábil). **Apenas** flip do flag.
- **Erro comum:** `assertCanManageCaixa` chamar **antes** de `assertCanSeeFinancials` no service. Ordem: `assertCanManageCaixa` PRIMEIRO (é mais restritivo).
- **Erro comum:** `useFetcher` chamar `method: "patch"` em rota que espera POST (YAGNI no ciclo 2 — usar POST com `_op`).

## Próximos passos

- Implementar detalhe do caixa (`/app/financeiro/caixas/:id`) — `private-financeiro-caixas-detalhe.DESIGN.md`.
- Implementar form de novo lançamento — `private-financeiro-lancamento-novo.DESIGN.md`.
- Implementar form de nova transferência — `private-financeiro-transferencia-nova.DESIGN.md`.
- Atualizar aba Fidelidade Financeira — `private-membros-fidelidade-update.DESIGN.md`.
