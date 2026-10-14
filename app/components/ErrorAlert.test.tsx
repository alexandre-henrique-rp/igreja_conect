/**
 * Teste do componente <ErrorAlert /> (S01-T06).
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { ErrorAlert } from "./ErrorAlert";

function renderAlert(props: Parameters<typeof ErrorAlert>[0]): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <ErrorAlert {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<ErrorAlert />", () => {
  it("renderiza container com role='alert' (lê por screen reader)", () => {
    const html = renderAlert({ tone: "error", children: "Algo deu errado" });
    expect(html).toContain('role="alert"');
    expect(html).toContain("Algo deu errado");
  });

  it("tone='error' tem classes vermelhas (bg-danger-soft, border-danger-soft)", () => {
    const html = renderAlert({ tone: "error", children: "Erro!" });
    expect(html).toContain("bg-danger-soft");
    expect(html).toContain("border-danger-soft");
  });

  it("tone='warning' tem classes amarelas", () => {
    const html = renderAlert({ tone: "warning", children: "Atenção" });
    expect(html).toContain("bg-warning-soft");
    expect(html).toContain("border-warning-soft");
  });

  it("tone='info' tem classes azuis", () => {
    const html = renderAlert({ tone: "info", children: "Informação" });
    expect(html).toContain("bg-accent-soft-2");
    expect(html).toContain("border-accent-soft");
  });

  it("renderiza ícone SVG (aria-hidden para não poluir screen reader)", () => {
    const html = renderAlert({ tone: "error", children: "Erro" });
    expect(html).toContain("<svg");
    expect(html).toContain('aria-hidden="true"');
  });
});
