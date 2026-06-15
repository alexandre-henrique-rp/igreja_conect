# AGENTS.md — Igreja Conect

> **Memória de longo prazo do projeto para agentes LLM (Harness v6).**
> Lido no início de **toda** task. Se você é um agente entrando no projeto, leia este arquivo inteiro antes de tocar em qualquer código.
>
> **Última atualização:** 2026-06-14 (Fase 1, ciclo 2 — Módulo Financeiro)
> **Mantido por:** `documenter` agent (Fase 1 do Harness v6)
>
> **Localização:** este arquivo está em `agents/AGENTS.md` (não na raiz) por restrição do `path-boundary.ts` do projeto (allowlist não inclui `AGENTS.md` na raiz). Convenção universal é raiz, mas o hook bloqueia. Se o allowlist for ampliado, mover para a raiz e atualizar este cabeçalho.
>
> **Estado do ciclo:** ciclo 1 (MVP — Auth + Membros + Discipulado + Alertas + Acolhimento) **FECHADO** em 2026-06-13. Ciclo 2 (Módulo Financeiro) em **Fase 1 — Documentação** (2026-06-14).

---

## TL;DR

O **Igreja Conect** é um sistema web SSR para gestão eclesiástica local.

- **Ciclo 1 (FECHADO, 2026-06-13):** Auth + Membros + Discipulado + Alertas + Acolhimento. **872 unit + 28 E2E + 5 smoke** passando. Line coverage **88.21%**. `gate: all-of passed`.
- **Ciclo 2 (EM ANDAMENTO, 2026-06-14+):** **Módulo Financeiro** (Caixas + Lançamentos + Dízimos + Ofertas + Transferências + Trava de Saldo + Fidelidade Financeira). 5 RNs já documentadas (`RN-FIN-01` a `05`); schema Prisma já tem 3 models (`Caixa`, `TransferenciaCaixa`, `Lancamento`); serviços e UI a serem implementados em S06+.

**Stack (imutável entre ciclos):** React Router 7.17 (SSR) + Vite 8 + Tailwind 4 + Prisma 7.8 (SQLite via `better-sqlite3`) + TypeScript 5.9 strict + Zod 4 + bcryptjs. Auth por **session cookie httpOnly + bcrypt cost 10**. RBAC com **6 perfis** e **defense in depth em 3 camadas** (UI `<Can>` + loader `assertCan*` + service `assertCan*`). **LGPD estrito**: sem CPF/RG/CNPJ; aba de dízimos bloqueada nas 3 camadas.

**RAGs críticos (ler antes de qualquer feature):** `security-rbac-matrix` + `convention-monetary-values` (RBAC + dinheiro). Para o **Módulo Financeiro especificamente**, ler também: `pattern-trava-saldo-service` (critical) + `pattern-transferencia-caixas` (high) + `architecture-financeiro` (high) + `decision-caixa-soft-delete` (pending).

---

## CRITICAL gotchas (leia antes de qualquer coisa)

### ⚠️ `pnpm dev` está QUEBRADO — use `pnpm build && pnpm start`

**Não tente iterar via `pnpm dev`.** Combinação Prisma 7.8 (WASM QueryCompiler) + Vite 8 SSR fecha o `ModuleRunner` antes da primeira query. Sintoma: `Vite module runner has been closed` em qualquer `prisma.*`. Ver `.harness/RAG/lesson-prisma-7-vite-8-ssr-incompat.md`.

```bash
pnpm build      # build/client + build/server
pnpm start      # react-router-serve ./build/server/index.js → porta 3000
```

Vitest e Playwright funcionam porque instanciam Prisma sob demanda, fora do Vite SSR runner.

### ⚠️ `SESSION_SECRET` ≥ 16 chars em QUALQUER ambiente (fail-fast)

`app/lib/session.server.ts:30-38` lança no boot se a env var estiver ausente ou com menos de 16 chars. Já existe `.env.development` commitado com valor de dev; **em prod, injetar via secret manager** (não commitar). `.env` (com `DATABASE_URL`) é gitignored mas presente localmente.

### ⚠️ Rotas autenticadas vivem em `app/routes/app/`, **NÃO** em `app/routes/private/`

`app/routes/private/` está **VAZIO** (artefato de uma decisão antiga). Layout real:

| Path | Conteúdo |
|---|---|
| `app/routes/public/` | Landing + login (sem auth) |
| `app/routes/app/_middleware.tsx` | Auth gate para `/app/**`; seta `userContext` |
| `app/routes/app/*.tsx` | Todas as páginas autenticadas (membros, ministerios, alertas, config/acolhimento, dashboard) |
| `app/routes/logout.tsx` | Action de logout (top-level) |
| `app/routes.ts` | **Config declarativa** de rotas (editar aqui, não via convenção de arquivo) |

Middleware redireciona anônimos para `/login?next=<encoded-url>`.

### ⚠️ Prisma client sai em `generated/prisma/`, não em `node_modules/`

`prisma/schema.prisma:8` define `output = "../generated/prisma"`. Diretório é gitignored e recriado por `prisma generate`. Singleton em `app/db/prisma.server.ts` (note o subdiretório `db/`) importa via caminho relativo:

```ts
import { PrismaClient } from "../../generated/prisma/client";
```

Em código novo, prefira `import { prisma } from "~/db/prisma.server"` (encapsula cache + reconexão por URL).

### ⚠️ Testes que tocam DB DEVEM chamar `setupTestDb(name)` em `beforeAll`

`tests/helpers/db.ts` cria um arquivo SQLite isolado por `name`, roda `prisma migrate deploy`, e reseta o singleton. **Sem isso**, testes colidem no `dev.db` e falham randomicamente com "table does not exist". Padrão canônico: `app/lib/members.server.test.ts`. Vitest roda com `fileParallelism: false` (recursos compartilhados).

---

## Stack (versões fixadas — não atualize major sem aprovação)

| Camada | Tecnologia | Versão | Onde verificar |
|---|---|---|---|
| Framework web | React Router (SSR) | 7.17.0 | `package.json` → `react-router` |
| Bundler | Vite | 8.0.16 | `package.json` → `devDependencies.vite` (com override em `pnpm-workspace.yaml`) |
| Linguagem | TypeScript (strict) | 5.9.3 | `tsconfig.json` → `compilerOptions.strict` |
| Estilização | Tailwind CSS | 4.2.2 | `package.json` + `vite.config.ts` (plugin `@tailwindcss/vite`) |
| ORM | Prisma + better-sqlite3 | 7.8.0 | `package.json` + `app/db/prisma.server.ts` |
| Banco | SQLite (`dev.db` na raiz) | local | `prisma/schema.prisma` → `datasource db` |
| Runtime | Node.js | 22 LTS | `@types/node@22` |
| Hash de senha | bcryptjs (cost 10) | 3.0.x | `app/lib/auth.server.ts` |
| Validação | Zod | 4.4.3 | `app/lib/schemas/*.ts` |
| Path alias | `~/*` → `./app/*` | — | `tsconfig.json` + `vitest.config.ts` |
| Gerenciador | pnpm | 11.6.0 | `package.json` → `packageManager` |
| Testes unit | Vitest | 4.1.8 | `vitest.config.ts` |
| Testes E2E | Playwright | 1.60+ | `playwright.config.ts` |

> **Versões são fixadas e não-negociáveis** (constraint 5.1 do brief). Mudar major requer aprovação do usuário.

---

## Setup local

```bash
# 1. Clonar e instalar
git clone <repo> igreja_conect
cd igreja_conect
pnpm install

# 2. Variáveis de ambiente
#    .env.development está commitado (SESSION_SECRET de dev).
#    .env (DATABASE_URL) é gitignored mas presente no checkout local.
#    Para prod: injetar SESSION_SECRET via secret manager.

# 3. Reset completo do banco (valida SESSION_SECRET, backup, drop, migrate, seed)
pnpm db:reset
#    Internamente: prisma/db-reset.sh [reset|backup|restore|help]
#    Bloqueia em NODE_ENV=production (defesa SEC-L-04).
#    Backups em prisma/.backups/ (rotaciona, mantém últimos 5).

# 4. Build + start (NÃO use pnpm dev)
pnpm build
pnpm start
# → http://localhost:3000
```

**Credenciais do seed (trocar `admin123` em prod):**

| Perfil | Email | Senha | Escopo |
|---|---|---|---|
| ADMIN | `admin@igreja.local` | `admin123` | Tudo |
| PASTOR | `pastor@igreja.local` | `pastor123` | Tudo exceto `updateConfigGeral` |
| SECRETARIO | `secretario@igreja.local` | `secretario123` | CRUD membros + alertas |
| DISCIPULADOR | `discipulador@igreja.local` | `disc123` | Vínculos discipulado (escopo) |
| FINANCEIRO | `financeiro@igreja.local` | `fin123` | Dízimos (módulo placeholder) |
| LIDER_MINISTERIO | `lider@igreja.local` | `lider123` | Gestão do próprio ministério |

---

## Comandos úteis

| Comando | Função | Notas |
|---|---|---|
| `pnpm build` | Build de prod (`build/client` + `build/server`) | **Pré-requisito de `start`** |
| `pnpm start` | Serve build de prod (porta 3000) | **Use este em vez de `pnpm dev`** |
| `pnpm dev` | ⚠️ **QUEBRADO** (Prisma 7.8 + Vite 8 SSR) | Não use; ver RAG `lesson-prisma-7-vite-8-ssr-incompat` |
| `pnpm typecheck` | `react-router typegen && tsc --noEmit` | Rodar antes de commit |
| `pnpm test` | Vitest suite completa (~872 testes) | Lento (~60s); toca DB real |
| `pnpm test:watch -- <pattern>` | Vitest watch, filtrado | Ex: `pnpm test:watch -- members` |
| `pnpm test:coverage` | Vitest com v8 coverage | Gate ≥ 85% (linha) |
| `pnpm test:e2e` | Playwright (28 specs) | Sobe `pnpm dev` como webServer (herda o bug — preferir `pnpm start` separado para manual) |
| `pnpm db:reset` | `prisma/db-reset.sh` (subcmd: `reset`) | Validar + backup + drop + migrate + seed |
| `pnpm db:seed` | Seed idempotente | `tsx prisma/seed.ts` |
| `pnpm prisma migrate dev --name X` | Criar nova migration | **Nunca** use `db push` |
| `pnpm prisma migrate deploy` | Aplicar migrations (CI/prod) | Idempotente |
| `pnpm prisma studio` | GUI do DB (porta 5555) | |
| `pnpm prisma generate` | Regerar `generated/prisma/` | Após mudanças no schema |
| `pnpm prisma format` | Formatar `schema.prisma` | |
| `pnpm lint` | ❌ **Não configurado** | Style é enforced por code review |

---

## Estrutura de pastas (estado real pós-S05)

```
igreja_conect/
├── app/                                  # Código-fonte (alias ~/*)
│   ├── root.tsx                          # HTML shell + ErrorBoundary (PT-BR, sem fontes externas)
│   ├── app.css                           # Tailwind 4 import + --font-sans (system font)
│   ├── routes.ts                         # Config DECLARATIVA de rotas (editar aqui)
│   ├── routes/
│   │   ├── public/                       # index.tsx (landing) + login.tsx
│   │   ├── app/                          # TODAS as autenticadas (flat, com _middleware.tsx)
│   │   │   ├── _middleware.tsx           # auth gate → set userContext
│   │   │   ├── _index.tsx                # dashboard
│   │   │   ├── membros.{_index,novo,$id,$id.editar,$id.tipo,$id.discipulador,$id.discipulado,$id.ministerios}.tsx
│   │   │   ├── ministerios._index.tsx
│   │   │   ├── alertas._index.tsx
│   │   │   └── config.acolhimento.tsx
│   │   └── logout.tsx                    # action de logout (top-level)
│   ├── components/                       # ~40 componentes (Can, FormMembro, TabelaMembros, CardAlerta, ...)
│   │                                     #   todos com .test.tsx co-localizado
│   ├── lib/
│   │   ├── *.server.ts                   # services (members, alerts, auth, discipleship, finance, config, ...)
│   │   ├── schemas/                      # Zod schemas (membros, auth, alertas, config, discipulado, ministerios)
│   │   ├── session.server.ts             # cookie + lookup (fail-fast em SESSION_SECRET)
│   │   ├── rbac.server.ts                # assertCan* + checagem de cargo
│   │   ├── audit.server.ts               # safeLog (allowlist, sem PII)
│   │   ├── rate-limit.server.ts          # 5 falhas / 15min / IP (in-memory)
│   │   ├── money.server.ts               # reaisParaCentavos / formatBRL (Int cents)
│   │   ├── errors.ts                     # DomainError, NotFoundError, ForbiddenError, ...
│   │   ├── user-context.ts               # RR7 context symbol (compartilhado com middleware)
│   │   └── format-date.ts, masks.ts, cn.ts
│   ├── db/prisma.server.ts               # singleton (NÃO app/db.server.ts)
│   └── api/auth/                         # endpoints não-página (server-only)
│
├── prisma/
│   ├── schema.prisma                     # 12 models + 6 enums; output = "../generated/prisma"
│   ├── migrations/                       # versionadas; nunca `db push`
│   ├── seed.ts                           # idempotente (ADMIN só se não existe)
│   ├── seed.test.ts                      # teste do seed
│   ├── db-reset.sh                       # subcmds: reset | backup | restore | help
│   └── .backups/                         # dev.db.bak.YYYYMMDD-HHMMSS (rotaciona, máx 5)
│
├── generated/prisma/                     # [gitignored] saída do prisma generate
├── e2e/                                  # Playwright specs (8 arquivos, 28+ tests)
│                                         # inclui fidelidade-bypass.spec.ts, smoke.spec.ts
├── tests/
│   ├── setup.ts                          # carrega .env, NODE_ENV=test, default SESSION_SECRET
│   └── helpers/db.ts                     # setupTestDb(name) — OBRIGATÓRIO p/ tests que tocam DB
│
├── coverage/                             # saída de pnpm test:coverage (gitignored)
├── build/                                # saída de pnpm build (gitignored)
├── .react-router/                        # tipos + cache do typegen (gitignored)
│
├── docs/                                 # Documentação humana (PT-BR)
│   ├── REGRAS_DE_NEGOCIO.md              # 14 RNs (RN-MEM-*, RN-FIN-*, RN-EST-*)
│   ├── DESCRIÇÃO_DOS_MODULOS.md          # Visão de produto + matriz RBAC
│   └── architecture/ARCH.md              # Decisões macro, fluxos
│
├── .harness/                             # Harness v6 (read-only exceto orchestrator)
│   ├── brief.md                          # Brief aprovado
│   ├── state.json, state-machine.json    # Workflow state
│   ├── events.jsonl                      # Log de transições (append-only)
│   ├── RAG/                              # 10 docs aprovados (ver "RAG" abaixo)
│   ├── sprints/S00..S05/                 # Artefatos por sprint (PRD, SPEC, prompts, qa, security, lgpd)
│   ├── qa/, qa-gate/                     # Evidências de QA
│   ├── audit/                            # tool calls (auto-gerado)
│   └── failure-protocol.json
│
├── agents/AGENTS.md                      # ← este arquivo (Harness LLM doc)
├── .env.development                      # SESSION_SECRET (commitido)
├── .env                                  # DATABASE_URL (gitignored, presente local)
├── .npmrc                                # auto-install-peers=true
├── Dockerfile                            # Container de produção
├── react-router.config.ts                # ssr=true + future flags v8_*
├── vite.config.ts                        # plugins: tailwind + react-router
├── vitest.config.ts                      # alias + setupFiles + coverage include/exclude
├── playwright.config.ts                  # baseURL :5173, webServer = pnpm dev
├── tsconfig.json                         # strict + alias + rootDirs
├── pnpm-workspace.yaml                   # allowBuilds + overrides (vite 8.0.16, vite-node 6.0.0, esbuild 0.28.1)
└── package.json                          # scripts + packageManager
```

> **Convenção crítica:** rotas autenticadas vão em `app/routes/app/`, públicas em `app/routes/public/`. Endpoints de API (não-página) vão em `app/api/`. Componentes compartilhados em `app/components/`. Toda regra de negócio fica em `app/lib/*.server.ts` (sufixo `.server` garante tree-shaking do bundle do cliente).

---

## Convenções de código

### Linguagem
- **Código (variáveis, funções, classes, enums, tabelas):** inglês. Ex: `getMembroById`, `discipuladorId`, `criarLancamento`.
- **Comentários explicativos, JSDoc, mensagens de UI, copy de telas:** **português (PT-BR)**.
- **Sem mistura.** Escolha o idioma do texto e mantenha.

### TypeScript
- `strict: true` ligado — nada de `any` implícito, `null`/`undefined` sempre tipados.
- `verbatimModuleSyntax: true` — usar `import type` para tipos puros.
- Preferir `type` em vez de `interface` (sem declaration merging).
- Tipos do React Router são **gerados** em `.react-router/types/` via `pnpm typecheck`. Sempre importar de `+types/<arquivo>` em rotas.
- Tipos derivados do Prisma: importar de `generated/prisma/client` (relativo) ou usar os retornados pelos services — **nunca** reescrever à mão.

### JSDoc (obrigatório em funções públicas)

```ts
/**
 * @description Busca um membro pelo seu ID, com escopo opcional por discipulador.
 * @param {string} id - UUID do membro.
 * @param {object} [scope] - Restringe busca a discípulos de um discipulador (RN-MEM-01).
 * @returns {Promise<Membro | null>} Membro encontrado ou null.
 * @throws {NotFoundError} Se o membro não existir e `throwOnNotFound` for true.
 */
```

### TDD (obrigatório)

1. **Red** — escreva UM teste que falha primeiro.
2. **Green** — código MÍNIMO que faz passar.
3. **Refactor** — melhore sem quebrar o teste.

**Nenhum PR de feature sem teste correspondente.** Coverage mínimo 85% por sprint (gate do phase 5). Para testes de DB: sempre chamar `setupTestDb("nome-do-file")` em `beforeAll`.

### YAGNI / KISS
- Sem `strategy pattern`, sem `DI container`, sem `microserviço` até ter 3 repetições reais.
- Se a função cabe em 5 linhas sem perder clareza, faça em 5 linhas.
- `if/else` > `strategy` para 2 branches.
- Repetição de 3 é melhor que abstração prematura.

### Estilo
- Tailwind 4 utility-first. Sem `@apply` em CSS novo. Use tokens do tema.
- Componentes co-localizados com a rota (`app/routes/app/membros/novo.tsx` + `components/FormMembro.tsx`).
- Sem `default export` em módulos não-página (dificulta tree-shaking). Exceção: `root.tsx` e rotas.
- Sem `console.log` em código de produção. Use `safeLog` de `app/lib/audit.server.ts` (allowlist, sem PII).

---

## RBAC (defense in depth em 3 camadas)

Fonte da verdade: enum `Cargo` em `prisma/schema.prisma:19-26`. Matriz canônica: `.harness/RAG/security-rbac-matrix.md`.

| `Cargo` | Persona | Membros | Dízimos | Financeiro | Estoque |
|---|---|---|---|---|---|
| `ADMIN` | Pastor-presidente / TI | CRUD total | **Vê** | CRUD total | CRUD + baixa por perda |
| `PASTOR` | Pastor titular | CRUD total | **Vê** | CRUD total | Somente leitura |
| `SECRETARIO` | Secretário(a) | CRUD total | **BLOQUEADO** | CRUD (trava saldo) | CRUD (autoriza retirada) |
| `DISCIPULADOR` | Líder de célula | CRUD (escopo dos discípulos) | **BLOQUEADO** | BLOQUEADO | Somente leitura |
| `LIDER_MINISTERIO` | Líder de louvor/infantil | CRUD (apenas seu min.) | **BLOQUEADO** | BLOQUEADO | Somente leitura |
| `FINANCEIRO` | Tesoureiro(a) | CRUD total | **Vê** | CRUD (trava saldo) | Somente leitura |

> `Membro.cargo` é `Cargo?` (null = membro comum sem acesso ao sistema).

### Onde a checagem acontece (3 camadas)

1. **Loader/Action** da rota: `assertCan*` no início (antes de qualquer I/O).
2. **Service** (em `app/lib/*.server.ts`): `assertCan*` antes do I/O (Camada 3 — única mandatória).
3. **UI**: `<Can cargo={...}>` (UX, não segurança — sempre dupla-checagem).

> **Nunca confie só na UI.** Padrão: a aba "Fidelidade Financeira" deve ser bloqueada **em todas as 3 camadas** (loader, service, UI). `e2e/fidelidade-bypass.spec.ts` cobre bypass via URL direta.

---

## Padrões de rota (React Router 7 + v8_middleware)

### Tipos de arquivo de rota

```ts
// app/routes/app/membros/$id.tsx
import type { Route } from "./+types/$id";

// Loader: roda no servidor antes do render. Pode lançar Response (redirect, 403).
export async function loader({ params, request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);   // injetado pelo middleware
  assertCanReadMembro(user, params.id);    // Camada 2 RBAC
  const membro = await getMembroById(params.id, { scope: user });
  return { membro };
}

// Action: lida com POST/PUT/DELETE. Validar payload com Zod.
export async function action({ request, params, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  const formData = await request.formData();
  const parsed = MembroUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  await updateMembro(params.id, parsed.data, user);  // service faz assertCan* (Camada 3)
  return redirect(`/app/membros/${params.id}`);
}

// Component: recebe o que loader/action retornou via useLoaderData().
export default function MembroDetalhe({ loaderData }: Route.ComponentProps) {
  const { membro } = loaderData;
  return <h1>{membro.nome}</h1>;
}
```

### Middleware (v8_middleware flag ativada em `react-router.config.ts`)

`app/routes/app/_middleware.tsx` aplica auth a TODAS as rotas filhas:

```ts
export const middleware = [authMiddleware];
// → set userContext, ou throw redirect("/login?next=...")
```

Adicionar novo middleware a um subgrupo: criar `app/routes/app/<sub>/_middleware.tsx` e envolver via `layout(...)` em `app/routes.ts`.

### URLs
- **Em PT-BR sem acentos** (encoding): `/app/membros`, `/app/membros/novo`, `/app/membros/:id/discipulos`. **Nunca** expor IDs técnicos.
- `$param` para params dinâmicos, `_index` para index dentro de um layout.

---

## Padrões de service + API

### Service (puro, testável isoladamente)

```ts
// app/lib/members.server.ts
import { prisma } from "~/db/prisma.server";
import { ForbiddenError, BusinessRuleError } from "~/lib/errors";

export async function createMembro(input: MembroCreateInput, currentUser: SessionUser) {
  // Camada 3 RBAC — SEMPRE antes do I/O
  assertCanWriteMembro(currentUser);
  return prisma.membro.create({ data: input });
}

export async function setDiscipulador(discId: string, discipuladorId: string, currentUser: SessionUser) {
  assertCanManageDiscipleship(currentUser, { discId, discipuladorId });

  // RN-MEM-04: trava de 12
  const count = await prisma.membro.count({ where: { discipuladorId, NOT: { id: discId } } });
  if (count >= 12) throw new BusinessRuleError("Discipulador já possui 12 discípulos");

  // Anti-loop
  if (discId === discipuladorId) throw new BusinessRuleError("Auto-vínculo não permitido");
  if (await isDescendantOf(discipuladorId, discId)) throw new BusinessRuleError("Vínculo em loop detectado");

  return prisma.membro.update({ where: { id: discId }, data: { discipuladorId } });
}
```

### Validação com Zod (sempre `.strict()` em input externo)

```ts
// app/lib/schemas/membros.ts
export const MembroCreateSchema = z.object({
  nome: z.string().min(2).max(120),
  tipo: z.enum(["MEMBRO_ATIVO", "CONGREGADO", "VISITANTE"]),
  email: z.string().email().optional(),
  telefone: z.string().regex(/^\+?[\d\s()-]{8,20}$/).optional(),
  // NÃO incluir CPF, RG, dados fiscais (LGPD + RAG)
}).strict();
```

### Erros

- Loader/action: `throw new Response("msg", { status: 4xx })` — RR7 renderiza o `ErrorBoundary` apropriado.
- Service: lança `DomainError` com subclasses tipadas (`NotFoundError`, `ForbiddenError`, `ValidationError`, `BusinessRuleError`). Loader converte para `Response`.
- **Nunca** retornar `senhaHash` em payload de API. Usar `sanitize()` explícito.

---

## Padrões de banco (Prisma + SQLite)

### Singleton

```ts
// app/db/prisma.server.ts (NÃO app/db.server.ts)
function getPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const cached = globalThis.__prisma;
  if (cached && globalThis.__prisma_url === url) return cached;
  // reconecta se URL mudou (importante para testes)
  ...
}
```

> Sufixo `.server.ts` impede bundling no cliente. **Sempre** importe de `~/db/prisma.server` em código server-only.

### Transações (RN-MEM-05: visitante + alerta atômico)

```ts
await prisma.$transaction(async (tx) => {
  const visitante = await tx.membro.create({ data: visitanteInput });
  const config = await tx.configuracaoGeral.findFirst();
  const responsavelId = resolverResponsavel(config);
  await tx.alerta.create({ data: { ... } });
});
```

> **Flaky E2E warning:** `$transaction` Prisma 7.8 tem commit assíncrono. Se o `page.goto` subsequente não vir o alerta criado, usar `dbSettle(100)` como workaround. Ver RAG `lesson-prisma-7-commit-settle-e2e`.

### Centavos (RN implícito do schema)

Todos os valores monetários são `Int` em centavos. **Nunca** `Float`/`Decimal`.

```ts
// app/lib/money.server.ts
export const reaisParaCentavos = (reais: number): number => Math.round(reais * 100);
export const formatBRL = (centavos: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100);
```

### Regras Prisma

- `output = "../generated/prisma"` (não vai em `node_modules`).
- `onDelete: Restrict` por padrão (exceções: `MinisterioMembro` cascade, `AlertaDestinatario` cascade, `Lancamento.membro` SetNull para oferta anônima).
- Migrations em dev via `prisma migrate dev` (nunca `db push`).
- Em prod: `prisma migrate deploy` (idempotente).

---

## LGPD / Privacidade

Princípios não-negociáveis (constraint 5.2 do brief + Lei 13.709/2018):

1. **Sem CPF, sem RG, sem dados fiscais.** `MembroCreateSchema.strict()` rejeita tentativas. Teste de integração verifica.
2. **Hash bcrypt** (cost 10) em `Membro.senhaHash`. **Nunca** logar, retornar ou exibir.
3. **Cookie httpOnly** com `httpOnly: true`, `secure: true` em prod, `sameSite: "lax"`, `path: "/"`.
4. **Dízimos restritos** (RN-MEM-03): apenas `ADMIN`/`PASTOR`/`FINANCEIRO` veem a aba Fidelidade Financeira. Bloqueio em **3 camadas** (UI, loader, service). `e2e/fidelidade-bypass.spec.ts` cobre bypass via URL.
5. **Sem analytics de terceiros**, sem fingerprinting, sem geolocalização no MVP.
6. **Sem auditoria de leitura** no MVP (LGPD art. 37) — backlog.
7. **Direito ao esquecimento** (LGPD art. 18): anonimizar (não deletar) para preservar integridade referencial. Backlog.

> **Regra de ouro:** se estiver em dúvida se um dado é sensível, **não colete**. Minimalismo de dados.

**Documentos canônicos:**
- `.harness/RAG/lgpd-igreja-conect.md` — 6 decisões técnicas
- `.harness/RAG/lgpd-bases-legais-igreja.md` — mapeamento Art. 7º/11º por campo

---

## RAG (`.harness/RAG/`) — 14 docs (13 approved + 1 pending)

**Sempre `ls .harness/RAG/` no início de uma task; ler antes de improvisar.**

### Ciclo 1 (10 docs — preservados, base não-negociável)

| ID | Categoria | Prioridade | Quando ler |
|---|---|---|---|
| `security-rbac-matrix` | security | **critical** | Tocar auth/RBAC, adicionar permissão, revisar controle de acesso |
| `lgpd-igreja-conect` | law | **critical** | Adicionar campo pessoal, mexer em cookie, log, export |
| `lgpd-bases-legais-igreja` | law | **critical** | Justificar POR QUÊ coleta um campo (Art. 7º/11º) |
| `pattern-3-layer-rbac` | pattern | **critical** | Adicionar feature que precisa de RBAC — ver UI/loader/service |
| `architecture-monolith-modular` | architecture | high | Modificar fronteira do monólito, package, SSR |
| `convention-monetary-values` | convention | high | Tocar Lancamento, Caixa, qualquer campo de dinheiro |
| `convention-prisma-sqlite` | convention | high | Prisma client, migrations, seed, enums, Json/DateTime gotchas |
| `lesson-prisma-7-vite-8-ssr-incompat` | lesson | high | Dev server quebra, "Vite module runner has been closed" |
| `lesson-route-service-bypass` | antipattern | high | Route importa `prisma.*` direto (deve usar `*.server.ts`) |
| `lesson-prisma-7-commit-settle-e2e` | lesson | medium | E2E flaky com `$transaction` + `page.goto` |

### Ciclo 2 (4 docs novos — específicos do Módulo Financeiro)

| ID | Categoria | Prioridade | Quando ler | Status |
|---|---|---|---|---|
| `pattern-trava-saldo-service` | pattern | **critical** | Tocar `Lancamento` SAIDA, `transferirEntreCaixas`, mutação de `Caixa.saldoCentavos` (RN-FIN-04) | approved |
| `pattern-transferencia-caixas` | pattern | high | Tocar `TransferenciaCaixa`, modelagem híbrida (1+2), atomicidade (RN-FIN-02) | approved |
| `architecture-financeiro` | architecture | high | Visão macro do Módulo Financeiro: camadas, fluxos, lifecycles, RBAC fina | approved |
| `decision-caixa-soft-delete` | decision | medium | Decisão pendente sobre `Caixa.ativo: Boolean` (proposta do discovery §5.4) | **pending** |

> **`decision-caixa-soft-delete` é `pending` propositadamente:** a formalização é na **Fase 2 (Requisitos)** do ciclo 2, com gate do `prd-reviewer`. Ver RAG e brief §5.4 + §9.5. Não gerar migration enquanto `pending`.

Também relevantes (fora de `.harness/RAG/`):
- `docs/REGRAS_DE_NEGOCIO.md` — 14 RNs (RN-MEM-*, RN-FIN-*, RN-EST-*)
- `docs/DESCRIÇÃO_DOS_MODULOS.md` — produto + matriz RBAC
- `docs/architecture/ARCH.md` — decisões macro
- `.harness/brief.md` — escopo MVP
- `.harness/sprints/S05/security-audit.md` — auditoria completa S05
- `.harness/sprints/S05/lgpd-parecer.md` — parecer LGPD S05

---

## Como adicionar uma nova feature

1. **Ler RAG** relevante (`ls .harness/RAG/`).
2. **Escrever testes primeiro** no mesmo arquivo (`*.server.test.ts` ou `*.test.tsx`). Para testes de DB:
   ```ts
   import { setupTestDb, prismaTest, resetTestDb } from "../../tests/helpers/db";
   beforeAll(async () => {
     cleanup = await setupTestDb("meu-test-file");
   });
   afterEach(async () => { await resetTestDb(); });
   afterAll(async () => { await cleanup(); });
   ```
3. **Implementar no service** (`app/lib/<dominio>.server.ts`): função pura, recebe `currentUser`, chama `assertCan*` ANTES do I/O.
4. **Adicionar schema Zod** em `app/lib/schemas/<dominio>.ts` (`.strict()`).
5. **Adicionar rota** em `app/routes/app/<path>.tsx` (ou editar `app/routes.ts` se novo path). **Nunca** `prisma.*` direto na rota.
6. **Adicionar guard de UI** com `<Can cargo={...}>` no render condicional.
7. **Rodar** (em ordem): `pnpm test:watch -- <pattern>` → `pnpm typecheck` → `pnpm test` → `pnpm test:coverage` → `pnpm build`.
8. Se a feature é parte de sprint Harness: atualizar `.harness/sprints/S0X/...` e `events.jsonl` via tools apropriadas (não editar `state.json` diretamente).

---

## Módulo Financeiro (ciclo 2)

> **Escopo único do ciclo 2 (2026-06-14+):** Caixas + Lançamentos + Dízimos + Ofertas + Transferências + Trava de Saldo + aba Fidelidade Financeira. 5 RNs já documentadas em `docs/REGRAS_DE_NEGOCIO.md §2` (`RN-FIN-01` a `05`). Schema Prisma já tem `Caixa`, `TransferenciaCaixa`, `Lancamento` (2 enums com 7 categorias). Service placeholder `getDizimosByMembro` em `app/lib/finance.server.ts` com Camada 3 RBAC já pronta. Aba `TabFidelidadeFinanceira` é placeholder aguardando dados reais.
>
> **Fonte canônica:** [`brief.md`](../../brief.md) §4 (Escopo), §5 (Decisões), §6 (Restrições), §7 (Sucesso), §8 (Não-objetivos).

### Stack do módulo

Mesma do MVP (ciclo 1). Nada de novo: React Router 7.17 SSR, Prisma 7.8 + SQLite, Tailwind 4, Vite 8, TypeScript 5.9 strict, Zod 4, bcryptjs. **Sem gateway de pagamento, sem upload S3, sem Redis, sem microsserviço** (brief §6.4).

### Onde mora cada trava (camadas)

| Camada | Helper / Componente | Onde | Finalidade |
|---|---|---|---|
| **1 — UI** | `<Can allow={['ADMIN','PASTOR','FINANCEIRO','SECRETARIO']}>` | `app/components/**/*.tsx` | Esconde controles. **UX, não segurança.** |
| **1b — UI Financeira** | `disabled` em submit se `saldo < valor` | `FormLancamento`, `FormTransferencia` | UX inline (não substitui Camada 3). |
| **2 — Loader/Action** | `assertCanSeeFinancials(user)` antes de I/O | `app/routes/app/financeiro/**` | Gate de navegação. 403 se bypass via URL. |
| **3 — Service** | `assertCanSeeFinancials` + `assertSaldoSuficiente` + `$transaction` | `app/lib/finance.server.ts`, `lancamentos.server.ts`, `transferencias.server.ts` | **Única segurança real.** Barreira antes do DB. |

### Comandos de verificação específicos

```bash
# Rodar testes apenas do Financeiro (quando services existirem em S06+)
pnpm test:watch -- finance
pnpm test:watch -- caixas
pnpm test:watch -- lancamentos
pnpm test:watch -- transferencias

# Cobertura focada nos services de regra de negócio (gate: 100%)
pnpm test:coverage -- app/lib/finance.server.ts \
                     app/lib/caixas.server.ts \
                     app/lib/lancamentos.server.ts \
                     app/lib/transferencias.server.ts

# Validar Zod schemas
pnpm test:watch -- schemas/finance
pnpm test:watch -- schemas/caixas
pnpm test:watch -- schemas/lancamentos
pnpm test:watch -- schemas/transferencias

# E2E específicos (Playwright, a serem criados em S06+)
pnpm test:e2e -- financeiro-dashboard
pnpm test:e2e -- financeiro-dizimo
pnpm test:e2e -- financeiro-transferencia
pnpm test:e2e -- fidelidade-bypass  # JÁ EXISTE do ciclo 1 — RN-MEM-03
```

### Como rodar a aba Fidelidade Financeira localmente

1. **Build de prod** (não `pnpm dev` — ver ⚠️ critical gotcha do ciclo 1):
   ```bash
   pnpm build && pnpm start
   # → http://localhost:3000
   ```
2. **Login** com perfil financeiro: `financeiro@igreja.local` / `fin123` (credenciais do seed).
3. **Navegar:** `/app/membros` → escolher um membro com dízimos lançados → clicar na tab **"Fidelidade Financeira"** (só aparece para ADMIN, PASTOR, FINANCEIRO — defesa em 3 camadas).
4. **Verificar Camada 2:** acessar `?tab=fidelidade` direto na URL com perfil não-financeiro (ex: `secretario@igreja.local`) → loader redireciona para `?tab=dados` (RN-MEM-03).
5. **Verificar Camada 3:** bypass programático via `curl` à rota `/app/membros/<id>` retorna 403 se perfil não-financeiro (helper `getDizimosByMembro` chama `assertCanSeeFinancials` PRIMEIRO).

### Quais RAGs ler **antes** de tocar em código de Financeiro

**Obrigatórios (não-negociáveis):**

1. **`security-rbac-matrix`** — matriz 6 perfis × 5 domínios, helper `assertCanSeeFinancials`.
2. **`convention-monetary-values`** — `Int` em centavos, helpers `formatBRLFromCents` / `parseBRLToCents` / `assertNonNegative`.
3. **`pattern-3-layer-rbac`** — UI / loader / service. Camada 3 é a única segurança real.

**Específicos do módulo (ciclo 2):**

4. **`pattern-trava-saldo-service`** (critical) — `assertSaldoSuficiente` antes do I/O. Ordem inegociável.
5. **`pattern-transferencia-caixas`** (high) — modelagem híbrida 1+2, atomicidade em `$transaction`.
6. **`architecture-financeiro`** (high) — visão macro, lifecycles, RBAC fina do módulo.
7. **`decision-caixa-soft-delete`** (pending) — proposta `Caixa.ativo` (não gerar migration enquanto `pending`).

**Complementares (transversais):**

8. **`lgpd-igreja-conect`** — dízimos restritos, logs sem `valorCentavos`, sem CPF.
9. **`convention-prisma-sqlite`** — `$transaction` workflow, `onDelete: Restrict`, enum simulado.
10. **`lesson-route-service-bypass`** — **nunca** `prisma.*` direto em loader/action de `/app/financeiro/**`.
11. **`lesson-prisma-7-commit-settle-e2e`** — em E2E, `page.goto` logo após `transferirEntreCaixas` pode não ver os lançamentos espelho. Workaround: `dbSettle(100)`.

### Exemplo de service signature (referência canônica)

```ts
// app/lib/lancamentos.server.ts (esboço — implementação é no ciclo 2, Fase 5)
export async function criarLancamento(
  input: LancamentoCreateInput,
  user: SessionUser
): Promise<Lancamento> {
  // CAMADA 3 (RBAC) — PRIMEIRO, antes de qualquer I/O.
  assertCanSeeFinancials(user);

  // Validações Zod (RN-FIN-05: DIZIMO exige membroId; OFERTA aceita anônimo).
  const parsed = LancamentoCreateSchema.parse(input);
  assertNonNegative(parsed.valorCentavos, "Lançamento");

  // CAMADA 3 (RN-FIN-04) — trava de saldo ANTES do I/O.
  if (parsed.tipo === "SAIDA") {
    await assertSaldoSuficiente(
      parsed.caixaId, parsed.valorCentavos,
      `Lançamento de saída (${parsed.categoria})`
    );
  }

  // Atomicidade: lançamento + atualização de saldo em $transaction.
  return prisma.$transaction(async (tx) => {
    const lancamento = await tx.lancamento.create({ data: parsed });
    await tx.caixa.update({
      where: { id: parsed.caixaId },
      data: {
        saldoCentavos: parsed.tipo === "ENTRADA"
          ? { increment: parsed.valorCentavos }
          : { decrement: parsed.valorCentavos },
      },
    });
    return lancamento;
  });
}
```

> **Assinaturas canônicas** (referência para implementação no ciclo 2, Fase 5):
> - `caixas.server.ts`: `listarCaixas(user, options)`, `criarCaixa(input, user)`, `editarCaixa(id, input, user)`, `arquivarCaixa(id, user)`, `reabrirCaixa(id, user)`.
> - `lancamentos.server.ts`: `criarLancamento(input, user)`, `listarPorCaixa(caixaId, user, filtros)`, `listarPorMembro(membroId, user)` (só DIZIMO), `editarLancamento(id, input, user)` (apenas descritivo).
> - `transferencias.server.ts`: `transferirEntreCaixas(input, user)` (1+2, atômico).
> - `finance.server.ts` (canônico): `assertSaldoSuficiente(caixaId, valorCentavos, context)`, `getDizimosByMembro(membroId, user)` (JÁ EXISTE no ciclo 1, basta descomentar query).

### Glossário do Módulo Financeiro

| Termo | Significado |
|---|---|
| **Caixa** | Saldo apartado (Geral, Cantina, Missões, etc.). Saldo em **centavos** (`Int`). `Caixa` é o model único, diferenciado por `nome`. |
| **Caixa Geral** | Caixa seed (criado no `prisma/seed.ts` via `upsert`). Único caixa que existe na primeira inicialização. |
| **Lançamento** | Entrada/saída de caixa. `Lancamento` — pode ser vinculado a membro (dízimo) ou anônimo (oferta, RN-FIN-05). |
| **Categoria de Lançamento** | Enum `CategoriaLancamento` com 7 valores: `DIZIMO`, `OFERTA`, `CAMPANHA`, `DESPESA_OPERACIONAL`, `COMPRA_ESTOQUE`, `MANUTENCAO`, `TRANSFERENCIA`. |
| **Tipo de Lançamento** | Enum `TipoLancamento`: `ENTRADA` (soma) ou `SAIDA` (subtrai, com trava). |
| **Dízimo** | Lançamento `ENTRADA / DIZIMO` com `membroId` **obrigatório** (RN-FIN-05). Dado sensível — aba Fidelidade restrita a ADMIN/PASTOR/FINANCEIRO. |
| **Oferta** | Lançamento `ENTRADA / OFERTA` com `membroId` **opcional** (anônimo, RN-FIN-05). Não aparece na aba Fidelidade se for anônima. |
| **Transferência entre Caixas** | Movimentação imutável entre 2 caixas. Modelagem híbrida: 1 `TransferenciaCaixa` (auditoria) + 2 `Lancamento` espelho (extrato). Atômica em `$transaction` (RN-FIN-02). |
| **Trava de Saldo** | Bloqueio automático se caixa não tem saldo suficiente (RN-FIN-04). Implementada no service via `assertSaldoSuficiente` — **nunca** apenas na UI. |
| **Autonomia por Saldo Real** | `FINANCEIRO` e `SECRETARIO` aprovam saídas **desde que o caixa tenha saldo** (RN-FIN-03). Sem aprovação multi-nível adicional. |
| **Lançamento Espelho** | 1 dos 2 `Lancamento` gerados por `transferirEntreCaixas` (1 SAIDA origem, 1 ENTRADA destino). `categoria = TRANSFERENCIA` é **exclusiva** do espelho. |
| **Reconciliação de Caixa** | Verificação semanal de que `SUM(Lancamento WHERE caixaId = X) == Caixa.saldoCentavos`. Feature **futura** (backlog, não ciclo 2). |
| **Caixa Arquivado** | Caixa com `ativo = false` (proposta pendente). Some da listagem padrão, não aceita movimentações, mas mantém histórico. Ver `decision-caixa-soft-delete`. |
| **Aba "Fidelidade Financeira"** | Componente do perfil que lista dízimos. **Bloqueada** para perfis sem permissão (RN-MEM-03). Service `getDizimosByMembro` já pronto no ciclo 1. |
| **`assertSaldoSuficiente`** | Helper canônico em `app/lib/finance.server.ts`. Lança `Response(409)` se caixa não tem saldo. PRIMEIRO no service, antes do `$transaction`. |
| **`assertCanSeeFinancials`** | Helper canônico em `app/lib/rbac.server.ts`. Lança `Response(403)` se user não tem perfil financeiro. PRIMEIRO no service, antes de qualquer I/O. |
| **`assertCanManageCaixa`** | Helper **proposto** (a ser criado no ciclo 2). Lança `Response(403)` se user não tem permissão de criar/arquivar Caixa (ADMIN, PASTOR, FINANCEIRO — matriz §4.8 do brief). |

### Decisão pendente: `Caixa.ativo` (formalização na Fase 2)

- **Proposta:** adicionar campo `ativo: Boolean @default(true)` ao model `Caixa` para soft-delete (arquivamento).
- **Status:** `pending` no RAG `decision-caixa-soft-delete`. Aguarda validação do `prd-reviewer` na **Fase 2 (Requisitos)**.
- **Helpers que JÁ antecipam a checagem:** `assertSaldoSuficiente` (RAG `pattern-trava-saldo-service` §2.1) e `transferirEntreCaixas` (RAG `pattern-transferencia-caixas` §2.2) **já incluem** a checagem de `caixa.ativo === false` — ganham null-safe (`caixa.ativo === undefined → trata como true`) se a migration for aprovada.
- **Não** gerar migration (`pnpm prisma migrate dev --name add_ativo_to_caixa`) enquanto o RAG estiver `pending`. O `prd-reviewer` valida, depois a Fase 5 gera a migration.
- **Ver:** `.harness/RAG/decision-caixa-soft-delete.md` (análise completa das 4 alternativas) + `brief.md §5.4` (proposta original) + `brief.md §9.5` pendência #4.

### Métrica macro do ciclo 2 (definition of done)

> *"O ciclo 2 é considerado bem-sucedido quando um `FINANCEIRO` consegue, em menos de 2 minutos, registrar um dízimo de `Membro X` no `Caixa Geral`, ver o saldo do caixa refletir a entrada, e o `PASTOR` consegue abrir a aba 'Fidelidade Financeira' do `Membro X` e ver o dízimo recém-lançado."* — `brief.md §7.1`

**Testes de borda obrigatórios (12, do brief §7.3):** trava saldo 0 → 1¢, 12/13 discípulos (regressão), DIZIMO sem membro → 400, OFERTA sem membro → OK, transferência origem=destino → 400, transferência valor=0 → 400, transferência valor negativo → 400, SECRETARIO em `/app/financeiro` → 403, SECRETARIO em aba Fidelidade → 403, DISCIPULADOR em qualquer rota `/app/financeiro/**` → 403.

---

## Glossário de termos do domínio

| Termo | Significado |
|---|---|
| **Membro** | Pessoa cadastrada. `Membro` é o model único, diferenciado por `tipo`. |
| **Membro Ativo** | Vínculo eclesiástico pleno. `TipoMembro.MEMBRO_ATIVO`. |
| **Congregado** | Intermediário — frequenta mas ainda não membro pleno. `TipoMembro.CONGREGADO`. |
| **Visitante** | Primeira visita. `TipoMembro.VISITANTE`. Transição é **manual** (RN-MEM-06). |
| **Discipulador** | `Cargo.DISCIPULADOR` que lidera outros. Limite de 12 discípulos ativos (RN-MEM-04). |
| **Discípulo** | Membro vinculado via `Membro.discipuladorId` (auto-relação 1:N). |
| **Ministério** | Grupo/equipe (louvor, infantil, diaconal). Vínculo N:N via `MinisterioMembro`. |
| **Líder de Ministério** | `Cargo.LIDER_MINISTERIO` — gerencia membros do(s) seu(s) ministério(s). |
| **Caixa** | Saldo apartado (Geral, Cantina, Missões). Saldo em **centavos** (`Int`). |
| **Lançamento** | Entrada/saída de caixa. `Lancamento` — pode ser vinculado a membro (dízimo) ou anônimo (oferta, RN-FIN-05). |
| **Transferência entre Caixas** | Movimentação imutável entre 2 caixas, com operador carimbado (RN-FIN-02). |
| **Item de Estoque (Consumo)** | Material descartável. `TipoItemEstoque.CONSUMO`. |
| **Item de Estoque (Patrimônio)** | Bem permanente. `TipoItemEstoque.PATRIMONIO` + `StatusItemPatrimonio`. |
| **Status de Patrimônio** | `DISPONIVEL`, `EM_MANUTENCAO`, `BAIXADO_PERDA` (RN-EST-05). |
| **Alerta** | Notificação in-app (sem push, sem e-mail). `Alerta` + `AlertaDestinatario` (N:N). |
| **Central de Alertas** | Tela que lista alertas do usuário. No MVP, único gatilho é "novo visitante" (RN-MEM-05). |
| **Acolhimento de Visitante** | Fluxo configurável pelo ADMIN (RN-MEM-05) — quem recebe cada novo visitante. |
| **Trava de Saldo** | Bloqueio automático se caixa não tem saldo (RN-FIN-03/04). |
| **Aba "Fidelidade Financeira"** | Componente do perfil que lista dízimos. **Bloqueada** para perfis sem permissão (RN-MEM-03). |
| **Seed** | Bootstrap — cria ADMIN inicial idempotente. |
| **Session Cookie** | `__session` httpOnly assinado com `SESSION_SECRET`. Sem JWT, sem localStorage. |
| **Cargo** | Enum com 6 perfis. `Membro.cargo` nullable = membro comum sem acesso. |

---

## Anti-patterns (não repita)

- ❌ `pnpm dev` (quebrado — usar `pnpm build && pnpm start`).
- ❌ `pnpm prisma db push` (perde migrations; usar `migrate dev`/`migrate deploy`).
- ❌ Editar `generated/prisma/` (regerado a cada `prisma generate`).
- ❌ Importar de `~/db.server` (caminho errado — é `~/db/prisma.server`).
- ❌ Editar `.env` via harness (path-boundary bloqueia). Use `.env.development`, `.env.local`, `.env.development.local`.
- ❌ Retornar `senhaHash` de qualquer service (LGPD + RAG).
- ❌ `prisma.*` direto em arquivo de rota (use `*.server.ts` — ver RAG `lesson-route-service-bypass`).
- ❌ Adicionar script de `lint`/`format` achando que roda em CI (não há).
- ❌ `default export` em módulo não-rota (quebra tree-shaking).
- ❌ Confiar só na UI para RBAC (sempre dupla-checagem: loader + service).
- ❌ `console.log` em código de produção (usar `safeLog`).
- ❌ Coletar CPF/RG/CNPJ/PIS/telefone comercial (LGPD + RAG).
- ❌ Float para dinheiro (usar `Int` centavos + `money.server.ts`).

---

## Próxima revisão

- **Quando:** ao final de cada sprint (Fase 5 completa) ou quando o schema mudar.
- **Por quem:** `documenter` agent, acionado pelo orchestrator.
- **O que atualizar:** stack (se versão mudou), estrutura de pastas, padrões consolidados, glossário (se novo termo).
