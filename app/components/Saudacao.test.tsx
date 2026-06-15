/**
 * Teste do componente <Saudacao /> (S04-T10).
 *
 * Exibe saudação baseada no horário:
 * - < 12: "Bom dia"
 * - < 18: "Boa tarde"
 * - >= 18: "Boa noite"
 * - Se showHint, mostra hint extra.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { Saudacao } from "./Saudacao";

function renderSaudacao(props: {
  user: { nome: string };
  showHint?: boolean;
  horaParam?: number;
}): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <Saudacao {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<Saudacao />", () => {
  it('exibe "Bom dia" quando hora < 12', () => {
    const html = renderSaudacao({ user: { nome: "João" }, horaParam: 9 });
    expect(html).toContain("Bom dia");
    expect(html).toContain("João");
  });

  it('exibe "Boa tarde" quando hora < 18', () => {
    const html = renderSaudacao({ user: { nome: "Maria" }, horaParam: 15 });
    expect(html).toContain("Boa tarde");
    expect(html).toContain("Maria");
  });

  it('exibe "Boa noite" quando hora >= 18', () => {
    const html = renderSaudacao({ user: { nome: "Pedro" }, horaParam: 20 });
    expect(html).toContain("Boa noite");
    expect(html).toContain("Pedro");
  });

  it("quando showHint=true, mostra hint sobre alertas", () => {
    const html = renderSaudacao({
      user: { nome: "João" },
      showHint: true,
      horaParam: 10,
    });
    // React SSR insere comentários entre expressões
    expect(html).toContain("Bom dia");
    expect(html).toContain("João");
    expect(html).toContain("Você tem alertas não lidos");
  });

  it("quando showHint=false, não mostra hint", () => {
    const html = renderSaudacao({
      user: { nome: "João" },
      showHint: false,
      horaParam: 10,
    });
    expect(html).toContain("Bom dia");
    expect(html).toContain("João");
    // Não deve conter hint de alertas
    expect(html).not.toContain("alerta");
  });

  it("data-testid='saudacao'", () => {
    const html = renderSaudacao({ user: { nome: "João" }, horaParam: 10 });
    expect(html).toContain('data-testid="saudacao"');
  });
});
