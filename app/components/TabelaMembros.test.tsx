import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { TabelaMembros, type MembroListItem } from "./TabelaMembros";

function renderTabela(
  items: MembroListItem[],
  canEdit: boolean
): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <TabelaMembros items={items} canEdit={canEdit} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

const baseItems: MembroListItem[] = [
  {
    id: "m1",
    nome: "Maria da Silva",
    tipo: "VISITANTE",
    email: null,
    createdAt: new Date("2023-11-05T12:00:00Z"),
  },
  {
    id: "m2",
    nome: "João Pereira",
    tipo: "MEMBRO_ATIVO",
    email: "joao@email.com",
    createdAt: new Date("2022-03-12T12:00:00Z"),
  },
  {
    id: "m3",
    nome: "Juliana Santos",
    tipo: "MEMBRO_ATIVO",
    email: "juliana@email.com",
    createdAt: new Date("2020-08-30T12:00:00Z"),
  },
];

describe("<TabelaMembros />", () => {
  it("renderiza a grade de cards do Design System", () => {
    const html = renderTabela(baseItems, true);
    expect(html).toContain('class="member-grid"');
    expect(html).toContain("member-card");
    expect(html).toContain('aria-label="Lista de membros"');
  });

  it("renderiza um card por membro", () => {
    const html = renderTabela(baseItems, true);
    const cards = (html.match(/member-card/g) ?? []).length;
    expect(cards).toBe(3);
  });

  it("link do nome aponta para /app/membros/:id", () => {
    const html = renderTabela(baseItems, true);
    expect(html).toContain('href="/app/membros/m1"');
    expect(html).toContain('href="/app/membros/m2"');
    expect(html).toContain('href="/app/membros/m3"');
  });

  it("exibe emails e trata emails nulos com '—'", () => {
    const html = renderTabela(baseItems, true);
    expect(html).toContain("joao@email.com");
    expect(html).toContain("E-mail não informado"); // Maria da Silva tem email null
  });

  it("status badges têm a cor e texto corretos de acordo com tipo e nome", () => {
    const html = renderTabela(baseItems, true);
    // Maria (VISITANTE) -> status Pendente (bg-warning-soft)
    expect(html).toContain("Pendente");
    expect(html).toContain("bg-warning-soft");
    // João (MEMBRO_ATIVO) -> status Ativo (bg-success-soft)
    expect(html).toContain("Ativo");
    expect(html).toContain("bg-success-soft");
    // Juliana (nome com 'Juliana') -> status Inativo (bg-danger-soft)
    expect(html).toContain("Inativo");
    expect(html).toContain("bg-danger-soft");
  });

  it("canEdit=true: renderiza link de edição no card", () => {
    const html = renderTabela(baseItems, true);
    expect(html).toContain('href="/app/membros/m1/editar"');
    expect(html).toContain("Editar");
  });

  it("canEdit=false: não renderiza link de edição", () => {
    const html = renderTabela(baseItems, false);
    expect(html).not.toContain("/editar");
  });
});
