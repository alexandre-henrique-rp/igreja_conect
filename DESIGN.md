---
name: Igreja Conect
description: ERP simpático e objetivo para a rotina administrativa e pastoral de uma igreja local.
colors:
  accent: "oklch(48.8% 0.246 275)"
  accent-strong: "oklch(42.8% 0.235 275)"
  accent-soft: "oklch(94.5% 0.055 275)"
  accent-soft-2: "oklch(97% 0.026 275)"
  success: "oklch(52.5% 0.145 162)"
  success-soft: "oklch(93.5% 0.06 162)"
  warning: "oklch(60% 0.14 72)"
  warning-soft: "oklch(95% 0.06 82)"
  danger: "oklch(55% 0.19 28)"
  danger-soft: "oklch(94.5% 0.055 28)"
  info: "oklch(53% 0.19 255)"
  info-soft: "oklch(94.5% 0.05 255)"
  fg: "oklch(20.8% 0.035 260)"
  muted: "oklch(49.5% 0.035 255)"
  subtle: "oklch(62% 0.025 255)"
  bg: "oklch(98.5% 0.006 250)"
  surface: "oklch(100% 0 0)"
  surface-2: "oklch(97.8% 0.008 250)"
  surface-3: "oklch(95.8% 0.014 250)"
  border: "oklch(90.8% 0.018 250)"
  border-strong: "oklch(84.5% 0.026 250)"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(34px, 4.6vw, 58px)"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.08em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  pill: "999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-strong}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 16px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
    padding: "20px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 12px"
  badge:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-strong}"
    rounded: "{rounded.pill}"
    height: "22px"
    padding: "0 8px"
---

# Design System: Igreja Conect

## Overview

**Creative North Star: "O Balcão de Acolhimento"**

O Igreja Conect é uma ferramenta de trabalho para quem cuida de uma igreja: secretaria, financeiro, pastor e líderes. O sistema recebe a pessoa como um balcão de acolhimento recebe quem chega: tudo à mão, claro, sem exigir que ela seja técnica. O humor é simpático e objetivo. A simpatia vem da linguagem, dos cantos arredondados e de respostas visuais suaves ao toque, nunca de decoração.

A densidade é média. Há bastante respiro em cards e formulários, mas listas e tabelas continuam escaneáveis. A cor de ação é um único índigo, usado com economia. Sucesso, atenção e perigo aparecem sempre em pares (cor forte e fundo suave) para o significado nunca depender só da cor.

**Key Characteristics:**
- Superfícies claras e planas, separadas por bordas finas em vez de sombras pesadas.
- Um acento único (índigo) e três cores de estado em pares forte/suave.
- Cantos generosos (12 a 16px) e controles de 44px de altura, bons para toque no celular.
- Tema claro e escuro com a mesma estrutura, trocando só os valores dos tokens.
- Tipografia Inter, com títulos firmes (peso 700 a 800) e espaçamento levemente negativo.

## Colors

Paleta restrita: um acento índigo, três cores de estado e neutros levemente azulados. Valores em OKLCH, definidos em `app/app.css`.

### Primary
- **Índigo de Ação** (`oklch(48.8% 0.246 275)`): botões primários, links de ação, item ativo da navegação, foco e destaque de seleção.
- **Índigo Profundo** (`oklch(42.8% 0.235 275)`): hover e pressionado do índigo; texto sobre fundo suave de acento.
- **Névoa Índigo** (`oklch(94.5% 0.055 275)`) e **Névoa Índigo Clara** (`oklch(97% 0.026 275)`): fundos de item ativo, badges de acento, linha de tabela em hover e ícones de estatística.

### Secondary
- **Verde Sucesso** (`oklch(52.5% 0.145 162)`) com fundo `oklch(93.5% 0.06 162)`: confirmado, ativo, entrada financeira.
- **Âmbar Atenção** (`oklch(60% 0.14 72)`) com fundo `oklch(95% 0.06 82)`: pendências, alertas e avisos.
- **Rosa Perigo** (`oklch(55% 0.19 28)`) com fundo `oklch(94.5% 0.055 28)`: erros, saída financeira e ações destrutivas.
- **Azul Informação** (`oklch(53% 0.19 255)`) com fundo `oklch(94.5% 0.05 255)`: dicas e avisos neutros.

### Neutral
- **Tinta** (`oklch(20.8% 0.035 260)`): texto principal.
- **Cinza Azulado** (`oklch(49.5% 0.035 255)`) e **Cinza Suave** (`oklch(62% 0.025 255)`): texto secundário e apoio.
- **Papel** (`oklch(98.5% 0.006 250)`): fundo da página. **Branco de Cartão** (`oklch(100% 0 0)`): cards e campos. Duas camadas intermediárias (`surface-2`, `surface-3`) para listas zebradas, hover e áreas de apoio.
- **Linha Fina** (`oklch(90.8% 0.018 250)`) e **Linha Firme** (`oklch(84.5% 0.026 250)`): bordas de cards e de campos.

### Named Rules
**The One Voice Rule.** O índigo é a única cor de ação. Se tudo é índigo, nada se destaca: use-o em uma ação principal por área.

**The Paired State Rule.** Toda cor de estado vem com seu fundo suave e, quando comunica algo importante, também com texto ou ícone. Cor sozinha nunca carrega o significado.

**The Token Only Rule.** Nenhuma cor literal do Tailwind (`slate-*`, `blue-*`, `white`) fora dos primitivos. Cor nova vira token em `app/app.css`.

## Typography

**Display Font:** Inter (com `ui-sans-serif, system-ui, sans-serif`)
**Body Font:** Inter (mesma família)

**Character:** Uma só família, sem contraste de pares. A hierarquia vem de peso e tamanho: títulos firmes e compactos, corpo neutro e legível.

### Hierarchy
- **Display** (800, `clamp(34px, 4.6vw, 58px)`, 1.08): só na landing e em telas de entrada.
- **Headline** (800, 28px, 1.15): título de página (`PageHeader`).
- **Title** (700, 26px, 1.2): títulos de seção em telas públicas.
- **Body** (400 a 500, 14px, 1.6): texto corrido e campos. Linhas de leitura em até 54 a 65 caracteres.
- **Label** (700, 11px, espaçamento 0.08em, maiúsculas): eyebrows acima de títulos, cabeçalhos de tabela (10px, 800).

### Named Rules
**The Tabular Numbers Rule.** Valores monetários, contagens e KPIs usam números tabulares (`.mono`), para as colunas alinharem.

## Layout

Casca fixa: sidebar de 240px (64px recolhida) e topbar de 64px. O conteúdo fica em `.page`, com até 1280px de largura e 28px de margem lateral. Em telas pequenas a sidebar vira drawer.

O ritmo vertical usa múltiplos de 8px. Grades de 2, 3 e 4 colunas com 16px de espaçamento; a de 4 colunas cai para 2 abaixo de 1050px e as de 2 e 3 viram 1 coluna abaixo de 780px. O padrão de uma tela autenticada é `PageHeader`, depois `Section`, depois `Card`.

## Elevation & Depth

Híbrido, mais plano do que elevado. Em repouso, a profundidade vem de borda fina mais uma sombra mínima. A elevação aparece como resposta ao toque.

### Shadow Vocabulary
- **Repouso** (`0 1px 2px oklch(20.8% 0.035 260 / 0.04)`): cards e painéis em estado normal.
- **Hover** (`0 8px 20px oklch(20.8% 0.035 260 / 0.08)`): card interativo ao passar o mouse, com leve subida de 2px e borda de acento.
- **Modal** (`0 20px 50px oklch(20.8% 0.035 260 / 0.15)`): diálogos.

### Named Rules
**The Responds-To-Touch Rule.** Sombra e movimento aparecem como resposta a hover, foco e pressão, não como decoração em repouso.

## Shapes

Linguagem arredondada e acolhedora. Cantos de 12px em botões e campos, 16px em cards, 8px em itens de navegação e ícones pequenos, pílula completa em badges e chips. Bordas de 1px. Sem recortes ou formas decorativas fora das ilustrações de entrada.

## Components

### Buttons
- **Shape:** cantos de 12px, altura 44px (36px no pequeno, 48px no grande).
- **Primary:** fundo índigo, texto branco, sombra mínima; hover em índigo profundo.
- **Secondary:** fundo de cartão com borda firme, hover em `surface-2`.
- **Ghost / Link / Danger:** transparente com hover suave; link sublinhado ao passar; perigo em rosa com texto branco.
- **Focus:** anel de 2px em índigo com afastamento.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** branco de cartão, borda fina.
- **Shadow Strategy:** repouso mínimo; variante `hover` sobe 2px com borda de acento.
- **Internal Padding:** 16, 20 ou 24px. Cabeçalho e rodapé do card separados por borda fina.

### Inputs / Fields
- **Style:** altura 44px, cantos de 12px, fundo de cartão, borda firme.
- **Focus:** borda índigo mais anel de 2px a 30% de opacidade.
- **Error / Disabled:** borda e mensagem em rosa com `role="alert"`; desabilitado a 50% de opacidade.

### Badges e Chips
- **Style:** pílula, 22px de altura, fundo suave do estado com texto forte do mesmo estado, peso 700.

### Navigation
- **Style:** itens de 36px, texto de 13px peso 600. Ativo em Névoa Índigo com texto índigo profundo; hover em `surface-3`. Rótulos de grupo em maiúsculas de 10px.

### Tabelas
- Cabeçalho fixo em `surface-2`, maiúsculas de 10px. Linhas zebradas, hover em Névoa Índigo Clara, texto de 12px.

## Do's and Don'ts

### Do:
- **Do** usar os primitivos de `app/components/ds/` e tokens semânticos; cor nova entra como token.
- **Do** manter alvos de toque de pelo menos 44px nos controles principais.
- **Do** deixar a linguagem da interface calorosa e direta, em português.
- **Do** dar resposta suave a hover e foco (sombra, subida leve, borda de acento), respeitando `prefers-reduced-motion`.
- **Do** manter o tema escuro com a mesma estrutura, apenas trocando os valores dos tokens.

### Don't:
- **Don't** usar cores literais do Tailwind (`bg-cyan-700`, `text-blue-600`, `slate-*`, `white`) fora dos primitivos.
- **Don't** usar o índigo em mais de uma ação principal por área.
- **Don't** depender só de cor para comunicar estado.
- **Don't** criar novo botão, card ou badge fora do DS; use variantes.
- **Don't** usar componentes de `app/components/_old/` em código novo.
