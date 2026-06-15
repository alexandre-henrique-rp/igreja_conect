/**
 * Teste do componente <KpiSaldoTotal /> (S06-T09).
 *
 * Renderiza o KPI de saldo total do dashboard financeiro.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { KpiSaldoTotal } from "./KpiSaldoTotal";

function renderKpi(props: { saldoCentavos: number; totalCaixas: number; className?: string }): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <KpiSaldoTotal {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<KpiSaldoTotal />", () => {
  it("renderiza o saldo formatado em BRL", () => {
    const html = renderKpi({ saldoCentavos: 150000, totalCaixas: 3 });
    expect(html).toContain("R$ 1.500,00");
  });

  it("renderiza saldo zero como R$ 0,00", () => {
    const html = renderKpi({ saldoCentavos: 0, totalCaixas: 0 });
    expect(html).toContain("R$ 0,00");
  });

  it("renderiza totalCaixas no plural quando > 1", () => {
    const html = renderKpi({ saldoCentavos: 50000, totalCaixas: 3 });
    expect(html).toContain("3 caixas ativos");
  });

  it("renderiza totalCaixas no singular quando = 1", () => {
    const html = renderKpi({ saldoCentavos: 50000, totalCaixas: 1 });
    expect(html).toContain("1 caixa ativo");
  });

  it("usa bg-cyan-700 como cor de fundo", () => {
    const html = renderKpi({ saldoCentavos: 100, totalCaixas: 2 });
    expect(html).toContain("bg-cyan-700");
  });

  it("possui data-testid='kpi-saldo-total'", () => {
    const html = renderKpi({ saldoCentavos: 100, totalCaixas: 2 });
    expect(html).toContain('data-testid="kpi-saldo-total"');
  });

  it("aceita className extra", () => {
    const html = renderKpi({ saldoCentavos: 100, totalCaixas: 1, className: "mb-4" });
    expect(html).toContain("mb-4");
  });
});
