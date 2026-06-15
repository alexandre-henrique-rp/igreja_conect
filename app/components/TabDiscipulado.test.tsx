/**
 * Teste do componente <TabDiscipulado /> (S03-T07).
 *
 * Tab que mostra o vínculo de discipulado do membro DENTRO da página
 * de detalhe. Aponta para a página dedicada de gerenciamento
 * (`/app/membros/:id/discipulado`) para vincular/desvincular.
 *
 * **Estados:**
 * 1. Com discipulador: card com nome + link "Gerenciar discipulado".
 * 2. Sem discipulador: card "não vinculado" + link "Gerenciar".
 * 3. Com discípulos (quando o foco é o discipulador): lista.
 * 4. `canEdit=true`: link para a página de gerenciamento.
 * 5. `canEdit=false`: sem link (read-only).
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { TabDiscipulado } from "./TabDiscipulado";

function renderTab(
  props: Parameters<typeof TabDiscipulado>[0]
): string {
  const Stub = createRoutesStub([
    {
      path: "/app/membros/:id",
      Component: () => <TabDiscipulado {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/app/membros/m1"]} />);
}

describe("<TabDiscipulado />", () => {
  it("com discipulador: renderiza nome", () => {
    const html = renderTab({
      membroId: "m1",
      discipulador: { id: "d1", nome: "João Silva" },
      discipulos: [],
      canEdit: true,
    });
    expect(html).toContain("João Silva");
  });

  it("com discipulador: mostra badge 'Discipulador atual'", () => {
    const html = renderTab({
      membroId: "m1",
      discipulador: { id: "d1", nome: "João Silva" },
      discipulos: [],
      canEdit: true,
    });
    expect(html).toContain("Discipulador");
  });

  it("sem discipulador: mostra mensagem 'não possui discipulador'", () => {
    const html = renderTab({
      membroId: "m1",
      discipulador: null,
      discipulos: [],
      canEdit: true,
    });
    expect(html).toContain("não possui discipulador");
  });

  it("canEdit=true: link 'Gerenciar discipulado' aponta para a rota dedicada", () => {
    const html = renderTab({
      membroId: "m1",
      discipulador: null,
      discipulos: [],
      canEdit: true,
    });
    expect(html).toContain('href="/app/membros/m1/discipulado"');
  });

  it("canEdit=false: NÃO mostra link 'Gerenciar'", () => {
    const html = renderTab({
      membroId: "m1",
      discipulador: { id: "d1", nome: "João" },
      discipulos: [],
      canEdit: false,
    });
    expect(html).not.toContain("Gerenciar discipulado");
  });

  it("com discípulos: renderiza lista", () => {
    const html = renderTab({
      membroId: "m1",
      discipulador: { id: "d1", nome: "João" },
      discipulos: [
        { id: "x1", nome: "Ana" },
        { id: "x2", nome: "Carlos" },
      ],
      canEdit: true,
    });
    expect(html).toContain("Ana");
    expect(html).toContain("Carlos");
  });

  it("com discípulos: mostra badge com contagem", () => {
    const html = renderTab({
      membroId: "m1",
      discipulador: { id: "d1", nome: "João" },
      discipulos: [
        { id: "x1", nome: "Ana" },
        { id: "x2", nome: "Carlos" },
      ],
      canEdit: true,
    });
    expect(html).toContain("2");
  });
});
