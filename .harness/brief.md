# Igreja Conect — Brief do Projeto

> **Versão:** 0.1 (Briefing)
> **Data:** 2026-06-12
> **Status:** Aguardando aprovação do usuário (gate: user-approval)
> **Escopo deste brief:** MVP — Autenticação + Módulo de Membros
> **Localização do arquivo:** `brief.md` (raiz) — o path-boundary do projeto não permite `.harness/brief.md`; o orchestrator pode mover para `.harness/` se necessário.

---

## 1. Problema

A igreja local hoje opera com controles informais (planilhas, cadernos, WhatsApp) para gerenciar membros, dízimos, estoque e patrimônio. Isso gera (a) perda de histórico pastoral e de discipulado, (b) ausência de privacidade financeira dos dízimos (qualquer líder vê o que qualquer membro contribuiu), (c) risco de decisões financeiras sem visibilidade de saldo por caixa, e (d) patrimônio sem rastreabilidade de manutenção e descarte. O **Igreja Conect** centraliza esses fluxos em um único sistema web com **controle de acesso por papel (RBAC)** e regras de negócio explícitas, começando — neste MVP — por **autenticação** e **gestão de membros + discipulado**.

---

## 2. Usuários e Personas (RBAC)

A matriz abaixo é derivada de `docs/DESCRIÇÃO_DOS_MODULOS.md`. O MVP entrega **todos os 6 perfis** como papéis válidos no `enum Cargo`, mas apenas a coluna **Membros** tem funcionalidade completa no MVP. Demais colunas estão sem UI nesta entrega (entretanto, o enum já existe para não quebrar schema em sprints futuras).

| # | Perfil (enum) | Persona | Acesso no MVP (Membros) | Acesso fora do MVP (reservado p/ sprints futuras) |
|---|---------------|---------|-------------------------|---------------------------------------------------|
| 1 | `ADMIN` | Pastor-presidente / TI da igreja | CRUD total de membros + configurações gerais | Financeiro total, Estoque total, Manutenção + baixa por perda |
| 2 | `PASTOR` | Pastor titular | CRUD total de membros + visualiza dízimos | Financeiro total, Estoque somente leitura |
| 3 | `SECRETARIO` | Secretário(a) administrativo(a) | CRUD total de membros | Financeiro (com trava de saldo), Estoque (autoriza retirada) |
| 4 | `DISCIPULADOR` | Líder de célula / discipulador | CRUD de membros (foco em seus discípulos) + vê apenas seus discípulos | Sem acesso a financeiro |
| 5 | `LIDER_MINISTERIO` | Líder de ministério (louvor, infantil, etc.) | CRUD de membros do seu ministério | Sem acesso a financeiro |
| 6 | `FINANCEIRO` | Tesoureiro(a) | CRUD de membros + visualiza dízimos | Financeiro total (com trava de saldo) |

**Observação crítica:** perfis 1, 2 e 6 (ADMIN, PASTOR, FINANCEIRO) são os únicos que podem visualizar a aba "Fidelidade Financeira" no perfil do membro (RN-MEM-03). No MVP, a aba existe na UI mas os dados de dízimos **não** são populados (módulo Financeiro está fora de escopo); quando o Financeiro entrar em sprint futura, a trava de visibilidade já estará aplicada desde o dia 1.

---

## 3. Escopo do MVP

### 3.1 Autenticação (Auth)

- **Login** com `email` + `senha` (hash bcrypt armazenado em `Membro.senhaHash`).
- **Sessão via cookie httpOnly** assinado (decisão confirmada pelo usuário) — sem JWT, sem localStorage.
- **Logout** invalida a sessão no servidor.
- **Middleware de proteção** em rotas `/app/**` que redireciona anônimos para `/login`.
- **Seed via Prisma** (decisão confirmada) cria o primeiro `ADMIN` na inicialização do banco, idempotente.
- Senha nunca trafega em logs, nunca retorna em payloads de API.

### 3.2 Módulo de Membros

- **CRUD completo** de membros (RN-MEM-01: qualquer perfil autenticado pode escrever).
- **Ficha cadastral unificada** com dados pessoais + eclesiásticos + endereço (RN-MEM-02: **sem CPF**, `profissao` e `estadoCivil` opcionais).
- **Segmentação por tipo:** `MEMBRO_ATIVO`, `CONGREGADO`, `VISITANTE` (RN-MEM-06: transição **manual**, sem contagem automática de presença).
- **Listagem com filtros** (por tipo, por ministério, por discipulador, busca textual por nome).
- **Gerenciador de Vínculo de Discipulado** com duas travas rígidas (RN-MEM-04):
  - 1 discípulo ↔ 1 discipulador (1:N).
  - 1 discipulador ≤ **12** discípulos ativos. Sistema **bloqueia** o 13º.
- **Vincular membro a ministérios** (relação N:N via `MinisterioMembro`).
- **Configuração de destino de visitantes** (RN-MEM-05): `ADMIN` aponta um **Membro** ou **Ministério** responsável pelo acolhimento. Ao cadastrar um visitante, um **alerta** é gerado automaticamente para o responsável.
- **Aba "Fidelidade Financeira"** presente no perfil do membro, mas **bloqueada/oculta** para perfis sem permissão (RN-MEM-03). No MVP, o componente renderiza o estado "Módulo Financeiro ainda não disponível".

### 3.3 Central de Alertas (suporte ao MVP)

- Tela que lista alertas do usuário logado.
- No MVP, alertas são gerados **apenas** pelo evento "novo visitante cadastrado" (RN-MEM-05).
- Marcar como lido / resolvido. Sem push, sem e-mail.

---

## 4. Fora do Escopo (explícito)

Tudo abaixo está **fora** do MVP e só entra em sprints futuras (a partir da Fase 1+, via novos PRDs):

- **Módulo Financeiro:** caixas, transferências, dízimos, ofertas, despesas, trava de saldo, fluxo de caixa. (Models `Caixa`, `TransferenciaCaixa`, `Lancamento` já estão no schema mas **sem UI nem service**.)
- **Módulo de Estoque:** cadastro de insumos, retirada controlada, inventário patrimonial. (Model `ItemEstoque` e `MovimentacaoEstoque` já no schema, sem UI.)
- **Manutenção de Ativos + Alertas Cron:** envio para assistência técnica, escalonamento 6d/3d, upload de laudo, baixa por perda total. (Model `ManutencaoAtivo` já no schema, sem UI nem cron.)
- **Recuperação de senha** por e-mail.
- **2FA / MFA.**
- **Auditoria de logs de leitura** (LGPD art. 37 — quem viu o quê).
- **Notificações por e-mail, push ou WhatsApp.**
- **App mobile nativo** (apenas web responsivo).
- **Integração com gateways de pagamento** (Pix, cartão).
- **Multi-tenant / multi-igreja** (assume uma única igreja local).
- **Exportação de relatórios (PDF/Excel).**
- **Upload de arquivos** (laudos, fotos) — mesmo a aba de "Fidelidade Financeira" no MVP não persiste documentos.

---

## 5. Restrições e Não-Negociáveis

### 5.1 Stack fixada (não negociável)

- **React Router 7.16** com **SSR** habilitado.
- **Vite 8** como bundler.
- **Tailwind CSS 4** para estilização.
- **Prisma 7.8** com provider **SQLite** (arquivo local `dev.db`).
- **TypeScript estrito** com alias `~/*` → `./app/*`.
- **pnpm** como gerenciador (assumido pelo `package.json` existente).

### 5.2 Compliance e privacidade (LGPD)

- **Sem CPF, sem dados fiscais** (RN-MEM-02). Apenas identificação, contato, endereço.
- **Aba de dízimos visível só para ADMIN, PASTOR, FINANCEIRO** (RN-MEM-03) — não só oculta na UI, mas **bloqueada a nível de API/loader** (defense in depth).
- Senhas armazenadas **apenas como hash** (bcrypt), nunca em plain text.
- Cookie de sessão com flags **`httpOnly`, `secure` (em prod), `sameSite=lax`**.
- Sem captura de geolocalização, sem fingerprinting, sem analytics de terceiros no MVP.

### 5.3 Regras de Negócio críticas que DEVEM ser testadas no MVP

- **RN-MEM-02:** ausência de campos invasivos (assertion no schema/service).
- **RN-MEM-03:** bloqueio de leitura de dízimos por perfil inadequado (teste E2E + teste de service).
- **RN-MEM-04:** trava de 12 discípulos por discipulador (teste de boundary — 12 passa, 13 falha).
- **RN-MEM-05:** alerta gerado ao cadastrar visitante (teste de integração).
- **RN-MEM-06:** não existe job de promoção automática (assertion: nenhum cron/scanner promove visitante → congregado).

### 5.4 Princípios de engenharia (v6.2.0+, não negociáveis)

- **TDD obrigatório:** nenhum código de feature sem teste falhando antes (red → green → refactor).
- **Documentação obrigatória:** toda função pública com JSDoc (`@param`, `@returns`, `@throws`, `@example`).
- **YAGNI / KISS:** nenhuma abstração sem 3ª repetição. Sem strategy pattern, sem DI container, sem microserviço.
- **Cobertura mínima de 85%** por sprint (gate do phase 5).

---

## 6. Stack e Decisões Técnicas

| Camada | Tecnologia | Decisão | Status |
|--------|-----------|---------|--------|
| Framework web | React Router 7.16 (SSR) | Já fixado | Confirmado |
| Bundler | Vite 8 | Já fixado | Confirmado |
| Linguagem | TypeScript (strict) | Já fixado | Confirmado |
| Estilização | Tailwind CSS 4 | Já fixado | Confirmado |
| ORM | Prisma 7.8 | Já fixado | Confirmado |
| Banco de dados | SQLite (arquivo `dev.db`) | Já fixado | Confirmado |
| Path alias | `~/*` → `./app/*` | Já fixado | Confirmado |
| Hash de senha | **bcrypt** (`bcryptjs` para compatibilidade SSR) | Recomendado | Confirmado |
| Auth | **Session cookie httpOnly** (React Router 7 nativo + SQLite store) | Recomendado | **Confirmado pelo usuário** |
| Bootstrap admin | **Seed Prisma** (`prisma/seed.ts`) | Recomendado | **Confirmado pelo usuário** |
| Validação de payload | Zod (recomendado) | Sugerido | `[A CONFIRMAR]` na fase de design |
| Testes unitários | Vitest | Sugerido | `[A CONFIRMAR]` |
| Testes E2E | Playwright | Já disponível via MCP | Sugerido |
| Cron / scheduler | **Não necessário no MVP** (alertas de visitante são síncronos) | Decidido | OK |

**Notas de decisão:**

- **Por que session cookie e não JWT:** SSR do React Router 7 emite cookies nativamente; não exige biblioteca extra; mais seguro contra XSS que localStorage.
- **Por que seed e não CLI de bootstrap:** idempotência nativa do Prisma seed; sem atrito no `npm run dev`; um único lugar de verdade.
- **Por que SQLite:** decisão do usuário já em sprint 0; plenamente suficiente para uma igreja local (centenas a poucos milhares de membros).

---

## 7. Critérios de Sucesso do MVP (Definition of Done)

O MVP é considerado **pronto** quando **todos** os itens abaixo forem verdadeiros:

### 7.1 Funcional

- [ ] `npm run dev` sobe o app, executa migrations e o seed cria 1 ADMIN inicial (`admin@igreja.local` / senha definida no seed, documentada no README).
- [ ] É possível fazer login com esse ADMIN e ver a lista de membros (vazia no início).
- [ ] É possível cadastrar, listar, editar e excluir membros (CRUD completo).
- [ ] É possível vincular 12 discípulos a um discipulador; ao tentar o 13º, o sistema **bloqueia** com mensagem clara.
- [ ] Ao cadastrar um visitante, o alerta aparece na Central de Alertas do responsável configurado pelo ADMIN.
- [ ] A aba "Fidelidade Financeira" **some da UI** para perfis `SECRETARIO`, `DISCIPULADOR`, `LIDER_MINISTERIO`, **e retorna 403/oculta na API** se acessada diretamente.

### 7.2 Qualidade (gate do phase 5)

- [ ] Cobertura de testes **≥ 85%** (tester).
- [ ] **0 vulnerabilidades critical/high** (security).
- [ ] `planning-reviewer` score **≥ 70**.
- [ ] **LGPD compliant** (lgpd-officer): sem coleta de CPF, senha hasheada, cookie httpOnly, dízimos restritos por perfil, com testes que provam o bloqueio.
- [ ] Todas as funções públicas com JSDoc completo.
- [ ] Nenhum teste skipped sem justificativa no PR.

### 7.3 Métrica principal (north star do MVP)
>
> **"Um ADMIN consegue cadastrar 50 membros reais, vincular todos a discipuladores respeitando o limite de 12, e gerar alertas de visitante — sem nunca ver dados financeiros de ninguém que não deveria ver."**

A aceitação final é o próprio ADMIN rodando esse cenário em ambiente local.

---

## 8. Riscos e Mitigações

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|-------|---------------|---------|-----------|
| R1 | **Vazamento de dados de dízimos** por falha em esconder a aba (RN-MEM-03). | Média | **Alto** (LGPD + confiança) | Bloqueio em **3 camadas**: (a) UI não renderiza, (b) loader do React Router checa perfil, (c) service/API retorna 403. Teste E2E cobre o caminho direto via URL/API. |
| R2 | **RBAC mal implementado** permite que um `DISCIPULADOR` edite membros de outra célula. | Média | Alto | Middleware de autorização em **todo** `action`/`loader` de membros, com testes unitários por perfil × endpoint × operação. |
| R3 | **Migration do Prisma destrutiva** em ambiente de dev apaga dados de teste entre iterações. | Alta | Baixo (dev) | Seed idempotente + script `npm run db:reset` documentado no README. Snapshot do `dev.db` antes de cada PR destrutivo. |
| R4 | **Vínculo de discipulado em loop** (A discípulo de B, B discípulo de A) causa deadlock ou inconsistência. | Baixa | Médio | Validação no service: `discipuladorId` não pode ser o próprio membro, nem um descendente na cadeia. Teste cobrindo ambos os casos. |
| R5 | **Cookie de sessão não expirando** deixa usuário logado indefinidamente em máquina compartilhada. | Média | Médio | TTL de sessão de **7 dias** + sliding renewal + logout server-side invalida o registro. `[A CONFIRMAR]` valor exato na fase de design. |
| R6 | **SSR expõe dados sensíveis** no HTML inicial (hidratação). | Baixa | Alto | Loaders filtram explicitamente campos sensíveis antes de retornar. Nunca retornar `senhaHash` em nenhum payload. |

---

## 9. Próximos Passos (após aprovação deste brief)

1. **Agora:** Usuário aprova este `brief.md` (gate `user-approval`).
2. **Fase 1 — Documentação:** `documenter` produz `docs/PRD.html` (Product Requirements) e `docs/SPEC.html` (Especificação Técnica), em PT-BR, com base neste brief + docs já existentes.
3. **Fase 2 — Requisitos:** `requirements` refina PRD; `prd-reviewer` e `spec-reviewer` validam (gate `score-threshold`).
4. **Fase 3 — Design:** `designer` gera `docs/design/` (arquitetura, modelo de dados, fluxos de Auth + Membros, RBAC matrix, wireframes de baixa fidelidade); `design-reviewer` valida.
5. **Fase 4 — Planejamento:** `sprint-tasker` quebra o SPEC em tasks técnicas com critérios de aceite; `planning-reviewer` valida score ≥ 70.
6. **Fase 5 — Build + Quality (fan-out paralelo):**
   - `backend` — Prisma + services + loaders/actions (TDD).
   - `frontend` — componentes React Router + Tailwind (TDD em componentes puros).
   - `tester` — testes E2E com Playwright (RN-MEM-03, RN-MEM-04, RN-MEM-05).
   - `security` — auditoria de RBAC, session, hash.
   - `lgpd-officer` — checklist LGPD + RN-MEM-02/03.
   - `qa-gate` agrega: coverage ≥ 85%, 0 vuln critical/high, review ≥ 70, LGPD compliant.
7. **Entrega:** README com `npm run dev` + credenciais do ADMIN seed + comando `npm run db:reset`.

---

## Anexo — Itens marcados como `[A CONFIRMAR]`

Estes pontos não bloqueiam a aprovação do brief, mas precisam de decisão na **Fase 3 (Design)** ou **Fase 5 (Build)**:

1. **Biblioteca de validação:** Zod vs Valibot vs TypeBox. (Sugestão: Zod, ecossistema maduro.)
2. **TTL exato da sessão** e estratégia de sliding renewal. (Sugestão: 7 dias, sliding.)
3. **Política de senha:** comprimento mínimo, caracteres, histórico. (Sugestão: ≥ 8 chars, sem forçar complexidade no MVP — login é interno, não público.)
4. **Comportamento da aba "Fidelidade Financeira"** no MVP: renderizar placeholder "Módulo Financeiro em breve" ou simplesmente não renderizar para perfis bloqueados? (Sugestão: não renderizar; o módulo financeiro é segredo para os demais.)

---

> **Aprovação:** Este brief será considerado aceito quando o usuário responder **"Aprovo"** (ou equivalente) após a pergunta explícita do orchestrator. Em caso de rejeição, será iterado com base no motivo informado.
