/**
 * Teste do componente <CardSaldoCaixa /> (S06-T09).
 *
 * Valida renderização de saldo, link, botão '+ Lançar' e alerta de saldo baixo.
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
      podeCriarLancamento: true,
      user: { id: "u1", nome: "Admin", cargo: "ADMIN" },
    });
    expect(html).toContain("Caixa Principal");
  });

  it("renderiza o saldo formatado", () => {
    const html = renderCard({
      caixa: caixaBase,
      podeCriarLancamento: false,
      user: { id: "u1", nome: "Admin", cargo: "ADMIN" },
    });
    expect(html).toContain("R$ 500,00");
  });

  it("link do nome aponta para /app/financeiro/caixas/cx-1", () => {
    const html = renderCard({
      caixa: caixaBase,
      podeCriarLancamento: false,
      user: { id: "u1", nome: "Admin", cargo: "ADMIN" },
    });
    expect(html).toContain('href="/app/financeiro/caixas/cx-1"');
  });

  it("renderiza botão '+ Lançar' quando podeCriarLancamento e caixa ativo", () => {
    const html = renderCard({
      caixa: caixaBase,
      podeCriarLancamento: true,
      user: { id: "u1", nome: "Admin", cargo: "ADMIN" },
    });
    expect(html).toContain("Lançar");
  });

  it("NÃO renderiza '+ Lançar' quando !podeCriarLancamento", () => {
    const html = renderCard({
      caixa: caixaBase,
      podeCriarLancamento: false,
      user: { id: "u1", nome: "Admin", cargo: "ADMIN" },
    });
    expect(html).not.toContain("Lançar");
  });

  it("NÃO renderiza '+ Lançar' quando caixa inativo", () => {
    const html = renderCard({
      caixa: { ...caixaBase, ativo: false },
      podeCriarLancamento: true,
      user: { id: "u1", nome: "Admin", cargo: "ADMIN" },
    });
    expect(html).not.toContain("Lançar");
  });

  it("border amber quando saldo < 1000 centavos (R$ 10,00)", () => {
    const html = renderCard({
      caixa: { ...caixaBase, saldoCentavos: 500 },
      podeCriarLancamento: false,
      user: { id: "u1", nome: "Admin", cargo: "ADMIN" },
    });
    expect(html).toContain("border-amber-");
  });

  it("sem border amber quando saldo >= 1000 centavos", () => {
    const html = renderCard({
      caixa: { ...caixaBase, saldoCentavos: 1000 },
      podeCriarLancamento: false,
      user: { id: "u1", nome: "Admin", cargo: "ADMIN" },
    });
    expect(html).not.toContain("border-amber-");
  });

  it("possui aria-label descritivo", () => {
    const html = renderCard({
      caixa: { ...caixaBase, saldoCentavos: 50000 },
      podeCriarLancamento: false,
      user: { id: "u1", nome: "Admin", cargo: "ADMIN" },
    });
    expect(html).toContain("aria-label");
    expect(html).toContain("Caixa Principal");
  });
});
