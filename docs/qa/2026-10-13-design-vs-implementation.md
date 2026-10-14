# Auditoria QA Pré-Release — DS vs Implementação

> **Data:** 2026-10-13
> **Escopo:** validar se o app Igreja Conect está publicável com a UX aprovada em [`docs/Igreja-Conect-Design-System/`](../Igreja-Conect-Design-System/) (41 telas + tokens OKLCH).
> **Metodologia:** varredura paralela de 40 rotas `app/**` vs 39 superfícies visuais exportadas, com leitura detalhada dos arquivos críticos e detecção de bugs SSR/integr.
> **Inputs:** [`UX-MIGRATION-PLAN.md`](../UX-MIGRATION-PLAN.md), [`IMPLEMENTATION-MAP.md`](../Igreja-Conect-Design-System/IMPLEMENTATION-MAP.md), [`ds-master` skill](../../.opencode/skills/ds-master/SKILL.md), [`ds/AGENTS.md`](../../app/components/ds/AGENTS.md), [`components/AGENTS.md`](../../app/components/AGENTS.md).

---

## TL;DR (veredito para publicação)

| Métrica | Valor |
|---|---|
| Rotas autenticadas + públicas analisadas (`*.tsx` em `routes/`) | **40** |
| Telas do DS mapeáveis (excluindo `index.html` + `design-system.html`) | **39** |
| Total **conformes** visuais (1:1 com DS) | **0** |
| Total **parcial** (partial — DS de referência mas com gaps) | **20** |
| Total **sem DS** (rota sem referência, parcial ou total) | **~20** |
| Total **HTMLs sem rota** (precisam de rota nova) | **9** |
| **Blockers para release** (bug ou dado mock) | **5** |
| **Bugs críticos de integração** | **4** |
| Uso de cores literais proibidas (`bg-orange-*`, `bg-rose-*`, `bg-violet-*`) | **8 ocorrências em 8 arquivos** |
| Imports de `~/components/_old/*` em código novo | **5 arquivos** |
| `EmptyState` do DS vs legacy | **só 3 rotas usam DS; 4 usam legacy/inline** |

> **Recomendação:** NÃO publicar como "release 1.0" sem fechar os **5 blockers** abaixo. Tudo o mais é polish visual pós-launch.

---

## Blocker #1 — `cultos.$id.editar.tsx` exibe dados MOCKados

**Arquivo:** [`app/routes/app/cultos.$id.editar.tsx`](../../app/routes/app/cultos.$id.editar.tsx) (linhas 23-31)

```tsx
const mockCultos = [
  { id: "1", nome: "Culto de Celebração", data: "2024-05-15", ... },
  { id: "2", nome: "Reunião de Jovens", ... },
  // ...
];
const culto = mockCultos.find((c) => c.id === id) || mockCultos[0];
```

A rota `/app/cultos/:id/editar` carrega um array fixo e ignora o Prisma. **Sempre retorna o mesmo culto.** A action (linha 35-41) também não persiste nada — só redireciona. **Substituir por:**

```tsx
const culto = await prisma.culto.findUnique({ where: { id } });
if (!culto) throw new Response("Culto não encontrado", { status: 404 });
// action:
await prisma.culto.update({ where: { id }, data: parsed.data });
```

**Severidade:** 🔴 ALTA — funcionalidade silenciosamente quebrada (dados do usuário são perdidos).

---

## Blocker #2 — `estoque._index.tsx` faz **seed** dentro do `loader`

**Arquivo:** [`app/routes/app/estoque._index.tsx`](../../app/routes/app/estoque._index.tsx) (linhas 55-71)

```tsx
const count = await prisma.itemEstoque.count();
if (count === 0) {
  await prisma.$transaction([
    prisma.itemEstoque.create({ data: { nome: "Café em Grãos (1kg)", ... } }),
    prisma.itemEstoque.create({ data: { nome: "Papel A4 ...", ... } }),
    prisma.itemEstoque.create({ data: { nome: "Detergente Neutro ...", ... } }),
    prisma.itemEstoque.create({ data: { nome: "Cabo XLR 10m", ... } }),
  ]);
}
```

Em todo request em que `count === 0`, 4 produtos de demo são criados **no banco de produção**. Não há flag dev, não há `process.env.NODE_ENV`. Side-effects perigosos em deploy limpo.

**Correção:** extrair para `prisma/seed.ts` (ou `app/db/seed.server.ts`) e executar via script `db:seed`. Remover do loader.

**Severidade:** 🟠 MÉDIA-ALTA — altera estado do banco sem consentimento.

---

## Blocker #3 — 5 rotas importam `~/components/_old/*`

**Arquivos:**
- [`app/routes/app/alertas._index.tsx:11`](../../app/routes/app/alertas._index.tsx) → `import { CardAlerta } from "~/components/_old/CardAlerta";`
- [`app/routes/app/estoque.$id._index.tsx:7-12`](../../app/routes/app/estoque.$id._index.tsx) → 4 imports (`BadgeTipoItem`, `BadgeStatusPatrimonio`, `CardMovimentacao`, `CardManutencao`)

Viola convenção explícita em [`app/components/AGENTS.md`](../../app/components/AGENTS.md):

> [`_old/`](./_old/) — Componentes legados (não usar em código novo).

**Correção:** migrar para primitivos DS (`Card`, `Badge`, `Chip`, `Avatar`, `InfoBox` do barrel `~/components/ds`).

**Severidade:** 🟡 MÉDIA — não bloqueia, mas impede "100% conforme DS".

---

## Blocker #4 — `financeiro.caixas._index.tsx` importa `EmptyState` do lugar errado

**Arquivo:** [`app/routes/app/financeiro.caixas._index.tsx:30`](../../app/routes/app/financeiro.caixas._index.tsx)

```tsx
import { EmptyState } from "~/components/EmptyState"; // ← legacy em app/components/
```

O DS tem `EmptyState` exportado em [`app/components/ds/index.ts:69`](../../app/components/ds/index.ts). Render fica divergente da paleta DS.

**Correção:** trocar para `import { EmptyState } from "~/components/ds";`

**Severidade:** 🟢 BAIXA — 1 linha.

---

## Blocker #5 — 8 ocorrências de cores literais Tailwind proibidas

Cores literais em `app/routes/app/**` violam [`docs/GUIDELINES.md`](../GUIDELINES.md) e [`app/components/ds/AGENTS.md`](../../app/components/ds/AGENTS.md). Substituir sempre por tokens semânticos.

| Arquivo | Linha | Classe proibida | Substituir por |
|---|---:|---|---|
| `app/routes/app/ministerios.novo.tsx` | 466 | `bg-violet-50 text-violet-600` | `bg-accent-soft text-accent-strong` |
| `app/routes/app/ministerios._index.tsx` | 262 | `bg-orange-50 text-orange-600` | `bg-warning-soft text-warning` |
| `app/routes/app/cultos.$id.editar.tsx` | 250 | `text-orange-500` | `text-warning` |
| `app/routes/app/financeiro.transferencias.$id.tsx` | 128-129 | `bg-rose-50/40 border-rose-100 text-rose-700` | `bg-danger-soft text-danger border-danger-soft` |
| `app/routes/app/financeiro.relatorios.customizado.tsx` | 137 | `bg-orange-50 text-orange-600` | `bg-warning-soft text-warning` |
| `app/routes/app/financeiro.relatorios.balancete.tsx` | 107 | `bg-orange-400` | `bg-warning` |
| `app/routes/app/financeiro.relatorios._index.tsx` | 135 | `bg-orange-50 text-orange-600` | `bg-warning-soft text-warning` |
| `app/routes/app/financeiro.lancamentos.$id.tsx` | 218, 248, 262 (3x) | `bg-rose-50 text-rose-600/700` | `bg-danger-soft text-danger` |

> Também encontrado: `[#0a1220]` hex literal em [`app/routes/public/convite.$token.tsx:131, 151`](../../app/routes/public/convite.$token.tsx) — risco de contraste WCAG (fundo escuro + texto branco com semitransparência não calibrada).

**Severidade:** 🟡 MÉDIA — quebra invariante de Design Tokens e dark mode.

---

## Tabela cruzada — Design System ↔ Implementação (status refinado)

> **Origem:** `docs/Igreja-Conect-Design-System/IMPLEMENTATION-MAP.md` (já marca rotas como `partial`). Acrescenta-se aqui **gap real** e **primitivos DS em uso**.

### 1.1 Públicas / Shell

| Rota | Arquivo | HTML DS | Status | Gap real (achados da auditoria) |
|---|---|---|:-:|---|
| `/` | `routes/public/index.tsx` | `landing.html` | ⚠️ partial | Estrutura DS ok, mas não usa `LandingLayout`/`PublicNav`/`PublicFooter` do barrel DS; usa `Button` legacy `~/components/Button`. |
| `/login` | `routes/public/login.tsx` | `login.html` | ⚠️ partial | Loader/ação fortes; render 100% em `FormLogin` legacy — não usa `AuthLayout`/`AuthCard`/`AuthVisual`/`AuthFormSide`. |
| `/convite/:token` | `routes/public/convite.$token.tsx` | `convite.html` | ⚠️ partial | **Não usa DS.** Hex `#0a1220`, gradientes manuais, sem `AuthLayout`. |
| `/recuperar-senha` | `routes/public/recuperar-senha.tsx` | `recuperar-senha.html` | ⚠️ partial | Sem `Stepper` DS, sem `AuthCard` DS, SVGs inline em vez de `Icon`. |
| `/logout` | `routes/logout.tsx` | — | 🔧 | ação idempotente |
| shell `/app/*` | `routes/app.tsx` + `_middleware.tsx` | `app-shell.html` | ✅ mapeado | OK — `data-od-id="app-shell-page"`, sidebar + topbar + main, RBAC + theme toggle. |

### 1.2 Pessoas

| Rota | Arquivo | HTML DS | Status | Gap real |
|---|---|---|:-:|---|
| `/app` (dash) | `routes/app/_index.tsx` | `dashboard.html` | ⚠️ partial | KPIs hard-coded (`▲ 12%` literal, `_index.tsx:154, 168, 182`); donut/avisos não renderizados. |
| `/app/membros` | `routes/app/membros._index.tsx` | `membros.html` (+ `visitantes.html`) | ⚠️ partial | **Falta grade de `member-card`** que o DS exporta (chips de ministérios); usa `TabelaMembros` legacy. |
| `/app/membros/novo` | `routes/app/membros.novo.tsx` | `membro-novo.html` (+ `visitante-novo.html`) | ⚠️ partial | Stepper alinhado mas usa `FormMembro` legacy. |
| `/app/membros/:id` | `routes/app/membros.$id.tsx` | `membro-detalhe.html` (+ `visitante-detalhe.html`) | ⚠️ partial | **Aba Fidelidade** não renderizada apesar do loader trazer `fidelidadeFinanceira`. |
| `/app/membros/:id/editar` | `routes/app/membros.$id.editar.tsx` | `membro-editar.html` | ⚠️ partial | OK com FormMembro. |
| `/app/membros/:id/discipulado` | `routes/app/membros.$id.discipulado.tsx` | — (aba) | ❌ unmapped | sem tela DS |
| `/app/membros/:id/discipulador` | `routes/app/membros.$id.discipulador.tsx` | — | ❌ unmapped | sem tela DS |
| `/app/membros/:id/ministerios` | `routes/app/membros.$id.ministerios.tsx` | — | ❌ unmapped | sem tela DS |
| `/app/membros/:id/tipo` | `routes/app/membros.$id.tipo.tsx` | — | ❌ unmapped | sem tela DS |
| `/app/celulas` | `routes/app/celulas._index.tsx` | `celulas.html` | ⚠️ partial | `CARD_COLORS` **hex** (linhas 24-27) — viola tokens; empty state manual sem DS. |
| `/app/alertas` | `routes/app/alertas._index.tsx` | — (âncora dashboard) | ❌ unmapped + Blocker #3 | usa `_old/CardAlerta` |

### 1.3 Financeiro

| Rota | Arquivo | HTML DS | Status | Gap real |
|---|---|---|:-:|---|
| `/app/financeiro` | `routes/app/financeiro._index.tsx` | `financeiro.html` | ⚠️ partial | Header sem `PageHeader` DS; donut OK; falta gráfico 12m e "Baixar extrato". |
| `/app/financeiro/caixas` | `routes/app/financeiro.caixas._index.tsx` | `caixas.html` | ⚠️ partial | **Blocker #4**: `EmptyState` legacy (linha 30). Falta `cash-grid` visual de cards (renderiza tabela). |
| `/app/financeiro/caixas/novo` | `routes/app/financeiro.caixas.novo.tsx` | — | ❌ unmapped | sem tela DS |
| `/app/financeiro/caixas/:id` | `routes/app/financeiro.caixas.$id.tsx` | `caixa-detalhe.html` | ⚠️ partial | Botões em `<Link>` cru; sem `Button` DS; sem gráfico evolução saldo. |
| `/app/financeiro/lancamentos/novo` | `routes/app/financeiro.lancamentos.novo.tsx` | `lancamento-novo.html` | ⚠️ partial | usa `FormLancamento` legacy |
| `/app/financeiro/lancamentos/:id` | `routes/app/financeiro.lancamentos.$id.tsx` | `lancamentos.html` (lista) | ⚠️ partial | **Cores `rose-*` literais** (Blocker #5). |
| `/app/financeiro/transferencias` | `routes/app/financeiro.transferencias._index.tsx` | `transferencias.html` | ❌ unmapped | sem tela dedicada — só stub |
| `/app/financeiro/transferencias/nova` | `routes/app/financeiro.transferencia-nova.tsx` | `transferencia-nova.html` | ⚠️ partial | sem DS de formulário; `transfer-flow` ausente como padrão |
| `/app/financeiro/transferencias/:id` | `routes/app/financeiro.transferencias.$id.tsx` | — (sub de `transferencias.html`) | ⚠️ partial | cores `rose-*` literais (Blocker #5) |
| `/app/financeiro/relatorios` | `routes/app/financeiro.relatorios._index.tsx` | `relatorios.html` | ⚠️ partial | cores `orange-*` literais (Blocker #5) |
| `/app/financeiro/relatorios/{dre,balancete,fluxo-caixa,customizado}` | 4 arquivos | — | ❌ unmapped | sem tela DS específica |

### 1.4 Ministérios / Escalas / Cultos

| Rota | Arquivo | HTML DS | Status | Gap real |
|---|---|---|:-:|---|
| `/app/ministerios` | `routes/app/ministerios._index.tsx` | `ministerios.html` | ⚠️ partial | **cor `orange-50` literal** (linha 262); cards renderizados em `<article>` cru com `CARD_COLORS` hex. |
| `/app/ministerios/novo` | `routes/app/ministerios.novo.tsx` | `ministerio-novo.html` | ⚠️ partial | **cor `violet-50` literal** (linha 466). |
| `/app/ministerios/:id` | `routes/app/ministerios.$id.tsx` | `ministerio-detalhe.html` | ⚠️ partial | sem `Tabs` DS (1091 linhas); usa `Breadcrumb` legacy. |
| `/app/escalas` | `routes/app/escalas._index.tsx` | `escala-sorteador.html` | ⚠️ partial | sem DS; `MINISTERIO_ICONS` com emojis (não casa com DS). |
| `/app/escalas/novo` | `routes/app/escalas.novo.tsx` | `escala-nova.html` | ⚠️ partial | sem `Stepper`/`Field`/`Input` DS. |
| `/app/escalas/:id/editar` | _(ausente)_ | `escala-editar.html` | ❌ unmapped | rota não existe |
| `/app/cultos` | `routes/app/cultos._index.tsx` | — (âncora dashboard) | ❌ unmapped | sem tela DS |
| `/app/cultos/novo` | `routes/app/cultos.novo.tsx` | — | ❌ unmapped | sem tela DS |
| `/app/cultos/:id/editar` | `routes/app/cultos.$id.editar.tsx` | — | ❌ unmapped + Blocker #1 | **dados mock** |

### 1.5 Estoque / Patrimônio

| Rota | Arquivo | HTML DS | Status | Gap real |
|---|---|---|:-:|---|
| `/app/estoque` | `routes/app/estoque._index.tsx` | `estoque.html` (hub) | ⚠️ partial | **Blocker #2** (seed no loader). Sem nenhum import do DS. |
| `/app/estoque/novo` | `routes/app/estoque.novo.tsx` | `estoque-novo.html` | ⚠️ partial | sem DS |
| `/app/estoque/:id` | `routes/app/estoque.$id._index.tsx` | `estoque-item.html` | ⚠️ partial | **Blocker #3**: 4 imports `_old/*`. |
| `/app/estoque/:id/{movimentar,manutencao,retorno,baixa}` | 4 arquivos | modais `app.js` | ⚠️ partial | sem DS |
| `/app/estoque/requisicoes{_index,nova,$id}` | 3 arquivos | — | ❌ unmapped | sem tela DS |
| `/app/patrimonio` | `routes/app/patrimonio.tsx` (18 ln, **redirect-only**) | `patrimonio.html` | ⚠️ partial | **usuário nunca vê a tela**; só faz `redirect("/app/estoque?tipo=PATRIMONIO")`. Decidir: ou remove rota legacy, ou implementa `patrimonio.html` standalone. |

### 1.6 Eventos / Config

| Rota | Arquivo | HTML DS | Status | Gap real |
|---|---|---|:-:|---|
| `/app/eventos` | `routes/app/eventos._index.tsx` | — (âncora dashboard) | ❌ unmapped | 216 linhas implementadas sem ref DS; usa `CARD_COLORS` hex (não DS); KPIs inline sem `KpiCard` DS. |
| `/app/eventos/novo` | `routes/app/eventos.novo.tsx` | — | ❌ unmapped | sem tela DS |
| `/app/config` | _(ausente)_ | `configuracoes.html` (hub) | ❌ unmapped | rota não existe |
| `/app/config/acolhimento` | `routes/app/config.acolhimento.tsx` | `configuracoes.html` (aba) | ⚠️ partial | usa `~/components/InfoBox` legacy; sem `PageHeader` DS; outras abas (`Conta`, `Notificações`, `Segurança`) não existem como rotas. |

---

## HTMLs do DS **sem rota** correspondente (gaps de navegação)

Precisam de decisão: criar rota nova OU consolidar em tela existente.

| HTML DS | Decisão sugerida |
|---|---|
| `visitantes.html` | Criar `/app/visitantes` (filtra `membros?tipo=VISITANTE` ou separa?) |
| `visitante-novo.html` | Criar `/app/visitantes/novo` |
| `visitante-detalhe.html` | Criar `/app/visitantes/:id` |
| `estoque-itens.html` | Reorganizar: `/app/estoque` (hub) vs `/app/estoque/itens` (lista detalhada) |
| `movimentacoes.html` | Criar `/app/estoque/movimentacoes` (histórico global) |
| `patrimonio-novo.html` | Criar `/app/patrimonio/novo` |
| `patrimonio-detalhe.html` | Criar `/app/patrimonio/:id` (ou aceitar o atalho via `?tipo=PATRIMONIO`) |
| `celula-nova.html` | Criar `/app/celulas/nova` |
| `celula-detalhe.html` | Criar `/app/celulas/:id` |
| `escala-editar.html` | Criar `/app/escalas/:id/editar` |

---

## Bugs de renderização/integr (segunda varredura)

### Pontos críticos SSR

- ✅ Todos os loaders tipados via `Route.LoaderArgs` (sem `any` descontrolado)
- ✅ `useLoaderData<typeof loader>` apenas onde há loader exportado
- ⚠️ `cultos.$id.editar.tsx:50,53,56` instancia `new File([], "...")` em useState do componente — não persiste; é estado local ilusório.

### Empty states

| Rota | Usa DS `EmptyState` | Comentário |
|---|:-:|---|
| `_index.tsx` | ✅ | cultos + contribuições |
| `membros._index.tsx` | ✅ | contextual por filtro |
| `financeiro.caixas._index.tsx` | ❌ | **legacy** (Blocker #4) |
| `ministerios._index.tsx` | ❌ | inline SVG manual |
| `celulas._index.tsx` | ❌ | inline SVG manual |
| `escalas._index.tsx` | ❌ | `EmptyStateEscalas` local |
| `eventos._index.tsx` | ❌ | divs/grids inline |
| `estoque._index.tsx` | n/d | sem empty state explícito |

### Acessibilidade (amostra)

- `financeiro.relatorios.*` usam `<table>` sem `caption` e sem `scope="col"` explícito nas `<th>`.
- `convite.$token.tsx:131,151` cores hex hardcoded com transparência — pode falhar WCAG.
- Botões SVG nos cards `ministerios._index.tsx` sem `aria-label` consistente.
- ✅ `app.tsx:51` aplica `inert` corretamente no drawer mobile.

### Formatação monetária (padrão centavos)

- ✅ Nenhum `parseFloat` monetário em `financeiro/**`.
- ✅ Helper `formatBRLFromCents` consistente.
- ⚠️ `estoque.requisicoes.$id.tsx:191` faz `(valorCentavos / 100).toFixed(2)` inline — preferir helper compartilhado.

### LGPD

- ✅ Nenhum `console.log` com PII (`sid`, `email`, `telefone`, `cpf`) encontrado em `app/routes/app/**`.
- ✅ Auditoria via `safeLog()` em `app/lib/audit.server.ts`.

---

## Resumo executivo — Top prioridades pré-release

1. **Substituir `mockCultos`** em `cultos.$id.editar.tsx` por `prisma.culto.findUnique` + action de update. **[blocker]**
2. **Mover seed do estoque** para `db:seed` script e remover do `loader`. **[blocker]**
3. **Migrar imports `~/components/_old/*`** em `alertas._index.tsx` e `estoque.$id._index.tsx` para primitivos DS. **[blocker]**
4. **Trocar `~/components/EmptyState`** por `~/components/ds` em `financeiro.caixas._index.tsx:30`. **[blocker]**
5. **Substituir 8+ cores literais** (`bg-orange-*`, `bg-rose-*`, `bg-violet-*`, hex `#0a1220`) por tokens semânticos. **[blocker]**
6. **Implementar `patrimonio.html`** standalone OU remover o atalho redirect-only `patrimonio.tsx` (decisão de produto).
7. **Migrar páginas públicas** (`login`, `convite`, `recuperar-senha`) para `AuthLayout`/`AuthCard`/`Stepper` do DS — visual está fora do padrão.
8. **Substituir `TabelaMembros` único** por **`member-grid` do DS** (chips de ministérios por card).
9. **Renderizar aba Fidelidade** em `membros.$id.tsx` (loader já carrega; falta UI).
10. **Substituir `CARD_COLORS` hex** em `ministerios._index.tsx`, `celulas._index.tsx`, `eventos._index.tsx` por tokens DS.

---

## Métricas de conformidade visual por área

| Área | Rotas | Conformes | Parciais | Sem DS | % conforme ou parcial |
|---|---|---:|---:|---:|---:|
| Públicas | 5 | 1 (logout) | 4 | 0 | **100%** |
| Shell | 1 | 1 | 0 | 0 | **100%** |
| Pessoas (dash+membros+células+alertas) | 11 | 0 | 6 | 5 | **55%** |
| Financeiro | 12 | 0 | 5 | 7 | **42%** |
| Ministérios/Escalas/Cultos | 9 | 0 | 4 | 5 | **44%** |
| Estoque/Patrimônio | 12 | 0 | 6 | 6 | **50%** |
| Eventos/Config | 4 | 0 | 1 | 3 | **25%** |
| **TOTAL** | **54** | **2** | **26** | **26** | **52%** |

> ⚠️ contagem de "rotas" inclui sub-rotas internas (ex.: `membros.$id.discipulado.tsx`). 40 são rotas raiz; 14 são sub-rotas internas. As 5 blockers listadas acima respondem por praticamente todo o trabalho crítico pré-launch.

---

## Decisões pendentes para fechar gaps

> Estas decisões precisam do product owner antes do T12 (fechamento de gaps).

| # | Pergunta | Opções |
|---|---|---|
| D1 | `patrimonio.tsx` (redirect-only) deve implementar `patrimonio.html` ou morrer? | A) implementar rota `/app/patrimonio` standalone; B) remover rota, deixar `?tipo=PATRIMONIO` em estoque; C) manter como atalho UX. |
| D2 | `visitantes.html` cria módulo novo ou é só um filtro em `/app/membros`? | A) novo módulo `/app/visitantes/**`; B) filtro + modal em `/app/membros?tipo=VISITANTE`. |
| D3 | Alertas ganham rota dedicada (`alertas.html` novo) ou vivem como popover na topbar? | A) nova rota + tela DS; B) substituir `_old/CardAlerta` por `Card` DS dentro de `alertas._index.tsx`. |
| D4 | Membros: `discipulado/discipulador/ministerios/tipo` viram abas dentro de `membros.$id.tsx` ou mantêm sub-rotas? | A) consolidar via `Tabs` DS; B) manter sub-rotas mas com layout DS de aba. |
| D5 | Estoque: hub (`estoque.html`) vs lista (`estoque-itens.html`) — manter 1 ou separar? | A) manter só lista detalhada; B) criar `/app/estoque/itens` (lista) + manter `/app/estoque` (hub com KPIs). |
| D6 | Eventos/Cultos: criar mockups ou descontinuar essas rotas? | A) gerar mockups próprios seguindo padrão DS; B) marcar como `unmapped` e descontinuar. |

---

## Apêndice — Resultado da varredura de "cores literais Tailwind"

> Comando executado: `grep -RE "bg-(orange|rose|violet|yellow|cyan|emerald|sky|pink|fuchsia)-\d+|text-(orange|rose|violet|yellow|cyan|emerald|sky|pink|fuchsia)-\d+" app/routes/**`

```
app/routes/app/cultos.$id.editar.tsx:250:  text-orange-500
app/routes/app/financeiro.lancamentos.$id.tsx:218:  bg-rose-50
app/routes/app/financeiro.lancamentos.$id.tsx:248:  bg-rose-50 text-rose-600
app/routes/app/financeiro.lancamentos.$id.tsx:262:  bg-rose-50 text-rose-700
app/routes/app/financeiro.relatorios.balancete.tsx:107:  bg-orange-400
app/routes/app/financeiro.relatorios.customizado.tsx:137:  bg-orange-50 text-orange-600
app/routes/app/financeiro.relatorios._index.tsx:135:  bg-orange-50 text-orange-600
app/routes/app/financeiro.transferencias.$id.tsx:128:  bg-rose-50/40 border-rose-100 text-rose-700
app/routes/app/financeiro.transferencias.$id.tsx:129:  bg-rose-50/40 border-rose-100 text-rose-700
app/routes/app/ministerios._index.tsx:262:  bg-orange-50 text-orange-600
app/routes/app/ministerios.novo.tsx:466:  bg-violet-50 text-violet-600
```

> Valores hex arbitrários (`#0a1220`) também detectados em `app/routes/public/convite.$token.tsx:131,151`. Recomenda-se substituir por `bg-accent-strong/95 text-white border border-white/10` se a estética escura for intencional, alinhando a paleta OKLCH.

---

## Anexo — Próximos passos sugeridos (sprint pré-launch)

| Sprint | Escopo | Esforço estimado |
|---|---|---|
| **Sprint QA-1** (blockers) | 5 blockers acima | 1-2 dias |
| **Sprint QA-2** (visual críticos) | Migrar `login` + `convite` + `recuperar-senha` para `AuthLayout` DS | 2-3 dias |
| **Sprint QA-3** (rotas parciais) | Fechar `membros._index` (member-grid DS), `membros.$id` (aba fidelidade), `patrimonio.tsx` | 3-4 dias |
| **Sprint QA-4** (gaps) | Decidir + implementar D1, D2, D5 | 2-3 dias |
| **Sprint QA-5** (auditoria final) | viewports 360/390/430/600/820/1024/1366/1440/1920, dark mode, `pnpm typecheck/build/test` | 1 dia |

> **Critério de "release 1.0"**: Sprint QA-1 ✅ + QA-2 ✅ + `pnpm test` verde + smoke test de todas as 40 rotas em produção clone.
