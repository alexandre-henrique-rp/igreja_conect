# AGENTS.md — app/components/ds/

**Design System do Igreja Conect.** 30+ primitivos reutilizáveis construídos
sobre os tokens semânticos do Design System (Indigo accent, OKLCH calibrado,
dark mode automático).

## Propósito
Fonte única de toda UI. Componentes aqui substituem todos os visuais legados
(`CardInfo`, `CardKpi`, `BadgeStatus*`, `<InfoBox>` antigo, etc.).

## Dependências
- `react`, `react-dom`.
- `~/lib/cn` para composição de classes Tailwind.
- `~/lib/theme.client` para `useTheme()` e toggle dark/light.
- Tokens via Tailwind v4 `@theme` em `app/app.css` (sem `@apply`, utility-first).

## Mapa de Arquivos (catálogo)

| Categoria | Componentes |
|---|---|
| **Ações** | `Button`, `IconButton` |
| **Containers** | `Card`, `CardHeader`, `CardBody`, `CardFooter`, `Section`, `PageHeader` |
| **Formulários** | `Field`, `Input`, `Select`, `Textarea`, `Checkbox`, `Switch`, `RadioCard`, `RadioGroup`, `Segmented`, `Stepper`, `FormSection`, `FormFooter`, `FormGrid`, `FormLayout`, `SpanTwo` |
| **Visualização** | `KpiCard`, `Badge`, `Chip`, `Avatar`, `AvatarStack`, `Icon`, `IconWrap`, `StatIcon`, `ProgressBar` |
| **Estados** | `EmptyState`, `InfoBox`, `Tabs`, `Table` (TableWrap/Header/Body/Row/Head/Cell/Footer) |
| **Navegação** | `Breadcrumb`, `BreadcrumbItem`, `BreadcrumbSeparator` |

**Importação única:** `import { Button, Card, Field, ... } from "~/components/ds"`.

## Convenções

1. **Todo primitivo aceita `className?: string`** para overrides Tailwind extras no endpoint.
2. **Tokens semânticos apenas.** Cores literais Tailwind (`cyan-700`, `blue-6*`, `red-7*`, etc.) são proibidas.
3. **Acessibilidade WCAG 2.1 AA:** focus visível, aria-labels, contraste OKLCH.
4. **Componentes co-locados** com testes em `*.test.tsx` quando aplicável.
5. **Catálogo vivo:** se precisar de primitivo novo, adicione aqui e à skill `ds-master`.

## Como criar um primitivo novo

1. Implementar em `app/components/ds/<Nome>.tsx` com tipagem explícita.
2. Exportar no barrel `app/components/ds/index.ts`.
3. Documentar com JSDoc (exemplo + props + tokens usados).
4. Adicionar entrada na tabela de catálogo aqui.
5. Adicionar entrada em [.opencode/skills/ds-master/SKILL.md](../../../.opencode/skills/ds-master/SKILL.md).
6. Teste smoke em `app/components/ds/ds.test.tsx`.