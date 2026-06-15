/**
 * Teste do componente <TabsFiltroAlertas /> (S04-T07).
 *
 * Abas de filtro para alertas: Todos, Não lidos, Resolvidos.
 * Cada aba mostra contagem em badge. Usa Link com ?filter= para navegação.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { TabsFiltroAlertas, type TabsFiltroAlertasProps } from "./TabsFiltroAlertas";

function renderTabs(props: TabsFiltroAlertasProps): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <TabsFiltroAlertas {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<TabsFiltroAlertas />", () => {
  const counts = { todos: 10, naoLidos: 3, resolvidos: 7 };

  it("renderiza 3 abas: Todos, Não lidos, Resolvidos", () => {
    const html = renderTabs({ activeFilter: "todos", counts });
    expect(html).toContain("Todos");
    expect(html).toContain("Não lidos");
    expect(html).toContain("Resolvidos");
  });

  it("cada aba renderiza contagem em badge", () => {
    const html = renderTabs({ activeFilter: "todos", counts });
    expect(html).toContain("10");
    expect(html).toContain("3");
    expect(html).toContain("7");
  });

  it("abas usam Link com filter= para navegação", () => {
    const html = renderTabs({ activeFilter: "todos", counts });
    // React Router SSR resolve href completo: "/?filter=todos"
    expect(html).toContain('href="/?filter=todos"');
    expect(html).toContain('href="/?filter=naoLidos"');
    expect(html).toContain('href="/?filter=resolvidos"');
  });

  it("aba ativa tem estilo diferente (aria-current='page')", () => {
    const html = renderTabs({ activeFilter: "naoLidos", counts });
    // A aba ativa deve ter aria-current="page"
    expect(html).toContain('aria-current="page"');
  });

  it("aba ativa 'todos' marca o link Todos como aria-current=page", () => {
    const html = renderTabs({ activeFilter: "todos", counts });
    // A aba Todos deve ter aria-current="page"
    const match = html.match(/aria-current="page"/g);
    expect(match).toHaveLength(1);
  });

  it("Data testid no container", () => {
    const html = renderTabs({ activeFilter: "todos", counts });
    expect(html).toContain('data-testid="tabs-filtro-alertas"');
  });
});
