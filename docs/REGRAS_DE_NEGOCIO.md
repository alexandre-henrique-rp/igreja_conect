# Regras de Negócio — Sistema de Gerenciamento Eclesiástico

> **Última atualização:** 2026-08-13 · **Mantido por:** `documenter` agent
>
> Este documento reúne as diretrizes operacionais, restrições de segurança e comportamentos automatizados que governam o ecossistema do sistema.
> **Convenção de IDs:** `RN-<MOD>-<NN>` (MEM=Membros, FIN=Financeiro, EST=Estoque, CUL=Cultos, ESC=Escalas, CEL=Células, EVE=Eventos, ALERTA=Alertas, STO=Storage, AUTH=Autenticação).
>
> **Documentos relacionados:** [`DESCRIÇÃO_DOS_MODULOS.md`](./DESCRIÇÃO_DOS_MODULOS.md) (matriz RBAC + escopo) · [`GUIDELINES.md`](./GUIDELINES.md) (convenções) · [`architecture/ARCH.md`](./architecture/ARCH.md) (fluxos críticos).

---

## 1. Módulo de Membros e Central de Alertas

### RN-MEM-01 — Perfis de Operação (Escrita)

O cadastro, edição e atualização de membros e visitantes podem ser realizados por qualquer usuário autenticado que possua um dos seguintes papéis no sistema: `ADMIN`, `PASTOR`, `SECRETARIO(A)`, `DISCIPULADOR`, `FINANCEIRO` ou `LIDER_MINISTERIO`.

`DISCIPULADOR` e `LIDER_MINISTERIO` operam com **escopo restrito** (ver matriz em `DESCRIÇÃO_DOS_MODULOS.md`).

### RN-MEM-02 — Restrição de Dados Sensíveis e LGPD

* O sistema **não** coleta dados fiscais invasivos ou excessivos (como CPF ou RG), limitando-se ao tratamento de dados de identificação, contato e endereço residencial.
* Os campos `profissao`, `estadoCivil`, `dataNascimento` e `sexo` são opcionais no cadastro básico.
* `dataNascimento`, `sexo`, `complemento` e `grupo` foram adicionados em Sprint 02 (T05/T08) como wire-up de placeholders — sem obrigatoriedade legal.

### RN-MEM-03 — Privacidade Estrita do Histórico de Dízimos

O histórico financeiro de dízimos de um membro (valores, datas e formas de pagamento) é informação **estritamente confidencial**. Apenas os usuários com os perfis **`ADMIN`**, **`PASTOR`** e **`FINANCEIRO`** podem visualizar estes dados no perfil do membro. Para os demais perfis:

* **UI (camada 1):** a aba/componente é completamente omitida.
* **Loader (camada 2):** `requireRole(user, [ADMIN, PASTOR, FINANCEIRO])` lança `Response(403)`.
* **Service (camada 3):** `assertCanSeeFinancials(actor)` revalida antes de retornar dízimos.

Burlar uma camada **não** bypassa as outras (defense in depth).

### RN-MEM-04 — Limitações da Árvore de Discipulado

* Um membro/discípulo pode estar vinculado a apenas **1 (um) discipulador** ativo por vez (relação 1:N).
* Um discipulador pode possuir no máximo **12 (doze) discípulos** sob sua liderança direta simultânea. O sistema **bloqueia** sumariamente a tentativa de associar o 13º.
* **Anti-loop:** A → B e B → A simultâneo é bloqueado. Auto-vínculo (membro = discipulador de si mesmo) é bloqueado.
* Constante `MAX_DISCIPULOS = 12` em `app/lib/discipleship.server.ts` é a fonte da verdade.

### RN-MEM-05 — Configuração de Acolhimento a Visitantes

O sistema deve disponibilizar uma tela de configurações gerais onde o `ADMIN` define um **Membro** ou um **Ministério** responsável padrão pelo acolhimento de novos visitantes.

* A configuração é **singleton** (sempre 1 linha em `ConfiguracaoGeral`).
* Sempre que um novo visitante for cadastrado, um alerta correspondente é injetado no painel do responsável em **transação atômica** com o `membro.create` (rollback se alerta falhar).

### RN-MEM-06 — Transição Manual de Status

A alteração do tipo de membro (de *Visitante* para *Congregado*, ou de *Congregado* para *Membro Ativo*) é **100% manual** pelos operadores — o sistema **não** contabiliza presença automaticamente em cultos/células.

### RN-MEM-07 — Convite de Acesso (Onboarding)

Quando um membro é cadastrado com `cargo` (administrativo) e `email`:

1. Um `ConviteToken` (UUID v4) é gerado com expiração de **2 horas** e uso único.
2. URL pública `GET /convite/:token` é construída via `process.env.BASE_URL`.
3. Texto formatado em Markdown (`*bold*`) é gerado para WhatsApp/Telegram.
4. O membro cria sua senha → token é marcado como usado (`usedAt`) e `senhaHash` é definido em transação atômica.

> Ver `app/lib/convite.server.ts` para implementação canônica.

---

## 2. Módulo Financeiro e Fluxo de Caixa

### RN-FIN-01 — Controle por Caixas Flutuantes

O sistema opera baseado no conceito de **Caixas** (dinheiro físico ou saldos internos apartados), abandonando a complexidade de conciliação bancária direta. O sistema deve iniciar nativamente com o *Caixa Geral* ativo como padrão (seed cria em `prisma/seed.ts`).

### RN-FIN-02 — Rastreabilidade de Transferências entre Caixas

A igreja pode criar múltiplos caixas (ex: *Caixa da Cantina*, *Caixa de Missões*). Toda transferência de valores entre caixas é registrada de forma **imutável**, armazenando:

* `valorCentavos` (Int, sempre > 0).
* `dataHora` exata da transação.
* `executadoPorId` — identificador do usuário que executou.
* `idempotencyKey` — UUID v4 opcional para prevenir double-submit (race).
* `transferenciaGrupoId` (em `Lancamento`) agrupa os dois lançamentos espelhados (débito + crédito).

### RN-FIN-03 — Autonomia de Aprovação Baseada em Saldo Real

Os operadores com perfil `FINANCEIRO` ou `SECRETARIO(A)` possuem autonomia total para aprovar pedidos de compra, ordens de pagamento e saídas financeiras **desde que o caixa selecionado possua saldo igual ou superior ao valor do débito** (RN-FIN-04).

### RN-FIN-04 — Trava Abrangente de Saldo Insuficiente

O sistema **bloqueia sumariamente** a aprovação de qualquer saída financeira caso o Caixa selecionado para a operação não possua saldo suficiente. **Não** é permitida a geração de saldos negativos em caixas individuais.

> Implementação em `app/lib/finance.server.ts` (`travarSaida()`) e `app/lib/lancamentos.server.ts`. Helper: `assertNonNegative(cents, context)` em `app/lib/money.server.ts`.

### RN-FIN-05 — Ofertas Avulsas Anônimas

Lançamentos de receita da natureza `OFERTA` são permitidos **sem** vínculo obrigatório a um membro (anônimos direto para o caixa). Para `DIZIMO`, o vínculo com membro permanece **obrigatório**.

* `Lancamento.membro` é `SetNull` no delete (RN-FIN-05: oferta anônima é preservada; dízimo órfão vira histórico sem identificação).

### RN-FIN-06 — Relatórios Read-Only (Cycle 4)

Os relatórios financeiros (`/app/financeiro/relatorios/*`) são **read-only** sobre `Lancamento` — **não há novos models** nem migrations. Implementados em `app/lib/relatorios.server.ts` via agregações `groupBy` em `Int` centavos:

* Balancete mensal.
* DRE (Demonstração de Resultado do Exercício).
* Fluxo de caixa.
* Relatório customizado (filtros por período, categoria, caixa).
* Exportação CSV **RFC 4180** + **BOM UTF-8** para abertura correta no Excel pt-BR.

> SECRETARIO é **bloqueado** em todos os relatórios financeiros (apenas leitura do próprio escopo via loaders sem acesso a `relatorios.server.ts`).

---

## 3. Módulo de Estoque e Manutenção (Patrimônio)

### RN-EST-01 — Escopo Dual do Estoque

O estoque é unificado e centralizado fisicamente, mas cataloga e diferencia logicamente duas categorias (enum `TipoItemEstoque`):

1. **CONSUMO** — materiais descartáveis (limpeza, papelaria, insumos para ceia).
2. **PATRIMONIO** — bens permanentes (cadeiras, equipamentos, instrumentos).

Cada categoria tem fluxo distinto:

| Categoria | Movimentação | Status / Rastreamento |
|---|---|---|
| `CONSUMO` | ENTRADA (+) / SAÍDA (−) com `nomeRetirante` | só `quantidade` |
| `PATRIMONIO` | mudança de `statusPatrimonio` (state machine) | `numeroSerie` único, `localizacaoFisica` |

### RN-EST-02 — Restrição de Baixa de Consumo

Apenas usuários com perfil **`ADMIN`** e **`SECRETARIO(A)`** podem autorizar e registrar a saída de itens de consumo do almoxarifado. É **obrigatório** informar `nomeRetirante` (texto livre) no momento da baixa — não pode ser vazio.

### RN-EST-03 — Fluxo de Manutenção Externa com Alertas Automatizados

Bens patrimoniais que necessitem de reparo externo são transferidos para o status `EM_MANUTENCAO`, exigindo:

* `assistenciaTecnica` — Razão Social / Nome da Assistência (obrigatório).
* `enderecoAssistencia` — endereço físico (obrigatório).
* `numeroOs` — Número da Ordem de Serviço (opcional).
* `prazoTermino` — data limite estimada (opcional; se nula, ativa RN-EST-04).

### RN-EST-04 — Escalonamento de Alertas de Manutenções Sem Prazo

Itens em manutenção **sem** `prazoTermino` disparam rotina automatizada na **Central de Alertas** (visível para **todos** usuários autenticados):

* **Até 30 dias sob manutenção:** alerta renovado a cada **6 (seis) dias**.
* **Após 30 dias sob manutenção:** intervalo cai para **3 (três) dias**, cobrando resolução.

> Implementação: padrão manual com worker polling — ver `.harness/RAG/pattern-manutencao-alerta-manual.md`.

### RN-EST-05 — Baixa por Perda Total (Descarte)

Caso um equipamento em manutenção receba laudo técnico atestando inutilidade (perda total), o sistema permite que o `ADMIN` realize a **baixa definitiva** por descarte. É obrigatório:

* Upload do **laudo técnico** (PDF/imagem) anexado a `ManutencaoAtivo.urlLaudoTecnico`.
* `motivo` textual da baixa.

Status do item muda para `BAIXADO_PERDA` (estado terminal).

### RN-EST-06 — Requisições de Compra (Cycle 3)

Bens em falta disparam fluxo de `RequisicaoCompra`:

* Status: `SOLICITADA → APROVADA → COMPRADA` (ou `REJEITADA`).
* `solicitadoPor`, `aprovadoPor`, `compradoPor` são `Membro` distintos (trilha de auditoria).
* Quando `COMPRADA`, vínculo opcional com `Lancamento` (categoria `COMPRA_ESTOQUE`) para integrar ao fluxo financeiro.

### RN-EST-07 — Trava de Quantidade em Movimentação

A quantidade em `MovimentacaoEstoque` é `Int` (positivo para ENTRADA, negativo para SAÍDA). O service `app/lib/itemEstoque.server.ts` valida que `quantidadeFinal >= 0` em **transação atômica** com o `update` — deadlock é impossível.

---

## 4. Módulo de Cultos

### RN-CUL-01 — Tipos de Culto

Enum `TipoCulto`: `PRESENCIAL` (default), `HIBRIDO`, `ONLINE`.

### RN-CUL-02 — Estados de Culto (State Machine)

Enum `StatusCulto`: `AGENDADO` → `CONFIRMADO` → `REALIZADO` (estado terminal).
`CANCELADO` é terminal alternativo.

Transições inválidas são bloqueadas no service.

### RN-CUL-03 — Vínculo com Escalas

Cultos podem ter N escalas associadas (`Escala.cultoId` opcional). Cada escala tem `geradaAutomaticamente: Boolean` para diferenciar escalas manuais de geradas por algoritmo.

---

## 5. Módulo de Escalas

### RN-ESC-01 — Geração de Escalas

A geração de escalas considera:

* `FuncaoMinisterio` (ex: "Vocalista", "Guitarrista") cadastrada por ministério.
* `IndisponibilidadeMembro` por ministério e período.
* `AtividadeMinisterio` (CULTO, ENSAIO, ATIVIDADE_EXTRA) cadastrada para o membro.
* `CalendarioDisponibilidade` (helper em `app/lib/disponibilidades.server.ts`).

### RN-ESC-02 — Status de Escala

Enum `StatusEscala`: `PENDENTE` (default) → `CONFIRMADA` → `REALIZADA` (terminal).
`CANCELADA` é terminal alternativo.

`EscalaVoluntario.status` é independente (string livre, default `CONFIRMADO`).

### RN-ESC-03 — Vínculo Triplo

Uma `Escala` pode estar vinculada a:

* 1 `Culto` (opcional), ou
* 1 `Evento` (opcional), ou
* nenhum (escala avulsa de ensaio/ministério).

Apenas um vínculo por vez é permitido pela UX.

---

## 6. Módulo de Células

### RN-CEL-01 — Liderança de Célula

Cada `Celula` tem **1 (um) líder** (`Celula.liderId`, unique). O líder é um `Membro` que **deve** pertencer ao menos a um ministério para ser elegível (validação em service).

### RN-CEL-02 — Membros da Célula

Relação N:N explícita via `MembroCelula` (unique `[membroId, celulaId]`). Um membro pode participar de múltiplas células (limite não imposto pelo sistema).

### RN-CEL-03 — Campos Operacionais

`Celula.diaSemana`, `Celula.horario`, `Celula.endereco` são operacionais (não enums) — refletem a realidade dinâmica de células pequenas.

---

## 7. Módulo de Eventos

### RN-EVE-01 — Tipos de Evento

Enum `TipoEvento`: `ESPECIAL` (default), `CAMPANHA`, `CONFRATERNIZACAO`, `RETIRO`, `OUTRO`.

### RN-EVE-02 — Estados (State Machine)

Enum `StatusEvento`: `RASCUNHO` → `PUBLICADO` → `REALIZADO` (terminal).
`CANCELADO` é terminal alternativo.

`dataInicio` é obrigatória; `dataFim` é opcional (eventos de 1 dia).

### RN-EVE-03 — Vínculo com Escalas

Eventos podem ter N escalas associadas (`Escala.eventoId` opcional). Responsável é `Membro.responsavelId` (opcional).

---

## 8. Central de Alertas

### RN-ALERTA-01 — Estado por Destinatário

`AlertaDestinatario` é **N:N explícita** com estado por destinatário:

* `lido: Boolean` (default `false`).
* `resolvido: Boolean` (default `false`).

A modelagem `Alerta.destinatarios: String[]` (denormalizada) é **proibida** — perderíamos o estado por destinatário.

### RN-ALERTA-02 — Visibilidade

Alertas relacionados a manutenção (RN-EST-04) são visíveis para **todos** usuários autenticados. Alertas individuais (ex: acolhimento de visitante) são visíveis apenas para o destinatário configurado.

### RN-ALERTA-03 — Não-deleta

`Alerta` é append-only. Não há `DELETE` na rota. Resolução é via `AlertaDestinatario.resolvido = true`.

---

## 9. Módulo de Storage / Uploads

### RN-STO-01 — Pipeline Assíncrono

Pipeline: Cliente → POST `/api/uploads` → bucket staging → worker (`media.process`) → magic bytes → ClamAV → variants → bucket final → delete staging → status `READY`.

### RN-STO-02 — Validação de MIME Real

`declaredMime` (enviado pelo cliente) **nunca** é confiável. Apenas `detectedMime` (magic bytes) é fonte da verdade. Ver `app/lib/storage/magic-bytes.server.ts`.

### RN-STO-03 — Soft-Delete LGPD

`Upload.deletedAt` é preenchido em delete (art. 18, VI). Hard-delete é agendado para `retentionUntil` por job assíncrono.

### RN-STO-04 — URLs Assinadas

Todos os acessos a arquivos passam por `getSignedPreviewUrl` / `getSignedDownloadUrl` com TTL curta. URL bruta do bucket **nunca** é exposta na UI.

### RN-STO-05 — Providers Suportados

* `local` — filesystem em `STORAGE_LOCAL_DIR` (default `./data/storage`).
* `garage` | `minio` | `rustfs` | `aws` | `r2` — S3-compat com AWS SDK v3.

---

## 10. Módulo de Autenticação

### RN-AUTH-01 — Credenciais

Login via `email` + `senha`. Senha com **mínimo 8 caracteres** (recomendação; sem forçar complexidade além de tamanho).

### RN-AUTH-02 — Sessão

Cookie `__session` httpOnly, sameSite=lax, secure em prod. Logout invalida server-side (`deleteSession(sid)`) e limpa cookie (`Max-Age=0`).

**"Lembrar de mim"** (`manterConectado`): marcado → cookie persistente de **30 dias** e sessão **sliding 7d / absoluto 30d**; desmarcado → cookie de sessão do navegador (some ao fechar) e sessão **sliding 12h / absoluto 24h**.

### RN-AUTH-03 — Rate Limit (desativado)
O `/login` **não** limita tentativas nem bloqueia IP (decisão do produto em 2026-10-13). Tentativas inválidas continuam registradas na auditoria (`login.invalid_credentials`, `login.invalid_payload`) com o IP em hash. O módulo `rate-limit.server.ts` permanece no código, mas nenhuma rota o chama.

### RN-AUTH-04 — Convite vs Reset

* **Convite** (RN-MEM-07) — usado no onboarding (criação de senha inicial). Token expira em 2h, uso único.
* **Reset de senha** (`/recuperar-senha`) — fluxo público para recuperação. Implementado em `app/routes/public/recuperar-senha.tsx`.

---

## Anexo: Áreas fora de escopo

Funcionalidades explicitamente **fora** do MVP e listadas como pendências:

- Conciliação bancária automatizada (RN-FIN-01 abandona essa complexidade).
- Contabilização automática de presença (RN-MEM-06 — transição manual).
- Multi-tenant / multi-igreja (sistema assume 1 igreja por instância).
- Multi-moeda (helper `money.server.ts` é BRL-only).
- App mobile nativo (interface é web responsiva).
- Push notifications (alertas são in-app; e-mail/SMS podem ser integrados depois).

> Itens não cobertos por RN não devem ser inferidos. Em caso de ambiguidade, abra questão com `documenter` agent.
