# GUIDELINES — Igreja Conect

> **Convenções de código, contribuição e processo do projeto Igreja Conect.**
> Última atualização: 2026-08-13.

Este documento é a **fonte única** para decisões recorrentes sobre como escrever e integrar código no projeto. Quando algo aqui conflitar com um RAG específico (em `.harness/RAG/`), o RAG vence — mas o conflito deve ser reportado ao `rag-curator` para limpeza.

Documentos relacionados:

- [`docs/REGRAS_DE_NEGOCIO.md`](./REGRAS_DE_NEGOCIO.md) — regras de negócio (RN-MEM, RN-FIN, RN-EST, …).
- [`docs/DESCRIÇÃO_DOS_MODULOS.md`](./DESCRIÇÃO_DOS_MODULOS.md) — matriz RBAC + escopo de cada módulo.
- [`docs/architecture/ARCH.md`](./architecture/ARCH.md) — arquitetura técnica, ADRs, fluxos críticos.
- [`app/AGENTS.md`](../app/AGENTS.md) — mapa de contexto de `app/`.
- [`.harness/RAG/`](../.harness/RAG/) — decisões detalhadas por categoria.

---

## Sumário

1. [Stack & versão](#1-stack--versão)
2. [Estrutura de pastas](#2-estrutura-de-pastas)
3. [Convenções de sufixos](#3-convenções-de-sufixos-serverts-clientts)
4. [Aliases e paths](#4-aliases-e-paths)
5. [Valores monetários](#5-valores-monetários-em-centavos)
6. [RBAC — 3 camadas (defense in depth)](#6-rbac--3-camadas-defense-in-depth)
7. [LGPD & segurança](#7-lgpd--segurança)
8. [Storage / uploads](#8-storage--uploads)
9. [Sessão, cookies e CSRF](#9-sessão-cookies-e-csrf)
10. [Validação com Zod](#10-validação-com-zod)
11. [Testes](#11-testes)
12. [Lint, typecheck, formatação](#12-lint-typecheck-formatação)
13. [Commit, PR e changelog](#13-commit-pr-e-changelog)
14. [Perfis do Harness (Strict vs Lean)](#14-perfis-do-harness-strict-vs-lean)
15. [AGENTS.md por pasta](#15-agentsmd-por-pasta)
16. [Anti-patterns](#16-anti-patterns)
17. [Checklist antes de abrir PR](#17-checklist-antes-de-abrir-pr)

---

## 1. Stack & versão

| Camada | Tecnologia | Versão (fixada) |
|---|---|---|
| Runtime | Node | **24** (engines em `package.json`) |
| Framework | React Router | **7.16** |
| UI | React / React DOM | **19** |
| ORM | Prisma + adapter | **7.8** + `@prisma/adapter-better-sqlite3` |
| Estilo | Tailwind CSS + plugin Vite | **4.2** |
| Validação | Zod | **4.4** |
| Auth | bcryptjs | **3.x** |
| Testes unit | Vitest + jsdom + coverage-v8 | **4.1** |
| Testes E2E | Playwright | **1.60** |
| Storage | AWS SDK v3 | **3.700+** (S3-compat Garage/MinIO ou local) |
| Pipeline mídia | sharp, fluent-ffmpeg, clamdjs | últimas |
| TypeScript | **5.9** strict |

> **Regra:** nunca fixe versões em outro lugar que não `package.json`. Não usar `^` em produção (engines + Dockerfile travam a versão Node).

---

## 2. Estrutura de pastas

```
app/
├── AGENTS.md                    # mapa de contexto de app/
├── root.tsx                     # HTML shell + ErrorBoundary
├── routes.ts                    # config declarativa de rotas
├── app.css                      # entry CSS Tailwind v4
│
├── routes/                      # entry points + layouts top-level
│   ├── app/                     # rotas autenticadas /app/**
│   ├── public/                  # /login, /convite/:token, landing
│   └── api/                     # endpoints REST (uploads, search, files)
│
├── components/                  # ~80 componentes UI
│   └── fidelidade/              # subgrupo por domínio
│
├── lib/                         # services server-only + schemas + utils
│   ├── *.server.ts              # regra de negócio, Prisma, RBAC, sessões
│   ├── schemas/                 # Zod por domínio
│   ├── storage/                 # pipeline de uploads
│   ├── hooks/                   # hooks client-side
│   └── validators/              # Zod compartilhado
│
├── db/
│   └── prisma.server.ts         # singleton Prisma
│
├── api/                         # auth (login/logout) — endpoint único
└── welcome/                     # boilerplate RR (legado, NÃO usar)

prisma/
├── schema.prisma                # 27 models, 14 enums
├── migrations/                  # versionadas
├── seed.ts                      # idempotente
├── backups/                     # snapshots manuais
└── .backups/                    # backups automáticos

docs/
├── README.md
├── REGRAS_DE_NEGOCIO.md         # RN-XXX
├── DESCRIÇÃO_DOS_MODULOS.md     # RBAC matrix + escopo
├── GUIDELINES.md                # ESTE ARQUIVO
└── architecture/
    └── ARCH.md                  # arquitetura técnica

scripts/                         # bootstrap, backup, cleanup, smoke test
.harness/                        # Harness v6 (state, sprints, RAG, audit)
tests/                           # E2E helpers (Playwright)
coverage/                        # saída do Vitest --coverage
build/                           # saída de `pnpm build`
generated/                       # client Prisma gerado
data/                            # storage local (quando STORAGE_PROVIDER=local)
```

> **Regra:** toda nova pasta (com mais de 3 arquivos) precisa de `AGENTS.md` enxuto (≤ 40 linhas).

---

## 3. Convenções de sufixos (`.server.ts`, `.client.ts`)

| Sufixo | Significado | Importa em | Tree-shaking |
|---|---|---|---|
| `.server.ts` | **Server-only**. Prisma, bcrypt, secrets, sessão. | só server (loaders, actions, services) | Removido do bundle do cliente |
| `.client.ts` | **Client-only**. Hooks, libs que tocam `window`. | só client (componentes, hooks) | Removido do bundle do servidor |
| sem sufixo | **Isomórfico**. UI, utils puros, schemas Zod sem I/O. | ambos | mantido nos dois bundles |

**Regras:**

- ❌ Nunca importe `.server.ts` de um componente client-side.
- ❌ Nunca use `process.env` direto em `.client.ts` — passe via prop.
- ❌ Nunca exporte `prisma` de um arquivo sem sufixo (vaza).
- ✅ Helpers puros (ex: `cn.ts`, `masks.ts`, `format-date.ts`) ficam sem sufixo.
- ✅ Schemas Zod podem ficar em `schemas/*.ts` (isomórficos), mas validações com regra de negócio ficam em `*.server.ts`.

---

## 4. Aliases e paths

| Alias | Resolve para | Onde |
|---|---|---|
| `~/*` | `app/*` | `tsconfig.json` (`paths`) + `vite.config.ts` |
| `./+types/*` | gerado em `.react-router/types/` | `react-router typegen` (rodado por `pnpm typecheck`) |

**Regras:**

- ✅ Use `~` para imports internos (`import { prisma } from "~/db/prisma.server"`).
- ❌ Não use `../..` mais de 2 níveis — confunde leitura.
- ❌ Não use imports relativos partindo de `app/` para arquivos em `prisma/` — passe via service.
- ✅ Tipos RR7 vêm de `./+types/<arquivo>` (gerado); nunca criar manualmente.

---

## 5. Valores monetários em centavos

> **Fonte completa:** `.harness/RAG/convention-monetary-values.md`

**Regra absoluta:**

- Toda coluna monetária é `Int` com sufixo `Centavos` (`saldoCentavos`, `valorCentavos`, `valorTotalCentavos`).
- NUNCA `Float`, `Decimal`, `number` solto. Nem mesmo `bigint`.
- UI exibe via `formatBRLFromCents`; parse via `parseBRLToCents`.

**Helpers canônicos em `app/lib/money.server.ts`:**

```ts
formatBRLFromCents(123456)          // "R$ 1.234,56"
parseBRLToCents("R$ 1.234,56")      // 123456
assertNonNegative(cents, ctx)       // lança Response(400) se < 0 ou não-inteiro
```

**Onde aplicar:**

- `Caixa.saldoCentavos`, `Lancamento.valorCentavos`, `TransferenciaCaixa.valorCentavos`, `RequisicaoCompra.valorCentavos`.
- Parse no **action** (nunca no loader); format no **service** antes de retornar para a UI.
- Validações: `valorCentavos > 0`; `saldoCentavos >= valorCentavos` (RN-FIN-04).
- Helpers em `app/components/MoneyInput.tsx` cuidam de máscara e teclado pt-BR.

---

## 6. RBAC — 3 camadas (defense in depth)

> **Fonte completa:** `.harness/RAG/security-rbac-matrix.md` · `.harness/RAG/pattern-3-layer-rbac.md`

Toda decisão de acesso passa por 3 camadas obrigatórias:

```
┌─────────────────────────────────────────────────────────┐
│ Camada 1 — UI (app/components/)                        │
│ Renderiza condicional baseado em user.cargo              │
│ ❌ NÃO é fonte de verdade (bypass trivial via DevTools)  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Camada 2 — Loader/Action (app/routes/)                  │
│ requireRole(user, [...]) / assertCanSeeFinancials(user) │
│ ✅ Lança Response(403) → ErrorBoundary                  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Camada 3 — Service (app/lib/*.server.ts)                │
│ assertCanSeeFinancials(actor) revalida internamente     │
│ ✅ Lança erro de domínio (BusinessRuleError, etc.)      │
└─────────────────────────────────────────────────────────┘
```

**Single source of truth:** `app/lib/rbac.server.ts`. Toda nova checagem vive lá.

**Helpers prontos:**

- `requireRole(user, cargos: Cargo[])` — usado em loaders/actions.
- `assertCanSeeFinancials(user)` — dízimos (RN-MEM-03).
- `assertCanManageCaixa(user, caixaId)` — escopo de caixa.
- `MAX_DISCIPULOS = 12` (RN-MEM-04) — usado em `assignDisciple()`.

**Matriz completa:** [`docs/DESCRIÇÃO_DOS_MODULOS.md`](./DESCRIÇÃO_DOS_MODULOS.md).

---

## 7. LGPD & segurança

> **Fonte completa:** `.harness/RAG/lgpd-igreja-conect.md` · `.harness/RAG/lgpd-bases-legais-igreja.md`

**Regras obrigatórias:**

- **Senha:** bcryptjs (salt rounds ≥ 10), nunca plain-text em log/disco.
- **Sessão:** cookie `__session` httpOnly, sameSite=lax, secure em prod, **sliding 7d / absoluto 30d**.
- **IP em log:** SHA-256 antes de gravar em `AuditLog.ipHash` (helper em `app/lib/audit.server.ts`).
- **PII em log:** proibido. Use `safeLog({ userId, event, resourceId })`, nunca `safeLog({ email, telefone, cpf })`.
- **Soft-delete LGPD:** `Upload.deletedAt` (art. 18, VI). Hard-delete via job agendado em `retentionUntil`.
- **Dízimos** (RN-MEM-03): restritos a `ADMIN`, `PASTOR`, `FINANCEIRO`. UI esconde a aba + loader bloqueia + service revalida.
- **Rate limit:** `app/lib/rate-limit.server.ts` no `/login` (5 tentativas / 15min / IP).
- **AuditLog** é append-only. Não deletar registros.

**Não coletamos (LGPD, minimização):** CPF, RG, dados fiscais, dados de saúde, opinião política/religiosa detalhada.

---

## 8. Storage / uploads

> **Fonte completa:** código em `app/lib/storage/` + `.harness/RAG/convention-relatorios-csv-export.md` (padrão de export).

**Providers suportados:**

- `STORAGE_PROVIDER=local` → filesystem em `STORAGE_LOCAL_DIR` (default `./data/storage`).
- `garage` | `minio` | `rustfs` | `aws` | `r2` → S3-compat com AWS SDK v3.

**Pipeline assíncrono:**

```
cliente POST /api/uploads
  → bucket staging (raw)
  → Job (queue=media.process) enfileirado em SQLite
  → worker (app/lib/storage/worker.server.ts):
       1. magic bytes (detecção real de MIME)
       2. ClamAV (se STORAGE_CLAMAV_ENABLED=true)
       3. variants lg/md/sm (sharp) / áudio / vídeo (ffmpeg)
       4. move para bucket final
       5. deleta staging
       6. status = READY
  → client consulta /api/uploads/:id (poll ou webhook)
```

**Status:** `PROCESSING → SCANNING → TRANSCODING → READY | REJECTED | FAILED`.

**Regras:**

- ✅ Use sempre URL assinada (`getSignedPreviewUrl` / `getSignedDownloadUrl`) — TTL curta.
- ✅ Verifique `rejectionReason` antes de exibir (`virus_detected`, `mime_mismatch`, `too_large`).
- ❌ Nunca confiem em `declaredMime` enviado pelo cliente — só `detectedMime`.
- ✅ Soft-delete via `prisma.upload.update({ deletedAt: new Date() })`.
- ❌ Não exponha `bucket` ou `storageKeyPrefix` na UI.

---

## 9. Sessão, cookies e CSRF

- Cookie `__session` (não `session` — nome específico para evitar conflito com libs).
- Em **dev**: `httpOnly`, `sameSite=lax`, **sem** `secure` (HTTP localhost).
- Em **prod**: `httpOnly`, `sameSite=lax`, `secure` (HTTPS obrigatório).
- CSRF: RR7 já mitiga via `sameSite=lax`. Em endpoints sensíveis (`/api/*`), exigimos `Content-Type: application/json` para POSTs.
- **Sliding renewal:** cada request autenticado estende TTL por mais 7d, teto 30d abs.

**Sufixo `.server.ts` garante que o cookie só seja manipulado em SSR.**

---

## 10. Validação com Zod

**Schemas em `app/lib/schemas/` (isomórficos) ou inline no service (`*.server.ts`).**

```ts
// schema em app/lib/schemas/membros.ts
export const MembroCreateSchema = z.object({
  nome: z.string().min(3).max(120),
  tipo: z.enum(["MEMBRO_ATIVO", "CONGREGADO", "VISITANTE"]),
  email: z.string().email().optional().nullable(),
  telefone: z.string().regex(/^\d{10,11}$/).optional().nullable(),
  cargo: z.enum(["ADMIN", "PASTOR", ...]).optional().nullable(),
});

// no action da rota
const parsed = MembroCreateSchema.safeParse(formDataObject);
if (!parsed.success) {
  return data({ fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
}
```

**Regras:**

- ✅ Schemas são **fonte de verdade** — tipos TypeScript são inferidos (`z.infer<typeof Schema>`).
- ✅ Use `.flatten().fieldErrors` para mapear erros para o formulário.
- ❌ Não faça `JSON.parse(formData.get("payload"))` direto — valide antes.
- ✅ Em schemas financeiros, use `z.coerce.number().int().positive()` após parse pt-BR.
- ❌ Não use `as any` para silenciar validação.

---

## 11. Testes

> **Modo Strict:** TDD clássico RED → GREEN → REFACTOR, cobertura ≥ 85% por sprint.
> **Modo Lean:** Direct Coding (feature + teste na mesma iteração), cobertura ≥ 70%.
> O perfil ativo está em `.harness/state.json → project.profile`.

**Estrutura:**

| Tipo | Ferramenta | Localização | Quando |
|---|---|---|---|
| Unit | Vitest + jsdom | `app/**/*.test.{ts,tsx}`, ao lado do código | toda função pública (Strict) |
| Contrato | Vitest | `app/lib/__tests__/*.contract.test.ts` | endpoints críticos (login, transferências, fidelidade) |
| E2E | Playwright | `tests/*.e2e.test.ts` | fluxos críticos (login → ação → assert) |

**Convenções:**

- ✅ Nome do teste diz o **comportamento**, não o método: `"bloqueia 13º discípulo"` (não `"assignDisciple throws"`).
- ✅ 1 teste por comportamento, não por método.
- ✅ Mock apenas o necessário (Prisma é real em testes de integração).
- ❌ Não use `vi.spyOn` quando pode passar mock injetado.
- ❌ Não mocke o próprio módulo que está testando.
- ✅ Para LGPD/RBAC, sempre teste a matriz **positiva** (200) e **negativa** (403).
- ✅ Helpers em `tests/helpers/` (login, db reset).

---

## 12. Lint, typecheck, formatação

- **`pnpm typecheck`** — roda `react-router typegen && tsc --noEmit`. **Não commite com typecheck falhando.**
- **ESLint** — configurado em `.eslintrc.*` (quando presente); segue convenções do RR7.
- **Prettier** — opcional. Se usar, não reformate linhas não tocadas no diff.
- **Tailwind v4** — use `@theme` em `app.css` para tokens; utility-first no JSX.

---

## 13. Commit, PR e changelog

- **Mensagens em PT-BR.** Código (variáveis, funções) em inglês.
- **Conventional Commits** (adaptado):
  - `feat(membros): adiciona aba fidelidade financeira`
  - `fix(financeiro): corrige trava de saldo em transferência`
  - `refactor(storage): extrai pipeline de variants`
  - `test(escalas): cobre fluxo de indisponibilidade`
  - `docs(readme): atualiza quick start`
  - `chore(deps): bump prisma 7.8 → 7.8.1`
- **Escopo = pasta primária** (`membros`, `financeiro`, `estoque`, `lib`, `docs`, `harness`).
- ❌ Não use `git add .`. Sempre `git add <arquivos específicos>`.
- ✅ Commits granulares: 1 commit por mudança lógica.
- ✅ PR: usar template do repo; descrever **comportamento** (não código).
- **CHANGELOG.md** atualizado pelo agente `changelog-automator` ao final da sprint.

---

## 14. Perfis do Harness (Strict vs Lean)

Definido em `.harness/state.json → project.profile`:

| Item | Strict | Lean |
|---|---|---|
| TDD | **Obrigatório** (RED → GREEN → REFACTOR) | Recomendado (Direct Coding) |
| JSDoc em funções públicas | **Obrigatório** | Opcional |
| Coverage mínimo | **85%** | **70%** |
| Bloqueio por code review | sim (score < 70) | soft (não bloqueia) |
| Bloqueio por LGPD | sim | sim (sempre) |
| Documentação por sprint | completa (PRD + SPEC + design + sprints) | só PRD + SPEC enxutos |

**Para verificar:** `cat .harness/state.json | jq .project.profile`.

---

## 15. AGENTS.md por pasta

Toda pasta com mais de 3 arquivos relevantes deve ter `AGENTS.md` enxuto:

- **Limite estrito:** ≤ 40 linhas.
- **Seções obrigatórias:** Propósito (1-2 linhas) · Dependências (lista curta) · Mapa de Arquivos (links `file:///`).
- **Sem repetir conteúdo** de outros AGENTS.md — link, não duplique.
- **Atualize AGENTS.md** sempre que criar/mover/remover arquivos relevantes na pasta.
- **Quando criar uma pasta nova:** rode `documenter` antes de tocar em código, ou siga o template `skills/docs-curator/SKILL.md`.

---

## 16. Anti-patterns

### Código

- ❌ `Float` ou `Decimal` para valores monetários.
- ❌ `parseInt(valor, 10)` direto em UI — use `parseBRLToCents`.
- ❌ Checar `user.cargo === "ADMIN"` espalhado em 15 arquivos. Centralize em `rbac.server.ts`.
- ❌ Esconder aba financeira com `display: none` e considerar a proteção feita.
- ❌ Confiar em `enum` do Prisma como segurança (alguém pode mandar `cargo: "ADMIN"` via payload).
- ❌ Importar `prisma.server.ts` de componente client.
- ❌ Lançar `throw new Error("...")` em vez de `throw new Response("...", { status: 4xx })` em loaders.
- ❌ `JSON.parse(formData.get("payload"))` direto sem validar com Zod.
- ❌ Mutação fora de `$transaction` quando 2+ writes precisam ser atômicos.
- ❌ `if/else` aninhado em 4+ níveis — early return.

### Processo

- ❌ Commitar sem rodar `pnpm typecheck && pnpm test`.
- ❌ PR com 1000+ linhas (quebre em PRs menores).
- ❌ Mensagem de commit em inglês misturada com código em inglês (PT-BR no commit, inglês no código).
- ❌ Não atualizar AGENTS.md ao criar/mover arquivo.
- ❌ Sobrescrever `state-machine.json` (é contrato read-only).
- ❌ Rodar `pnpm dev` antes de `pnpm db:reset` em setup limpo.
- ❌ Misturar perfis (Strict + Lean) no mesmo sprint.

### Docs

- ❌ Duplicar conteúdo entre AGENTS.md e RAG — use cross-refs.
- ❌ AGENTS.md > 40 linhas.
- ❌ Documentar **como** o código funciona (visível no código) em vez de **por que** (decisões).
- ❌ README de boilerplate (este projeto não é mais "Welcome to React Router").
- ❌ `git add .` na pressa.

---

## 17. Checklist antes de abrir PR

```bash
# 1. Typecheck + tests
pnpm typecheck
pnpm test
pnpm test:e2e     # se a mudança tocar fluxo autenticado

# 2. Lint
pnpm lint

# 3. Build de produção
pnpm build

# 4. Verificações de domínio
# (a) RBAC: cada novo endpoint passou pelos 3 camadas?
# (b) LGPD: nenhum PII em log, IP hashado, soft-delete respeitado?
# (c) Money: tudo em centavos, format aplicado na UI?
# (d) AGENTS.md atualizado?

# 5. Commit
git add <arquivos>
git commit -m "feat(scope): descrição em pt-BR"

# 6. Push + PR
git push origin <branch>
gh pr create --base main --title "feat(scope): ..."
```

**Pronto?** Aguarde o `code-reviewer` e o `qa-gate` rodarem. PR só é mergeável após coverage ≥ 85% (Strict) ou 70% (Lean), 0 vuln critical/high, review ≥ 70.

---

## Próxima revisão

- **Quando:** ao final de cada sprint (Fase 5 completa) ou quando convenção mudar.
- **Por quem:** `documenter` agent, acionado pelo orchestrator.
- **O que atualizar:** convenções novas, anti-patterns descobertos, novos helpers, mudanças de versão.
