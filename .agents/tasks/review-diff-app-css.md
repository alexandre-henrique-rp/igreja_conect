# Revisão do diff atual de `app/app.css`

## Resumo executivo

**Recomendação: separar/revisar seletivamente, sem reverter o diff inteiro.** O diff atual é coerente com o pedido de polish de `/app/membros`: concentra-se em `filter-bar`, alternador de visualização, responsividade e cartões de membros. Não há alteração não relacionada, cor literal nova no trecho alterado, quebra evidente entre tema claro/escuro ou problema de contraste nos estados novos.

O principal ponto a corrigir antes de considerar o polish encerrado é que os botões do alternador de visualização têm área clicável de `44px × 36px`, abaixo do alvo vertical de `44px` adotado pelo Design System. Também há uma regra de `height: 36px` no contêiner do campo de busca para tablet que ficou inconsistente com o input interno agora definido como `44px`. São ajustes locais; não justificam desfazer o restante da alteração.

Escopo medido: o arquivo está com **138 adições e 15 remoções** em relação ao `HEAD` (`94ec1335`), totalizando um diff líquido de 123 linhas. A correção de fundo adaptativo da barra de filtros e o alargamento anterior dos selects pertencem ao commit `94ec1335`; não fazem parte do diff não commitado revisado aqui, mas foram considerados na análise do dark mode.

## Achados por severidade

### Crítico

**Nenhum.** Não há mudança em autenticação, dados, regras de negócio, segurança ou bloqueio da página.

### Alto

**Nenhum.** O diff não introduz contraste abaixo do mínimo calculado para os estados novos, nem regra global que alcance landing, auth ou outras rotas.

### Médio

#### M1 — Alternador de visualização fica com alvo vertical menor que o padrão do DS

- **Arquivo/linhas:** `app/app.css:1970-1980`, especialmente `.filter-bar .view-toggle button { width: 44px; height: 36px; }`.
- **Contexto consumidor:** `app/routes/app/membros._index.tsx:276-294`, dois `<button>` com `aria-label` e `aria-pressed`.
- **Categoria:** acessibilidade/responsividade/design system.
- **Evidência:** o botão tem largura de 44px, mas sua própria área interativa tem somente 36px de altura. O contêiner chega a aproximadamente 44px por causa de `padding: 3px` e borda, porém o espaço de padding não é parte do botão clicável.
- **Impacto:** o controle continua utilizável e semanticamente nomeado, mas não cumpre o padrão documentado de controles principais com pelo menos 44px de altura, especialmente relevante para o uso móvel descrito em `PRODUCT.md`.
- **Recomendação:** ajustar o botão para uma área efetiva de 44px e recalibrar o padding do contêiner para não criar altura excessiva; manter a largura de 44px e os estados `hover`, `active` e `focus-visible`.

### Baixo

#### B1 — Altura do wrapper de busca para tablet ficou desalinhada do input

- **Arquivo/linhas:** `app/app.css:2036-2046` e `app/app.css:1923-1928`.
- **Evidência:** entre 781px e 1100px, `.filter-bar .search` ainda declara `height: 36px`, enquanto `.filter-bar .search .input` passou a `height/min-height: 44px`. Como o overflow do filho não é explicitamente cortado, não há prova de que o campo fique invisível, mas o item flex passa a informar uma altura diferente da do controle que contém.
- **Impacto:** possível desalinhamento vertical, cálculo menos previsível da altura da barra e comportamento estranho durante scroll/resize em tablets e janelas intermediárias.
- **Recomendação:** remover o `height: 36px` obsoleto do wrapper ou alinhar deliberadamente o breakpoint ao controle de 44px. Não reduzir o input novamente sem confirmação visual, pois 44px é o padrão desejado.

#### B2 — Pequenos desvios do vocabulário do Design System

- **Arquivo/linhas:** `app/app.css:1976`, `app/app.css:2024`, `app/app.css:2109-2112` e `app/app.css:2133-2136`.
- **Evidência:** o botão interno do alternador usa `border-radius: 9px`, embora `DESIGN.md` documente 8px, 12px, 16px e pill; `member-edit`, `member-role` e `member-contact` usam texto de 12px, enquanto a escala documentada destaca 11px para label e 14px para body.
- **Impacto:** baixo; os valores são visualmente plausíveis e não criam uma falha de usabilidade. O detector mecânico marcou `9px` e os tamanhos `12px` como advisories de design system, não como erro bloqueante.
- **Recomendação:** preferir `var(--radius-sm)`/8px no botão interno e decidir se 12px deve ser formalizado como tamanho de apoio ou substituído pela escala existente. O aumento de 11px para 12px é defensável por legibilidade, mas deve ser intencional.

#### B3 — Duplicação local e transições sem o token já disponível

- **Arquivo/linhas:** `app/app.css:1904-1908` e `app/app.css:1939-1946`, além de `app/app.css:1970-1980` e `app/app.css:2021-2029`.
- **Evidência:** `.filter-clear` aparece em dois blocos; o primeiro mantém cor/tamanho e o segundo adiciona layout/estado. As novas transições repetem `180ms ease-out`, apesar de `@theme` já expor `--ease` no topo do arquivo.
- **Impacto:** nenhum impacto funcional identificado; aumenta a chance de divergência futura e deixa o diff maior que o necessário.
- **Recomendação:** consolidar os dois blocos de `.filter-clear` e usar `var(--ease)` nas transições novas, caso o objetivo seja manter uma única fonte de motion.

#### B4 — Margens explícitas somam-se ao `space-y-6` da página

- **Arquivo/linhas:** `app/routes/app/membros._index.tsx:187-212` e `app/app.css:1992-1995`.
- **Evidência:** o contêiner da página usa `className="members-page space-y-6"`; o diff adiciona `margin-bottom: 24px` tanto ao `.page-header` quanto à `.filter-bar`. O `space-y-6` também cria separação entre filhos diretos. O cabeçalho passa de sua margem global anterior para 24px, enquanto a barra de filtros passa da margem anterior de 18px para 24px.
- **Impacto:** provável aumento da distância entre a barra de filtros e o conteúdo seguinte para aproximadamente dois intervalos de 24px. Pode ser intencional como respiro do polish, mas não foi possível confirmar a percepção visual sem renderizar a rota.
- **Recomendação:** confirmar visualmente em desktop e mobile; se houver excesso, deixar o espaçamento sob responsabilidade de `space-y-6` ou remover a margem local da `.filter-bar`, em vez de ajustar várias margens concorrentes.

## Classificação exata dos grupos alterados

### Relacionado ao dark mode/filtros de membros

- `app/app.css:1887-1891`: o raio da `.filter-bar` muda de 10px para 12px. É uma mudança de forma da barra, não de cor.
- `app/app.css:1915-1937`: o ícone é reposicionado para acompanhar o input de 44px; busca e selects passam para 44px, com largura de select de 160px, padding e elipse de texto.
- `app/app.css:1939-2000`: `Limpar filtros` ganha alvo de 44px, hover/foco tokenizados; o `.view-toggle` passa a ter superfície, borda, raio e estados ativo/hover/foco usando tokens.
- A adaptação para dark mode é indireta e correta: os novos fundos e textos usam `var(--color-surface)`, `var(--color-surface-2)`, `var(--color-surface-3)`, `var(--color-muted)`, `var(--color-fg)`, `var(--color-accent)` e `var(--color-accent-soft)`. Não há hex, RGB ou nova cor OKLCH no trecho do diff.

A correção anterior de fato está no `94ec1335`: a `.filter-bar` passou a usar `color-mix(in oklch, var(--color-surface) 94%, transparent)` em vez de uma cor clara fixa, e os selects passaram de 130px para 150px. Isso não deve ser confundido com as mudanças não commitadas atuais.

### Relacionado ao polish da página de membros

- `app/app.css:1992-2034`: estados de foco, espaçamento específico da página, ocultação de chips vazios, ações alinhadas no rodapé dos cards e link `Editar`.
- `app/app.css:2075-2136`: cards passam a flex column para manter ações no rodapé; ajustes de espaçamento, tipografia dos nomes/metadata, chips e contatos.
- `app/app.css:2150-2168`: cabeçalho empilha no mobile, busca ocupa a linha inteira, selects podem repartir o espaço e o alternador permanece à direita.
- Os consumidores encontrados estão restritos a `app/routes/app/membros._index.tsx` e `app/components/TabelaMembros.tsx`; a busca no código não encontrou esses seletores em landing, auth, dashboard ou outras rotas.

### Melhoria legítima compartilhada

Os novos estados de foco e os alvos de 44px seguem princípios compartilhados do DS, mesmo estando aplicados localmente a classes de membros. O uso de tokens semânticos preserva a fonte de verdade do tema e evita introduzir um token ou cor ad hoc.

### Alteração suspeita ou não relacionada

**Nenhuma no diff atual de `app/app.css`.** Todos os blocos adicionados podem ser associados diretamente ao filtro ou à lista de membros. O detector mecânico também apontou avisos em regiões não alteradas do arquivo — por exemplo, regras posteriores de cards/cores — mas esses avisos estão fora do intervalo do diff e não são evidência contra este patch.

## Avaliação do dark mode

A implementação atual não apresenta conflito efetivo entre tema manual e preferência do sistema:

- `app/app.css:106-110` define `color-scheme: dark` para `prefers-color-scheme: dark` quando o HTML não está explicitamente em `data-theme="light"`.
- `app/app.css:123-154` define os tokens para `html[data-theme="dark"]`.
- `app/app.css:156-181` repete os mesmos valores para o modo automático escuro, sob `html:not([data-theme="light"])`.
- `app/lib/theme.ts:3-15` e `app/lib/theme.ts:35-43` confirmam a intenção: `auto` remove o atributo, `light` e `dark` aplicam o atributo explicitamente.

A duplicação entre o bloco `html[data-theme="dark"]` e o media query é uma dívida de manutenção existente, mas as declarações são iguais e a ordem/condição impedem que o sistema escuro sobrescreva o tema claro explícito. Não recomendo misturar uma refatoração dessa infraestrutura com este diff de membros.

Contraste estático aproximado, calculado a partir dos tokens OKLCH atuais:

| Estado | Claro | Escuro |
|---|---:|---:|
| `accent-strong` sobre `surface` (links/ativo) | 9,11:1 | 8,07:1 |
| `muted` sobre `surface-3` (hover) | 5,42:1 | 6,11:1 |
| `accent` para o anel de foco sobre `surface` | 7,02:1 | 5,78:1 |

Todos ficam acima de 4,5:1 na análise estática. Isso não substitui a verificação de contraste de pixels após renderização, especialmente no fundo semitransparente da `.filter-bar`.

## Responsividade e acessibilidade

Pontos positivos verificados:

- Busca e selects usam 44px após o polish (`app/app.css:1923-1937`).
- `Limpar filtros`, `Ver detalhes` e `Editar` recebem altura mínima de 44px (`app/app.css:1939-1946`, `app/app.css:2014-2020`).
- Os controles da rota têm nomes acessíveis: `aria-label` na busca/selects, `aria-label` e `aria-pressed` no alternador (`membros._index.tsx:216-294`).
- O foco é explícito para os novos links/botões (`app/app.css:1952-1958`), e os links de nome já tinham ring semântico em `TabelaMembros.tsx:85-93`.
- Em até 780px, o filtro abandona o scroll horizontal e quebra em linhas (`app/app.css:2183-2192`), e a grade/lista vira uma coluna (`app/app.css:2197-2214`).

Risco residual:

- Entre 781px e 1100px, a barra mantém `flex-wrap: nowrap` e scroll horizontal por design (`app/app.css:1879-1896`), enquanto o wrapper da busca conserva a altura obsoleta de 36px. Isso deve ser exercitado visualmente em uma largura intermediária.
- O alternador é o único controle novo cujo botão individual não chega a 44px de altura; ver M1.

## Verificações executadas

- `git diff --check -- app/app.css`: passou, sem erro de whitespace.
- `git diff --unified=0 -- app/app.css`: usado para confirmar que o diff se limita aos blocos descritos.
- Busca de consumidores: os seletores novos aparecem apenas no fluxo de membros (`membros._index.tsx` e `TabelaMembros.tsx`).
- Busca de tokens: o trecho novo usa variáveis semânticas; não foram encontradas cores literais novas no diff.
- Detector mecânico Impeccable no arquivo completo: executado em modo JSON. O comando retornou status 2 por achados do detector; no intervalo alterado, os avisos relevantes foram o raio 9px e tamanhos 12px já descritos em B2. Os demais achados estão fora do diff.
- Contraste: cálculo estático dos pares de tokens acima.

Não rodei servidor, build, typecheck ou testes de navegador: a alteração revisada é CSS, o pedido determinou investigação somente leitura e essas verificações não provariam o alinhamento visual sem iniciar a aplicação. Também não foi possível confirmar o comportamento real de foco, toque, quebra em 781/1100/780px ou o espaçamento renderizado sem uma captura/browser.

## Conclusão objetiva

Manter o polish de filtros e cartões de membros. Antes de consolidar, revisar seletivamente: (1) dar 44px efetivos aos botões do alternador; (2) remover/alinha a altura de 36px do wrapper de busca no breakpoint intermediário; e, em uma limpeza de baixo risco, (3) trocar raio 9px por token, consolidar `.filter-clear`, reutilizar `var(--ease)` e confirmar se as margens somadas ao `space-y-6` produzem o respiro pretendido. Não há fundamento, neste diff, para reverter alterações da landing, auth ou do tema global, nem para separar um bloco não relacionado.
