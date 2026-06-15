/**
 * Teste do componente <CardKpi /> (S04-T10).
 *
 * Card de KPI com label, valor (grande, bold), hint opcional e href.
 * tone="attention" muda fundo para amber-50.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { CardKpi, type CardKpiProps } from "./CardKpi";

function renderKpi(props: CardKpiProps): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <CardKpi {...props} />,
    },
    {
      path: "/app/membros",
      Component: () => null,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<CardKpi />", () => {
  it("renderiza label e valor", () => {
    const html = renderKpi({ label: "Membros Ativos", value: 42 });
    expect(html).toContain("Membros Ativos");
    expect(html).toContain("42");
  });

  it("valor aparece em negrito (font-bold)", () => {
    const html = renderKpi({ label: "Membros", value: 10 });
    expect(html).toContain("font-bold");
    expect(html).toContain("text-2xl");
  });

  it("renderiza hint quando fornecida", () => {
    const html = renderKpi({
      label: "Membros",
      value: 42,
      hint: "+5 este mês",
    });
    expect(html).toContain("+5 este mês");
  });

  it("quando href presente, renderiza como Link", () => {
    const html = renderKpi({
      label: "Membros",
      value: 42,
      href: "/app/membros",
    });
    expect(html).toContain('href="/app/membros"');
  });

  it("quando href ausente, renderiza como div (sem link)", () => {
    const html = renderKpi({ label: "Membros", value: 42 });
    expect(html).not.toContain('href="/app/membros"');
  });

  it("tone='attention' muda fundo para amber-50", () => {
    const html = renderKpi({
      label: "Visitantes",
      value: 10,
      tone: "attention",
    });
    expect(html).toContain("amber");
  });

  it("tone padrão (default) tem bg-white", () => {
    const html = renderKpi({ label: "Membros", value: 42 });
    expect(html).toContain("bg-white");
  });

  it("data-testid='card-kpi'", () => {
    const html = renderKpi({ label: "Membros", value: 42 });
    expect(html).toContain('data-testid="card-kpi"');
  });
});
