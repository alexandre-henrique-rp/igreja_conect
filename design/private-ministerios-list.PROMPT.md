# Lista de Ministérios — Frontend Implementation Prompt

## Capability grant

- **Paths de escrita:**
  - `app/routes/app/ministerios._index.tsx`
  - `app/components/CardMinisterio.tsx`
  - `app/components/ModalCriarMinisterio.tsx`
  - `app/components/ModalVincularMembro.tsx`
  - `app/components/RadioGroup.tsx`
  - `app/components/InfoBox.tsx`
  - `app/lib/schemas/ministerios.ts`
  - `app/lib/ministries.server.ts` (service: `listMinisterios`, `createMinisterio`, `updateMinisterio`, `deleteMinisterio`, `addMembro`, `removeMembro`)
- **Paths de leitura:** PRD, SPEC, AGENTS, RAGs, schema, design/PRODUCT.md.
- **Boundary:** não criar config de acolhimento aqui (RN-MEM-05 está em outra tela).

## Contexto

Gestão de ministérios e vinculação de membros. CRUD simples + N:N com membros.

- **Design:** [`design/private-ministerios-list.DESIGN.md`](./private-ministerios-list.DESIGN.md)
- **PRD:** §3.2.4 (ministérios).
- **SPEC:** §6.6 (N:N com membros).
- **RAG `architecture-monolith-modular.md`:** service puro, testável.

## Tarefas

### T1. Criar `app/lib/schemas/ministerios.ts`

- **Path:** `app/lib/schemas/ministerios.ts`
- **Schemas:** `MinisterioCreateSchema`, `MinisterioUpdateSchema`, `VincularMembroSchema`, `DesvincularMembroSchema`.

### T2. Criar `app/lib/ministries.server.ts`

- **Path:** `app/lib/ministries.server.ts`
- **Funções:**
  - `listMinisterios(user): Promise<MinisterioListItem[]>` — inclui `membros: Membro[]` (count) e `primeiros5membros: Membro[]`.
  - `createMinisterio(input, user): Promise<Ministerio>` — valida Zod, valida permissão (ADMIN, PASTOR, SECRETARIO), cria. Captura `P2002` (nome duplicado) → `NomeDuplicadoError`.
  - `updateMinisterio(id, input, user): Promise<Ministerio>` — idem.
  - `deleteMinisterio(id, user): Promise<void>` — verifica permissão, **bloqueia se tem membros** (count > 0) com 409.
  - `addMembroToMinisterio(ministerioId, membroId, user): Promise<void>` — valida, cria `MinisterioMembro`. Captura `P2002` (já vinculado).
  - `removeMembroFromMinisterio(ministerioId, membroId, user): Promise<void>` — deleta.
- **Helpers de permissão:** `canManageMinisterios(user): boolean` — ADMIN, PASTOR, SECRETARIO.
- **JSDoc completo** em todas as funções.

### T3. Criar `<RadioGroup>`

- **Path:** `app/components/RadioGroup.tsx`
- **Props:** `name: string`, `options: { value: string, label: string }[]`, `value?: string`, `defaultValue?: string`, `onChange?: (value) => void`, `legend: string` (para `<fieldset><legend>`).
- **Estrutura:** `<fieldset><legend className="text-sm font-medium text-slate-700 mb-1">{legend}</legend><div className="space-y-1">{options.map(o => <label key={o.value} className="flex items-center gap-2"><input type="radio" name={name} value={o.value} defaultChecked={defaultValue === o.value} onChange={() => onChange?.(o.value)} className="text-cyan-700 focus-visible:ring-2" /><span>{o.label}</span></label>)}</div></fieldset>`.

### T4. Criar `<InfoBox>`

- **Path:** `app/components/InfoBox.tsx`
- **Props:** `title?: string`, `tone?: "info" | "warning"` (default "info"), `children: ReactNode`.
- **Estrutura:** `<div role="note" className={cn("border rounded-md p-3 flex gap-2", tone === "info" ? "bg-cyan-50 border-cyan-200" : "bg-amber-50 border-amber-200")}><InfoIcon className={tone === "info" ? "text-cyan-700" : "text-amber-700"} /><div><h3 className="text-sm font-medium">{title}</h3><p className="text-sm">{children}</p></div></div>`.

### T5. Criar `<ModalCriarMinisterio>`

- **Path:** `app/components/ModalCriarMinisterio.tsx`
- **Props:** `open`, `onClose`, `onCreated?`, `defaultValues?`, `mode: "criar" | "editar"`.
- **Estrutura:** `<Dialog open={open} onClose={onClose} title={mode === "criar" ? "Novo ministério" : "Editar ministério"} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="form-ministerio">{mode === "criar" ? "Criar" : "Salvar"}</Button></>}><Form id="form-ministerio" method="post" className="space-y-3"><input type="hidden" name="intent" value={mode === "criar" ? "create" : "update"} />{defaultValues?.id && <input type="hidden" name="id" value={defaultValues.id} />}<Field label="Nome" name="nome" required defaultValue={defaultValues?.nome} error={fieldErrors?.nome?.[0]} /><Field label="Descrição" name="descricao" defaultValue={defaultValues?.descricao} error={fieldErrors?.descricao?.[0]} hint="Opcional. Até 500 caracteres." /></Form></Dialog>`.

### T6. Criar `<ModalVincularMembro>`

- **Path:** `app/components/ModalVincularMembro.tsx`
- **Props:** `open`, `onClose`, `ministerioId`, `membrosDisponiveis: Membro[]` (todos os que **não** estão neste ministério).
- **Estrutura:** similar ao ModalCriarMinisterio, mas com select de membros + autocomplete opcional.

### T7. Criar `<CardMinisterio>`

- **Path:** `app/components/CardMinisterio.tsx`
- **Props:** `ministerio`, `membros: Membro[]` (5 primeiros), `totalMembros: number`, `canEdit: boolean`, `onAddMembro`, `onRemoveMembro`, `onEdit`, `onDelete`.
- **Estrutura:**
  - Header: nome (h2) + badge "N membros".
  - Lista de membros (até 5) com botão "Desvincular" inline.
  - "+ Adicionar membro" (se canEdit).
  - Footer: "Editar" e "Excluir" (se canEdit).

### T8. Criar `app/routes/app/ministerios._index.tsx`

- **Path:** `app/routes/app/ministerios._index.tsx`
- **Loader:**
  - `listMinisterios(user)`.
  - Retorna `{ ministerios, canEdit }`.
- **Action:**
  - `intent === "create"`: `createMinisterio`.
  - `intent === "update"`: `updateMinisterio`.
  - `intent === "delete"`: `deleteMinisterio`.
  - `intent === "add-membro"`: `addMembroToMinisterio`.
  - `intent === "remove-membro"`: `removeMembroFromMinisterio`.
  - Captura erros de validação e retorna `{ fieldErrors, formError }`.
- **Default export:**
  - `<PageHeader title="Ministérios" action={<Button onClick={() => setModalOpen(true)} variant="primary">+ Novo ministério</Button>} />`.
  - Se `ministerios.length === 0`: empty state.
  - Senão: lista de `<CardMinisterio>`.
  - `<ModalCriarMinisterio open={modalOpen} onClose={...} />` (controlado por `useState`).
  - `<ModalVincularMembro ... />` (similar, controlado por estado separado).

## Validações e regras

- **Zod:** valida nome, descrição.
- **Nome único:** `Ministerio.nome @unique`. Service captura `P2002`.
- **Excluir com membros:** bloqueado.
- **RBAC:** `canManageMinisterios(user)` — ADMIN, PASTOR, SECRETARIO.

## Testes (TDD)

### T8.1. Teste de `createMinisterio` (integration)

- Cria com nome válido.
- Tenta duplicado: lança `NomeDuplicadoError`.

### T8.2. Teste de `deleteMinisterio` com membros

- Cria ministério com 1 membro. `deleteMinisterio` lança erro de domínio.

### T8.3. Teste E2E — `e2e/ministerios.spec.ts`

- ADMIN: "+ Novo ministério" → modal → submit → card aparece.
- Nome duplicado: erro inline.
- SECRETARIO: vê botões de criar/editar.
- DISCIPULADOR: vê cards sem botões de ação.

## Critérios de pronto

- [ ] Cobertura ≥ 85%.
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] `pnpm typecheck` passa.
- [ ] Modais têm foco preso.
- [ ] Excluir com membros bloqueado com mensagem clara.

## Armadilhas comuns (RAGs)

- **RAG `architecture-monolith-modular.md`:** service puro. Nenhuma lógica no componente.
- **AGENTS §"YAGNI":** NÃO criar "categorias de ministério" (louvor, ensino, etc. como enum). **Nome livre** é mais flexível. Categoria é só uma string.
- **Erro comum:** N:N com cascade pode excluir membros ao excluir ministério. Bloquear exclusão se tem membros é mais seguro.
- **Erro comum:** action genérica com `intent` no body — fácil esquecer um caso. Listar todos no comment do JSDoc.
