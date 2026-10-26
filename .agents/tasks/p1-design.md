# Design/Plano — Primeira fase dos quatro P1 de `/app`

## Status e contexto

Esta é a primeira iteração do documento: `.agents/tasks/p1-design-review.json` e `.agents/tasks/p1-design-review.md` não existem no workspace. Portanto, não há achados HIGH/MEDIUM de revisão anterior a incorporar.

A superfície é **Operate**: um ERP administrativo para uma única igreja, usado principalmente por secretaria/financeiro no desktop e por pastor/liderança no celular. O objetivo desta fase é aumentar confiança operacional sem trocar identidade, copy, regras de negócio ou arquitetura. Este documento é plano de implementação; não inclui código de aplicação, alteração de Prisma ou migração de domínio.

A stack fica fechada como existente: React 19, React Router 7.16 em SSR, TypeScript strict, Prisma 7.8 com SQLite, Tailwind v4 e tokens semânticos de `app/app.css`; os primitivos são os de `app/components/ds/`. RBAC continua centralizado em `app/lib/rbac.server.ts`, com defesa UI → loader/action → service. Valores financeiros continuam sendo `Int` em centavos.

## Evidência que orienta o plano

A inspeção encontrou os seguintes contratos reais:

- `getDashboardData` (`app/lib/dashboard.server.ts`) já calcula membros, visitantes, alertas, caixas, fluxo de seis meses e variações; o dashboard ainda expõe classes legadas e uma ação `Exportar resumo` sem action/loader.
- `getDashboardFinanceiro` (`app/lib/finance.server.ts`) já entrega caixas ativos, saldo agregado e lançamentos recentes. A rota `financeiro._index.tsx` ainda faz agregações diretas, usa `▲ 12%`, `▲ 5%`, percentuais de donut fixos e `R$ 27,6k`, além de tabs e paginação que não consultam o estado selecionado.
- O enum/contrato real de status de lançamento é `PAGO | PENDENTE | AGENDADO` (`app/lib/schemas/lancamentos.ts`); não existe `REJEITADO`. A UI atualmente transforma qualquer outro estado em “Rejeitado”, o que é falso.
- `listarCelulas` retorna `status` e `totalMembros` para toda a lista. `/app/celulas` imprime `celulas.length` tanto para “Total” quanto para “Células Ativas”, sem filtrar `status === "ATIVA"`.
- `app/routes/api/search.ts` só implementa autocomplete por `type=celulas` ou `type=members`; não existe contrato de busca global. `TopbarAutenticada` mantém uma string local e exibe `⌘ K`, mas não executa busca nem abre palette.
- Relatórios têm services reais e exportações CSV, mas várias telas ainda exibem ações sem contrato (`Histórico de Geração`, PDF, e-mail, agendamento, documento anual e “Ver mais dicas”). Os services de relatórios recebem `user`, mas as consultas devem continuar sob a proteção do RBAC canônico.
- O shell compartilha a configuração de navegação entre desktop e mobile, mas a drawer mobile chama `NavigationContent` com `collapsed`, escondendo justamente os rótulos que ajudam o uso em movimento. Há também dois destinos rotulados “Dashboard”: `/app` e `/app/financeiro`.
- Não há um primitivo DS de skeleton/pending catalogado. Já existem `Button.loading`, `EmptyState`, `ErrorAlert`, `Dialog`, `Modal`, `Tabs`, `Table`, `PageHeader`, `Section`, `Card`, `KpiCard`, `FormSection` e `FormFooter`.

## Princípios e limites

1. Corrigir primeiro dados falsos, estados e affordances sem contrato; nenhuma mudança visual deve mascarar ausência de dados.
2. Não criar dados demonstrativos, status, percentuais, claims financeiros ou endpoints implícitos. Quando não houver contrato, remover a ação ou apontar para uma rota existente cujo comportamento seja claro.
3. Não alterar `prisma/schema.prisma`, migrations, matriz RBAC, `docs/REGRAS_DE_NEGOCIO.md` ou modelo financeiro. Qualquer nova consulta usa os models/services existentes.
4. Usar `app/components/ds/`; não usar `app/components/_old/`. Cores literais Tailwind e estilos locais equivalentes ficam fora dos endpoints P1; exceções internas dos próprios primitivos não serão reescritas em cada tela.
5. Preservar rótulos de domínio, URLs e fluxos válidos. Uma rota só pode deixar de aparecer quando a mesma operação já existir em uma rota clara e autorizada; neste P1, a regra geral é manter todas as rotas.
6. Auditoria/log não deve conter valor financeiro, descrição, nome, telefone, e-mail ou outro PII. Falhas esperadas de validação não geram ruído no log; falhas inesperadas ficam apenas no servidor, sem payload sensível.

## P1-A — Verdade dos dados e ações críticas

### A1. Contrato canônico do dashboard geral

**Arquivos:** `app/routes/app/_index.tsx`, `app/lib/dashboard.server.ts` e testes correspondentes.

Manter `getDashboardData` como fonte do `/app`; não duplicar queries no componente. O loader deve preparar também o texto de data exibido no cabeçalho a partir do mesmo instante de referência da resposta. O componente não deve chamar `new Date()` para decidir o conteúdo do primeiro render. A investigação do hydration mismatch será feita com SSR/hydration sob relógio fixado, incluindo virada de dia/ano e timezone do processo:

- se o mismatch for reproduzido e vier da data dinâmica do dashboard, o loader retornará `dataReferenciaLabel` já formatado em `pt-BR` e o cliente apenas o exibirá;
- se o mismatch não for reproduzido ou vier de outra origem, não haverá “correção” especulativa em `root.tsx` nem mudança de timezone de negócio;
- o `<title>` SVG do gráfico continuará baseado somente nos números serializados pelo loader, com formatação determinística.

A ação `Exportar resumo` será removida do dashboard nesta fase. Não há action de resumo, nem contrato de download específico; não é permitido fingir que o botão exporta. Para perfis autorizados a relatórios, o acesso à exportação continua disponível dentro da rota real de relatório customizado, sem transformar o dashboard em um novo endpoint. Não renderizar link para relatório ao SECRETARIO, pois o contrato de `assertCanSeeRelatorios` o bloqueia.

### A2. Dashboard financeiro com dados reais

**Arquivos:** `app/lib/finance.server.ts`, `app/routes/app/financeiro._index.tsx`, possivelmente `app/lib/schemas/relatorios.ts` para filtros compartilhados, e testes de service/rota.

Escolha: estender o contrato de `getDashboardFinanceiro`, em vez de manter agregações diretas na rota. A função deverá aceitar filtros de listagem validados (`status`, `page`, `pageSize`) e retornar, além dos dados existentes:

```text
periodo atual: início, fim e rótulo
kpis: saldo agregado, caixas ativos, entradas do período, saídas do período,
      pendências e variações em relação ao período anterior
distribuicaoPorCategoria: categoria, valorCentavos, percentual e tone semântico
lancamentos: items, total, page e pageSize
```

O loader de `financeiro._index.tsx` valida a URL e chama somente esse service. A filtragem continua obedecendo o contrato existente: `assertCanSeeFinancialModule` no loader/action e revalidação no service; o filtro de DÍZIMO para SECRETARIO permanece aplicado onde hoje a UI não pode expor o histórico detalhado. Não ampliar acesso a dízimos, nem usar uma consulta nova que contorne `rbac.server.ts`.

Os KPIs terão as seguintes regras:

- **Saldo total:** soma do `saldoCentavos` dos caixas `ativo: true`, pelo mesmo contrato já usado pelo dashboard financeiro.
- **Entradas/Saídas:** soma real do tipo correspondente no mês corrente, com a mesma visibilidade do usuário.
- **Pendências:** contagem real de lançamentos `PENDENTE`, nunca uma categoria visual inventada.
- **Variação:** `(atual - anterior) / anterior * 100`, arredondada para inteiro somente na apresentação. Se o período anterior for zero ou não existir, o service retorna `null`; a UI exibe “sem base comparável”, sem imprimir 0% ou uma seta que sugira um fato inexistente.
- Valores e datas usados nos cards precisam ser derivados do retorno do service; nenhum número de exemplo permanece em JSX.

A distribuição do donut/legenda será agregada por categoria no período atual usando os lançamentos visíveis. Percentuais devem ser derivados dos valores e a última fração visual deve fechar deterministicamente em 100% após arredondamento. Sem movimentos, não haverá donut vazio com “0%”: usar `EmptyState` com “Nenhuma movimentação no período”. Cores de categorias serão mapeadas para tones/tokens semânticos; não serão introduzidas cores literais nem nova paleta.

### A3. Status, paginação e exportação financeiros

As tabs do dashboard serão dirigidas pelo contrato do banco:

- `Todos` → sem filtro;
- `Aprovados` → `status=PAGO`;
- `Pendentes` → `status=PENDENTE`;
- `Agendados` → `status=AGENDADO`.

A tab “Rejeitados” será removida, não renomeada silenciosamente: `REJEITADO` não existe na fonte real. A URL usará os valores do enum, não `approved/pending/rejected` soltos. Alterar a tab ou a página atualiza a URL, reexecuta o loader e preserva o filtro; a contagem exibida corresponde ao `total` daquela consulta, não somente aos seis registros recentes. `page`/`pageSize` inválidos voltam para valores seguros (`1`/padrão) com mensagem recuperável quando a entrada foi descartada.

A paginação será funcional, com links ou `Button as={Link}` que preservem `status` e demais filtros. A tabela usará `Table`/`TableWrap`; ação “Mais ações” só será renderizada se houver action real para ela. Como não existe action no dashboard para alterar um lançamento, essa affordance será removida ou substituída pelo link existente para o detalhe do lançamento.

A exportação permanece nas actions CSV já existentes de `app/routes/app/financeiro.relatorios.customizado.tsx` e dos relatórios. No dashboard, não haverá “Exportar resumo” sem contrato. No hub e relatórios, ações de PDF/e-mail/agendamento/histórico/documento sem action serão removidas ou viram texto não interativo; o CSV existente continua sendo um download real. Antes de usar `exportarLancamentosCSV`, o mesmo conjunto de filtros exibido na tela deve ser enviado e validado.

### A4. Correção de “Células Ativas”

**Arquivo:** `app/routes/app/celulas._index.tsx`; teste da rota/componente.

O valor será `celulas.filter((celula) => celula.status === "ATIVA").length`, usando os status de `app/lib/schemas/celulas.ts`. O total de membros continuará somando `totalMembros` da lista real. A implementação não alterará `listarCelulas`, schema ou status de domínio. Cards sem dados continuam distinguindo lista vazia de erro do loader.

### A5. Busca global e `Cmd K`

**Arquivo:** `app/components/TopbarAutenticada.tsx`, possivelmente `app/app.css` para remover estilos órfãos.

Como não há endpoint/contrato global, o campo de busca e a indicação `⌘ K` serão removidos do shell P1. Não será criada command palette local, nem fetch genérico que consulte o banco sem RBAC. Os autocompletes já existentes de `AutocompleteInput` continuarão usando `/api/search?type=celulas|members`, pois têm contrato próprio. A retirada é explícita e honesta, e entra como backlog separado caso a busca global seja aprovada com escopo, RBAC e destino de resultados.

## P1-B — Uma única linguagem visual

### Estratégia de migração

A migração é por concentrador, não por substituição global de strings. Primeiro cada consumidor passa a DS; somente depois os seletores correspondentes são removidos de `app/app.css`. Classes legadas ainda usadas por landing, auth ou módulos fora do P1 permanecem. Em cada lote será verificado que não há dependência em `app/components/_old/`.

### Shell e navegação

**Arquivos:** `app/components/Sidebar.tsx`, `app/components/MobileNavigation.tsx`, `app/components/TopbarAutenticada.tsx`, `app/routes/app.tsx`, `app/app.css`.

- Preservar `NAV_GROUPS` como configuração única para desktop/drawer e todos os `roles`, URLs e badges de alerta.
- Trocar composição local de botões/contadores por `Button`/`IconButton`/`Badge` quando equivalente; links continuam links, não botões de ação.
- Remover `btn`, sombras e cores literais locais do shell depois de migrados para tokens.
- A drawer mobile chamará o conteúdo expandido (`collapsed={false}`), mantendo o foco preso, Escape, restauração de foco e lock de scroll já existentes. Isso corrige mapa mental sem esconder rótulos.
- O rótulo do destino `/app/financeiro` será “Visão financeira” (ou “Resumo financeiro” se a copy aprovada preferir), e o `/app` continuará sendo o único “Dashboard” principal. Nenhuma rota é removida.
- O menu do usuário não apresentará “Meu perfil” e “Preferências” apontando falsamente para `/app/config/acolhimento`. Manter uma entrada “Configurações” para a rota existente e “Sair”; perfil/preferências ficam fora até terem rotas reais.
- Corrigir “Transferencias” para “Transferências” no mapa de breadcrumbs.

### Dashboard geral e financeiro

**Arquivos:** `app/routes/app/_index.tsx`, `app/routes/app/financeiro._index.tsx`, `app/app.css`.

Usar `PageHeader`, `Section`, `Card`, `CardHeader`, `CardBody`, `KpiCard`, `Badge`, `EmptyState`, `Table`, `TableWrap`, `Tabs`, `TabList`, `TabPanel` e `Button` conforme equivalência já presente. O gráfico SVG/donut pode continuar sendo visualização específica, mas recebe apenas dados reais e tokens CSS semânticos; não será criado um “CardChart” novo. Preservar copy, links válidos, ordem dos dados e responsividade, trocando apenas wrappers, foco, raio, espaçamento e tokens.

### Financeiro e relatórios

**Arquivos:**

- `app/routes/app/financeiro.caixas._index.tsx`
- `app/routes/app/financeiro.caixas.$id.tsx`
- `app/routes/app/financeiro.lancamentos.novo.tsx`
- `app/routes/app/financeiro.lancamentos.$id.tsx`
- `app/routes/app/financeiro.transferencias._index.tsx`
- `app/routes/app/financeiro.transferencia-nova.tsx`
- `app/routes/app/financeiro.transferencias.$id.tsx`
- `app/routes/app/financeiro.relatorios._index.tsx`
- `app/routes/app/financeiro.relatorios.dre.tsx`
- `app/routes/app/financeiro.relatorios.balancete.tsx`
- `app/routes/app/financeiro.relatorios.fluxo-caixa.tsx`
- `app/routes/app/financeiro.relatorios.customizado.tsx`
- `app/components/financeiro.transferencia.tsx`, `CaixaHeader.tsx`, `TabelaCaixas.tsx`, `ExtratoCaixa.tsx`, `ExtratoFiltros.tsx` somente onde a inspeção confirmar consumidores legados.

Migrar headers, filtros, cards, KPIs, tabs, tabelas, ações e formulários para o DS. Inputs/selects/textareas nativos estilizados localmente viram `Input`, `Select`, `Textarea` ou `Field` quando a API cobrir o caso; `MoneyInput` continua especializado, envolvido por `Field` quando necessário. Breadcrumbs passam a usar os primitivos de breadcrumb. Projeções existentes só podem ser rotuladas como estimativa baseada no histórico real que o service usa; não serão chamadas de previsão garantida.

`app/lib/relatorios.server.ts` continuará sendo a fonte dos relatórios e CSV, mas suas funções públicas serão protegidas pelo mesmo `assertCanSeeRelatorios` ou por uma camada equivalente centralizada, sem alterar a matriz. Os filtros de relatório devem usar um schema compartilhado, com datas válidas e `dataInicio <= dataFim`. Não serão criadas exportações PDF, e-mail ou agendamento nesta fase.

### Membros e células

**Arquivos:** `app/routes/app/membros._index.tsx`, `app/components/TabelaMembros.tsx`, `app/components/CardMembro.tsx` se ainda houver consumidor, `app/components/FormMembro.tsx`, `app/routes/app/membros.novo.tsx`, `app/routes/app/membros.$id.editar.tsx`, `app/routes/app/celulas._index.tsx`, `app/app.css`.

A lista de membros usará `PageHeader`, `KpiCard`, `Card`, `Input`, `Select`, `Segmented`/`IconButton`, `EmptyState` e `Pagination` com tokens. `TabelaMembros` usará `Card`, `Avatar`, `Badge`, `Chip`, `Table`/composição equivalente; não será introduzido um novo card de membro. A exportação client-side da página atual será removida enquanto não houver contrato de exportação completo para filtros/paginação; não anunciar “CSV” que pode omitir registros.

`FormMembro` será composto com `Card`, `FormSection`, `FormGrid`, `Field`, `Input`, `Select`, `Textarea` e `FormFooter`. O upload, autocomplete, máscaras, copy e regras do service permanecem. Classes `.member-*`, `.filter-*`, `.card`, `.btn`, `.kpi` e afins só serão retiradas do CSS quando todos os consumidores P1 confirmarem a migração.

## P1-C — Redução conservadora do mapa mental

### Navegação

A estrutura escolhida reduz grupos sem esconder destinos:

- item superior de **Dashboard** (`/app`), fora de grupo redundante;
- **Pessoas:** Membros e Visitantes;
- **Comunidades:** Células e Ministérios;
- **Agenda:** Eventos e Escalas;
- **Operações:** Estoque e Patrimônio;
- **Financeiro:** Visão financeira, Lançamentos, Caixas, Transferências e Relatórios;
- **Administração:** Alertas e Configurações.

A relação Comunidades–Células/Ministérios é comprovada pelo domínio: ambos organizam pessoas/equipes e já se conectam a membros. Os destinos, URLs e gates `roles` permanecem; apenas o agrupamento e os rótulos são ajustados. O menu mobile usa os mesmos itens expandidos.

### Filtros de membros

Busca textual e tipo permanecem visíveis como controles primários. Ministérios e discipuladores vão para um `<details>` nativo rotulado “Mais filtros”, sem criar command palette ou novo componente de disclosure. O resumo mostra quantos filtros avançados estão ativos; “Limpar filtros” remove todos e volta para `/app/membros`. Todos os filtros continuam sendo query params validados pelo loader, com `page=1` ao mudar qualquer filtro.

A busca deve usar o `<Form method="get">` existente e os controles DS, não `window.location.href`; isso mantém histórico, SSR, acessibilidade e preservação de valores. Se um parâmetro inválido for descartado, a UI informa o ajuste e não apresenta a lista vazia como se não houvesse membros.

### Cadastro de membro

Decisão: **página única com índice/âncoras**, não wizard real e não “cadastro básico agora, vínculos depois”. A decisão é inferível do código: a action e os schemas já exigem/aceitam o payload completo em uma submissão, não existe armazenamento de rascunho, e o `FormMembro` hoje mostra todas as seções abertas apesar do stepper.

Remover o stepper que promete progressão. No lugar, apresentar um índice local com âncoras e seções nomeadas:

1. Dados pessoais e contato;
2. Dados eclesiásticos e acesso;
3. Vínculos (grupo/célula e discipulador);
4. Endereço e histórico de leitura.

As seções continuam no mesmo formulário, com uma ação primária única no `FormFooter`; a ordem dos campos e regras de obrigatoriedade não mudam. Links do índice não submetem nem escondem dados. Isso reduz lembrança necessária sem introduzir persistência parcial, nova rota ou alteração de domínio.

## P1-D — Ciclo carregando → erro → sucesso

### Padrão compartilhado de pending

Como não existe skeleton DS catalogado, adicionar um único primitivo pequeno `app/components/ds/PendingState.tsx`, exportado por `app/components/ds/index.ts`, documentado em `app/components/ds/AGENTS.md` e `.opencode/skills/ds-master/SKILL.md`, com teste smoke em `app/components/ds/ds.test.tsx`. Ele não substitui `EmptyState` nem cria card/botão: comunica `aria-busy`, texto acessível e uma estrutura simples de carregamento com tokens.

Usá-lo somente quando React Router estiver em `loading`/revalidação sem dados utilizáveis. Em actions, usar `Button loading` e desabilitar a ação submetida. O estado de lista vazia (`total === 0`) nunca será reutilizado para representar loading.

### Queries inválidas e erros recuperáveis

Adicionar schema isomórfico compartilhado `app/lib/schemas/relatorios.ts` para datas/período/tipo/status quando não houver schema equivalente; não mudar Prisma. Regras:

- `membros._index.tsx`: tipo/query inválidos são removidos ou normalizados, `page` volta a 1, `pageSize` ao padrão; o loader retorna uma indicação não fatal para `InfoBox`, mantendo filtros válidos. Página acima do total é ajustada para a última página disponível.
- `financeiro._index.tsx`: status fora de `all|PAGO|PENDENTE|AGENDADO`, página não inteira/menor que 1 e datas inválidas retornam ao padrão seguro; mostrar o estado ajustado, não “nenhum lançamento”.
- relatórios: data inválida ou intervalo invertido não chega ao service; retornar erro de formulário/query recuperável com os valores válidos preservados. `dataInicio` e `dataFim` são obrigatórios apenas quando o usuário escolhe o filtro; defaults vêm do loader, não de relógios concorrentes no cliente.
- falha de banco/service é fatal para a rota atual: o loader repropaga o erro ao ErrorBoundary. A tela mostra mensagem genérica e uma ação de tentar novamente/voltar; não mostra stack ou detalhes de Prisma em produção.

Validação esperada do usuário não gera log. Falhas inesperadas são registradas somente no servidor com rota/erro técnico e `userId` quando disponível, sem payload, valor, descrição ou PII; a UI recebe apenas a mensagem segura do ErrorBoundary. Não criar console/log no cliente.

### Formulários, foco e valores

`membros.novo.tsx` deve retornar `data(..., { status: 422 })` para erros Zod/duplicidade, como a edição já faz, em vez de lançar uma Response JSON que interrompa o fluxo. Passar `defaultValues` e `fieldErrors` normalizados para `FormMembro`; todos os valores submetidos permanecem no formulário. Após uma resposta 422, focar o primeiro controle com `aria-invalid="true"`, sem roubar foco em submit bem-sucedido.

Aplicar o mesmo contrato de erro aos lançamentos: `valorDisplay` continua preservado, `parseBRLToCents` continua no action e erros de Zod/caixa retornam erro de campo/formulário. A transferência mantém `idempotencyKey` estável no retry, os valores digitados e o foco do primeiro erro já previsto em `financeiro.transferencia-nova.tsx`.

### Sucesso pós-redirect e dinheiro

Não afirmar sucesso antes do retorno do service. Depois de sucesso:

- `financeiro.lancamentos.novo.tsx` usa o ID retornado por `criarLancamento` e redireciona para o detalhe existente com marcador de criação; `financeiro.lancamentos.$id.tsx` exibe uma mensagem contextual única, sem duplicar toast e sem expor dados além do detalhe que o RBAC já permite.
- `financeiro.transferencia-nova.tsx` usa o `transferenciaId` retornado por `transferirEntreCaixas` e redireciona para `financeiro.transferencias.$id.tsx` com marcador de criação. O detalhe existente é o recibo confiável de origem, destino, valor, operador e horário para os perfis autorizados. Double-submit com a mesma chave continua retornando o registro idempotente; não criar outro sucesso visual.
- O marcador de sucesso é consumido/limpo na navegação seguinte. Refresh não duplica feedback. Falha 409 de saldo/caixa arquivado permanece no formulário com mensagem recuperável; 403/404 continuam sob ErrorBoundary/RBAC.

O detalhe financeiro não deve mostrar valor ou nome para quem não poderia vê-lo. A mensagem pós-redirect pode ser apenas “Lançamento registrado”/“Transferência registrada” quando o contexto do detalhe não estiver autorizado.

### Clipboard e requests abortados

Criar helper client-only `app/lib/copy.client.ts` com retorno booleano: usa Clipboard API quando disponível, fallback de seleção somente quando possível e nunca engole a falha silenciosamente. Aplicar em `app/routes/app/membros.novo.tsx` e `app/routes/app/membros.$id.tsx`: sucesso troca o rótulo para “Copiado”; falha mostra `ErrorAlert`/toast acionável (“Não foi possível copiar. Selecione o texto manualmente.”), sem marcar como copiado e sem logar o conteúdo do convite.

`FormMembro` deve abortar a consulta externa de CEP no unmount ou nova consulta e ignorar explicitamente `AbortError`; timeout/falha HTTP continua como erro inline recuperável. `app/lib/hooks/useClientIP.ts` mantém fallback silencioso para `unknown` e limpeza do `AbortController`; requests abortados não geram toast, console do cliente ou re-render de erro. Não adicionar retries automáticos a serviços externos.

### ErrorBoundary

**Arquivo:** `app/root.tsx` e ErrorBoundaries locais já existentes somente quando a mensagem atual for enganosa.

Reusar `Card`, `Button` e `ErrorAlert`/tokens no boundary global; não reestruturar o roteamento. Mapear 403, 404, 409 e 422 para mensagens em português e recuperação possível. Em produção, não renderizar stack/mensagem interna; em desenvolvimento, manter diagnóstico controlado. A ação de retorno deve ser um `Button`/link real para `/app`, e o boundary não deve alegar que uma operação foi salva.

## Contratos de erro por operação

| Operação | Falha | Resultado ao chamador | Recuperação | Log |
|---|---|---|---|---|
| Loader dashboard/financeiro/células | Prisma/service indisponível | Erro de rota → ErrorBoundary; nenhum número parcial | Tentar novamente ou voltar | Servidor, erro técnico sem payload/PII |
| Loader com query inválida | enum/data/UUID/página inválida | Query normalizada + aviso recuperável; não vira lista vazia | Corrigir filtro/limpar filtros | Nenhum log de auditoria |
| Financeiro status/paginação | status sem contrato ou página sem resultado | status seguro/última página; tabela honesta | Navegar pelos links | Nenhum log de auditoria |
| Action de membro/lançamento | Zod, duplicidade, valor inválido | 422 com `fieldErrors` e valores preservados | Corrigir campo; foco no primeiro erro | Nenhum log de auditoria |
| Action de lançamento/transferência | 409 saldo insuficiente/caixa arquivado | Erro contextual no formulário; nenhuma confirmação | Ajustar caixa/valor ou cancelar | Service mantém auditoria somente para sucesso |
| Action de lançamento/transferência | 403/404 | Response para boundary, sem revelar recurso indevido | Voltar a rota autorizada | Sem valor/PII no cliente |
| Redirect pós-sucesso | loader do recibo falha | Feedback não é inventado; boundary explica falha de leitura | Recarregar detalhe/lista | Erro técnico server-side |
| Convite/clipboard | API ausente, permissão negada ou falha de escrita | Toast/alerta de cópia manual; `copied=false` | Selecionar e copiar manualmente | Nenhum conteúdo do convite em log |
| CEP externo | HTTP inválido/timeout | Erro no campo; demais formulário preservado | Corrigir CEP/tentar de novo | Nenhum log de PII |
| CEP/IP externo | `AbortError` por unmount/timeout controlado | Nenhuma mensagem ou ruído ao usuário | Nenhuma | Nenhum log |

## Arquivos novos e responsabilidades

- `app/components/ds/PendingState.tsx`: único padrão visual/semântico de pending, caso a implementação confirme a lacuna atual; atualizar barrel, catálogo, skill e smoke test DS.
- `app/lib/schemas/relatorios.ts`: apenas validação/normalização isomórfica de filtros de relatório e, se útil, status/paginação; sem regra de RBAC ou acesso a banco.
- `app/lib/copy.client.ts`: helper client-only para clipboard, sem persistir ou logar texto.
- Testes ficam ao lado dos services/componentes conforme as convenções existentes; arquivos `*.test.tsx` continuam sob responsabilidade do tester.

## Ordem de execução

1. **Dados falsos e bugs de confiança:** consolidar o contrato de `finance.server.ts`; remover percentuais/valores fixos e claims sem action; tornar tabs e paginação reais com status do schema; corrigir contagem de células; validar RBAC de relatórios; reproduzir e corrigir hydration apenas se a causa for confirmada; remover busca global/`⌘ K` sem contrato. Cobrir cada decisão com testes antes de migrar estilos.
2. **Migração DS nos concentradores críticos:** shell desktop/mobile/topbar; dashboard geral; dashboard financeiro; caixas, lançamentos, transferências e relatórios; lista/formulário de membros; células. Depois de cada lote, remover somente CSS legado sem consumidores. Nenhuma alteração em `_old` lidera a fila.
3. **Redução de IA:** renomear o destino financeiro para não duplicar “Dashboard”; agrupar a navegação comprovadamente; expandir labels mobile; reduzir filtros de membros para busca/tipo + “Mais filtros”; remover exportação client-side incompleta; trocar stepper falso por índice/âncoras.
4. **Estados e recuperação:** adicionar/reusar pending, normalização de query, ErrorBoundary seguro, erros 422 preservando valores/foco, recibos pós-redirect, clipboard com fallback e silêncio de aborts. Fazer a verificação final de teclado, foco, mobile, dark mode e `prefers-reduced-motion` sem redesenhar a identidade.

## Testabilidade e gates

- **Unit/service:** `app/lib/finance.server.test.ts` cobre totais, variações com base zero, distribuição real, filtros de status, paginação, lista vazia e RBAC; `app/lib/dashboard.server.test.ts` cobre data de referência e ausência de dados; `app/lib/celulas.server.test.ts` mantém status/lista sem inferir “ativa”.
- **Loader/rota:** testes cobrem query inválida normalizada, última página, status inexistente rejeitado/remapeado para padrão, segredo de dízimo para SECRETARIO e actions CSV com os filtros atuais.
- **Componentes:** DS smoke e testes de `Dashboard`, financeiro, membros, células, shell mobile e `FormMembro` verificam dados renderizados, tabs, foco, `aria-busy`, EmptyState distinto de erro, labels mobile e ausência de `⌘ K` falso.
- **E2E Playwright:** fluxos autenticados de `/app`, `/app/financeiro`, filtro PAGO/PENDENTE/AGENDADO, paginação, `/app/celulas`, cadastro inválido com valores preservados, clipboard indisponível, lançamento e transferência com recibo; validar que dois submits com a mesma idempotency key não duplicam a operação.
- **Gates:** `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build` e E2E das rotas alteradas. Fazer grep final para classes `.page-header/.card/.btn/.kpi/.table` e cores literais apenas nos consumidores não migrados, com pendências registradas; nenhuma alteração de schema/RBAC sem revisão explícita.

## Critérios de aceite

### P1-A — Verdade dos dados e ações

1. Com uma base de teste controlada, cada KPI de `/app` e `/app/financeiro` coincide com a agregação real autorizada, sem números, percentuais, datas ou labels demonstrativos hardcoded.
2. Entradas, saídas e variações financeiras mostram o período e a fórmula usados; sem período anterior positivo, mostram “sem base comparável”, nunca uma porcentagem inventada.
3. A distribuição financeira deriva dos lançamentos visíveis; sem lançamentos exibe `EmptyState`, e com lançamentos os valores/percentuais representam a base real e fecham em 100% após o arredondamento definido.
4. As tabs exibem somente `Todos`, `Aprovados/PAGO`, `Pendentes/PENDENTE` e `Agendados/AGENDADO`; “Rejeitados” não aparece porque não existe no contrato real.
5. Mudar status e página atualiza a consulta server-side, preserva filtros na URL e informa a faixa/total real; não há botões de página estáticos.
6. O dashboard não possui `Exportar resumo` sem action; o CSV disponível é o endpoint real dos relatórios e respeita os filtros/RBAC.
7. “Células Ativas” conta exclusivamente registros com `status === "ATIVA"`; “Total de Células” e “Total de Membros” continuam usando a lista real.
8. Busca global e `⌘ K` falsos não aparecem no shell; os autocompletes com endpoint específico continuam funcionando.
9. Sob o cenário que reproduzia o mismatch, o primeiro HTML SSR e a hidratação ficam estáveis; se a reprodução não ocorrer, nenhum ajuste especulativo de timezone/arquitetura é introduzido.
10. Acesso de SECRETARIO e demais perfis continua compatível com `rbac.server.ts`, sem vazamento de dízimos por KPI, lista, relatório, exportação ou detalhe.

### P1-B — Linguagem visual única

11. Shell, dashboard, financeiro, membros, células e os cinco relatórios usam os primitivos DS equivalentes para headers, cards, KPIs, tabelas, tabs, campos, botões, diálogos/feedback e rodapés de formulário.
12. Os consumidores P1 não usam `app/components/_old/`, cores literais proibidas ou classes locais concorrentes quando houver primitivo equivalente; gráficos específicos usam apenas tokens semânticos.
13. Desktop e mobile usam a mesma configuração de navegação, preservam URLs/RBAC e a drawer mobile mantém labels, foco, Escape e restauração de foco.
14. Classes globais legadas são removidas somente quando uma busca comprovar ausência de consumidores; landing, auth e módulos fora do P1 continuam visualmente inalterados.
15. Copy, comportamento de negócio, identidade índigo/Inter, tema claro/escuro e responsividade são preservados; a migração não vira redesign.

### P1-C — Mapa mental e cadastro

16. `/app` é o único item chamado Dashboard na navegação; a rota financeira continua acessível com rótulo financeiro explícito e todos os destinos anteriores permanecem alcançáveis pelos perfis autorizados.
17. A navegação usa os seis grupos definidos, sem remover uma função por falta de rota alternativa; menu do usuário não aponta “Meu perfil”/“Preferências” para uma tela de outra finalidade.
18. Em membros, busca e tipo ficam visíveis; ministério/discipulador ficam em “Mais filtros”, têm resumo de estado, preservam query params e resetam página para 1 ao mudar filtro.
19. A lista não promete exportação completa enquanto só há exportação client-side da página; nenhum controle sem comportamento fica visível.
20. O cadastro não renderiza stepper não funcional; apresenta índice/âncoras para as quatro seções, mantém uma submissão, preserva campos/regras e oferece cancelar/salvar reais.

### P1-D — Carregando, erro e sucesso

21. Loader/revalidação, lista vazia, erro de rota e erro de formulário têm estados visualmente e semanticamente distintos; pending usa um único padrão compartilhado.
22. Query inválida não vira silenciosamente “nenhum resultado”: valores são normalizados, filtros válidos permanecem e a pessoa recebe orientação recuperável.
23. Erros 422 de membro/lançamento/transferência preservam valores, associam mensagens aos campos e focam o primeiro inválido; loading impede duplo clique.
24. Lançamento e transferência só mostram feedback de sucesso depois da resposta do service e terminam em detalhe/recibo real; 409 mantém recuperação no formulário e idempotência evita duplicata.
25. Clipboard informa sucesso ou falha, oferece cópia manual e nunca registra o conteúdo; abortos de CEP/IP não produzem ruído no cliente.
26. ErrorBoundary global e boundaries locais exibem mensagens seguras, ações reais de recuperação e nenhum stack/detalhe interno em produção.

## Decisões materiais não inferíveis e pendências

- **Busca global/command palette:** contrato, escopo, ranking, destinos e RBAC não existem. Foi decidido remover a affordance nesta fase; definir esses pontos em um requisito separado antes de reintroduzir.
- **Exportação de membros:** não há endpoint/service de exportação completa nem decisão sobre exportar todos os resultados filtrados. A exportação da página atual será retirada, não ampliada por inferência.
- **Projeções financeiras:** o código atual calcula uma estimativa pela média dos últimos três meses. O P1 preserva a fonte e rotula a estimativa; a aprovação de outra metodologia pertence a uma decisão de produto/financeiro posterior.
- **Offline/conexão fraca:** continua em aberto no `PRODUCT.md`; este plano melhora retry/feedback, mas não adiciona cache offline, fila local ou sincronização.
- **Hydration mismatch:** só vira alteração de código após reprodução e atribuição causal. Se o browser não reproduzir com relógio/locale controlados, registrar a verificação e não mexer na arquitetura.
- **Wizard real:** não é pendência: foi descartado com base no action/schema sem rascunho. O cadastro seguirá página única com índice/âncoras nesta fase.

Não há commit previsto para este artefato nem para a futura implementação sem solicitação explícita.