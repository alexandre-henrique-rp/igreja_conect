/**
 * Teste do componente <ListaDiscipulos /> (S03-T05).
 *
 * Renderiza a lista de discípulos atuais de um discipulador. Cada item
 * tem nome (link) + botão "Desvincular" (Form method=post).
 *
 * **Comportamento esperado:**
 * 1. Renderiza `<ul>` semântico.
 * 2. Cada nome vira `<Link>` para `/app/membros/:id`.
 * 3. Cada item tem `<Form method=post>` com input `intent=unassign`
 *    e `membroId` (hidden) + botão submit "Desvincular".
 * 4. Lista vazia: mostra mensagem "Nenhum discípulo".
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { ListaDiscipulos } from "./ListaDiscipulos";

type DiscipuloMini = { id: string; nome: string };

function renderLista(discipulos: DiscipuloMini[]): string {
  const Stub = createRoutesStub([
    {
      path: "/app/membros/:id",
      Component: () => <ListaDiscipulos discipulos={discipulos} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/app/membros/abc"]} />);
}

describe("<ListaDiscipulos />", () => {
  it("renderiza <ul> semântico", () => {
    const html = renderLista([{ id: "1", nome: "Carlos" }]);
    expect(html).toContain("<ul");
  });

  it("cada nome vira link para /app/membros/:id", () => {
    const html = renderLista([
      { id: "a", nome: "Ana" },
      { id: "b", nome: "Carlos" },
    ]);
    expect(html).toContain('href="/app/membros/a"');
    expect(html).toContain('href="/app/membros/b"');
  });

  it("cada item tem form com intent=unassign", () => {
    const html = renderLista([{ id: "abc", nome: "Ana" }]);
    expect(html).toContain("<form");
    expect(html).toContain('name="intent"');
    expect(html).toContain('value="unassign"');
    expect(html).toContain('name="membroId"');
    expect(html).toContain('value="abc"');
  });

  it("cada item tem botão 'Desvincular'", () => {
    const html = renderLista([{ id: "1", nome: "Ana" }]);
    // O botão tem o texto visível "Desvincular".
    expect(html).toContain("Desvincular");
  });

  it("2 discípulos: 2 forms, 2 aria-labels com nome", () => {
    const html = renderLista([
      { id: "1", nome: "Ana" },
      { id: "2", nome: "Carlos" },
    ]);
    const formCount = (html.match(/<form/g) ?? []).length;
    expect(formCount).toBe(2);
    // 2 aria-labels (um por botão "Desvincular X")
    const ariaCount = (html.match(/aria-label="Desvincular /g) ?? []).length;
    expect(ariaCount).toBe(2);
  });

  it("lista vazia: mostra mensagem 'Nenhum discípulo'", () => {
    const html = renderLista([]);
    expect(html).toContain("Nenhum discípulo");
  });
});
