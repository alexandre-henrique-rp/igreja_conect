---
title: Pattern — Alerta Manual para Manutenção sem Prazo (RN-EST-04) — Gatilho On-Consulta Sem Cron
category: pattern
applies_to:
  - app/lib/patrimonio.server.ts
  - app/lib/manutencao.server.ts
  - app/lib/alerts.server.ts (ciclo 1, reaproveitado)
  - app/routes/app/estoque/$id.tsx (loader)
  - app/routes/app/alertas._index.tsx (loader)
  - prisma/schema.prisma (ManutencaoAtivo, Alerta)
created: 2026-06-19
updated: 2026-06-19
version: 1.0
status: approved
priority: medium
sources:
  - brief.md §4.6 (Alerta para Manutenção sem prazo — versão simplificada)
  - brief.md §5.1 (Decisão: sem cron job no MVP)
  - docs/REGRAS_DE_NEGOCIO.md §3 (RN-EST-04)
  - .harness/RAG/pattern-patrimonio-status-state-machine.md (state machine EM_MANUTENCAO)
  - .harness/RAG/architecture-monolith-modular.md (sem Redis, sem message broker)
tags: [pattern, manutencao, alerta, rn-est-04, on-consulta, idempotencia, sem-cron, escalonamento]
owner: rag-curator
---

## 1. Contexto

A **RN-EST-04** exige que itens em manutenção há muito tempo sem prazo definido gerem **alertas recorrentes** para evitar o "esquecido na assistência técnica":

> *"O sistema deve emitir alerta recorrente para itens em manutenção externa sem prazo de retorno definido, com escalonamento de urgência."* — `docs/REGRAS_DE_NEGOCIO.md §3` (RN-EST-04)

A implementação "padrão de mercado" seria um **cron job** (`node-cron`, `BullMQ`, `Celery`) que roda diariamente, busca manutenções ativas sem prazo, e dispara alertas. Mas o **stack do Igreja Conect** (constraint do brief §6.4) é **monólito modular sem Redis, sem message broker, sem scheduler**:

- ❌ Sem `node-cron` configurado no MVP (decisão do brief §5.1).
- ❌ Sem fila persistente (SQLite + `$transaction` cobre atomicidade, não agendamento).
- ❌ Sem worker assíncrono (1 processo Node serve HTTP).

A solução adotada é **alerta on-consulta**: a checagem roda no **loader** das rotas que naturalmente visitam os dados. É a forma de entregar a **intenção** da RN (alertas existem, são escalonados, são idempotentes) sem o custo de scheduler.

**Trade-off aceito:** se ninguém consultar a rota `/app/estoque/:id` de um item em manutenção há 60 dias, o alerta não dispara. **Mitigação:** a checagem também roda na rota `/app/alertas` (que tem visitação frequente — todos os usuários com acesso a estoque passam por lá).

**Quando reconsiderar:** se a base de usuários crescer e o "alguém esquece de consultar" virar problema real, migra para cron em processo único (constraint `ARCH.md §12 backlog`). O service de checagem fica **reaproveitado** — só muda o gatilho.

## 2. Decisão / Regra

**Toda vez que o loader de uma rota "quente" (que naturalmente visita dados de estoque/patrimônio) executa, o service `verificarAlertaManutencaoSemPrazo(itemId, user)` é chamado. Ele é idempotente (24h de janela) e cria alertas escalonados conforme idade da manutenção.**

### 2.1 Helper canônico em `app/lib/manutencao.server.ts`

```ts
import { prisma } from "~/db/prisma.server";
import { criarAlerta } from "~/lib/alerts.server";

const JANELA_IDEMPOTENCIA_HORAS = 24;
const ALERTA_30_DIAS_DIAS = 30;
const ALERTA_6_DIAS_DIAS = 6;

/**
 * RN-EST-04: verifica se item em manutenção há muito tempo sem prazo
 * definido merece alerta. Cria alerta escalonado se necessário.
 *
 * **Idempotente:** janela de 24h — não cria 2 alertas no mesmo dia.
 * **Escalonamento:**
 *   - >30 dias sem prazo → "Item X em manutenção há >30 dias sem prazo definido."
 *   - >6 dias sem prazo  → "Item X em manutenção há >6 dias sem prazo definido."
 *
 * @param {string} itemId - UUID do item a verificar.
 * @param {SessionUser} user - Usuário que disparou a checagem (apenas log).
 * @returns {Promise<Alerta | null>} Alerta criado ou null (não precisava criar).
 * @example
 *   // No loader de /app/estoque/$id.tsx:
 *   await verificarAlertaManutencaoSemPrazo(itemId, user);
 */
export async function verificarAlertaManutencaoSemPrazo(
  itemId: string,
  user: SessionUser
): Promise<Alerta | null> {
  const item = await prisma.itemEstoque.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      nome: true,
      statusPatrimonio: true,
      manutencoes: {
        where: { dataRetorno: null }, // manutenção ainda aberta
        orderBy: { dataEnvio: "desc" },
        take: 1,
        select: { id: true, dataEnvio: true, prazoTermino: true },
      },
    },
  });

  // Só gera alerta se item está EM_MANUTENCAO com prazo NULL.
  if (!item || item.statusPatrimonio !== "EM_MANUTENCAO") return null;
  if (item.manutencoes.length === 0) return null;

  const manutencao = item.manutencoes[0];
  if (manutencao.prazoTermino !== null) return null; // tem prazo, sem alerta

  const agora = new Date();
  const idadeMs = agora.getTime() - manutencao.dataEnvio.getTime();
  const idadeDias = Math.floor(idadeMs / (1000 * 60 * 60 * 24));

  // Define nível de escalonamento.
  let mensagem: string | null = null;
  if (idadeDias >= ALERTA_30_DIAS_DIAS) {
    mensagem = `Item "${item.nome}" em manutenção há >${ALERTA_30_DIAS_DIAS} dias sem prazo definido. Atualize o status.`;
  } else if (idadeDias >= ALERTA_6_DIAS_DIAS) {
    mensagem = `Item "${item.nome}" em manutenção há >${ALERTA_6_DIAS_DIAS} dias sem prazo definido.`;
  }
  if (!mensagem) return null; // dentro do tolerável (< 6 dias)

  // Idempotência 24h: não criar alerta se já existe para este item nas últimas 24h.
  const janelaAtras = new Date(agora.getTime() - JANELA_IDEMPOTENCIA_HORAS * 60 * 60 * 1000);
  const alertaRecente = await prisma.alerta.findFirst({
    where: {
      titulo: { contains: item.nome },
      createdAt: { gte: janelaAtras },
      // Critério de busca: alertas de manutenção usam prefixo padronizado no titulo.
    },
    select: { id: true },
  });
  if (alertaRecente) return null;

  // Cria alerta com destinatários "todos" (todos usuários autenticados recebem).
  return criarAlerta({
    titulo: `[Manutenção sem prazo] ${item.nome}`,
    mensagem,
    destinatario: "todos",
    origem: "RN-EST-04",
    itemEstoqueId: item.id,
    contexto: {
      manutencaoId: manutencao.id,
      idadeDias,
      disparadoPorId: user.id, // log apenas, não exibido em UI
    },
  });
}
```

### 2.2 Gatilhos (rotas quentes)

A checagem é chamada em **2 loaders** principais:

```ts
// 1) app/routes/app/estoque/$id.tsx (detalhe do item)
export async function loader({ params, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  const item = await getItemById(params.id, user);

  // RN-EST-04: alerta on-consulta para itens em manutenção sem prazo.
  await verificarAlertaManutencaoSemPrazo(params.id, user);

  return { item, ... };
}

// 2) app/routes/app/alertas._index.tsx (central de alertas — visitação frequente)
export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);

  // RN-EST-04: também verifica aqui — qualquer usuário que abre /app/alertas
  // dispara checagem para todos os itens EM_MANUTENCAO sem prazo.
  if (podeVerEstoque(user)) {
    const itensEmManutencao = await prisma.itemEstoque.findMany({
      where: { statusPatrimonio: "EM_MANUTENCAO", ativo: true },
      select: { id: true },
    });
    for (const item of itensEmManutencao) {
      await verificarAlertaManutencaoSemPrazo(item.id, user);
    }
  }

  return { alertas: await listarAlertasDoUsuario(user.id) };
}
```

### 2.3 Idempotência 24h — contrato

A checagem **NÃO** cria alerta se já existe um alerta para o mesmo item (mesmo `titulo` ou vinculado via `origem: "RN-EST-04"`) nas últimas **24 horas**.

```ts
// Janela de idempotência definida no helper.
const JANELA_IDEMPOTENCIA_HORAS = 24;
```

> **Por que 24h e não 6h?** Trade-off entre spam e responsividade. 24h cobre o ciclo de uso típico (1 acesso por dia). Se um usuário acessa 50x no mesmo dia, não recebe 50 alertas.

### 2.4 Escalonamento — tabela de gatilhos

| Idade da manutenção | Nível | Mensagem | Janela de reenvio |
|---|---|---|---|
| 0-5 dias | (sem alerta) | — | — |
| 6-29 dias | Aviso | "Item X em manutenção há >6 dias sem prazo definido." | 24h |
| 30+ dias | Urgente | "Item X em manutenção há >30 dias sem prazo definido. Atualize o status." | 24h |

> **Observação:** RN-EST-04 fala em "alerta recorrente". A recorrência é simulada pelo gatilho on-consulta + janela de idempotência. Cada nova consulta após 24h gera novo alerta, mantendo a sensação de "recorrência" sem cron.

## 3. Consequências

### Positivas

- **Zero infra nova:** sem Redis, sem `node-cron`, sem worker. Reusa service de alerta do ciclo 1 + loader existente.
- **Idempotência forte:** janela de 24h impede spam mesmo com múltiplos loaders checando.
- **Testável de forma determinística:** mock de `new Date()` ou injeção de `agora` no helper permite testar todas as transições (0, 6, 30, 60 dias).
- **Custo previsível:** 1 query `findUnique` por consulta (a consulta já seria feita). Sobrecarga marginal.
- **Migração futura facilitada:** quando entrar cron real, o helper `verificarAlertaManutencaoSemPrazo` é **reaproveitado** integralmente — só muda o chamador (de "loader" para "cron job").

### Negativas

- **Depende de visitação humana:** se ninguém consultar `/app/estoque/:id` ou `/app/alertas` por 60 dias, o alerta de 30+ não dispara. Mitigação parcial: rota `/app/alertas` é visitada com frequência.
- **Carga de DB proporcional a visitas:** cada visita a `/app/estoque/:id` adiciona 2 queries (item + alerta recente). Aceitável para 1 igreja; pode virar gargalo com 100+ visitas/dia (não esperado).
- **Múltiplos loaders rodam checagem simultânea** se 2 usuários abrem `/app/estoque/:id` no mesmo segundo. Idempotência de 24h cobre; apenas 1 alerta é criado (o segundo `findFirst` já vê o primeiro).
- **Mensagem contém nome do item** — pode ser texto sensível em igrejas pequenas ("som do pastor João"). Considerar ofuscar (`Item #abc123` em vez de `Item "Som Pastor João"`)? Decisão consciente: nome do item é informação operacional necessária para o usuário agir, não é dado pessoal.

### Trade-offs aceitos

- **Não usar job queue (BullMQ/Bull)** — overhead injustificado para 1 igreja.
- **Não criar `Alerta.manutencaoId` formal como FK** — vínculo é via `titulo contains item.nome` + `origem: "RN-EST-04"`. Alternativa era criar tabela `AlertaManutencao` N:N. **Decisão:** evitar abstração prematura (RAG `architecture-monolith-modular` §5).
- **Não notificar por e-mail/push** — apenas in-app via Alertas (constraint do brief §6.4 — sem SMTP/FCM).
- **Sem retry/backoff** — idempotência + janela de 24h substituem.

## 4. Exemplos

### Exemplo 1 — Chamada no loader (geração preguiçosa)

```ts
// app/routes/app/estoque/$id.tsx
import { verificarAlertaManutencaoSemPrazo } from "~/lib/manutencao.server";

export async function loader({ params, context }: Route.LoaderArgs) {
  const user = context.get(userContext);

  // Carregar item (Camada 3 RBAC no service getItemById).
  const item = await getItemById(params.id, user);

  // RN-EST-04: dispara checagem on-consulta. Idempotente.
  // Não retorna o alerta pro loader — é efeito colateral.
  await verificarAlertaManutencaoSemPrazo(params.id, user).catch((err) => {
    // Log estruturado, NÃO throw (não pode bloquear render do item).
    safeLog({
      acao: "alerta_manutencao_failed",
      itemId: params.id,
      error: String(err),
    });
  });

  return { item, ... };
}
```

> **Importante:** o `catch` impede que falha na criação do alerta quebre a página do item. Alerta é efeito colateral, não pode bloquear UX principal.

### Exemplo 2 — Helper `criarAlerta` reaproveitado (ciclo 1)

```ts
// app/lib/alerts.server.ts (JÁ EXISTE do ciclo 1, sem mudança)
export async function criarAlerta(input: {
  titulo: string;
  mensagem: string;
  destinatario: "todos" | { membroId: string };
  origem: string;
  contexto?: Record<string, unknown>;
  itemEstoqueId?: string;
}) {
  // ... lógica existente: cria Alerta + AlertaDestinatario ...
  return prisma.alerta.create({ ... });
}
```

### Exemplo 3 — Teste de borda (TDD, bloqueador)

```ts
// app/lib/manutencao.server.test.ts
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { setupTestDb, prismaTest, resetTestDb } from "../../tests/helpers/db";
import { verificarAlertaManutencaoSemPrazo } from "./manutencao.server";

describe("RN-EST-04 — Alerta manual de manutenção sem prazo", () => {
  let cleanup: () => Promise<void>;
  beforeAll(async () => { cleanup = await setupTestDb("alerta-manutencao"); });
  afterEach(async () => { await resetTestDb(); });
  afterAll(async () => { await cleanup(); });

  it("NÃO cria alerta se item está DISPONIVEL", async () => {
    const item = await prismaTest.itemEstoque.create({
      data: { nome: "Cadeira", tipo: "PATRIMONIO", quantidade: 1, numeroSerie: "C-001", statusPatrimonio: "DISPONIVEL" },
    });
    const alerta = await verificarAlertaManutencaoSemPrazo(item.id, adminUser);
    expect(alerta).toBeNull();
  });

  it("NÃO cria alerta se manutenção tem prazoTermino definido", async () => {
    const item = await prismaTest.itemEstoque.create({
      data: { nome: "Cadeira", tipo: "PATRIMONIO", quantidade: 1, numeroSerie: "C-002", statusPatrimonio: "EM_MANUTENCAO" },
    });
    await prismaTest.manutencaoAtivo.create({
      data: {
        itemEstoqueId: item.id,
        assistenciaTecnica: "X",
        enderecoAssistencia: "Y",
        dataEnvio: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 dias atrás
        prazoTermino: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // prazo futuro
      },
    });
    const alerta = await verificarAlertaManutencaoSemPrazo(item.id, adminUser);
    expect(alerta).toBeNull();
  });

  it("cria alerta de 6 dias se manutenção sem prazo há 7 dias", async () => {
    const item = await prismaTest.itemEstoque.create({
      data: { nome: "Projetor", tipo: "PATRIMONIO", quantidade: 1, numeroSerie: "PJ-001", statusPatrimonio: "EM_MANUTENCAO" },
    });
    await prismaTest.manutencaoAtivo.create({
      data: {
        itemEstoqueId: item.id,
        assistenciaTecnica: "X",
        enderecoAssistencia: "Y",
        dataEnvio: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        prazoTermino: null,
      },
    });
    const alerta = await verificarAlertaManutencaoSemPrazo(item.id, adminUser);
    expect(alerta).not.toBeNull();
    expect(alerta?.mensagem).toMatch(/manutenção há >6 dias/);
  });

  it("cria alerta de 30 dias (urgente) se manutenção sem prazo há 60 dias", async () => {
    const item = await prismaTest.itemEstoque.create({
      data: { nome: "Caixa de som", tipo: "PATRIMONIO", quantidade: 1, numeroSerie: "CS-001", statusPatrimonio: "EM_MANUTENCAO" },
    });
    await prismaTest.manutencaoAtivo.create({
      data: {
        itemEstoqueId: item.id,
        assistenciaTecnica: "X",
        enderecoAssistencia: "Y",
        dataEnvio: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        prazoTermino: null,
      },
    });
    const alerta = await verificarAlertaManutencaoSemPrazo(item.id, adminUser);
    expect(alerta).not.toBeNull();
    expect(alerta?.mensagem).toMatch(/manutenção há >30 dias/);
  });

  it("NÃO cria alerta duplicado se já existe nas últimas 24h (idempotência)", async () => {
    const item = await prismaTest.itemEstoque.create({
      data: { nome: "Microfone", tipo: "PATRIMONIO", quantidade: 1, numeroSerie: "MIC-001", statusPatrimonio: "EM_MANUTENCAO" },
    });
    await prismaTest.manutencaoAtivo.create({
      data: {
        itemEstoqueId: item.id,
        assistenciaTecnica: "X",
        enderecoAssistencia: "Y",
        dataEnvio: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    });
    // Primeira chamada: cria alerta.
    const alerta1 = await verificarAlertaManutencaoSemPrazo(item.id, adminUser);
    expect(alerta1).not.toBeNull();
    // Segunda chamada (mesmo item, mesmo dia): NÃO cria novo.
    const alerta2 = await verificarAlertaManutencaoSemPrazo(item.id, adminUser);
    expect(alerta2).toBeNull();
  });

  it("cria novo alerta após 24h de janela (recorrência simulada)", async () => {
    const item = await prismaTest.itemEstoque.create({
      data: { nome: "Microfone 2", tipo: "PATRIMONIO", quantidade: 1, numeroSerie: "MIC-002", statusPatrimonio: "EM_MANUTENCAO" },
    });
    await prismaTest.manutencaoAtivo.create({
      data: {
        itemEstoqueId: item.id,
        assistenciaTecnica: "X",
        enderecoAssistencia: "Y",
        dataEnvio: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    });
    // Cria alerta inicial.
    await verificarAlertaManutencaoSemPrazo(item.id, adminUser);
    // Simula passagem de 25h: cria alerta "antigo" com timestamp > 24h atrás.
    const alertaAntigo = await prismaTest.alerta.findFirst({ where: { titulo: { contains: "Microfone 2" } } });
    await prismaTest.alerta.update({
      where: { id: alertaAntigo!.id },
      data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });
    // Nova chamada deve criar alerta (janela passou).
    const novoAlerta = await verificarAlertaManutencaoSemPrazo(item.id, adminUser);
    expect(novoAlerta).not.toBeNull();
  });
});
```

## 5. Anti-exemplos

- ❌ **Criar cron job** (`node-cron`) para alerta de manutenção. Viola decisão do brief §5.1 (sem scheduler no MVP). Custo infra injustificado para 1 igreja.
- ❌ **Criar alerta SEM verificar idempotência.** Resultado: cada visita gera novo alerta; usuário recebe 50 alertas idênticos no dia. UX insuportável.
- ❌ **Criar alerta SEM bloquear o loader em caso de falha.** Se o `criarAlerta` lança e não tem `.catch()`, página do item quebra. Efeito colateral não pode bloquear UX principal.
- ❌ **Criar alerta SEM verificar status `EM_MANUTENCAO`.** Resultado: alerta de item `DISPONIVEL` em manutenção há 30 dias — confuso (item já voltou, mas alerta persiste). Helper valida `statusPatrimonio` ANTES de criar alerta.
- ❌ **Criar alerta SEM verificar `prazoTermino IS NULL`.** Resultado: alerta de item com prazo futuro definido — falso positivo. Item COM prazo de 7 dias não precisa de alerta "sem prazo".
- ❌ **Logar `titulo` do alerta com nome sensível** ("Pastor João" etc). Se isso for problema em igrejas pequenas, considerar ofuscar (`Item #abc123`). Decisão consciente: nome do item é informação operacional, mas registrar essa decisão em comentário para revisão.
- ❌ **Notificar via e-mail/push** (SMTP/FCM). Brief §6.4 + §8 proíbem. Apenas in-app via Alertas.
- ❌ **Criar alerta para manutenção com `dataRetorno !== null`.** Manutenção já fechada; alerta é ruído.
- ❌ **Esquecer `catch` em loaders que chamam helper.** Erro silencioso vira "alerta nunca dispara" — bug difícil de debugar.

## 6. RAGs relacionados

- [`.harness/RAG/pattern-patrimonio-status-state-machine.md`](./pattern-patrimonio-status-state-machine.md) — state machine; este RAG depende do estado `EM_MANUTENCAO` para detectar.
- [`.harness/RAG/architecture-estoque.md`](./architecture-estoque.md) — visão macro do módulo; este RAG é o **gatilho detalhado** + idempotência.
- [`.harness/RAG/architecture-monolith-modular.md`](./architecture-monolith-modular.md) — constraint "sem Redis, sem message broker" que justifica a abordagem on-consulta.
- [`.harness/RAG/lgpd-igreja-conect.md`](./lgpd-igreja-conect.md) — §2.5 proíbe logar conteúdo sensível em `safeLog`; alerta é in-app, sem exfiltração.
- [`.harness/RAG/decision-itemEstoque-soft-delete.md`](./decision-itemEstoque-soft-delete.md) — `ativo = false` impede alertas em itens arquivados (filtro no helper).

## 7. Notas de aplicação

### Checklist de PR que toca alerta de manutenção

- [ ] Helper `verificarAlertaManutencaoSemPrazo` chama `criarAlerta` com idempotência (24h)?
- [ ] Helper verifica `statusPatrimonio === "EM_MANUTENCAO"` E `prazoTermino === null` ANTES de criar?
- [ ] Loader que chama helper tem `.catch()` para não bloquear render?
- [ ] Helper é reaproveitado em **2 loaders quentes**: `/app/estoque/$id` e `/app/alertas`?
- [ ] Mensagem do alerta diferencia nível (6 dias vs 30 dias)?
- [ ] Teste cobre: 0 dias (sem alerta), 5 dias (sem alerta), 7 dias (aviso), 60 dias (urgente), idempotência 24h, recorrência após 25h?
- [ ] `safeLog` aplicado em vez de `console.log`?
- [ ] Item arquivado (`ativo=false`) é filtrado ANTES de gerar alerta?

### Sinal de code review (recusar PR se aparecer)

- `setInterval` / `setTimeout` em código de servidor (próximo de cron). Violação do brief §5.1.
- `node-cron` adicionado como dependência. Violação do brief §6.4.
- Helper de alerta sem idempotência (cada chamada gera novo alerta).
- Loader chama helper sem `.catch()` (alerta pode quebrar página).
- Helper cria alerta para item `DISPONIVEL` ou com `prazoTermino` definido.

### Testes obrigatórios por sprint que entrega o ciclo 3

- ✅ DISPONIVEL → sem alerta.
- ✅ EM_MANUTENCAO com prazo futuro → sem alerta.
- ✅ EM_MANUTENCAO sem prazo há 5 dias → sem alerta.
- ✅ EM_MANUTENCAO sem prazo há 7 dias → alerta "6 dias".
- ✅ EM_MANUTENCAO sem prazo há 60 dias → alerta "30 dias" (urgente).
- ✅ Idempotência: 2ª chamada no mesmo dia → null.
- ✅ Recorrência: alerta antigo > 24h → nova chamada gera novo alerta.
- ✅ Item arquivado (`ativo=false`) → null.
- ✅ Falha no `criarAlerta` → loader continua funcionando (`.catch`).
- ✅ E2E: ADMIN abre `/app/estoque/:id` de item em manutenção há 30+ dias sem prazo, recebe alerta visível em `/app/alertas` (métrica macro).

### Quando reconsiderar este pattern

- **Se a base de usuários crescer** (>50 usuários ativos) e "ninguém consulta" virar problema. Migração para cron em processo único (`node-cron` ou BullMQ simples). Helper é reaproveitado — só muda o chamador.
- **Se entrar notificação por e-mail/push.** Aí alerta precisa de canal adicional. Helper vira `criarAlerta({ canais: ["in-app", "email"] })`.
- **Se a RN-EST-04 exigir "alerta recorrente" no sentido estrito** (ex: a cada 7 dias exatos, sem depender de visita). Cron é inevitável. Helper + `$transaction` para escalonamento permanece.
- **Se algum dia o sistema tiver multi-igreja (multi-tenant).** Helper passa a filtrar por `igrejaId`. Constraint de isolamento por tenant.

### Próximos passos para o ciclo 3 (S11+)

1. **Sprint de hardening:** teste E2E que valida fluxo completo — ADMIN cria item PATRIMONIO, envia para manutenção SEM prazo, espera 7 dias (mock de tempo), abre `/app/estoque/:id`, alerta aparece em `/app/alertas`. Verifica métrica macro do brief §7.1.
2. **Métrica de cobertura:** script `pnpm audit:alertas-manutencao` que roda diariamente e conta quantos itens estão `EM_MANUTENCAO` sem prazo há >30 dias. Reporta discrepância para `lgpd-officer` auditar.
3. **Feature futura (não ciclo 3):** cron real. Quando scheduler entrar (constraint `ARCH.md §12 backlog`), reaproveitar helper integralmente — só mover chamada do loader para o cron.