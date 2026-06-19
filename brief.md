# Brief — Igreja Conect — Ciclo 3: Módulo Estoque + Patrimônio

> **Escopo deste brief:** Módulo de Estoque (Consumo + Patrimônio) com Manutenção Externa e Baixa por Perda. **RNs já documentadas** em `docs/REGRAS_DE_NEGOCIO.md §3` (`RN-EST-01` a `RN-EST-05`). **Schema Prisma já pronto** com `ItemEstoque`, `MovimentacaoEstoque`, `ManutencaoAtivo`, `TipoItemEstoque`, `StatusItemPatrimonio`.
>
> **Data:** 2026-06-19.
> **Autor:** `harness-briefing` agent (Fase 0, ciclo 3).
> **Estado:** aguardando `user-approval` para iniciar Fase 1 (Documentação).
> **Versão:** 1.0 (ciclo 3).
> **Cross-ref aos ciclos anteriores:**
> - [`brief-mvp.md`](./brief-mvp.md) — ciclo 1 (Auth + Membros + Discipulado + Alertas + Acolhimento, `gate: all-of passed` em 2026-06-13).
> - [`brief-mvp-financeiro.md`](./brief-mvp-financeiro.md) — ciclo 2 (Caixas + Lançamentos + Transferências + Fidelidade, `gate: all-of passed` em 2026-06-19, 1115 testes passando, 2 sprints de rework aplicadas).

---

## 1. Contexto e propósito do ciclo

O **ciclo 1** entregou o MVP: auth + membros + discipulado + alertas + acolhimento (872 unit + 28 E2E + 5 smoke, cobertura 88,21%, `gate: all-of passed`).

O **ciclo 2** entregou o Módulo Financeiro: caixas + lançamentos + transferências + fidelidade (1115 testes, 96% cobertura/sprint, `gate: all-of passed` em S06–S08 + cleanup S09–S10).

O **ciclo 3** entrega o **Módulo de Estoque (Consumo) + Patrimônio (com manutenção e baixa por perda)**. O ciclo 3 é de **execução**: 5 RNs já estão formalizadas, schema Prisma já tem os 3 models + 2 enums, e a matriz RBAC fina já está mapeada no `ARCH.md §6.1`. O custo é implementar services + UI + testes, sem nova decisão arquitetural.

### Por que Estoque agora

Igrejas médias-grandes têm 2 estoques reais e muitas vezes invisíveis: (a) **almoxarifado de Consumo** (limpeza, papelaria, ceia, som) controlado em caderno; (b) **patrimônio físico** (cadeiras, som, projetores, instrumentos) controlado em planilha paralela sem foto, sem histórico de manutenção, sem alerta de "esquecido na assistência técnica". O módulo resolve os 3 problemas clássicos do fluxo de patrimônio: **rastreabilidade de onde está cada bem**, **histórico de manutenções**, **controle de perdas com justificativa formal**.

---

## 2. Problema e oportunidade

### 2.1 Problema

1. **Consumo sem controle:** sem trava automatizada, saídas de material acontecem sem registro de quem retirou — risco de desperdício, sumiço e falta de auditoria.
2. **Patrimônio sem paradeiro:** "onde está o projetor BenQ que sumiu do inventário?" — sem status atualizado e sem histórico de manutenção, não há como responder.
3. **Manutenção sem retorno:** equipamento enviado para assistência técnica em março/2025 sem prazo termina esquecido em abril/2026. Sem alerta recorrente, ninguém cobra.
4. **Perda sem rasto:** baixa por perda é feita em planilha à parte, sem laudo arquivado, sem notificação — risco pastoral e contábil.

### 2.2 Oportunidade

- **Schema 100% pronto:** `ItemEstoque`, `MovimentacaoEstoque`, `ManutencaoAtivo` + 2 enums já existem em `prisma/schema.prisma:232–289`. **Zero migration de model.**
- **5 RNs documentadas** em `docs/REGRAS_DE_NEGOCIO.md §3` (`RN-EST-01` a `RN-EST-05`).
- **Matriz RBAC fina já mapeada** em `ARCH.md §6.1` (linha 220–223): Consumo (✅ ADMIN, 👁 PASTOR, ✅ SECRETARIO, 👁 outros), Patrimônio CRUD (✅ ADMIN, ✅ SECRETARIO, 👁 outros), Manutenção Baixa (✅ ADMIN only).
- **Integração com Módulo Financeiro já possível:** o enum `CategoriaLancamento` já tem `COMPRA_ESTOQUE` e `MANUTENCAO` (do ciclo 2). Apenas o fluxo de "ao confirmar manutenção, lançar despesa" **fica fora do MVP** (ciclo futuro).
- **Integração com Alertas:** `Alerta` + `AlertaDestinatario` já existem (ciclo 1). **RN-EST-04** (alerta recorrente sem prazo) pode ser entregue de forma simplificada: alerta manual disparado quando alguém consulta o item há >30 dias (sem cron nesta entrega).

### 2.3 Restrições herdadas (imutáveis dos ciclos 1 e 2)

- **Stack:** React Router 7.17 SSR + Prisma 7.8 + SQLite + Tailwind 4 + Vite 8 + TypeScript 5.9 strict. **Monólito modular.** Sem microsserviço, sem Redis, sem message broker.
- **Defesa em profundidade em 3 camadas** (UI → loader → service). Padrão `assertCan*` em `app/lib/rbac.server.ts`.
- **LGPD estrito:** sem CPF/RG/CNPJ. `ItemEstoque` não tem dados pessoais (apenas `nomeRetirante` textual livre na movimentação, **não** vincula a `Membro`).
- **Sem upload S3/MinIO:** o campo `ManutencaoAtivo.urlLaudoTecnico` existe no schema mas **fica null** neste ciclo (será preenchido em ciclo futuro, RN-EST-05 backlog). Mesma decisão para foto de patrimônio.
- **`pnpm dev` quebrado:** usar `pnpm build && pnpm start`.

---

## 3. Usuários primários

| Persona | Perfil RBAC | Papel no módulo | Frequência |
|---|---|---|---|
| **Almoxarife / Secretário(a)** | `SECRETARIO` | Operador do dia-a-dia: cadastra itens de Consumo, registra entradas e saídas com nome do retirante, autoriza retiradas. Consulta Patrimônio. | Diária |
| **Pastor / Administrador** | `ADMIN` | CRUD total em ambos os tipos. Único perfil que pode fazer **baixa por perda** (RN-EST-05). | Semanal |
| **Pastor** | `PASTOR` | CRUD total + leitura. Pode enviar patrimônio para manutenção externa (RN-EST-03). | Semanal |
| **Líder de Ministério** | `LIDER_MINISTERIO` | **Somente leitura** (consulta para "onde está o microfone do louvor?"). | Sob demanda |
| **Discipulador / Tesoureiro** | `DISCIPULADOR` / `FINANCEIRO` | **Somente leitura** em ambos os tipos. | Sob demanda |

**Observação crítica:** o módulo é **majoritariamente leitura** para 4 dos 6 perfis. O CRUD ativo se concentra em `ADMIN`, `PASTOR` e `SECRETARIO` — convergência operacional que simplifica a matriz.

---

## 4. Escopo do ciclo 3 — Entregáveis

**9 entregáveis**, mapeados contra `RN-EST-01` a `RN-EST-05`.

### 4.1 CRUD de ItemEstoque (RN-EST-01)

- **Schema pronto:** `nome`, `descricao`, `tipo` (CONSUMO/PATRIMONIO), `quantidade`, `numeroSerie?`, `statusPatrimonio?`, `localizacaoFisica?`.
- **Service** `itemEstoque.server.ts` com `listar(user, filtros)`, `criar(input, user)`, `editar(id, input, user)`, `arquivar(id, user)` (soft-delete via flag `ativo` a ser adicionada em migration — espelha decisão `Caixa.ativo` do ciclo 2).
- **Rotas:**
  - `/app/estoque` (listagem com filtros: tipo, status, busca textual).
  - `/app/estoque/novo` (formulário com campos condicionais por tipo).
  - `/app/estoque/:id` (detalhe + abas: Movimentações, Manutenções).
  - `/app/estoque/:id/editar`.
- **RBAC:** criar/editar/arquivar restrito a `ADMIN`, `PASTOR`, `SECRETARIO`. Listar: todos os 6 perfis autenticados (leitura).

### 4.2 Escopo Dual: Consumo vs Patrimônio (RN-EST-01)

- **Diferenciação lógica** no schema (`tipo: TipoItemEstoque`) e na UI (formulário mostra campos diferentes por tipo).
- **CONSUMO:** `quantidade` é estoque atual; movimentações somam/subtraem.
- **PATRIMONIO:** `quantidade` é geralmente 1 (uma unidade física); `numeroSerie` é único e obrigatório para PATRIMONIO; `localizacaoFisica` é texto livre ("Sala de som", "Cozinha"); `statusPatrimonio` é obrigatório (default `DISPONIVEL`).

### 4.3 Movimentação de Consumo (RN-EST-02)

- **Service** `movimentacao.server.ts` com `criarMovimentacao(itemId, input, user)` em `prisma.$transaction` (atomicidade: insert movimentação + update `ItemEstoque.quantidade`).
- **Validação de borda (obrigatória):**
  - `nomeRetirante` é **obrigatório** quando `quantidade < 0` (saída). Não pode ser vazio.
  - Estoque **não pode ficar negativo** (RN-EST-02 + trava de negócio): se tentativa de saída deixar `quantidade < 0`, lança `BusinessRuleError` com 409.
  - `autorizadoPorId` = `user.id` (do session). Carimbo automático, imutável.
  - `justificativa` é **obrigatória** para saídas, **opcional** para entradas.
- **RBAC:** apenas `ADMIN` e `SECRETARIO` podem registrar movimentações de saída. Demais perfis não veem o botão (Camada 1) + 403 no loader/service (Camadas 2 e 3).
- **Rota:** `/app/estoque/:id/movimentacao/nova` (formulário com toggle Entrada/Saída).

### 4.4 Envio para Manutenção Externa (RN-EST-03)

- **Service** `manutencao.server.ts` com `enviarParaManutencao(itemId, input, user)` em `prisma.$transaction` (insert `ManutencaoAtivo` + update `ItemEstoque.statusPatrimonio = EM_MANUTENCAO`).
- **Validação:**
  - Item deve ser `tipo = PATRIMONIO` (consumo não vai para manutenção externa — trava de tipo).
  - Item deve estar `statusPatrimonio = DISPONIVEL` (não pode enviar o que já está em manutenção).
  - `assistenciaTecnica`, `enderecoAssistencia` são **obrigatórios** (RN-EST-03).
  - `numeroOs` é **opcional** (RN-EST-03).
  - `prazoTermino` é **opcional** (se nulo, dispara fluxo de alerta manual — ver §4.6).
- **RBAC:** `ADMIN`, `PASTOR`, `SECRETARIO` podem enviar.
- **Rota:** `/app/estoque/:id/manutencao/nova`.

### 4.5 Retorno de Manutenção

- **Service** com `retornarDeManutencao(manutencaoId, dataRetorno, user)` em `prisma.$transaction` (update `ManutencaoAtivo.dataRetorno` + update `ItemEstoque.statusPatrimonio = DISPONIVEL`).
- **Validação:** `dataRetorno >= dataEnvio` (não pode voltar no tempo).
- **RBAC:** `ADMIN`, `PASTOR`, `SECRETARIO`.

### 4.6 Alerta para Manutenção sem prazo (RN-EST-04 — versão simplificada)

- **Escopo MVP:** quando alguém (qualquer perfil autenticado) consulta `/app/estoque/:id` de um item com `statusPatrimonio = EM_MANUTENCAO`, o loader **verifica** a `ManutencaoAtivo` ativa:
  - Se `prazoTermino IS NULL` E `dataEnvio < now() - 30 dias` → gera **1 alerta manual** (não-recorrente) com destino `todos` (visível para todos os usuários) e mensagem: *"Item X em manutenção há >30 dias sem prazo definido. Atualize o status."*
  - Se `prazoTermino IS NULL` E `dataEnvio < now() - 6 dias` → gera alerta com mensagem: *"Item X em manutenção há >6 dias sem prazo definido."*
- **Escalonamento implementado como **consulta**, não como cron. O alerta é disparado quando alguém abre a página (UX simples, sem scheduler). **Cron automático fica para ciclo futuro** (constraint: sem scheduler no MVP).
- **Idempotência:** o loader verifica se já existe alerta para este item nas últimas 24h antes de criar novo (evita spam).
- **RBAC:** qualquer perfil pode **receber** o alerta. Apenas service `criarAlertaManutencaoSemPrazo` é interno (chamado pelo loader).

### 4.7 Baixa por Perda Total (RN-EST-05)

- **Service** `baixaPorPerda(manutencaoId, motivo, user)` em `prisma.$transaction` (update `ManutencaoAtivo.foiPerdaTotal = true`, update `ItemEstoque.statusPatrimonio = BAIXADO_PERDA`, soft-delete via `ativo = false` no item).
- **Validação:**
  - Apenas `ADMIN` pode fazer baixa por perda (RN-EST-05 explícito).
  - Item deve estar atualmente `EM_MANUTENCAO` (não pode baixar o que está disponível ou já baixado).
  - `motivo` é texto livre obrigatório (substitui upload de laudo neste ciclo — S3 fora de escopo).
  - `urlLaudoTecnico` permanece `null` (campo existe, sem upload).
- **RBAC:** apenas `ADMIN` (Camada 1, 2 e 3). `SECRETARIO` recebe 403.
- **Rota:** `/app/estoque/:id/baixa-perda` (formulário com textarea de motivo).

### 4.8 Histórico Consolidado no Detalhe do Item

- Página `/app/estoque/:id` tem **2 abas** (componente similar à `TabFidelidadeFinanceira` do ciclo 2):
  - **Movimentações** (apenas para CONSUMO): tabela com data, tipo (entrada/saída), quantidade, nomeRetirante, justificativa, autorizadoPor.
  - **Manutenções** (apenas para PATRIMONIO): tabela com dataEnvio, assistencia, O.S., prazo, retorno, status (em manutenção / retornou / perda total).
- **Camada 3 já antecipada:** `assertCanReadItem` revalida `user.cargo` em qualquer query (helper a ser criado, espelhado em `assertCanSeeFinancials`).

### 4.9 RBAC Fina — matriz completa do módulo

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

**Defesa em 3 camadas obrigatória:**
1. **UI:** `<Can cargo={...}>` esconde botões e rotas.
2. **Loader/Action:** `assertCanManageEstoque(user)` ou `assertCanBaixarPerda(user)` **antes** de qualquer I/O.
3. **Service:** revalida `user.cargo` em qualquer ponto de entrada (helper `assertCan*` em `app/lib/rbac.server.ts`).

---

## 5. Decisões confirmadas neste discovery

Três decisões foram tomadas em 2026-06-19:

### 5.1 Sem cron job no MVP (RN-EST-04 simplificada)

- **Decisão:** o alerta de manutenção sem prazo (§4.6) é disparado **na consulta** do item, não por scheduler. Implementação é uma checagem no loader com idempotência de 24h.
- **Justificativa:** constraint do stack (sem Redis, sem `node-cron` configurado neste ciclo). A RN-EST-04 está 100% coberta na **intenção** (alertas existem), apenas o **gatilho** é diferente.
- **Risco aceito:** se ninguém consultar o item por 60 dias, o alerta não dispara. **Mitigação:** incluir checagem também na rota `/app/alertas` (todos usuários visitam essa rota com frequência).
- **Ciclo futuro:** scheduler real (cron em processo único, conforme `ARCH.md §12 backlog`) quando a base de usuários justificar.

### 5.2 Sem upload de arquivos (RN-EST-05 adaptada)

- **Decisão:** o campo `ManutencaoAtivo.urlLaudoTecnico` permanece `null` neste ciclo. A baixa por perda é justificada por campo **texto livre** `motivo` (obrigatório).
- **Justificativa:** stack monólito sem S3/MinIO. Constraint herdada dos ciclos 1 e 2.
- **Schema impactado:** migration mínima para adicionar `motivoPerda: String?` ao model `ManutencaoAtivo` (ou usar `justificativa` se já existir campo equivalente — verificar na Fase 3).
- **Ciclo futuro:** quando S3/MinIO entrar, preencher `urlLaudoTecnico` + UI de upload.

### 5.3 Soft-delete via campo `ativo`

- **Decisão:** adicionar `ativo: Boolean @default(true)` ao model `ItemEstoque`, espelhando a decisão `Caixa.ativo` do ciclo 2 (RAG `decision-caixa-soft-delete`, aprovado pelo `prd-reviewer` em 2026-06-14).
- **Implementação:** migration aditiva no mesmo sprint de fundação.
- **Filtro padrão:** listagem mostra apenas `ativo = true`. Itens arquivados continuam no DB (histórico de movimentações).

---

## 6. Restrições

### 6.1 Stack e arquitetura (imutáveis)

- **Frontend:** React Router 7.17 SSR (mesmo dos ciclos 1 e 2), Tailwind 4, Vite 8, TypeScript 5.9 strict.
- **Backend:** Node 22 + Prisma 7.8 client em `app/db/prisma.server.ts`.
- **DB:** SQLite local (`prisma/dev.db`). Sem mudança de banco.
- **Auth:** session cookie httpOnly + sliding renewal (já em produção).
- **Validação:** Zod 4 (schemas em `app/lib/schemas/estoque.ts`).
- **Testes:** Vitest (unit + integração) + Playwright (E2E) — 3 camadas.
- **Cobertura:** gate ≥ 85% por sprint, **100% em services de regra de negócio** (`itemEstoque.server.ts`, `movimentacao.server.ts`, `manutencao.server.ts`).

### 6.2 Compliance e LGPD

- **Sem dados pessoais sensíveis:** o módulo Estoque **não coleta** CPF, RG, endereço residencial, telefone, e-mail. Os campos de `ItemEstoque` são: nome textual, descrição textual, número de série (pode conter identificador de fabricante), localização física textual.
- **`MovimentacaoEstoque.nomeRetirante`:** é **texto livre** (não vincula a `Membro`). Decisão consciente: não exigir cadastro do retirante reduz atrito operacional e elimina necessidade de tratar LGPD para pessoas físicas externas (ex: "João da limpeza", "Maria visitante"). O carimbo de quem **autorizou** a saída (`autorizadoPorId`) é o `user.id` do sistema, com auditoria via log estruturado (sem PII em log).
- **Logs:** `safeLog` em `app/lib/audit.server.ts` (allowlist, sem `nomeRetirante`, sem `motivo` em texto livre).
- **LGPD art. 18 e 31:** o `lgpd-officer` auditará este módulo. Atenção à: (a) **minimização** (não expandir campos pessoais sem justificativa), (b) **segregação por perfil** (matriz §4.9), (c) **registro de operações sensíveis** (baixa por perda e manutenção são registradas).

### 6.3 RAGs a seguir (não-negociáveis)

**Obrigatórios (críticos):**
- [`security-rbac-matrix.md`](./.harness/RAG/security-rbac-matrix.md) — matriz 6 perfis × 6 domínios.
- [`pattern-3-layer-rbac.md`](./.harness/RAG/pattern-3-layer-rbac.md) — UI / loader / service.
- [`lgpd-igreja-conect.md`](./.harness/RAG/lgpd-igreja-conect.md) — checklist LGPD.

**Específicos a criar na Fase 1:**
- `architecture-estoque` (high) — visão macro do módulo.
- `pattern-movimentacao-estoque` (high) — modelagem de Consumo + trava de saldo.
- `pattern-manutencao-patrimonio` (high) — RN-EST-03, RN-EST-04, RN-EST-05.
- `decision-itemEstoque-soft-delete` (medium) — espelha `decision-caixa-soft-delete`.

### 6.4 Restrições operacionais

- **Prazo:** alvo de **2 sprints** (S11, S12) para os 9 entregáveis. Refinamento na Fase 4 (Planejamento).
- **Sem dependências externas novas:** mesmo processo Node. Sem `node-cron`, sem `minio`, sem SMTP.
- **Sem novas rotas `app/api/**`:** padrão RR7 (loader/action em `app/routes/app/estoque/**`).
- **Débitos pré-existentes do ciclo 2:** 74 testes falhando (DI consumers) e 107 typecheck errors estão **fora do escopo** deste ciclo. Serão tratados em sprint de cleanup dedicada (S13+) — não bloquear este ciclo, mas incluir task de smoke-test dos 74 no checklist de release.

---

## 7. Critérios de sucesso

### 7.1 Métrica macro (única)

> **O ciclo 3 é considerado bem-sucedido quando um `SECRETARIO` consegue, em menos de 2 minutos, cadastrar 5 pacotes de papel A4 no estoque de Consumo, registrar uma saída de 2 pacotes informando o nome do retirante, ver o saldo atualizar para 3 pacotes, e o `ADMIN` consegue abrir o detalhe do item e ver o histórico completo de movimentações com nome do autorizador e do retirante.**

### 7.2 Métricas de qualidade (gate do phase 5)

- **Cobertura de testes:** ≥ 85% global, **100% em services de regra de negócio** (`itemEstoque.server.ts`, `movimentacao.server.ts`, `manutencao.server.ts`).
- **Vulnerabilidades:** 0 critical, 0 high (gate do `security-scanner`).
- **`planning-reviewer` score:** ≥ 70.
- **`code-reviewer` score:** ≥ 70.
- **LGPD:** `lgpd-officer` status ≥ `warning`, 0 critical, 0 high em Art. 18/31.
- **Defesa em 3 camadas comprovada:** 100% das células da matriz §4.9 cobertas por testes (E2E obrigatórios para RN-EST-02, RN-EST-04, RN-EST-05).

### 7.3 Testes de borda obrigatórios (TDD antes do service)

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

---

## 8. Não-objetivos (fora de escopo deste ciclo)

Listados explicitamente para evitar **scope creep**:

- ❌ **Cron automático** (RN-EST-04 scheduler real). Implementação manual via consulta (§4.6). Sem `node-cron` neste ciclo.
- ❌ **Upload de laudo técnico** (RN-EST-05 anexos PDF/imagem). Campo `urlLaudoTecnico` permanece `null`. Sem S3/MinIO.
- ❌ **Upload de fotos de patrimônio** (cadeira.jpg, instrumento.jpg). Sem S3/MinIO. `localizacaoFisica` é texto.
- ❌ **Sincronização automática Estoque ↔ Financeiro.** Lançamento de despesa de `MANUTENCAO` ou `COMPRA_ESTOQUE` continua manual pelo `FINANCEIRO`. O enum `CategoriaLancamento` já tem essas categorias; integração automática fica para ciclo futuro.
- ❌ **Códigos de barras / QR Code** para patrimônio. Identificação por `numeroSerie` textual é suficiente.
- ❌ **Relatórios avançados** (curva ABC de consumo, tempo médio de manutenção, etc.).
- ❌ **Inventário físico com checklist mobile.** Sem app nativo.
- ❌ **Notificações por e-mail/push** para manutenção. Apenas in-app via Alertas.
- ❌ **Multi-igreja / multi-tenant.** Uma instância = uma igreja.
- ❌ **Workflow de aprovação multi-nível** para baixa por perda. Apenas `ADMIN` (single-approver).
- ❌ **Reconciliação contábil** automática com sistema externo.
- ❌ **Etiquetas impressas** de patrimônio. Fora de escopo digital.
- ❌ **Resolver débitos pré-existentes do ciclo 2** (74 testes + 107 typecheck). Será sprint dedicada após S12, não bloqueia este ciclo.

---

## 9. Anexos e referências cruzadas

### 9.1 Documentos de domínio (fonte da verdade)

- [`docs/REGRAS_DE_NEGOCIO.md`](./docs/REGRAS_DE_NEGOCIO.md) §3 — **RN-EST-01 a 05** (canônica).
- [`docs/DESCRIÇÃO_DOS_MODULOS.md`](./docs/DESCRIÇÃO_DOS_MODULOS.md) — visão de produto do módulo.
- [`docs/architecture/ARCH.md`](./docs/architecture/ARCH.md) — §6.1 matriz RBAC, §12 backlog de Estoque.

### 9.2 RAGs (memória de longo prazo do projeto)

- [`security-rbac-matrix.md`](./.harness/RAG/security-rbac-matrix.md) — **crítico**.
- [`pattern-3-layer-rbac.md`](./.harness/RAG/pattern-3-layer-rbac.md) — **crítico**.
- [`lgpd-igreja-conect.md`](./.harness/RAG/lgpd-igreja-conect.md) — **crítico**.
- [`convention-prisma-sqlite.md`](./.harness/RAG/convention-prisma-sqlite.md) — alta (transações, soft-delete).
- (A criar na Fase 1) `architecture-estoque.md`, `pattern-movimentacao-estoque.md`, `pattern-manutencao-patrimonio.md`, `decision-itemEstoque-soft-delete.md`.

### 9.3 Schema e código existente

- [`prisma/schema.prisma`](./prisma/schema.prisma) — models `ItemEstoque` (linha 232), `MovimentacaoEstoque` (linha 253), `ManutencaoAtivo` (linha 271), enums `TipoItemEstoque`, `StatusItemPatrimonio`.
- `app/lib/rbac.server.ts` — adicionar `assertCanManageEstoque`, `assertCanBaixarPerda`, `assertCanMovimentarConsumo` (espelhados em `assertCanSeeFinancials`).
- `app/lib/alert.server.ts` (ou nome equivalente do ciclo 1) — reaproveitar helper de criação de alerta.

### 9.4 Estado do Harness

- [`.harness/state.json`](./.harness/state.json) — `currentCycle: 3`, `currentPhase: phase.0.briefing`, `cycle3.scope: "Módulo Estoque + Patrimônio"`.
- [`.harness/state-machine.json`](./.harness/state-machine.json) — contrato read-only. Não editar.

### 9.5 Débitos pré-existentes (conhecimento, fora do escopo)

| # | Débito | Origem | Status |
|---|---|---|---|
| MVP-DEBT-001 | 74 testes pré-existentes falhando em arquivos não-S06/S07/S08 (alerts, config, dashboard, members, session, _middleware, smoke) — DI consumers | Ciclo 2, descoberto em S06 rework | partial-resolved (108→74), sprint dedicada S13+ |
| MVP-DEBT-003 | 107 typecheck errors pré-existentes | Ciclo 2 | Aberto, sprint dedicada S13+ |
| S07-DEBT-001 | 1 mock edge case atômico em `transferirEntreCaixas` | Ciclo 2, S07 | Aberto, sprint dedicada S13+ |
| CYCLE-3-DEBT-001 | `MotivoPerda` é texto livre em vez de upload de laudo (S3 fora de escopo) | Este brief, §5.2 | Aceito neste ciclo, integração com S3 em ciclo futuro |
| CYCLE-3-DEBT-002 | Alerta RN-EST-04 é manual (consulta), não cron | Este brief, §5.1 | Aceito neste ciclo, scheduler real em ciclo futuro |

---

## Próxima revisão

- **Quando:** ao final de cada sprint do ciclo 3 (S11, S12), ou se RN-EST mudar.
- **Por quem:** `documenter` agent (Fase 1) ao consolidar; `requirements` e `designer` ao detalhar.
- **Quem consome este brief:** `documenter` (Fase 1) → `requirements` (Fase 2) → `designer` (Fase 3) → `sprint-tasker` (Fase 4) → orchestrator + 5 workers (Fase 5).

---

> **Pedido de aprovação:**
> Aprova este `brief.md` para iniciar a **Fase 1 (Documentação)** do ciclo 3?
>
> - ✅ **Aprovar** — Fase 1 inicia com base neste escopo, decisões e restrições.
> - ✏️ **Editar** — apontar o que ajustar (seções 4, 5, 6, 7 ou 8 são as mais prováveis de iteração).
> - ❌ **Rejeitar** — explicar o motivo para nova rodada de discovery.
