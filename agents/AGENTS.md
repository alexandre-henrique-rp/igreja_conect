# AGENTS.md — Igreja Conect

> **Memória de longo prazo do projeto para agentes LLM (Harness v6).**
> Lido no início de **toda** task. Se você é um agente entrando no projeto, leia este arquivo inteiro antes de tocar em qualquer código.
>
> **Última atualização:** 2026-06-20 (Fase 1, ciclo 4 — Relatórios Financeiros)
> **Mantido por:** `documenter` agent (Fase 1 do Harness v6)
>
> **Localização:** este arquivo está em `agents/AGENTS.md` (não na raiz) por restrição do `path-boundary.ts` do projeto (allowlist não inclui `AGENTS.md` na raiz). Convenção universal é raiz, mas o hook bloqueia. Se o allowlist for ampliado, mover para a raiz e atualizar este cabeçalho.
>
> **Estado do ciclo:** ciclo 1 (MVP — Auth + Membros + Discipulado + Alertas + Acolhimento) **FECHADO** em 2026-06-13. Ciclo 2 (Módulo Financeiro) **FECHADO** em 2026-06-19. Ciclo 3 (Módulo Estoque + Patrimônio) **FECHADO** (planning completo, build deferred). **Ciclo 4 (Relatórios Financeiros) em Fase 1 — Documentação** (2026-06-20, brief aprovado em 2026-06-20T15:35Z).

---

## TL;DR

O **Igreja Conect** é um sistema web SSR para gestão eclesiástica local.

- **Ciclo 1 (FECHADO, 2026-06-13):** Auth + Membros + Discipulado + Alertas + Acolhimento. **872 unit + 28 E2E + 5 smoke** passando. Line coverage **88.21%**. `gate: all-of passed`.
- **Ciclo 2 (FECHADO, 2026-06-19):** **Módulo Financeiro** (Caixas + Lançamentos + Dízimos + Ofertas + Transferências + Trava de Saldo + Fidelidade Financeira). 5 RNs já documentadas (`RN-FIN-01` a `05`); schema Prisma com 3 models (`Caixa`, `TransferenciaCaixa`, `Lancamento`); serviços e UI entregues em S06–S08 + cleanup S09–S10. `gate: all-of passed` (1115 testes, 96% cobertura/sprint).
- **Ciclo 3 (FECHADO — planning completo, build deferred):** **Módulo Estoque + Patrimônio** (Consumo + Manutenção externa + Baixa por perda). 5 RNs já documentadas (`RN-EST-01` a `05`); schema Prisma já tem 3 models (`ItemEstoque`, `MovimentacaoEstoque`, `ManutencaoAtivo`) + 2 enums (`TipoItemEstoque`, `StatusItemPatrimonio`).
- **Ciclo 4 (EM ANDAMENTO, 2026-06-20+):** **Relatórios Financeiros** (5 páginas: Hub + DRE + Balancete + Fluxo de Caixa + Customizado). **Camada read-only sobre o Módulo Financeiro do ciclo 2** — sem migration, sem novos models, sem novas RNs. 5 services de agregação em `app/lib/relatorios.server.ts` + 1 service de export CSV em `app/lib/relatorios-csv.server.ts`. Fonte canônica: `brief-relatorios.md` (489 linhas, 9 seções, aprovado em 2026-06-20T15:35Z).

**Stack (imutável entre ciclos):** React Router 7.17 (SSR) + Vite 8 + Tailwind 4 + Prisma 7.8 (SQLite via `better-sqlite3`) + TypeScript 5.9 strict + Zod 4 + bcryptjs. Auth por **session cookie httpOnly + bcrypt cost 10**. RBAC com **6 perfis** e **defense in depth em 3 camadas** (UI `<Can>` + loader `assertCan*` + service `assertCan*`). **LGPD estrito**: sem CPF/RG/CNPJ; aba de dízimos bloqueada nas 3 camadas.

**RAGs críticos (ler antes de qualquer feature):** `security-rbac-matrix` + `convention-monetary-values` (RBAC + dinheiro). Para o **Módulo Relatórios Financeiros especificamente (ciclo 4)**, ler também: `pattern-relatorios-aggregations` (high, novo) + `convention-relatorios-csv-export` (high, novo) + `architecture-financeiro` (high) + `pattern-trava-saldo-service` (critical, herdado).

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

## RAG (`.harness/RAG/`) — 20 docs (20 approved)

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
| `decision-caixa-soft-delete` | decision | medium | Decisão `Caixa.ativo: Boolean` (formalizada e aprovada em ciclo 2 Fase 2 pelo `prd-reviewer`) | approved |

### Ciclo 3 (4 docs novos — específicos do Módulo Estoque + Patrimônio)

| ID | Categoria | Prioridade | Quando ler | Status |
|---|---|---|---|---|
| `pattern-estoque-trava-quantidade` | pattern | high | Tocar `MovimentacaoEstoque`, mutação de `ItemEstoque.quantidade` (RN-EST-02), trava de saldo on-consulta | approved |
| `pattern-patrimonio-status-state-machine` | pattern | high | Tocar `ManutencaoAtivo`, transição de `ItemEstoque.statusPatrimonio`, envio/retorno/baixa (RN-EST-01/03/05) | approved |
| `pattern-manutencao-alerta-manual` | pattern | medium | Implementar RN-EST-04 (alerta de manutenção sem prazo) sem cron job — gatilho on-consulta + idempotência 24h | approved |
| `convention-tipos-item-estoque` | convention | medium | Diferenciar `TipoItemEstoque.CONSUMO` vs `PATRIMONIO`, `discriminatedUnion` Zod, validação de tipo no service | approved |

### Ciclo 4 (2 docs novos — específicos do Módulo Relatórios Financeiros)

| ID | Categoria | Prioridade | Quando ler | Status |
|---|---|---|---|---|
| `pattern-relatorios-aggregations` | pattern | high | Criar/alterar `app/lib/relatorios.server.ts` (5 services de agregação: `getDRE`, `getBalanceteMensal`, `getFluxoCaixa`, `getRelatorioCustomizado`, `exportarLancamentosCSV`); usar `groupBy`, soma em `Int` centavos, `assertCanSeeRelatorios` como Camada 3 | approved |
| `convention-relatorios-csv-export` | convention | high | Implementar ou alterar export CSV em `/app/financeiro/relatorios/customizado?export=csv`; aplicar RFC 4180 + BOM UTF-8 + separador `;` + escape de aspas + `Cache-Control: no-store` | approved |

Também relevantes (fora de `.harness/RAG/`):
- `docs/REGRAS_DE_NEGOCIO.md` — 14 RNs (RN-MEM-*, RN-FIN-*, RN-EST-*)
- `docs/DESCRIÇÃO_DOS_MODULOS.md` — produto + matriz RBAC
- `docs/architecture/ARCH.md` — decisões macro (atualizado em 2026-06-20 com §10 Relatórios Financeiros, ciclo 4)
- `brief-mvp.md` — escopo do ciclo 1 (MVP)
- `brief-mvp-financeiro.md` — escopo do ciclo 2 (Módulo Financeiro — base para Relatórios)
- `brief-relatorios.md` — escopo do ciclo 4 (Relatórios Financeiros; brief atual, aprovado em 2026-06-20T15:35Z)
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

## Módulo Estoque + Patrimônio (ciclo 3)

> **Escopo único do ciclo 3 (2026-06-19+):** Estoque de Consumo (almoxarifado com trava de quantidade) + Patrimônio (state machine de status + manutenção externa + baixa por perda). 5 RNs já documentadas em `docs/REGRAS_DE_NEGOCIO.md §3` (`RN-EST-01` a `RN-EST-05`). Schema Prisma já tem `ItemEstoque`, `MovimentacaoEstoque`, `ManutencaoAtivo` + 2 enums (`TipoItemEstoque`, `StatusItemPatrimonio`). Services e UI a serem entregues em S11–S12.
>
> **Fonte canônica:** [`brief.md`](../../brief.md) §4 (Escopo), §5 (Decisões), §6 (Restrições), §7 (Sucesso), §8 (Não-objetivos).

### Stack do módulo

Mesma do MVP (ciclos 1 e 2). Nada de novo: React Router 7.17 SSR, Prisma 7.8 + SQLite, Tailwind 4, Vite 8, TypeScript 5.9 strict, Zod 4, bcryptjs. **Sem Redis, sem `node-cron`, sem S3/MinIO** (brief §6.4). Decisão consciente: alerta de manutenção sem prazo (RN-EST-04) é **on-consulta**, não cron. Decisão consciente: `urlLaudoTecnico` permanece `null` (sem upload); baixa por perda usa `motivo` textual.

### Onde mora cada trava (camadas)

| Camada | Helper / Componente | Onde | Finalidade |
|---|---|---|---|
| **1 — UI** | `<Can allow={['ADMIN','PASTOR','SECRETARIO']}>` | `app/components/**` + `app/routes/app/estoque/**` | Esconde botões e rotas. **UX, não segurança.** |
| **1b — UI condicional** | `tipo === "PATRIMONIO" && <NumeroSerie />` | `FormItemEstoque` | Campos de formulário aparecem só para o tipo relevante (UX inline). |
| **2 — Loader/Action** | `assertCanManageEstoque(user)` ou `assertCanBaixarPerda(user)` antes de I/O | `app/routes/app/estoque/**` | Gate de navegação. 403 se bypass via URL. |
| **3 — Service** | `assertCan*` + `assertSaldoQuantidade` + `assertTransicaoPatrimonioValida` + `$transaction` | `app/lib/estoque.server.ts`, `movimentacao.server.ts`, `patrimonio.server.ts`, `manutencao.server.ts` | **Única segurança real.** Barreira antes do DB. |

### 4 services previstos no Módulo Estoque + Patrimônio

| Service | Responsabilidade | RN coberta |
|---|---|---|
| `app/lib/estoque.server.ts` | CRUD `ItemEstoque` (listar, criar, editar, arquivar) + helpers `assertSaldoQuantidade` | RN-EST-01, RN-EST-02 |
| `app/lib/movimentacao.server.ts` | `criarMovimentacao` (ENTRADA/SAIDA com trava de quantidade) | RN-EST-02 |
| `app/lib/patrimonio.server.ts` | State machine helpers (`assertTransicaoPatrimonioValida`), asserts de tipo | RN-EST-01, RN-EST-03, RN-EST-05 |
| `app/lib/manutencao.server.ts` | `enviarParaManutencao`, `retornarDeManutencao`, `baixaPorPerda`, `verificarAlertaManutencaoSemPrazo` (RN-EST-04) | RN-EST-03, RN-EST-04, RN-EST-05 |

> **Convenção de nomes:** `*.server.ts` garante tree-shaking do bundle do cliente (Vite). Services com sufixo `.server` NUNCA vão para o cliente (helper `app/db/prisma.server.ts` também).

### Rotas previstas (todas em `app/routes/app/estoque/**`)

- `estoque._index.tsx` — listagem unificada (filtros: tipo, status, busca textual).
- `estoque.novo.tsx` — criar item (form com campos condicionais por tipo).
- `estoque.$id.tsx` — detalhe do item + 2 abas: Movimentações (CONSUMO) / Manutenções (PATRIMONIO).
- `estoque.$id.editar.tsx` — editar item.
- `estoque.$id.movimentacao.nova.tsx` — registrar movimentação (ENTRADA/SAIDA com toggle).
- `estoque.$id.manutencao.nova.tsx` — enviar para manutenção externa.
- `estoque.$id.manutencao.retorno.tsx` — registrar retorno de manutenção.
- `estoque.$id.baixa-perda.tsx` — baixa por perda (ADMIN only).

### Padrão RBAC em 3 camadas (matriz completa do módulo)

| Operação \ Perfil | ADMIN | PASTOR | SECRETARIO | FINANCEIRO | LIDER_MIN. | DISCIPULADOR |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Ver listagem e detalhe | ✅ | ✅ | ✅ | 👁 | 👁 | 👁 |
| Criar/editar Item (qualquer tipo) | ✅ | ✅ | ✅ | 🚫 | 🚫 | 🚫 |
| Arquivar Item | ✅ | ✅ | ✅ | 🚫 | 🚫 | 🚫 |
| Movimentação ENTRADA (Consumo) | ✅ | ✅ | ✅ | 🚫 | 🚫 | 🚫 |
| Movimentação SAÍDA (Consumo, com nomeRetirante) | ✅ | ✅ | ✅ | 🚫 | 🚫 | 🚫 |
| Enviar para Manutenção | ✅ | ✅ | ✅ | 🚫 | 🚫 | 🚫 |
| Retornar de Manutenção | ✅ | ✅ | ✅ | 🚫 | 🚫 | 🚫 |
| Baixa por Perda Total (RN-EST-05) | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Ver aba Manutenções (detalhe) | ✅ | ✅ | ✅ | 👁 | 👁 | 👁 |

> 👁 = leitura / 🚫 = bloqueado / ✅ = permitido. Defesa em 3 camadas obrigatória: `<Can>` (UI) + `assertCan*` (loader) + `assertCan*` (service). **Diferencial crítico:** Baixa por Perda é única operação restrita a ADMIN (RN-EST-05), mesmo que SECRETARIO/PASTOR possam tudo o mais.

### Comandos de verificação específicos

```bash
# Rodar testes apenas do Estoque (quando services existirem em S11+)
pnpm test:watch -- estoque
pnpm test:watch -- patrimonio
pnpm test:watch -- movimentacao
pnpm test:watch -- manutencao

# Cobertura focada nos services de regra de negócio (gate: 100%)
pnpm test:coverage -- app/lib/estoque.server.ts \
                     app/lib/movimentacao.server.ts \
                     app/lib/patrimonio.server.ts \
                     app/lib/manutencao.server.ts

# Validar Zod schemas
pnpm test:watch -- schemas/estoque
pnpm test:watch -- schemas/movimentacao
pnpm test:watch -- schemas/manutencao

# E2E específicos (Playwright, a serem criados em S11+)
pnpm test:e2e -- estoque-cadastro
pnpm test:e2e -- estoque-movimentacao
pnpm test:e2e -- patrimonio-manutencao
pnpm test:e2e -- patrimonio-baixa-perda
pnpm test:e2e -- manutencao-alerta-sem-prazo  # RN-EST-04
```

### Como rodar o Módulo Estoque localmente

1. **Build de prod** (não `pnpm dev` — ver ⚠️ critical gotcha do ciclo 1):
   ```bash
   pnpm build && pnpm start
   # → http://localhost:3000
   ```
2. **Login** com perfil almoxarife: `secretario@igreja.local` / `secretario123` (credenciais do seed).
3. **Navegar:** `/app/estoque` → criar item (tipo CONSUMO, "Papel A4", quantidade 100) → `/app/estoque/:id/movimentacao/nova` → registrar SAÍDA de 5 pacotes com `nomeRetirante` → saldo atualiza para 95.
4. **Patrimônio:** com perfil `admin@igreja.local` / `admin123` → criar item (tipo PATRIMONIO, "Projetor BenQ", `numeroSerie: PJ-001`) → enviar para manutenção → ver `statusPatrimonio = EM_MANUTENCAO`.
5. **Verificar Camada 2:** acessar `/app/estoque/novo` direto na URL com perfil `discipulador@igreja.local` → loader redireciona para `/app/estoque` (RN-EST-01).
6. **Verificar Camada 3:** bypass programático via `curl` à rota `/app/estoque/novo` retorna 403 se perfil não-almoxarife (helper `assertCanManageEstoque` chama PRIMEIRO).

### Quais RAGs ler **antes** de tocar em código de Estoque/Patrimônio

**Obrigatórios (não-negociáveis):**

1. **`security-rbac-matrix`** — matriz 6 perfis × 6 domínios, helpers `assertCanManageEstoque`, `assertCanBaixarPerda`, `assertCanMovimentarConsumo`.
2. **`pattern-3-layer-rbac`** — UI / loader / service. Camada 3 é a única segurança real.
3. **`convention-prisma-sqlite`** — `$transaction` workflow, `onDelete: Restrict`, enums (`TipoItemEstoque`, `StatusItemPatrimonio`).

**Específicos do módulo (ciclo 3):**

4. **`pattern-estoque-trava-quantidade`** (high) — `assertSaldoQuantidade` antes do I/O, parallel conceitual ao `assertSaldoSuficiente` do Financeiro.
5. **`pattern-patrimonio-status-state-machine`** (high) — helper `assertTransicaoPatrimonioValida`, RBAC fina (Baixa por Perda só ADMIN).
6. **`pattern-manutencao-alerta-manual`** (medium) — RN-EST-04 alerta on-consulta (sem cron), idempotência 24h, escalonamento (6 dias / 30 dias).
7. **`convention-tipos-item-estoque`** (medium) — `discriminatedUnion` Zod para `CONSUMO` vs `PATRIMONIO`, helpers `assertItemIsConsumo` / `assertItemIsPatrimonio`.

**Complementares (transervsais):**

8. **`lgpd-igreja-conect`** — `nomeRetirante` (texto livre, sem PII cadastrada) e `motivo` (baixa por perda) NÃO vão para log de auditoria.
9. **`convention-monetary-values`** — `ManutencaoAtivo.custoCentavos: Int?` (custo de manutenção) é em centavos, segue convenção.
10. **`architecture-estoque`** — (a ser criado em ciclo 3) — visão macro, lifecycles, RBAC fina do módulo.
11. **`lesson-route-service-bypass`** — **nunca** `prisma.*` direto em loader/action de `/app/estoque/**`.
12. **`lesson-prisma-7-commit-settle-e2e`** — em E2E, `page.goto` logo após `criarMovimentacao` pode não ver a movimentação criada. Workaround: `dbSettle(100)`.

### Exemplo de service signature (referência canônica)

```ts
// app/lib/movimentacao.server.ts (esboço — implementação é no ciclo 3, Fase 5)
export async function criarMovimentacao(
  input: MovimentacaoCreateInput,
  user: SessionUser
): Promise<MovimentacaoEstoque> {
  // CAMADA 3 (RBAC) — PRIMEIRO, antes de qualquer I/O.
  assertCanMovimentarConsumo(user);

  // Validações Zod (RN-EST-02: nomeRetirante obrigatório para delta<0).
  const parsed = MovimentacaoCreateSchema.parse(input);

  // CAMADA 3 (RN-EST-02) — trava de quantidade ANTES do I/O.
  await assertSaldoQuantidade(parsed.itemId, parsed.delta, "Movimentação");

  // Atomicidade: movimentação + atualização de quantidade em $transaction.
  return prisma.$transaction(async (tx) => {
    const movimentacao = await tx.movimentacaoEstoque.create({ data: parsed });
    await tx.itemEstoque.update({
      where: { id: parsed.itemId },
      data: { quantidade: { increment: parsed.delta } },
    });
    return movimentacao;
  });
}
```

> **Assinaturas canônicas** (referência para implementação no ciclo 3, Fase 5):
> - `estoque.server.ts`: `listarItens(user, options)`, `criarItem(input, user)`, `editarItem(id, input, user)`, `arquivarItem(id, user)`, `getItemById(id, user)`, `assertSaldoQuantidade(itemId, delta, context)`.
> - `movimentacao.server.ts`: `criarMovimentacao(input, user)`, `listarMovimentacoesPorItem(itemId, user)`.
> - `patrimonio.server.ts`: `assertItemIsPatrimonio(item)`, `assertItemIsConsumo(item)`, `assertTransicaoPatrimonioValida(origem, destino, context)`, `assertItemHasNumeroSerie(item)`.
> - `manutencao.server.ts`: `enviarParaManutencao(input, user)`, `retornarDeManutencao(manutencaoId, dataRetorno, user)`, `baixaPorPerda(itemId, motivo, manutencaoId, user)`, `verificarAlertaManutencaoSemPrazo(itemId, user)` (RN-EST-04, gatilho on-consulta).

### Glossário do Módulo Estoque + Patrimônio

| Termo | Significado |
|---|---|
| **Item de Estoque (Consumo)** | Material descartável ou de uso contínuo (papel A4, limpeza, pilhas, materiais de ceia). `TipoItemEstoque.CONSUMO`. `quantidade` é estoque atual (incrementa/decrementa via `MovimentacaoEstoque`). |
| **Item de Estoque (Patrimônio)** | Bem permanente, físico e identificável (cadeira, projetor, microfone, instrumento). `TipoItemEstoque.PATRIMONIO`. `quantidade` é geralmente 1; `numeroSerie` é obrigatório e único; `statusPatrimonio` é obrigatório. |
| **Movimentação de Estoque** | Entrada/saída de item de consumo. `MovimentacaoEstoque` — pode ser entrada (delta>0, soma à quantidade) ou saída (delta<0, subtrai, com trava de quantidade). |
| **`nomeRetirante`** | Texto livre da pessoa que pegou o item no almoxarifado (RN-EST-02). **Obrigatório** para saída, opcional para entrada. **Não vincula** a `Membro` (decisão consciente: reduz atrito operacional e elimina PII). |
| **`autorizadoPorId`** | FK para `Membro` que autorizou a movimentação. Carimbo automático do `user.id` da sessão. Imutável. |
| **Manutenção Externa** | Envio de patrimônio para assistência técnica. `ManutencaoAtivo` — registra `assistenciaTecnica`, `enderecoAssistencia`, `numeroOs?`, `dataEnvio`, `prazoTermino?`, `dataRetorno?`, `foiPerdaTotal`, `urlLaudoTecnico?` (null neste ciclo). |
| **Status de Patrimônio** | `DISPONIVEL`, `EM_MANUTENCAO`, `BAIXADO_PERDA` (RN-EST-01/03/05). State machine: `BAIXADO_PERDA` é terminal. |
| **`numeroSerie`** | Identificador único do bem (constraint `@unique` no schema). **Obrigatório** para PATRIMONIO, **proibido** para CONSUMO. |
| **`localizacaoFisica`** | Texto livre onde o item está ("Sala de som", "Cozinha", "Galpão do louvor"). Recomendado para PATRIMONIO, opcional para CONSUMO. |
| **Baixa por Perda** | Operação destrutiva (item sai permanentemente do patrimônio). Apenas ADMIN (RN-EST-05). `motivo` textual obrigatório (sem upload de laudo neste ciclo — `urlLaudoTecnico` permanece null). |
| **Alerta de Manutenção sem Prazo (RN-EST-04)** | On-consulta, sem cron job (decisão do brief §5.1). Gatilho: loader de `/app/estoque/:id` e `/app/alertas`. Idempotência 24h. Escalonamento: 6 dias (aviso) / 30 dias (urgente). |
| **Trava de Quantidade** | Bloqueio automático se `quantidade_atual + delta < 0` (RN-EST-02). Implementada no service via `assertSaldoQuantidade` — **nunca** apenas na UI. |
| **`assertSaldoQuantidade`** | Helper canônico em `app/lib/estoque.server.ts`. Lança `Response(409)` se item não tem quantidade suficiente. PRIMEIRO no service, antes do `$transaction`. Parallel conceitual ao `assertSaldoSuficiente` do Financeiro. |
| **`assertCanManageEstoque`** | Helper em `app/lib/rbac.server.ts`. Lança `Response(403)` se user não tem permissão de criar/editar/arquivar Item (ADMIN, PASTOR, SECRETARIO — matriz do ciclo 3 §4.9). |
| **`assertCanMovimentarConsumo`** | Helper em `app/lib/rbac.server.ts`. Lança `Response(403)` se user não pode criar movimentação (mesma lista de perfis). |
| **`assertCanManagePatrimonio`** | Helper em `app/lib/rbac.server.ts`. Lança `Response(403)` se user não pode enviar/retornar manutenção (mesma lista de perfis). |
| **`assertCanBaixarPerda`** | Helper **mais restritivo** em `app/lib/rbac.server.ts`. Lança `Response(403)` se user não é ADMIN (RN-EST-05 explícito). PASTOR e SECRETARIO recebem 403. |
| **Item Arquivado** | Item com `ativo = false` (proposta pendente `decision-itemEstoque-soft-delete`). Some da listagem padrão, não aceita movimentações, mas mantém histórico. |

### Decisão pendente: `ItemEstoque.ativo` (proposta do ciclo 3)

- **Proposta:** adicionar campo `ativo: Boolean @default(true)` ao model `ItemEstoque` para soft-delete (arquivamento). Espelha decisão `Caixa.ativo` do ciclo 2 (RAG `decision-caixa-soft-delete`, já aprovado em 2026-06-14).
- **Status:** `pending` no RAG `decision-itemEstoque-soft-delete` (a ser criado na Fase 2 do ciclo 3). Aguarda validação do `prd-reviewer` na **Fase 2 (Requisitos)**.
- **Helpers que JÁ antecipam a checagem:** `assertSaldoQuantidade` (RAG `pattern-estoque-trava-quantidade` §2.1) **já inclui** a checagem de `item.ativo === false` — ganha null-safe (`item.ativo === undefined → trata como true`) se a migration for aprovada.
- **Não** gerar migration (`pnpm prisma migrate dev --name add_ativo_to_item_estoque`) enquanto o RAG estiver `pending`. O `prd-reviewer` valida, depois a Fase 5 gera a migration.
- **Ver:** `.harness/RAG/decision-itemEstoque-soft-delete.md` (a ser criado em ciclo 3 Fase 2) + `brief.md §5.3` (proposta original) + `brief.md §9.5` pendência #5.

### Métrica macro do ciclo 3 (definition of done)

> *"O ciclo 3 é considerado bem-sucedido quando um `SECRETARIO` consegue, em menos de 2 minutos, cadastrar 5 pacotes de papel A4 no estoque de Consumo, registrar uma saída de 2 pacotes informando o nome do retirante, ver o saldo atualizar para 3 pacotes, e o `ADMIN` consegue abrir o detalhe do item e ver o histórico completo de movimentações com nome do autorizador e do retirante."* — `brief.md §7.1`

**Testes de borda obrigatórios (17, do brief §7.3):**

- Saída com `nomeRetirante` vazio → 400.
- Saída que deixa estoque negativo → 409 (RN-EST-02 + trava de negócio).
- Entrada sem justificativa → passa (opcional).
- Saída sem justificativa → 400 (obrigatória).
- Enviar para manutenção item `CONSUMO` → 400 (trava de tipo).
- Enviar para manutenção item já em manutenção → 400.
- Manutenção sem `assistenciaTecnica` ou sem `enderecoAssistencia` → 400 (RN-EST-03).
- Manutenção sem `prazoTermino` → passa (opcional, dispara §4.6).
- Retorno de manutenção com `dataRetorno < dataEnvio` → 400.
- Baixa por perda por `SECRETARIO` → 403 (RN-EST-05).
- Baixa por perda por `PASTOR` → 403 (RN-EST-05).
- Baixa por perda por `ADMIN` em item `DISPONIVEL` → 400.
- Baixa por perda por `ADMIN` sem `motivo` → 400.
- Item com patrimônio mesmo `numeroSerie` → 409 (unique).
- Listagem filtra itens com `ativo = false` por padrão.
- DISCIPULADOR tentando `/app/estoque/novo` → 403 em todas as 3 camadas.
- FINANCEIRO tentando criar movimentação de saída → 403 em todas as 3 camadas.

### Limites conhecidos do Módulo Estoque + Patrimônio

| Limite | Onde | Mitigação |
|---|---|---|
| **Sem cron job** | RN-EST-04 alerta | On-consulta via loader (gated + idempotente 24h). Migração para cron em ciclo futuro. |
| **Sem upload de laudo** | RN-EST-05 anexo | `motivo` textual. Migração para S3/MinIO em ciclo futuro. |
| **Sem upload de foto** | Patrimônio sem foto | `localizacaoFisica` textual. Migração para S3/MinIO em ciclo futuro. |
| **Sem sincronização Estoque ↔ Financeiro** | Compra de estoque e manutenção | Lançamento manual pelo `FINANCEIRO` (enum `CategoriaLancamento.COMPRA_ESTOQUE` e `MANUTENCAO` já existem). Integração automática backlog. |
| **Sem inventário físico mobile** | Reconciliação de estoque | Script `pnpm audit:estoque` (backlog). |
| **Sem relatório de curva ABC** | Consumo por item | Loader básico + filtros. Relatório avançado backlog. |
| **BAIXADO_PERDA é terminal** | Item perdido não volta | Decisão consciente (auditoria). Para "recuperar" item perdido, criar item NOVO. |
| **SQLite single-writer** | `dev.db` | 1 processo Node + `$transaction` atômico. Postgres futuro é mudança aditiva. |

---

## Módulo Relatórios Financeiros (ciclo 4)

> **Escopo único do ciclo 4 (2026-06-20+):** 5 páginas de leitura agregada em `/app/financeiro/relatorios/**` (Hub + DRE + Balancete + Fluxo de Caixa + Customizado) que transformam o repositório bruto de `Lancamento` em inteligência pastoral/tesouraria. **Camada read-only sobre o Módulo Financeiro do ciclo 2** — sem migration, sem novos models Prisma, sem novas regras de negócio. As 5 RNs já existentes (`RN-FIN-01` a `05`) são suficientes; este ciclo **lê** o que já foi escrito.
>
> **Fonte canônica:** [`brief-relatorios.md`](../../brief-relatorios.md) §4 (Escopo), §5 (Decisões), §6 (Restrições), §7 (Sucesso), §8 (Não-objetivos). Brief aprovado pelo usuário em 2026-06-20T15:35Z, 489 linhas, 9 seções.
>
> **Cross-refs principais:** [`brief-mvp-financeiro.md`](../../brief-mvp-financeiro.md) (ciclo 2 — base) + [`prisma/schema.prisma`](../../prisma/schema.prisma) (model `Lancamento` + enums) + [`app/lib/finance.server.ts`](../../app/lib/finance.server.ts) (services existentes para extensão).

### Stack do módulo

Mesma dos ciclos 1–3. **Nada de novo** no ciclo 4: React Router 7.17 SSR, Prisma 7.8 + SQLite, Tailwind 4, Vite 8, TypeScript 5.9 strict, Zod 4, bcryptjs. **Sem** `pdfkit`, `puppeteer`, `lucide-react`, `recharts`. Charts são SVG inline; export é CSV nativo (RFC 4180). Decisões conscientes:

- **CSV em vez de PDF** (brief §5.2): sem dependências externas com peso considerável. PDF diferido para ciclo 6+.
- **SVG inline em vez de lib de ícones** (brief §5.5): consistência com `Sidebar.tsx` e `TopbarAutenticada.tsx`. ~25 SVGs em `app/components/icons/FinanceIcons.tsx`.
- **Placeholders em vez de features fake** (brief §5.6, §5.7): cards "Projeção Próximo Mês" e filtro "Status" renderizam placeholder cinza. Implementar "fake" seria mentir para o usuário.

### Onde mora cada trava (camadas)

| Camada | Helper / Componente | Onde | Finalidade |
|---|---|---|---|
| **1 — UI** | `<Can allow={['ADMIN','PASTOR','FINANCEIRO']}>` + item "Relatórios" some do menu para SECRETARIO | `app/components/Can.tsx` + `app/components/Sidebar.tsx` | Esconde controles. **UX, não segurança.** |
| **2 — Loader/Action** | `assertCanSeeRelatorios(user)` antes de I/O | `app/routes/app/financeiro/relatorios/**.tsx` (5 loaders + 1 action de export CSV) | Gate de navegação. 403 se bypass via URL. |
| **3 — Service** | `assertCanSeeRelatorios` PRIMEIRO + `prisma.lancamento.groupBy(...)` em `Int` cents | `app/lib/relatorios.server.ts` (5 funções públicas) + `app/lib/relatorios-csv.server.ts` (1 função de export) | **Única segurança real.** Barreira antes do DB. |

### 6 services previstos no Módulo Relatórios Financeiros

| Service | Responsabilidade | RN coberta |
|---|---|---|
| `app/lib/relatorios.server.ts` → `getDRE` | Agrega entradas e saídas por categoria em 1 período (DRE simplificado) | (read-only sobre RN-FIN-01/04) |
| `app/lib/relatorios.server.ts` → `getBalanceteMensal` | 4 KPIs (Saldo Anterior / Entradas / Saídas / Saldo Atual) + tabela por categoria para 1 mês | (read-only) |
| `app/lib/relatorios.server.ts` → `getFluxoCaixa` | Série temporal de 12 meses (entradas / saídas / saldo acumulado) | (read-only) |
| `app/lib/relatorios.server.ts` → `getRelatorioCustomizado` | Query filtrada com 6 dimensões (período / tipo / categoria / membro / caixa / status-placeholder) + paginação | (read-only) |
| `app/lib/relatorios.server.ts` → `exportarLancamentosCSV` | Server-side CSV download (RFC 4180 + BOM + `;` + Cache-Control no-store) | (read-only) |
| `app/lib/relatorios-csv.server.ts` | Helpers `escapeCsvField`, `formatValorCsv`, `montarCabecalhoCsv`, `exportarLancamentosCSV` | (regra de responsabilidade única — separado de `relatorios.server.ts`) |

> **Convenção de nomes:** services com sufixo `.server.ts` garantem tree-shaking do bundle do cliente (Vite). Separar `relatorios-csv.server.ts` de `relatorios.server.ts` segue **regra de responsabilidade única** (CSV é formato de export, não regra de negócio). Helpers podem ser reusados em futuros exports (PDF, JSON).

### 5 rotas previstas em `/app/financeiro/relatorios/**`

- `relatorios._index.tsx` — Hub (grid 2×2 com 4 cards grandes + bloco secundário "Relatório de Transparência 2024" placeholder).
- `relatorios.dre.tsx` — DRE (3 KPIs Entradas/Saídas/Resultado + grid Entradas por Tipo + Saídas por Categoria).
- `relatorios.balancete.tsx` — Balancete Mensal (4 KPIs + tabela Resumo por Categoria + side card Distribuição de Saídas em donut SVG).
- `relatorios.fluxo-caixa.tsx` — Fluxo de Caixa (4 KPIs + SVG line chart Entradas/Saídas/Saldo + side card Projeção placeholder).
- `relatorios.customizado.tsx` — Customizado (filtros + KPIs + tabela paginada + ação de export CSV via `?export=csv`).

**Helper RBAC novo:** `RELATORIOS_CARGOS = ["ADMIN", "PASTOR", "FINANCEIRO"] as const` (em `app/lib/rbac.server.ts`). **SECRETARIO BLOQUEADO** (mesmo podendo acessar o módulo financeiro operacional) — decisão de produto (brief §3.1, §5.3).

### Matriz RBAC fina do Módulo Relatórios Financeiros

| Operação \ Perfil | ADMIN | PASTOR | SECRETARIO | FINANCEIRO | LIDER_MIN. | DISCIPULADOR |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Ver Hub de Relatórios (`/app/financeiro/relatorios`) | ✅ | ✅ | 🚫 | ✅ | 🚫 | 🚫 |
| Ver DRE / Balancete / Fluxo de Caixa | ✅ | ✅ | 🚫 | ✅ | 🚫 | 🚫 |
| Ver Relatório Customizado | ✅ | ✅ | 🚫 | ✅ | 🚫 | 🚫 |
| Export CSV (Qualquer relatório) | ✅ | ✅ | 🚫 | ✅ | 🚫 | 🚫 |
| Drill-down (clicar categoria → `/app/financeiro/lancamentos?...`) | ✅ | ✅ | n/a | ✅ | n/a | n/a |
| Item "Relatórios" no Sidebar | ✅ | ✅ | 🚫 | ✅ | 🚫 | 🚫 |

> 👁 = leitura / 🚫 = bloqueado / ✅ = permitido / n/a = sem acesso upstream. SECRETARIO é BLOQUEADO nas 3 camadas (UI some do menu, loader 403, helper 403). Defesa em 3 camadas comprovada por teste E2E: SECRETARIO logado digitando `/app/financeiro/relatorios` direto na URL → 403.

### 2 componentes compartilhados previstos

- `<FiltrosPeriodo />` (`app/components/FiltrosPeriodo.tsx`) — 4 presets (7d / 30d / mês corrente / ano) + botão "Personalizado" que abre 2 inputs `<input type="date">`. Controlado via `useState`. Reutilizado em DRE, Fluxo de Caixa e Customizado.
- `<KpiCard />` (`app/components/KpiCard.tsx`) — card com ícone colorido + badge opcional + valor em `text-2xl font-bold` + subtítulo. Reutilizado em todos os 5 relatórios (economia estimada: ~120 linhas duplicadas).

### Padrões críticos (estender, não reinventar)

#### Queries de agregação (`prisma.lancamento.groupBy`)

```ts
// Padrão canônico (estende pattern-trava-saldo-service — read-only)
export async function getDRE(periodo: { inicio: Date; fim: Date }, user: SessionUser): Promise<DREData> {
  // CAMADA 3 — PRIMEIRO, antes de qualquer I/O
  assertCanSeeRelatorios(user);
  assertPeriodoValido(periodo); // inicio < fim, lança 400 se inválido

  const [entradas, saidas] = await Promise.all([
    prisma.lancamento.groupBy({
      by: ["categoria"],
      where: { dataCompetencia: { gte: periodo.inicio, lt: periodo.fim }, tipo: "ENTRADA" },
      _sum: { valorCentavos: true },
      _count: { _all: true },
    }),
    prisma.lancamento.groupBy({
      by: ["categoria"],
      where: { dataCompetencia: { gte: periodo.inicio, lt: periodo.fim }, tipo: "SAIDA" },
      _sum: { valorCentavos: true },
      _count: { _all: true },
    }),
  ]);

  const totalEntradasCentavos = entradas.reduce((acc, e) => acc + (e._sum.valorCentavos ?? 0), 0);
  const totalSaidasCentavos = saidas.reduce((acc, s) => acc + (s._sum.valorCentavos ?? 0), 0);

  return {
    periodo,
    totalEntradasCentavos,
    totalSaidasCentavos,
    resultadoLiquidoCentavos: totalEntradasCentavos - totalSaidasCentavos,
    entradasPorCategoria: mapCategorias(entradas, totalEntradasCentavos),
    saidasPorCategoria: mapCategorias(saidas, totalSaidasCentavos),
  };
}
```

**Ver [`.harness/RAG/pattern-relatorios-aggregations.md`](../../.harness/RAG/pattern-relatorios-aggregations.md)** para detalhes completos (filtros de data semi-abertos, edge cases, Fluxo de Caixa com `findMany` + `Map` em memória, anti-exemplos).

#### Filtros de data — sempre semi-aberto `[gte, lt)`

```ts
// SEMPRE: dataCompetencia: { gte: inicio, lt: fim }
// NUNCA: dataCompetencia: { gte: inicio, lte: fim }  ← meses consecutivos sobrepõem no boundary
```

**Presets no `<FiltrosPeriodo />`:**

| Preset | `inicio` | `fim` |
|---|---|---|
| 7 dias | `now - 7d` | `now` |
| 30 dias | `now - 30d` | `now` |
| Mês corrente | `now.getFullYear(), now.getMonth(), 1` | `now.getFullYear(), now.getMonth()+1, 1` |
| Ano corrente | `now.getFullYear(), 0, 1` | `now.getFullYear()+1, 0, 1` |
| Personalizado | `<input type="date">` × 2 | `<input type="date">` × 2 |

#### Export CSV (RFC 4180 + BOM UTF-8 + `;`)

```ts
// app/lib/relatorios-csv.server.ts
export async function exportarLancamentosCSV(filtros, user): Promise<string> {
  assertCanSeeRelatorios(user); // CAMADA 3
  // ... gera CSV com BOM UTF-8 (\uFEFF), separador ";", escape RFC 4180 ...
}

// app/routes/app/financeiro/relatorios/customizado.tsx (action)
return new Response(csv, {
  status: 200,
  headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="igreja-conect-relatorio-${YYYY-MM-DD}.csv"`,
    "Cache-Control": "no-store", // LGPD — dado financeiro sensível, nunca cachear
  },
});
```

**Ver [`.harness/RAG/convention-relatorios-csv-export.md`](../../.harness/RAG/convention-relatorios-csv-export.md)** para especificações completas (formato de valor `1234.56`, sinal negativo em SAÍDA, escape de aspas conforme RFC 4180, anti-exemplos).

#### Drill-down (navegação para `/app/financeiro/lancamentos?...`)

```tsx
// No DRE / Balancete: clicar em linha de categoria gera <Link>
import { Link } from "react-router";
<Link
  to={`/app/financeiro/lancamentos?caixa=${caixaId ?? ""}&categoria=${categoria}&periodo=${inicio.toISOString()}..${fim.toISOString()}`}
  prefetch="intent"
>
  {categoria} (R$ {formatBRLFromCents(total)})
</Link>
```

> **PENDÊNCIA (brief §5.4, §9.7 item #2):** a rota `/app/financeiro/lancamentos` (listagem geral) **não existe** hoje — só há `/app/financeiro/lancamentos/novo` (form) e `/app/financeiro/caixas/:id` (extrato). Decisão final na Fase 3 (Design): **Opção A** (criar `/app/financeiro/lancamentos` → S13 condicional) ou **Opção B** (redirecionar para `/app/financeiro/caixas/:id` com query params). PRD/SPEC deve fixar antes de S12.

### Comandos de verificação específicos

```bash
# Rodar testes apenas de Relatórios (quando services existirem em S11+)
pnpm test:watch -- relatorios
pnpm test:watch -- relatorios-csv

# Cobertura focada nos services de regra de negócio (gate: 100%)
pnpm test:coverage -- app/lib/relatorios.server.ts \
                     app/lib/relatorios-csv.server.ts \
                     app/lib/rbac.server.ts

# Validar Zod schemas
pnpm test:watch -- schemas/relatorios

# E2E específicos (Playwright, a serem criados em S11+)
pnpm test:e2e -- relatorios-hub
pnpm test:e2e -- relatorios-dre
pnpm test:e2e -- relatorios-balancete
pnpm test:e2e -- relatorios-fluxo-caixa
pnpm test:e2e -- relatorios-customizado
pnpm test:e2e -- relatorios-csv-export
pnpm test:e2e -- relatorios-rbac-secretario-bloqueado  # bypass via URL direta → 403
```

### Como rodar o Módulo Relatórios localmente

1. **Build de prod** (não `pnpm dev` — ver ⚠️ critical gotcha do ciclo 1):
   ```bash
   pnpm build && pnpm start
   # → http://localhost:3000
   ```
2. **Login** com perfil financeiro: `financeiro@igreja.local` / `fin123` (credenciais do seed).
3. **Navegar:** `/app/financeiro/relatorios` → escolher relatório (Hub) → ajustar filtros de período (preset ou personalizado) → ver KPIs + tabelas agregadas.
4. **Drill-down:** clicar em uma linha de categoria do DRE ou Balancete → abrir `/app/financeiro/lancamentos?categoria=X&periodo=...` (quando a rota existir, pendência §9.7 #2 do brief).
5. **Export CSV:** em `/app/financeiro/relatorios/customizado` → ajustar filtros → clicar "Exportar CSV" → download `igreja-conect-relatorio-YYYY-MM-DD.csv` → abrir no Excel/Sheets pt-BR (UTF-8 com BOM garante acentos corretos).
6. **Verificar Camada 2 (RBAC):** acessar `/app/financeiro/relatorios` direto na URL com perfil `secretario@igreja.local` → loader chama `assertCanSeeRelatorios` → 403.
7. **Verificar Camada 3 (RBAC service-side):** bypass programático via `curl` à rota `/app/financeiro/relatorios/dre` retorna 403 mesmo se loader for refatorado, porque `getDRE` chama `assertCanSeeRelatorios` PRIMEIRO.

### Quais RAGs ler **antes** de tocar em código de Relatórios

**Obrigatórios (não-negociáveis):**

1. **`security-rbac-matrix`** — matriz 6 perfis × 6 domínios, padrão de 3 camadas, helper `assertCan*`.
2. **`convention-monetary-values`** — `Int` em centavos, helpers `formatBRLFromCents` / `parseBRLToCents` / `assertNonNegative`. **Toda agregação em cents.**
3. **`pattern-3-layer-rbac`** — UI / loader / service. Camada 3 é a única segurança real.
4. **`pattern-relatorios-aggregations`** *(NOVO ciclo 4, high)* — `prisma.lancamento.groupBy` + soma em `Int` + filtros de data semi-abertos + edge cases (período vazio, categoria inválida, caixa arquivado).

**Específicos do módulo (ciclo 4):**

5. **`convention-relatorios-csv-export`** *(NOVO ciclo 4, high)* — RFC 4180 + BOM UTF-8 + separador `;` + escape de aspas + `Cache-Control: no-store` + SAÍDA com sinal negativo.

**Específicos do Financeiro (ciclo 2, herdados):**

6. **`architecture-financeiro`** (high) — visão macro, lifecycles, RBAC fina do Módulo Financeiro.
7. **`pattern-trava-saldo-service`** (critical) — ordem inegociável: `assertCan*` → `assertSaldoSuficiente` → `$transaction`. Para Relatórios (read-only), apenas `assertCan*` antes do I/O.

**Complementares (transversais):**

8. **`lgpd-igreja-conect`** — `Cache-Control: no-store` no CSV, logs de auditoria **nunca** registram `valorCentavos` (mesma regra do ciclo 2).
9. **`convention-prisma-sqlite`** — `$transaction` workflow (não usado em Relatórios read-only), `onDelete: Restrict`, enum `CategoriaLancamento` (7 valores) e `TipoLancamento` (ENTRADA/SAIDA).
10. **`lesson-route-service-bypass`** — **nunca** `prisma.*` direto em loader/action de `/app/financeiro/relatorios/**`. Sempre via `relatorios.server.ts`.
11. **`lesson-prisma-7-commit-settle-e2e`** — em E2E, `page.goto` logo após `criarLancamento` pode não ver os lançamentos espelho. Workaround: `dbSettle(100)` antes do `page.goto` no teste.

### Exemplo de service signature (referência canônica)

```ts
// app/lib/relatorios.server.ts (esboço — implementação é no ciclo 4, Fase 5)
export async function getBalanceteMensal(
  mesReferencia: { ano: number; mes: number }, // 1-12
  user: SessionUser
): Promise<BalanceteData> {
  // CAMADA 3 (RBAC) — PRIMEIRO, antes de qualquer I/O.
  assertCanSeeRelatorios(user);

  // Período: [primeiro dia do mês 00:00, primeiro dia do próximo mês 00:00)
  const inicio = new Date(mesReferencia.ano, mesReferencia.mes - 1, 1);
  const fim = new Date(mesReferencia.ano, mesReferencia.mes, 1);

  // Saldo anterior: agregação ANTES do início do mês (interpretação por tipo)
  const saldoAnterior = await prisma.lancamento.aggregate({
    where: { dataCompetencia: { lt: inicio } },
    _sum: { valorCentavos: true },
  });

  // Entradas / saídas do mês: groupBy por categoria
  const [entradas, saidas] = await Promise.all([
    prisma.lancamento.groupBy({
      by: ["categoria"],
      where: { dataCompetencia: { gte: inicio, lt: fim }, tipo: "ENTRADA" },
      _sum: { valorCentavos: true },
      _count: { _all: true },
    }),
    prisma.lancamento.groupBy({
      by: ["categoria"],
      where: { dataCompetencia: { gte: inicio, lt: fim }, tipo: "SAIDA" },
      _sum: { valorCentavos: true },
      _count: { _all: true },
    }),
  ]);

  // Soma em Int (cents)
  const totalEntradasCentavos = entradas.reduce((acc, e) => acc + (e._sum.valorCentavos ?? 0), 0);
  const totalSaidasCentavos = saidas.reduce((acc, s) => acc + (s._sum.valorCentavos ?? 0), 0);
  const saldoAtualCentavos = (saldoAnterior._sum.valorCentavos ?? 0) + totalEntradasCentavos - totalSaidasCentavos;

  return {
    periodo: { inicio, fim },
    saldoAnteriorCentavos: saldoAnterior._sum.valorCentavos ?? 0,
    totalEntradasCentavos,
    totalSaidasCentavos,
    saldoAtualCentavos,
    resumoPorCategoria: mergeCategorias(entradas, saidas),
  };
}
```

> **Assinaturas canônicas** (referência para implementação no ciclo 4, Fase 5):
> - `relatorios.server.ts` → `getDRE(periodo, user)`, `getBalanceteMensal(mesRef, user)`, `getFluxoCaixa(periodo, user)`, `getRelatorioCustomizado(filtros, user)`, `exportarLancamentosCSV(filtros, user)` (este último delega para `relatorios-csv.server.ts`).
> - `relatorios-csv.server.ts` → `escapeCsvField(value)`, `formatValorCsv(centavos)`, `montarCabecalhoCsv()`, `exportarLancamentosCSV(filtros, user)`. Helpers privados — apenas 1 export público.
> - `rbac.server.ts` → `RELATORIOS_CARGOS` (constante) + `assertCanSeeRelatorios(user)` (helper canônico, espelha `assertCanSeeFinancials`).

### Glossário do Módulo Relatórios Financeiros

| Termo | Significado |
|---|---|
| **Relatório Estruturado** | Agregação read-only sobre `Lancamento` que transforma o repositório bruto em inteligência (DRE, Balancete, Fluxo, Custom). **SEMPRE** com Camada 3 RBAC (`assertCanSeeRelatorios`). |
| **DRE (Demonstrativo de Resultado)** | Resumo de entradas (receitas) vs saídas (despesas) em 1 período, com resultado líquido (lucro/déficit). 3 KPIs + listas por categoria. |
| **Balancete Mensal** | 4 KPIs (Saldo Anterior / Entradas / Saídas / Saldo Atual) + tabela "Resumo por Categoria" para 1 mês específico. |
| **Fluxo de Caixa** | Série temporal (default: 12 meses) de entradas, saídas e saldo acumulado. Renderizado como SVG line chart inline. |
| **Relatório Customizado** | Query filtrada com 6 dimensões (período / tipo / categoria / membro / caixa / status-placeholder) + paginação + export CSV. |
| **`RELATORIOS_CARGOS`** | Constante em `app/lib/rbac.server.ts`: `["ADMIN", "PASTOR", "FINANCEIRO"]` (3 perfis). **SECRETARIO BLOQUEADO** (decisão de produto, brief §5.3). |
| **`assertCanSeeRelatorios`** | Helper canônico em `app/lib/rbac.server.ts`. Lança `Response(403)` se user não tem cargo em `RELATORIOS_CARGOS`. PRIMEIRO no service, antes de qualquer I/O. |
| **CSV (Comma-Separated Values)** | Formato de texto para dados tabulares. Convenção do ciclo 4: separador `;`, encoding UTF-8 com BOM, escape RFC 4180. **NÃO** é o "CSV com vírgula" do padrão inglês. |
| **BOM (Byte Order Mark)** | 3 bytes (`EF BB BF`) no início de arquivo UTF-8 que sinalizam encoding. Sem BOM, Excel pt-BR abre com Latin-1 e corrompe acentos. |
| **RFC 4180** | Especificação formal de CSV (Mozilla/IETF). Define aspas duplas como quote char, escape de aspas internas duplicadas, separador CRLF. |
| **Drill-down** | Navegação de uma célula agregada (categoria, total) para o detalhe (lista de lançamentos individuais). Implementado como `<Link>` com query params. |
| **`<FiltrosPeriodo />`** | Componente compartilhado com 4 presets (7d / 30d / mês corrente / ano) + botão "Personalizado" que abre 2 inputs `<input type="date">`. Reutilizado em DRE, Fluxo e Customizado. |
| **`<KpiCard />`** | Componente compartilhado com ícone colorido + badge opcional + valor + subtítulo. Reutilizado em todos os 5 relatórios. |
| **Filtro de Data Semi-Aberto** | `where.dataCompetencia: { gte: inicio, lt: fim }`. O `lt` (não `lte`) garante que meses consecutivos não se sobreponham no boundary. |
| **Projeção (placeholder)** | Card cinza com texto "Disponível em ciclo futuro — depende de módulo Contas a Pagar". Renderizado por `<ProjectionPlaceholder />` em Balancete (próximo mês) e Fluxo (próximos 30 dias). |
| **Status de Lançamento (placeholder)** | `<select disabled>` no Customizado com 4 opções visíveis mas não-clicáveis. Schema atual não tem campo `status` — diferido para ciclo 6+. |

### Restrições do ciclo 4 (não-objetivos, brief §8)

- ❌ **Export PDF.** Diferido (sem `pdfkit`/`puppeteer` por dependência externa pesada).
- ❌ **Envio de relatório por e-mail.** Sem SMTP no projeto.
- ❌ **Agendamento de relatórios (cron).** Sem jobs no projeto.
- ❌ **Projeção financeira real.** Depende de `ContaPagar` (não existe). Placeholder cinza.
- ❌ **Status de lançamento.** Schema não tem campo. Placeholder.
- ❌ **Conciliação bancária.** Caixas são internos (RN-FIN-01). Sem extrato bancário.
- ❌ **Multi-igreja / multi-tenant.** Uma instância = uma igreja.
- ❌ **Multi-moeda.** Apenas BRL.
- ❌ **Cache de relatório.** Toda geração é on-demand. Sem Redis.
- ❌ **Filtros por centro de custo.** Não há modelagem.
- ❌ **Drill-down em gráficos SVG.** Apenas clique em linhas de tabela.
- ❌ **Impressão formatada (CSS print).** `window.print()` simples.
- ❌ **Comparativo YoY automático.** Via filtro manual de período.
- ❌ **Auditoria visual de quem gerou cada relatório.** Logs de auditoria cobrem.

### Métrica macro do ciclo 4 (definition of done)

> *"O ciclo 4 é considerado bem-sucedido quando um `FINANCEIRO` consegue, em menos de 2 minutos, gerar o DRE do mês corrente, ver o total de entradas (verde), o total de saídas (vermelho) e o resultado líquido (azul), clicar em uma categoria para abrir o drill-down, e exportar a tabela do Relatório Customizado em CSV."* — `brief-relatorios.md §7.1`

**Testes de borda obrigatórios (12, do brief §7.3):**

- SECRETARIO acessando `/app/financeiro/relatorios` → 403 em Camada 2 (loader) + Camada 3 (helper).
- SECRETARIO digitando `/app/financeiro/relatorios/dre` direto na URL → 403 (sem fallback).
- DISCIPULADOR / LIDER_MINISTERIO → 403 em todas as 5 rotas.
- Mês sem lançamentos no DRE → zeros, listas vazias, sem crash.
- Mês sem categorias com movimento no Balancete → tabela oculta linhas vazias, totais zerados.
- Período com 0 resultados no Customizado → "Nenhum lançamento encontrado" + KPIs zerados.
- Filtro `categoria=BURRO` (inválida) → loader lança `Response(400)`.
- Filtro `periodo` com `inicio > fim` → loader lança `Response(400)`.
- Caixa arquivado no DRE → lançamentos continuam aparecendo (regra do ciclo 2).
- CSV com 1.280 registros → geração completa em < 500ms.
- CSV com `descricao = 'São Paulo & Cia.'` → escape RFC 4180 correto.
- 5 usuários logados simultaneamente gerando relatórios → sem contenção (SQLite serializa, latência < 2s).
- CSV sem BOM → Excel pt-BR reconhece UTF-8 se BOM presente; sem BOM, vira mojibake. Teste confere 3 primeiros bytes (`EF BB BF`).

### Limites conhecidos do Módulo Relatórios Financeiros

| Limite | Onde | Mitigação |
|---|---|---|
| **Sem PDF** | Export no Customizado | CSV cobre o caso real (Sheets pivot). PDF em ciclo 6+. |
| **Sem projeção real** | Cards "Projeção" no Balancete e Fluxo | Placeholder cinza. Depende de `ContaPagar` (ciclo 6+). |
| **Sem status** | Filtro no Customizado | `<select disabled>`. Depende de refactor de schema. |
| **Sem drill-down de gráfico** | SVG line chart no Fluxo | Apenas clique em linhas de tabela é navegável. |
| **Sem cache** | Toda geração on-demand | Sem Redis. Para volume muito alto (> 100k lançamentos), `$queryRaw` em ciclo futuro. |
| **Fuso do servidor** | `dataCompetencia` filtrada em `Date` local | Assumir fuso único. Migração para UTC puro em ciclo futuro. |
| **Fluxo de Caixa não escala para > 24 meses** | `findMany` + `Map` em memória | Limitar UI a 24 meses. Migrar para `prisma.$queryRaw` com `strftime` em ciclo 6+. |
| **SQLite single-writer** | `dev.db` | 1 processo Node + queries read-only (sem `$transaction`). Postgres futuro é mudança aditiva. |
| **Rota `/app/financeiro/lancamentos` não existe** | Drill-down pendente | Decisão na Fase 3 (Design): criar nova rota (S13) ou redirecionar para `/app/financeiro/caixas/:id` com query params. |

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
