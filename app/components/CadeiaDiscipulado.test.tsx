/**
 * Teste do componente <CadeiaDiscipulado /> (S03-T05).
 *
 * Renderiza a cadeia "discipulador → discípulo → ..." com links para
 * cada membro. Usado no painel de discipulado para mostrar a
 * hierarquia (RN-MEM-04 + anti-loop).
 *
 * **Comportamento esperado:**
 * 1. Renderiza um `<ol>` semântico (sequência ordenada).
 * 2. Cada item vira `<Link>` para `/app/membros/:id`.
 * 3. Entre itens: seta `→` (U+2192) com `aria-hidden`.
 * 4. Cadeia vazia: NÃO renderiza (ou renderiza vazio sem setas).
 * 5. Cada nome está dentro de um link clicável.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { CadeiaDiscipulado } from "./CadeiaDiscipulado";

type MembroMini = { id: string; nome: string };

function renderCadeia(cadeia: MembroMini[]): string {
  const Stub = createRoutesStub([
    {
      path: "/app/membros/:id",
      Component: () => <CadeiaDiscipulado cadeia={cadeia} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/app/membros/abc"]} />);
}

describe("<CadeiaDiscipulado />", () => {
  it("renderiza <ol> semântico", () => {
    const html = renderCadeia([
      { id: "1", nome: "Pr. Carlos" },
      { id: "2", nome: "Disc. João" },
    ]);
    expect(html).toContain("<ol");
  });

  it("cadeia vazia: renderiza <ol> sem <li>", () => {
    const html = renderCadeia([]);
    expect(html).toContain("<ol");
    expect(html).not.toContain("<li");
  });

  it("cada nome vira link para /app/membros/:id", () => {
    const html = renderCadeia([
      { id: "a", nome: "Pr. Carlos" },
      { id: "b", nome: "Disc. João" },
      { id: "c", nome: "Maria" },
    ]);
    expect(html).toContain('href="/app/membros/a"');
    expect(html).toContain('href="/app/membros/b"');
    expect(html).toContain('href="/app/membros/c"');
  });

  it("renderiza os 3 nomes", () => {
    const html = renderCadeia([
      { id: "a", nome: "Pr. Carlos" },
      { id: "b", nome: "Disc. João" },
      { id: "c", nome: "Maria" },
    ]);
    expect(html).toContain("Pr. Carlos");
    expect(html).toContain("Disc. João");
    expect(html).toContain("Maria");
  });

  it("renderiza seta '→' entre os itens", () => {
    const html = renderCadeia([
      { id: "a", nome: "A" },
      { id: "b", nome: "B" },
      { id: "c", nome: "C" },
    ]);
    // 3 items → 2 setas
    const setaCount = (html.match(/→/g) ?? []).length;
    expect(setaCount).toBe(2);
  });

  it("com 2 itens: 1 seta", () => {
    const html = renderCadeia([
      { id: "a", nome: "A" },
      { id: "b", nome: "B" },
    ]);
    const setaCount = (html.match(/→/g) ?? []).length;
    expect(setaCount).toBe(1);
  });

  it("com 1 item: 0 setas", () => {
    const html = renderCadeia([{ id: "a", nome: "A" }]);
    expect(html).not.toContain("→");
  });
});
