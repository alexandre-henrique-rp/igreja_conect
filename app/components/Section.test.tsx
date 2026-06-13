/**
 * Teste do componente <Section /> (S02-T05).
 *
 * Valida fieldset/legend acessível com classes de estilo.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { Section } from "./Section";

function renderSection(
  title: string,
  children: React.ReactNode
): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <Section title={title}>{children}</Section>,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<Section />", () => {
  it("renderiza <fieldset> com <legend> contendo o title", () => {
    const html = renderSection("Identificação", <p>x</p>);
    expect(html).toContain("<fieldset");
    expect(html).toContain("<legend");
    expect(html).toContain("Identificação");
  });

  it("renderiza children dentro do fieldset", () => {
    const html = renderSection(
      "Contato",
      <input name="email" type="email" />
    );
    expect(html).toContain('name="email"');
    expect(html).toContain('type="email"');
  });

  it("fieldset tem border + rounded-lg + bg-white (card visual)", () => {
    const html = renderSection("Eclesiástico", <p>x</p>);
    expect(html).toContain("border");
    expect(html).toContain("rounded-lg");
    expect(html).toContain("bg-white");
  });

  it("legend tem classes semânticas (font-semibold text-slate-900)", () => {
    const html = renderSection("Endereço", <p>x</p>);
    expect(html).toContain("font-semibold");
    expect(html).toContain("text-slate-900");
  });
});
