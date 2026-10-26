⚠️ DEGRADED: single-context (não há ferramenta de subagentes exposta; a automação headless também não pôde iniciar por falta do Chromium).

# Análise somente leitura — `/app/celulas`

## Resumo executivo

A tela cumpre bem o caso básico de **consultar as células e iniciar o cadastro de uma nova**: o título, a descrição, o CTA `+ Nova Célula`, o resumo numérico e os cards com líder, endereço, agenda, status e quantidade de membros aparecem em uma sequência compreensível. O estado vazio também tem uma mensagem direta e uma ação útil. O tom visual observado no screenshot escuro é coerente com o Igreja Conect: superfícies escuras, índigo como ação principal, cantos arredondados e linguagem administrativa sem frieza.

Antes de mudar o visual, porém, há problemas funcionais e de estrutura mais importantes que um redesign: o KPI `Células Ativas` mostra sempre o total de células, a regra RN-CEL-01 de elegibilidade do líder não é validada no service, a rota de criação consulta membros diretamente no loader sem aplicar o RBAC da tela, e o shell tem um intervalo quebrado em tablet (900px) entre a sidebar e o drawer mobile. A lista também não implementa os filtros e a paginação documentados para o módulo.

Minha recomendação é preservar a composição geral — cabeçalho, resumo curto e cards —, corrigir primeiro integridade/RBAC/responsividade e depois alinhar a página aos primitivos DS (`PageHeader`, `Section`, `Card`, `KpiCard`). Não há evidência para substituir a identidade visual do produto ou fazer um redesign completo.

## Escopo, método e evidências principais

- Alvo primário: `app/routes/app/celulas._index.tsx`, com leitura de `celulas.novo.tsx`, `celulas.$id.tsx`, `celulas.$id.editar.tsx`, `FormCelula.tsx`, `app/lib/celulas.server.ts`, schemas, shell autenticado e primitivos DS.
- Contexto lido: `AGENTS.md`, `app/AGENTS.md`, regras de rotas/componentes/DS/lib, `PRODUCT.md`, `DESIGN.md`, `docs/GUIDELINES.md`, `docs/REGRAS_DE_NEGOCIO.md`, `docs/DESCRIÇÃO_DOS_MODULOS.md`, `docs/architecture/ARCH.md`, `impeccable/reference/critique.md`, `polish.md` e `craft-floor.md`.
- Detector estático Impeccable: executado sobre `app/routes/app/celulas._index.tsx`; resultado `[]`, sem achados mecânicos. Isso não cobre semântica de negócio, layout em breakpoints ou comportamento de teclado.
- Evidência visual disponível: `e2e/screenshots/08-celulas-dark.png`, 1280×816, capturada pelo fluxo de `e2e/visual-capture.test.ts:67-74`. Ela mostra o estado vazio em tema escuro.

### Evidências por arquivo e linha

| Evidência | Arquivo/linha | Leitura |
|---|---|---|
| Auth da rota | `app/routes.ts:68-74, 193-196`; `app/routes/app/celulas._index.tsx:22-26` | A rota está dentro do layout autenticado e ainda verifica `user` antes de chamar o service. |
| Conteúdo da listagem | `app/routes/app/celulas._index.tsx:103-124` | Cabeçalho e CTA são implementados manualmente, sem `PageHeader`. |
| KPIs | `app/routes/app/celulas._index.tsx:125-182` | Existem três blocos de resumo, mas `Células Ativas` usa `celulas.length`, igual ao total geral. |
| Estado vazio | `app/routes/app/celulas._index.tsx:188-214` | Há `EmptyState` com ícone, texto e CTA. |
| Cards | `app/routes/app/celulas._index.tsx:215-304` | Grid responsivo 1/2/3 colunas; cards mostram nome, badge, líder, endereço, agenda, capacidade e link de detalhes. |
| Listagem no service | `app/lib/celulas.server.ts:129-145` | `findMany` retorna todas as células ordenadas por nome; não há filtro, paginação ou escopo por usuário. |
| RBAC local | `app/lib/celulas.server.ts:55-75, 129-182, 227-315` | Há listas próprias de cargos para leitura/escrita/vínculo; `DISCIPULADOR` fica excluído, apesar da documentação e do comentário do service divergirem. |
| Regra do líder | `docs/REGRAS_DE_NEGOCIO.md:224-234` | RN-CEL-01 exige que o líder pertença a pelo menos um ministério e diz que a validação é no service. |
| Validação efetiva | `app/lib/celulas.server.ts:188-195, 238-246` | Criação/edição apenas verifica se o membro existe; não verifica tipo de membro, vínculo com ministério ou escopo. |
| Loader de criação | `app/routes/app/celulas.novo.tsx:27-38` | Consulta `prisma.membro.findMany` diretamente e não exige cargo no loader; o POST é protegido apenas depois pelo service. |
| Loader de detalhe | `app/routes/app/celulas.$id.tsx:48-83` | Usa o service para ler a célula, mas depois consulta participantes/candidatos diretamente no Prisma. |
| Ações do detalhe | `app/routes/app/celulas.$id.tsx:89-115, 170-200, 271-326` | Vincular/desvincular/excluir passam pelo service; exclusão tem confirmação e loading; remoção não tem confirmação. |
| Formulário | `app/components/FormCelula.tsx:47-131` | Usa `Card`, `Input`, `Select`, `Textarea`, labels, erros inline, cancelamento e loading de submit. |
| Padrão DS esperado | `app/components/ds/PageHeader.tsx:19-56`, `Section.tsx:18-59`, `Card.tsx:38-115`, `KpiCard.tsx:17-55` | Os primitivos oficiais existem, mas a listagem não os usa; ela recria cards/KPIs com classes locais. |
| Shell desktop/mobile | `app/components/Sidebar.tsx:339-367`; `app/components/MobileNavigation.tsx:74-88`; `app/components/TopbarAutenticada.tsx:131-140` | Sidebar aparece a partir de 781px, o drawer some a partir de 781px, mas o botão mobile só some em `lg` (1024px). |
| Estados globais | `app/root.tsx:55-98` | Erros caem em um ErrorBoundary genérico; não há estado específico da listagem nem retry contextual. |

## Finalidade operacional e hierarquia

### O que a tela permite fazer

1. Reconhecer que o usuário está no módulo `Células`.
2. Criar uma célula pelo CTA do cabeçalho ou pelo estado vazio.
3. Escanear células existentes por nome, status, líder, endereço, agenda e capacidade.
4. Abrir o detalhe pelo link `Detalhes →`; o detalhe permite editar, excluir quando autorizado e gerenciar participantes.

A finalidade é suficientemente clara para secretaria e pastor. Para líder de ministério ou outro perfil de leitura, ela fica enganosa porque o CTA de criação continua visível embora o service negue a ação. Para usuários operacionais que precisam localizar uma célula específica, a ausência de filtros e paginação torna a tela progressivamente menos eficiente.

### Organização atual

A ordem atual é: cabeçalho/CTA → três KPIs → estado vazio ou grid de cards. É uma ordem natural, mas os três grupos não têm contêineres semânticos `Section`/`Card`; visualmente parecem blocos soltos. O resumo também não deixa explícito se é um panorama do módulo ou um filtro aplicado à listagem.

A hierarquia recomendada, sem inventar funcionalidades, é:

1. `PageHeader` com título, descrição curta e uma única ação primária condicional ao RBAC.
2. `Section` de resumo com os três `KpiCard`, corrigindo a contagem de ativas.
3. `Section` da listagem, com título e contagem; inserir filtros/paginação somente porque já estão documentados para o módulo em `docs/DESCRIÇÃO_DOS_MODULOS.md:142-147`.
4. Dentro da seção, `Card`/grid de resultados ou `EmptyState`.
5. O detalhe continua como a tela de decisão e edição, sem trazer participantes para dentro da listagem.

## Análise visual e responsiva

### O que funciona

- O screenshot escuro mostra boa leitura do caminho principal: `Células` no topo esquerdo, CTA índigo no topo direito, resumo logo abaixo e estado vazio centralizado.
- O acento índigo é usado nas ações e no item ativo da navegação. As cores de status da badge têm texto e fundo suave, respeitando a regra de pares semânticos.
- Os controles DS usados (`Button`, `Badge`, `EmptyState`) têm alturas e foco definidos. Os cards têm espaçamento generoso e o grid reduz de três para duas e depois uma coluna.
- O texto é objetivo e em português. “Sem líder”, “Sem endereço” e “Horário não definido” evitam espaços silenciosamente vazios.

### Desvios visuais/DS

- A rota não usa o padrão obrigatório `PageHeader → Section → Card`: o cabeçalho, os KPIs e os cards são `<div>` com classes locais (`celulas._index.tsx:103-226`). Isso não é uma violação de cor literal — os tokens usados são semânticos —, mas é uma duplicação estrutural do DS e pode divergir de membros, ministérios e outras telas.
- O KPI manual e os cards manuais repetem estilos que já pertencem a `KpiCard` e `Card` (`ds/KpiCard.tsx` e `ds/Card.tsx`).
- A faixa de cor dos cards é escolhida por índice (`CARD_COLORS`, `celulas._index.tsx:29-37`), sem significado operacional. Ela usa várias cores de estado apenas como decoração e pode sugerir que a cor tem semântica. O produto documenta um único índigo de ação e cores de estado para comunicar estados.
- O avatar circular de inicial usa um gradiente de tokens (`celulas._index.tsx:248`), embora o restante do sistema privilegie superfícies planas e tokens semânticos. Não é um problema crítico, mas é uma escolha visual isolada.
- O screenshot vazio tem uma área livre grande entre os KPIs e o conteúdo central. A composição continua clara; não há evidência suficiente para reduzir esse respiro sem antes confirmar a altura real em outras larguras.

### Breakpoints

- **1440px:** pela estrutura do shell e pelo screenshot de 1280px, a composição deve comportar-se bem: sidebar fixa, conteúdo limitado a 1280px e cards em três colunas. Não foi possível confirmar em navegador nesta execução.
- **900px:** há um defeito concreto no shell compartilhado, que afeta esta rota. `Sidebar` fica visível a partir de 781px (`Sidebar.tsx:343`), enquanto `MobileNavigation` fica oculto a partir de 781px (`MobileNavigation.tsx:74`). O botão de abrir menu do `TopbarAutenticada` só é ocultado em `lg`/1024px (`TopbarAutenticada.tsx:137`). Portanto, entre 781 e 1023px o botão mobile aparece, mas o drawer está escondido; ao clicar, `AppShell` pode marcar o conteúdo como `inert` sem exibir o menu. A correção deve alinhar um único breakpoint, não ser feita apenas na tela de células.
- **390px:** a listagem usa uma coluna, os KPIs usam uma coluna e o cabeçalho quebra em coluna a partir de `sm`; essa composição é plausível. O link `Detalhes →`, porém, é um inline link de texto pequeno sem `min-h-11`/padding, portanto seu alvo de toque fica abaixo do padrão de 44px. O CTA principal usa o `Button` DS e está melhor protegido.
- A busca global e o breadcrumb pertencem ao shell. Em mobile o breadcrumb desaparece e a busca fica oculta, o que é coerente; o menu drawer possui foco contido, Escape e restauração de foco conforme `MobileNavigation.tsx:26-63`.

## Acessibilidade

### Pontos positivos

- `root.tsx:25` define `lang="pt-BR"`.
- O shell fornece “Pular para o conteúdo” em `TopbarAutenticada.tsx:101-112`.
- O botão primário do DS tem foco visível, `aria-busy` e estado desabilitado durante loading (`Button.tsx:76-111`).
- O `EmptyState` usa heading, descrição e ação; as badges exibem texto, então status não depende somente de cor.
- Formulário de criação/edição tem labels associadas, `aria-invalid`, erros com `role="alert"` e botão Cancelar (`Input.tsx`, `Select.tsx`, `FormCelula.tsx:47-131`).

### Pontos a corrigir/verificar

- `Detalhes →` precisa de área clicável de pelo menos 44px no mobile; o nome da célula poderia continuar sendo o heading, mas o link deve ganhar altura/padding/foco coerentes.
- SVGs de localização, relógio e grupo na listagem não têm `aria-hidden="true"` explícito (`celulas._index.tsx:256-291`). Como são decorativos e acompanhados de texto, devem ser marcados para evitar ruído em leitores de tela.
- O avatar de inicial também é decorativo e não está marcado como oculto para tecnologia assistiva (`:246-252`).
- A listagem tem `h1` e cada card tem `h2`, mas o `EmptyState` renderiza `h3` sem uma seção `h2` correspondente (`EmptyState.tsx:36-45`). É uma pequena inconsistência de outline; envolver o estado na seção da listagem resolve a semântica.
- Foco visual é fornecido globalmente por `app/app.css`, mas não foi possível exercitar a ordem de Tab no navegador porque o Chromium não está instalado.

## Estados e fluxo completo

| Estado/fluxo | Situação observada no código | Avaliação |
|---|---|---|
| Dados | Grid de cards com fallback textual para líder, endereço e horário | Coberto e legível. |
| Vazio inicial | `EmptyState` com “Nenhuma célula encontrada” e CTA | Coberto; deveria dizer “ainda não há células” se não houver filtros, para não sugerir uma busca sem resultado. |
| Sem resultados após filtro | Não aplicável hoje | Não existe filtro; fica pendente junto com a funcionalidade documentada. |
| Loading da listagem | Não há `useNavigation`, skeleton ou pending UI na rota | Ausente. SSR entrega a primeira carga, mas navegação/revalidação lenta não tem feedback específico. |
| Erro de loader/403/500 | Cai no `ErrorBoundary` global (`root.tsx:55-98`) | Existe fallback, mas é genérico, não oferece retry da rota e pode esconder a mensagem do `Response` atrás de “Erro 403”. |
| Validação do cadastro | Erros de campo e erro de regra retornam no action; formulário preserva valores | Bom padrão; `FormCelula` mostra loading e Cancelar. |
| Sucesso de cadastro/edição | Redirect para detalhe | Bom caminho de confirmação; não há toast, mas o novo detalhe é evidência de sucesso. |
| Gerenciamento de participantes | Detalhe mostra lista, vazio, adicionar/remover, loading e erro | Funcionalmente coberto; remoção é imediata e sem confirmação. |
| Exclusão | `window.confirm`, botão danger e loading; service bloqueia célula com participantes | Boa prevenção; a regra de “não pode excluir com participantes” é explicitada pelo erro. |
| Permissão | Service protege mutações; listagem oculta apenas pelo erro posterior | Falta estado/CTA adaptado para leitura. |

## Segurança, RBAC e integridade de dados

### O que está protegido

- Todas as rotas estão sob o middleware de autenticação (`routes.ts:68-74`, `_middleware.tsx:38-65`), e os loaders da feature fazem uma checagem adicional de usuário.
- `listarCelulas` e `buscarCelula` aplicam `assertPodeLer`; criação/edição usam `assertPodeEscrever`; vínculo/desvínculo usam `assertPodeVincular`; exclusão aceita apenas ADMIN/PASTOR (`celulas.server.ts:55-75, 129-182, 227-352`).
- O schema Prisma torna `Celula.liderId` único e `MembroCelula [membroId, celulaId]` único (`prisma/schema.prisma`, models `Celula` e `MembroCelula`), reduzindo duplicidade.
- Exclusão não é silenciosa: exige confirmação na UI e o service impede excluir uma célula com participantes.

### Riscos e divergências

1. **RN-CEL-01 não é garantida no service.** O documento exige que o líder pertença a pelo menos um ministério (`REGRAS_DE_NEGOCIO.md:228`), mas `criarCelula` e `editarCelula` só fazem `membro.findUnique({ select: { id: true } })` (`celulas.server.ts:188-195, 238-246`). Um POST direto pode associar qualquer membro existente, inclusive um visitante ou alguém sem ministério. A filtragem no loader de `celulas.novo.tsx` também só exclui visitantes e líderes já usados (`:31-36`), e não substitui a validação no service.
2. **Loader de criação consulta dados sem RBAC da feature.** `celulas.novo.tsx:27-38` importa Prisma e retorna até 500 nomes de membros a qualquer usuário autenticado antes de o action chamar `criarCelula`. O POST é protegido, mas a leitura da lista de possíveis líderes não é. Um usuário sem cargo ou com cargo não autorizado pode abrir diretamente a rota e receber nomes. O loader deve passar pelo service/RBAC antes de consultar candidatos.
3. **A matriz de cargos está duplicada e divergente.** `celulas.server.ts:55-57` cria listas locais em vez de usar uma decisão centralizada em `rbac.server.ts`, contrariando a convenção de single source. O comentário do service diz que DISCIPULADOR pode “vincular/desvincular”, mas `CARGO_LEITURA` e `CARGO_VINCULAR` não incluem DISCIPULADOR. A matriz documentada diz `DISCIPULADOR` com acesso de leitura a Células (`DESCRIÇÃO_DOS_MODULOS.md` tabela inicial), enquanto a implementação retorna 403. É necessário decidir qual comportamento é correto e cobri-lo com testes positivos e negativos.
4. **Escopo de células não está definido/implementado para perfis de liderança.** `listarCelulas` consulta todas as células para todo cargo permitido; não há filtro por célula liderada, ministério ou relação do usuário. A documentação explicita escopo para membros, mas não esclarece a regra equivalente para Células. Deve ser uma decisão de produto, não uma inferência visual.
5. **A rota de detalhe também acessa Prisma diretamente.** `celulas.$id.tsx:57-75` consulta participantes e candidatos depois do `buscarCelula`; `celulas.novo.tsx` e `celulas.$id.editar.tsx` fazem consultas de líderes diretamente. Isso contraria a fronteira descrita em `ARCH.md`: rotas devem chamar services, e o service deve concentrar regra de domínio/RBAC. Não é um bypass imediato no detalhe porque `buscarCelula` já filtra leitura, mas aumenta o risco de futuras rotas esquecerem a proteção.
6. **CTA de criação aparece para leitores.** A index não usa `loaderData.user` para condicionar `+ Nova Célula` (`celulas._index.tsx:98-123, 188-214`). FINANCEIRO e LÍDER_MINISTERIO, permitidos para leitura pelo service, veem uma ação que terminará em 403. Isso é enganoso e também deixa a intenção de permissão somente para o servidor, em vez de aplicar as três camadas coerentemente.

## Achados por severidade

### Crítico

- **Nenhum achado crítico confirmado** na leitura. Não foi observada exposição financeira, ausência do middleware de autenticação ou mutação sem uma checagem de cargo no service.

### Alto

- **A1 — Shell tablet pode ficar inutilizável (781–1023px).** O trigger mobile fica visível, mas o drawer está oculto; abrir o menu pode tornar o conteúdo `inert` sem mostrar navegação. Afeta a verificação pedida em 900px e deve ser corrigido no shell compartilhado.
- **A2 — Líder inelegível pode ser salvo por request direto.** Falta a validação de ministério prevista em RN-CEL-01 no service; a UI não é uma barreira de segurança.
- **A3 — Lista de possíveis líderes pode ser retornada sem autorização de módulo.** O loader de `/app/celulas/novo` acessa Prisma antes de uma checagem de cargo; isso expõe nomes de membros a qualquer sessão autenticada e quebra a separação de camadas.
- **A4 — KPI operacional enganoso.** `Células Ativas` é sempre igual ao total, inclusive quando houver células `EM_FORMACAO` ou `INATIVA`. Isso pode levar secretaria/pastor a tomar decisão com resumo falso.

### Médio

- **M1 — RBAC documentado e implementado divergem.** DISCIPULADOR, comentários do service e matriz dos módulos não concordam; também falta decisão explícita de escopo por liderança.
- **M2 — Filtros e paginação documentados não existem.** O service carrega a lista completa e a UI não oferece líder, dia, bairro/região ou paginação. Isso limita a rotina administrativa conforme o número de células cresce.
- **M3 — Ação de criação aparece para perfis somente leitura.** Deve haver `podeCriar`/ação condicional no loader e no componente, sem substituir a proteção do service.
- **M4 — A listagem não usa `PageHeader`, `Section`, `Card` e `KpiCard`.** O visual não está fora da identidade, mas a implementação duplica o DS e torna consistência/dark mode mais difícil de manter.
- **M5 — Loading e erro são genéricos/ausentes na listagem.** Uma revalidação lenta não mostra progresso; 403/500 dependem do ErrorBoundary global e não oferecem recuperação contextual.

### Baixo

- **B1 — Link `Detalhes →` tem alvo de toque pequeno.** O problema é mais perceptível em 390px.
- **B2 — Ícones decorativos sem `aria-hidden` e heading `h3` do vazio sem seção `h2`.** Pequenas correções sem mudança de comportamento.
- **B3 — Faixa de cor por índice e gradiente do avatar são decoração sem significado.** Podem ser simplificados para manter a economia de cor definida em `DESIGN.md`.
- **B4 — Desvincular participante não pede confirmação e não mostra confirmação de sucesso.** A ação é reversível, mas pode ocorrer por toque acidental.

## Proposta de organização da página

1. **Cabeçalho:** substituir o bloco manual por `PageHeader` com `title="Células"`, descrição curta e `+ Nova célula` somente quando o usuário puder criar. Manter uma ação primária, sem adicionar ações novas.
2. **Resumo:** usar três `KpiCard` dentro de uma `Section` de resumo. Calcular `totalAtivas` filtrando `status === "ATIVA"`; manter total de células e total de membros. Se status não deve aparecer como KPI, remover o card em vez de exibir um número falso.
3. **Listagem:** abrir uma `Section` com título “Células” e contagem. Encapsular resultados em `Card`/variante DS ou usar uma composição DS equivalente. Preservar o grid de cards, pois ele expõe os dados operacionais essenciais sem inventar métricas.
4. **Filtros/paginação:** implementar apenas a matriz já documentada: líder, dia e região/bairro, via `URLSearchParams`, com paginação no service. Se não for prioridade agora, marcar a documentação como pendente em vez de criar filtros especulativos.
5. **Card de célula:** manter nome, badge textual de status, líder, endereço, agenda e capacidade. Trocar a faixa colorida por acento/neutral ou dar a ela uma semântica explícita; ampliar o alvo de `Detalhes` para toque.
6. **Vazio:** manter `EmptyState`, mas distinguir “nenhuma célula cadastrada” de “nenhuma célula corresponde aos filtros” quando filtros existirem. O CTA deve ser condicionado ao cargo.
7. **Estados de rota:** adicionar pending/error boundary específico somente se isso seguir o padrão das rotas vizinhas; no mínimo, expor mensagem de erro e ação de retorno/retry sem depender de texto técnico.
8. **Camadas:** criar/centralizar helpers de RBAC de Células em `rbac.server.ts` ou documentar claramente por que o service é a exceção; mover consultas de candidatos/participantes para service, incluindo escopo e validação de liderança.
9. **Shell:** alinhar os breakpoints do Sidebar, botão mobile e drawer. O ponto de corte precisa ser o mesmo em todos os três componentes e deve ser testado em 780, 781, 900, 1023 e 1024px.

## Checklist de implementação

- [ ] Corrigir `Células Ativas` para contar apenas `ATIVA` e testar total/ativa/inativa.
- [ ] Validar no service: líder existe, não é visitante, pertence a pelo menos um ministério e não lidera outra célula; manter a regra também no update.
- [ ] Aplicar RBAC no loader de novo/edição antes de consultar candidatos; não retornar nomes por acesso direto não autorizado.
- [ ] Resolver a decisão de `DISCIPULADOR` e o escopo de `LÍDER_MINISTERIO`/demais cargos; alinhar docs, UI, loader e service.
- [ ] Remover listas de cargos duplicadas ou centralizá-las em `app/lib/rbac.server.ts`; adicionar testes 200/403 por cargo e por operação.
- [ ] Mover queries Prisma dos loaders de células para services com selects mínimos e escopo explícito.
- [ ] Ocultar/desabilitar CTA de criação para leitores sem remover a defesa do POST.
- [ ] Decidir e implementar filtros por líder/dia/região e paginação, ou registrar formalmente que ficam fora do próximo incremento.
- [ ] Reestruturar a index com `PageHeader`, `Section`, `Card` e `KpiCard`; preservar tokens semânticos e dark mode.
- [ ] Alinhar breakpoints do shell e testar 390/900/1440px em claro e escuro.
- [ ] Adicionar foco/área de toque ao link de detalhes e `aria-hidden` aos SVGs decorativos.
- [ ] Cobrir vazio, carregamento, erro, 403, lista com status mistos, nomes/endereço longos e célula sem líder.
- [ ] Confirmar ou manter a política de desvincular sem confirmação; se mantida, fornecer feedback de sucesso.

## Saúde heurística (inspeção estática + screenshot)

A pontuação abaixo é indicativa e não substitui a execução interativa.

| Heurística | Nota /4 | Evidência resumida |
|---|---:|---|
| Visibilidade do estado | 2 | Vazio e badges existem; loading/erro/pending da lista não. |
| Correspondência com o mundo real | 3 | Termos e sequência de trabalho são naturais. |
| Controle e liberdade | 3 | Detalhe tem editar/cancelar/exclusão confirmada; remoção não confirma. |
| Consistência e padrões | 2 | Shell/tons combinam, mas index ignora primitivos e RBAC diverge. |
| Prevenção de erros | 2 | Exclusão é protegida, mas líder inelegível e KPI falso passam. |
| Reconhecimento em vez de memória | 3 | Cards mostram os dados principais diretamente. |
| Flexibilidade/eficiência | 1 | Sem filtros ou paginação documentados. |
| Estética minimalista | 3 | Composição limpa; faixa colorida e blocos manuais são ruído leve. |
| Recuperação de erros | 2 | Formulários têm erros; listagem depende de fallback global. |
| Ajuda/documentação | 1 | Não há orientação contextual para permissões ou filtros. |
| **Total** | **22/40** | Estado visual inicial bom, robustez operacional ainda incompleta. |

## Limitações e verificações realizadas

- O arquivo `/home/kingdev/Documentos/igreja_conect/README.md` solicitado não existe neste workspace; a ausência foi registrada em vez de inferir comandos a partir dele. Os comandos reais foram conferidos em `package.json`: `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` e `pnpm build` (o manifesto não possui script `lint`).
- Havia um servidor React Router já ativo para este projeto em `[::1]:5174`; não o reiniciei. Uma requisição sem sessão a `/app/celulas` respondeu `302` para `/login?next=%2Fapp%2Fcelulas`, confirmando o bloqueio de anônimo. Não foi feita mutação HTTP.
- A tentativa de inspeção headless em 1440px, 900px e 390px falhou antes de abrir o browser porque o executável Chromium do Playwright não está instalado (`Executable doesn't exist at /home/kingdev/.cache/ms-playwright/.../chrome-headless-shell`). Não instalei o browser, não iniciei outro servidor e não declarei funcionamento interativo de teclado, foco, claro/escuro ou estado vazio além do screenshot existente.
- O único artefato visual lido foi `e2e/screenshots/08-celulas-dark.png` (1280×816, vazio, tema escuro), gerado pelo teste `e2e/visual-capture.test.ts:67-74`. Não há screenshot claro, tablet ou mobile correspondente disponível.
- Não rodei `pnpm typecheck`, `pnpm test`, `pnpm build` ou `pnpm test:e2e`: `typecheck` executa `react-router typegen` e o E2E pode iniciar/reutilizar servidores e produzir screenshots, o que seria incompatível com a exigência de investigação sem alteração do working tree. Também não foram encontrados testes unitários específicos de `celulas._index.tsx` ou `celulas.server.ts`; há apenas a captura visual geral referenciada.
- O working tree já tinha alterações e arquivos não rastreados não relacionados à rota antes da análise. A inspeção não editou nenhum arquivo de código, não fez commit e não reiniciou servidor. O único arquivo escrito por esta tarefa é este relatório solicitado.
