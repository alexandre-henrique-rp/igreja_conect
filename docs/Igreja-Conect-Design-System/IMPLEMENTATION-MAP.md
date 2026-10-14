# Mapa de implementação UX — Igreja Conect

Mapa de rastreabilidade entre as telas exportadas do Design System e as rotas
React Router do projeto. A fonte visual é `DESIGN-HANDOFF.md`,
`DESIGN-MANIFEST.json`, `assets/tokens.css` e o HTML da coluna **Referência**.

## Como ler

- **mapped**: referência, rota e implementação foram identificadas e a viewport
  alvo foi verificada.
- **partial**: existe implementação, mas ainda há diferença visual,
  responsiva, de comportamento ou a verificação visual está pendente.
- **unmapped**: não há referência confiável no export.
- **blocked**: a verificação depende de ambiente, dados ou decisão de produto.

> Não marcar uma tela como `mapped` sem verificar a rota renderizada. Registrar a
> viewport e o gap na última coluna.

## Superfícies públicas e autenticação

| Rota | Arquivo de produção | Superfície | Referência | Status | Última verificação / gap |
|---|---|---|---|---|---|
| `/` | `app/routes/public/index.tsx` | landing | `landing.html` | partial | Testes SSR passam; conferir screenshots da matriz completa |
| `/login` | `app/routes/public/login.tsx` | auth | `login.html` | partial | Conferir estados de erro, loading e responsividade |
| `/convite/:token` | `app/routes/public/convite.$token.tsx` | auth | `convite.html` | partial | Conferir fluxo de convite real |
| `/recuperar-senha` | `app/routes/public/recuperar-senha.tsx` | auth | `recuperar-senha.html` | partial | Conferir formulário e estados de validação |

## Shell e telas autenticadas

| Rota | Arquivo de produção | Superfície | Referência | Status | Última verificação / gap |
|---|---|---|---|---|---|
| `/app` | `app/routes/app/_index.tsx` | app | `dashboard.html` | partial | Estrutura, `data-od-id` e CSS base alinhados; comparar gráficos, dados e viewport |
| `/app/*` | `app/routes/app.tsx` | app shell | `app-shell.html` | partial | Shell com classes canônicas e `data-od-id`; conferir sidebar, topbar, mobile e tema |
| `/app/membros` | `app/routes/app/membros._index.tsx` | app | `membros.html` | partial | 2026-10-05 — telemetria verificada em 390x844, 913x875 e 1366x768; shell, filtros, grade/lista, exportação, avatar DS e overflow ajustados; ainda falta diff de screenshot contra todos os viewports |
| `/app/membros/novo` | `app/routes/app/membros.novo.tsx` | app/form | `membro-novo.html` | partial | 2026-10-05 — header, retorno e stepper alinhados; action continua persistindo no banco; falta reduzir o formulário visual ao recorte completo da referência |
| `/app/membros/:id` | `app/routes/app/membros.$id.tsx` | app/detail | `membro-detalhe.html` | partial | 2026-10-05 — header com avatar/status/ações e abas adicionados; dados permanecem reais; falta diff visual completo das abas e estados |
| `/app/membros/:id/editar` | `app/routes/app/membros.$id.editar.tsx` | app/form | `membro-editar.html` | partial | 2026-10-05 — usa o mesmo formulário, dados reais e stepper; falta ajustar o corpo ao layout compacto da referência |
| `/app/financeiro` | `app/routes/app/financeiro._index.tsx` | app | `financeiro.html` | partial | Conferir abas, filtros e permissões |
| `/app/financeiro/caixas` | `app/routes/app/financeiro.caixas._index.tsx` | app | `caixas.html` | partial | Conferir tabela e ações |
| `/app/financeiro/caixas/:id` | `app/routes/app/financeiro.caixas.$id.tsx` | app/detail | `caixa-detalhe.html` | partial | Conferir extrato e estados financeiros |
| `/app/financeiro/lancamentos/novo` | `app/routes/app/financeiro.lancamentos.novo.tsx` | app/form | `lancamento-novo.html` | partial | Conferir campos, moeda e validação |
| `/app/financeiro/relatorios` | `app/routes/app/financeiro.relatorios._index.tsx` | app | `relatorios.html` | partial | Conferir navegação de relatórios |
| `/app/financeiro/relatorios/fluxo-caixa` | `app/routes/app/financeiro.relatorios.fluxo-caixa.tsx` | app/report | `financeiro.html` | unmapped | Export não possui referência específica confiável |
| `/app/ministerios` | `app/routes/app/ministerios._index.tsx` | app | `ministerios.html` | partial | Conferir cards, busca e responsividade |
| `/app/ministerios/novo` | `app/routes/app/ministerios.novo.tsx` | app/form | `ministerio-novo.html` | partial | Conferir seleção de líder e estados |
| `/app/ministerios/:id` | `app/routes/app/ministerios.$id.tsx` | app/detail | `ministerio-detalhe.html` | partial | Conferir membros, atividades e ações |
| `/app/escalas` | `app/routes/app/escalas._index.tsx` | app | `escala-sorteador.html` | partial | Referência mais próxima; confirmar equivalência de fluxo |
| `/app/escalas/novo` | `app/routes/app/escalas.novo.tsx` | app/form | `escala-nova.html` | partial | Conferir formulário e seleção de voluntários |
| `/app/cultos` | `app/routes/app/cultos._index.tsx` | app | `dashboard.html#cultos` | partial | Referência é bloco do dashboard, não tela independente |
| `/app/estoque` | `app/routes/app/estoque._index.tsx` | app | `estoque.html` | partial | Conferir filtros, tabela e estado vazio |
| `/app/estoque/novo` | `app/routes/app/estoque.novo.tsx` | app/form | `estoque-novo.html` | partial | Conferir campos e validação |
| `/app/estoque/:id` | `app/routes/app/estoque.$id._index.tsx` | app/detail | `estoque-item.html` | partial | Conferir ações e dados reais |
| `/app/patrimonio` | `app/routes/app/patrimonio.tsx` | app | `patrimonio.html` | partial | Conferir filtro de patrimônio |
| `/app/celulas` | `app/routes/app/celulas._index.tsx` | app | `celulas.html` | partial | Conferir cards e estado vazio |
| `/app/config/acolhimento` | `app/routes/app/config.acolhimento.tsx` | app/settings | `configuracoes.html` | partial | Referência contém múltiplos painéis; conferir aba aplicada |
| `/app/eventos` | `app/routes/app/eventos._index.tsx` | app | `dashboard.html#eventos` | unmapped | Não há tela independente de eventos no export |
| `/app/alertas` | `app/routes/app/alertas._index.tsx` | app | — | unmapped | Criar referência somente após decisão de UX |

## Regras de manutenção

1. Ao criar ou alterar uma rota visual, atualizar a linha correspondente.
2. Ao encontrar um novo HTML no manifesto, adicionar a rota sem fundir telas.
3. Registrar a viewport verificada (`360x800`, `1024x768`, etc.) e o gap real;
   não usar “igual ao design” sem evidência.
4. Se a implementação divergir por necessidade de dados reais, registrar o
   motivo e preservar a geometria do design.
5. Revalidar esta tabela quando `DESIGN-MANIFEST.json`, `routes.ts` ou o shell
   visual mudar.
