# Descrição Arquitetural dos Módulos do Sistema

> **Última atualização:** 2026-08-13 · **Mantido por:** `documenter` agent
>
> Este documento detalha os objetivos, funcionalidades e a matriz de acessos (RBAC) dos módulos do sistema Igreja Conect.
>
> **Documentos relacionados:** [`REGRAS_DE_NEGOCIO.md`](./REGRAS_DE_NEGOCIO.md) (regras RN-XXX) · [`GUIDELINES.md`](./GUIDELINES.md) (convenções) · [`architecture/ARCH.md`](./architecture/ARCH.md) (fluxos críticos).

---

## 📋 Matriz de Controle de Acesso Baseado em Papéis (RBAC)

O sistema conta com **6 perfis administrativos** (enum `Cargo` em `prisma/schema.prisma`). Toda decisão de acesso passa por **3 camadas** (UI → loader → service) — defense in depth. Detalhes técnicos em `.harness/RAG/security-rbac-matrix.md`.

**Legenda:** ✅ = permitido · 👁 = apenas leitura · 🚫 = bloqueado · 🔒 = escopo restrito

| Perfil | Membros (CRUD) | Dízimos (RN-MEM-03) | Financeiro | Estoque Consumo | Estoque Patrimônio | Manutenção Baixa (RN-EST-05) | Requisição Compra | Cultos/Escalas | Células | Eventos |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **ADMIN** | ✅ | 👁 | ✅ | ✅ (autoriza) | ✅ | ✅ | ✅ (aprova) | ✅ | ✅ | ✅ |
| **PASTOR** | ✅ | 👁 | ✅ | 👁 | 👁 | 🚫 | ✅ | ✅ | ✅ | ✅ |
| **FINANCEIRO** | ✅ | 👁 | ✅ (trava saldo) | 👁 | 👁 | 🚫 | ✅ (aprova) | 👁 | 👁 | 👁 |
| **SECRETÁRIO(A)** | ✅ | 🚫 | ✅ (trava saldo) | ✅ (autoriza) | ✅ (envio) | 🚫 | ✅ (solicita) | ✅ | ✅ | ✅ |
| **DISCIPULADOR** | ✅ 🔒 (escopo: seus discípulos) | 🚫 | 🚫 | 👁 | 👁 | 🚫 | 👁 | 👁 | 👁 | 👁 |
| **LÍDER MIN.** | ✅ 🔒 (escopo: seu min.) | 🚫 | 🚫 | 👁 | 👁 | 🚫 | 👁 | ✅ (escalas do min.) | 👁 | ✅ |

> 🔒 **Escopo restrito:** DISCIPULADOR vê apenas membros onde `discipuladorId === user.id`. LIDER_MINISTERIO vê apenas membros onde `ministerios.some(ministerioId === user.ministerioLideranca)`. Aplicado via `where` no Prisma (camada service).

---

## 1. Módulo de Membros

### 1.1 Objetivo Geral

Centralizar o controle de todas as pessoas que se relacionam com a instituição local, fornecendo aos líderes ferramentas para acompanhamento pastoral e gestão de equipes, respeitando privacidade financeira (LGPD).

### 1.2 Funcionalidades Principais

- **Ficha Cadastral Unificada** — dados pessoais (nome, data de nascimento, telefone, e-mail, estado civil, profissão, endereço completo) e dados eclesiásticos (data de conversão, batismo, tipo de membro).
- **Segmentação por Tipo** — `MEMBRO_ATIVO` / `CONGREGADO` / `VISITANTE` com transição manual (RN-MEM-06).
- **Gerenciador de Vínculo de Discipulado** — vincular membros a discipuladores com validação rígida: 1 discípuo × N discípulos, **máximo 12** por líder (RN-MEM-04), anti-loop, anti-auto-vínculo.
- **Aba de Fidelidade Financeira** — restrita a `ADMIN`/`PASTOR`/`FINANCEIRO` (RN-MEM-03). Lista contribuições históricas de dízimos em ordem decrescente.
- **Configuração de Destino de Visitantes** — `ADMIN` aponta membro ou ministério responsável pelo acolhimento (RN-MEM-05). Alerta é gerado em transação atômica.
- **Convite de Acesso** — ao cadastrar membro com cargo + email, token UUID temporário (2h) é gerado (RN-MEM-07).
- **Foto de Avatar** — upload via pipeline de storage (RN-STO-01), com variants lg/md/sm e URLs assinadas.
- **Busca e Paginação** — full-text via `URLSearchParams` com filtros combináveis (tipo, ministério, discipulador, query textual).

---

## 2. Módulo Financeiro

### 2.1 Objetivo Geral

Prover gestão financeira transparente e simplificada baseada em fluxo de caixa real, garantindo saúde financeira através de travas automatizadas de saldo (RN-FIN-04).

### 2.2 Funcionalidades Principais

- **Gestão Multicaixas** — abertura, fechamento e controle de saldos independentes (Geral, Cantina, Jovens, Missões). `Caixa.ativo` (soft-delete) preserva histórico.
- **Mecanismo de Transferência** — registro formal entre caixas com `idempotencyKey` UUID v4 (anti double-submit), agrupamento de lançamentos via `transferenciaGrupoId`.
- **Lançamento de Entradas**:
  - **Dízimos** — vinculados a membro cadastrado (RN-FIN-05).
  - **Ofertas / Campanhas** — aceitam anonimato (sem rastreamento de doador).
- **Lançamento de Saídas e Compras** — registro de contas a pagar, despesas operacionais, manutenção, compra de estoque.
- **Motor de Validação de Saldo** — camada service (`travarSaida()`) intercepta toda aprovação de despesa e compara com saldo líquido do caixa. Bloqueia com mensagem clara em caso de inconsistência.
- **Análise de Fluxo de Caixa** — dashboard com gráficos de entradas vs saídas, saldos disponíveis, séries temporais.
- **Requisições de Compra** — aprovação integrada com o financeiro (RN-EST-06).
- **Relatórios Financeiros** (Cycle 4, read-only):
  - **Balancete mensal** — saldos por caixa mês a mês.
  - **DRE** (Demonstração de Resultado do Exercício).
  - **Fluxo de Caixa** — entradas/saídas por período.
  - **Relatório Customizado** — filtros por período, categoria, caixa.
  - **Exportação CSV** — RFC 4180 + BOM UTF-8 (Excel pt-BR).
- **Histórico de Dízimos (Fidelidade)** — apenas ADMIN/PASTOR/FINANCEIRO (RN-MEM-03).

---

## 3. Módulo de Ministérios

### 3.1 Objetivo Geral

Estruturar as equipes de serviço da igreja com funções, atividades, disponibilidades e escalas integradas.

### 3.2 Funcionalidades Principais

- **Cadastro de Ministérios** — nome, descrição, cor de destaque, líder, capacidade máxima, dias/horários de encontro.
- **Vínculo Membro × Ministério** — N:N via `MinisterioMembro`, com função específica (`FuncaoMinisterio`), flag de liderança e data de entrada.
- **Funções por Ministério** — cadastro de funções (ex: "Vocalista", "Guitarrista", "Mídia") com cor própria. Usado em escalas.
- **Atividades de Ministério** — `CULTO`, `ENSAIO`, `ATIVIDADE_EXTRA` com data, horário e descrição. Cada atividade pode ter participantes ou não.
- **Indisponibilidade de Membros** — períodos em que o membro não pode ser escalado, por ministério. Ingerido pelo gerador de escalas.
- **Integração com Escalas** — escalas são vinculadas a um ministério (obrigatório).

---

## 4. Módulo de Cultos

> **Descontinuado em 2026-10-13.** As telas (`/app/cultos`, `/novo`, `/:id/editar`), o item de menu e o
> service `cultos.server.ts` foram removidos porque o novo UX não tem telas de cultos. O model `Culto` e
> os registros existentes permanecem no banco (dashboard e vínculo de escalas ainda os leem), mas não há
> mais como criar ou editar cultos pela interface. A descrição abaixo é histórica.


### 4.1 Objetivo Geral

Planejar e executar cultos com acompanhamento de estado, escalas vinculadas e ministério responsável.

### 4.2 Funcionalidades Principais

- **Cadastro de Cultos** — título, descrição, tipo (`PRESENCIAL` / `HIBRIDO` / `ONLINE`), data, horário, local, preletor.
- **State Machine de Status** — `AGENDADO` → `CONFIRMADO` → `REALIZADO` (terminal). `CANCELADO` é alternativa terminal.
- **Vínculo com Escalas** — 1 culto pode ter N escalas vinculadas.
- **Vínculo com Ministério** — culto pode ser de responsabilidade de um ministério específico.
- **Flag `executado`** — diferencia cultos realizados de agendados (auxilia dashboard).

---

## 5. Módulo de Escalas

### 5.1 Objetivo Geral

Gerar e gerenciar escalas de voluntários para cultos, eventos e ensaios, considerando funções, disponibilidades e indisponibilidades.

### 5.2 Funcionalidades Principais

- **Geração Automática** — algoritmo em `app/lib/gerarEscalas.server.ts` que cruza:
  - Funções requeridas (`FuncaoMinisterio`).
  - Membros aptos (com `IndisponibilidadeMembro` filtrada).
  - Atividades pré-existentes (evita overlap).
- **Geração Manual** — interface para `ADMIN`/`SECRETARIO` montar escala manualmente.
- **Status de Escala** — `PENDENTE` → `CONFIRMADA` → `REALIZADA` (terminal). `CANCELADA` é alternativa terminal.
- **Voluntários por Função** — cada `EscalaVoluntario` tem `funcao` textual + `funcaoId` opcional (link canônico com `FuncaoMinisterio`).
- **Flag `geradaAutomaticamente`** — diferencia escalas manuais de geradas (auditoria).
- **Vínculo Triplo** — escala pode estar vinculada a **1 culto**, **1 evento**, ou nenhum (ensaio avulso).

---

## 6. Módulo de Células

### 6.1 Objetivo Geral

Gerenciar pequenas comunidades (grupos pequenos) com liderança, membros, dia/horário e endereço.

### 6.2 Funcionalidades Principais

- **Cadastro de Células** — nome único, descrição, líder (`Membro`, 1:1), dia da semana, horário, endereço.
- **Vínculo de Membros** — N:N via `MembroCelula` (unique `[membroId, celulaId]`).
- **Listagem e Filtros** — por líder, dia, bairro.
- **Integração com Alertas** — líderes recebem alertas de visitantes próximos à sua célula (futuro).

---

## 7. Módulo de Eventos

### 7.1 Objetivo Geral

Planejar e divulgar eventos especiais (campanhas, retiros, confraternizações) com responsável e escalas vinculadas.

### 7.2 Funcionalidades Principais

- **Tipos de Evento** — `ESPECIAL` (default), `CAMPANHA`, `CONFRATERNIZACAO`, `RETIRO`, `OUTRO`.
- **State Machine** — `RASCUNHO` → `PUBLICADO` → `REALIZADO` (terminal). `CANCELADO` é alternativa terminal.
- **Período** — `dataInicio` obrigatório, `dataFim` opcional (eventos de 1 dia).
- **Responsável** — 1 `Membro` responsável (opcional).
- **Vínculo com Escalas** — N escalas por evento.

---

## 8. Módulo de Estoque & Patrimônio

### 8.1 Objetivo Geral

Controlar ciclo de vida de insumos de consumo diário e salvaguardar integridade de bens patrimoniais permanentes através de fluxos de manutenção rastreáveis.

### 8.2 Funcionalidades Principais

- **Catálogo de Insumos (CONSUMO)** — registro e controle de volumetria de materiais descartáveis com `quantidadeMinima` (alerta de estoque baixo).
- **Retirada Controlada (CONSUMO)** — apenas ADMIN/SECRETARIO autorizam (RN-EST-02), exigindo `nomeRetirante` textual. Trava de quantidade em transação atômica (RN-EST-07).
- **Inventário Patrimonial (PATRIMONIO)** — cadastro completo de ativos permanentes com `numeroSerie` único, `localizacaoFisica` e `statusPatrimonio`.
- **State Machine de Patrimônio** — `DISPONIVEL` → `EM_MANUTENCAO` → `BAIXADO_PERDA` (terminal). Transições inválidas bloqueadas.
- **Controle de Manutenção de Ativos** — envio para assistência técnica externa com `assistenciaTecnica`, `enderecoAssistencia`, `numeroOs`, `prazoTermino` opcional (RN-EST-03).
- **Alertas Automatizados de Manutenção** — para itens sem prazo: alerta a cada 6 dias (até 30 dias) → a cada 3 dias (após 30 dias) (RN-EST-04).
- **Baixa por Descarte / Sinistro** — `ADMIN` baixa com laudo técnico obrigatório (RN-EST-05).
- **Requisições de Compra** — `SOLICITADA → APROVADA → COMPRADA` (RN-EST-06), com trilha de auditoria (`solicitadoPor`, `aprovadoPor`, `compradoPor`) e vínculo opcional com `Lancamento`.

---

## 9. Central de Alertas

### 9.1 Objetivo Geral

Notificar usuários sobre eventos relevantes: acolhimento de visitantes, manutenções pendentes, prazos próximos.

### 9.2 Funcionalidades Principais

- **Estado por Destinatário** — `lido` e `resolvido` independentes por usuário (RN-ALERTA-01).
- **Visibilidade Configurável** — alertas individuais só para destinatário; alertas globais (manutenção) para todos.
- **Tabs de Filtro** — "Não lidos", "Lidos", "Resolvidos", "Manutenção".
- **Append-only** — sem rota de delete (RN-ALERTA-03). Resolução é soft via `resolvido`.

---

## 10. Storage / Uploads

### 10.1 Objetivo Geral

Pipeline assíncrono para gerenciar uploads de arquivos (avatares, documentos, mídia) com validação, antivírus opcional e variants responsivas.

### 10.2 Funcionalidades Principais

- **Upload Multipart** — POST `/api/uploads` aceita arquivos até tamanho configurado.
- **Validação Magic Bytes** — MIME real detectado (RN-STO-02).
- **Antivírus Opcional** — ClamAV via `clamdjs` quando `STORAGE_CLAMAV_ENABLED=true`.
- **Variants Automáticas** — imagens em `lg`/`md`/`sm` (sharp); áudio/vídeo com ffmpeg; documentos preservados.
- **URLs Assinadas** — TTL curta para preview/download (RN-STO-04).
- **Soft-Delete LGPD** — `Upload.deletedAt` + hard-delete agendado em `retentionUntil` (RN-STO-03).
- **Providers** — `local` (filesystem) ou S3-compat (`garage`/`minio`/`rustfs`/`aws`/`r2`) (RN-STO-05).

---

## 11. Configurações e Administração

### 11.1 Configuração de Acolhimento (RN-MEM-05)

- Tela `/app/config/acolhimento` exclusiva para `ADMIN`.
- Define `responsavelVisitanteTipo` (`MEMBRO` ou `MINISTERIO`) + ID do responsável.
- Singleton: 1 linha em `ConfiguracaoGeral`.

### 11.2 Recuperação de Senha (RN-AUTH-04)

- Fluxo público em `/recuperar-senha`.
- Token temporário + e-mail com link (a integração com provedor de e-mail é futura).

---

## 12. Autenticação e Sessão

### 12.1 Login

- POST `/login` com `email` + `senha`.
- Cookie `__session` httpOnly, sameSite=lax, secure em prod (RN-AUTH-02).
- Sliding renewal (7d) + teto absoluto (30d).

### 12.2 Logout

- GET/POST `/logout` — `Set-Cookie Max-Age=0` + `deleteSession(sid)`.

### 12.3 Convite

- Onboarding de novos membros com cargo (RN-MEM-07).
- Token UUID v4, expira em 2h, uso único.

---

## Anexo: Mapa de Pastas por Módulo

| Módulo | Pasta primária em `app/` |
|---|---|
| Membros | `routes/app/membros.*.tsx`, `lib/members.server.ts`, `lib/discipleship.server.ts`, `components/FormMembro.tsx` |
| Financeiro | `routes/app/financeiro.*.tsx`, `lib/finance.server.ts`, `lib/lancamentos.server.ts`, `lib/transferencias.server.ts`, `lib/relatorios.server.ts`, `lib/caixas.server.ts` |
| Ministérios | `routes/app/ministerios.*.tsx`, `lib/ministries.server.ts`, `lib/funcoesMinisterio.server.ts` |
| Cultos (descontinuado) | — (rotas e service removidos; model `Culto` mantido) |
| Escalas | `routes/app/escalas.*.tsx`, `lib/escalas.server.ts`, `lib/gerarEscalas.server.ts`, `lib/disponibilidades.server.ts` |
| Células | `routes/app/celulas._index.tsx`, `lib/celulas.server.ts` |
| Eventos | `routes/app/eventos.*.tsx`, `lib/eventos.server.ts` |
| Estoque/Patrimônio | `routes/app/estoque.*.tsx`, `routes/app/patrimonio.tsx`, `lib/itemEstoque.server.ts`, `lib/movimentacao.server.ts`, `lib/manutencao.server.ts`, `lib/patrimonio.server.ts`, `lib/requisicaoCompra.server.ts` |
| Alertas | `routes/app/alertas._index.tsx`, `lib/alerts.server.ts` |
| Storage | `routes/api/uploads.*.ts`, `lib/storage/` (15 arquivos) |
| Auth/Sessão | `routes/logout.tsx`, `routes/public/login.tsx`, `routes/public/recuperar-senha.tsx`, `routes/public/convite.$token.tsx`, `lib/auth.server.ts`, `lib/session.server.ts`, `lib/convite.server.ts` |

> **Detalhamento de arquivos** em `app/AGENTS.md`, `app/lib/AGENTS.md`, `app/routes/AGENTS.md`, `app/routes/app/AGENTS.md`, `app/components/AGENTS.md`.
