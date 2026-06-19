# Brief — Igreja Conect — Ciclo 2: Módulo Financeiro

> **Escopo deste brief:** Módulo Financeiro (ciclo 2 do Harness v6).
> **Data:** 2026-06-14.
> **Autor:** `harness-briefing` agent (Fase 0, ciclo 2).
> **Estado:** aguardando `user-approval` para iniciar Fase 1 (Documentação).
> **Versão:** 1.0 (ciclo 2).
> **Cross-ref ao ciclo anterior:** [`brief-mvp.md`](./brief-mvp.md) — stub histórico do ciclo 1 (Auth + Membros + Discipulado + Alertas + Acolhimento, `gate: all-of passed` em 2026-06-13).

---

## 1. Contexto e propósito do ciclo

O **ciclo 1 do Harness v6** (S00–S05) entregou o **MVP** da Igreja Conect: autenticação por session cookie, cadastro de membros com discipulado limitado a 12 discípulos, central de alertas, configuração de acolhimento de visitantes e a matriz RBAC de 6 perfis com **defesa em profundidade em 3 camadas** (UI → loader → service). Ao final do ciclo 1: 905 testes passando, cobertura de linhas 88,21%, `gate: all-of passed`.

O **ciclo 2** tem escopo único e bem delimitado: **implementar o Módulo Financeiro**, cujas 5 regras de negócio (`RN-FIN-01` a `RN-FIN-05`) já estão **documentadas, com schema Prisma pronto e sem UI nem service**. A infraestrutura crítica para o ciclo já existe:

- **Schema Prisma** já contém `Caixa`, `TransferenciaCaixa` e `Lancamento` (com `Int` em centavos e 7 valores em `CategoriaLancamento`).
- **RAGs** [`security-rbac-matrix.md`](./.harness/RAG/security-rbac-matrix.md) e [`convention-monetary-values.md`](./.harness/RAG/convention-monetary-values.md) já estão `approved` e definem padrões não-negociáveis (defesa em 3 camadas, helpers de dinheiro, trava de saldo).
- **Aba "Fidelidade Financeira"** já existe na ficha do membro, restrita aos perfis `ADMIN`, `PASTOR`, `FINANCEIRO` (RN-MEM-03), em formato placeholder aguardando dados reais.
- **Service `getDizimosByMembro`** já aplica `assertCanSeeFinancials` como Camada 3, retornando `[]` (placeholder).

O propósito do ciclo 2 é, portanto, **executar o que a Fase 0 do ciclo 1 já planejou**, sem expansão de requisitos não-ditos. Não há nova decisão arquitetural a tomar — toda decisão de modelagem, segurança, dinheiro e RBAC já foi tomada.

---

## 2. Problema e oportunidade

### 2.1 Problema

A igreja opera hoje o controle financeiro em planilhas paralelas, cadernos físicos ou mesmo na memória do pastor/tesoureiro. Isso gera três riscos concretos:

1. **Risco de governança:** sem trava automatizada, saídas podem ser aprovadas sem saldo no caixa — risco financeiro real.
2. **Risco pastoral:** o histórico de dízimos é informação sensível (RN-MEM-03). Sem controle de acesso adequado, um vazamento destrói a confiança da congregação e infringe LGPD (Art. 18 e 31).
3. **Risco operacional:** sem registro imutável de transferências entre caixas (RN-FIN-02), não há como auditar movimentações suspeitas.

### 2.2 Oportunidade

O **schema já está pronto, os RAGs já estão aprovados, a aba já está restrita ao perfil correto, e a Camada 3 do RBAC já está codificada**. O custo deste ciclo é **executar o que está planejado**, não arquitetar. Estimativa: 3–5 sprints (S06–S10, a ser refinado na Fase 4 — Planejamento).

### 2.3 Restrições herdadas (do ciclo 1, imutáveis)

- **Stack:** React Router 7.16 SSR + Prisma 7.8 + SQLite + Tailwind 4 + Vite 8 + TypeScript 5.9.
- **Monólito modular, sem microsserviço.** Sem Redis, sem message broker, sem upload S3 neste ciclo.
- **Defesa em profundidade em 3 camadas é obrigatória** (UI → loader → service) — qualquer caminho de leitura ou escrita de `Lancamento`/`Caixa`/`TransferenciaCaixa` deve aplicar a checagem adequada.
- **Valores monetários são `Int` em centavos** com sufixo `Centavos`. Conversão só na borda (form parse → cents, cents → `formatBRLFromCents`).
- **LGPD:** `valorCentavos` é dado financeiro e **não pode aparecer em log de auditoria**. Lock de saldo no **service**, não na UI.

---

## 3. Usuários primários

| Persona | Perfil RBAC | Papel no módulo Financeiro | Frequência |
|---------|-------------|---------------------------|------------|
| **Tesoureiro(a)** | `FINANCEIRO` | Operador do dia-a-dia: lança dízimos, ofertas, despesas, faz transferências entre caixas, consulta saldos. Pode criar e arquivar caixas. | Diária |
| **Secretário(a)** | `SECRETARIO` | Lança despesas operacionais e transferências, com **trava de saldo** (RN-FIN-03). **NÃO** pode ver histórico de dízimos de um membro (RN-MEM-03). **NÃO** pode criar/arquivar caixas. | Diária |
| **Pastor** | `PASTOR` | Visão pastoral eclesiástica. Acompanha dízimos de membros da sua congregação. Pode criar/arquivar caixas. CRUD total no módulo. | Semanal |
| **Administrador** | `ADMIN` | Configura a estrutura: cria caixas, arquiva caixas, ajusta regras. Visão total. Auditoria. | Sob demanda |
| **Discipulador** | `DISCIPULADOR` | **BLOQUEADO** no módulo Financeiro. Não vê, não lança, não transfere. (RN-MEM-03) | — |
| **Líder de Ministério** | `LIDER_MINISTERIO` | **BLOQUEADO** no módulo Financeiro. (RN-MEM-03) | — |

**Observação LGPD:** o `DISCIPULADOR` e o `LIDER_MINISTERIO` realizam CRUD de Membros (com escopo: discípulos / membros do seu ministério), mas **nunca** tocam dados financeiros. A defesa em 3 camadas cobre esse isolamento.

---

## 4. Escopo do ciclo 2 — Entregáveis

Oito entregáveis, mapeados contra as 5 regras de negócio `RN-FIN-01` a `RN-FIN-05` e contra a matriz RBAC.

### 4.1 CRUD de Caixas (RN-FIN-01)

- `Caixa` já tem schema (`id`, `nome @unique`, `saldoCentavos`, timestamps). Falta:
  - **Service** `caixas.server.ts` com `listar`, `criar`, `editar`, `arquivar` (soft-delete via campo `ativo: Boolean @default(true)` a ser adicionado em migration).
  - **Rota** `/app/financeiro/caixas` (listagem) e `/app/financeiro/caixas/nova` (formulário).
  - **RBAC:** criar/editar/arquivar restrito a `ADMIN`, `PASTOR`, `FINANCEIRO`. Listar: todos os perfis com `canSeeFinancials` (`ADMIN`, `PASTOR`, `FINANCEIRO`, `SECRETARIO`).
- **Decisão de modelagem pendente:** adicionar campo `ativo: Boolean` ao model `Caixa` (ver §5.4).

### 4.2 CRUD de Lançamentos (RN-FIN-01, RN-FIN-04, RN-FIN-05)

- `Lancamento` já tem schema (`tipo: TipoLancamento`, `categoria: CategoriaLancamento`, `valorCentavos`, `descricao`, `dataCompetencia`, `caixaId`, `membroId?`).
- **Categorias implementadas:** `DIZIMO`, `OFERTA`, `CAMPANHA`, `DESPESA_OPERACIONAL`, `COMPRA_ESTOQUE`, `MANUTENCAO`, `TRANSFERENCIA`.
- **Tipos implementados:** `ENTRADA`, `SAIDA`.
- **Service** `lancamentos.server.ts` com `criar`, `listarPorCaixa`, `listarPorMembro` (apenas `DIZIMO` — RN-FIN-05), `editar` (apenas campos descritivos; valor e tipo são imutáveis para preservar auditoria).
- **Rota** `/app/financeiro/caixas/:id` (extrato do caixa, com filtros por período e categoria) e `/app/financeiro/lancamentos/novo` (formulário).
- **Trava de saldo (RN-FIN-04):** bloqueia `SAIDA` se `caixa.saldoCentavos < valorCentavos`. Implementada no service, **nunca** apenas na UI.

### 4.3 Dízimos vinculados a Membro (RN-FIN-05)

- `Lancamento.membroId` é `SetNull` no delete — coerente com RN-FIN-05 (dízimo órfão vira histórico sem identificação).
- **Validação no service:** se `categoria === 'DIZIMO'`, `membroId` é **obrigatório**. Se `categoria === 'OFERTA'`, `membroId` é **opcional** (anônimo). Qualquer outra categoria: `membroId` deve ser `null`.
- **UI:** no formulário de lançamento, mostrar campo "Membro" apenas quando a categoria selecionada exige.

### 4.4 Transferências entre Caixas (RN-FIN-02)

- `TransferenciaCaixa` já tem schema (`caixaOrigemId`, `caixaDestinoId`, `valorCentavos`, `executadoPorId`, `dataHora`).
- **Decisão de modelagem (confirmada no discovery):** toda transferência gera **1 registro em `TransferenciaCaixa`** (imutável, carimbo do operador, RN-FIN-02) **+ 2 registros em `Lancamento`** (um `SAIDA / TRANSFERENCIA` no caixa origem, um `ENTRADA / TRANSFERENCIA` no caixa destino). Ver §5.2.
- **Service** `transferencias.server.ts` com `transferir({caixaOrigemId, caixaDestinoId, valorBRL, executadoPorId})` em `prisma.$transaction` (atomicidade obrigatória).
- **Rota** `/app/financeiro/transferencias/nova` (formulário) e listagem em `/app/financeiro/transferencias`.

### 4.5 Trava de saldo no service (RN-FIN-04) — não na UI

- **Implementação canônica** já documentada no RAG [`convention-monetary-values.md`](./.harness/RAG/convention-monetary-values.md) §4 (linhas 105–136) — exemplo de `transferirEntreCaixas` em `prisma.$transaction`.
- **Reuso:** mesma trava deve ser aplicada em `criarLancamento` quando `tipo === 'SAIDA'` (checar saldo do caixa **antes** do `INSERT`, dentro da transação).
- **TDD obrigatório:** o teste de borda "saldo = 0, tenta SAIDA de 1 centavo → 409" é **bloqueador** para a sprint que entregar.

### 4.6 Integração com aba "Fidelidade Financeira"

- O componente `TabFidelidadeFinanceira` hoje é placeholder ([`app/components/TabFidelidadeFinanceira.tsx`](./app/components/TabFidelidadeFinanceira.tsx)).
- **Substituir** o placeholder por:
  - **Tabela de dízimos** do membro, ordem decrescente por `dataCompetencia`, com colunas: data, valor formatado BRL, descrição.
  - **Card de resumo** com totais do mês corrente e do ano corrente.
  - Estado vazio amigável caso o membro não tenha dízimos.
- **Camada 3 já está pronta:** `getDizimosByMembro(membroId, user)` já chama `assertCanSeeFinancials(user)` antes do SELECT. **Basta remover o `return []` e descomentar a query real** (linha 67 do `app/lib/finance.server.ts`).

### 4.7 Visão consolidada de saldos (dashboard)

- Página `/app/financeiro` (raiz do módulo):
  - **Card por caixa** com nome + saldo atual formatado BRL.
  - **Indicador agregado** (soma de todos os caixas ativos).
  - **Ações rápidas** (link para nova transferência, novo lançamento, gerenciar caixas).
- **RBAC:** visível a `ADMIN`, `PASTOR`, `FINANCEIRO`, `SECRETARIO`. `DISCIPULADOR` e `LIDER_MINISTERIO` recebem 403 ao tentar acessar.

### 4.8 RBAC fina (matriz completa do módulo)

| Operação \ Perfil | ADMIN | PASTOR | FINANCEIRO | SECRETARIO | DISCIPULADOR | LIDER_MIN. |
|------------------|:-----:|:------:|:----------:|:----------:|:------------:|:----------:|
| Ver dashboard de saldos | ✅ | ✅ | ✅ | ✅ | 🚫 | 🚫 |
| Criar / arquivar Caixa | ✅ | ✅ | ✅ | 🚫 | 🚫 | 🚫 |
| Lançar DIZIMO | ✅ | ✅ | ✅ | ✅ | 🚫 | 🚫 |
| Lançar OFERTA (anônima) | ✅ | ✅ | ✅ | ✅ | 🚫 | 🚫 |
| Lançar DESPESA / SAIDA (com trava) | ✅ | ✅ | ✅ | ✅ | 🚫 | 🚫 |
| Transferir entre Caixas | ✅ | ✅ | ✅ | ✅ | 🚫 | 🚫 |
| Ver aba Fidelidade Financeira (RN-MEM-03) | ✅ | ✅ | ✅ | 🚫 | 🚫 | 🚫 |
| Ver extrato de Caixa alheio | ✅ | ✅ | ✅ | ✅ | 🚫 | 🚫 |

**Defesa em 3 camadas obrigatória:**
1. **UI:** `if (!canSeeFinancials(user))` — esconde links, botões e rotas.
2. **Loader/Action:** `assertCanSeeFinancials(user)` ou `assertCanEditCaixa(user)` **antes** de qualquer I/O.
3. **Service:** revalida `user.cargo` em qualquer ponto de entrada (helper `assertCanSeeFinancials` já existe em `app/lib/rbac.server.ts`).

---

## 5. Decisões confirmadas neste discovery

Três decisões foram tomadas na rodada de discovery de 2026-06-14:

### 5.1 Caixas seed

- **Decisão:** Apenas o **Caixa Geral** é seedado na primeira inicialização. Outros caixas são criados sob demanda via UI.
- **Implementação:** adicionar `Caixa Geral` (idempotente via `upsert`) ao `prisma/seed.ts` — sem dependência de UI para o estado inicial.
- **Risco aceito:** a primeira tela do módulo exibe apenas um caixa. Mitigação: mensagem clara "Use o botão '+ Nova Caixa' para criar caixas temáticos (Cantina, Missões, etc.)".

### 5.2 Modelagem de transferências

- **Decisão:** toda transferência gera **1 `TransferenciaCaixa` (imutável, auditoria) + 2 `Lancamento` espelho** (um `SAIDA / TRANSFERENCIA` na origem, um `ENTRADA / TRANSFERENCIA` no destino).
- **Por que duplicar:**
  - `TransferenciaCaixa` satisfaz literalmente a RN-FIN-02 (rastreabilidade, carimbo, imutabilidade).
  - Os 2 `Lancamento` espelho mantêm `caixa.saldoCentavos` reconciliável via `SELECT SUM(valorCentavos) FROM lancamentos WHERE caixaId = X AND tipo = 'ENTRADA' - ...`.
  - É o padrão já documentado no RAG [`convention-monetary-values.md`](./.harness/RAG/convention-monetary-values.md) §4.
- **Atomicidade obrigatória:** a operação inteira em `prisma.$transaction` — se qualquer INSERT/update falhar, todos os 3 registros são revertidos.

### 5.3 RBAC para criar/arquivar Caixa

- **Decisão:** apenas `ADMIN`, `PASTOR` e `FINANCEIRO` podem criar ou arquivar caixas. `SECRETARIO` opera dentro dos caixas existentes.
- **Justificativa:** decisão estrutural da igreja. Criar/arquivar caixa é decisão administrativa eclesiástica, não operacional do dia-a-dia. `SECRETARIO` tem autonomia de lançamento (RN-FIN-03) mas não de estrutura.
- **Implementação:** novo helper `assertCanManageCaixa(user)` em `app/lib/rbac.server.ts`, espelhado em `assertCanSeeFinancials`.

### 5.4 Decisão de modelagem adicional (proposta, requer confirmação na Fase 2)

- Adicionar campo `ativo: Boolean @default(true)` ao model `Caixa` para suportar **soft-delete (arquivamento)**. Caixas arquivados continuam no banco (para histórico de saldos), mas somem da listagem padrão.
- Sem esta coluna, a única alternativa é `onDelete: Restrict` (impede delete se há lançamentos) — funcional, mas perdemos a semântica de "arquivado" que o usuário pediu.

---

## 6. Restrições

### 6.1 Stack e arquitetura (imutáveis, herdadas do ciclo 1)

- **Frontend:** React Router 7.16 (SSR + future flags `v8_*`), Tailwind 4, Vite 8, TypeScript 5.9 strict.
- **Backend:** mesmo processo Node 22, Prisma 7.8 client em `app/db.server.ts`.
- **DB:** SQLite local (`prisma/dev.db`).
- **Auth:** session cookie httpOnly + sliding renewal (TTL 7d, teto 30d abs). Já em produção.
- **Validação:** Zod (recomendado no ADR-003 do `ARCH.md`; pode ser revisado na Fase 3).
- **Hash:** bcryptjs (salt rounds ≥ 10).
- **Testes:** Vitest (unit + integração) + Playwright (E2E) — 3 camadas de teste.
- **Cobertura:** gate ≥ 85% por sprint, 100% em services de regra de negócio.

### 6.2 Compliance e LGPD

- **RN-MEM-02:** **nenhum campo de CPF, dados fiscais, ou informações financeiras invasivas** pode ser adicionado neste ciclo. Recibo de dízimo usa apenas `nome` (já no `Membro`) e `valorCentavos` (já no `Lancamento`).
- **RN-MEM-03:** aba Fidelidade Financeira continua restrita a `ADMIN`, `PASTOR`, `FINANCEIRO`. Logs de auditoria **nunca** registram `valorCentavos`.
- **LGPD Art. 18 e 31:** o `lgpd-officer` auditará este módulo. Atenção especial à: (a) minimização de dados, (b) segregação por perfil, (c) registro de operações sensíveis.

### 6.3 RAGs a seguir (não-negociáveis)

- [`security-rbac-matrix.md`](./.harness/RAG/security-rbac-matrix.md) — matriz RBAC, padrão de 3 camadas, helper `assertCanSeeFinancials`.
- [`convention-monetary-values.md`](./.harness/RAG/convention-monetary-values.md) — `Int` em centavos, helpers `formatBRLFromCents` / `parseBRLToCents` / `assertNonNegative`.
- (A criar na Fase 1) `lgpd-igreja-conect.md` — checklist LGPD aplicado a dados financeiros.

### 6.4 Restrições operacionais

- **Prazo:** alvo de **3 sprints** (S06, S07, S08) para entregar os 8 entregáveis. Refinamento na Fase 4 (Planejamento).
- **Sem dependências externas novas:** nenhum gateway de pagamento, nenhum serviço de e-mail, nenhum S3, nenhum Redis. Tudo roda no mesmo processo Node.
- **Sem novas rotas `app/api/**`:** manter-se no padrão RR7 (loader/action em `app/routes/**`).

---

## 7. Critérios de sucesso

### 7.1 Métrica macro (única)

> **O ciclo 2 é considerado bem-sucedido quando um `FINANCEIRO` consegue, em menos de 2 minutos, registrar um dízimo de `Membro X` no `Caixa Geral`, ver o saldo do caixa refletir a entrada, e o `PASTOR` consegue abrir a aba "Fidelidade Financeira" do `Membro X` e ver o dízimo recém-lançado.**

### 7.2 Métricas de qualidade (gate do phase 5)

- **Cobertura de testes:** ≥ 85% global, **100% em services de regra de negócio** (`caixas.server.ts`, `lancamentos.server.ts`, `transferencias.server.ts`).
- **Vulnerabilidades:** 0 critical, 0 high (gate do `security-scanner`).
- **`planning-reviewer` score:** ≥ 70.
- **LGPD:** `lgpd-officer` status ≥ `warning`, 0 critical, 0 high em Art. 18/48.
- **Defesa em 3 camadas comprovada:** 100% das células da matriz §4.8 cobertas por testes (E2E obrigatórios para RN-MEM-03, RN-FIN-04, RN-FIN-05).

### 7.3 Testes de borda obrigatórios (TDD antes do service)

- 12 discípulos: passa (regressão do ciclo 1, não do ciclo 2).
- **13º discípulo:** bloqueia com mensagem clara (regressão).
- **Saldo = 0, SAIDA de R$ 0,01:** bloqueia com 409 e mensagem "Saldo insuficiente no caixa de origem." (RN-FIN-04)
- **DIZIMO sem membro:** bloqueia com 400 (RN-FIN-05).
- **OFERTA sem membro:** passa, anônimo (RN-FIN-05).
- **Transferência origem = destino:** bloqueia com 400.
- **Transferência valor = 0:** bloqueia com 400.
- **Transferência valor negativo:** bloqueia com 400.
- **SECRETARIO acessando `/app/financeiro`:** recebe 403.
- **SECRETARIO acessando `/app/membros/:id?tab=fidelidade`:** aba Fidelidade não renderiza, e `getDizimosByMembro` retorna 403 (RN-MEM-03).
- **DISCIPULADOR tentando qualquer rota `/app/financeiro/**`:** recebe 403 em todas as camadas.

---

## 8. Não-objetivos (fora de escopo deste ciclo)

Listados explicitamente para evitar **scope creep**. Qualquer item aqui pode virar ciclo futuro se a demanda surgir.

- ❌ **Gateway de pagamento** (Pix, cartão, boleto). Não há integração com bancos ou PSPs.
- ❌ **Conciliação bancária automática.** Caixas são internos; não há extrato bancário para reconciliar.
- ❌ **Relatórios PDF ou Excel.** Exportação é manual via UI ou copy-paste de tabela. CSV/Excel podem entrar em ciclo futuro.
- ❌ **Multi-igreja / multi-tenant.** Uma instância = uma igreja.
- ❌ **Multi-moeda.** Apenas BRL. A constante `Int` cobre até R$ 21 milhões por caixa.
- ❌ **Recibo físico ou envio por e-mail.** Sem SMTP neste ciclo.
- ❌ **Notificações de saldo baixo.** Sem cron jobs neste ciclo (alinhado com a Fase 5 do ciclo 1 que já trata o cron de manutenção de estoque).
- ❌ **Aprovação multi-nível para saídas grandes.** A RN-FIN-03 (autonomia por saldo real) já é a regra; não há "aprovação do pastor" como portão separado.
- ❌ **Upload de comprovantes.** Sem S3/MinIO neste ciclo. Campo `descricao` é suficiente.
- ❌ **Módulo de Estoque (ciclo futuro).** O schema já tem `ItemEstoque`, `MovimentacaoEstoque`, `ManutencaoAtivo`, mas a UI/service **não** é deste ciclo. As categorias `COMPRA_ESTOQUE` e `MANUTENCAO` do enum `CategoriaLancamento` existirão no schema, mas os fluxos que as usam virão no ciclo 3+.
- ❌ **Criar/editar regras de negócio via UI.** RN-FIN-* são fixas no código.
- ❌ **Camada extra de "auditor" como perfil RBAC.** Os 6 perfis ficam como estão.

---

## 9. Anexos e referências cruzadas

### 9.1 Documentos de domínio (fonte da verdade)

- [`docs/REGRAS_DE_NEGOCIO.md`](./docs/REGRAS_DE_NEGOCIO.md) — RN-MEM-01 a 06, **RN-FIN-01 a 05**, RN-EST-01 a 05.
- [`docs/DESCRIÇÃO_DOS_MODULOS.md`](./docs/DESCRIÇÃO_DOS_MODULOS.md) — matriz RBAC, objetivos por módulo, escopo dual do estoque.
- [`docs/architecture/ARCH.md`](./docs/architecture/ARCH.md) — 17 seções, ADRs, modelo de dados, fluxos de auth/RBAC/Membros.

### 9.2 RAGs (memória de longo prazo do projeto)

- [`.harness/RAG/security-rbac-matrix.md`](./.harness/RAG/security-rbac-matrix.md) — **crítico para este ciclo**.
- [`.harness/RAG/convention-monetary-values.md`](./.harness/RAG/convention-monetary-values.md) — **crítico para este ciclo**.

### 9.3 Schema e código existente

- [`prisma/schema.prisma`](./prisma/schema.prisma) — models `Caixa`, `TransferenciaCaixa`, `Lancamento`, enums `TipoLancamento`, `CategoriaLancamento`.
- [`app/lib/finance.server.ts`](./app/lib/finance.server.ts) — placeholder `getDizimosByMembro` (Camada 3 já pronta).
- [`app/components/TabFidelidadeFinanceira.tsx`](./app/components/TabFidelidadeFinanceira.tsx) — placeholder a ser substituído.

### 9.4 Estado do Harness

- [`.harness/state.json`](./.harness/state.json) — `currentCycle: 2`, `currentPhase: phase.0.briefing`, `cycle2.scope: "Módulo Financeiro (Caixas + Lançamentos + Dízimos)"`.
- [`.harness/state-machine.json`](./.harness/state-machine.json) — contrato read-only. Não editar.

### 9.5 Pendências conhecidas (para o orchestrator)

| # | Pendência | Origem | Tratamento esperado |
|---|-----------|--------|---------------------|
| 1 | `brief-mvp.md` não pôde ser criado pelo `briefing` agent (bloqueio do path-boundary hook — allowlist global não contém o path, apesar da capability grant da task declarar) | task do orchestrator, ciclo 2 | Orquestrador decide: editar via Python/bash direto (workaround já em uso para `state.json`, vide `state.json:183-186`), ou atualizar o allowlist e re-rodar este agent. |
| 2 | Ferramentas `harness_status` / `harness_advance` quebradas (`u.split` error) | `state.json:183-186` | Continuar usando edição direta de `state.json` via Python. O `briefing` agent não chama essas tools — apenas retorna JSON para o orchestrator. |
| 3 | 2 models de configuração no schema (`ConfiguracaoGeral` em `schema.prisma:317` e `ConfigAcolhimento` em `schema.prisma:329`) | resíduo do ciclo 1 | Avaliar consolidação na Fase 3 (Design). Não é bloqueador. |
| 4 | Decisão de modelagem `Caixa.ativo` (proposta §5.4) | este brief | Formalizar na Fase 2 (Requisitos) — `prd-reviewer` deve aprovar antes de migration. |

---

## Próxima revisão

- **Quando:** ao final de cada sprint do ciclo 2, ou se regra de negócio / RBAC / RAG mudar.
- **Por quem:** `documenter` agent (Fase 1) ao consolidar; `requirements` e `designer` ao detalhar.
- **Quem consome este brief:** `documenter` (Fase 1) → `requirements` (Fase 2) → `designer` (Fase 3) → `sprint-tasker` (Fase 4) → orchestrator + 5 workers (Fase 5).

---

> **Pedido de aprovação:**
> Aprova este `brief.md` para iniciar a **Fase 1 (Documentação)** do ciclo 2?
>
> - ✅ **Aprovar** — Fase 1 inicia com base neste escopo, decisões e restrições.
> - ✏️ **Editar** — apontar o que ajustar (seções 4, 5, 6, 7 ou 8 são as mais prováveis de iteração).
> - ❌ **Rejeitar** — explicar o motivo para nova rodada de discovery.
