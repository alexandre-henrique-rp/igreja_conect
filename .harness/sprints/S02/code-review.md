# S02 Code Review — Membros CRUD

> **Sprint:** S02 — Membros: Listagem + CRUD básico
> **Reviewer:** code-reviewer (Harness v6.3.0)
> **Data:** 2026-06-13T15:12:45Z
> **Status do gate:** ❌ **REWORK NECESSÁRIO** (score 66 < 70)

---

## Resumo Executivo

A Sprint S02 está **parcialmente implementada** (em progresso, status `in_progress` em `state.json`). O que foi entregue mostra **excelente qualidade** e segue o padrão estabelecido em S01: JSDoc em PT-BR consistente, testes cobrindo comportamento (não método), RBAC fina projetada corretamente no service (em teste, mesmo sem implementação), e gate LGPD garantido via `.strict()` no schema. **Contudo, apenas 2 das 12 tasks da sprint estão realmente completas (S02-T01 schemas + S02-T03 parciais de componentes base), com 7 tasks de feature faltando e 1 com teste-antes-do-código invertido (S02-T02 `members.server.ts` tem teste mas não implementação)**.

**Padrão de qualidade mantido:** os 8 componentes UI novos seguem o mesmo padrão dos 7 da S01 — JSDoc rico, testes SSR via `createRoutesStub`, acessibilidade WCAG exemplar (aria-current, role=alert, aria-invalid, aria-describedby), e ZERO vazamento de PII no bundle (sufixo `.server.ts` respeitado).

**Bloqueador principal:** o coração da sprint — `app/lib/members.server.ts` (S02-T02) — **não foi implementado**, embora seu teste de integração (`members.server.test.ts`, 353 linhas, 24 cenários) esteja completo. O pipeline `vitest` falhará ao importar `./members.server` em qualquer momento.

**Score final: 66/100** — **REWORK** (gate exige ≥ 70). Loopback para `phase.5.build` com foco em (1) implementar `members.server.ts`, (2) implementar as 4 rotas `app/routes/app/membros.*`, (3) implementar `FormMembro`/`Section`/`Sidebar`/`TopbarAutenticada`/`app.tsx`, (4) criar `e2e/membros-crud.spec.ts`.

---

## Score por Princípio

| Princípio | Score | Máximo | % | Status |
|---|---|---|---|---|
| **TDD é obrigatório** | 11 | 40 | 27.5% | ❌ **REWORK** (7/12 tasks faltando + TDD invertido em T02) |
| **Documentação é obrigatória** | 27 | 30 | 90.0% | ✅ passa |
| **Simplicidade (KISS/YAGNI)** | 28 | 30 | 93.3% | ✅ passa |
| **TOTAL** | **66** | **100** | **66.0%** | ❌ **REWORK** (gate ≥ 70) |

---

## Status por Task da Sprint S02

| # | Task | Status | Implementação | Teste | Veredito |
|---|---|---|---|---|---|
| S02-T01 | `schemas/membros.ts` | ✅ completo | ✅ 154 linhas | ✅ 272 linhas, 26 testes | ✅ passa |
| **S02-T02** | **`members.server.ts`** | ⚠️ **TDD INVERTIDO** | ❌ **FALTA** | ✅ 353 linhas, 24 testes | ❌ **BLOQUEADOR** |
| S02-T03 | 8 componentes base | ✅ 8/8 entregues | ✅ ~985 linhas totais | ✅ 8/8 testes | ✅ passa |
| **S02-T04** | `membros._index.tsx` | ❌ **FALTA** | ❌ | ❌ | ❌ falta |
| **S02-T05** | `FormMembro` + `Section` | ❌ **FALTA** | ❌ | ❌ | ❌ falta |
| **S02-T06** | `membros.novo.tsx` | ❌ **FALTA** | ❌ | ❌ | ❌ falta |
| **S02-T07** | `membros.$id.tsx` | ❌ **FALTA** | ❌ | ❌ | ❌ falta |
| **S02-T08** | `membros.$id.editar.tsx` | ❌ **FALTA** | ❌ | ❌ | ❌ falta |
| **S02-T09** | `app.tsx` + `Sidebar` + `TopbarAutenticada` | ❌ **FALTA** | ❌ | ❌ | ❌ falta |
| S02-T10 | `app/_index.tsx` | ✅ pronto desde S01 | ✅ 43 linhas | ✅ (S01) | ✅ passa |
| S02-T11 | `routes.ts` | ⚠️ parcial | parcial | N/A | ⚠️ rotas S02 não registradas |
| **S02-T12** | `e2e/membros-crud.spec.ts` | ❌ **FALTA** | ❌ | ❌ | ❌ falta (igual a S01-T10) |

**Resumo:** 2/12 completas (T01, T03), 1/12 com TDD invertido (T02), 8/12 faltando (T04-T09, T11, T12 — 7 tasks com feature code+test faltando, 1 com apenas registro), 1/12 já pronta desde S01 (T10).

---

## TDD — Análise detalhada (11/40)

**Cobertura de testes nos arquivos S02 entregues (verificável):**

| Arquivo | Teste correspondente | Cobre comportamento? | Veredito |
|---|---|---|---|
| `app/lib/schemas/membros.ts` (S02-T01) | `membros.test.ts` (272 linhas, 26 testes) | ✅ 8 cenários de aceite: payload mínimo, payload completo, validação nome, enum tipo, email malformado (com mensagem PT-BR), normalização lowercase+trim, telefone máscara/só-dígitos/< 8 dígitos, CEP máscara/só-dígitos/inválido, coerce date, refine batismo>=conversão (4 cenários), GATE LGPD rejeitando cpf/rg/cnpj, update aceita parcial/vazio/todos/refine, rejeita senhaHash/cpf no update. **Cobre 100% dos acceptanceCriteria de S02-T01.** | ✅ exemplar |
| `app/components/PageHeader.tsx` (S02-T03) | `PageHeader.test.tsx` (5 testes) | ✅ h1 com title, sem action, com action, com breadcrumb, layout sm:flex-row | ✅ |
| `app/components/Select.tsx` (S02-T03) | `Select.test.tsx` (7 testes) | ✅ label/htmlFor, name+options, placeholder como primeira option vazia, sem placeholder não cria option vazia, defaultValue selecionado, classes Tailwind, className merge | ✅ |
| `app/components/TabelaMembros.tsx` (S02-T03) | `TabelaMembros.test.tsx` (10 testes) | ✅ caption sr-only, 5 th scope='col', hidden md:block, 1 tr por membro, links para /app/membros/:id, badge cor por tipo (amber/green), ministérios vírgula-separated, "—" quando vazio, link Editar condicional (canEdit) | ✅ |
| `app/components/CardMembro.tsx` (S02-T03) | `CardMembro.test.tsx` (8 testes) | ✅ md:hidden, 1 article por membro, link /app/membros/:id, badge VISITANTE → amber, "Sem discipulador" quando null, ministérios, botão Editar condicional, botão Ver sempre | ✅ |
| `app/components/FiltrosMembros.tsx` (S02-T03) | `FiltrosMembros.test.tsx` (11 testes) | ✅ form method=get action, 4 inputs, placeholder q, 3 options tipo, placeholder tipo, defaultValues.q/tipo/ministerioId/discipuladorId, opções populam selects, botão submit "Filtrar", botão "Limpar" → /app/membros | ✅ |
| `app/components/Pagination.tsx` (S02-T03) | `Pagination.test.tsx` (11 testes) | ✅ nav aria-label, ol semântico, "Página N de M", links para todas as páginas, preservação de searchParams (exceto page), sem "Anterior" em current=1, "Próxima" em current<total, sem "Próxima" em current=total, total<=1 retorna null, total=0 retorna null, página atual font-bold text-cyan-700 | ✅ |
| `app/components/Breadcrumb.tsx` (S02-T03) | `Breadcrumb.test.tsx` (6 testes) | ✅ nav aria-label, ol, span aria-current="page", link COM href, separador › (2 entre 3 itens), sem items renderiza nav/ol vazios | ✅ |
| `app/components/FormField.tsx` (S02-T03) | `FormField.test.tsx` (7 testes) | ✅ label htmlFor, children dentro, hint com id derivado, error com role="alert" e id derivado, error sobrescreve hint, required asterisco, sem hint/error não renderiza bloco | ✅ |
| **`app/lib/members.server.ts` (S02-T02)** | **`members.server.test.ts` (353 linhas, 24 testes)** | ⚠️ **Teste EXISTE mas implementação NÃO** — TDD invertido | ❌ **BLOQUEADOR** |

**Análise qualitativa do TDD nos arquivos entregues:**

✅ **Positivo (PADRÃO exemplar mantido de S01):**
- Todos os 8 componentes UI têm teste que cobre **comportamento observável** (HTML SSR via `renderToString` + `createRoutesStub`) — não implementação interna.
- Testes de schema cobrem **regras de negócio específicas** (RN-MEM-02 gate LGPD com `.strict()` rejeitando `cpf`/`rg`/`cnpj`/`senhaHash`).
- Mensagens em PT-BR são validadas explicitamente (`expect(err?.message).toBe("E-mail inválido. Verifique o formato.")`).
- 1 teste por comportamento, não por método. Bom uso de `describe`/`it` para agrupar contextos (`MEMBRO_SAFE_SELECT` separado de `listMembros`).
- `members.server.test.ts` (353 linhas) é **exemplar em cobertura de RBAC fina**: testa DISCIPULADOR vê APENAS seus discípulos (RBAC forçado no `where` do Prisma), DISCIPULADOR fora de escopo → 404 (não 403, não vaza existência), SECRETARIO pode ler qualquer, DISCIPULADOR pode editar discípulo vinculado mas não membro fora de escopo.

❌ **Negativo (achados bloqueadores):**

1. **TDD invertido em S02-T02** (grave): `app/lib/members.server.test.ts` foi escrito E os imports no topo do arquivo referenciam `./members.server` que não existe. Se o orchestrator rodar `pnpm test`, o teste falhará por **erro de import (módulo não encontrado)**, não por asserção de comportamento. TDD-first exige teste falha por **comportamento errado**, não por módulo inexistente. **Evidência:** linhas 17-22 do teste: `import { listMembros, getMembroById, createMembro, updateMembro, deleteMembro, MEMBRO_SAFE_SELECT } from "./members.server";` — sem implementação.

2. **7 tasks com feature code+test faltando (S02-T04, T05, T06, T07, T08, T09, T12):** 7 dos 12 deliverables da sprint não foram entregues. Nenhum progresso parcial verificável: nem service, nem route, nem componente de feature. Isso é ~58% da sprint não entregue.

3. **Sem evidência de TDD-first via git:** todos os arquivos S02 estão untracked. Impossível afirmar pelo histórico git que teste veio antes do código. Evidência indireta: estrutura dos testes (cenários "should.../should not...") sugere TDD-first, mas sem commit granular, é heurística (mesmo padrão de S01).

4. **Cobertura E2E ausente** (mesmo padrão de S01-T10): `e2e/membros-crud.spec.ts` (S02-T12) deveria cobrir 7 chains de CRUD de membros com RBAC fina. Não foi entregue.

**Por que 11/40 (não 40/40):**
- **−5 pontos**: TDD invertido em S02-T02 (teste antes do código, mas o código não existe — TDD só é válido se o teste falha por comportamento errado, não por import error)
- **−21 pontos**: 7 tasks S02 com feature code+test ausentes (−3 cada = −21)
- **−3 pontos**: E2E ausente (S02-T12)
- **Total: 40 − 5 − 21 − 3 = 11**

---

## JSDoc — Análise detalhada (27/30)

**Auditoria de funções públicas exportadas nos arquivos S02 entregues:**

| Arquivo | Funções/tipos públicos | Com JSDoc completo? | Observações |
|---|---|---|---|
| `schemas/membros.ts` | `MembroCreateSchema`, `MembroUpdateSchema`, `MembroCreateInput`, `MembroUpdateInput` + helpers internos `telefone`/`cep`/`email`/`dataOpcional` | ⚠️ Tem JSDoc **descritivo** (sem tags `@description`/`@param`/`@returns`) | Cabeçalho do arquivo é rico (12 linhas explicando RN-MEM-02, LGPD, cross-field). Cada schema tem doc block acima, mas em estilo narrativo, não com tags estruturadas. Padrão similar ao `LoginSchema` de S01 (que perdeu 1 ponto pelo mesmo motivo). |
| `PageHeader.tsx` | `PageHeader`, `PageHeaderProps` | ✅ completo: `@description`, `@param`, `@returns`, 2 `@example` | Documenta estrutura, slots, comportamento responsivo |
| `Select.tsx` | `Select`, `SelectOption`, `SelectProps` | ✅ completo: `@description`, `@param`, `@returns`, `@example` | Documenta diferença vs `<Input>`, mobile-first h-11 |
| `TabelaMembros.tsx` | `TabelaMembros`, `MembroListItem`, `TabelaMembrosProps` + helper `BadgeTipo` (interno) | ✅ completo: `@description`, `@param`, `@returns`, `@example` | Documenta WCAG 1.3.1 (caption sr-only), `MEMBRO_SAFE_SELECT` mencionado |
| `CardMembro.tsx` | `CardMembro`, `MembroListItem`, `CardMembroProps` | ✅ completo: `@description`, `@param`, `@returns`, `@example` | Documenta decisão UX (cards vs scroll horizontal) |
| `FiltrosMembros.tsx` | `FiltrosMembros`, `FiltrosMembrosDefaultValues`, `FiltrosMembrosProps` | ✅ completo: `@description`, `@param`, `@returns`, `@example` | Documenta URL state, layout responsivo |
| `Pagination.tsx` | `Pagination`, `PaginationProps`, `buildHref` (interno) | ✅ completo: `@description`, `@param`, `@returns`, `@example` | `buildHref` documentado separadamente (bom) |
| `Breadcrumb.tsx` | `Breadcrumb`, `BreadcrumbProps` | ✅ completo: `@description`, `@param`, `@returns`, `@example` | Documenta WCAG 2.4.8 (Location) |
| `FormField.tsx` | `FormField`, `FormFieldProps` | ✅ completo: `@description`, `@param`, `@returns`, 2 `@example` | Documenta regra "error sobrescreve hint", WCAG 3.3.2 |
| **`members.server.ts` (S02-T02)** | **FALTA** — esperado: `listMembros`, `getMembroById`, `createMembro`, `updateMembro`, `deleteMembro`, `MEMBRO_SAFE_SELECT` | n/a | n/a |
| **`FormMembro.tsx` (S02-T05)** | **FALTA** | n/a | n/a |
| **`Section.tsx` (S02-T05)** | **FALTA** | n/a | n/a |
| **`Sidebar.tsx` (S02-T09)** | **FALTA** | n/a | n/a |
| **`TopbarAutenticada.tsx` (S02-T09)** | **FALTA** | n/a | n/a |
| **`app.tsx` (S02-T09)** | **FALTA** | n/a | n/a |

**Análise qualitativa:**
- **PT-BR vs inglês:** todas as descrições de função em PT-BR; nomes de parâmetros em inglês (correto, GERAIS.md §6.2).
- **`@example`:** presente em todos os 8 componentes UI (média de 1.5 exemplos por arquivo). Excelente para uso não-óbvio.
- **WCAG 2.1 referenciado:** os 8 componentes citam critério WCAG específico (2.4.6, 1.3.1, 4.1.2, 2.4.8, 3.3.2, 2.1.1, 3.3.1). Isso é **exemplar** — vai além de "acessível" e nomeia o critério.
- **`@throws`:** ausente nas funções UI (correto — funções puras sem side effects, não lançam).
- **Cabeçalho de arquivo:** todos os 8 componentes têm docblock de 5-15 linhas no topo explicando contexto, decisão de design, e armadilhas.
- **Padrão consistente com S01:** mesma estrutura, mesma qualidade. Equipe internalizou o padrão.

**Por que 27/30 (não 30/30):**
- **−1 ponto**: `MembroCreateSchema` e `MembroUpdateSchema` (`schemas/membros.ts:63, 114`) são públicas exportadas mas não têm `@description` formal com tags estruturadas (`@param` para os campos do schema). O JSDoc existe em estilo narrativo (que é o padrão S01 também, então é consistente — mas perde o ponto de rigor do §6.2 do GERAIS).
- **−2 pontos**: componentes/componentes pendentes (`FormMembro`, `Sidebar`, etc.) — arquivos não existem, então não há JSDoc a ser auditado. Não penalizo "ausência de JSDoc em código inexistente" no pilar JSDoc (penalizado em TDD), mas reservo 2 pontos para o impacto agregado.

---

## Simplicidade — Análise detalhada (28/30)

**Critérios avaliados (GERAIS.md §6.3):**

### 1. Tamanho de funções e arquivos

| Arquivo | Linhas | Função principal | Linhas | Limite | OK? |
|---|---|---|---|---|---|
| `schemas/membros.ts` | 154 | (declarações) | — | 30 | ✅ |
| `PageHeader.tsx` | 75 | `PageHeader` | 11 | 30 | ✅ |
| `Select.tsx` | 117 | `Select` | 33 | 30 | ⚠️ acima (JSX, aceitável) |
| `TabelaMembros.tsx` | 196 | `TabelaMembros` | 95 | 30 | ⚠️ acima (JSX inline + table) |
| `CardMembro.tsx` | 122 | `CardMembro` | 51 | 30 | ⚠️ acima (JSX) |
| `FiltrosMembros.tsx` | 142 | `FiltrosMembros` | 53 | 30 | ⚠️ acima (JSX) |
| `Pagination.tsx` | 135 | `Pagination` | 55 | 30 | ⚠️ acima (JSX) |
| `Breadcrumb.tsx` | 90 | `Breadcrumb` | 33 | 30 | ⚠️ acima (JSX) |
| `FormField.tsx` | 108 | `FormField` | 38 | 30 | ⚠️ acima (JSX) |

> **Nota:** GERAIS.md §6.3.5 cita "máximo 30 linhas" categórico, mas o S01 review aceitou JSX linear acima do limite (Button 47, Input 65, FormLogin 89). Mesmo padrão aqui. **Nenhuma função acima do limite é lógica complexa** — todas são JSX linear com 1-2 ramificações.

**TabelaMembros 95 linhas** é o maior JSX da sprint. **Análise:** ela renderiza `<table>` com `<thead>`, `<tbody>` e 5 colunas, sendo que 2 das colunas (Ver/Editar) repetem o mesmo padrão de `<Link>` com SVG inline (9 linhas cada). Há duplicação clara que poderia ser extraída para `<LinhaAcoes>` ou `<IconButton>` (regra de 3, 2ª vez). YAGNI aceita por enquanto, mas se uma 3ª rota precisar de ações Ver/Editar, vale extrair.

### 2. Profundidade de aninhamento

- ✅ Máximo 3 em todos os arquivos. `Pagination.tsx` tem `pages.map` aninhado em `<ol>`, mas é JSX linear (1 nível de map + JSX de cada item, sem if/else).
- ✅ `TabelaMembros.tsx` tem 1 nível de map (items.map) e 1 ternário (isCurrent). Sem aninhamento lógico > 3.

### 3. Parâmetros e complexidade

- ✅ Nenhuma função tem > 4 parâmetros.
- ✅ `listMembros(filter, user)` esperado (S02-T02) terá 2 params. OK.
- ✅ `MembroCreateInput`/`MembroUpdateInput` são tipos inferidos do Zod (não há parâmetros manuais propensos a erro).

### 4. YAGNI — abstração prematura

- ✅ **8 componentes de feature não implementados** = sem risco de over-engineering neles.
- ⚠️ **`MembroListItem` duplicado** entre `TabelaMembros.tsx:40-46` e `CardMembro.tsx:37-43` (mesma estrutura exata, 6 linhas cada). 1ª vez (regra de 3 ainda não justifica extrair para `app/lib/types.ts`), mas vale notar.
- ⚠️ **`TIPO_BADGE` + `TIPO_LABELS` duplicados** entre `TabelaMembros.tsx:59-70` e `CardMembro.tsx:54-64` (idênticos, ~12 linhas cada). Mesma situação: 2ª duplicação, regra de 3 ainda não grita "extraia".
- ✅ **Sem strategy/factory/premature abstraction** nos componentes entregues.
- ✅ **Sem `interface vs type` indecisão** — todos usam `type` consistentemente.
- ✅ **Sem camada de DTO extra** — loader passa items direto, sem DTO intermediário.

### 5. Code smells encontrados

| Local | Smell | Severidade | Recomendação |
|---|---|---|---|
| `TabelaMembros.tsx:147-188` | Repetição do padrão `<Link>` com SVG inline para Ver/Editar (~20 linhas quase idênticas) | low | YAGNI aceito agora (2 ocorrências), extrair `<LinhaAcoes>` quando 3ª rota precisar |
| `TabelaMembros.tsx:40-46` + `CardMembro.tsx:37-43` | `MembroListItem` duplicado | low | 2ª duplicação; extrair para `app/lib/types.ts` quando 3ª rota usar |
| `TabelaMembros.tsx:59-70` + `CardMembro.tsx:54-64` | `TIPO_BADGE` + `TIPO_LABELS` duplicados | low | 2ª duplicação; extrair para arquivo comum quando 3ª rota usar |

### 6. Comentários "porquê" vs "o quê"

- ✅ Excelente: "Por que `MEMBRO_SAFE_SELECT`: este componente consome items já filtrados pelo service (loader) — a UI não tem como acessar `senhaHash`" (TabelaMembros:20-22) — explica o **porquê** da decisão de segurança.
- ✅ "Por que cards e não scroll horizontal na tabela? Decisão de UX" (CardMembro:9-11) — refere `design/PRODUCT.md §5.3`.
- ✅ "Regra de ouro: `error` **sempre** sobrescreve `hint`" (FormField:18-19) — explica decisão semântica.
- ✅ "Form com `method="get"` apontando para a própria rota" (FiltrosMembros:5-9) — explica os 3 benefícios.
- ✅ Todos atendem GERAIS.md §6.3.5 (comentários só se "porquê").

**Por que 28/30 (não 30/30):**
- **−1 ponto**: Duplicação de `MembroListItem` (2 arquivos) e de `TIPO_BADGE`+`TIPO_LABELS` (2 arquivos). 2ª duplicação = limite antes de extrair. Sinal amarelo, não vermelho.
- **−1 ponto**: `TabelaMembros.tsx:101` (`TabelaMembros` 95 linhas) — maior JSX da sprint, com 2 SVGs inline (Ver/Editar) quase idênticos. Aceitável para JSX, mas puxa o score.

---

## Findings consolidados

| # | ID | Severidade | Arquivo:linha | Princípio | Descrição | Sugestão |
|---|---|---|---|---|---|---|
| 1 | CODE-ISS-S02-001 | **high** (blocker) | `app/lib/members.server.ts` (arquivo inexistente) | TDD | S02-T02 — service `members.server.ts` não foi implementado. Teste de integração de 353 linhas (`members.server.test.ts`) importa `./members.server` que não existe, quebrando o pipeline `vitest`. | Implementar `members.server.ts` com 5 funções: `listMembros` (RBAC fina + paginação 25/pág + normalização q), `getMembroById` (DISCIPULADOR fora de escopo → 404), `createMembro` (assertCanWriteMembers + captura P2002 → EmailDuplicadoError), `updateMembro` (escopo + getMembroById antes), `deleteMembro` (só ADMIN/PASTOR + BusinessRuleError 409 se tem discípulos). Exportar `MEMBRO_SAFE_SELECT` (sem senhaHash). |
| 2 | CODE-ISS-S02-002 | **high** (blocker) | `app/routes/app/membros._index.tsx` (arquivo inexistente) | TDD | S02-T04 — rota de listagem com filtros + paginação não implementada. | Criar rota com loader que valida search params via Zod (pageSize ≤ 100), chama `listMembros`, carrega ministerios/discipuladores. Renderiza PageHeader + FiltrosMembros + TabelaMembros (md+) ou CardMembro (<md) + Pagination + EmptyState contextual. |
| 3 | CODE-ISS-S02-003 | **high** (blocker) | `app/components/FormMembro.tsx` (arquivo inexistente) | TDD | S02-T05 — formulário de cadastro/edição de membro não implementado. | Criar `<FormMembro>` com Sections (Identificação, Contato, Eclesiástico, Endereço) usando FormField + Input/Select. Máscaras client-side telefone (11) 98765-4321 e CEP 01000-000. Acessibilidade: labels associados, aria-describedby para hints, aria-invalid para erros. Prop isEdit: muda label + URL do Cancelar. |
| 4 | CODE-ISS-S02-004 | **high** (blocker) | `app/components/Section.tsx` (arquivo inexistente) | TDD | S02-T05 — wrapper de fieldset (legend + bg-white p-4 sm:p-6 border) não implementado. | Criar `<Section title="Identificação">...children</Section>` com `<fieldset>` + `<legend>` semântico. |
| 5 | CODE-ISS-S02-005 | **high** (blocker) | `app/routes/app/membros.novo.tsx` (arquivo inexistente) | TDD | S02-T06 — rota de criação não implementada. | Criar rota com action POST que valida formData via `MembroCreateSchema.safeParse`, chama `createMembro`, redireciona 302 para `/app/membros/:id`. Captura `EmailDuplicadoError` → 422 com fieldError.email. Captura erros de validação → 422 com fieldErrors e defaultValues preservados. |
| 6 | CODE-ISS-S02-006 | **high** (blocker) | `app/routes/app/membros.$id.tsx` (arquivo inexistente) | TDD | S02-T07 — rota de detalhe (versão sem aba Fidelidade) não implementada. | Criar rota com loader (getMembroById), render ResumoMembro (nome/tipo/contato/endereço/dados eclesiásticos) + AcoesMembro (Editar + Excluir só ADMIN/PASTOR). Action intent=delete chama deleteMembro, redireciona 302. Delete com discípulos vinculados → 409 com mensagem. ErrorBoundary 404/403. |
| 7 | CODE-ISS-S02-007 | **high** (blocker) | `app/routes/app/membros.$id.editar.tsx` (arquivo inexistente) | TDD | S02-T08 — rota de edição não implementada. | Criar rota com loader (getMembroById + map para FormMembro defaultValues), action (MembroUpdateSchema.safeParse + updateMembro + redirect). DISCIPULADOR fora de escopo → 403 via getMembroById. |
| 8 | CODE-ISS-S02-008 | **high** (blocker) | `app/routes/app.tsx` + `app/components/Sidebar.tsx` + `app/components/TopbarAutenticada.tsx` (arquivos inexistentes) | TDD | S02-T09 — layout autenticado (Topbar + Sidebar com 5 itens + outlet) não implementado. | Criar `app.tsx` que envolve rotas `/app/**`. Loader conta alertasNaoLidos. Sidebar com itens Dashboard/Membros/Ministérios/Alertas/Config + item ativo `bg-cyan-50 text-cyan-900`. Botão "Sair" (form POST /logout). Responsivo: lg+ fixa 240px; <md hamburger (S04). |
| 9 | CODE-ISS-S02-009 | **medium** | `e2e/membros-crud.spec.ts` (arquivo inexistente) | TDD | S02-T12 — E2E Playwright com 7 chains de CRUD não entregue (mesmo padrão de S01-T10 faltando). | Criar 7 chains: (1) admin cria visitante e vê na lista, (2) editar altera nome, (3) excluir com sucesso, (4) DISCIPULADOR vê só discípulos, (5) DISCIPULADOR GET /outroId → 404, (6) email malformado → 422, (7) grep no payload não contém senhaHash. |
| 10 | CODE-ISS-S02-010 | medium | `app/routes.ts` (S02-T11) | TDD | Routes S02 (membros._index/novo/$id/$id.editar, app.tsx layout) **NÃO registradas** em `routes.ts`. Sem registro, build SSR terá rotas faltando. | Editar `app/routes.ts`: adicionar `layout("routes/app.tsx", [index("routes/app/_index.tsx"), route("membros", "routes/app/membros._index.tsx"), route("membros/novo", ...), route("membros/:id", ...), route("membros/:id/editar", ...)])`. **Não bloquear code-review se outras tasks atrasadas.** |
| 11 | CODE-ISS-S02-011 | low | `app/lib/schemas/membros.ts:63, 114` | JSDoc | `MembroCreateSchema` e `MembroUpdateSchema` têm JSDoc **descritivo** mas sem tags estruturadas (`@description` formal, `@param` para cada campo). Padrão aceito em S01 mas perde 1 ponto de rigor. | Adicionar `@description` formal antes de cada schema, com lista explícita dos campos via `@property` (Zod não tem `@param` para campos — usar texto formatado). |
| 12 | CODE-ISS-S02-012 | low | `app/components/TabelaMembros.tsx:147-188` | Simplicidade | 2 SVGs inline (Ver/Editar) repetem padrão de `<Link>` + `<svg>` (20 linhas quase idênticas) | Extrair `<LinhaAcoes membroId={m.id} nome={m.nome} canEdit={canEdit} />` — 2ª duplicação justifica abstração leve |
| 13 | CODE-ISS-S02-013 | low | `app/components/TabelaMembros.tsx:40-46` + `app/components/CardMembro.tsx:37-43` | Simplicidade | `MembroListItem` duplicado entre 2 arquivos (6 linhas idênticas) | Extrair para `app/lib/types.ts` quando 3ª rota usar o tipo |
| 14 | CODE-ISS-S02-014 | low | (sem commit S02) | TDD | Arquivos S02 estão untracked no git. Sem commit granular, evidência de TDD-first é heurística. | Pedir a `backend`/`frontend` commit granular: 1 commit por task S02, com teste antes do código de feature. Manter padrão de commit `feat(S02-TXX): ...`. |

---

## Pontos fortes (5 bullets)

1. **Gate LGPD com `.strict()` (RN-MEM-02) testado explicitamente**: `MembroCreateSchema` E `MembroUpdateSchema` rejeitam `cpf`, `rg`, `cnpj` e `senhaHash` via Zod `.strict()`. Teste valida cada campo sensível em 4 cenários (create+update × cpf/rg/cnpj). Isso é LGPD §2.1 do RAG `lgpd-igreja-conect.md` materializado em código, com teste que o CI pode falhar.

2. **Acessibilidade WCAG exemplar e nomeada por critério**: os 8 componentes UI novos citam o critério WCAG específico (1.3.1 caption sr-only, 2.4.6 Headings, 2.4.8 Location, 3.3.2 Labels, 4.1.2 Name/Role/Value). Padrão melhor que S01 — referencia a norma.

3. **`members.server.test.ts` é o teste de RBAC fina mais bem escrito do projeto**: cobre 5 perfis × 5 operações (24 cenários). Valida que DISCIPULADOR vê **apenas** seus discípulos, que DISCIPULADOR fora de escopo → **404 (não 403, não vaza existência)**, que SECRETARIO pode ler mas não deletar. Este teste sozinho fecha o gate de RAG `security-rbac-matrix.md` §2.3.

4. **Padrão TDD-style "cenário por comportamento" mantido**: testes nomeados como `"rejeita nome com < 2 chars"`, `"normaliza email para lowercase + trim"`, `"RBAC fina: DISCIPULADOR vê APENAS seus discípulos"`. Não há testes "escrever método X" sem propósito — todos têm semântica de negócio.

5. **YAGNI explícito e comentado**: `TIPO_BADGE` e `TIPO_LABELS` como `const as const` (não enum Zod/Yup pesado); `FiltrosMembros` usa `role="search"` direto sem wrapper; `Pagination` retorna `null` em `total <= 1` (sem prop booleana `show`); `cn()` em `lib/cn.ts` sem `clsx` externo (citado em S01 review). Decisões registradas = decisões defensáveis.

---

## Top 3 melhorias (1 por princípio)

1. **TDD — Implementar `app/lib/members.server.ts` (S02-T02) + 7 tasks faltando**: é o **único caminho** para o gate passar. Foco em (1) `members.server.ts` (coração da sprint, destrava o teste de 353 linhas), (2) `app/routes/app/membros._index.tsx` + `membros.novo.tsx` + `membros.$id.tsx` + `membros.$id.editar.tsx` (4 rotas), (3) `FormMembro` + `Section` (formulário), (4) `app.tsx` + `Sidebar` + `TopbarAutenticada` (layout), (5) `e2e/membros-crud.spec.ts` (E2E 7 chains). **Blocker absoluto do gate.**

2. **Simplicidade — Extrair `<LinhaAcoes>` do `TabelaMembros.tsx`**: 2 SVGs inline (Ver/Editar) repetem ~20 linhas de padrão `<Link>` + `<svg>`. 2ª duplicação justifica abstração leve. Reduz TabelaMembros de 95 para ~75 linhas JSX. Mesma técnica aplicável ao `CardMembro` (que também tem botões Editar/Ver).

3. **Documentação — Padronizar JSDoc de schemas Zod com `@description` formal**: o cabeçalho narrativo de `membros.ts` (12 linhas) é excelente, mas `MembroCreateSchema` e `MembroUpdateSchema` (linhas 63, 114) ficam sem tags estruturadas. Adicionar `@description` (1 linha) + lista de campos via texto formatado. Pequeno ajuste, garante consistência com §6.2 do GERAIS.

---

## Lesson learned / RAG candidate

> **TDD-first só é válido quando o teste falha por COMPORTAMENTO ERRADO, não por MÓDULO INEXISTENTE.** Em S02-T02, `members.server.test.ts` foi escrito **antes** de `members.server.ts` (a estrutura é TDD-first no sentido cronológico), mas sem a implementação, o teste falha por **import error**, não por asserção. Isso **esconde** bugs lógicos: quando a implementação chegar, o autor pode escrever a lógica e o teste passa sem validar nada (teste green de "compila"). **Lição:** TDD-first é red-green-refactor. "Red" exige módulo existente retornando valor errado. Se o módulo não existe, o "Red" não está guiando — está só atrasando.

**RAG candidate: `convention-tdd-test-first-order.md` (prioridade: medium)** — documentar a regra "TDD-first exige módulo stub mínimo que retorna valor errado ANTES de escrever o teste". Aplicaria a S03-S05 (alertas, financeiro, dashboard) para evitar o anti-pattern visto em S02-T02. Padrão sugerido:

```ts
// 1. Criar app/lib/foo.server.ts com stub que retorna Promise.resolve([]) ou throw
// 2. Escrever teste que verifica comportamento (deve falhar porque stub não tem lógica)
// 3. Implementar feature que faz teste passar
// 4. Refatorar mantendo verde
```

---

## Métricas resumidas

```
Sprint S02 — Cobertura de tasks
✅ S02-T01 schemas/membros.ts: code + 26 tests
⚠️ S02-T02 members.server.ts: 0 code + 24 tests (TDD INVERTIDO — BLOQUEADOR)
✅ S02-T03 8 componentes UI: code + 8 test files
❌ S02-T04 membros._index.tsx: 0/0
❌ S02-T05 FormMembro + Section: 0/0
❌ S02-T06 membros.novo.tsx: 0/0
❌ S02-T07 membros.$id.tsx: 0/0
❌ S02-T08 membros.$id.editar.tsx: 0/0
❌ S02-T09 app.tsx + Sidebar + TopbarAutenticada: 0/0
✅ S02-T10 _index.tsx: 1 (entregue em S01)
⚠️ S02-T11 routes.ts: parcial (rotas S02 não registradas)
❌ S02-T12 e2e/membros-crud.spec.ts: 0 files

Total entregue: code ~1185 linhas + tests ~1095 linhas = 2280 linhas
Total esperado: ~3000-3500 linhas de code + 1500-2000 linhas de tests
```

```
Princípio                    Score    Max    %       Status
TDD                          11       40     27.5%   ❌ REWORK
JSDoc                        27       30     90.0%   ✅ passa
Simplicidade                 28       30     93.3%   ✅ passa
─────────────────────────────────────────────────────
TOTAL                        66       100    66.0%   ❌ REWORK (gate ≥ 70)
```

---

**Veredito final:** ❌ **REWORK no gate (66 < 70)**. A sprint S02 está em progresso e a qualidade do que foi entregue é **excelente** (9/9 arquivos têm JSDoc exemplar, 9/9 têm testes de comportamento, zero over-engineering). O bloqueio é puramente **escopo de entrega**: 7 das 12 tasks não foram entregues, e 1 (S02-T02) tem TDD invertido. **Recomendação:** loopback para `phase.5.build` com workers `backend` e `frontend` focados em fechar as tasks restantes; orchestrator deve **revisar a estratégia de S02** (talvez quebrar em 2 sub-sprints S02a + S02b).

