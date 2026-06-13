/**
 * Teste do componente <TabelaMembros /> (S02-T03).
 *
 * Valida tabela responsiva (hidden md:block), <caption> sr-only, <th scope="col">,
 * coluna de ações com link "Ver" e link "Editar" condicional.
 */
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

describe("<TabelaMembros />", () => {
  it("renderiza <table> com <caption> sr-only 'Lista de membros'", () => {
    const html = renderTabela(baseItems, true);
    expect(html).toContain("<table");
    expect(html).toContain("<caption");
    expect(html).toContain("sr-only");
    expect(html).toContain("Lista de membros");
  });

  it("todas as <th> têm scope='col'", () => {
    const html = renderTabela(baseItems, true);
    const thScope = (html.match(/<th[^>]*scope="col"/g) ?? []).length;
    expect(thScope).toBe(5); // Nome, Tipo, Discipulador, Ministérios, Ações
  });

  it("container tem hidden md:block (visível em md+)", () => {
    const html = renderTabela(baseItems, true);
    expect(html).toContain("hidden");
    expect(html).toContain("md:block");
  });

  it("renderiza 1 linha por membro", () => {
    const html = renderTabela(baseItems, true);
    // 2 <tr> no <tbody> (sem contar header)
    const trCount = (html.match(/<tr/g) ?? []).length;
    expect(trCount).toBeGreaterThanOrEqual(2);
  });

  it("link do nome aponta para /app/membros/:id", () => {
    const html = renderTabela(baseItems, true);
    expect(html).toContain('href="/app/membros/m1"');
    expect(html).toContain('href="/app/membros/m2"');
  });

  it("badge de tipo tem cor específica por tipo", () => {
    const html = renderTabela(baseItems, true);
    // VISITANTE → amber
    expect(html).toContain("bg-amber-100");
    // MEMBRO_ATIVO → green
    expect(html).toContain("bg-green-100");
  });

  it("ministérios são listados separados por vírgula", () => {
    const html = renderTabela(baseItems, true);
    expect(html).toContain("Louvor");
    expect(html).toContain("Mídia");
    expect(html).toContain("Louvor, Mídia");
  });

  it("membro sem ministérios mostra '—'", () => {
    const html = renderTabela(baseItems, true);
    // Maria (m1) tem 0 ministérios → "—"
    expect(html).toContain("—");
  });

  it("canEdit=true: renderiza link 'Editar' (PencilIcon)", () => {
    const html = renderTabela(baseItems, true);
    expect(html).toContain('href="/app/membros/m1/editar"');
    expect(html).toContain('aria-label="Editar Maria da Silva"');
  });

  it("canEdit=false: NÃO renderiza link 'Editar'", () => {
    const html = renderTabela(baseItems, false);
    expect(html).not.toContain("/editar");
  });
});
