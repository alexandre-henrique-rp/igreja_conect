# Assessment A — crítica de design do `/app`

## Método e limites

**Assessment A isolado, somente leitura.** Este documento foi produzido antes de qualquer saída de detector e sem ler, consultar ou inferir achados do Assessment B. Não houve alteração de código nem commit; o único arquivo criado foi este review solicitado. O `git status` final preservou alterações pré-existentes em arquivos de `app/`.

Não havia ferramenta de browser disponível nesta sessão. Portanto, não alego inspeção visual ao vivo. Consultei somente a implementação em `app/` e as evidências locais existentes em `.playwright-mcp/`: dois snapshots estruturais de acessibilidade (login e novo lançamento) e um arquivo YAML vazio. Esses snapshots não foram tratados como prova de comportamento visual/runtime atual; a avaliação principal é estática e ancorada no código.

**Modo da superfície:** Operate — ERP administrativo, com rotinas de cadastro, consulta, lançamento e decisão.

## Veredicto de especificidade de design — avaliação não ancorada

**Veredicto: PARCIALMENTE AUTORADO, MAS AINDA CATEGORIA-INTERCAMBIÁVEL (2/4).**

O produto tem sinais reais de identidade: o vocabulário de células, discipulado, visitantes, cultos, dízimos, caixas e escalas pertence à rotina de uma igreja local; o tom em português é geralmente simpático e objetivo; e o conceito de “Balcão de Acolhimento” aparece na intenção do DS, nos cantos arredondados, no uso de mensagens diretas e em alguns estados vazios.

Mas esses sinais estão mais no **conteúdo** do que na autoria da experiência. A casca continua reconhecível como um template genérico de admin SaaS: sidebar fixa com grupos, topbar com busca, breadcrumbs, quatro KPIs, cards, tabela, gráfico de linha e donut. Uma empresa de CRM, estoque ou financeiro poderia reutilizar grande parte da composição sem mudança estrutural. A especificidade eclesiástica não organiza suficientemente as prioridades da tela: por exemplo, células, visitantes e discipulado não aparecem como jornadas relacionadas; finanças mistura visual de ERP genérico com números estáticos; e o dashboard privilegia o padrão “KPI + gráfico + tabela” em vez de revelar decisões próprias da igreja.

O DS também é mais um contrato declarado do que uma linguagem efetivamente única: várias rotas usam `PageHeader`/primitivos, mas outras usam diretamente `.page-header`, `.card`, `.btn`, `.table`, selects nativos e componentes fora de `components/ds`. Isso enfraquece tanto a consistência quanto a promessa de “Balcão de Acolhimento”. A direção não precisa ficar mais decorada; precisa fazer as regras e os percursos da igreja moldarem a composição, a hierarquia e os feedbacks.

## Design Health Score — heurísticas de Nielsen

| # | Heurística | Score | Evidência principal |
|---|---|---:|---|
| 1 | Visibilidade do estado do sistema | **2/4** | Há `loading` em vários submits, breadcrumbs, badges e erros inline, mas não há estado de carregamento compartilhado para navegação/listas; há ações sem efeito visível (`Exportar resumo`, busca global, paginação) e redirects sem confirmação de sucesso. |
| 2 | Compatibilidade entre sistema e mundo real | **3/4** | “Membros”, “células”, “visitantes”, “dízimos”, “caixas” e “discipulado” são termos adequados ao domínio. Ainda há mistura de “caixa” com “conta bancária”, labels técnicos/abstratos e inconsistência de copy (`Transferencias` sem acento). |
| 3 | Controle e liberdade do usuário | **2/4** | Existem cancelar, voltar, Escape no drawer/modal canônico e confirmação para exclusão. Faltam undo, recuperação após redirects, filtros com atualização previsível, controle da busca global e modais customizados sem foco/saída padronizados. |
| 4 | Consistência e padrões | **1/4** | O app alterna DS, classes legadas (`.card`, `.btn`, `.page-header`), markup nativo e componentes antigos; logout, menus de usuário, cards, tabs e formulários não seguem uma única composição. |
| 5 | Prevenção de erros | **2/4** | Zod/server validation, limites de saldo, idempotência e confirmação de exclusão são bons guardrails. Porém, alguns controles visuais não declaram `required`, existem decisões condicionais pouco transparentes, e dados inválidos de filtro podem virar uma lista vazia silenciosamente. |
| 6 | Reconhecimento em vez de lembrança | **2/4** | Labels, breadcrumbs, chips, autocomplete e valores de caixa ajudam. Em contraste, a navegação expandida expõe muitas opções, a sidebar colapsada depende de tooltip/title, `⌘ K` promete uma capacidade inexistente e detalhes importantes ficam em várias abas/rotas. |
| 7 | Flexibilidade e eficiência de uso | **1/4** | Há grid/lista em membros e alguns filtros, mas não há atalho funcional para `⌘ K`, ações em lote, favoritos, bulk edit ou caminho rápido para rotinas administrativas repetitivas. |
| 8 | Estética e design minimalista | **2/4** | Paleta restrita, espaçamento e superfícies são relativamente sóbrios. O dashboard financeiro acumula KPIs, gráfico, donut, cards de caixas, tabs, tabela e paginação, enquanto o formulário de membro exibe muitos cards e estados simultaneamente; a composição parece montada por padrão de categoria. |
| 9 | Reconhecer, diagnosticar e recuperar de erros | **2/4** | Há mensagens em português, preservação de valores em diversos forms e `role="alert"`. Ainda há toast apenas para o primeiro erro em alguns caminhos, `ErrorBoundary` genérico, clipboard sem tratamento de falha e falta de orientação consistente após sucesso. |
| 10 | Ajuda e documentação | **1/4** | Hints e descrições pontuais existem, mas não há ajuda contextual pesquisável, glossário para decisões financeiras/discipulado, orientação para a primeira rotina ou suporte dentro do fluxo. |
| **Total** |  | **18/40** | **45% — faixa Poor; mudanças substanciais antes de considerar a experiência madura.** |

## Carga cognitiva

**Resultado: 6 de 8 itens falham — carga alta.** O problema não é a complexidade inerente da administração de uma igreja; é a quantidade de decisões simultâneas, padrões concorrentes e promessas não cumpridas.

| Item | Resultado | Leitura do código |
|---|---|---|
| Foco único | **Falha** | O dashboard combina saudação, exportação, quatro KPIs, fluxo de caixa, cultos e contribuições; o usuário entende o panorama, mas não qual decisão merece atenção primeiro. O financeiro repete o padrão e adiciona filtros/tabs/paginação. |
| Chunking (até 4 itens por grupo) | **Falha** | A listagem de membros exibe busca + tipo + ministério + discipulador + troca de visualização, além de ações de exportar/novo. O formulário de membro distribui muitas decisões em vários blocos, mas todas ficam presentes na mesma página. |
| Agrupamento | **Passa** | Cards e seções agrupam dados relacionados razoavelmente bem, sobretudo em `FormCelula` e no detalhe da célula. O ganho é perdido quando a mesma tela mistura primitives DS e classes visuais legadas. |
| Hierarquia visual | **Falha** | Classes antigas e DS convivem; KPIs e cards recebem pesos semelhantes; no financeiro, números e filtros parecem funcionais mesmo quando são demonstrativos/fixos. |
| Uma coisa por vez | **Falha** | `FormMembro` mostra “1 Dados pessoais / 2 Dados eclesiásticos / 3 Vínculos”, mas não é um wizard: os blocos de pessoais, contato, vinculação, endereço e histórico aparecem juntos. Isso pede leitura, preenchimento e navegação mental simultâneos. |
| Escolhas mínimas (até 4) | **Falha** | A navegação desktop expõe 7 grupos e cerca de 16 destinos; o formulário financeiro legado apresenta 7 categorias; o cadastro de membro oferece 5 cargos. A organização por grupos ajuda, mas não reduz o número de alternativas no ponto de decisão. |
| Memória de trabalho | **Passa com ressalva** | Labels, breadcrumbs e filtros preservados reduzem a necessidade de lembrar contexto; no detalhe de membro o cabeçalho permanece. Ainda há ponte de memória ao alternar abas/rotas para discipulado e ministérios. |
| Divulgação progressiva | **Falha** | Algumas condições financeiras escondem membro/status corretamente, mas o formulário de membro não segue os três passos que anuncia; a maioria das informações administrativas fica aberta de uma vez. |

### Pontos de decisão com mais de quatro opções

- **Navegação:** 7 grupos visíveis no desktop e aproximadamente 16 destinos; “Dashboard” aparece em Principal e novamente em Financeiro.
- **Filtros de membros:** busca, tipo, ministério, discipulador, limpar filtros e grid/lista ficam no mesmo ponto de decisão.
- **Financeiro:** no `FormLancamento`, o select de categoria expõe sete categorias; na rota nova há três categorias por tipo, mas ainda sem uma explicação de consequência antes da escolha.
- **Membro:** o select de cargo tem cinco papéis administrativos; o formulário também combina tipo, status, grupo/célula, discipulador, endereço e datas na mesma passagem.

## Percurso emocional

- **Entrada:** o login é acolhedor e específico no copy (“Cuide da casa. Acompanhe a jornada.”), com linguagem de propósito e um caminho claro para entrar. O snapshot local confirma uma estrutura simples de e-mail, senha, lembrar-me e entrar. Isso é um bom primeiro contato, embora a existência de dois tratamentos de autenticação no código reduza a consistência.
- **Primeiro ganho:** dashboard, estados vazios de membros/células e badges de status dão sensação de ordem. O usuário consegue reconhecer “visitante”, “membro”, “célula ativa”, “pendente” e “caixa”.
- **Vales:** a carga cresce quando a pessoa precisa filtrar, cadastrar ou registrar dinheiro. O formulário de membro parece um cadastro de várias etapas, mas não permite concluir uma etapa por vez. O financeiro apresenta números que o código mantém fixos ou ações que não têm comportamento associado; isso transforma uma tela que deveria tranquilizar em uma fonte de dúvida.
- **Momentos de alto risco:** excluir membro/célula, arquivar caixa, transferir valores e registrar dízimo exigem confirmação, contexto e recibo claros. Há `window.confirm` em alguns fluxos e validação server-side, mas a confirmação é nativa, sem resumo estruturado, e o sucesso normalmente termina em redirect sem recibo visual consistente. No convite de membro, o modal customizado não declara `role="dialog"`, não prende/restaura foco e não trata falha do clipboard.
- **Fim da tarefa / peak-end:** o melhor fim seria “salvo, onde foi salvo, qual regra foi aplicada e o que posso fazer agora”. Hoje o usuário geralmente recebe apenas a mudança de rota. O redirect de transferência inclui `?transferencia=ok`, mas não há evidência no dashboard lido de que esse parâmetro resulte em uma mensagem de sucesso; o formulário de novo lançamento também redireciona para o caixa sem confirmação explícita.
- **Reasseguramento desejado:** após lançamento/transferência/exclusão, mostrar recibo com valor, caixa de origem/destino, status, timestamp e próximo passo; em exclusões bloqueadas, explicar a dependência que impede a ação e linkar para resolvê-la. Em celular, manter a ação primária e o estado de envio visíveis sem obrigar o usuário a caçar o topo da tela.

## O que está funcionando — pontos fortes específicos

1. **Base visual semântica bem intencionada.** `app/app.css` define tokens OKLCH para acento, estados, superfícies, bordas e dark mode; `Button`, `Input`, `Select`, `Card`, `EmptyState`, `Tabs` e `Table` reutilizam tokens e têm foco visível. Isso é uma fundação adequada para consistência real.
2. **Vocabulário e dados reconhecem o domínio da igreja.** O dashboard e as rotas usam visitantes, cultos, células, discipulado, ministérios, dízimos, ofertas, caixas e escalas, em vez de apenas “clientes”, “projetos” e “contas”. O detalhe de célula, em especial, conecta líder, participantes, agenda e capacidade numa leitura útil.
3. **Há esforço concreto de acessibilidade e proteção operacional.** O root usa `lang="pt-BR"`, o shell oferece skip link, a navegação mobile implementa Escape, contenção de foco, lock de scroll, `inert` no conteúdo de fundo e restauração do foco; formulários usam labels associados, `aria-invalid`, `role="alert"` e estados de submit em vários pontos. O problema é a cobertura irregular, não a ausência de intenção.

## Findings numerados

### 1. [HIGH] A camada financeira comunica dados que o código não sustenta

**Onde:** `app/routes/app/financeiro._index.tsx`, principalmente `donutPercent`, KPIs de variação, “Setembro”, “R$ 27,6k”, tabs e paginação.

**Problema:** o donut usa proporções fixas de 38/25/18/19 e um total fixo; “Entradas do mês” e “Saídas do mês” mostram `▲ 12%` e `▲ 5%` sem variação calculada; a tab `approved` retorna os mesmos lançamentos recentes e `pending`/`rejected` retornam listas vazias; os botões de páginas não têm navegação. O botão “Exportar resumo” não tem ação associada. Em um ERP administrativo, um número demonstrativo com aparência de dado real é mais grave que um espaço vazio.

**Correção concreta:** calcular categorias, período e variações no loader a partir da mesma fonte dos lançamentos; renderizar o donut somente com dados reais e, sem dados, usar `EmptyState`/“Sem movimentações no período”; implementar filtros por status e paginação real via query/service ou remover os controles; tornar exportação funcional ou retirar o CTA. Repetir a regra na listagem de células: `Células Ativas` deve contar `status === "ATIVA"`, não `celulas.length`.

### 2. [HIGH] O produto tem dois sistemas visuais concorrentes

**Onde:** shell e rotas como `app/routes/app/_index.tsx`, `financeiro._index.tsx`, `membros.$id.tsx`, `FormMembro.tsx`, `FormLancamento.tsx`, além de `app/app.css`.

**Problema:** o DS determina `PageHeader → Section → Card`, mas o dashboard e o financeiro usam `.page-header`, `.card`, `.kpi`, `.btn`, `.table`, `.tabs`; o detalhe de membro e vários forms usam cards e selects nativos; há componentes fora de `components/ds` e referências a componentes legados. A mesma ação pode ter tamanhos, focus rings, radius, sombra e feedback diferentes. Isso impede que a equipe aprenda um padrão e deixa a interface com aparência de partes coladas.

**Correção concreta:** escolher `app/components/ds` como única camada de composição; migrar primeiro shell, dashboard, financeiro, membros e células para `PageHeader`, `Section`, `Card`, `KpiCard`, `Table`, `Tabs`, `Button`, `Field`, `Input`/`Select`/`Textarea` e `FormFooter`; eliminar ou encapsular `.card/.btn/.kpi` legados depois de cada rota migrada; bloquear novas classes de scaffold fora dos primitivos. Não criar mais variantes locais para compensar a divergência.

### 3. [HIGH] A arquitetura expõe decisões demais e simula um wizard que não existe

**Onde:** `Sidebar.tsx`, `membros._index.tsx`, `FormMembro.tsx` e `app/app.css` (`member-form-stepper`, `filter-bar`).

**Problema:** desktop mostra 7 grupos e cerca de 16 destinos, com dois “Dashboard”; a lista de membros soma quatro filtros, limpar filtros, duas ações de página e grid/lista; o cadastro mostra três etapas, mas todas as seções continuam abertas. O usuário administrativo precisa montar um mapa mental do produto e manter muitas decisões em memória, especialmente no celular.

**Correção concreta:** reduzir a navegação a no máximo cinco grupos de primeiro nível e agrupar “Agenda + equipes”/“Administração” com disclosure explícito; manter Financeiro como uma área única com submenu próprio; remover o segundo Dashboard. No membro, implementar de fato três passos (Dados pessoais → Eclesiásticos → Vínculos), com resumo do que já foi salvo, ou remover o stepper e trocar por seções com índice e âncoras honestas. Em filtros, deixar busca e tipo visíveis, mover ministério/discipulador para “Mais filtros” e manter “Limpar filtros” sempre próximo do resumo dos filtros ativos.

### 4. [MEDIUM] O sistema promete feedback/recuperação onde só há aparência

**Onde:** `TopbarAutenticada.tsx`, `membros._index.tsx`, `membros.novo.tsx`, rotas de forms e `app/routes/app.tsx`.

**Problema:** o campo “Buscar pessoas, lançamentos...” e o `⌘ K` do topbar apenas atualizam `query`; não existe busca, command palette ou submissão. Em membros, query inválida cai em lista vazia sem `ErrorAlert`. Muitos loaders não exibem skeleton/pending state. Alguns errors aparecem como toast do primeiro erro, enquanto outros chegam ao ErrorBoundary genérico. Após sucesso, redirects não deixam claro o que foi salvo.

**Correção concreta:** implementar busca global com atalho real, resultados e estado “nenhum resultado”, ou retirar campo e `⌘ K`; para query inválida, normalizar parâmetros com mensagem recuperável ou devolver erro 400 explícito; criar um estado pending compartilhado no shell e skeletons por superfície; preservar todos os valores e focar o primeiro campo inválido; usar uma confirmação pós-redirect (`toast`/banner com `aria-live`) que inclua entidade e próximo passo.

### 5. [MEDIUM] Ações irreversíveis e modais customizados não têm um padrão de segurança emocional

**Onde:** modal de convite em `membros.novo.tsx`, modais no detalhe de membro, `window.confirm` em membro/célula/avatar e fluxos financeiros.

**Problema:** o produto trata cadastro, convite, exclusão, arquivamento e transferência com mecanismos diferentes. O modal de convite usa overlay e `div` sem semântica de diálogo, sem Escape/focus trap/restauração; a cópia para clipboard não tem fallback nem mensagem de erro. `window.confirm` não consegue resumir entidade, impacto e regra de bloqueio. O usuário pode concluir uma ação de dinheiro e não receber recibo contextual.

**Correção concreta:** usar um único `Dialog`/`Modal` DS com `role="dialog"`, título, descrição, foco contido, Escape, cancelamento e `aria-live`; substituir confirmação nativa por diálogo que mostre “de onde → para onde”, valor, saldo pós-operação ou dependência bloqueadora; tratar clipboard com `try/catch`, fallback manual e estado “Copiado/Não foi possível copiar”; depois do submit, mostrar recibo e ação seguinte.

### 6. [MEDIUM] A versão mobile perde contraste de marca e prioridade operacional

**Onde:** `MobileNavigation.tsx`, `TopbarAutenticada.tsx`, filtros/formulários e regras responsivas de `app/app.css`.

**Problema:** o drawer mobile usa `bg-surface` com título `text-white` e borda `border-fg`, ao mesmo tempo em que o desktop usa marca e tokens diferentes; isso pode produzir contraste inadequado no tema claro. O menu mobile passa `collapsed`, portanto continua dependendo da descoberta por ícone/title. Formulários longos posicionam ações no final e não preservam uma área de ação fixa para uso interrompido no celular.

**Correção concreta:** trocar título/borda por `text-fg`/`border-border`, manter a mesma marca e labels no drawer mobile, e renderizar grupos com labels visíveis. Em forms longos, usar `FormFooter` responsivo/sticky apenas quando não ocultar conteúdo, manter “Salvar” e “Cancelar” com alvo mínimo de 44px e apresentar resumo de erro no topo com salto ao primeiro campo.

## Priority issues

### [P1] Verdade dos dados antes de ornamentação

- **Por que importa:** financeiro, células e dashboard são superfícies de decisão. Um gráfico fixo, uma variação inventada ou “células ativas” igual ao total pode levar a uma decisão administrativa errada e destrói confiança.
- **Correção:** derivar todos os números da fonte real; remover widgets sem dados; corrigir status/paginação/tabs; usar estados vazios honestos. A tela deve preferir “ainda não há dados para este período” a um cartão convincente com conteúdo demonstrativo.
- **Escopo:** compartilhado no dashboard/financeiro; `Células Ativas` é correção específica de `/app/celulas`.

### [P1] Uma única linguagem visual e comportamental

- **Por que importa:** a alternância entre DS, classes legadas e componentes nativos faz ações iguais parecerem diferentes, aumenta a curva de aprendizagem e impede que “Balcão de Acolhimento” seja reconhecível.
- **Correção:** migrar shell, dashboard, membros, células e financeiro para o catálogo DS; centralizar modal, tabs, cards, tabela, botões e feedback; remover classes duplicadas somente após a migração de cada rota.
- **Escopo:** compartilhado, não é defeito de uma página isolada.

### [P1] Reduzir o mapa mental e tornar o cadastro realmente progressivo

- **Por que importa:** secretaria/financeiro trabalham repetidamente; pastor/liderança usam celular e podem ser interrompidos. Muitos destinos, filtros e campos abertos tornam o erro e o abandono prováveis.
- **Correção:** limitar grupos de navegação, eliminar Dashboard duplicado, agrupar filtros avançados e escolher entre wizard real ou stepper removido. Preservar contexto, progresso e ação primária.
- **Escopo:** shell, `/app/membros`, `FormMembro` e formulários longos; não impor wizard a superfícies naturalmente curtas como `FormCelula`.

### [P1] Fechar o ciclo de estado: carregando → erro → sucesso

- **Por que importa:** em conexão lenta ou após uma ação de dinheiro, o usuário precisa saber se o sistema recebeu o comando. Silêncio e redirect genérico geram repetição de lançamento, suporte e desconfiança.
- **Correção:** pending/skeleton no shell e listas; validação perto do campo + resumo acessível; erros recuperáveis em português; toast/banner pós-redirect com entidade/valor; tratar busca, exportação e paginação sem controles falsos.
- **Escopo:** compartilhado em shell, forms e financeiro.

### [P2] Reforçar confiança em ações irreversíveis e no uso mobile

- **Por que importa:** excluir membro/célula, arquivar caixa e transferir dinheiro têm alto custo de erro; no celular, o alcance e a interrupção aumentam a vulnerabilidade.
- **Correção:** diálogo DS único, confirmação contextual, recibo pós-ação, foco e clipboard robustos; drawer mobile com tokens e labels, ações de form com área de toque adequada e resumo de erro.
- **Escopo:** compartilhado, com destaque para convite, detalhe de membro, células e financeiro.

## Red flags por persona

### Alex — secretaria/financeiro, usuário de alta frequência no desktop

- A navegação mostra muitos destinos e dois “Dashboard”; precisa reaprender onde fica cada rotina.
- O `⌘ K` parece um acelerador, mas não abre nada; o campo global só guarda texto localmente.
- Não há ações em lote na lista de membros, nem bulk edit/arquivamento, e o CSV usa apenas a página carregada.
- No financeiro, tabs, paginação e “Mais ações” têm aparência de operação, mas parte do comportamento está ausente ou incompleto; Alex perde confiança e contorna o sistema com planilha.

### Sam — pessoa que usa teclado/leitor de tela ou zoom

- O padrão de foco é bom em vários DS, mas não é uniforme: selects/inputs nativos e botões `.btn` convivem com primitives; o modal de convite customizado não declara diálogo nem prende foco.
- Indicadores visuais dependem de cor/ícone em vários pontos; estados devem manter texto, o que nem sempre acompanha badges e barras.
- A sidebar colapsada esconde labels e depende de `title`; no mobile, o drawer usa título branco em superfície e borda forte não semântica.
- Erros não têm sempre um resumo global com salto ao primeiro campo; toast apenas do primeiro erro dificulta diagnóstico linear.

### Casey — pastor/líder consultando e decidindo principalmente no celular

- O dashboard prioriza uma composição ampla de admin, não as próximas decisões pastorais; o usuário precisa atravessar KPIs, gráfico, cultos e contribuições.
- O formulário de membro é longo, com várias colunas/sections e ações no final; uma interrupção pode deixar claro apenas que existe um stepper, não quanto já foi concluído.
- O drawer é icon-first quando deveria preservar labels e agrupamento; a busca global fica escondida em `md` e não oferece alternativa útil no celular.
- Transferência e lançamentos terminam em redirect sem recibo contextual; em rede lenta, Casey pode não saber se deve repetir a operação.

## Observações menores

1. **[NIT]** `TopbarAutenticada.tsx` usa “Transferencias” sem acento no breadcrumb, enquanto o restante da interface está em português brasileiro.
2. **[NIT]** O drawer mobile escreve “IgrejaConnect”, enquanto sidebar/topbar usam “Igreja Conect”; a marca deve ter uma única grafia.
3. **[NIT]** `Sidebar.tsx` usa `chevron-right` como ícone de Transferências, menos reconhecível que um ícone de movimento/troca; o rótulo deve carregar a ação sem depender do símbolo.
4. **[NIT]** `EmptyState` de próximos cultos no dashboard não oferece caminho direto para criar/agendar um culto, apenas informa ausência.
5. **[NIT]** O botão de fechar do toast não tem um estilo/foco tão explícito quanto os primitives DS; o estado temporário também não comunica duração ou pausa.
6. **[NIT]** Há duas implementações conceituais de modal (`ds/Modal.tsx` e `Dialog.tsx`) e várias overlays manuais; mesmo que tecnicamente funcionem, a duplicidade torna a acessibilidade difícil de manter.
7. **[NIT]** O root error boundary usa um `<button>` com classes próprias, em vez de `Button`, e oferece “Voltar ao início” sem explicar se a operação anterior foi preservada.

## Verified Assumptions

- `app/root.tsx` realmente define `lang="pt-BR"`, tokens globais são carregados por `app/app.css` e há tema claro/escuro por atributo/preferência.
- `app/routes/app.tsx` compõe o shell com `Sidebar`, `MobileNavigation`, `TopbarAutenticada` e `<Outlet />`; há skip link no topbar para `#main-content`.
- `MobileNavigation.tsx` implementa Escape, contenção manual de Tab, lock de scroll e restauração do foco do gatilho; `app/routes/app.tsx` aplica `inert` ao fundo enquanto o drawer abre.
- A listagem de membros tem filtros por tipo/ministério/discipulador, alternância grid/lista, paginação, exportação CSV e estado vazio; o código mantém valores de filtro em query string.
- Células tem fluxos reais de criação, edição, detalhe, vínculo/desvínculo e exclusão, com labels de dia/status e estados vazios; o detalhe combina líder, agenda, participantes e capacidade.
- Fluxos financeiros fazem validação server-side e usam centavos; transferência tem chave de idempotência no cliente e validação de origem/destino/valor.
- O DS contém primitives para ações, cards, forms, tabs, tabelas, estados e modais, mas a implementação lida também com componentes e classes fora dele.
- Os arquivos locais `.playwright-mcp` disponíveis nesta leitura não são screenshots: dois são árvores estruturais e um está vazio; não constituem inspeção visual ao vivo.

## Unverified/Wrong Assumptions

- **Errada/parcial:** a regra documental de que toda rota autenticada começa com `PageHeader → Section → Card` não corresponde ao código. Dashboard/financeiro usam estruturas legadas; vários formulários e detalhes montam cards e headers diretamente.
- **Errada/parcial:** o DS não é a única fonte visual efetiva apesar de `AGENTS.md`/`SKILL.md` declararem essa regra. O código ainda usa `.card`, `.btn`, `.kpi`, `.table`, selects nativos e componentes fora de `app/components/ds`.
- **Errada:** o comentário do topbar descreve “search global” e atalho `⌘ K`, mas `TopbarAutenticada.tsx` apenas atualiza `query`; não há handler de tecla, rota de busca, resultados ou submissão.
- **Não comprovada:** não assumi que os snapshots locais representam a versão atual de cada rota; o snapshot de novo lançamento mostra estrutura plana distinta do código atual e foi tratado como evidência potencialmente desatualizada.
- **Não comprovada:** não assumi que redirects com query (`?transferencia=ok`) geram toast/banner. No código lido não há consumidor visível desse estado no dashboard.
- **Não comprovada:** não assumi suporte offline/conexão fraca, porque `PRODUCT.md` registra esse ponto como em aberto.
- **Stale:** `app/AGENTS.md` descreve `<html lang="en">`, mas o source atual está em `pt-BR`; o documento de contexto precisa ser atualizado, sem usar o texto stale como evidência de runtime.

## Perguntas provocativas

1. **Se o sistema fosse realmente um “Balcão de Acolhimento”, qual seria a próxima decisão de uma secretária ao abrir o dashboard — e por que hoje ela recebe quatro KPIs, um gráfico, cultos e contribuições com o mesmo peso?**
2. **O gráfico financeiro precisa existir quando os dados ainda não existem?** O que gera mais confiança: um donut bonito com valores fixos ou “Nenhuma movimentação no período” com um CTA real para registrar o primeiro lançamento?
3. **O stepper de três etapas é uma promessa de foco ou apenas um adorno?** Se o usuário continua vendo tudo, que decisão concreta justifica três etapas?
4. **Qual é a única ação primária em cada superfície?** Em membros, financeiro e detalhe de célula, o sistema consegue responder isso sem contar links secundários, filtros e botões de ação?
5. **Quais termos são verdadeiramente eclesiásticos e quais são apenas copy sobre um CRUD genérico?** Células, visitantes, discipulado e dízimos deveriam mudar a arquitetura da tela, não somente os labels.
6. **Depois de transferir R$ 500 entre caixas, qual prova o usuário leva consigo?** Se a resposta for apenas “a URL mudou”, o produto está pedindo confiança sem entregar confirmação.

## Veredicto da revisão

**CHANGES_REQUESTED.** Há achados HIGH e MEDIUM em verdade dos dados, consistência do DS, arquitetura de informação, feedback e ações irreversíveis. A base é aproveitável, mas a próxima iteração deve priorizar confiança operacional e redução de carga cognitiva antes de novo polimento decorativo.
