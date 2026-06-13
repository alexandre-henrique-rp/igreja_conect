/**
 * Teste do componente <PageHeader /> (S02-T03).
 *
 * Valida h1, slot `action` (CTA) e slot `breadcrumb`.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { PageHeader } from "./PageHeader";

function renderHeader(props: Parameters<typeof PageHeader>[0]): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <PageHeader {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<PageHeader />", () => {
  it("renderiza <h1> com o title", () => {
    const html = renderHeader({ title: "Membros" });
    expect(html).toContain("<h1");
    expect(html).toContain("Membros");
    expect(html).toContain("text-2xl");
  });

  it("sem action: renderiza apenas o h1", () => {
    const html = renderHeader({ title: "Membros" });
    expect(html).not.toContain("bg-cyan-700");
  });

  it("com action: renderiza o conteúdo da action no slot direito", () => {
    const html = renderHeader({
      title: "Membros",
      action: <a href="/novo">+ Novo membro</a>,
    });
    expect(html).toContain("+ Novo membro");
    expect(html).toContain('href="/novo"');
  });

  it("com breadcrumb: renderiza o conteúdo do breadcrumb abaixo do h1", () => {
    const html = renderHeader({
      title: "Editar",
      breadcrumb: <span>Membros &gt; Editar</span>,
    });
    expect(html).toContain("Editar");
    expect(html).toContain("Membros &gt; Editar");
  });

  it("container tem flex column em sm+ (sm:flex-row) e justify-between", () => {
    const html = renderHeader({ title: "Membros" });
    expect(html).toContain("flex");
    expect(html).toContain("sm:flex-row");
    expect(html).toContain("sm:items-center");
    expect(html).toContain("sm:justify-between");
  });
});
