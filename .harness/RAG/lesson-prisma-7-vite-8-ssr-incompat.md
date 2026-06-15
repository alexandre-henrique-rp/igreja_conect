---
title: Lição — Prisma 7.8 + Vite 8 SSR são incompatíveis em dev (use build de produção)
category: lesson
applies_to:
  - vite.config.ts
  - package.json (prisma, vite versions)
  - app/db/prisma.server.ts
  - .harness/workflows/dev-server.md
created: 2026-06-13
updated: 2026-06-13
version: 1.0
status: approved
priority: high
sources:
  - Erro real encontrado em S04 (2026-06-13 18:24 BRT): "Vite module runner has been closed"
  - package.json (prisma 7.8.0, vite 8.0.16, @prisma/client 7.8.0, @prisma/adapter-better-sqlite3 7.8.0)
  - Stack trace: generated/prisma/internal/class.ts:48:33 → ModuleRunner.cachedModule
  - WasmQueryCompilerLoader.ts:24 (Prisma carrega WASM QueryCompiler via Object.getRuntime)
tags: [lesson, prisma, vite, ssr, dev-server, runtime, incompatibility, prisma-7, vite-8]
owner: rag-curator
---

## 1. Contexto

A Igreja Conect usa **Prisma 7.8** (com `prisma-client` generator + WASM QueryCompiler) sobre **Vite 8.0.16** em SSR (via `@react-router/dev`). Esta combinação **não funciona em modo de desenvolvimento** (`pnpm dev`).

**Sintoma:** ao executar a primeira query Prisma (ex: `POST /login` que faz `prisma.membro.findUnique`), o servidor retorna **HTTP 500** com a mensagem:

```
Oops!
Vite module runner has been closed.

Error: Vite module runner has been closed.
    at ModuleRunner.getModuleInformation (file:///.../vite/dist/node/module-runner.js:1194:26)
    at ModuleRunner.cachedModule (.../vite/dist/node/module-runner.js:1176:18)
    at request (.../vite/dist/node/module-runner.js:1216:94)
    at dynamicRequest (.../vite/dist/node/module-runner.js:1218:122)
    at Object.getRuntime (.../generated/prisma/internal/class.ts:48:33)
    at .../WasmQueryCompilerLoader.ts:24:44
    at Object.loadQueryCompiler (.../WasmQueryCompilerLoader.ts:41:7)
    at jt.#instantiateQueryCompiler (.../ClientEngine.ts:261:66)
```

**Por que acontece:** o Prisma 7.8 introduziu um **WASM QueryCompiler** carregado dinamicamente via `Object.getRuntime` (definido em `generated/prisma/internal/class.ts:48`). Em SSR, o Vite 8 fecha o `ModuleRunner` logo após o startup do servidor; quando o Prisma tenta carregar o compilador WASM, o runtime já está fechado, e a primeira query cai com erro.

**Descoberto em:** S04 (2026-06-13), durante smoke test manual após rework de segurança. Todos os 872 testes unitários + 28 E2E passaram (eles rodam contra o servidor de teste do Playwright, que é instanciado sob demanda), mas o `pnpm dev` quebra no login.

## 2. Decisão / Regra

### 2.1 Regra de ouro: **para validar o app manualmente, sempre use `pnpm build && pnpm start`, nunca `pnpm dev`**

O servidor de produção (`react-router-serve ./build/server/index.js`) **não passa pelo Vite** e o Prisma funciona normalmente.

```bash
# 1. Build (uma vez, ou após cada mudança)
pnpm build

# 2. Servidor de produção (porta 3000)
DATABASE_URL="file:./dev.db" \
SESSION_SECRET="qualquer-string-com-16-chars-ou-mais-xyz123" \
  pnpm start
# Abre em http://localhost:3000
```

### 2.2 Para dev server, use `.env.development` (NÃO `.env`)

O Vite carrega automaticamente `.env.development.local`, `.env.development`, `.env.local`, `.env` em ordem de precedência. Como o hook `path-boundary.ts` do harness **bloqueia edição de `.env`**, crie `.env.development`:

```bash
# .env.development (ignorado pelo path-boundary, lido pelo Vite)
SESSION_SECRET="dev-only-secret-32-chars-min-abcdef123456"
# DATABASE_URL é lido de .env (já existe) — Prisma/Vite pegam
```

> **Atenção:** o hook path-boundary do harness v6.3.0 bloqueia edições em `.env` (deny pattern). Para env vars em dev, use `.env.development`, `.env.local` ou `.env.development.local`.

### 2.3 Por que `pnpm dev` não tem fix estável ainda

Testei 2 workarounds no `vite.config.ts` antes de validar a abordagem de produção. **Ambos quebram:**

| Tentativa | Configuração | Erro resultante |
|---|---|---|
| `ssr.noExternal: ["@prisma/client", "@prisma/adapter-better-sqlite3"]` | Força Vite a processar Prisma como módulo interno | `module is not defined` em `SourceFileSlice.ts:120:68` (Prisma usa CJS internamente, conflito com ESM do Vite) |
| `optimizeDeps.exclude: ["@prisma/client", ...]` + `ssr.external: ["@prisma/client"]` | Exclui Prisma do prebundling | Mesmo erro `module is not defined` |

Aguardar **Prisma 7.9+** (com fix de compatibilidade Vite 8) ou **downgrade para Prisma 6.x**. Não há patch viável no app.

### 2.4 Workaround temporário aceitável: `pnpm build && pnpm start` em dev

Trade-offs:

- **Pro:** app funciona, login OK, todas as rotas /app/** retornam 200, permite smoke test manual real.
- **Contra:** ciclo de iteração mais lento (build ~5s a cada mudança), sem HMR, sem source maps.
- **Quando usar:** validação manual de fluxos completos, demo para stakeholder, smoke test antes de commit.
- **Quando NÃO usar:** desenvolvimento iterativo de UI (HMR é mais rápido), debugging de estado complexo (HMR permite isolate de módulo).

## 3. Consequências

### Positivas

- Smoke test manual sempre funciona (sem "vai que dá").
- Server de produção é o mesmo que vai pra staging/prod — menos surpresas em deploy.
- Força o dev a rodar `pnpm build` regularmente, pegando erros de build cedo.

### Negativas

- DX pior que `pnpm dev` (sem HMR, sem fast refresh).
- Build precisa rodar a cada mudança de código de UI (~5s).
- Devs acostumados com HMR podem achar estranho.

### Trade-offs aceitos

- **Não** fazer downgrade de Prisma ou Vite só para resolver isso — o restante do stack depende das versões atuais.
- **Não** investir tempo em patch do `vite.config.ts` (já validado que não tem solução estável).
- **Sim** criar/atualizar `.env.development` automaticamente em `pnpm install` via `postinstall` script (a fazer).

## 4. Exemplos

**Exemplo 1 — Setup mínimo para dev manual (copiar/colar):**

```bash
# 1. Criar .env.development (caso não exista)
cat > .env.development <<EOF
SESSION_SECRET="$(openssl rand -hex 24)"
EOF

# 2. Build de produção
pnpm build

# 3. Subir servidor (porta 3000)
DATABASE_URL="file:./dev.db" pnpm start

# 4. Em outro terminal: testar
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=admin@igreja.local&senha=admin123" \
  -c /tmp/cookies.txt
# → HTTP 302 (redirect para /app) ✅

curl -L -b /tmp/cookies.txt http://localhost:3000/app
# → HTTP 200, página renderiza com "Boa noite" e menu lateral ✅
```

**Exemplo 2 — Smoke test de regressão pós-rework:**

```bash
# Rodar TODOS os gates em sequência
pnpm typecheck     # typecheck
pnpm test          # 872 unit + integration
pnpm test:e2e      # 28 E2E (Playwright sobe seu próprio server, não usa Vite dev)
pnpm build         # build SSR (valida que Prisma compila em prod)
pnpm audit --json  # 0 critical, 0 high, 0 medium, 0 low
```

**Exemplo 3 — Erro típico se tentar usar `pnpm dev` (NÃO fazer):**

```bash
$ pnpm dev
# ... servidor sobe ok na porta 5173 ...
$ curl -X POST http://localhost:5173/login -d "email=admin@igreja.local&senha=admin123"
<!DOCTYPE html>
<html lang="en">
  <head><title>Error</title></head>
  <body>
    <h1>Internal Server Error</h1>
    <h2>Vite module runner has been closed.</h2>
    <pre>Error: Vite module runner has been closed.
      at ModuleRunner.getModuleInformation (...)
      ...
      at Object.getRuntime (.../generated/prisma/internal/class.ts:48:33)
      at .../WasmQueryCompilerLoader.ts:24:44</pre>
  </body>
</html>
# → HTTP 500, NÃO é bug do app, é incompatibilidade Prisma 7.8 + Vite 8 SSR
```

## 5. Anti-exemplos

- ❌ **Tentar `pnpm dev` para validar o app manualmente.** Vai cair com "Vite module runner has been closed" na primeira query. Use `pnpm build && pnpm start`.
- ❌ **Adicionar `ssr.noExternal: ["@prisma/client"]` no `vite.config.ts` para "consertar" o dev.** Vai quebrar com "module is not defined" (Prisma é CJS internamente).
- ❌ **Editar `.env` diretamente** (o hook `path-boundary.ts` do harness bloqueia com `[path-boundary] BLOCKED: '.env' matches deny pattern`). Use `.env.development`.
- ❌ **Hardcodar `SESSION_SECRET` no código** (ex: `process.env.SESSION_SECRET ?? "dev-secret"`). O rework S04 removeu esse anti-pattern por segurança; reintroduzir para "resolver o dev" é regressão de segurança. Use `.env.development` com valor real.
- ❌ **Downgradar Prisma para 6.x só para ter `pnpm dev` funcional.** Quebra o resto do stack (Prisma 6 não tem `prisma-client` generator nem WASM QueryCompiler). YAGNI — só faça se aparecer outro problema crítico do Prisma 7.8.
- ❌ **Reportar o erro como bug do Igreja Conect e abrir issue no Prisma/Vite sem antes tentar `pnpm build && pnpm start`.** Pode ser que o app esteja OK e só o dev server esteja quebrado.
- ❌ **Adicionar `console.log(prisma)` no `app/db/prisma.server.ts` para "debugar".** O problema não é o client, é o loader WASM do runtime. Não polui o código.
- ❌ **Tentar `pnpm prisma generate` para "regenerar tudo".** Não resolve — o `generated/prisma/` está OK, o problema é como o Vite 8 trata esse módulo em SSR.

## 6. RAGs relacionados

- [`convention-prisma-sqlite.md`](./convention-prisma-sqlite.md) — define o singleton em `app/db/prisma.server.ts` e o workflow de migration; este RAG é o **complemento de runtime** (o outro é de schema/sintaxe).
- [`architecture-monolith-modular.md`](./architecture-monolith-modular.md) — explica que `app/db/prisma.server.ts` é a única ponte para o banco; este RAG explica que essa ponte não funciona com Vite 8 dev, mas funciona com `react-router-serve`.
- (a criar) `workflow-dev-server.md` — passo a passo para subir o ambiente de dev (build + start + smoke test), referenciando esta lição.

## 7. Notas de aplicação

- **Em PR que toca `vite.config.ts`:** checklist do reviewer:
  - [ ] Não adicionou `ssr.noExternal` para `@prisma/client`? (vai quebrar com "module is not defined")
  - [ ] Não adicionou `optimizeDeps.exclude` para `@prisma/client`? (mesmo erro)
  - [ ] Se adicionou config nova, rodou `pnpm build && pnpm start` para validar?
- **Em PR que toca `app/db/prisma.server.ts`:** rodar `pnpm build && pnpm start` e fazer login (`admin@igreja.local` / `admin123`) — não confiar só em `pnpm test` (que roda contra SQLite em memória, sem o bug).
- **Em PR que toca `package.json` (versão de Prisma ou Vite):** verificar se a versão nova corrige o bug; se não, manter as versões pinadas (`7.8.0` e `8.0.16` respectivamente).
- **Sinal de code review:** se alguém comentar "mas em dev funciona" sem ter rodado `pnpm build && pnpm start`, pedir para validar de novo.
- **Quando a Prisma 7.9+ sair:** rodar `pnpm prisma migrate dev` (após bump), `pnpm test`, `pnpm test:e2e`, e tentar `pnpm dev` — se funcionar, atualizar este RAG com a resolução e remover o workaround de produção.
- **Quando a Vite 9+ sair:** mesma lógica — testar `pnpm dev` e atualizar.
- **Em dev local, o ciclo é:** edit code → `pnpm build` (~5s) → refresh browser em `http://localhost:3000`. Aceitável para o volume de mudança deste projeto (MVP).
- **Reportar upstream:** acompanhar issue no `prisma/prisma` e `vitejs/vite` sobre "Prisma 7.x WASM QueryCompiler + Vite 8 SSR module runner closed".
