/**
 * Teste do componente <TabMinisterios /> (S03-T07).
 *
 * Tab que renderiza os ministérios do membro DENTRO da página de
 * detalhe. Cada item tem botão "Desvincular" (se canEdit) com
 * `intent=remove-membro`. Botão "+ Adicionar" se canEdit.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { TabMinisterios } from "./TabMinisterios";

function renderTab(
  props: Parameters<typeof TabMinisterios>[0]
): string {
  const Stub = createRoutesStub([
    {
      path: "/app/membros/:id",
      Component: () => <TabMinisterios {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/app/membros/m1"]} />);
}

describe("<TabMinisterios />", () => {
  it("com ministérios: renderiza <ul> com nomes", () => {
    const html = renderTab({
      membroId: "m1",
      ministerios: [
        { id: "min-1", nome: "Louvor" },
        { id: "min-2", nome: "Infantil" },
      ],
      canEdit: true,
    });
    expect(html).toContain("<ul");
    expect(html).toContain("Louvor");
    expect(html).toContain("Infantil");
  });

  it("sem ministérios: mostra mensagem 'não está em nenhum ministério'", () => {
    const html = renderTab({
      membroId: "m1",
      ministerios: [],
      canEdit: true,
    });
    expect(html).toContain("não está em nenhum minist");
  });

  it("canEdit=true: form de Desvincular com intent=remove-membro", () => {
    const html = renderTab({
      membroId: "m1",
      ministerios: [{ id: "min-1", nome: "Louvor" }],
      canEdit: true,
    });
    expect(html).toContain('value="remove-membro"');
    expect(html).toContain('value="min-1"');
    expect(html).toContain("Desvincular");
  });

  it("canEdit=true: mostra link para gestão de ministérios", () => {
    const html = renderTab({
      membroId: "m1",
      ministerios: [{ id: "min-1", nome: "Louvor" }],
      canEdit: true,
    });
    // Link para /app/ministerios (gestão completa)
    expect(html).toContain('href="/app/ministerios"');
  });

  it("canEdit=false: NÃO mostra botões (read-only)", () => {
    const html = renderTab({
      membroId: "m1",
      ministerios: [{ id: "min-1", nome: "Louvor" }],
      canEdit: false,
    });
    expect(html).not.toContain('value="remove-membro"');
    expect(html).not.toContain(">Desvincular<");
    expect(html).not.toContain("Adicionar");
  });
});
