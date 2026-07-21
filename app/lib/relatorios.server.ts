/**
 * Service de Relatórios Financeiros — Igreja Conect.
 *
 * Funções para buscar dados reais do banco para os relatórios:
 * - DRE (Demonstração de Resultado)
 * - Balancete Mensal
 * - Fluxo de Caixa
 * - Relatório Customizado
 */
import { prisma } from "~/db/prisma.server";
import type { SessionUser } from "./session.types";

/**
 * Busca dados do DRE para um período específico.
 */
export async function getDRE(
  user: SessionUser,
  dataInicio: Date,
  dataFim: Date,
) {
  const lancamentos = await prisma.lancamento.findMany({
    where: {
      dataCompetencia: {
        gte: dataInicio,
        lte: dataFim,
      },
    },
    include: {
      caixa: { select: { id: true, nome: true } },
    },
  });

  const entradas = lancamentos.filter((l) => l.tipo === "ENTRADA");
  const saidas = lancamentos.filter((l) => l.tipo === "SAIDA");

  const totalEntradasCentavos = entradas.reduce(
    (sum: number, l: any) => sum + l.valorCentavos,
    0,
  );
  const totalSaidasCentavos = saidas.reduce(
    (sum: number, l: any) => sum + l.valorCentavos,
    0,
  );
  const resultadoCentavos = totalEntradasCentavos - totalSaidasCentavos;

  const entradasPorCategoria = entradas.reduce(
    (acc: Record<string, number>, l: any) => {
      const key = l.categoria;
      if (!acc[key]) acc[key] = 0;
      acc[key] += l.valorCentavos;
      return acc;
    },
    {} as Record<string, number>,
  );

  const entradasPorTipo = Object.entries(entradasPorCategoria).map(
    ([tipo, valorCentavos]: [string, number]) => ({
      tipo: formatCategoriaNome(tipo),
      valorCentavos,
      percentual:
        totalEntradasCentavos > 0
          ? Math.round((valorCentavos / totalEntradasCentavos) * 100)
          : 0,
      cor: getCategoriaColor(tipo),
    }),
  );

  const saidasPorCategoriaMap = saidas.reduce(
    (acc: Record<string, { valor: number; count: number }>, l: any) => {
      const key = l.categoria;
      if (!acc[key]) {
        acc[key] = { valor: 0, count: 0 };
      }
      acc[key].valor += l.valorCentavos;
      acc[key].count += 1;
      return acc;
    },
    {} as Record<string, { valor: number; count: number }>,
  );

  const saidasPorCategoria = Object.entries(saidasPorCategoriaMap).map(
    ([categoria, data]: [string, any]) => ({
      categoria: formatCategoriaNome(categoria),
      valorCentavos: data.valor,
      transacoes: data.count,
      percentual:
        totalSaidasCentavos > 0
          ? Math.round((data.valor / totalSaidasCentavos) * 100)
          : 0,
      cor: getCategoriaColor(categoria),
    }),
  );

  return {
    periodo: {
      dataInicio: dataInicio.toISOString().split("T")[0],
      dataFim: dataFim.toISOString().split("T")[0],
    },
    kpis: {
      totalEntradasCentavos,
      totalSaidasCentavos,
      resultadoCentavos,
    },
    entradasPorTipo,
    saidasPorCategoria,
  };
}

/**
 * Busca dados do Balancete para um mês específico.
 */
export async function getBalanceteMensal(
  user: SessionUser,
  ano: number,
  mes: number,
) {
  const dataInicio = new Date(ano, mes - 1, 1);
  const dataFim = new Date(ano, mes, 0, 23, 59, 59);

  const lancamentosMes = await prisma.lancamento.findMany({
    where: {
      dataCompetencia: {
        gte: dataInicio,
        lte: dataFim,
      },
    },
  });

  const mesAnteriorInicio = new Date(ano, mes - 2, 1);
  const mesAnteriorFim = new Date(ano, mes - 1, 0, 23, 59, 59);
  const lancamentosMesAnterior = await prisma.lancamento.findMany({
    where: {
      dataCompetencia: {
        gte: mesAnteriorInicio,
        lte: mesAnteriorFim,
      },
    },
  });

  const saldoAnteriorCentavos = lancamentosMesAnterior.reduce(
    (sum: number, l: any) => {
      return l.tipo === "ENTRADA"
        ? sum + l.valorCentavos
        : sum - l.valorCentavos;
    },
    0,
  );

  const entradasCentavos = lancamentosMes
    .filter((l) => l.tipo === "ENTRADA")
    .reduce((sum: number, l: any) => sum + l.valorCentavos, 0);

  const saidasCentavos = lancamentosMes
    .filter((l) => l.tipo === "SAIDA")
    .reduce((sum: number, l: any) => sum + l.valorCentavos, 0);

  const saldoAtualCentavos =
    saldoAnteriorCentavos + entradasCentavos - saidasCentavos;

  const entradasMesAnterior = lancamentosMesAnterior
    .filter((l) => l.tipo === "ENTRADA")
    .reduce((sum: number, l: any) => sum + l.valorCentavos, 0);

  const saidasMesAnterior = lancamentosMesAnterior
    .filter((l) => l.tipo === "SAIDA")
    .reduce((sum: number, l: any) => sum + l.valorCentavos, 0);

  const variacaoEntradas =
    entradasMesAnterior > 0
      ? ((entradasCentavos - entradasMesAnterior) / entradasMesAnterior) * 100
      : 0;

  const variacaoSaidas =
    saidasMesAnterior > 0
      ? ((saidasCentavos - saidasMesAnterior) / saidasMesAnterior) * 100
      : 0;

  const categoriasMap = lancamentosMes.reduce(
    (acc: Record<string, { entradas: number; saidas: number }>, l: any) => {
      const key = l.categoria;
      if (!acc[key]) {
        acc[key] = { entradas: 0, saidas: 0 };
      }
      if (l.tipo === "ENTRADA") {
        acc[key].entradas += l.valorCentavos;
      } else {
        acc[key].saidas += l.valorCentavos;
      }
      return acc;
    },
    {} as Record<string, { entradas: number; saidas: number }>,
  );

  const categorias = Object.entries(categoriasMap).map(
    ([nome, data]: [string, any]) => ({
      nome: formatCategoriaNome(nome),
      entradasCentavos: data.entradas,
      saidasCentavos: data.saidas,
      cor: getCategoriaColor(nome),
    }),
  );

  const projecao = {
    saldoEstimadoCentavos:
      saldoAtualCentavos + (entradasCentavos - saidasCentavos),
    percentualBarra: Math.min(
      100,
      Math.max(0, (saldoAtualCentavos / (saldoAnteriorCentavos * 1.5)) * 100),
    ),
    tendencia: entradasCentavos > saidasCentavos ? "crescimento" : "redução",
  };

  return {
    periodo: `${ano}-${String(mes).padStart(2, "0")}`,
    kpis: {
      saldoAnteriorCentavos,
      entradasCentavos,
      saidasCentavos,
      saldoAtualCentavos,
      variacaoEntradas: Math.round(variacaoEntradas * 10) / 10,
      variacaoSaidas: Math.round(variacaoSaidas * 10) / 10,
    },
    categorias,
    projecao: {
      ...projecao,
      tendencia:
        projecao.tendencia === "crescimento"
          ? `crescimento +${Math.round(variacaoEntradas)}%`
          : `redução ${Math.round(Math.abs(variacaoSaidas))}%`,
    },
  };
}

/**
 * Busca dados do Fluxo de Caixa para um período específico.
 */
export async function getFluxoCaixa(
  user: SessionUser,
  dataInicio: Date,
  dataFim: Date,
) {
  const lancamentos = await prisma.lancamento.findMany({
    where: {
      dataCompetencia: {
        gte: dataInicio,
        lte: dataFim,
      },
    },
    orderBy: { dataCompetencia: "asc" },
  });

  const lancamentosAnteriores = await prisma.lancamento.findMany({
    where: {
      dataCompetencia: { lt: dataInicio },
    },
  });

  const saldoInicialCentavos = lancamentosAnteriores.reduce(
    (sum: number, l: any) => {
      return l.tipo === "ENTRADA"
        ? sum + l.valorCentavos
        : sum - l.valorCentavos;
    },
    0,
  );

  const entradas = lancamentos
    .filter((l) => l.tipo === "ENTRADA")
    .map((l) => ({
      data: l.dataCompetencia.toISOString().split("T")[0],
      descricao: l.descricao || formatCategoriaNome(l.categoria),
      valorCentavos: l.valorCentavos,
      categoria: formatCategoriaNome(l.categoria),
    }));

  const saidas = lancamentos
    .filter((l) => l.tipo === "SAIDA")
    .map((l) => ({
      data: l.dataCompetencia.toISOString().split("T")[0],
      descricao: l.descricao || formatCategoriaNome(l.categoria),
      valorCentavos: l.valorCentavos,
      categoria: formatCategoriaNome(l.categoria),
    }));

  const saldoFinalCentavos =
    saldoInicialCentavos +
    entradas.reduce((sum: number, e: any) => sum + e.valorCentavos, 0) -
    saidas.reduce((sum: number, s: any) => sum + s.valorCentavos, 0);

  return {
    periodo: {
      dataInicio: dataInicio.toISOString().split("T")[0],
      dataFim: dataFim.toISOString().split("T")[0],
    },
    saldoInicialCentavos,
    entradas,
    saidas,
    saldoFinalCentavos,
  };
}

/**
 * Busca dados para relatório customizado com filtros.
 */
export async function getRelatorioCustomizado(
  user: SessionUser,
  filtros: {
    dataInicio?: Date;
    dataFim?: Date;
    caixaId?: string;
    categoria?: string;
    tipo?: "ENTRADA" | "SAIDA";
  },
) {
  const where: any = {};

  if (filtros.dataInicio && filtros.dataFim) {
    where.dataCompetencia = {
      gte: filtros.dataInicio,
      lte: filtros.dataFim,
    };
  }

  if (filtros.caixaId) {
    where.caixaId = filtros.caixaId;
  }

  if (filtros.categoria) {
    where.categoria = filtros.categoria;
  }

  if (filtros.tipo) {
    where.tipo = filtros.tipo;
  }

  const lancamentos = await prisma.lancamento.findMany({
    where,
    include: {
      caixa: { select: { nome: true } },
    },
    orderBy: { dataCompetencia: "desc" },
  });

  const lancamentosFormatados = lancamentos.map((l) => ({
    id: l.id,
    data: l.dataCompetencia.toISOString().split("T")[0],
    tipo: l.tipo,
    categoria: formatCategoriaNome(l.categoria),
    descricao: l.descricao || "-",
    valorCentavos: l.valorCentavos,
    caixa: l.caixa.nome,
    status: l.status,
  }));

  const entradasCentavos = lancamentosFormatados
    .filter((l) => l.tipo === "ENTRADA")
    .reduce((sum: number, l: any) => sum + l.valorCentavos, 0);

  const saidasCentavos = lancamentosFormatados
    .filter((l) => l.tipo === "SAIDA")
    .reduce((sum: number, l: any) => sum + l.valorCentavos, 0);

  return {
    filtros: {
      dataInicio: filtros.dataInicio?.toISOString().split("T")[0],
      dataFim: filtros.dataFim?.toISOString().split("T")[0],
      caixaId: filtros.caixaId,
      categoria: filtros.categoria
        ? formatCategoriaNome(filtros.categoria)
        : undefined,
      tipo: filtros.tipo,
    },
    lancamentos: lancamentosFormatados,
    totais: {
      entradasCentavos,
      saidasCentavos,
      saldoCentavos: entradasCentavos - saidasCentavos,
    },
  };
}

function formatCategoriaNome(categoria: string): string {
  const nomes: Record<string, string> = {
    DIZIMO: "Dízimo",
    OFERTA: "Oferta",
    CAMPANHA: "Campanha",
    DESPESA_OPERACIONAL: "Despesa Operacional",
    COMPRA_ESTOQUE: "Compra de Estoque",
    MANUTENCAO: "Manutenção",
    TRANSFERENCIA: "Transferência",
  };
  return nomes[categoria] || categoria;
}

function getCategoriaColor(categoria: string): string {
  const cores: Record<string, string> = {
    DIZIMO: "bg-blue-500",
    OFERTA: "bg-indigo-500",
    CAMPANHA: "bg-emerald-500",
    DESPESA_OPERACIONAL: "bg-red-400",
    COMPRA_ESTOQUE: "bg-orange-400",
    MANUTENCAO: "bg-amber-400",
    TRANSFERENCIA: "bg-slate-300",
  };
  return cores[categoria] || "bg-slate-400";
}

/**
 * Faz escape de um valor para CSV (RFC 4180):
 * - Se contém vírgula, aspas ou quebra de linha, envolve em aspas duplas
 * - Aspas duplas internas são duplicadas
 */
function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Formata um valor em centavos para BRL (12345 → "123,45")
 * Mantém precisão sem perder os centavos.
 */
function formatBRLFromCentsInline(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * Exporta lançamentos filtrados como CSV (Content-Type: text/csv; charset=utf-8).
 *
 * **Formato:** cabeçalho + 1 linha por lançamento com vírgulas escapadas.
 *
 * Colunas (em ordem):
 * 1. data (YYYY-MM-DD)
 * 2. descricao
 * 3. categoria (label PT-BR)
 * 4. tipo (ENTRADA|SAIDA)
 * 5. valor (BRL, vírgula)
 * 6. valorCentavos
 * 7. caixa (nome)
 * 8. membro (nome ou vazio)
 * 9. status (PAGO|PENDENTE|AGENDADO)
 *
 * @example
 *   const csv = await exportarLancamentosCSV(user, { dataInicio, dataFim });
 *   return new Response(csv, {
 *     headers: {
 *       "Content-Type": "text/csv; charset=utf-8",
 *       "Content-Disposition": `attachment; filename="lancamentos-${dataInicio}.csv"`,
 *     },
 *   });
 */
export async function exportarLancamentosCSV(
  user: SessionUser,
  filtros: {
    dataInicio?: Date;
    dataFim?: Date;
    caixaId?: string;
    categoria?: string;
    tipo?: "ENTRADA" | "SAIDA";
  },
): Promise<string> {
  // RBAC: SECRETARIO não vê dízimos
  const where: Record<string, unknown> = {};
  if (filtros.dataInicio && filtros.dataFim) {
    where.dataCompetencia = {
      gte: filtros.dataInicio,
      lte: filtros.dataFim,
    };
  }
  if (filtros.caixaId) where.caixaId = filtros.caixaId;
  if (filtros.categoria) where.categoria = filtros.categoria;
  if (filtros.tipo) where.tipo = filtros.tipo;
  if (user.cargo === "SECRETARIO") {
    where.categoria = { not: "DIZIMO" };
  }

  const lancamentos = await prisma.lancamento.findMany({
    where,
    orderBy: { dataCompetencia: "asc" },
    include: {
      caixa: { select: { nome: true } },
      membro: { select: { nome: true } },
    },
  });

  const header = [
    "data",
    "descricao",
    "categoria",
    "tipo",
    "valor",
    "valorCentavos",
    "caixa",
    "membro",
    "status",
  ];

  const rows = lancamentos.map((l) => [
    l.dataCompetencia.toISOString().split("T")[0],
    l.descricao,
    formatCategoriaNome(l.categoria),
    l.tipo,
    formatBRLFromCentsInline(l.valorCentavos),
    l.valorCentavos,
    l.caixa.nome,
    l.membro?.nome ?? "",
    l.status,
  ]);

  // CSV com BOM UTF-8 (Excel abre direto sem mojibake)
  const BOM = "\uFEFF";
  const lines = [
    header.map(csvEscape).join(","),
    ...rows.map((r) => r.map(csvEscape).join(",")),
  ];
  return BOM + lines.join("\r\n") + "\r\n";
}

/**
 * Soma lançamentos PENDENTE ou AGENDADO (contas a pagar).
 */
export async function getContasAPagar(user: SessionUser): Promise<number> {
  const where: Record<string, unknown> = {
    status: { in: ["PENDENTE", "AGENDADO"] },
  };
  if (user.cargo === "SECRETARIO") {
    where.categoria = { not: "DIZIMO" };
  }
  const result = await prisma.lancamento.aggregate({
    where,
    _sum: { valorCentavos: true },
  });
  return result._sum.valorCentavos ?? 0;
}

/**
 * Projeção dos próximos 3 meses baseada na média dos últimos 3 meses.
 */
export async function getProjecao3Meses(
  user: SessionUser,
  dataFim: Date,
): Promise<Array<{ periodo: string; entradasCentavos: number; saidasCentavos: number; saldoCentavos: number }>> {
  const tresMesesAtras = new Date(dataFim.getFullYear(), dataFim.getMonth() - 3, 1);
  const where: Record<string, unknown> = {
    dataCompetencia: { gte: tresMesesAtras, lte: dataFim },
  };
  if (user.cargo === "SECRETARIO") {
    where.categoria = { not: "DIZIMO" };
  }
  const lancamentos = await prisma.lancamento.findMany({
    where,
    select: { tipo: true, valorCentavos: true, dataCompetencia: true },
  });

  const entradas = lancamentos.filter((l) => l.tipo === "ENTRADA").reduce((s, l) => s + l.valorCentavos, 0);
  const saidas = lancamentos.filter((l) => l.tipo === "SAIDA").reduce((s, l) => s + l.valorCentavos, 0);
  const mediaEntradas = Math.round(entradas / 3);
  const mediaSaidas = Math.round(saidas / 3);
  const mediaSaldo = mediaEntradas - mediaSaidas;

  const projecao: Array<{ periodo: string; entradasCentavos: number; saidasCentavos: number; saldoCentavos: number }> = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(dataFim.getFullYear(), dataFim.getMonth() + i, 1);
    projecao.push({
      periodo: d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", ""),
      entradasCentavos: mediaEntradas,
      saidasCentavos: mediaSaidas,
      saldoCentavos: mediaSaldo,
    });
  }
  return projecao;
}

/**
 * Agrega entradas/saídas/saldo por mês para o gráfico de fluxo de caixa.
 */
export async function getFluxoMensal(
  user: SessionUser,
  dataInicio: Date,
  dataFim: Date,
): Promise<Array<{ mes: string; entradasCentavos: number; saidasCentavos: number; saldoCentavos: number }>> {
  const where: Record<string, unknown> = {
    dataCompetencia: { gte: dataInicio, lte: dataFim },
  };
  if (user.cargo === "SECRETARIO") {
    where.categoria = { not: "DIZIMO" };
  }
  const lancamentos = await prisma.lancamento.findMany({
    where,
    select: { tipo: true, valorCentavos: true, dataCompetencia: true },
  });

  const mesesMap: Record<string, { entradas: number; saidas: number }> = {};
  for (const l of lancamentos) {
    const d = new Date(l.dataCompetencia);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    if (!mesesMap[key]) mesesMap[key] = { entradas: 0, saidas: 0 };
    if (l.tipo === "ENTRADA") mesesMap[key].entradas += l.valorCentavos;
    else mesesMap[key].saidas += l.valorCentavos;
  }

  const resultado: Array<{ mes: string; entradasCentavos: number; saidasCentavos: number; saldoCentavos: number }> = [];
  const meses = Object.keys(mesesMap).sort();
  let saldoAcumulado = 0;
  for (const key of meses) {
    const [ano, mes] = key.split("-").map(Number);
    const d = new Date(ano, mes - 1, 1);
    const saldo = mesesMap[key].entradas - mesesMap[key].saidas;
    saldoAcumulado += saldo;
    resultado.push({
      mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase(),
      entradasCentavos: mesesMap[key].entradas,
      saidasCentavos: mesesMap[key].saidas,
      saldoCentavos: saldoAcumulado,
    });
  }
  return resultado;
}

/**
 * Exporta DRE como CSV.
 */
export async function exportarDRECSV(
  user: SessionUser,
  dataInicio: Date,
  dataFim: Date,
): Promise<string> {
  const dados = await getDRE(user, dataInicio, dataFim);
  const BOM = "\uFEFF";
  const lines: string[] = [];

  lines.push("DRE - Demonstracao do Resultado");
  lines.push(`Periodo,${dados.periodo.dataInicio} a ${dados.periodo.dataFim}`);
  lines.push("");
  lines.push("RESUMO");
  lines.push(`Total de Entradas,${formatBRLFromCentsInline(dados.kpis.totalEntradasCentavos)}`);
  lines.push(`Total de Saidas,${formatBRLFromCentsInline(dados.kpis.totalSaidasCentavos)}`);
  lines.push(`Resultado Liquido,${formatBRLFromCentsInline(dados.kpis.resultadoCentavos)}`);
  lines.push("");
  lines.push("ENTRADAS POR TIPO");
  lines.push("Tipo,Valor,Percentual");
  for (const e of dados.entradasPorTipo) {
    lines.push(`${csvEscape(e.tipo)},${formatBRLFromCentsInline(e.valorCentavos)},${e.percentual}%`);
  }
  lines.push("");
  lines.push("SAIDAS POR CATEGORIA");
  lines.push("Categoria,Transacoes,Valor,Percentual");
  for (const s of dados.saidasPorCategoria) {
    lines.push(`${csvEscape(s.categoria)},${s.transacoes},${formatBRLFromCentsInline(s.valorCentavos)},${s.percentual}%`);
  }

  return BOM + lines.join("\r\n") + "\r\n";
}

/**
 * Exporta Balancete Mensal como CSV.
 */
export async function exportarBalanceteCSV(
  user: SessionUser,
  ano: number,
  mes: number,
): Promise<string> {
  const dados = await getBalanceteMensal(user, ano, mes);
  const BOM = "\uFEFF";
  const lines: string[] = [];

  lines.push("Balancete Mensal");
  lines.push(`Periodo,${dados.periodo}`);
  lines.push("");
  lines.push("RESUMO");
  lines.push(`Saldo Anterior,${formatBRLFromCentsInline(dados.kpis.saldoAnteriorCentavos)}`);
  lines.push(`Entradas do Mes,${formatBRLFromCentsInline(dados.kpis.entradasCentavos)}`);
  lines.push(`Saidas do Mes,${formatBRLFromCentsInline(dados.kpis.saidasCentavos)}`);
  lines.push(`Saldo Atual,${formatBRLFromCentsInline(dados.kpis.saldoAtualCentavos)}`);
  lines.push(`Variacao Entradas,${dados.kpis.variacaoEntradas}%`);
  lines.push(`Variacao Saidas,${dados.kpis.variacaoSaidas}%`);
  lines.push("");
  lines.push("RESUMO POR CATEGORIA");
  lines.push("Categoria,Entradas,Saidas,Saldo");
  for (const c of dados.categorias) {
    const saldo = c.entradasCentavos - c.saidasCentavos;
    lines.push(`${csvEscape(c.nome)},${formatBRLFromCentsInline(c.entradasCentavos)},${formatBRLFromCentsInline(c.saidasCentavos)},${formatBRLFromCentsInline(saldo)}`);
  }
  lines.push("");
  lines.push("PROJECAO");
  lines.push(`Saldo Estimado,${formatBRLFromCentsInline(dados.projecao.saldoEstimadoCentavos)}`);
  lines.push(`Tendencia,${dados.projecao.tendencia}`);

  return BOM + lines.join("\r\n") + "\r\n";
}

/**
 * Exporta Fluxo de Caixa como CSV.
 */
export async function exportarFluxoCaixaCSV(
  user: SessionUser,
  dataInicio: Date,
  dataFim: Date,
): Promise<string> {
  const dados = await getFluxoCaixa(user, dataInicio, dataFim);
  const BOM = "\uFEFF";
  const lines: string[] = [];

  lines.push("Fluxo de Caixa");
  lines.push(`Periodo,${dados.periodo.dataInicio} a ${dados.periodo.dataFim}`);
  lines.push("");
  lines.push("RESUMO");
  lines.push(`Saldo Inicial,${formatBRLFromCentsInline(dados.saldoInicialCentavos)}`);
  lines.push(`Saldo Final,${formatBRLFromCentsInline(dados.saldoFinalCentavos)}`);
  lines.push("");
  lines.push("ENTRADAS");
  lines.push("Data,Descricao,Categoria,Valor");
  for (const e of dados.entradas) {
    lines.push(`${e.data},${csvEscape(e.descricao)},${csvEscape(e.categoria)},${formatBRLFromCentsInline(e.valorCentavos)}`);
  }
  lines.push("");
  lines.push("SAIDAS");
  lines.push("Data,Descricao,Categoria,Valor");
  for (const s of dados.saidas) {
    lines.push(`${s.data},${csvEscape(s.descricao)},${csvEscape(s.categoria)},${formatBRLFromCentsInline(s.valorCentavos)}`);
  }

  return BOM + lines.join("\r\n") + "\r\n";
}
