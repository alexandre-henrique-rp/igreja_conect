import type { DashboardEstoqueData } from "~/lib/itemEstoque.server";

interface KpiEstoqueProps {
  kpis: DashboardEstoqueData["kpis"];
}

/**
 * Grid de 4 KPIs para o dashboard de Estoque.
 * Exibe Total, Consumo, Patrimônio e Estoque Baixo.
 */
export default function KpiEstoque({ kpis }: KpiEstoqueProps) {
  const items = [
    {
      label: "Total de Itens",
      value: kpis.total,
      color: "bg-blue-50 text-blue-600",
      icon: (
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      testId: "kpi-estoque-total",
    },
    {
      label: "Itens de Consumo",
      value: kpis.consumo,
      color: "bg-emerald-50 text-emerald-600",
      icon: (
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      testId: "kpi-estoque-consumo",
    },
    {
      label: "Bens Patrimoniais",
      value: kpis.patrimonio,
      color: "bg-amber-50 text-amber-600",
      icon: (
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      testId: "kpi-estoque-patrimonio",
    },
    {
      label: "Estoque Baixo",
      value: kpis.estoqueBaixo,
      color: "bg-red-50 text-red-600",
      icon: (
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      testId: "kpi-estoque-baixo",
    },
  ];

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <h3 className="sr-only">Indicadores do Estoque</h3>
      {items.map((item) => (
        <div
          key={item.testId}
          data-testid={item.testId}
          className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow"
        >
          <div className={`w-14 h-14 ${item.color} rounded-xl flex items-center justify-center shrink-0`}>
            {item.icon}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{item.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{item.value}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
