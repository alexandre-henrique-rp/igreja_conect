# ARCH.md — Arquitetura Técnica — Igreja Conect

> **Documento vivo de arquitetura técnica.** Diagramas, decisões macro (ADR-style) e fluxos críticos. Complementa `agents/AGENTS.md` (que é o guia de onboarding para agentes LLM).
>
> **Última atualização:** 2026-06-14 (Fase 1, ciclo 2 — Módulo Financeiro)
> **Mantido por:** `documenter` agent (Fase 1 do Harness v6)
> **Audiência:** arquitetos, desenvolvedores seniores, novos agentes do Harness.
> **Localização:** `docs/architecture/ARCH.md` (em `docs/`, conforme path-boundary do projeto).
>
> **Mudanças desta versão (ciclo 2):**
> - Adicionada §8 "Módulo Financeiro — Arquitetura" (camadas, fluxos, lifecycles, RBAC fina, travas).
> - §4 "Modelo de dados" atualizada: status de `Caixa`, `TransferenciaCaixa`, `Lancamento` mudou de "schema apenas" para "schema + service + UI (ciclo 2)".
> - §12 "Roadmap" atualizada: ciclo 2 (S06-S08) marcado como em andamento.
> - Decisão de modelagem `Caixa.ativo` documentada como **proposta pendente** (formalização na Fase 2).

## 1. Visão geral

Aplicação **full-stack React Router 7 com SSR** servida por um único processo Node. Persistência em **SQLite** (arquivo local). Sem microsserviços, sem message broker, sem filas. Auth por **session cookie httpOnly** assinado com `SESSION_SECRET`.

```mermaid
graph TB
  Browser[Browser do usuário<br/>Pastor / Secretário / etc.]

  subgraph Node["Processo Node 22 (único)"]
    RR[React Router 7<br/>SSR + future flags v8_*]
    Loader[Loaders / Actions]
    Middleware[Auth + RBAC Middleware]
    Service[Services<br/>app/services/*.server.ts]
    DB[(Prisma Client<br/>app/db.server.ts)]
    Bcrypt[bcrypt / bcryptjs]
    Session[Session Store<br/>cookie signed]
  end

  SQLite[(SQLite<br/>prisma/dev.db)]

  Browser -->|HTTPS| RR
  RR --> Middleware
  Middleware --> Loader
  Loader --> Service
  Service --> DB
  Service --> Bcrypt
  Service --> Session
  DB --> SQLite
  Session -.->|cookie httpOnly| Browser
```

**Princípios de design:**

- **Monólito modular** — sem microsserviço. Uma única aplicação Node que serve HTML SSR + API.
- **Defense in depth** — RBAC verificado em 3 camadas (UI → loader → service).
- **Co-localização** — rotas, componentes de página e services por feature ficam próximos.
- **Sem abstração prematura** — YAGNI/KISS governa. Camadas existem onde há repetição.

---

## 2. Camadas

| Camada | Pasta | Responsabilidade | Não-responsabilidade |
|---|---|---|---|
| **Apresentação** | `app/routes/`, `app/components/` | Renderizar UI, capturar input do usuário, chamar server actions via `<Form>`. | Lógica de negócio, acesso a DB. |
| **Aplicação** (router) | `app/routes/**/*.{ts,tsx}` | Loaders (GET), Actions (POST/PUT/DELETE), Middlewares, ErrorBoundary. Conversão de `DomainError` → `Response`. | Regra de negócio pura. |
| **Domínio** (services) | `app/services/*.server.ts` | Regra de negócio, validação semântica, RBAC fina, transações Prisma. | Conhecer HTTP/Request/Response. |
| **Infra / Lib** | `app/lib/*.server.ts`, `app/db.server.ts` | Singleton do Prisma, helpers de centavos, hashing, session store, validação Zod. | Regra de negócio. |
| **Dados** | `prisma/schema.prisma`, `prisma/migrations/` | Schema do banco, migrations versionadas. | Lógica de aplicação. |

**Regra de dependência (estrita, unidirecional):**

```
Apresentação → Aplicação → Domínio → Infra → Dados
```

A camada de Apresentação **nunca** importa `db.server` diretamente. Sempre passa por service. Testes ficam ao lado da camada que testam (`app/services/membros.test.ts`, `app/routes/private/membros/$id.test.ts`).

---

## 3. Stack e justificativas

| Tecnologia | Por que | Trade-off aceito |
|---|---|---|
| **React Router 7 (SSR)** | `loader`/`action` eliminam boilerplate de API. SSR nativo, HTML inicial já tem dados (sem loading spinners desnecessários). Future flags `v8_*` ativadas (middleware, split modules). | Curva de aprendizado do data-router; lock-in em uma lib. |
| **Vite 8** | HMR rápido, build com Rollup, suporte a SSR de primeira. Padrão de fato em 2026. | Configuração `reactRouter()` + `@tailwindcss/vite` requer plugin explícito. |
| **TypeScript strict** | Tipos do Prisma + tipos gerados do React Router = segurança de tipo end-to-end. | Build mais lento (mitigado por `tsc --noEmit` paralelo). |
| **Tailwind 4** | Utility-first, sem CSS morto, theming via `@theme`. | HTML verboso (mitigado por componentes co-localizados). |
| **Prisma 7.8** | Type-safe, migration declarativa, output em `generated/prisma/` evita conflito com `node_modules`. | Queries muito complexas ainda precisam `prisma.$queryRaw`. |
| **SQLite** | Zero infra (sem Docker, sem servidor). Backup = copiar arquivo. Plausível para 1k-10k membros. **Decisão confirmada pelo usuário** no brief. | Sem concorrência multi-processo (mitigado: 1 processo Node no MVP). Sem replicação. Backup manual. |
| **bcryptjs** | Hash robusto, compatível com SSR (sem dependência nativa). | Mais lento que `bcrypt` nativo (mitigado: login é I/O-bound, ~50ms aceitável). |
| **Zod** (sugerido) | Validação runtime + type inference em uma lib. Erros estruturados (`flatten().fieldErrors`). | Bundle do cliente aumenta se importado lá (mitigado: usar em `*.server.ts` apenas). |
| **Vitest** (sugerido) | Rápido, ESM nativo, compatível com Vite/TS. | — |
| **Playwright** (sugerido) | Padrão de mercado para E2E, MCP já disponível no opencode. | — |

**Não escolhidos no MVP (registro para não voltar a avaliar):**

- ❌ Next.js (overhead de opinion, RR7 já dá o que precisamos com menos).
- ❌ tRPC (loaders/actions do RR7 já são type-safe end-to-end).
- ❌ Redis (session em cookie signed é suficiente).
- ❌ PostgreSQL (SQLite basta para 1 igreja).
- ❌ Docker Compose local (SQLite é arquivo, não precisa).
- ❌ S3/MinIO (upload de arquivos está fora do MVP; `ManutencaoAtivo.urlLaudoTecnico` aceita URL textual).

---

## 4. Modelo de dados

> **Fonte da verdade:** `prisma/schema.prisma` (12 models, 6 enums). Este capítulo é um **índice** — não duplica o schema.

### 4.1 Models por módulo

| Módulo | Models | Estado |
|---|---|---|
| **Membros** (ciclo 1) | `Membro`, `Ministerio`, `MinisterioMembro` | ✅ UI completa + service (S00–S05) |
| **Auth** (ciclo 1) | (parte de `Membro.senhaHash`, `Membro.cargo`, `Membro.email`, `Session`) | ✅ Endpoints no MVP (S00–S05) |
| **Alertas** (ciclo 1) | `Alerta`, `AlertaDestinatario` | ✅ UI básica + service (S00–S05) |
| **Configuração** (ciclo 1) | `ConfiguracaoGeral`, `ConfigAcolhimento` | ✅ Service + 1 tela ADMIN (S05) |
| **Financeiro** (ciclo 2, **em andamento**) | `Caixa`, `TransferenciaCaixa`, `Lancamento` | 🟡 **Schema pronto (ciclo 1) + services+UI no ciclo 2 (S06-S08)** |
| **Estoque** (backlog) | `ItemEstoque`, `MovimentacaoEstoque`, `ManutencaoAtivo` | ❌ Schema apenas, **zero UI/service** (ciclo 3+) |

### 4.2 Enums (resumo)

| Enum | Valores | Onde se aplica |
|---|---|---|
| `Cargo` | ADMIN, PASTOR, SECRETARIO, DISCIPULADOR, FINANCEIRO, LIDER_MINISTERIO | RBAC. `Membro.cargo` |
| `TipoMembro` | MEMBRO_ATIVO, CONGREGADO, VISITANTE | Segmentação pastoral. `Membro.tipo` |
| `TipoLancamento` | ENTRADA, SAIDA | Movimentação financeira |
| `CategoriaLancamento` | DIZIMO, OFERTA, CAMPANHA, DESPESA_OPERACIONAL, COMPRA_ESTOQUE, MANUTENCAO, TRANSFERENCIA | Natureza do lançamento |
| `TipoItemEstoque` | CONSUMO, PATRIMONIO | Define fluxo (consumo vs. manutenção) |
| `StatusItemPatrimonio` | DISPONIVEL, EM_MANUTENCAO, BAIXADO_PERDA | Lifecycle de ativo |

### 4.3 Relacionamentos críticos

```mermaid
erDiagram
  Membro ||--o{ Membro : "discipulador (1:N, máx 12)"
  Membro ||--o{ MinisterioMembro : "pertence"
  Ministerio ||--o{ MinisterioMembro : "tem"
  Membro ||--o{ Lancamento : "dizimista"
  Caixa ||--o{ Lancamento : "registra"
  Caixa ||--o{ TransferenciaCaixa : "origem/destino"
  Membro ||--o{ TransferenciaCaixa : "executou"
  Membro ||--o{ AlertaDestinatario : "recebe"
  Alerta ||--o{ AlertaDestinatario : "tem"
  Membro ||--o{ MovimentacaoEstoque : "autorizou"
  ItemEstoque ||--o{ MovimentacaoEstoque : "movimenta"
  ItemEstoque ||--o{ ManutencaoAtivo : "em reparo"
  Ministerio ||--o{ ConfiguracaoGeral : "responsável visitante"
```

### 4.4 Decisões de modelagem

- **Auto-relacionamento** de `Membro` (discipulado) usa `onDelete: Restrict` — não permitir deletar um discipulador que ainda tem discípulos sem reatribuí-los.
- **`Lancamento.membro` é `SetNull` no delete** (RN-FIN-05: oferta anônima é permitida; dízimo órfão vira histórico sem identificação).
- **`ConfiguracaoGeral` é singleton** (sempre 1 linha). Não usar `id` autoincrement — usar `id` fixo `"singleton"` ou garantir via seed + `findFirstOrThrow` no service.
- **`AlertaDestinatario` é N:N explícita** (não usar `Alerta.destinatarios String[]`) para suportar `lido: Boolean` por destinatário.

---

## 5. Fluxo de autenticação

```mermaid
sequenceDiagram
  autonumber
  participant U as Usuário (browser)
  participant RR as React Router<br/>(server)
  participant MW as Middleware<br/>(auth)
  participant S as session.server.ts
  participant DB as Prisma + SQLite

  U->>RR: POST /login (email, senha)
  RR->>S: verifyCredentials(email, senha)
  S->>DB: membro.findUnique({ email, senhaHash })
  S->>S: bcrypt.compare(senhaPlain, hash)
  alt credenciais OK
    S->>S: createSession(userId) → sessionId
    S-->>RR: sessionId
    RR-->>U: 302 Set-Cookie: sid=<httpOnly signed>; redirect=/app
  else falha
    RR-->>U: 401 com mensagem "Credenciais inválidas"
  end

  U->>RR: GET /app/membros (Cookie: sid=...)
  RR->>MW: middleware()
  MW->>S: getSession(sid) → user
  alt sessão válida
    MW-->>RR: { user } (injetado no contexto)
    RR-->>U: 200 HTML
  else sessão inválida/expirada
    MW-->>U: 302 redirect /login
  end
```

**Pontos críticos:**

- **Sessão é cookie, não JWT.** Razão: SSR do RR7 emite cookies nativamente; mais seguro contra XSS que `localStorage`; sem necessidade de biblioteca extra. (Ver ADR-001.)
- **Hash é bcryptjs** (compat SSR). Salt rounds ≥ 10. (Ver ADR-002.)
- **Logout** invalida no servidor: `deleteSession(sid)` remove o registro da tabela `sessions` (ou store escolhido). Cookie é limpo com `Max-Age=0`.
- **TTL:** 7 dias com **sliding renewal** (cada request autenticado estende o TTL por mais 7 dias, até um teto de 30 dias absolutos). `[A CONFIRMAR]` — ver anexo do brief.

---

## 6. Fluxo de RBAC

```mermaid
graph LR
  A[Request chega] --> B{Middleware<br/>autenticado?}
  B -- não --> Z1[302 /login]
  B -- sim --> C{Loader/Action<br/>requireRole?}
  C -- falha --> Z2[403 Forbidden]
  C -- passa --> D{Service<br/>RBAC fina?}
  D -- falha --> Z3[BusinessRuleError]
  D -- passa --> E[Executa operação]
  E --> F[Response]
```

### 6.1 Matriz RBAC (resumo)

| Operação / Recurso | ADMIN | PASTOR | SECRETARIO | DISCIPULADOR | LIDER_MIN. | FINANCEIRO |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| **Membros** CRUD | ✅ | ✅ | ✅ | ✅(escopo) | ✅(escopo) | ✅ |
| **Dízimos** (RN-MEM-03) | 👁 | 👁 | 🚫 | 🚫 | 🚫 | 👁 |
| **Financeiro** CRUD | ✅ | ✅ | ✅(trava) | 🚫 | 🚫 | ✅(trava) |
| **Estoque** Consumo | ✅(autoriza) | 👁 | ✅(autoriza) | 👁 | 👁 | 👁 |
| **Estoque** Patrimônio CRUD | ✅ | 👁 | ✅ | 👁 | 👁 | 👁 |
| **Manutenção** Envio | ✅ | 👁 | ✅ | 👁 | 👁 | 👁 |
| **Manutenção** Baixa (RN-EST-05) | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |

> 👁 = leitura / 🚫 = bloqueado / ✅ = permitido. Versão completa em `docs/DESCRIÇÃO_DOS_MODULOS.md`.

### 6.2 Implementação em 3 camadas

1. **Middleware** (`app/routes/private/_middleware.ts`): garante que há `user` no contexto. Se não, redirect.
2. **Loader/Action** (em cada rota): `requireRole(user, [...])` que lança 403 se perfil não bate.
3. **Service** (fina): checa regras de escopo — ex: `DISCIPULADOR` só edita membros onde `discipuladorId === user.id`.

---

## 7. Fluxo de Membros (CRUD + discipulado + alertas)

### 7.1 Cadastrar visitante (gera alerta)

```mermaid
sequenceDiagram
  autonumber
  participant U as Usuário (qualquer perfil autenticado)
  participant RR as React Router
  participant SV as service: criarVisitante
  participant TX as db.$transaction
  participant DB as Prisma/SQLite

  U->>RR: POST /app/membros/novo { tipo: VISITANTE, nome, tel }
  RR->>RR: requireUser + requireRole([...todos])
  RR->>SV: criarVisitante(input, user)
  SV->>SV: Validar Zod (MembroCreateSchema)
  SV->>TX: tx.$transaction
  TX->>DB: membro.create({ tipo: VISITANTE })
  TX->>DB: configGeral.findFirst()
  TX->>DB: alerta.create({ destinatario: responsavel })
  TX-->>SV: { membro, alerta }
  SV-->>RR: membro
  RR-->>U: 302 /app/membros/:id (sucesso)
```

**Atômico (RN-MEM-05):** se a criação do alerta falhar, o visitante não é criado. `db.$transaction` garante.

### 7.2 Vincular discípulo a discipulador (RN-MEM-04)

```mermaid
flowchart TD
  A[POST /app/membros/:id/discipulador] --> B{discipuladorId === discId?}
  B -- sim --> X1[400 Auto-vínculo]
  B -- não --> C[count discípulos ativos do discipulador]
  C --> D{count >= 12?}
  D -- sim --> X2[422 Trava 12 discípulos]
  D -- não --> E{isDescendantOf?<br/>anti-loop}
  E -- sim --> X3[422 Vínculo em loop]
  E -- não --> F[membro.update discipuladorId]
  F --> G[200 OK]
```

**Testes de borda obrigatórios:**

- 12 discípulos: passa
- 13º: bloqueia com mensagem clara
- A→B e B→A simultâneo: bloqueia (anti-loop)
- Vincular a si mesmo: bloqueia

### 7.3 Listagem de membros

Loader único, com filtros via `URLSearchParams`:

```
GET /app/membros?tipo=VISITANTE&ministerioId=<uuid>&discipuladorId=<uuid>&q=maria
```

Service `listMembros(filter)` retorna paginado (`page`, `pageSize`). UI tem filtros + busca textual por nome (case-insensitive, `contains`).

---

## 8. Módulo Financeiro — Arquitetura (ciclo 2)

> **Escopo do ciclo 2:** Caixas + Lançamentos + Dízimos + Ofertas + Transferências + Trava de Saldo + aba Fidelidade Financeira. 5 RNs já documentadas (`RN-FIN-01` a `RN-FIN-05`). Schema Prisma pronto desde o ciclo 1; serviços e UI a serem entregues em S06-S08.
>
> **Fonte canônica:** `brief.md` §4-§8 + RAGs `pattern-trava-saldo-service`, `pattern-transferencia-caixas`, `architecture-financeiro`, `decision-caixa-soft-delete`.

### 8.1 Camadas do módulo

Mesma arquitetura monolítica modular do MVP (RAG `architecture-monolith-modular`), com a fronteira estrita `Apresentação → Aplicação → Domínio → Infra → Dados`.

```
UI (app/components/, app/routes/app/financeiro/**)
  ↓ chama service via loader/action
Domínio (app/lib/caixas.server.ts, lancamentos.server.ts, transferencias.server.ts, finance.server.ts)
  ↓ chama helpers transversais
Infra (app/lib/rbac.server.ts, app/lib/money.server.ts, app/db/prisma.server.ts)
  ↓
Dados (prisma/schema.prisma — Caixa, TransferenciaCaixa, Lancamento)
```

**5 services no Módulo Financeiro:**

| Service | Responsabilidade | RN coberta |
|---|---|---|
| `app/lib/caixas.server.ts` | CRUD `Caixa` (listar, criar, editar, arquivar, reabrir) | RN-FIN-01 |
| `app/lib/lancamentos.server.ts` | CRUD `Lancamento` (criar, listarPorCaixa, listarPorMembro, editar descritivo) | RN-FIN-01, RN-FIN-04, RN-FIN-05 |
| `app/lib/transferencias.server.ts` | `transferirEntreCaixas` (operação composta atômica) | RN-FIN-02 |
| `app/lib/finance.server.ts` (canônico) | `assertSaldoSuficiente`, `getDizimosByMembro` (Camada 3 já pronta) | (transversal) |
| `app/lib/money.server.ts` (canônico, JÁ EXISTE) | `formatBRLFromCents`, `parseBRLToCents`, `assertNonNegative` | (transversal) |

**Rotas adicionadas (todas em `app/routes/app/financeiro/**`):**

- `financeiro._index.tsx` — dashboard (cards de saldo por caixa + indicador agregado).
- `financeiro.caixas._index.tsx` — listagem de caixas.
- `financeiro.caixas.novo.tsx` — criar caixa.
- `financeiro.caixas.$id.tsx` — extrato do caixa + arquivar.
- `financeiro.lancamentos.novo.tsx` — criar lançamento (campo Membro condicional à categoria).
- `financeiro.transferencias._index.tsx` — listagem (somente leitura).
- `financeiro.transferencias.novo.tsx` — form de transferência.

### 8.2 Fluxo crítico 1: Criar Dízimo (entrada vinculada a Membro)

```mermaid
sequenceDiagram
  autonumber
  actor U as Tesoureiro (FINANCEIRO)
  participant FE as FormLancamento
  participant RR as loader/action
  participant SVC as criarLancamento
  participant RBAC as rbac.server
  participant TX as prisma.$transaction
  participant DB as Prisma/SQLite

  U->>FE: tipo=ENTRADA, categoria=DIZIMO, valor=R$ 50, membro=Maria
  U->>FE: submit
  FE->>RR: POST { formData }
  RR->>RR: LancamentoCreateSchema.safeParse (Zod .strict() + superRefine RN-FIN-05)
  RR->>SVC: criarLancamento(parsed, user)

  SVC->>RBAC: assertCanSeeFinancials(user)
  RBAC-->>SVC: ok (FINANCEIRO)

  SVC->>SVC: assertNonNegative(valorCentavos)
  Note over SVC: ENTRADA não chama assertSaldoSuficiente (soma, não subtrai)

  SVC->>TX: $transaction(async tx => ...)
  TX->>DB: tx.lancamento.create({ tipo:ENTRADA, categoria:DIZIMO, membroId:maria, ... })
  TX->>DB: tx.caixa.update({ saldoCentavos: { increment: 5000 } })
  TX-->>SVC: { lancamento }

  SVC-->>RR: lancamento
  RR-->>U: 302 /app/financeiro/caixas/{caixaId} (toast "Dízimo registrado")
```

**Pontos críticos:**

- **RN-FIN-05:** `LancamentoCreateSchema.superRefine` rejeita `DIZIMO` sem `membroId` (400). `OFERTA` aceita `membroId = null`. Outras categorias exigem `membroId = null`.
- **RBAC:** FINANCEIRO, ADMIN, PASTOR, SECRETARIO podem criar (matriz §4.8 do brief). DISCIPULADOR e LIDER_MINISTERIO recebem 403 em todas as 3 camadas.
- **Trava:** ENTRADA não passa por `assertSaldoSuficiente` (soma, não subtrai), mas passa por checagem de `caixa.ativo === false` (proposta pendente — RAG `decision-caixa-soft-delete`).

### 8.3 Fluxo crítico 2: Transferência entre Caixas (RN-FIN-02 + RN-FIN-04 atômico)

```mermaid
sequenceDiagram
  autonumber
  actor U as SECRETARIO (autonomia por saldo)
  participant FE as FormTransferencia
  participant RR as loader/action
  participant SVC as transferirEntreCaixas
  participant RBAC as rbac.server
  participant FIN as assertSaldoSuficiente
  participant TX as prisma.$transaction
  participant DB as Prisma/SQLite

  U->>FE: origem=Caixa Geral, destino=Caixa Cantina, valor=R$ 100
  U->>FE: submit
  FE->>RR: POST { formData }
  RR->>RR: TransferenciaCreateSchema.safeParse (.strict() + superRefine origem≠destino)
  RR->>SVC: transferirEntreCaixas(parsed, user)

  SVC->>RBAC: assertCanSeeFinancials(user)
  RBAC-->>SVC: ok (SECRETARIO)

  SVC->>FIN: assertSaldoSuficiente(caixaOrigemId, 10000, "Transferência")
  FIN->>DB: prisma.caixa.findUnique({ select: { saldoCentavos, ativo } })
  DB-->>FIN: { saldoCentavos: 50000, ativo: true }
  FIN-->>SVC: ok

  SVC->>TX: $transaction(async tx => ...)
  Note over TX: Re-leitura do saldo (anti-TOCTOU)
  TX->>DB: tx.transferenciaCaixa.create({ executadoPorId: user.id, ... })
  TX->>DB: tx.lancamento.create({ tipo:SAIDA, categoria:TRANSFERENCIA, ... })
  TX->>DB: tx.lancamento.create({ tipo:ENTRADA, categoria:TRANSFERENCIA, ... })
  TX->>DB: tx.caixa.update({ saldoCentavos: { decrement: 10000 } })  // origem
  TX->>DB: tx.caixa.update({ saldoCentavos: { increment: 10000 } })  // destino
  TX-->>SVC: { transferencia }

  SVC-->>RR: transferencia
  RR-->>U: 302 /app/financeiro/transferencias (toast "Transferência registrada")
```

**Pontos críticos:**

- **5 mutações atômicas em 1 `$transaction`** — sem atomicidade, sistema fica inconsistente.
- **Modelagem híbrida (1+2):** 1 `TransferenciaCaixa` (imutável, auditoria, RN-FIN-02) + 2 `Lancamento` espelho (extrato, reconciliação). Decisão **confirmada** no discovery (brief §5.2).
- **`categoria: TRANSFERENCIA` é exclusiva** do `transferirEntreCaixas`. `criarLancamento` rejeita essa categoria. Teste estático cobre (`grep`).
- **Carimbo do operador:** `executadoPorId: user.id` (nunca do form).
- **Re-leitura do saldo dentro do `$transaction`** (anti-TOCTOU) — não confia na leitura do helper.
- **RBAC:** todos os perfis com `canSeeFinancials` (ADMIN, PASTOR, FINANCEIRO, SECRETARIO) podem transferir, **desde que com saldo** (RN-FIN-03). DISCIPULADOR e LIDER_MINISTERIO recebem 403.

Ver RAG `pattern-transferencia-caixas` para detalhes completos e exemplos de teste.

### 8.4 Fluxo crítico 3: Trava de Saldo (RN-FIN-04)

```mermaid
flowchart TD
  A[Service: criarLancamento com tipo=SAIDA] --> B{assertCanSeeFinancials?}
  B -- 403 --> X1[Response 403]
  B -- ok --> C[assertSaldoSuficiente: prisma.caixa.findUnique]
  C --> D{caixa.ativo === false?}
  D -- sim --> X2[Response 409: 'Caixa arquivado']
  D -- não --> E{saldoCentavos >= valorCentavos?}
  E -- não --> X3[Response 409: 'Saldo insuficiente']
  E -- sim --> F[prisma.$transaction]
  F --> G[tx.lancamento.create]
  F --> H[tx.caixa.update decrement]
  F --> I[return lancamento]
```

**Ordem inegociável:** `assertCan*` (RBAC) → `assertSaldoSuficiente` (RN-FIN-04) → `$transaction`. Ver RAG `pattern-trava-saldo-service` para código completo e exemplos de teste.

### 8.5 Fluxo crítico 4: Aba "Fidelidade Financeira" (RN-MEM-03)

```mermaid
sequenceDiagram
  autonumber
  actor U as PASTOR
  participant FE as /app/membros/:id?tab=fidelidade
  participant RR as membros.$id.tsx (loader)
  participant RBAC as rbac.server
  participant SVC as getDizimosByMembro
  participant DB as Prisma/SQLite

  U->>FE: GET /app/membros/maria-123?tab=fidelidade
  FE->>RR: loader()
  RR->>RBAC: Tab gate (camada 2 — força tab=dados se cargo inválido)
  RR->>SVC: getDizimosByMembro("maria-123", user)
  SVC->>RBAC: assertCanSeeFinancials(user) ← PRIMEIRO
  RBAC-->>SVC: ok (PASTOR)
  SVC->>DB: prisma.lancamento.findMany({ where:{ membroId, categoria:'DIZIMO' }, orderBy:{ dataCompetencia:'desc' } })
  DB-->>SVC: Lancamento[]
  SVC-->>RR: Lancamento[]
  RR-->>FE: { user, membro, dizimos }
  FE-->>U: render TabFidelidadeFinanceira (tabela com data, valor BRL, descrição)
```

**3 camadas de defesa (já prontas no ciclo 1, basta substituir placeholder):**

1. **UI:** `<Can allow={['ADMIN','PASTOR','FINANCEIRO']}>` esconde a aba.
2. **Loader:** se `tab=fidelidade` na URL mas cargo inválido, redireciona para `tab=dados` (RN-MEM-03).
3. **Service:** `getDizimosByMembro` chama `assertCanSeeFinancials` **PRIMEIRO** (Camada 3 — única mandatória).

**Sub-tarefa do ciclo 2 (brief §4.6):** substituir o placeholder do `TabFidelidadeFinanceira` por tabela de dízimos + card de resumo mensal/anual. Service já está pronto (basta descomentar a query real — linha 67 do `app/lib/finance.server.ts`).

### 8.6 Modelagem dos 3 models do Financeiro

| Model | Campos principais | Relacionamentos | Status |
|---|---|---|---|
| **`Caixa`** | `id`, `nome @unique`, `saldoCentavos Int @default(0)`, `ativo Boolean?` (proposta pendente), timestamps | `lancamentos[]`, `origemTransf[]`, `destinoTransf[]` | Schema ✅. Service + UI no ciclo 2. |
| **`TransferenciaCaixa`** | `id`, `valorCentavos Int`, `caixaOrigemId`, `caixaDestinoId`, `executadoPorId`, `dataHora` | `caixaOrigem` (Restrict), `caixaDestino` (Restrict), `executadoPor` (Restrict) | Schema ✅. Service + UI no ciclo 2. |
| **`Lancamento`** | `id`, `tipo (ENTRADA/SAIDA)`, `categoria (7 valores)`, `valorCentavos Int`, `caixaId`, `membroId?` (SetNull), `dataCompetencia`, `descricao`, timestamps | `caixa` (Restrict), `membro` (SetNull — RN-FIN-05) | Schema ✅. Service + UI no ciclo 2. |

**Decisão de modelagem pendente (formalização na Fase 2):** adicionar `Caixa.ativo: Boolean @default(true)` para soft-delete (arquivamento). Ver RAG `decision-caixa-soft-delete` (status: `pending`).

**Mapa de `categoria` em `Lancamento`:**

| Categoria | Tipo esperado | `membroId` | RN |
|---|---|---|---|
| `DIZIMO` | `ENTRADA` | **obrigatório** | RN-FIN-05 |
| `OFERTA` | `ENTRADA` | opcional (anônimo) | RN-FIN-05 |
| `CAMPANHA` | `ENTRADA` | `null` | — |
| `DESPESA_OPERACIONAL` | `SAIDA` | `null` | RN-FIN-04 (trava) |
| `COMPRA_ESTOQUE` | `SAIDA` | `null` | RN-FIN-04 (trava) |
| `MANUTENCAO` | `SAIDA` | `null` | RN-FIN-04 (trava) |
| `TRANSFERENCIA` | ambos | `null` | **Exclusivo** do `transferirEntreCaixas` (RN-FIN-02) |

### 8.7 RBAC fina do Módulo Financeiro (matriz completa, brief §4.8)

| Operação \ Perfil | ADMIN | PASTOR | FINANCEIRO | SECRETARIO | DISCIPULADOR | LIDER_MIN. |
|------------------|:-----:|:------:|:----------:|:----------:|:------------:|:----------:|
| Ver dashboard `/app/financeiro` | ✅ | ✅ | ✅ | ✅ | 🚫 | 🚫 |
| Criar / arquivar Caixa | ✅ | ✅ | ✅ | 🚫 | 🚫 | 🚫 |
| Lançar DIZIMO (com membro) | ✅ | ✅ | ✅ | ✅ | 🚫 | 🚫 |
| Lançar OFERTA (anônima) | ✅ | ✅ | ✅ | ✅ | 🚫 | 🚫 |
| Lançar DESPESA / SAIDA (com trava) | ✅ | ✅ | ✅ | ✅ | 🚫 | 🚫 |
| Transferir entre Caixas | ✅ | ✅ | ✅ | ✅ | 🚫 | 🚫 |
| Ver aba Fidelidade Financeira (RN-MEM-03) | ✅ | ✅ | ✅ | 🚫 | 🚫 | 🚫 |
| Ver extrato de Caixa alheio | ✅ | ✅ | ✅ | ✅ | 🚫 | 🚫 |

> **Defesa em 3 camadas obrigatória:** `assertCanSeeFinancials` (Camada 3) bloqueia perfis não-financeiros. UI esconde, loader checa, service barra. Discipulador e Líder de Ministério são **BLOQUEADOS** em todo o módulo.

### 8.8 Decisões macro do Módulo Financeiro (consolidadas)

- **Monólito modular** (RAG `architecture-monolith-modular`): sem microsserviço, sem message broker. Decisão herdada.
- **Camada 3 (service) é a única segurança real** (RAG `pattern-3-layer-rbac`): trava de saldo e RBAC moram no service.
- **Centavos `Int`** (RAG `convention-monetary-values`): nunca `Float`, nunca `Decimal`. Helpers em `app/lib/money.server.ts`.
- **TDD + JSDoc obrigatórios** (v6.2.0+): nenhuma função pública sem teste falhando antes e sem JSDoc completo.
- **Modelagem de transferência híbrida (1+2)** (brief §5.2): 1 `TransferenciaCaixa` (auditoria) + 2 `Lancamento` espelho (extrato) em `$transaction` atômico. **Confirmada no discovery.**
- **Caixas seed = só Geral** (brief §5.1): primeiro Caixa vem do `prisma/seed.ts` (idempotente). Demais sob demanda.
- **RBAC criar/arquivar Caixa = ADMIN+PASTOR+FINANCEIRO** (brief §5.3): `SECRETARIO` opera dentro, não estrutura. **Confirmada no discovery.**
- **`Caixa.ativo: Boolean @default(true)`** (proposta pendente): soft-delete. RAG `decision-caixa-soft-delete` (status `pending`). Formalização na Fase 2.

### 8.9 Limites conhecidos do Módulo Financeiro

| Limite | Onde | Mitigação |
|---|---|---|
| **SQLite single-writer** | `dev.db` | 1 processo Node + `$transaction` atômico. Postgres futuro é mudança aditiva. |
| **Sem auditoria de leitura** (LGPD art. 37) | `getDizimosByMembro` lê sem registrar quem viu | Backlog (não ciclo 2). |
| **Sem gateway de pagamento** | não há Pix/cartão | Brief §8 — não-objetivo. Reconciliação manual. |
| **Sem multi-moeda** | apenas BRL | `Int` cobre até R$ 21M por caixa. Backlog. |
| **Sem upload de comprovantes** | `Lancamento.descricao` é textual | Brief §8 — não-objetivo. Backlog (S3/MinIO). |
| **Sem relatório PDF/Excel** | exportação manual | Brief §8 — não-objetivo. |
| **Sem aprovação multi-nível para saídas grandes** | trava de saldo é o único gate | RN-FIN-03 é autonomia por saldo, sem "aprovação do pastor" como portão extra. |
| **Volumetria: 1 Caixa pode ter 1k+ lançamentos/mês** | extrato fica lento | Paginador + filtro por período. Índice `(caixaId, dataCompetencia DESC)` se virar gargalo. |
| **Caixa arquivado tem saldo congelado** | saldo histórico preservado | Correto e desejável — dinheiro "guardado" no extrato. |

### 8.10 Próximos passos (S06+)

1. **S06 — Caixa + Lançamento (Sprint 1):** CRUD básico, dashboard de saldos, RAG `pattern-trava-saldo-service` implementado em `criarLancamento`.
2. **S07 — Transferência + Trava saldo em SAIDA (Sprint 2):** RAG `pattern-transferencia-caixas` implementado, E2E de bypass.
3. **S08 — Fidelidade Financeira + RBAC fina (Sprint 3):** substituir placeholder do `TabFidelidadeFinanceira`, testes E2E de bypass (RN-MEM-03).
4. **S09+ (backlog) — Reconciliação semanal, relatórios, multi-moeda, gateway de pagamento.**

> **Definition of Done (herdado do MVP + adaptado):** cobertura ≥ 85% global, **100% em services** (`caixas`, `lancamentos`, `transferencias`), 0 vuln critical/high, `planning-reviewer` ≥ 70, LGPD compliant, 12 testes de borda do brief §7.3 **todos verdes**, métrica macro (brief §7.1) cumprida.

---

## 9. Tratamento de centavos

**Convenção:** todos os valores monetários são `Int` em **centavos** no banco e em trânsito. Conversão só na borda (formulário de input, renderização).

```ts
// app/lib/centavos.ts (helpers puros)

/** @description Converte reais (number) para centavos (Int) com arredondamento bancário. */
export const reaisParaCentavos = (reais: number): number =>
  Math.round(reais * 100);

/** @description Converte centavos (Int) para reais (number). */
export const centavosParaReais = (centavos: number): number =>
  centavos / 100;

/** @description Formata centavos como moeda brasileira (BRL). */
export const formatBRL = (centavos: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(centavos / 100);
```

**Regras:**

- ❌ Nunca `Float`/`Decimal` para dinheiro.
- ❌ Nunca comparar floats (`0.1 + 0.2 !== 0.3`).
- ✅ Schemas Zod para `valorReais: number` no input, service converte para `valorCentavos: int` antes de gravar.
- ✅ Display sempre via `formatBRL`.

**Campos no schema que seguem esta convenção:**

- `Caixa.saldoCentavos`
- `TransferenciaCaixa.valorCentavos`
- `Lancamento.valorCentavos`

---

## 10. Sessão e segurança

### 9.1 Decisões

| Aspecto | Decisão | Justificativa |
|---|---|---|
| **Tipo** | Session cookie (não JWT) | SSR nativo, sem lib extra, mais seguro contra XSS |
| **Storage** | Cookie assinado com `SESSION_SECRET` + registro no DB | Permite invalidação server-side (logout, ban) |
| **TTL** | 7 dias sliding, teto 30 dias absolutos | Equilíbrio entre UX e segurança |
| **Flags** | `httpOnly`, `secure` (prod), `sameSite=lax` | Mitiga XSS, CSRF, MITM |
| **Hash** | bcryptjs, salt rounds ≥ 10 | Padrão da indústria, compat SSR |
| **Renovação** | A cada request autenticado: `expira = now + 7d` (até 30d abs) | Usuário ativo não é deslogado; inativo expira |
| **Invalidação** | `deleteSession(sid)` no DB + cookie `Max-Age=0` | Logout robusto |

### 9.2 Estrutura da session (sugestão)

```ts
// app/lib/session.server.ts
type SessionData = {
  userId: string;
  cargo: Cargo;
  expiresAt: number;     // unix ms
  absoluteExpiresAt: number;
};
```

> Tabela `Session` ainda não foi adicionada ao schema — o backend agent da Fase 5 deve adicioná-la como primeira migration (ver §17.1 Pendências).

### 9.3 Cenários de segurança

- **Cookie theft (XSS):** impossível ler via JS (httpOnly). Mitigação adicional: CSP.
- **Cookie theft (CSRF):** `sameSite=lax` + checagem de `Origin` em mutações (RR7 já valida form actions com mesma origem por padrão).
- **Session fixation:** regenerar `sessionId` após login bem-sucedido.
- **Brute force:** rate limit no endpoint `/login` (futuro, pode ser middleware simples em memória no MVP).

---

## 11. Decisões de design registradas (ADRs)

> **Formato:** ADR mínimo (Architecture Decision Record) — Contexto, Alternativas, Decisão, Consequências.

### ADR-001 — Session cookie httpOnly em vez de JWT

- **Contexto:** Auth necessária no MVP, sem dependência externa, com SSR.
- **Alternativas:**
  1. JWT em `localStorage` — popular, mas vulnerável a XSS.
  2. JWT em cookie httpOnly — seguro mas adiciona complexidade de refresh.
  3. **Session cookie httpOnly + store server-side** — escolhido.
- **Decisão:** Session cookie httpOnly, com registro de sessão no DB para permitir invalidação.
- **Consequências:**
  - ✅ Logout server-side funciona.
  - ✅ Mais seguro contra XSS.
  - ❌ 1 lookup a mais no DB por request autenticado (mitigável com cache em memória).
  - ❌ Não escala para mobile app (mas mobile está fora do MVP).

### ADR-002 — bcryptjs em vez de bcrypt nativo

- **Contexto:** SSR do React Router 7 roda em Node, mas o build pode ser implantado em ambientes sem binários nativos (ex: Vercel Edge, Cloudflare Workers — não usados no MVP, mas previstos).
- **Alternativas:**
  1. `bcrypt` (nativo) — mais rápido, mas requer compilação em deploy.
  2. `argon2` — mais moderno, mas ecossistema menor.
  3. **bcryptjs** (JS puro) — escolhido.
- **Decisão:** `bcryptjs` com salt rounds = 10.
- **Consequências:**
  - ✅ Zero dependência nativa. Build portátil.
  - ❌ ~30% mais lento que `bcrypt` nativo (50ms vs 30ms em login — irrelevante).
  - ❌ Não usar para hashing em massa (criptomoeda, etc.) — irrelevante para o domínio.

### ADR-003 — Zod para validação de payload

- **Contexto:** Toda mutation precisa validar input. Alternativa: TypeScript guards manuais.
- **Alternativas:**
  1. Type guards manuais — verboso, sem inferência de tipo.
  2. Valibot — bundle menor, API similar.
  3. TypeBox — JSON Schema puro, mais complexo.
  4. **Zod** — escolhido. `[A CONFIRMAR]`
- **Decisão pendente:** Zod é a recomendação, mas pode ser revisitado na Fase 3 (Design). Razão: ecossistema maduro, `z.infer<>` casa com TS, mensagens de erro localizáveis.

### ADR-004 — Monólito modular em vez de microsserviços

- **Contexto:** Igreja local, escala horizontal não é prioridade. Time pequeno (1-3 devs).
- **Alternativas:**
  1. Microsserviços por módulo (auth, membros, financeiro) — over-engineering.
  2. **Monólito modular** — escolhido.
  3. Serverless (Vercel Functions) — viável, mas adiciona vendor lock-in.
- **Decisão:** Monólito único Node, com módulos internos bem delimitados em pastas. Se algum dia precisar拆分, `app/services/financeiro.server.ts` é um边界 natural.

### ADR-005 — Singleton do Prisma Client via globalThis

- **Contexto:** Vite HMR recarrega módulos a cada save, recriando instâncias do Prisma Client e esgotando conexões.
- **Alternativas:**
  1. Singleton em módulo — padrão.
  2. **Singleton em `globalThis` em dev, novo em prod** — escolhido.
  3. Pool de conexões externo — overkill para SQLite.
- **Decisão:** Padrão clássico do Prisma + Next.js, adaptado para RR7.

---

## 12. Como o sistema escala (do MVP para 3 módulos)

> **Roadmap de alto nível** — não inclui datas, apenas sequência.

```mermaid
gantt
    title Roadmap Igreja Conect (alto nível)
    dateFormat YYYY-MM-DD
    section Ciclo 1 (FECHADO 2026-06-13)
    MVP Auth + Membros + Discipulado + Alertas + Acolhimento (S00-S05) :done, mvp, 2026-06-12, 30d
    section Ciclo 2 (EM ANDAMENTO 2026-06-14+)
    Financeiro — caixas + lançamentos (S06) :active, fin1, after mvp, 14d
    Financeiro — transferência + trava saldo (S07) :fin2, after fin1, 14d
    Financeiro — Fidelidade Financeira + RBAC fina (S08) :fin3, after fin2, 14d
    section Ciclo 3+ (backlog)
    Estoque — consumo + movimentação :est1, after fin3, 14d
    Estoque — patrimônio + manutenção :est2, after est1, 21d
    Cron de alertas + relatórios :cron, after est2, 14d
```

**Critérios para mover de sprint (definition of done herdado do MVP + ciclo 2):**

1. Cobertura ≥ 85% global, **100% em services de regra de negócio**.
2. Zero vuln critical/high.
3. LGPD compliant.
4. `planning-reviewer` score ≥ 70.
5. **Métrica macro do ciclo 2 (brief §7.1):** FINANCEIRO lança dízimo de Membro X no Caixa Geral em < 2 min, PASTOR vê na aba Fidelidade.

**Módulos por status (jun/2026):**

| Módulo | Status | Bloqueios |
|---|---|---|
| **Membros** (RN-MEM-01 a 06) | ✅ Completo (ciclo 1, S00-S05) | — |
| **Alertas** (RN-MEM-05) | ✅ Completo (ciclo 1) | — |
| **Acolhimento** (RN-MEM-05) | ✅ Completo (ciclo 1) | — |
| **Financeiro** (RN-FIN-01 a 05) | 🟡 **Em andamento (ciclo 2, S06-S08)** | Schema ✅. Services + UI em S06-S08. Decisão `Caixa.ativo` pendente (Fase 2). |
| **Estoque — Consumo** (RN-EST-01, 02) | ❌ Schema apenas (ciclo 3+) | — |
| **Estoque — Patrimônio** (RN-EST-01, 03) | ❌ Schema apenas (ciclo 3+) | Necessita upload (MinIO/S3) |
| **Manutenção + Cron** (RN-EST-04) | ❌ Schema ok, falta scheduler | Definir scheduler: `node-cron` em processo único |
| **Baixa por perda** (RN-EST-05) | ❌ Schema ok, falta upload + service | MinIO/S3 |

---

## 13. Dependências externas

**MVP (atual):**

| Dependência | Tipo | Por que |
|---|---|---|
| **Prisma** (ORM) | lib npm | Padrão do projeto. |
| **bcryptjs** (hash) | lib npm | ADR-002. |
| **zod** (validação) | lib npm `[A CONFIRMAR]` | ADR-003. |
| **better-sqlite3** (driver) | lib npm | Usado pelo `@prisma/adapter-better-sqlite3`. |

**Fora do MVP (registro):**

- ❌ Gateway de pagamento (Pix, cartão) — fora de escopo.
- ❌ S3/MinIO — upload de laudos e fotos está fora do MVP.
- ❌ Serviço de e-mail (SMTP/SES) — sem notificação por e-mail no MVP.
- ❌ Serviço de push (FCM/APNs) — sem mobile nativo.
- ❌ Provedor de analytics — sem tracking de terceiros (LGPD).
- ❌ WAF / CDN / Rate limit externo — não necessário para 1 igreja.
- ❌ Monitoramento externo (Sentry, Datadog) — pode entrar em sprint futura; por ora, logs do Node.

---

## 14. Performance e limites

| Limite | Onde | Mitigação |
|---|---|---|
| **SQLite single-writer** | `dev.db` (e prod no MVP) | Aceitável para 1 igreja. Se virar gargalo, migrar para Postgres é mudança aditiva (Prisma abstrai). |
| **Bundle SSR** | Tudo roda em Node | Code splitting por rota já é nativo no RR7. Tailwind 4 faz purge automático. |
| **Sem cache distribuído** | Sem Redis | Cache apenas em memória (ex: sessão Prisma cacheada no request). Para MVP, OK. |
| **Sem CDN** | Assets servidos pelo Node | Para 1 igreja local, irrelevante. |
| **Sem rate limit externo** | Login é o endpoint mais sensível | Implementar in-memory rate limit no middleware `/login` (5 tentativas / 15min / IP). `[A CONFIRMAR]`. |
| **Sem índices explícitos** | Tabelas vão crescer | Índices em FK + campos de busca (nome, email, tipo) devem ser adicionados em migration pós-MVP se profiling mostrar lentidão. |
| **Sessão em cookie** | 1 request autenticado = 1 SELECT no DB | Mitigável: cachear `user` em `Map<sessionId, User>` com TTL curto. `[A CONFIRMAR]`. |

**Métricas de referência (targets):**

- Login: < 200ms p95 (rede local + bcrypt + 1 SELECT).
- Listar membros (1k): < 300ms p95.
- Cadastrar membro + alerta: < 200ms p95 (transação simples).

---

## 15. Testes

### 14.1 Estratégia em 3 camadas

| Camada | Ferramenta | O que testa | Localização |
|---|---|---|---|
| **Unit** | Vitest `[A CONFIRMAR]` | Services puros, helpers (centavos, validação), componentes puros | `app/**/*.test.ts` co-localizado |
| **Integração** | Vitest + Prisma test DB | Services com DB real (SQLite in-memory ou arquivo de teste) | `app/**/*.integration.test.ts` |
| **E2E** | Playwright (MCP) | Fluxos críticos: login, RBAC (RN-MEM-03), trava 12 (RN-MEM-04), alerta visitante (RN-MEM-05) | `e2e/**/*.spec.ts` |

### 14.2 Cobertura mínima

- **Gate do phase 5:** 85% global, 100% em services de regra de negócio.
- **Críticos sem cobertura:** nenhuma PR é mergeada (gate).

### 14.3 Casos obrigatórios (do brief)

- **RN-MEM-02:** schema/service rejeita `cpf` (teste de integração).
- **RN-MEM-03:** bypass via URL retorna 403 em 3 perfis (E2E).
- **RN-MEM-04:** 12 passa, 13 falha (boundary test).
- **RN-MEM-05:** cadastrar visitante gera alerta (integration).
- **RN-MEM-06:** nenhum job de promoção automática existe (assertion estática).

---

## 16. Diagramas de sequência adicionais

### 15.1 Login bem-sucedido

```mermaid
sequenceDiagram
  actor U as Pastor
  participant FE as Login form
  participant RR as React Router
  participant SVC as service.login
  participant BCRYPT as bcryptjs
  participant DB as Prisma

  U->>FE: preenche email + senha
  U->>FE: submit
  FE->>RR: POST /login
  RR->>SVC: login(email, senha)
  SVC->>DB: membro.findUnique({ email })
  DB-->>SVC: membro
  SVC->>BCRYPT: compare(senha, membro.senhaHash)
  BCRYPT-->>SVC: true
  SVC->>SVC: createSession(membro.id)
  SVC-->>RR: { sessionId, user }
  RR-->>FE: 302 Set-Cookie sid=...; Location=/app
  FE-->>U: redireciona
```

### 15.2 Cadastrar visitante (RN-MEM-05)

```mermaid
sequenceDiagram
  actor U as Secretário
  participant FE as Form Membro (UI)
  participant RR as React Router
  participant SVC as service.criarMembro
  participant TX as db.$transaction
  participant DB as SQLite

  U->>FE: preenche tipo=VISITANTE
  U->>FE: submit
  FE->>RR: POST /app/membros
  RR->>SVC: criarMembro(input, user)
  SVC->>SVC: Zod parse
  SVC->>TX: $transaction
  TX->>DB: membro.create({ tipo: VISITANTE })
  TX->>DB: configGeral.findFirst()
  alt tem responsavelMembroId
    TX->>DB: alerta.create({ destinatario: { membroId } })
  else tem responsavelMinisterioId
    TX->>DB: alerta.create({ destinatarios: { todos membros do ministério } })
  end
  TX-->>SVC: ok
  SVC-->>RR: membro
  RR-->>FE: 302 /app/membros/:id
```

### 15.3 Tentar acessar aba dízimos sem permissão (RN-MEM-03)

```mermaid
sequenceDiagram
  actor U as Discipulador
  participant FE as Browser
  participant RR as React Router
  participant MW as Middleware
  participant SVC as service.getDizimos

  U->>FE: GET /app/membros/:id?tab=fidelidade
  FE->>RR: request
  RR->>MW: middleware()
  MW-->>RR: { user: Discipulador }
  RR->>RR: requireRole(user, [ADMIN, PASTOR, FINANCEIRO])
  RR-->>FE: 403 Forbidden
  alt bypass via API
    U->>RR: GET /app/membros/:id/api/dizimos
    RR->>SVC: getDizimos(membroId, user)
    SVC-->>RR: ForbiddenError
    RR-->>FE: 403 Forbidden
  end
```

> **Defesa em 3 camadas comprovada por este diagrama:** UI esconde a aba, loader checa role, service checa role. O atacante tem que burlar 3 coisas.

---

## 17. Pendências para próximos agentes

> Lista de itens **fora do escopo desta task** que precisam ser endereçados em fases seguintes.

### 16.1 Backend agent (Fase 5)

- [ ] Criar `prisma/seed.ts` com `upsert` do primeiro ADMIN (idempotente).
- [ ] Adicionar model `Session` ao schema (id, userId, expiresAt, absoluteExpiresAt).
- [ ] Implementar `app/lib/session.server.ts` (create/get/delete/renew).
- [ ] Implementar `app/lib/auth.server.ts` (requireUser, requireRole, verifyCredentials).
- [ ] Implementar `app/services/membros.server.ts` com TDD.
- [ ] Implementar `app/services/alertas.server.ts` com TDD.

### 16.2 Designer agent (Fase 3)

- [ ] Wireframes de baixa fidelidade: login, lista de membros, ficha do membro, central de alertas, config de acolhimento.
- [ ] Diagrama de navegação entre rotas autenticadas.

### 16.3 RAG-curator (Fase 1 auxiliar)

- [ ] `.harness/RAG/cpf-validation.md` — por que não coletamos.
- [ ] `.harness/RAG/session-security.md` — checklist de session cookie.
- [ ] `.harness/RAG/rbac-pattern.md` — padrão defense in depth aplicado a 3 camadas.
- [ ] `.harness/RAG/prisma-rr7-setup.md` — gotchas do Prisma 7 com React Router 7 SSR.

### 16.4 Decisions pendentes (`[A CONFIRMAR]`)

1. **Zod vs Valibot vs TypeBox** (ADR-003) — sugestão: Zod.
2. **TTL exato da sessão** — sugestão: 7d sliding, teto 30d abs.
3. **Política de senha** — sugestão: ≥ 8 chars, sem forçar complexidade.
4. **Comportamento da aba Fidelidade Financeira** para perfis bloqueados — sugestão: não renderizar (RN-MEM-03).
5. **Rate limit no `/login`** — sugestão: 5 tentativas / 15min / IP.
6. **Resolução de `app/prisma.config.ts` vs `prisma.config.ts`** (duplicata detectada) — ver abaixo.

---

## 18. Anexo: Decisões pendentes detectadas

Durante a Fase 1, identifiquei os seguintes pontos que precisam de decisão explícita antes de começar a Fase 5:

### 17.1 Duplicata `prisma.config.ts`

Existem **dois** arquivos de configuração do Prisma:

- `prisma.config.ts` (raiz) — gerado automaticamente pelo `prisma init`, parece "oficial".
- `app/prisma.config.ts` — criado manualmente em algum momento, mas o RR7 normalmente lê o da raiz.

**Recomendação:** manter apenas `prisma.config.ts` na raiz. O `app/prisma.config.ts` deve ser deletado pelo backend agent. **Decisão pendente** — confirmar com o usuário.

### 17.2 Model `Session` não existe no schema

Sem `Session`, não há como invalidar sessões no servidor (logout real). **Decisão:** adicionar como migration inicial. Estrutura sugerida:

```prisma
model Session {
  id                  String   @id @default(uuid())
  membroId            String
  membro              Membro   @relation(fields: [membroId], references: [id], onDelete: Cascade)
  expiresAt           DateTime
  absoluteExpiresAt   DateTime
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  @@map("sessions")
}
```

> Isso requer adicionar o back-relation em `Membro.alter()`. **Decisão pendente** — confirmar com o designer.

### 17.3 `app/routes.ts` tem `index("app/api/auth/login.ts")` como rota

A linha 11 do `app/routes.ts` atual tem:

```ts
// api
index("app/api/auth/login.ts"),
```

Isso faz com que `app/api/auth/login.ts` seja tratado como rota (substituindo `/` na raiz), o que **não** é o desejado para um endpoint de API. **Recomendação:** remover essa linha e tratar endpoints de API fora do `routes.ts` (usar `app/api/` como servidor HTTP independente, ou usar RR7 resource routes com `.` no nome).

---

## Próxima revisão

- **Quando:** ao final de cada sprint (Fase 5 completa) ou quando schema/fluxos mudarem.
- **Por quem:** `documenter` agent, acionado pelo orchestrator.
- **O que atualizar:** especialmente a §11 (ADRs), §12 (Roadmap) e §18 (Pendências) — os itens 18.1-18.3 devem sumir à medida que forem resolvidos.
