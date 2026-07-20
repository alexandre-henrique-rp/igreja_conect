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
