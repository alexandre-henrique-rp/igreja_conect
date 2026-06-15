/**
 * Teste do componente <ListaRecente /> (S04-T10).
 *
 * Lista de itens recentes com nome, badge e timestamp.
 * Se items.length === 0, mostra empty state.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { ListaRecente, type ListaRecenteProps } from "./ListaRecente";

function renderLista(props: ListaRecenteProps): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <ListaRecente {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

const now = new Date("2026-06-13T14:00:00.000Z");

describe("<ListaRecente />", () => {
  const items = [
    { id: "1", nome: "João Silva", cargo: "Visitante", createdAt: new Date("2026-06-13T13:00:00.000Z") },
    { id: "2", nome: "Maria Souza", cargo: "Congregado", createdAt: new Date("2026-06-12T10:00:00.000Z") },
  ];

  it("renderiza <ul> com itens", () => {
    const html = renderLista({ items, empty: "Nenhum visitante recente", now });
    expect(html).toContain("<ul");
    expect(html).toContain("João Silva");
    expect(html).toContain("Maria Souza");
  });

  it("renderiza badge com cargo", () => {
    const html = renderLista({ items, empty: "Nenhum visitante recente", now });
    expect(html).toContain("Visitante");
    expect(html).toContain("Congregado");
  });

  it("renderiza RelativeTime para timestamp", () => {
    const html = renderLista({ items, empty: "Nenhum visitante recente", now });
    expect(html).toContain("data-testid=\"relative-time\"");
  });

  it("quando lista vazia, mostra empty state", () => {
    const html = renderLista({ items: [], empty: "Nenhum visitante recente", now });
    expect(html).toContain("Nenhum visitante recente");
    expect(html).not.toContain("<ul>");
  });

  it("data-testid='lista-recente'", () => {
    const html = renderLista({ items, empty: "Nenhum visitante recente", now });
    expect(html).toContain('data-testid="lista-recente"');
  });
});
