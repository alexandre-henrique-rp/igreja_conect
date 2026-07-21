/**
 * Teste do componente <CardSaldoCaixa /> (S06-T09).
 *
 * Valida renderização de saldo, link e alerta de saldo baixo.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { CardSaldoCaixa, type CardSaldoCaixaProps } from "./CardSaldoCaixa";

function renderCard(props: CardSaldoCaixaProps): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <CardSaldoCaixa {...props} />,
    },
    {
      path: "/app/financeiro/caixas/:id",
      Component: () => null,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

const caixaBase = {
  id: "cx-1",
  nome: "Caixa Principal",
  saldoCentavos: 50000,
  ativo: true,
  lancamentosMes: 10,
  createdAt: new Date("2026-01-15"),
};

describe("<CardSaldoCaixa />", () => {
  it("renderiza o nome do caixa", () => {
    const html = renderCard({
      caixa: caixaBase,
    });
    expect(html).toContain("Caixa Principal");
  });

  it("renderiza o saldo formatado", () => {
    const html = renderCard({
      caixa: caixaBase,
    });
    expect(html.replace(/\u00a0/g, " ")).toContain("R$ 500,00");
  });

  it("card inteiro é um link para /app/financeiro/caixas/cx-1", () => {
    const html = renderCard({
      caixa: caixaBase,
    });
    expect(html).toContain('href="/app/financeiro/caixas/cx-1"');
  });

  it("NÃO renderiza contagem de lançamentos do mês", () => {
    const html = renderCard({
      caixa: caixaBase,
    });
    expect(html).not.toContain("lançamento");
    expect(html).not.toContain("(mês)");
  });

  it("NÃO renderiza botão de lançamento quando caixa inativo", () => {
    const html = renderCard({
      caixa: { ...caixaBase, ativo: false },
    });
    expect(html).not.toContain("Lançar");
  });

  it("border amber quando saldo < 1000 centavos (R$ 10,00)", () => {
    const html = renderCard({
      caixa: { ...caixaBase, saldoCentavos: 500 },
    });
    expect(html).toContain("border-amber-");
  });

  it("sem border amber quando saldo >= 1000 centavos", () => {
    const html = renderCard({
      caixa: { ...caixaBase, saldoCentavos: 1000 },
    });
    expect(html).not.toContain("border-amber-");
  });

  it("possui aria-label descritivo", () => {
    const html = renderCard({
      caixa: { ...caixaBase, saldoCentavos: 50000 },
    });
    expect(html).toContain("aria-label");
    expect(html).toContain("Caixa Principal");
  });
});
