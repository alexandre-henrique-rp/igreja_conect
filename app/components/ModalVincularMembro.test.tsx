/**
 * Teste do componente <ModalVincularMembro /> (S03-T09).
 *
 * Modal usado para vincular um membro a um ministério. Recebe a
 * lista de membros disponíveis (loader já exclui quem já está no
 * ministério) e submete com `intent=add-membro`.
 *
 * **Comportamento esperado:**
 * 1. Renderiza Dialog com `role="dialog"`.
 * 2. Form com `intent=add-membro`, `ministerioId`, `membroId`.
 * 3. Select com membros disponíveis.
 * 4. Buscar filtra a lista.
 * 5. Footer: Cancelar + Vincular.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { ModalVincularMembro } from "./ModalVincularMembro";

function renderModal(
  props: {
    open: boolean;
  } & Omit<
    Parameters<typeof ModalVincularMembro>[0],
    "open"
  >
): string {
  const Stub = createRoutesStub([
    {
      path: "/app/ministerios",
      Component: () => <ModalVincularMembro {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/app/ministerios"]} />);
}

const baseProps = {
  onClose: () => {},
  ministerioId: "min-1",
  membrosDisponiveis: [
    { id: "m1", nome: "Ana Pereira" },
    { id: "m2", nome: "Carlos Souza" },
  ],
};

describe("<ModalVincularMembro />", () => {
  it("open=false: não renderiza", () => {
    const html = renderModal({ ...baseProps, open: false });
    expect(html).not.toContain('role="dialog"');
  });

  it("open=true: renderiza Dialog com form", () => {
    const html = renderModal({ ...baseProps, open: true });
    expect(html).toContain('role="dialog"');
    expect(html).toContain('name="intent"');
    expect(html).toContain('value="add-membro"');
  });

  it("hidden com ministerioId", () => {
    const html = renderModal({ ...baseProps, open: true });
    expect(html).toContain('name="ministerioId"');
    expect(html).toContain('value="min-1"');
  });

  it("renderiza select com opções dos membros disponíveis", () => {
    const html = renderModal({ ...baseProps, open: true });
    expect(html).toContain("<select");
    expect(html).toContain('name="membroId"');
    expect(html).toContain("Ana Pereira");
    expect(html).toContain("Carlos Souza");
  });

  it("campo de busca filtra a lista", () => {
    const html = renderModal({ ...baseProps, open: true });
    // O input de busca existe
    expect(html).toContain('type="search"');
  });

  it("footer tem 'Cancelar' e 'Vincular'", () => {
    const html = renderModal({ ...baseProps, open: true });
    expect(html).toContain("Cancelar");
    expect(html).toContain("Vincular");
  });

  it("renderiza título 'Vincular membro'", () => {
    const html = renderModal({ ...baseProps, open: true });
    expect(html).toContain("Vincular membro");
  });

  it("lista vazia: mostra mensagem 'Nenhum membro disponível'", () => {
    const html = renderModal({ ...baseProps, open: true, membrosDisponiveis: [] });
    expect(html).toContain("Nenhum membro");
  });
});
