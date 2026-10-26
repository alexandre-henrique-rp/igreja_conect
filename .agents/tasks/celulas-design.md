# Design — Fase 1 de correções do módulo `/app/celulas`

**Status:** revisão do design após `celulas-design-review.json`; este artefato descreve a implementação e não altera código de aplicação nesta fase.

## Visão geral

A Fase 1 corrige o KPI da index, fecha a validação de liderança no service, protege os loaders que retornam nomes de candidatos, condiciona os CTAs ao poder real de criação e elimina o estado híbrido do shell entre 781 e 1023px. A stack permanece **React Router 7.16 SSR + React 19 + TypeScript strict + Prisma 7.8 com adapter better-sqlite3 + SQLite + Tailwind v4**, com a fronteira `UI → loader/action → service → Prisma` e RBAC em três camadas.

A liderança obrigatória da RN-CEL-01 prevalece para novas células e para qualquer edição que seja salva. O `Celula.liderId` nullable não será alterado nesta fase para não exigir migration: registros legados nulos continuam legíveis e visíveis como dado legado, mas uma edição precisa atribuir um líder válido antes de salvar. Não haverá preenchimento automático, exclusão ou alteração de schema.

A UI preservará o visual existente e os tokens/primitivos do Design System. Não haverá redesign da index, filtros, paginação, nova matriz de cargos no JSX ou componentes visuais novos. Os únicos dados novos no loader da index serão os necessários para esconder os CTAs (`podeCriar`).

## 1. KPI “Células Ativas”

**Arquivos e linhas atuais afetados:**

- `app/routes/app/celulas._index.tsx:22-27` — loader mantém `user` e `celulas` e acrescenta `podeCriar` no item 4.
- `app/routes/app/celulas._index.tsx:108-145` — cálculo e bloco dos três KPIs.
- `app/lib/celulas.server.ts:129-145` — não muda o contrato de `CelulaComLider` nem a query da listagem.

O service continuará retornando `CelulaComLider[]` com `status: string`; o schema Prisma confirma que `Celula.status` é `String` com default `"ATIVA"`, não um enum. O schema de formulário (`app/lib/schemas/celulas.ts:20-32`) aceita exatamente `ATIVA`, `EM_FORMACAO` e `INATIVA`.

A index calculará uma derivação local e pura:

```text
totalAtivas = celulas.filter((celula) => celula.status === "ATIVA").length
```

“Total de Células” continuará sendo `celulas.length`; “Total de Membros” continuará sendo a soma de `totalMembros`. Nenhum status truthy, líder presente ou posição na lista contará como ativo. Status legado desconhecido não será contado como ativo.

O resultado esperado é `0` para lista vazia, somente as linhas `ATIVA` em status mistos e nenhuma alteração no contrato de cada célula. O cálculo não faz I/O e não tem falha própria; falhas da listagem, RBAC ou banco continuam sendo tratadas pelo service/boundary existentes.

## 2. RN-CEL-01 e elegibilidade do líder no service

### Evidência confirmada

- `prisma/schema.prisma:19-26`: `Cargo` contém `ADMIN`, `PASTOR`, `SECRETARIO`, `FINANCEIRO` e `LIDER_MINISTERIO`; não contém `DISCIPULADOR`.
- `prisma/schema.prisma:27-31`: `TipoMembro` contém `MEMBRO_ATIVO`, `CONGREGADO` e `VISITANTE`.
- `prisma/schema.prisma:128-130`: `Membro.ministerios` é `MinisterioMembro[]`.
- `prisma/schema.prisma:246-253`: `MinisterioMembro` contém `membroId`, `ministerioId` e `lider`.
- `prisma/schema.prisma:154-157`: `Membro.celulaLiderada` é a relação 1:1 usada para ocupação.
- `prisma/schema.prisma:598-610`: `Celula.liderId String? @unique`, relação opcional para `Membro`, com `onDelete: SetNull`.
- `docs/REGRAS_DE_NEGOCIO.md:224-228`: RN-CEL-01 exige um líder por célula, vínculo com ao menos um ministério e validação no service.
- `app/routes/app/celulas.novo.tsx:24-35` e `celulas.$id.editar.tsx:27-37`: o comportamento existente exclui `VISITANTE` e líderes já ocupados, mas ainda consulta Prisma diretamente e não verifica ministério.

### Política de `liderId` nulo

A RN-CEL-01 será tratada como obrigatória, sem exceção para novas operações:

1. `criarCelula` rejeita ausência, `undefined`, `null` ou string vazia de líder com `BusinessRuleError("Toda célula deve ter um líder.")`.
2. `editarCelula` calcula o líder efetivo: o novo `liderId`, quando informado, ou o líder atual quando o campo não participa de uma chamada parcial. Se o resultado for nulo, rejeita a edição com a mesma regra. Enviar string vazia não limpa mais o vínculo; é uma tentativa inválida de remover uma liderança obrigatória.
3. O `CelulaFormSchema` passa a exigir `liderId` UUID. O `FormCelula` remove a opção “Sem líder definido” e marca “Líder responsável” como obrigatório. Para uma célula legada sem líder, o formulário abre sem seleção válida e exige escolher um candidato antes de salvar.
4. Células existentes com `liderId = null` continuam sendo retornadas pela leitura para não apagar informação nem fazer backfill implícito. A index e o detalhe podem continuar exibindo o fallback “Sem líder” como indicação de dado legado; essa apresentação não autoriza criar ou editar uma célula sem liderança.

Essa decisão fecha a contradição apontada na revisão sem alterar a coluna nullable. A expectativa de teste para uma edição de célula legada sem atribuir líder é falha de regra; uma edição da mesma célula com um líder elegível deve reparar o vínculo.

### Predicado exato

O predicado de elegibilidade compartilhado por candidatos e service será construído sobre os campos reais do schema:

```text
Para criação:
{
  id: liderId,
  tipo: { not: "VISITANTE" },
  ministerios: { some: {} },
  celulaLiderada: null
}

Para edição da célula `celulaId`:
{
  id: liderId,
  tipo: { not: "VISITANTE" },
  ministerios: { some: {} },
  OR: [
    { celulaLiderada: null },
    { celulaLiderada: { is: { id: celulaId } } }
  ]
}
```

`ministerios: { some: {} }` é a tradução Prisma exata de “pertence a pelo menos um ministério”. O `OR` da edição permite manter o líder da própria célula, mas nunca o líder de outra. `MEMBRO_ATIVO` e `CONGREGADO` permanecem permitidos quando os demais predicados passam; não serão adicionados filtros por `cargo`, `isDiscipulador` ou `MinisterioMembro.lider`, porque esses campos não fazem parte da RN-CEL-01.

`tipo: { not: "VISITANTE" }` fica explicitamente separado da RN-CEL-01. É uma restrição de compatibilidade já presente no loader e solicitada nesta tarefa (“visitante/tipo inelegível”), não uma afirmação de que o texto da RN-CEL-01 a define. Nesta fase, visitante continua rejeitado inclusive se possuir ministério; rever essa política fica para uma decisão formal de produto, fora deste documento.

### Implementação do service e concorrência

**Arquivos e linhas atuais afetados:**

- `app/lib/celulas.server.ts:42-75` — substituir listas locais por asserts canônicos de `rbac.server.ts` e adicionar o construtor privado do `where` de líder.
- `app/lib/celulas.server.ts:172-217` — validar liderança antes do `create`.
- `app/lib/celulas.server.ts:221-270` — buscar a célula existente com recurso discriminado e validar o líder efetivo antes do `update`.
- `app/lib/errors.ts:35-43` — acrescentar, de modo compatível, `resource?: "celula" | "lider"` a `NotFoundError`; chamadas antigas continuam podendo omitir o discriminador.
- `app/lib/schemas/celulas.ts:45-52` — tornar `liderId` obrigatório no input externo.
- `app/components/FormCelula.tsx:60-96` — refletir a obrigatoriedade e remover o placeholder nulo.

O service fará primeiro o RBAC de escrita. Em seguida, para um ID fornecido, fará uma consulta mínima por `id`, `tipo`, existência de um ministério e `celulaLiderada.id`, apenas para distinguir mensagens sem expor dados. Os casos são:

- ID inexistente → `NotFoundError("Líder não encontrado.", "lider")`.
- `tipo === VISITANTE` → `BusinessRuleError` com mensagem explícita de líder inelegível/visitante.
- nenhum vínculo em `Membro.ministerios` → `BusinessRuleError` informando que o líder precisa pertencer a pelo menos um ministério.
- `celulaLiderada.id` diferente da célula em edição, ou qualquer ocupação na criação → `BusinessRuleError("Este membro já lidera outra célula.")`.
- caso válido → a mutation prossegue.

A consulta de validação usará o mesmo `where` compartilhado acima (`findFirst` com `select: { id: true }`) depois da distinção de mensagem. Assim, candidatos e POST direto não têm regras divergentes. O fato de o nome ter sido omitido da lista do navegador não permite bypass: `criarCelula` e `editarCelula` repetem a validação no service.

O `@unique` de `Celula.liderId` continua sendo a proteção final contra corrida. O service capturará somente erros Prisma com `code === "P2002"` e inspecionará `error.meta?.target`:

- alvo contendo `liderId` → `BusinessRuleError("Este membro já lidera outra célula.")`;
- alvo contendo `nome` → preservar a mensagem da operação: `"Já existe uma célula com este nome."` na criação ou `"Já existe outra célula com este nome."` na edição;
- alvo ausente, desconhecido ou diferente → relançar o erro fatal, sem convertê-lo em ocupação de líder.

O reconhecimento aceitará `meta.target` como string ou array de strings, sem depender do nome textual completo da constraint. O fallback genérico `P2002` dos actions será removido; depois que o service mapear os dois alvos conhecidos, um P2002 não identificado subirá ao boundary em vez de receber uma mensagem enganosa.

### Contrato de erros nas actions

- Falha de sessão local → `401` como hoje; o middleware continua redirecionando sessões anônimas.
- Zod (`liderId` ausente/não UUID, nome, textos, status, horário ou capacidade inválidos) → `data(..., { status: 422 })` com `fieldErrors` e valores enviados.
- Regra de liderança ausente, visitante, sem ministério ou ocupada → `BusinessRuleError`, retornado pelo action como `409`, preservando o padrão atual das rotas de criação/edição.
- Líder inexistente na criação → `data` com mensagem `Líder não encontrado.` e `404`.
- Líder inexistente na edição → `data` com a mesma mensagem, valores preservados e `404`; não será reescrito como “Célula não encontrada.”.
- Célula inexistente na edição → `Response("Célula não encontrada.", { status: 404 })` no loader/action, distinguida por `NotFoundError.resource === "celula"`.
- Erros Prisma não reconhecidos ou falhas de banco → fatais para a operação e relançados ao boundary; não serão mascarados como violação de regra nem registrados como erro de formulário.

## 3. Loaders de criação e edição protegidos

**Arquivos e linhas atuais afetados:**

- `app/lib/celulas.server.ts` — nova função server-only `listarLideresElegiveis(user, celulaId?)`.
- `app/lib/rbac.server.ts` — `assertCanManageCelulas` usado antes da consulta.
- `app/routes/app/celulas.novo.tsx:9-37` — remover import de `prisma`; chamar o service de candidatos.
- `app/routes/app/celulas.$id.editar.tsx:9-39` — remover import de `prisma`; autorizar antes de buscar candidatos.

`listarLideresElegiveis` começa com `assertCanManageCelulas(user)`. Só depois executa `membro.findMany` com:

```text
select: { id: true, nome: true }
orderBy: { nome: "asc" }
take: 500
```

O `where` é exatamente o predicado da seção 2; na edição recebe `celulaId` para incluir somente o líder atual, se ele ainda for elegível. Não serão selecionados email, telefone, tipo, cargo ou qualquer campo além do necessário para o `<Select>`.

- Loader de `/app/celulas/novo`: valida usuário, chama `listarLideresElegiveis(user)` e retorna `{ lideres }`.
- Loader de `/app/celulas/:id/editar`: valida usuário, chama `assertCanManageCelulas(user)` **antes de qualquer consulta de nomes**, busca a célula para preencher o formulário e então chama `listarLideresElegiveis(user, params.id)`. O `buscarCelula` continua fazendo sua própria defesa de leitura.
- Actions: continuam fazendo `CelulaFormSchema.safeParse` e chamando `criarCelula`/`editarCelula`; nenhuma proteção de service é removida.

Um usuário autenticado apenas leitor recebe `403` antes do `findMany` de candidatos e nunca recebe nomes de membros. Uma sessão anônima recebe o comportamento `401` existente. Falha de banco no loader é fatal e segue o boundary; não haverá log paralelo de RBAC negado nesta correção.

A consulta de candidatos do detalhe (`app/routes/app/celulas.$id.tsx:47-83`) não será reestruturada nesta fase: ela é uma lista de participantes, não o seletor de líderes tratado aqui. Suas mutations continuam defendidas pelos services.

## 4. CTA de criação e matriz canônica usada pela UI

**Arquivos e linhas atuais afetados:**

- `app/lib/rbac.server.ts:27-37` e próximo aos asserts existentes — adicionar constantes/helpers específicos de Células.
- `app/lib/celulas.server.ts:42-75` — remover `CARGO_LEITURA`, `CARGO_ESCRITA` e `CARGO_VINCULAR` locais e delegar aos helpers canônicos.
- `app/routes/app/celulas._index.tsx:22-27, 94-123, 188-214` — receber `podeCriar` e condicionar os dois CTAs.
- `app/routes/app/celulas.$id.tsx:34, 51-55` — substituir `CARGOS_GERENCIAR` local por `canManageCelulas` no loader, evitando uma segunda matriz.

A matriz efetivamente implementada e representável pelo schema, preservada nesta fase, será centralizada assim:

```text
CELULAS_READ_CARGOS    = ADMIN, PASTOR, SECRETARIO, FINANCEIRO, LIDER_MINISTERIO
CELULAS_MANAGE_CARGOS  = ADMIN, PASTOR, SECRETARIO
CELULAS_DELETE_CARGOS  = ADMIN, PASTOR
```

`rbac.server.ts` exportará `assertCanSeeCelulas`, `assertCanManageCelulas` e `canManageCelulas`. O helper booleano é apenas server-side e será usado pelos loaders; a UI não importará `rbac.server.ts` nem repetirá cargos. O service usará os asserts para leitura, criação, edição e vínculo. A exclusão continua com seu conjunto mais restrito, sem ampliar o escopo desta tarefa.

O loader da index continuará chamando `listarCelulas(user)` e retornará também `podeCriar: canManageCelulas(user)`. Esse booleano é a menor alteração necessária ao contrato para a camada UI não duplicar a matriz. O componente:

- renderiza `+ Nova Célula` no cabeçalho somente se `podeCriar` for `true`;
- passa `action` ao `EmptyState` somente se `podeCriar` for `true`;
- para leitores, mantém o estado vazio informativo sem botão desabilitado ou link oculto acessível;
- mantém a defesa no loader/action/service, portanto alterar HTML ou enviar POST diretamente não concede criação.

A mensagem de permissão do service permanece a existente para `ADMIN`, `PASTOR` e `SECRETARIO`. `FINANCEIRO` segue leitura; não recebe CTA. Não haverá nova cor, card ou componente: a mudança usa os `Button`/`EmptyState` já importados e os tokens existentes.

## 5. Shell responsivo entre 781 e 1023px

### Breakpoint escolhido e razão

O corte único será **1024px (`lg`)**. Ele já é usado pelo trigger mobile em `TopbarAutenticada` e pela regra `.main-area` de `app/app.css`; a Sidebar e o drawer serão alinhados a esse mesmo corte. Assim, `<= 1023px` é composição mobile com drawer e sem margem de Sidebar; `>= 1024px` é composição desktop com Sidebar fixa e margem de 240/64px. Não haverá breakpoint proprietário em 781px.

### Owner único do colapso

A revisão identificou que `AppShell` tem `sidebarCollapsed`, mas `Sidebar` mantém outro `useState`; o design corrige isso levantando o estado:

- `AppShell` permanece o único owner de `sidebarCollapsed`.
- `Sidebar` receberá `collapsed: boolean` e `onCollapsedChange: (collapsed: boolean) => void`; seu `useState` local será removido.
- A Sidebar continuará alternando `w-60`/`w-16`; o botão usará label coerente (“Recolher menu”/“Expandir menu”).
- `AppShell` usará o mesmo estado para `lg:ml-60`/`lg:ml-16` em `.main-area`.
- A regra `@media (min-width: 1024px)` de `.main-area` e a dependência `body.sidebar-collapsed` em `app/app.css:293-300` serão removidas/neutralizadas; a margem não terá dois owners nem precedência CSS ambígua. Os tokens `--sidebar-w` e `--sidebar-w-collapsed` permanecem disponíveis para os componentes que os usam.

### Arquivos e consumidores

- `app/components/Sidebar.tsx:14-27, 312-357`: nova assinatura controlada, estado local removido, `hidden lg:flex` e toggle controlado.
- `app/components/MobileNavigation.tsx:39-75`: `min-[781px]:hidden` vira `lg:hidden`; recebe uma ref de fallback de foco.
- `app/components/TopbarAutenticada.tsx:131-140`: manter/normalizar o trigger como `lg:hidden`; ele passa a coincidir com Sidebar e drawer.
- `app/routes/app.tsx:45-75`: `matchMedia("(min-width: 1024px)")`, estado único, classes `lg:ml-*`, ref em `main` e passagem do fallback ao drawer.
- `app/app.css:293-300`: retirar a regra concorrente de margem; não criar CSS específico de Células.

Em `AppShell`, `<main id="main-content">` receberá `ref` e `tabIndex={-1}` para ser alvo programático acessível quando o trigger mobile deixar de existir visualmente. O efeito de `inert` no fundo continua ligado a `isMobileMenuOpen`.

### Foco, Escape e resize

O drawer mantém contenção de `Tab`/`Shift+Tab`, fechamento por `Escape`, backdrop e lock de `body.style.overflow`. No cleanup de `MobileNavigation`, a restauração será condicional:

1. Se `triggerRef.current` ainda tiver `getClientRects().length > 0` e não estiver com `display`/`visibility` ocultos, focar o trigger.
2. Se o drawer fechou ao cruzar `1023 → 1024px` e o trigger acabou de receber `lg:hidden`, focar `fallbackFocusRef` (`#main-content`) em vez de focar elemento invisível.
3. Em ambos os casos, restaurar exatamente o valor anterior de `body.style.overflow`.

A transição inversa (`1024 → 1023px`) não abre o drawer automaticamente; apenas torna o trigger disponível. O estado de Sidebar recolhida pode ser preservado durante o resize, mas não deve reservar margem desktop enquanto estiver abaixo de `lg`.

### Falhas e comportamento esperado

Não há operação de banco nesta mudança de shell. Se `matchMedia` ou refs não estiverem disponíveis durante SSR, o código continua acessando-os somente em `useEffect`; o fallback de foco é uma proteção de runtime, não uma dependência de renderização SSR. Acessibilidade não deve depender de cor: focus ring, `aria-expanded`, `aria-controls`, `role="dialog"`, `aria-modal` e `inert` existentes serão preservados.

## Decisão RBAC ambígua — fora desta fase

A investigação não autoriza uma nova decisão sobre `DISCIPULADOR` ou o escopo de `LIDER_MINISTERIO`; por isso esta fase preserva apenas o comportamento efetivo e representável, sem inventar cargo, campo ou filtro.

- **DISCIPULADOR:** `PRODUCT.md`, `docs/REGRAS_DE_NEGOCIO.md` e `docs/DESCRIÇÃO_DOS_MODULOS.md` descrevem o perfil, e a matriz documental dá leitura de Células, mas `prisma/schema.prisma:19-26` não contém esse valor em `Cargo`. `rbac.server.ts:30-37` também não o inclui nos cargos administrativos e `celulas.server.ts:55-57` o exclui da leitura. Não adicionar enum, migration ou permissão hipotética nesta fase. A pendência deve ser resolvida em uma decisão RBAC própria.
- **FINANCEIRO:** não há ambiguidade operacional relevante: o schema contém o cargo, a matriz documental marca Células como leitura e o service atual o coloca na leitura, não na escrita. Esse comportamento será centralizado, não ampliado.
- **SECRETÁRIO(A):** a documentação usa a forma humana `SECRETÁRIO(A)`, enquanto o enum real usa `SECRETARIO`; o código atual e a matriz dão criação/edição a esse cargo. A implementação usa apenas `SECRETARIO` como valor canônico.
- **LIDER_MINISTERIO:** a documentação descreve escopo por `ministerioLideranca`, mas `Membro` não tem esse campo nem relação equivalente. O comportamento atual é leitura global. Não será inventado filtro por ministério nem uma relação nova; manter a leitura global existente como compatibilidade desta fase, registrando que isso não confirma a política de escopo futuro.
- **Escopo de Células:** não existe no schema uma relação de escopo específica para Células. Portanto a listagem permanece global para os cargos que já têm leitura efetiva, sem alegar que isso resolve o escopo documental de LIDER_MINISTERIO.
- O RAG de segurança citado em `rbac.server.ts` (`.harness/RAG/security-rbac-matrix.md`) não existe no workspace; ele não pode ser usado como evidência para escolher a política pendente.

A decisão futura deverá alinhar enum, matriz documental, `rbac.server.ts`, service, loaders, UI e testes em conjunto. Ela não bloqueia as correções de KPI, liderança, proteção de candidatos, CTA e breakpoint desta fase.

## Tratamento de entradas e erros por operação

| Entrada/operação | Validação e limite | Falha esperada e resposta |
|---|---|---|
| `nome` | obrigatório, string trim, 2–80 caracteres | Zod 422; nome duplicado 409 com mensagem existente |
| `liderId` | obrigatório após esta fase, UUID; deve apontar para não visitante, com `ministerios.some({})` e sem outra célula | Zod 422 para formato/ausência; líder inexistente 404; inelegível/ocupado 409 |
| `endereco` | opcional, trim, máximo 200 | Zod 422 |
| `diaSemana` | opcional, somente os 7 valores de `DIAS_CELULA` | Zod 422 |
| `horario` | opcional, `HH:MM` 24h | Zod 422 |
| `descricao` | opcional, máximo 1000 | Zod 422 |
| `regiao` | opcional, máximo 80 | Zod 422 |
| `status` | obrigatório/default `ATIVA`, somente `ATIVA`, `EM_FORMACAO`, `INATIVA` | Zod 422 |
| `capacidade` | opcional, inteiro de 1 a 500 | Zod 422 |
| `params.id` | identificador da célula usado pelo service; inexistente não revela nomes | 404 “Célula não encontrada.” |
| loader de candidatos | sessão autenticada + cargo de gestão antes de `findMany`; select mínimo `id/nome`, limite 500 | 401 sem sessão, 403 sem permissão, falha DB fatal |
| CTA/POST direto | `podeCriar` é somente UX; action e service repetem RBAC | link forçado ou POST sem cargo continua 403 |

## Testabilidade e validação da implementação

A implementação deverá criar testes sem colocar lógica de teste em produção:

1. **Service/RBAC:** asserts de leitura/gestão por cargo representável; defesa antes de query de candidatos; criação/edição por chamada direta; ausência de líder; líder inexistente; visitante com e sem ministério; `CONGREGADO` e `MEMBRO_ATIVO` sem ministério; líder elegível; líder ocupado; líder atual na edição; célula legada sem líder; e `P2002` com alvos `liderId`, `nome` e alvo desconhecido.
2. **Erros de edição:** `NotFoundError.resource` deve manter “Célula não encontrada.” para a célula e “Líder não encontrado.” para o líder, sem comparação textual.
3. **Loaders/actions:** `novo` e `editar` não executam `membro.findMany` antes do assert; retornam somente `id/nome`; Zod, 403, 404, 409 e erro fatal preservam os contratos descritos.
4. **Index:** KPI para lista vazia, somente ativas, status mistos e status desconhecido; CTA de cabeçalho e EmptyState presente apenas com `podeCriar`.
5. **Shell/E2E:** larguras 780, 781, 900, 1023, 1024 e 1440px; Sidebar/drawer/trigger/margem alinhados; Sidebar expandida e recolhida; `Tab`, `Shift+Tab`, `Escape`, backdrop, `inert`, lock e restauração de foco; especificamente resize com drawer aberto de 1023 para 1024 focando `main-content` visível.

Gates do projeto, conforme `package.json`: `npm run typecheck`, `npm test`, `npm run build` e, quando o ambiente permitir, `npm run test:e2e`. O detector Impeccable deve ser executado apenas sobre arquivos de UI efetivamente alterados depois da implementação, nunca sobre este documento.

## Resposta aos achados da revisão

- **CEL-001 — liderança nula:** resolvido escolhendo a RN-CEL-01 como obrigatória para criação e edição. A nullable do Prisma é preservada somente para leitura de registros legados; o formulário não oferece limpeza e a edição de legado exige atribuição, com testes explícitos.
- **CEL-002 — margem e colapso:** resolvido com estado único levantado em `AppShell`, props controladas na Sidebar e remoção da margem CSS concorrente. `main-area` usa o mesmo `sidebarCollapsed` que define `w-60/w-16`.
- **CEL-003 — visitante fora da RN:** resolvido separando `ministerios.some({})`/ocupação, que são a RN-CEL-01, de `tipo != VISITANTE`, que é compatibilidade existente e requisito desta tarefa. A fase preserva a rejeição de visitante, mas não apresenta isso como texto da RN; permitir visitante com ministério fica pendente.
- **CEL-004 — NotFound da edição:** resolvido com `NotFoundError.resource` e mapeamento separado de célula e líder. A mensagem do líder não será normalizada para célula.
- **CEL-005 — P2002 ambíguo:** resolvido inspecionando `meta.target`; `liderId` e `nome` têm mensagens próprias e alvo desconhecido relança o erro.
- **CEL-006 — foco no resize:** resolvido com detecção de visibilidade do trigger e fallback `#main-content` com `tabIndex={-1}`, mantendo cleanup de overflow e testes nos dois lados do corte.

## Fora do escopo

Ficam fora desta fase: migration ou alteração do schema Prisma; backfill automático das células sem líder; filtros/paginação da listagem; redesign visual da index; troca ampla do contrato `CelulaComLider`; reestruturação do loader de detalhe; criação do cargo `DISCIPULADOR`; implementação de `ministerioLideranca` ou novo escopo para `LIDER_MINISTERIO`; autenticação geral; módulo financeiro; outras rotas sem necessidade direta; e resolução definitiva da matriz RBAC documental ambígua.
