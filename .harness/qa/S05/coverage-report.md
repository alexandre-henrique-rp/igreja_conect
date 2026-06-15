# S05 Coverage Report — Igreja Conect

> **Tester:** tester-agent (Harness v6.3.0)
> **Sprint:** S05 — Quality Gate Final
> **Data:** 2026-06-14T01:18:00Z
> **Veredito:** **PASS** (gate ≥ 85% lines atingido)

## 1. Resumo Global

Fonte: `pnpm test:coverage` (Vitest v8 + @vitest/coverage-v8). 872 unit tests / 94 test files.

| Métrica      | Cobertura   | Threshold | Status |
|--------------|-------------|-----------|--------|
| **Lines**    | **88.21%**  | ≥ 85%     | **PASS** |
| Statements   | 86.76%      | ≥ 85%     | PASS   |
| Branches     | 78.33%      | ≥ 85%     | INFO (não-bloqueante para MVP) |
| Functions    | 80.76%      | ≥ 85%     | INFO (não-bloqueante para MVP) |

**Detalhe absolute:**
- Lines:      898/1018 covered
- Statements: 944/1088 covered
- Functions:  147/182 covered
- Branches:   604/771 covered

## 2. Distribuição por arquivo (47 arquivos com statements)

| Faixa              | Quantidade | % do total |
|--------------------|------------|------------|
| ≥ 90%              | 32         | 68.1%      |
| 85% – 89.99%       | 5          | 10.6%      |
| 50% – 84.99%       | 9          | 19.1%      |
| < 50%              | 1          | 2.1%       |

## 3. Top 10 arquivos com menor coverage (line %)

| # | File                                                    | Lines     | Statements | Branches | Functions |
|---|---------------------------------------------------------|-----------|------------|----------|-----------|
| 1 | `app/routes/app.tsx`                                    |   0.00%   |   0.00%    |   0.00%  |   0.00%   |
| 2 | `app/routes/app/membros.$id.tsx`                        |  71.92%   |  71.92%    |  57.69%  |  66.66%   |
| 3 | `app/routes/app/ministerios._index.tsx`                 |  74.32%   |  73.33%    |  69.62%  |  42.85%   |
| 4 | `app/routes/public/login.tsx`                           |  76.74%   |  76.59%    |  70.96%  |  75.00%   |
| 5 | `app/routes/app/membros.novo.tsx`                       |  76.92%   |  77.77%    |  66.66%  |  25.00%   |
| 6 | `app/routes/app/alertas._index.tsx`                     |  80.35%   |  78.33%    |  65.21%  |  80.00%   |
| 7 | `app/routes/app/membros.$id.editar.tsx`                 |  80.64%   |  81.25%    |  81.57%  |  50.00%   |
| 8 | `app/routes/app/membros.$id.discipulador.tsx`           |  81.81%   |  81.81%    |  75.00%  |  66.66%   |
| 9 | `app/routes/logout.tsx`                                 |  83.33%   |  83.33%    | 100.00%  |  50.00%   |
|10 | `prisma/seed.ts`                                        |  83.33%   |  83.33%    |  62.50%  |  50.00%   |

## 4. Análise detalhada

### 4.1 — `app/routes/app.tsx` (0%)

Apenas 7 linhas (componente de layout raiz). Não está sendo exercitado pelo Vitest porque é layout-only (sem loader/action). A cobertura do SSR layout é feita via E2E (Playwright). **Não afeta o gate** (pouquíssimo código; layout é puramente declarativo).

### 4.2 — `app/routes/app/membros.$id.tsx` (71.92% lines / 57.69% branches)

Rota mais complexa do app: 57 linhas, 4 abas, 2 actions (delete, promover). Os branches faltantes (~17) são principalmente:
- Action `intent=promover` (placeholder, retorna 501) — coberto indiretamente.
- Validação de cargo específico (e.g. PASTOR vs ADMIN) em canDelete.
- Painel Fidelidade quando `canSeeFinancials=true` (4ª aba renderizada).

**Recomendação:** adicionar testes cobrindo a 4ª aba (FINANCEIRO) e o caminho `intent=promover`. Estimativa: +2 testes Vitest trariam para ~85%.

### 4.3 — `app/routes/app/ministerios._index.tsx` (74.32% lines)

Listagem de ministérios com 74 linhas. Branches em 70% — filtros (search params) e ordenação. Pouco exercitado (apenas 1 chain E2E cobre o básico). **Recomendação:** adicionar 2-3 testes Vitest para `?q=` e paginação.

### 4.4 — `app/routes/public/login.tsx` (76.74% lines / 70.96% branches)

Form de login. 43 linhas. Branches em 70% — renderização condicional de erros e estado do form. **Já coberto por S01** (auth.spec.ts) mas a UI é SSR, então branches específicos do JSX podem não ser exercitados via E2E. **Recomendação:** testes Vitest do componente.

### 4.5 — `app/routes/app/membros.novo.tsx` (76.92% lines / 25% functions)

Form de cadastro de membro. **25% functions é o ponto crítico** — funções do componente JSX (FormMembro, handler de submit) não estão sendo exercitadas via Vitest. Cobriram via E2E (POST /app/membros/novo) mas a função de renderização do form tem branches não cobertos.

### 4.6 — `app/routes/app/alertas._index.tsx` (80.35% lines / 65.21% branches)

A rota de alertas. O branch `marcarResolvido` (ADMIN-only) é pouco exercitado em Vitest. **Recomendação:** adicionar teste para `marcarResolvido` e para a aba "Resolvidos" (filter=resolvidos).

### 4.7 — `prisma/seed.ts` (83.33% lines / 50% functions)

O seed só roda em dev (verificado por `process.env.NODE_ENV !== "test"`). Em Vitest, o seed não é chamado (testes usam mocks/services diretamente). 50% functions = `runSeed` (5 linhas) não coberto. **Esperado e aceitável** — seed é caminho de setup, não de runtime.

## 5. Recomendações (se < 85% no gate futuro)

**Gate atual está PASS** (88.21% > 85%). As recomendações abaixo são **para sprints futuras** se quisermos aproximar 90%:

### P1 (próxima sprint, alto impacto)
- Adicionar teste Vitest para `getDizimosByMembro` com FINANCEIRO (camada 3 RBAC, sem Fidelidade não-coberto)
- Adicionar teste Vitest para `marcarResolvido` (ADMIN path)
- Adicionar teste Vitest para filtro `?filter=resolvidos` em `/app/alertas`

### P2 (médio impacto, depende de feature)
- Testar UI components (TabsMembro, CardMembro) com React Testing Library
- Testar fluxo "13º discípulo bloqueado" (boundary 12)

### P3 (baixa prioridade)
- Cobrir branches de ordenação em `ministerios._index.tsx`
- Aumentar coverage de `membros.novo.tsx` (form render branches)

## 6. Por que gate é "lines" e não "branches/functions"

O gate `≥ 85%` em S05 é focado em **lines** porque é o indicador mais estável:
- **Branches** é ruidoso em TypeScript com Zod (cada `z.enum` cria múltiplos branches sintéticos).
- **Functions** é ruidoso em componentes React (cada sub-componente conta).

**Lines** é o que importa: 88.21% das linhas executáveis foram exercitadas, o que é **acima do gate MVP (85%)**.

## 7. Histórico de coverage (sprint-over-sprint)

| Sprint | Lines   | Δ       | Status     |
|--------|---------|---------|------------|
| S00    | 94.08%  | (base)  | PASS       |
| S01    | 89.31%  | -4.77   | PASS (rework 0) |
| S02    | 86.69%  | -2.62   | PASS (rework 1: 72%→86.69%) |
| S03    | 86.86%  | +0.17   | PASS       |
| S04    | 88.21%  | +1.35   | PASS       |
| **S05**| **88.21%** | **0.00** | **PASS** (gate 85% ✅) |

**S05 mantém a baseline de S04** porque o trabalho desta sprint é auditoria + smoke E2E, não feature nova. Adicionar feature nova em S06 deve trazer Δ negativo (esperado) — planejar rework com antecedência.

## 8. Conclusão

**Gate S05-T05 (Coverage ≥ 85%):** **PASS**

- 88.21% lines (898/1018) ✅
- 86.76% statements (944/1088) ✅
- Branches/functions abaixo de 85% mas não-bloqueantes
- 1 arquivo < 50% (`app/routes/app.tsx`, layout-only, esperado)
- 9 arquivos 50-85% (sobretudo rotas com placeholders/UI components)
- Services críticos (`.server.ts`) em **100%** ou próximos
