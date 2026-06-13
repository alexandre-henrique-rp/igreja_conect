/**
 * Teste do componente <Breadcrumb /> (S02-T03).
 *
 * Valida semântica (`<nav aria-label>`, `<ol>`, `aria-current="page"`)
 * e render dos itens com/sem href.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { Breadcrumb } from "./Breadcrumb";

function renderBreadcrumb(
  items: Parameters<typeof Breadcrumb>[0]["items"]
): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <Breadcrumb items={items} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<Breadcrumb />", () => {
  it("renderiza <nav> com aria-label 'Trilha de navegação'", () => {
    const html = renderBreadcrumb([{ label: "Membros" }]);
    expect(html).toContain("<nav");
    expect(html).toContain('aria-label="Trilha de navegação"');
  });

  it("renderiza <ol> semântico", () => {
    const html = renderBreadcrumb([{ label: "Membros" }]);
    expect(html).toContain("<ol");
  });

  it("item sem href é renderizado como span com aria-current='page'", () => {
    const html = renderBreadcrumb([{ label: "Membros" }, { label: "Atual" }]);
    expect(html).toContain("Atual");
    expect(html).toContain('aria-current="page"');
    // Item atual em font-medium
    expect(html).toContain("font-medium");
  });

  it("item COM href renderiza link para o href", () => {
    const html = renderBreadcrumb([
      { label: "Membros", href: "/app/membros" },
      { label: "Detalhe" },
    ]);
    expect(html).toContain('href="/app/membros"');
    expect(html).toContain("Membros");
  });

  it("separador '›' aparece entre itens", () => {
    const html = renderBreadcrumb([
      { label: "A", href: "/a" },
      { label: "B", href: "/b" },
      { label: "C" },
    ]);
    // O separador aparece 2 vezes (entre A-B e B-C)
    expect(html).toContain("›");
    // Quantidade exata: count of "›" (3 items → 2 separadores)
    const sepCount = (html.match(/›/g) ?? []).length;
    expect(sepCount).toBe(2);
  });

  it("sem items: renderiza nav e ol vazios", () => {
    const html = renderBreadcrumb([]);
    expect(html).toContain("<nav");
    expect(html).toContain("<ol");
  });
});
