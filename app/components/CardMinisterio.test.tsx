/**
 * Teste do componente <CardMinisterio /> (S03-T09).
 *
 * Card que renderiza um ministério individual na lista. Contém:
 * - Header: nome (h2) + badge "N membros".
 * - Lista até 5 primeiros membros com botão "Desvincular".
 * - "+ Adicionar membro" (se canEdit).
 * - Footer: Editar/Excluir (se canEdit).
 *
 * **Acessibilidade:**
 * - `<h2>` para o nome (hierarquia após `<h1>` da página).
 * - Botões com `aria-label` descritivo.
 *
 * @see design/private-ministerios-list.DESIGN.md
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { CardMinisterio } from "./CardMinisterio";

function renderCard(
  props: Parameters<typeof CardMinisterio>[0]
): string {
  const Stub = createRoutesStub([
    {
      path: "/app/ministerios",
      Component: () => <CardMinisterio {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/app/ministerios"]} />);
}

const baseProps = {
  ministerio: { id: "min-1", nome: "Louvor", descricao: "Equipe" },
  membros: [
    { id: "m1", nome: "Ana" },
    { id: "m2", nome: "Carlos" },
  ] as { id: string; nome: string }[],
  totalMembros: 2,
  canEdit: true,
  onAddMembro: () => {},
  onRemoveMembro: () => {},
  onEdit: () => {},
  onDelete: () => {},
};

describe("<CardMinisterio />", () => {
  it("renderiza h2 com nome do ministério", () => {
    const html = renderCard(baseProps);
    expect(html).toContain("<h2");
    expect(html).toContain("Louvor");
  });

  it("mostra badge com total de membros", () => {
    const html = renderCard(baseProps);
    expect(html).toContain("2 membros");
  });

  it("singular: '1 membro' (não '1 membros')", () => {
    const html = renderCard({
      ...baseProps,
      membros: [{ id: "m1", nome: "Ana" }],
      totalMembros: 1,
    });
    expect(html).toContain("1 membro");
    expect(html).not.toContain("1 membros");
  });

  it("renderiza descricao quando fornecida", () => {
    const html = renderCard(baseProps);
    expect(html).toContain("Equipe");
  });

  it("renderiza <ul> com membros", () => {
    const html = renderCard(baseProps);
    expect(html).toContain("<ul");
    expect(html).toContain("Ana");
    expect(html).toContain("Carlos");
  });

  it("canEdit=true: renderiza botões Editar, Excluir, Adicionar", () => {
    const html = renderCard(baseProps);
    expect(html).toContain("Editar");
    expect(html).toContain("Excluir");
    expect(html).toContain("Adicionar membro");
  });

  it("canEdit=false: NÃO renderiza botões de ação", () => {
    const html = renderCard({ ...baseProps, canEdit: false });
    expect(html).not.toContain(">Editar<");
    expect(html).not.toContain(">Excluir<");
    expect(html).not.toContain(">Adicionar membro<");
  });

  it("totalMembros > membros.length: indica 'ver mais' ou count completo", () => {
    // Comportamento: mostra "X membros" onde X = totalMembros
    const html = renderCard({
      ...baseProps,
      membros: [{ id: "m1", nome: "Ana" }],
      totalMembros: 10,
    });
    expect(html).toContain("10 membros");
    // Mas a lista mostra apenas os 5 primeiros
    expect(html).toContain("Ana");
  });

  it("membros vazio: mostra mensagem 'Nenhum membro'", () => {
    const html = renderCard({
      ...baseProps,
      membros: [],
      totalMembros: 0,
    });
    expect(html).toContain("0 membros");
    expect(html).toContain("Nenhum membro");
  });

  it("form de Desvincular tem intent=remove-membro + membroId", () => {
    const html = renderCard(baseProps);
    expect(html).toContain('name="intent"');
    expect(html).toContain('value="remove-membro"');
    expect(html).toContain('value="m1"');
    expect(html).toContain('value="m2"');
  });
});
