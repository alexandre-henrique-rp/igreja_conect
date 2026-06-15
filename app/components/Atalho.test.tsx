/**
 * Teste do componente <Atalho /> (S04-T10).
 *
 * Link com ícone + label. Variant primary/secondary.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { Atalho, type AtalhoProps } from "./Atalho";

function renderAtalho(props: AtalhoProps): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <Atalho {...props} />,
    },
    {
      path: "/app/membros",
      Component: () => null,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<Atalho />", () => {
  it("renderiza Link com href", () => {
    const html = renderAtalho({
      to: "/app/membros",
      label: "Membros",
      variant: "primary",
    });
    expect(html).toContain('href="/app/membros"');
    expect(html).toContain("Membros");
  });

  it("variant primary tem bg-cyan-700", () => {
    const html = renderAtalho({
      to: "/app/membros",
      label: "Membros",
      variant: "primary",
    });
    expect(html).toContain("bg-cyan-700");
  });

  it("variant secondary tem fundo secundário", () => {
    const html = renderAtalho({
      to: "/app/membros",
      label: "Membros",
      variant: "secondary",
    });
    // Secondary não deve ter bg primário
    expect(html).not.toContain("bg-cyan-700");
  });

  it("renderiza ícone SVG", () => {
    const html = renderAtalho({
      to: "/app/membros",
      label: "Membros",
      variant: "primary",
    });
    expect(html).toContain("<svg");
  });

  it("data-testid='atalho'", () => {
    const html = renderAtalho({
      to: "/app/alertas",
      label: "Alertas",
      variant: "secondary",
    });
    expect(html).toContain('data-testid="atalho"');
  });
});
