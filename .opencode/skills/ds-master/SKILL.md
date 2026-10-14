---
name: ds-master
description: |
  Igreja Conect Design System master skill. Aciona automaticamente em qualquer
  criação/edição de componente React, página, formulário, modal, tabela ou rota
  em app/components/, app/routes/, app/lib/. Use SEMPRE que for tocar em UI.
---

# Igreja Conect — Design System (DS) Master

**Fonte única:** tokens OKLCH definidos em `app/app.css` (`@theme`).
**Catálogo:** `app/components/ds/` (30+ primitivos).

> ⚠️ **Não usar cores literais Tailwind** (`bg-cyan-700`, `text-blue-600`,
> `bg-red-50`, etc.) fora dos primitivos DS. Toda UI passa pelos tokens.

---

## 1. Tokens semânticos (Tailwind v4 `@theme`)

| Categoria | Utility classes | Origem OKLCH (light) |
|---|---|---|
| **Acento (ação/CTA)** | `bg-accent text-white`, `text-accent`, `bg-accent-soft`, `bg-accent-soft-2` | indigo oklch(48.8% .246 275) |
| **Sucesso** | `bg-success`, `text-success`, `bg-success-soft` | emerald oklch(52.5% .145 162) |
| **Atenção** | `bg-warning`, `text-warning`, `bg-warning-soft` | amber oklch(60% .14 72) |
| **Perigo** | `bg-danger`, `text-danger`, `bg-danger-soft` | rose oklch(55% .19 28) |
| **Info** | `bg-info`, `text-info`, `bg-info-soft` | sky oklch(53% .19 255) |
| **Foreground** | `text-fg`, `text-muted`, `text-subtle` | slate oklch(20.8% → 62%) |
| **Superfícies** | `bg-bg`, `bg-surface`, `bg-surface-2`, `bg-surface-3` | oklch(98.5% → 95.8%) |
| **Bordas** | `border-border`, `border-border-strong` | oklch(90.8% → 84.5%) |
| **Foco** | `focus-visible:ring-accent`, `ring-accent/30` | — |

**Anti-patterns:** `bg-cyan-*`, `bg-blue-6/7*`, `bg-red-7*`, `bg-amber-50/100`,
`bg-green-*`, `slate-200/300/700/900` — proibidos fora dos tokens.

---

## 2. Catálogo de primitivos (`app/components/ds/`)

Todos os primitivos aceitam `className?: string` para overrides Tailwind extras.

### Ações
- **`<Button variant size fullWidth loading as to>`** — primary/secondary/ghost/danger/link; sm/md/lg
- **`<IconButton size variant aria-label>`** — botão quadrado só ícone

### Layout / containers
- **`<Card variant padding as to>`** — default/hover/flat/kpi/finance/alert; none/sm/md/lg
- **`<CardHeader title eyebrow description actions>`**
- **`<CardBody padding>`** / **`<CardFooter>`**
- **`<Section eyebrow title description actions gap>`** — bloco com cabeçalho
- **`<PageHeader eyebrow title description actions badge>`**
- **`<Breadcrumb><BreadcrumbItem href current><BreadcrumbSeparator>`**

### Formulários
- **`<Field label name required hint error>`** — wrapper com label+aria
- **`<Input label name type required hint error leadingIcon trailingAction variant>`**
- **`<Select label name options hint error placeholder>`**
- **`<Textarea label name rows>`**
- **`<Checkbox label name>`**
- **`<Switch name label description>`** — toggle CSS-only
- **`<RadioCard value label description icon tone>`** + **`<RadioGroup>`**
- **`<Segmented value onChange options>`**
- **`<Stepper steps=[{label,active,done}]>`**
- **`<FormSection title index description>`** / **`<FormFooter>`** / **`<FormGrid cols>`** / **`<FormLayout sidebar>`** / **`<SpanTwo>`**

### Visualização
- **`<KpiCard label value hint delta icon tone>`**
- **`<Badge tone size>`** — success/warning/danger/info/neutral/accent
- **`<Chip tone>`**
- **`<Avatar name src size>`** / **`<AvatarStack users max>`**
- **`<ProgressBar value max tone label>`**
- **`<EmptyState icon title description action iconTone>`**
- **`<InfoBox tone title>`** — warning/info/success/danger
- **`<Tabs value onValueChange><TabList items /><TabPanel value>`**
- **`<Table><TableHeader><TableRow><TableHead>...`**
- **`<Icon name size spriteHref>`** + **`<IconWrap tone size>`** + **`<StatIcon tone>`**

---

## 3. Regras inegociáveis

1. **Cores literais proibidas.** Use tokens semânticos. Se precisar de cor nova,
   adicione um token em `app/app.css` (`@theme`).
2. **Não criar componente novo de botão/card/badge.** Use `<Button>`,
   `<Card>`, `<Badge>`, `<KpiCard>` com variante.
3. **Toda rota autenticada** começa com `<PageHeader>` + `<Section>` + `<Card>`.
4. **Toda rota pública** usa `<AuthLayout>` (auth pages) ou `<LandingLayout>`.
5. **Todo primitivo aceita `className`** para overrides pontuais.
6. **WCAG AA:** focus visível (`focus-visible:ring-accent`), aria-labels,
   contraste OKLCH calibrado.
7. **Dark mode automático + manual** via `useTheme()` (`app/lib/theme.client.tsx`).
8. **Tokens monetários em Int (centavos)** — `app/lib/money.server.ts`.

---

## 4. Padrões de endpoint (shell)

### Rota autenticada
```tsx
<PageHeader
  eyebrow="Pessoas"
  title="Membros"
  description="Gerencie os membros da igreja."
  actions={<Button onClick={...}>+ Novo membro</Button>}
/>

<Section eyebrow="01 · Listagem" title="Membros ativos">
  <Card>
    <CardHeader title="Membros" actions={<Segmented ... />} />
    <CardBody>
      <Table>
        <TableHeader><TableRow>...</TableRow></TableHeader>
        <TableBody>{items.map(...)}</TableBody>
      </Table>
    </CardBody>
  </Card>
</Section>
```

### Formulário padrão
```tsx
<Card>
  <FormSection title="Dados pessoais" index="1">
    <FormGrid cols={2}>
      <Input label="Nome" name="nome" required error={errors?.nome?.[0]} />
      <Input label="Email" name="email" type="email" required />
      <SpanTwo>
        <Textarea label="Observações" name="obs" />
      </SpanTwo>
    </FormGrid>
  </FormSection>
  <FormFooter>
    <Button variant="secondary" as={Link} to="/app/membros">Cancelar</Button>
    <Button type="submit" variant="primary" loading={isSubmitting}>Salvar</Button>
  </FormFooter>
</Card>
```

### Estado vazio / erro
```tsx
<EmptyState
  icon={<Icon name="users" />}
  title="Nenhum membro encontrado"
  description="Adicione o primeiro membro para começar."
  action={<Button>+ Adicionar membro</Button>}
/>
```

### KPIs do dashboard
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  <KpiCard label="Membros ativos" value={42} tone="accent" icon={<Icon name="users" />} />
  <KpiCard label="Visitantes" value={12} tone="warning" icon={<Icon name="user-plus" />} />
  <KpiCard label="Caixas" value={4} tone="success" icon={<Icon name="wallet" />} />
  <KpiCard label="Alertas" value={2} tone="danger" icon={<Icon name="bell" />} />
</div>
```

---

## 5. Migração a partir do código legado

| Antigo | Novo |
|---|---|
| `bg-cyan-700` | `bg-accent` |
| `bg-blue-600` | `bg-accent` |
| `text-blue-600` | `text-accent` |
| `bg-red-50/100/700` | `bg-danger-soft`, `text-danger` |
| `bg-amber-50/100`, `text-amber-7/8/900` | `bg-warning-soft`, `text-warning` |
| `bg-green-*`, `text-green-*` | `bg-success-soft`, `text-success` |
| `slate-50/100` | `bg-surface-2` |
| `slate-200/300` | `border-border`, `border-border-strong` |
| `slate-400/500/600` | `text-subtle`, `text-muted` |
| `slate-700/800/900` | `text-fg` |
| `<CardInfo>` | `<Card variant="default">` |
| `<CardKpi>` | `<KpiCard>` |
| `<BadgeStatus>` | `<Badge tone="success/danger/neutral">` |
| `<InfoBox>` (legado) | `<InfoBox tone>` (DS) |
| `<PageHeader>` (legado) | `<PageHeader>` (DS — mesma API) |

**Componentes em `app/components/_old/`** foram movidos; se precisar deles,
importe de `~/components/_old/<Nome>`. Não reintroduzir no DS.

---

## 6. Verificações automáticas

- `npm run typecheck` — typecheck TypeScript
- `npm test` — vitest (suite completa)
- `npm run lint` — ESLint
- `npm run build` — bundle RR7
- `npm run test:e2e` — Playwright smoke nas rotas-chave

**Não commitar** se algum gate falhar.
