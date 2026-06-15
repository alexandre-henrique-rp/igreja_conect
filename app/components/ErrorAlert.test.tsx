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

  it("tone='error' tem classes vermelhas (bg-red-50, border-red-200)", () => {
    const html = renderAlert({ tone: "error", children: "Erro!" });
    expect(html).toContain("bg-red-50");
    expect(html).toContain("border-red-200");
  });

  it("tone='warning' tem classes amarelas", () => {
    const html = renderAlert({ tone: "warning", children: "Atenção" });
    expect(html).toContain("bg-amber-50");
    expect(html).toContain("border-amber-200");
  });

  it("tone='info' tem classes azuis", () => {
    const html = renderAlert({ tone: "info", children: "Informação" });
    expect(html).toContain("bg-blue-50");
    expect(html).toContain("border-blue-200");
  });

  it("renderiza ícone SVG (aria-hidden para não poluir screen reader)", () => {
    const html = renderAlert({ tone: "error", children: "Erro" });
    expect(html).toContain("<svg");
    expect(html).toContain('aria-hidden="true"');
  });
});
