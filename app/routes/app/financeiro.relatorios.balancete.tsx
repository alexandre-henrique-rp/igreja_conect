/**
 * Rota /app/financeiro/relatorios/balancete — Balancete Mensal (cycle 4, S15).
 *
 * Dados reais do banco.
 *
 * @see design/relatorios-balancete.DESIGN.md
 */
import { Form, Link } from "react-router";
import { formatBRLFromCents } from "~/lib/money-format";
import { assertCanSeeRelatorios } from "~/lib/rbac.server";
import {
  exportarBalanceteCSV,
  getBalanceteMensal,
} from "~/lib/relatorios.server";
import { userContext } from "~/lib/user-context";
import type { Route } from "./+types/financeiro.relatorios.balancete";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Balancete Mensal — Igreja Conect" }];
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeRelatorios(user);

  const formData = await request.formData();
  const periodo = formData.get("periodo") as string | null;

  const hoje = new Date();
  const ano = periodo ? parseInt(periodo.split("-")[0]) : hoje.getFullYear();
  const mes = periodo ? parseInt(periodo.split("-")[1]) : hoje.getMonth() + 1;

  const csv = await exportarBalanceteCSV(user, ano, mes);
  const filename = `balancete-${ano}-${String(mes).padStart(2, "0")}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeRelatorios(user);

  const url = new URL(request.url);
  const periodoParam = url.searchParams.get("periodo");

  const hoje = new Date();
  const ano = periodoParam
    ? parseInt(periodoParam.split("-")[0])
    : hoje.getFullYear();
  const mes = periodoParam
    ? parseInt(periodoParam.split("-")[1])
    : hoje.getMonth() + 1;

  const dados = await getBalanceteMensal(user, ano, mes);

  return {
    user,
    ...dados,
  };
}

const IconChevron = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-3 w-3"
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" />
  </svg>
);
const IconPrint = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z" />
  </svg>
);
const IconWallet = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    <path d="M21 7H3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zm-9 7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
  </svg>
);
const IconBalance = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    <path d="M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z" />
  </svg>
);

export default function BalancetePage({ loaderData }: Route.ComponentProps) {
  const { periodo, kpis, categorias, projecao } = loaderData;
  const totalEntradas = categorias.reduce((s, c) => s + c.entradasCentavos, 0);
  const totalSaidas = categorias.reduce((s, c) => s + c.saidasCentavos, 0);
  const totalLiquido = totalEntradas - totalSaidas;

  const mesStr = periodo.split("-")[1];
  const mesNum = parseInt(mesStr);
  const nomesMeses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  const nomeMesAnterior = mesNum > 1 ? nomesMeses[mesNum - 2] : "Dezembro";

  const saidasComPercentual = categorias
    .filter((c) => c.saidasCentavos > 0)
    .map((c) => ({
      nome: c.nome,
      cor: c.cor,
      valor: c.saidasCentavos,
      percentual:
        totalSaidas > 0
          ? Math.round((c.saidasCentavos / totalSaidas) * 100)
          : 0,
    }));
  const donutColors: Record<string, string> = {
    "bg-info": "var(--color-info)",
    "bg-accent": "var(--color-accent)",
    "bg-success": "var(--color-success)",
    "bg-danger": "var(--color-danger)",
    "bg-warning": "var(--color-warning)",
    "bg-border-strong": "var(--color-border-strong)",
  };

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-6 bg-surface-2 min-h-screen">
      {/* Breadcrumb + Header + Seletor de Mês */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <nav className="flex mb-2 text-xs font-medium text-subtle uppercase tracking-wider space-x-2">
            <Link to="/app/financeiro" className="hover:text-accent">
              Financeiro
            </Link>
            <span className="text-border-strong">{IconChevron}</span>
            <Link to="/app/financeiro/relatorios" className="hover:text-accent">
              Relatórios
            </Link>
            <span className="text-border-strong">{IconChevron}</span>
            <span className="text-accent">Balancete</span>
          </nav>
          <h1 className="text-3xl font-bold text-fg tracking-tight">
            Balancete Mensal
          </h1>
          <p className="text-muted text-sm mt-1">
            Resumo detalhado das movimentações financeiras do período.
          </p>
        </div>
        <Form method="get" className="flex items-center space-x-3">
          <input
            name="periodo"
            aria-label="Período"
            className="bg-surface border border-border rounded-lg h-10 px-4 text-sm font-medium focus:border-accent focus:ring-2 focus:ring-accent-soft-2 outline-none transition-all"
            type="month"
            defaultValue={periodo}
          />
          <button
            type="submit"
            className="bg-accent hover:bg-accent text-white font-medium rounded-lg h-10 px-6 flex items-center space-x-2 transition-all shadow-sm active:scale-95"
          >
            <span className="text-white">{IconPrint}</span>
            <span>Atualizar</span>
          </button>
        </Form>
        <Form method="post" className="inline-flex">
          <input type="hidden" name="periodo" value={periodo} />
          <button
            type="submit"
            className="flex items-center gap-2 bg-success text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-success transition-colors h-10"
            title="Exportar Balancete em CSV"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"
              />
            </svg>
            Exportar CSV
          </button>
        </Form>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-surface border border-border p-6 rounded-xl shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-surface-2 text-muted rounded-lg">
              <span className="text-muted">{IconWallet}</span>
            </div>
          </div>
          <p className="text-xs font-medium text-muted uppercase tracking-wider">
            Saldo Anterior
          </p>
          <h3 className="text-2xl font-bold text-fg mt-1 font-mono">
            {formatBRLFromCents(kpis.saldoAnteriorCentavos)}
          </h3>
          <p className="mt-4 text-[11px] font-medium text-subtle">
            Referente a {nomeMesAnterior}
          </p>
        </div>
        <div className="bg-surface border border-border p-6 rounded-xl shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-success-soft text-success rounded-lg">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <span className="text-xs font-medium text-success bg-success-soft px-2 py-0.5 rounded-full">
              ↑ {kpis.variacaoEntradas}%
            </span>
          </div>
          <p className="text-xs font-medium text-muted uppercase tracking-wider">
            Entradas do Mês
          </p>
          <h3 className="text-2xl font-bold text-success mt-1 font-mono">
            {formatBRLFromCents(kpis.entradasCentavos)}
          </h3>
        </div>
        <div className="bg-surface border border-border p-6 rounded-xl shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-danger-soft text-danger rounded-lg">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6"
                />
              </svg>
            </div>
            <span className="text-xs font-medium text-danger bg-danger-soft px-2 py-0.5 rounded-full">
              ↓ {kpis.variacaoSaidas}%
            </span>
          </div>
          <p className="text-xs font-medium text-muted uppercase tracking-wider">
            Saídas do Mês
          </p>
          <h3 className="text-2xl font-bold text-danger mt-1 font-mono">
            {formatBRLFromCents(kpis.saidasCentavos)}
          </h3>
        </div>
        <div className="bg-surface border border-border p-6 rounded-xl shadow-sm hover:shadow-md transition-all border-l-4 border-l-accent">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-accent-soft-2 text-accent rounded-lg">
              <span className="text-accent">{IconBalance}</span>
            </div>
            <span className="text-xs font-medium text-accent bg-accent-soft-2 px-2 py-0.5 rounded-full">
              +
              {formatBRLFromCents(
                kpis.saldoAtualCentavos - kpis.saldoAnteriorCentavos,
              )}
            </span>
          </div>
          <p className="text-xs font-medium text-muted uppercase tracking-wider">
            Saldo Atual
          </p>
          <h3 className="text-2xl font-bold text-accent mt-1 font-mono">
            {formatBRLFromCents(kpis.saldoAtualCentavos)}
          </h3>
          <p className="mt-4 text-[11px] font-medium text-subtle">
            Resultado Líquido do Período
          </p>
        </div>
      </div>

      {/* Tabela + Donut + Projeção */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tabela Resumo por Categoria */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-surface-2 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-fg">
              Resumo por Categoria
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
<caption className="sr-only">Balancete mensal por categoria</caption>
              <thead className="bg-surface-2 border-b border-border">
                <tr>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold text-muted uppercase">
                    Categoria
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold text-muted uppercase text-right">
                    Entradas
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold text-muted uppercase text-right">
                    Saídas
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold text-muted uppercase text-right">
                    Saldo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-2">
                {categorias.map((c) => {
                  const saldo = c.entradasCentavos - c.saidasCentavos;
                  return (
                    <tr
                      key={c.nome}
                      className="hover:bg-surface-2 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div
                            className={`w-2 h-2 rounded-full ${c.cor} mr-3`}
                          ></div>
                          <span className="text-sm font-medium text-fg">
                            {c.nome}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-success font-medium">
                        {c.entradasCentavos > 0 ? (
                          formatBRLFromCents(c.entradasCentavos)
                        ) : (
                          <span className="text-subtle">R$ 0,00</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-danger font-medium">
                        {c.saidasCentavos > 0 ? (
                          formatBRLFromCents(c.saidasCentavos)
                        ) : (
                          <span className="text-subtle">R$ 0,00</span>
                        )}
                      </td>
                      <td
                        className={`px-6 py-4 text-sm text-right font-mono font-medium ${saldo < 0 ? "text-danger" : "text-fg"}`}
                      >
                        {saldo < 0
                          ? `- ${formatBRLFromCents(Math.abs(saldo))}`
                          : formatBRLFromCents(saldo)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-surface-2/50">
                <tr>
                  <td className="px-6 py-4 text-sm font-bold text-fg">
                    TOTAIS
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-success font-bold">
                    {formatBRLFromCents(totalEntradas)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-danger font-bold">
                    {formatBRLFromCents(totalSaidas)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-accent-strong font-bold">
                    {formatBRLFromCents(totalLiquido)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Donut + Projeção */}
        <div className="flex flex-col space-y-8">
          {/* Donut chart Distribuição de Saídas */}
          <div className="bg-surface border border-border p-6 rounded-xl shadow-sm">
            <h2 className="text-sm font-semibold text-fg mb-6 flex items-center justify-between">
              Distribuição de Saídas
              <span className="text-subtle text-xs">ⓘ</span>
            </h2>
            <div className="relative w-40 h-40 mx-auto mb-6">
              <svg
                className="w-full h-full transform -rotate-90"
                viewBox="0 0 36 36"
              >
                <circle
                  cx="18"
                  cy="18"
                  fill="none"
                  r="15.915"
                  stroke="var(--color-surface-3)"
                  strokeWidth="3"
                ></circle>
                {(() => {
                  let offset = 0;
                  return saidasComPercentual.map((s) => {
                    const dash = s.percentual;
                    const color = donutColors[s.cor] || "var(--color-subtle)";
                    const elem = (
                      <circle
                        key={s.nome}
                        cx="18"
                        cy="18"
                        fill="none"
                        r="15.915"
                        stroke={color}
                        strokeDasharray={`${dash} 100`}
                        strokeDashoffset={-offset}
                        strokeWidth="3"
                      />
                    );
                    offset += dash;
                    return elem;
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-fg">
                  {formatBRLFromCents(kpis.saidasCentavos).split(",")[0]}
                </span>
                <span className="text-[10px] text-muted uppercase">
                  Total Saídas
                </span>
              </div>
            </div>
            <div className="space-y-2">
              {saidasComPercentual.length > 0 ? (
                saidasComPercentual.map((s) => (
                  <div
                    key={s.nome}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center">
                      <span
                        className={`w-2 h-2 rounded-full ${s.cor} mr-2`}
                      ></span>{" "}
                      {s.nome}
                    </div>
                    <span className="font-semibold">{s.percentual}%</span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-subtle text-center py-4">
                  Sem saídas no período
                </div>
              )}
            </div>
          </div>

          {/* Projeção Próximo Mês */}
          <div className="bg-fg text-white p-6 rounded-xl shadow-lg relative overflow-hidden">
            <h2 className="text-sm font-semibold mb-4 flex items-center">
              <span className="text-accent mr-2">✨</span>
              Projeção Próximo Mês
            </h2>
            <p className="text-subtle text-xs mb-4">
              Estimativa baseada no histórico de arrecadação e despesas
              recorrentes.
            </p>
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <span className="text-xs text-border-strong">Saldo Est.</span>
                <span className="text-lg font-bold font-mono">
                  {formatBRLFromCents(projecao.saldoEstimadoCentavos)}
                </span>
              </div>
              <div className="w-full bg-fg h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-accent h-full"
                  style={{ width: `${projecao.percentualBarra}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-success flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3 w-3 mr-1"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" />
                </svg>
                Tendência de crescimento positiva ({projecao.tendencia})
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
