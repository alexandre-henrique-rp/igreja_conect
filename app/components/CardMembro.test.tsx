/**
 * Teste do componente <CardMembro /> (S02-T03).
 *
 * Valida que a versão em cards (mobile) renderiza os mesmos dados
 * que a tabela, com classes `md:hidden` (escondida em md+).
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { CardMembro, type MembroListItem } from "./CardMembro";

function renderCards(items: MembroListItem[], canEdit: boolean): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <CardMembro items={items} canEdit={canEdit} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

const baseItems: MembroListItem[] = [
  {
    id: "m1",
    nome: "Maria da Silva",
    tipo: "VISITANTE",
    discipulador: null,
    ministerios: [],
  },
  {
    id: "m2",
    nome: "João Pereira",
    tipo: "MEMBRO_ATIVO",
    discipulador: { nome: "Carlos Souza" },
    ministerios: [{ nome: "Louvor" }, { nome: "Mídia" }],
  },
];

describe("<CardMembro />", () => {
  it("container tem md:hidden (escondido em md+)", () => {
    const html = renderCards(baseItems, true);
    expect(html).toContain("md:hidden");
  });

  it("renderiza 1 <article> por membro", () => {
    const html = renderCards(baseItems, true);
    const articleCount = (html.match(/<article/g) ?? []).length;
    expect(articleCount).toBe(2);
  });

  it("nome do membro é link para /app/membros/:id", () => {
    const html = renderCards(baseItems, true);
    expect(html).toContain('href="/app/membros/m1"');
    expect(html).toContain('href="/app/membros/m2"');
  });

  it("renderiza badge de tipo (VISITANTE → amber)", () => {
    const html = renderCards(baseItems, true);
    expect(html).toContain("bg-amber-100");
    expect(html).toContain("Visitante");
  });

  it("renderiza discipulador (ou 'Sem discipulador' se null)", () => {
    const html = renderCards(baseItems, true);
    expect(html).toContain("Carlos Souza");
    expect(html).toContain("Sem discipulador");
  });

  it("renderiza ministérios quando há", () => {
    const html = renderCards(baseItems, true);
    expect(html).toContain("Louvor");
    expect(html).toContain("Mídia");
  });

  it("canEdit=true: renderiza botão 'Editar' (com href /editar)", () => {
    const html = renderCards(baseItems, true);
    expect(html).toContain('href="/app/membros/m1/editar"');
    expect(html).toContain("Editar");
  });

  it("canEdit=false: NÃO renderiza botão 'Editar'", () => {
    const html = renderCards(baseItems, false);
    expect(html).not.toContain("/editar");
  });

  it("cada card tem botão 'Ver' (link para /app/membros/:id)", () => {
    const html = renderCards(baseItems, true);
    expect(html).toContain("Ver");
  });
});
