---
title: Arquitetura — Monólito Modular no React Router 7 SSR
category: architecture
applies_to:
  - app/**
  - prisma/schema.prisma
created: 2026-06-12
updated: 2026-06-12
version: 1.0
status: approved
priority: high
sources:
  - brief.md §6 (Stack e Decisões Técnicas)
  - docs/REGRAS_DE_NEGOCIO.md (RN-MEM-01 a RN-EST-05)
  - docs/DESCRIÇÃO_DOS_MODULOS.md
tags: [architecture, react-router, ssr, monolith, modularity, prisma]
owner: rag-curator
---

## 1. Contexto

A Igreja Conect é um sistema de gestão para **uma única igreja local** (multi-tenant está explicitamente fora de escopo, ver `brief.md §4`). A operação real estimada é de **centenas a poucos milhares de membros ativos**, com picos previsíveis (cadastro de visitantes em campanhas, lançamentos financeiros no fechamento do mês) e zero requisito de escalabilidade horizontal.

Nesse cenário, microsserviços são over-engineering: introduziriam contêineres, rede, versionamento de contratos, observabilidade distribuída — tudo para um time pequeno manter. A escolha técnica é um **monólito modular**: um único deploy, um único processo Node, mas com fronteiras internas claras por pasta para que o código escale **em complexidade de leitura**, não em número de serviços.

A separação por pastas serve a um objetivo didático: ao abrir qualquer arquivo, o dev sabe imediatamente se está lidando com regra de servidor, UI, regra de negócio pura, ou persistência.

## 2. Decisão / Regra

**A Igreja Conect é um monólito modular React Router 7 com SSR habilitado.** Estrutura canônica de pastas em `app/`:

```
app/
├── root.tsx               # Layout HTML raiz, ErrorBoundary
├── routes.ts              # Config declarativa de rotas (route/index)
├── app.css                # Tailwind 4 entrypoint
├── routes/                # UI: loaders + actions + componentes por página
│   ├── public/            # /, /login (sem auth)
│   └── app/               # /app/** (com auth, layout autenticado)
├── api/                   # Endpoints de servidor: lógica fina, delega ao service
│   └── auth/login.ts
├── lib/                   # Services: regras de negócio puras, testáveis sem I/O
│   ├── members.server.ts
│   ├── discipleship.server.ts
│   └── auth.server.ts
├── db/                    # Prisma singleton + helpers de transação
│   └── prisma.server.ts
└── components/            # Componentes React puros, reutilizáveis, sem I/O
```

**Regras de fronteira (não negociáveis):**

1. **`routes/`** pode importar de `lib/` e `db/`. Nunca o contrário.
2. **`lib/` (services)** pode importar de `db/`. **Não** importa de `routes/` ou `components/`. Esta é a fronteira que torna services testáveis sem subir React Router.
3. **`db/`** é o único lugar que importa o `PrismaClient`. Exports somente do singleton.
4. **`components/`** não acessa `db/`. Recebe dados via props ou loader.
5. Sufixo `.server.ts` em qualquer arquivo garante que **nunca** seja importado no bundle do cliente (Vite/React Router o exclui). Usar este sufixo em **todo** arquivo que toca `db`, `process.env`, ou `bcrypt`.

**Limite de quebra:** não migrar para microsserviços antes de **5.000 membros ativos** e de evidência concreta (latência, custo, gargalo de time) de que o monólito não aguenta. Acima desse limiar, a conversa volta à mesa.

## 3. Consequências

- **Positivas:**
  - Um único `pnpm dev`, um único `pnpm build`, um único deploy. Onboarding de dev em < 1 dia.
  - Transações de banco cruzando módulos (ex: cadastrar visitante + gerar alerta + atualizar config) são triviais — uma transação Prisma, sem Saga, sem compensação.
  - Tipos fluem de Prisma → service → loader → componente sem serialização intermediária.
  - SSR do React Router 7 emite cookies de sessão nativamente; não exige camada extra.
- **Negativas:**
  - Qualquer deploy ruim derruba o sistema inteiro. Mitigação: feature flags em env vars + migrations reversíveis.
  - Sem isolamento de falhas entre módulos — um `throw` em Estoque derruba Auth. Mitigação: ErrorBoundary por rota em `root.tsx` (já existe) e try/catch defensivo em loaders de UI.
  - Crescimento desordenado do bundle se ninguém fiscalizar. Mitigação: rotas em `routes/app/**` com `lazy` e `defer` quando necessário.
- **Trade-offs aceitos:**
  - Acoplamento temporal entre times se houver mais de 3 devs simultâneos. Aceitável: time estimado do projeto é 1–2 devs.

## 4. Exemplos

**Estrutura real já presente no projeto (jun/2026):**

```
app/
├── root.tsx           # já existe, com Layout + ErrorBoundary
├── routes.ts          # já existe, declara /, /login
├── app.css            # já existe
├── prisma.config.ts   # já existe, define schema + migrations path
├── routes/
│   ├── public/
│   │   ├── index.tsx  # já existe (landing)
│   │   └── login.tsx  # já existe
└── api/
    └── auth/
        └── login.ts   # placeholder vazio, aguardando implementação TDD
```

**Padrão de import respeitando a fronteira (a ser seguido quando services forem criados):**

```ts
// ✅ app/routes/app/membros/$id.tsx — loader (UI)
import { getMembroById } from "~/lib/members.server";
import type { Route } from "./+types/$id";

export async function loader({ params }: Route.LoaderArgs) {
  const membro = await getMembroById(params.id);
  return { membro };
}

// ✅ app/lib/members.server.ts — service (regra de negócio)
import { prisma } from "~/db/prisma.server";

export async function getMembroById(id: string) {
  return prisma.membro.findUnique({ where: { id } });
}

// ❌ ERRADO: componente importando service
// app/components/MembroCard.tsx
import { getMembroById } from "~/lib/members.server"; // quebra a regra §2
```

## 5. Anti-exemplos

- ❌ **Criar `services/estoque-service/`, `services/auth-service/`, `services/financeiro-service/` como pacotes separados no `pnpm` workspace.** É um monólito, não microfrontend. Pacotes separados adicionam build steps, versionamento e refactor churn sem benefício.
- ❌ **Mover a lógica de validação de 12 discípulos para dentro do componente React.** Isso torna a regra testável só via E2E (Playwright), em vez de um teste unitário puro em `lib/`.
- ❌ **Acessar `prisma.membro.findMany()` diretamente de um `loader` de rota sem passar por um service em `lib/`.** A rota vira depósito de regra; refatorar para reutilizar fica caro.
- ❌ **Criar uma pasta `app/server/` espelhando `app/api/` para separar concerns.** `api/` já é o "server" no contexto do React Router 7 — duplicar gera confusão sobre onde colocar cada endpoint.
- ❌ **Importar bcrypt, `process.env` ou `fs` em arquivo sem sufixo `.server.ts`.** Vaza para o bundle do cliente. Erro fatal de segurança (chave exposta no JS do browser).

## 6. RAGs relacionados

- [`security-rbac-matrix.md`](./security-rbac-matrix.md) — onde o controle de perfis é aplicado em cada camada desta arquitetura.
- [`lgpd-igreja-conect.md`](./lgpd-igreja-conect.md) — o `.server.ts` é o que impede que `senhaHash` ou `Membro.email` vaze para o payload de hidratação.
- [`convention-prisma-sqlite.md`](./convention-prisma-sqlite.md) — o singleton em `app/db/prisma.server.ts` é a única ponte para o banco.

## 7. Notas de aplicação

- **Como começar uma nova feature:** primeiro criar o service em `app/lib/<domínio>.server.ts` com testes unitários (TDD), depois o loader/action em `app/routes/`, depois o componente. **Nunca** o contrário.
- **Armadilha comum:** devs juniors tendem a colocar regra em `loader` e em `action` separadas. Extrair para `lib/` desde o primeiro `if` — não esperar o terceiro.
- **Verificação no PR:** rodar `pnpm typecheck` (que inclui `react-router typegen && tsc`) antes de commitar. Se o caminho `routes/ → lib/ → db/` aparecer invertido em algum import, o typecheck pode não pegar — revisar manualmente.
- **Quando questionar esta decisão:** se aparecer um requisito real de integração com sistema externo pesado (ex: gateway Pix, ERP contábil) que exija isolamento de processo. Aí sim avalia-se uma extração cirúrgica (1 serviço, não N).
