/**
 * Teste do componente <Can /> (S03-T07).
 *
 * Helper client-side para autorização baseada em cargo. Usado como
 * **camada 1 RBAC** (UI) — esconde elementos quando o usuário não
 * tem permissão. O backend revalida (camada 3) — defense in depth.
 *
 * **Comportamento esperado:**
 * 1. `user.cargo` em `allow` → renderiza `children`.
 * 2. `user.cargo` NÃO em `allow` → renderiza `fallback` (default null).
 * 3. `user.cargo` é null → renderiza `fallback` (não autenticado/cargo).
 * 4. `allow` é array vazio → nunca renderiza children.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { Can } from "./Can";

function renderCan(
  props: Parameters<typeof Can>[0]
): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <Can {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<Can /> (helper RBAC client-side)", () => {
  it("user.cargo em allow: renderiza children", () => {
    const html = renderCan({
      user: { cargo: "ADMIN" },
      allow: ["ADMIN", "PASTOR"],
      children: <button>Excluir</button>,
    });
    expect(html).toContain("Excluir");
  });

  it("user.cargo NÃO em allow: renderiza fallback (default null)", () => {
    const html = renderCan({
      user: { cargo: "SECRETARIO" },
      allow: ["ADMIN", "PASTOR"],
      children: <button>Excluir</button>,
    });
    expect(html).not.toContain("Excluir");
  });

  it("user.cargo NÃO em allow + fallback fornecido: renderiza fallback", () => {
    const html = renderCan({
      user: { cargo: "SECRETARIO" },
      allow: ["ADMIN"],
      children: <button>Excluir</button>,
      fallback: <span>Sem permissão</span>,
    });
    expect(html).not.toContain("Excluir");
    expect(html).toContain("Sem permissão");
  });

  it("user.cargo null: renderiza fallback (não autenticado)", () => {
    const html = renderCan({
      user: { cargo: null },
      allow: ["ADMIN"],
      children: <button>Excluir</button>,
    });
    expect(html).not.toContain("Excluir");
  });

  it("allow=[]: nunca renderiza children", () => {
    const html = renderCan({
      user: { cargo: "ADMIN" },
      allow: [],
      children: <button>Nunca</button>,
    });
    expect(html).not.toContain("Nunca");
  });

  it("múltiplos cargos: aceita qualquer um da lista", () => {
    expect(
      renderCan({
        user: { cargo: "PASTOR" },
        allow: ["ADMIN", "PASTOR", "FINANCEIRO"],
        children: <span>X</span>,
      })
    ).toContain("X");
    expect(
      renderCan({
        user: { cargo: "FINANCEIRO" },
        allow: ["ADMIN", "PASTOR", "FINANCEIRO"],
        children: <span>Y</span>,
      })
    ).toContain("Y");
    expect(
      renderCan({
        user: { cargo: "DISCIPULADOR" },
        allow: ["ADMIN", "PASTOR", "FINANCEIRO"],
        children: <span>Z</span>,
      })
    ).not.toContain("Z");
  });
});
