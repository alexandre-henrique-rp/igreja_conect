# Formulário de Membro (Criar/Editar) — Frontend Implementation Prompt

## Capability grant

- **Paths de escrita:**
  - `app/routes/app/membros.novo.tsx`
  - `app/routes/app/membros.$id.editar.tsx`
  - `app/components/FormMembro.tsx`
  - `app/components/Section.tsx`
  - `app/components/Field.tsx`
  - `app/lib/schemas/membros.ts`
  - `app/lib/members.server.ts` (estender: `createMembro`, `updateMembro`)
- **Paths de leitura:** PRD, SPEC, AGENTS, RAGs, schema, design/PRODUCT.md.
- **Boundary:** não criar campo `cpf`/`rg` em schema (RN-MEM-02).

## Contexto

Formulário de criar/editar membro. **Compartilha componente** entre criar (`/app/membros/novo`) e editar (`/app/membros/:id/editar`).

- **Design:** [`design/private-membros-form.DESIGN.md`](./private-membros-form.DESIGN.md)
- **PRD:** US-MEM-001 (criar visitante).
- **SPEC:** §6.2 (criar), §6.3 (atualizar).
- **RAG `lgpd-igreja-conect.md` §2.1:** sem CPF, sem dados fiscais.

## Tarefas

### T1. Criar `app/lib/schemas/membros.ts`

- **Path:** `app/lib/schemas/membros.ts`
- **Conteúdo:** `MembroCreateSchema`, `MembroUpdateSchema` (partial), tipos `MembroCreateInput`, `MembroUpdateInput` (ver DESIGN §6.1).
- **Refine:** `dataBatismo >= dataConversao`.

### T2. Criar `<Section>`

- **Path:** `app/components/Section.tsx`
- **Props:** `title: string`, `children: ReactNode`.
- **Estrutura:** `<fieldset className="border border-slate-200 rounded-lg p-4 sm:p-6 bg-white space-y-4"><legend className="text-sm font-semibold text-slate-900 px-2">{title}</legend>{children}</fieldset>`.

### T3. Criar `<Field>` (wrapper)

- **Path:** `app/components/Field.tsx`
- **Props:** `label: string`, `name: string`, `type?: "text" | "email" | "date" | "tel"`, `required?: boolean`, `defaultValue?: string`, `placeholder?: string`, `error?: string`, `hint?: string`, `autoComplete?: string`, `inputMode?: "text" | "email" | "tel" | "numeric"`, `maxLength?: number`.
- **Estrutura:** mesma de `<Input>` do PROMPT de login, mas encapsulada com `label` e mensagens de erro.

### T4. Criar `<FormMembro>`

- **Path:** `app/components/FormMembro.tsx`
- **Props:** `defaultValues?: Partial<MembroCreateInput>`, `isEdit: boolean`, `formError?: string`, `fieldErrors?: Record<string, string[] | undefined>`.
- **Estrutura:**
  - `<Form method="post" className="space-y-6" noValidate>`.
  - Se `formError`, `<ErrorAlert message={formError} />`.
  - `<Section title="Identificação">`: nome, tipo.
  - `<Section title="Contato">`: email, telefone.
  - `<Section title="Eclesiástico">`: dataConversao, dataBatismo, profissao, estadoCivil.
  - `<Section title="Endereço">`: cep, logradouro, numero, bairro, cidade, estado.
  - `<div className="flex gap-2 justify-end"><Button as={Link} to={isEdit ? `/app/membros/${defaultValues?.id}` : "/app/membros"} variant="ghost">Cancelar</Button><Button type="submit" variant="primary" loading={navigation.state === "submitting"}>{isEdit ? "Salvar alterações" : "Cadastrar membro"}</Button></div>`.
  - **Máscaras client-side:** telefone `(__) _____-____`, CEP `_____-___`. Implementar com `useState` + regex simples (sem lib externa).
- **State local para máscaras:** `<input value={value} onChange={handleChange} />`. O form submission envia o valor mascarado; service valida.

### T5. Criar `app/lib/members.server.ts` (estender)

- `createMembro(input: MembroCreateInput, user: SessionUser): Promise<Membro>`.
  - Valida Zod.
  - Garante `assertCanWriteMembers(user)`.
  - Detecta se `tipo === "VISITANTE"`: cria alerta em transação (RN-MEM-05).
  - Captura `P2002` do Prisma (email duplicado) e lança erro de domínio `EmailDuplicadoError`.
- `updateMembro(id: string, input: MembroUpdateInput, user: SessionUser): Promise<Membro>`.
  - Valida Zod.
  - `getMembroById(id, user)` antes (escopo).
  - Update parcial.
- **JSDoc completo** em ambos.

### T6. Criar `app/routes/app/membros.novo.tsx`

- **Path:** `app/routes/app/membros.novo.tsx`
- **Loader:** valida `user`; retorna `null`. (Sem dados para pré-carregar.)
- **Action:**
  - Lê formData.
  - `MembroCreateSchema.safeParse(Object.fromEntries(formData))`.
  - Se falhar, retorna `{ fieldErrors, formError: null, defaultValues: formData }` com status 422.
  - Chama `createMembro(input, user)`.
  - Se sucesso, redirect `/app/membros/:id` com toast.
  - Se erro de domínio (email duplicado), retorna 422 com erro no campo.
- **Default export:** `<PageHeader title="Cadastrar novo membro" breadcrumb={<Breadcrumb items={[{label:"Membros", href:"/app/membros"}, {label:"Novo"}]} />} />` + `<FormMembro isEdit={false} ... />`.

### T7. Criar `app/routes/app/membros.$id.editar.tsx`

- **Path:** `app/routes/app/membros.$id.editar.tsx`
- **Loader:**
  - `getMembroById(id, user)`. Se 404 ou 403, throw.
  - Retorna `{ membro }`.
- **Action:**
  - Mesma estrutura do criar, mas chama `updateMembro(id, input, user)`.
- **Default export:** `<PageHeader title={`Editar ${membro.nome}`} breadcrumb={<Breadcrumb items={[{label:"Membros", href:"/app/membros"}, {label: membro.nome, href:`/app/membros/${membro.id}`}, {label:"Editar"}]} />} />` + `<FormMembro isEdit={true} defaultValues={mapMembroToForm(membro)} ... />`.

## Validações e regras

- **Zod:** valida tudo. Erros inline.
- **Email duplicado:** capturado via `P2002`. Mensagem legível.
- **Máscaras client-side:** telefone e CEP. Validação Zod valida formato final.
- **RN-MEM-05:** se `tipo === "VISITANTE"` e config tem responsável, alerta é criado em transação.

## Testes (TDD)

### T7.1. Teste do `MembroCreateSchema` (unit, sem DB)

- Schema aceita input válido.
- Schema rejeita `cpf: "123"` (não está no schema — TS error).
- Schema rejeita email malformado.
- Schema rejeita `dataBatismo < dataConversao`.

### T7.2. Teste do `createMembro` (integration)

- `createMembro({...visitanteInput, tipo: "VISITANTE"}, adminUser)` cria membro + alerta atômico.
- Email duplicado lança `EmailDuplicadoError`.

### T7.3. Teste E2E — `e2e/membros-form.spec.ts`

- Login → `/app/membros/novo` → preenche form → submit → 302 para `/app/membros/:id`.
- Email duplicado: cria 1º membro, depois tenta criar 2º com mesmo email → vê erro inline.
- Editar: clica "Editar" no detalhe → form pré-preenchido → altera nome → submit → toast.
- DISCIPULADOR tenta editar membro de outra célula: 403.

### T7.4. Teste de LGPD

- Grep em `app/lib/schemas/membros.ts`: `rg|cpf|cnpj` → 0 resultados.

## Critérios de pronto

- [ ] Cobertura ≥ 85%.
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] Teste de LGPD passa (gate `lgpd-officer`).
- [ ] Teste de email duplicado passa.
- [ ] Máscaras funcionam em tempo real.
- [ ] Cancelar volta sem salvar.
- [ ] `pnpm typecheck` passa.

## Armadilhas comuns (RAGs)

- **RAG `lgpd-igreja-conect.md` §2.1:** schema **não tem** campo `cpf`/`rg`/`cnpj`. Teste estático grep.
- **RAG `architecture-monolith-modular.md`:** service em `lib/`, schema em `lib/schemas/`, **nunca** em `lib/` direto.
- **AGENTS §"TDD":** `MembroCreateSchema` testado primeiro (sem DB).
- **Erro comum:** máscara de telefone bloquear `backspace`. Permitir apagar livremente.
- **Erro comum:** `dataBatismo` validado como obrigatório. **É opcional** (membro pode não ter batismo).
- **Erro comum:** esquecer de capturar `P2002` e mostrar erro genérico. UX fica ruim — usuário não entende o que aconteceu.
