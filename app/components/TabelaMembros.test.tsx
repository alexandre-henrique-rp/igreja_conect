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
  it("renderiza <table> com <caption> sr-only 'Lista de membros'", () => {
    const html = renderTabela(baseItems, true);
    expect(html).toContain("<table");
    expect(html).toContain("<caption");
    expect(html).toContain("sr-only");
    expect(html).toContain("Lista de membros");
  });

  it("todas as 6 <th> têm scope='col'", () => {
    const html = renderTabela(baseItems, true);
    const thScope = (html.match(/<th[^>]*scope="col"/g) ?? []).length;
    expect(thScope).toBe(6); // Nome, Email, Tipo, Status, Data de Entrada, Ações
  });

  it("container tem hidden md:block (visível em md+)", () => {
    const html = renderTabela(baseItems, true);
    expect(html).toContain("hidden");
    expect(html).toContain("md:block");
  });

  it("renderiza 1 linha por membro", () => {
    const html = renderTabela(baseItems, true);
    // 3 <tr> no <tbody>
    const trCount = (html.match(/<tr/g) ?? []).length;
    expect(trCount).toBeGreaterThanOrEqual(3);
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
    expect(html).toContain("—"); // Maria da Silva tem email null
  });

  it("status badges têm a cor e texto corretos de acordo com tipo e nome", () => {
    const html = renderTabela(baseItems, true);
    // Maria (VISITANTE) -> status Pendente (bg-amber-50)
    expect(html).toContain("Pendente");
    expect(html).toContain("bg-amber-50");
    // João (MEMBRO_ATIVO) -> status Ativo (bg-emerald-50)
    expect(html).toContain("Ativo");
    expect(html).toContain("bg-emerald-50");
    // Juliana (nome com 'Juliana') -> status Inativo (bg-rose-50)
    expect(html).toContain("Inativo");
    expect(html).toContain("bg-rose-50");
  });

  it("canEdit=true: renderiza links 'Editar' e botões 'Excluir'", () => {
    const html = renderTabela(baseItems, true);
    expect(html).toContain('href="/app/membros/m1/editar"');
    expect(html).toContain('aria-label="Editar Maria da Silva"');
    expect(html).toContain('aria-label="Excluir Maria da Silva"');
  });

  it("canEdit=false: NÃO renderiza links 'Editar' nem botões 'Excluir'", () => {
    const html = renderTabela(baseItems, false);
    expect(html).not.toContain("/editar");
    expect(html).not.toContain('aria-label="Excluir');
  });
});
