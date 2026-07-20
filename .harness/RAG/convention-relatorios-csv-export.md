---
title: "Convenção — Exportação CSV de Relatórios Financeiros (RFC 4180 + BOM)"
category: convention
applies_to:
  - app/lib/relatorios-csv.server.ts
  - app/routes/app/financeiro/relatorios/customizado.tsx
  - app/components/FiltrosPeriodo.tsx
created: 2026-06-20
updated: 2026-06-20
version: 1.0
status: approved
priority: high
sources:
  - brief-relatorios.md §4.1.5 (exportarLancamentosCSV)
  - brief-relatorios.md §5.2 (CSV no escopo, PDF diferido)
  - RFC 4180 (CSV format specification)
  - .harness/RAG/convention-monetary-values.md (centavos + formatBRLFromCents)
  - .harness/RAG/security-rbac-matrix.md (RBAC fina)
tags: [convention, csv, rfc-4180, relatorios, export, excel, pt-br, ciclo-4]
owner: rag-curator
---

## 1. Contexto

O **ciclo 4 (Relatórios Financeiros)** entrega exportação **CSV** no Relatório Customizado (botão "Exportar CSV" em `/app/financeiro/relatorios/customizado`). A escolha de CSV sobre PDF está justificada em `brief-relatorios.md §5.2` (sem dependências externas novas — `puppeteer` ~250MB evitado). CSV cobre o caso real: abrir no Excel/Google Sheets e pivotar.

Exportar CSV para uma igreja brasileira exige **3 decisões técnicas não-óbvias** que, se ignoradas, geram arquivo ilegível ou dados corrompidos:

1. **Encoding:** sem UTF-8 BOM, Excel pt-BR abre o arquivo com encoding Latin-1 e renderiza "São Paulo" como "SÃ£o Paulo". **Decisão:** UTF-8 com BOM (`EF BB BF` nos 3 primeiros bytes).
2. **Separador:** CSV padrão usa vírgula, mas Excel pt-BR (e Sheets em pt-BR) tem vírgula como separador decimal. Usar `,` em CSV gera ambiguidade (ex: `12,50` é `12.5` ou `12,50`?). **Decisão:** separador `;` (ponto-e-vírgula), que é o padrão informal pt-BR para Excel.
3. **Escape:** aspas duplas dentro do campo (ex: descrição `Dízimo "Maria"`) precisam ser duplicadas conforme RFC 4180. **Decisão:** aspas duplas ao redor de campos com caracteres especiais + aspas internas duplicadas.

Esta convenção materializa essas 3 decisões + 4 detalhes secundários (formato de data, formato de valor BRL, ordem de colunas, nome do arquivo) em uma regra única e reproduzível.

## 2. Decisão / Regra

### 2.1 Especificação canônica do CSV exportado

| Aspecto | Decisão | Justificativa |
|---|---|---|
| **Encoding** | UTF-8 com BOM (3 bytes `EF BB BF` no início) | Excel pt-BR sem BOM renderiza acentos como mojibake |
| **Separador de campos** | `;` (ponto-e-vírgula) | Vírgula conflita com decimal pt-BR |
| **Separador de linhas** | `\r\n` (CRLF) | RFC 4180, compatível com Windows + Unix |
| **Quote char** | `"` (aspas duplas) | RFC 4180 |
| **Escape** | Aspas internas duplicadas (`""`) | RFC 4180 §2.7 |
| **Header (linha 1)** | `Data;Descrição;Categoria;Tipo;Caixa;Valor (R$);Membro` | Ordem alfabética-por-tema (temporal → semântico → valor → ator) |
| **Formato de data** | `YYYY-MM-DD` (ISO 8601) | Sheets/Excel reconhece como data; ordenável lexicograficamente |
| **Formato de valor** | `1234.56` (ponto decimal, sem R$, sem vírgula de milhar) | Numérico puro para pivot/ordenação em Sheets/Excel |
| **Nome do arquivo** | `igreja-conect-relatorio-YYYY-MM-DD.csv` | Descritivo + data de geração |
| **Content-Type** | `text/csv; charset=utf-8` | Padrão HTTP |
| **Content-Disposition** | `attachment; filename="<nome>.csv"` | Força download (não abre inline) |
| **Linha final** | Sem linha vazia extra | RFC 4180 §2.2: "The last record in the file may or may not have an ending line break." — adotamos SEM linha extra |

### 2.2 Ordem das colunas (fixa, não-negociável)

```
1. Data (YYYY-MM-DD)
2. Descrição (texto livre, com escape RFC 4180)
3. Categoria (enum CategoriaLancamento em MAIÚSCULAS)
4. Tipo (ENTRADA ou SAIDA)
5. Caixa (nome do caixa)
6. Valor (R$) — header indica moeda, valor é float puro com ponto decimal
7. Membro (nome completo, ou vazio se OFERTA anônima)
```

**Por que essa ordem:** temporal → semântico → valor → ator. Sheets ordena colunas por arrastar-e-soltar; começar com data facilita filtro `A:Z`. Operador financeiro lê em ordem cronológica.

### 2.3 Formato do valor monetário

**Decisão:** `1234.56` (float puro com ponto decimal, sem símbolo R$, sem vírgula de milhar).

```ts
// Conversão centavos → string CSV-friendly
const valorFormatado = (centavos: number): string => {
  return (centavos / 100).toFixed(2); // 1234.56
};

// NUNCA: "R$ 1.234,56" (quebra ordenação e pivot)
// NUNCA: "1234,56" (vírgula conflita com separador de campo)
// NUNCA: "1.234,56" (vírgula de milhar + vírgula decimal ambígua)
```

**Justificativa:** Sheets/Excel reconhece `1234.56` como número (ordenável, somável, aplicável a fórmula `SUM`). `R$ 1.234,56` vira string (sem pivot, sem soma). **Trade-off aceito:** o operador precisa lembrar de aplicar formato BRL no Sheets (`Format > Number > Currency BRL`) — UX aceitável, ganho de interoperabilidade.

### 2.4 Helper `escapeCsvField` (privado, OBRIGATÓRIO)

```ts
// app/lib/relatorios-csv.server.ts

/**
 * @description Escapa um campo conforme RFC 4180 (vírgula/aspas/quebra de linha).
 * @param {string | number | null | undefined} value - Valor a serializar.
 * @returns {string} Campo escapado (com aspas se contém caracteres especiais).
 * @example
 *   escapeCsvField("São Paulo") // 'São Paulo' (sem aspas, sem caracteres especiais)
 *   escapeCsvField('Dízimo "Maria"') // '"Dízimo ""Maria"""' (com aspas + escape)
 *   escapeCsvField("Linha 1\nLinha 2") // '"Linha 1\nLinha 2"' (com aspas)
 */
function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // RFC 4180 §2.6: campos com vírgula, aspas ou quebra de linha DEVEM ser quoted.
  if (/[",\r\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
```

**Atenção:** o regex `/[",\r\n;]/` inclui `;` (nosso separador). Campos sem esses caracteres vão crus (mais legível, menor arquivo).

### 2.5 Helper `formatValorCsv`

```ts
/**
 * @description Formata Int (cents) para string CSV-friendly: "1234.56".
 * @param {number} centavos - Valor em centavos (Int).
 * @returns {string} Valor com 2 casas decimais e ponto decimal.
 * @example
 *   formatValorCsv(12345) // "123.45"
 *   formatValorCsv(0) // "0.00"
 *   formatValorCsv(-12345) // "-123.45" (SAÍDA com sinal negativo)
 */
function formatValorCsv(centavos: number): string {
  // .toFixed(2) arredonda para 2 casas — não há risco aqui porque Int é exato.
  return (centavos / 100).toFixed(2);
}
```

**Por que não `formatBRLFromCents`:** `formatBRLFromCents(12345)` retorna `"R$ 123,45"`, que é o que NÃO queremos em CSV. Em CSV, valor é numérico puro. BRL só na UI.

**Sinal negativo para SAÍDA:** `Lancamento.tipo = "SAIDA"` gera valor com sinal negativo (`-123.45`). Isso facilita fórmulas no Sheets (`=SUM(F2:F)` retorna líquido sem precisar de filtro). Trade-off: precisa documentar na UX que SAÍDA = negativo (badge vermelha na UI já cobre).

### 2.6 Helper `montarCabecalhoCsv`

```ts
/**
 * @description Retorna a string de cabeçalho CSV (linha 1, com separador `;`).
 * @returns {string} Linha de cabeçalho com 7 colunas.
 */
function montarCabecalhoCsv(): string {
  return "Data;Descrição;Categoria;Tipo;Caixa;Valor (R$);Membro";
}
```

### 2.7 Função pública `exportarLancamentosCSV`

```ts
// app/lib/relatorios-csv.server.ts

/**
 * @description Exporta lançamentos filtrados em CSV (RFC 4180 + BOM).
 * @param {RelatorioCustomizadoFiltros} filtros - Filtros validados pelo loader.
 * @param {SessionUser} user - Usuário autenticado.
 * @returns {Promise<string>} Conteúdo CSV completo (BOM + header + linhas + CRLF).
 * @throws {Response} 403 se user não tem cargo em RELATORIOS_CARGOS.
 * @example
 *   const csv = await exportarLancamentosCSV(filtros, user);
 *   // csv.startsWith("﻿") === true (BOM presente)
 *   // csv.split("\r\n")[0] === "Data;Descrição;..."
 */
export async function exportarLancamentosCSV(
  filtros: RelatorioCustomizadoFiltros,
  user: SessionUser
): Promise<string> {
  // CAMADA 3 — PRIMEIRO, antes de qualquer I/O.
  assertCanSeeRelatorios(user);

  // Query: findMany com filtros (mesmo do getRelatorioCustomizado)
  const lancamentos = await prisma.lancamento.findMany({
    where: buildWhere(filtros),
    orderBy: { dataCompetencia: "desc" },
    include: { caixa: { select: { nome: true } }, membro: { select: { nome: true } } },
  });

  // 1. BOM UTF-8 (3 bytes) + cabeçalho + CRLF
  const BOM = "﻿";
  const linhas: string[] = [montarCabecalhoCsv()];

  // 2. Cada lançamento vira 1 linha
  for (const l of lancamentos) {
    const data = l.dataCompetencia.toISOString().slice(0, 10); // YYYY-MM-DD
    const descricao = escapeCsvField(l.descricao);
    const categoria = l.categoria; // já é MAIÚSCULAS pelo enum
    const tipo = l.tipo; // ENTRADA ou SAIDA
    const caixa = escapeCsvField(l.caixa.nome);
    const valor = l.tipo === "ENTRADA"
      ? formatValorCsv(l.valorCentavos)
      : formatValorCsv(-l.valorCentavos); // sinal negativo para SAÍDA
    const membro = l.membro ? escapeCsvField(l.membro.nome) : "";

    linhas.push([data, descricao, categoria, tipo, caixa, valor, membro].join(";"));
  }

  // 3. Junta com CRLF (RFC 4180)
  return BOM + linhas.join("\r\n") + "\r\n"; // CRLF final para conformidade
}
```

### 2.8 Action na rota: download via `Response`

```ts
// app/routes/app/financeiro/relatorios/customizado.tsx (action)
export async function action({ request }: Route.ActionArgs) {
  const user = (await getUser(request))!; // middleware já garante
  const url = new URL(request.url);
  const exportType = url.searchParams.get("export");

  if (exportType !== "csv") {
    return { error: "Tipo de exportação não suportado." };
  }

  // Valida filtros (Zod strict)
  const filtros = RelatorioCustomizadoFiltrosSchema.parse(
    Object.fromEntries(url.searchParams)
  );

  // Gera CSV (Camada 3 chamada aqui dentro)
  const csv = await exportarLancamentosCSV(filtros, user);

  // Response com headers de download
  const dataAtual = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="igreja-conect-relatorio-${dataAtual}.csv"`,
      "Cache-Control": "no-store", // dado financeiro sensível, nunca cachear
    },
  });
}
```

**Atenção:** `Cache-Control: no-store` é **não-negociável** (LGPD + dado financeiro). Mesmo se o operador gerar o mesmo relatório 2× no mesmo segundo, **nunca** cachear.

## 3. Consequências

### 3.1 Positivas

- **Interoperabilidade:** Excel/Sheets abrem corretamente (BOM), ordenam por data (`YYYY-MM-DD` ISO), somam valor (`1234.56` numérico).
- **Auditável:** conteúdo é texto puro legível em qualquer editor. Operador pode abrir no Notepad para verificar.
- **Sem dependência externa:** zero libs. Apenas template strings e helpers de ~30 linhas.
- **RFC 4180 compliant:** qualquer ferramenta que importe CSV (Python pandas, R, SAS, Tableau) reconhece sem configuração adicional.
- **Testável:** helpers `escapeCsvField` e `formatValorCsv` são funções puras. 100% de cobertura é trivial.

### 3.2 Trade-offs aceitos

- **Tamanho do arquivo:** ~100 bytes por linha. Para 5.000 lançamentos/mês, ~500KB. Aceitável.
- **UX no Sheets:** operador precisa aplicar formato BRL manualmente. Documentado no tooltip do botão "Exportar CSV".
- **Sem formulas dinâmicas:** CSV não suporta fórmulas Excel (ex: `=SUM(F:F)`). Para isso, abrir no Sheets e aplicar manualmente. Alternativa seria XLSX, mas requer lib (`xlsx`/`exceljs` ~150KB).
- **Encoding limite:** caracteres fora do BMP (emojis 🎉, símbolos matemáticos 𝛼) podem renderizar mal no Excel < 2016. Mitigação: warning na UI ("Evite emojis em descrições").

## 4. Exemplos

### 4.1 Exemplo de CSV gerado (3 linhas + header)

```
﻿Data;Descrição;Categoria;Tipo;Caixa;Valor (R$);Membro
2026-06-15;Dízimo mensal;OFERTA;ENTRADA;Caixa Geral;500.00;Maria Silva
2026-06-15;Dízimo "Maria" (recorrente);DIZIMO;ENTRADA;Caixa Geral;350.00;Maria Silva
2026-06-14;Conta de luz junho;DESPESA_OPERACIONAL;SAIDA;Caixa Geral;-285.40;
2026-06-10;Compra de 50 un. papel A4;COMPRA_ESTOQUE;SAIDA;Caixa Geral;-125.00;
```

Note: linhas 3 e 4 não têm nome de membro (campo vazio entre `;` final e quebra de linha).

### 4.2 Exemplo de escape de aspas (RFC 4180)

**Input:** descrição `Dízimo "Maria" (recorrente)`

**Output CSV:** `2026-06-15;Dízimo ""Maria"" (recorrente);DIZIMO;ENTRADA;Caixa Geral;350.00;Maria Silva`

**Leitura no Sheets/Excel:** o parser identifica aspas duplas, trata `""` como `"` literal, e retorna `Dízimo "Maria" (recorrente)`.

### 4.3 Exemplo de teste (TDD antes do código)

```ts
// app/lib/relatorios-csv.server.test.ts
import { describe, it, expect } from "vitest";
// helpers privados são testáveis exportando-os ou via spy
import { exportarLancamentosCSV } from "./relatorios-csv.server";
import { criarMembroAdmin, criarLancamento } from "./finance.server.test-helpers";

describe("relatorios-csv — exportarLancamentosCSV", () => {
  it("inclui BOM UTF-8 nos 3 primeiros bytes", async () => {
    const user = await criarMembroAdmin();
    const csv = await exportarLancamentosCSV({}, user);
    const bytes = new TextEncoder().encode(csv);
    expect(bytes[0]).toBe(0xEF);
    expect(bytes[1]).toBe(0xBB);
    expect(bytes[2]).toBe(0xBF);
  });

  it("header é a primeira linha após BOM", async () => {
    const user = await criarMembroAdmin();
    const csv = await exportarLancamentosCSV({}, user);
    expect(csv.split("\r\n")[0].slice(1)).toBe("Data;Descrição;Categoria;Tipo;Caixa;Valor (R$);Membro");
  });

  it("SAÍDA gera valor com sinal negativo", async () => {
    const user = await criarMembroAdmin();
    await criarLancamento({ tipo: "SAIDA", categoria: "DESPESA_OPERACIONAL", valorCentavos: 12345 }, user);
    const csv = await exportarLancamentosCSV({}, user);
    expect(csv).toContain(";-123.45;");
  });

  it("escape RFC 4180: aspas internas viram aspas duplas", async () => {
    const user = await criarMembroAdmin();
    await criarLancamento({ descricao: 'Dízimo "Maria"', valorCentavos: 10000 }, user);
    const csv = await exportarLancamentosCSV({}, user);
    expect(csv).toContain('Dízimo ""Maria""');
  });

  it("descrição com vírgula é quoted", async () => {
    const user = await criarMembroAdmin();
    await criarLancamento({ descricao: "Compra papel, caneta, etc", valorCentavos: 5000 }, user);
    const csv = await exportarLancamentosCSV({}, user);
    expect(csv).toContain('"Compra papel, caneta, etc"');
  });

  it("SECRETARIO recebe 403 (Camada 3)", async () => {
    const user = await criarMembroSecretario();
    await expect(exportarLancamentosCSV({}, user)).rejects.toThrow();
  });

  it("performance: 1280 lançamentos em < 500ms", async () => {
    const user = await criarMembroAdmin();
    for (let i = 0; i < 1280; i++) {
      await criarLancamento({ tipo: "ENTRADA", categoria: "DIZIMO", valorCentavos: 1000 }, user);
    }
    const t0 = Date.now();
    const csv = await exportarLancamentosCSV({}, user);
    const t1 = Date.now();
    expect(t1 - t0).toBeLessThan(500);
    expect(csv.split("\r\n").length).toBeGreaterThanOrEqual(1280);
  });
});
```

## 5. Anti-exemplos

### ❌ Errado: CSV sem BOM

```ts
// NUNCA FAÇA — Excel pt-BR abre com Latin-1 e quebra acentos
const csv = "Data;Descrição;C...;";
return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8" } });
```

**Por que errado:** sem BOM (`EF BB BF`), Excel pt-BR assume Latin-1 (Windows-1252). "São Paulo" vira "SÃ£o Paulo". Sheets às vezes detecta automaticamente, às vezes não — comportamento imprevisível.

### ❌ Errado: separador `,` em vez de `;`

```ts
// NUNCA FAÇA — vírgula conflita com decimal pt-BR
const csv = "Data,Descrição,Valor\n2026-06-15,Dízimo,\"R$ 12,50\"";
```

**Por que errado:** Excel pt-BR tem vírgula como decimal. Campo `"R$ 12,50"` é interpretado como `12.50` (correto) ou `12,50` (string, depende do locale). Ambiguidade gera dados corrompidos em fórmulas.

### ❌ Errado: valor com `R$` e vírgula de milhar

```ts
// NUNCA FAÇA — quebra ordenação e pivot
valor: formatBRLFromCents(12345) // "R$ 123,45"
```

**Por que errado:** Sheets trata `"R$ 123,45"` como string. `=SUM(F:F)` retorna `0`. Operador não consegue pivotar nem somar.

### ❌ Errado: usar `Buffer` ou libs externas para gerar CSV

```ts
// NUNCA FAÇA — dependência externa sem ganho
import Papa from "papaparse";
const csv = Papa.unparse(rows);
```

**Por que errado:** a) `papaparse` adiciona ~50KB ao bundle; b) API menos type-safe; c) não precisamos de parsing CSV (só escrita); d) `papaparse` por padrão usa `,` (nosso padrão é `;`). Helpers de ~30 linhas bastam.

### ❌ Errado: esquecer `Cache-Control: no-store`

```ts
// NUNCA FAÇA — dado financeiro sensível pode ser cacheado por browser/proxy
return new Response(csv, {
  headers: { "Content-Type": "text/csv; charset=utf-8" },
});
```

**Por que errado:** LGPD + dado financeiro sensível. Mesmo se o operador regerar o relatório 2× no mesmo segundo, **nunca** cachear (nem browser, nem proxy corporativo, nem CDN).

### ❌ Errado: usar `\n` em vez de `\r\n`

```ts
// NUNCA FAÇA — quebra abertura no Excel Windows
const csv = linhas.join("\n");
```

**Por que errado:** RFC 4180 §2.2: "Each record is located on a separate line, delimited by a line break (CRLF)." Excel Windows antigo não aceita `\n` sozinho. Use sempre `\r\n`.

## 6. Cross-refs

- **`.harness/RAG/convention-monetary-values.md`** — `formatBRLFromCents` (UI) vs. `formatValorCsv` (CSV). São **diferentes** propositadamente.
- **`.harness/RAG/pattern-relatorios-aggregations.md`** — service irmão `getRelatorioCustomizado` que alimenta `exportarLancamentosCSV`. Mesmo padrão de `assertCanSeeRelatorios` + soma em `Int`.
- **`.harness/RAG/security-rbac-matrix.md`** — `RELATORIOS_CARGOS` (3 perfis) é quem pode exportar. SECRETARIO recebe 403.
- **`.harness/RAG/lgpd-igreja-conect.md`** — `Cache-Control: no-store` é mandatório (LGPD Art. 46). Logs de auditoria **nunca** registram conteúdo do CSV.
- **`brief-relatorios.md`** §4.1.5 — assinatura canônica de `exportarLancamentosCSV`.
- **`brief-relatorios.md`** §5.2 — decisão de CSV no escopo, PDF diferido. Justificativa de `;` + BOM + RFC 4180.
- **RFC 4180** — especificações formais de CSV (Mozilla, IETF draft).

## 7. Notas de aplicação / Audit trail

- **Criado em:** 2026-06-20 (Fase 1, ciclo 4 — Relatórios Financeiros).
- **Por:** `documenter` agent (delega para `rag-curator` conforme escopo da Fase 1).
- **Audit:** aplicável em todo PR que tocar `app/lib/relatorios-csv.server.ts` ou action de `/app/financeiro/relatorios/customizado?export=csv`. Code review deve validar:
  1. BOM UTF-8 presente nos 3 primeiros bytes.
  2. Separador `;` (não `,`).
  3. CRLF (`\r\n`) entre linhas (não apenas `\n`).
  4. Valor sem `R$` e sem vírgula de milhar.
  5. SAÍDA com sinal negativo.
  6. `Cache-Control: no-store` no response.
  7. `Content-Disposition: attachment` (força download).
  8. `Content-Type: text/csv; charset=utf-8`.
  9. `assertCanSeeRelatorios(user)` como primeira linha do service (Camada 3).
  10. Testes cobrem: BOM, header, escape RFC 4180, sinal negativo, SECRETARIO 403, performance 1280 linhas < 500ms.
- **Quando revisar:** ao adicionar nova coluna, novo formato de valor, ou mudar de CSV para XLSX/PDF (decisão futura de ciclo 6+).
- **Trabalho futuro (backlog, fora do ciclo 4):**
  - Avaliar migração para XLSX (formato nativo Excel, suporta fórmulas, requer lib `exceljs` ~150KB).
  - Avaliar PDF (requer `puppeteer` ou `pdfkit` — peso considerável).
  - Adicionar opção de agendamento de exportação por e-mail (sem SMTP hoje, alinhado com `brief-mvp-financeiro.md §8`).
