/**
 * Teste do componente <AcoesMembro /> (S03-T07).
 *
 * Agrupa os botões de ação do detalhe do membro: Editar (sempre) +
 * Excluir (apenas ADMIN/PASTOR).
 *
 * **RBAC (camada 1 UI):** Excluir escondido para não-ADMIN/PASTOR.
 * O action DELETE revalida (camada 3 — defense in depth).
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { AcoesMembro } from "./AcoesMembro";

function renderAcoes(
  props: Parameters<typeof AcoesMembro>[0]
): string {
  const Stub = createRoutesStub([
    {
      path: "/app/membros/:id",
      Component: () => <AcoesMembro {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/app/membros/m1"]} />);
}

describe("<AcoesMembro />", () => {
  it("sempre renderiza botão 'Editar' (link para /editar)", () => {
    const html = renderAcoes({
      membro: { id: "m1", nome: "Maria" },
      canDelete: false,
    });
    expect(html).toContain("Editar");
    expect(html).toContain('href="/app/membros/m1/editar"');
  });

  it("canDelete=true: renderiza botão 'Excluir'", () => {
    const html = renderAcoes({
      membro: { id: "m1", nome: "Maria" },
      canDelete: true,
    });
    expect(html).toContain("Excluir");
  });

  it("canDelete=false: NÃO renderiza botão 'Excluir'", () => {
    const html = renderAcoes({
      membro: { id: "m1", nome: "Maria" },
      canDelete: false,
    });
    expect(html).not.toContain(">Excluir<");
  });

  it("botão Excluir tem form com intent=delete", () => {
    const html = renderAcoes({
      membro: { id: "m1", nome: "Maria" },
      canDelete: true,
    });
    expect(html).toContain("<form");
    expect(html).toContain('name="intent"');
    expect(html).toContain('value="delete"');
  });
});
