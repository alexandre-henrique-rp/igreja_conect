# Configurações (Acolhimento) — Frontend Implementation Prompt

## Capability grant

- **Paths de escrita:**
  - `app/routes/app/config.acolhimento.tsx`
  - `app/components/ConfigAcolhimentoCard.tsx`
  - `app/components/FormConfigAcolhimento.tsx`
  - `app/lib/schemas/config.ts`
  - `app/lib/config.server.ts` (service: `getConfigAcolhimento`, `updateConfigAcolhimento`)
- **Paths de leitura:** PRD, SPEC, AGENTS, RAGs, schema.
- **Boundary:** não criar outras telas de config no MVP (Financeiro/Estoque em sprints futuras).

## Contexto

Configura o responsável pelo acolhimento de visitantes (RN-MEM-05). Apenas ADMIN escreve.

- **Design:** [`design/private-config.DESIGN.md`](./private-config.DESIGN.md)
- **PRD:** US-MEM-004.
- **SPEC:** §6.7 (config acolhimento).
- **RAG `security-rbac-matrix.md`:** `assertIsAdmin` no action.

## Tarefas

### T1. Criar `app/lib/schemas/config.ts`

- **Path:** `app/lib/schemas/config.ts`
- **Schemas:** `ConfigAcolhimentoSchema`, `ConfigAcolhimentoInput` (ver DESIGN §6.1).

### T2. Criar `app/lib/config.server.ts`

- **Path:** `app/lib/config.server.ts`
- **Constantes:** `FINANCIAL_CARGOS = ["ADMIN", "PASTOR", "FINANCEIRO"]` (helper).
- **Funções:**
  - `getConfigAcolhimento(): Promise<ConfiguracaoGeral | null>` — `findFirst` (singleton).
  - `updateConfigAcolhimento(input, user): Promise<ConfiguracaoGeral>`:
    - `assertIsAdmin(user)`.
    - Valida Zod.
    - Verifica que o `responsavelId` existe (membro ou ministério).
    - `upsert` (singleton: `where: { id: "singleton" }`).
    - **Lógica exclusiva:** se tipo = "MEMBRO", seta `responsavelMembroId` e zera `responsavelMinisterioId`. Vice-versa.
    - `safeLog({ userId, action: "update_config", result: "ok" })`.
- **JSDoc completo**.

### T3. Criar `<ConfigAcolhimentoCard>` (read-only para não-ADMIN)

- **Path:** `app/components/ConfigAcolhimentoCard.tsx`
- **Props:** `config: ConfiguracaoGeral | null`.
- **Estrutura:**
  - Se `!config`: `<InfoBox tone="warning" title="Nenhum responsável configurado">Quando alguém cadastrar um visitante, nenhum alerta será enviado. Configure um responsável abaixo.</InfoBox>`.
  - Se `config.responsavelVisitanteTipo === "MEMBRO"`: mostra nome do membro (loader traz junto).
  - Se `MINISTERIO`: mostra nome do ministério.

### T4. Criar `<FormConfigAcolhimento>`

- **Path:** `app/components/FormConfigAcolhimento.tsx`
- **Props:** `config: ConfiguracaoGeral | null`, `membros: Membro[]`, `ministerios: Ministerio[]`, `formError?`, `fieldErrors?`.
- **Estado local:** `tipo` (controla qual select mostrar). `useState`.
- **Estrutura:**
  - `<Form method="post" className="space-y-4" noValidate>`.
  - `<RadioGroup name="responsavelVisitanteTipo" legend="Tipo de responsável *" options={[{value:"MEMBRO",label:"Membro"},{value:"MINISTERIO",label:"Ministério"}]} value={tipo} onChange={setTipo} />`.
  - Se `tipo === "MEMBRO"`: `<Select name="responsavelId" options={membros.map(m => ({value:m.id, label:m.nome}))} placeholder="Selecione..." required />`.
  - Se `tipo === "MINISTERIO"`: idem com ministérios.
  - `<Button type="submit" variant="primary">Salvar</Button>`.
- **Submissão:** `<Form>` envia `responsavelVisitanteTipo` e `responsavelId` (o que estiver visível).

### T5. Criar `app/routes/app/config.acolhimento.tsx`

- **Path:** `app/routes/app/config.acolhimento.tsx`
- **Loader:**
  - `getConfigAcolhimento()`.
  - Lista `membros` (apenas com cargo) e `ministerios`.
  - Carrega o nome do responsável atual (loader faz `findUnique` se MEMBRO, ou já tem se MINISTERIO).
  - Retorna `{ config, membros, ministerios, canEdit, responsavelAtualNome }`.
- **Action:**
  - `assertIsAdmin(user)` (helper em rbac.server.ts).
  - `ConfigAcolhimentoSchema.safeParse`.
  - `updateConfigAcolhimento(input, user)`.
  - Redireciona com toast.
- **Default export:**
  - `<PageHeader title="Acolhimento de visitantes" breadcrumb={<Breadcrumb items={[{label:"Configurações"}, {label:"Acolhimento"}]} />} />`.
  - `<ConfigAcolhimentoCard config={config} />`.
  - Se `canEdit`: `<FormConfigAcolhimento config={config} membros={membros} ministerios={ministerios} ... />`.
  - Senão: `<InfoBox>Apenas o Admin pode alterar esta configuração.</InfoBox>`.
  - `<InfoBox title="O que acontece quando um visitante é cadastrado">Um alerta é enviado para o responsável configurado, na Central de Alertas dele.</InfoBox>`.

## Validações e regras

- **Zod:** valida `responsavelVisitanteTipo` e `responsavelId`.
- **Singleton:** upsert com `id: "singleton"` ou `findFirst + create` se null.
- **Exclusividade:** tipo = MEMBRO → `responsavelMembroId`; tipo = MINISTERIO → `responsavelMinisterioId` (o outro fica null).
- **RBAC:** `assertIsAdmin` (helper).
- **safeLog** com `userId, action: "update_config", result`.

## Testes (TDD)

### T5.1. Teste de `updateConfigAcolhimento` (integration)

- ADMIN salva com Membro → persiste `responsavelMembroId`, `responsavelMinisterioId = null`.
- ADMIN salva com Ministério → inverte.
- SECRETARIO tenta: throw 403.
- Membro inválido (não existe): throw 404.

### T5.2. Teste de `getConfigAcolhimento`

- Sem config no DB: retorna null.
- Com config: retorna objeto.

### T5.3. Teste E2E — `e2e/config-acolhimento.spec.ts`

- ADMIN: salvar com Membro → toast sucesso → card reflete.
- ADMIN: trocar para Ministério → ambos limpos/setados.
- SECRETARIO: GET → vê form desabilitado ou só leitura.
- SECRETARIO: POST direto (bypass UI) → 403.

## Critérios de pronto

- [ ] Cobertura ≥ 85%.
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] `pnpm typecheck` passa.
- [ ] `safeLog` sem PII.
- [ ] Após salvar, próximo cadastro de visitante gera alerta para o novo responsável (teste E2E cross-module).

## Armadilhas comuns (RAGs)

- **RAG `security-rbac-matrix.md`:** `assertIsAdmin` é helper canônico. Use-o, não `if (user.cargo !== "ADMIN")`.
- **RAG `lgpd-igreja-conect.md` §2.5:** `safeLog` com allowlist. Sem `membroId` ou `ministerioId` no log.
- **AGENTS §"YAGNI":** NÃO criar "configurações" genéricas (`/app/config`). Apenas acolhimento. Outras configs em sprints futuras têm URLs dedicadas.
- **Erro comum:** esquecer de zerar o campo do tipo oposto. Service deve fazer explicitamente.
- **Erro comum:** upsert sem `id` fixo. Resulta em 2 linhas se rodar 2x. Usar `id: "singleton"` fixo.
- **Erro comum:** carregar TODOS os membros no select. Filtrar para apenas `cargo` não-nulo (perfis administrativos).
