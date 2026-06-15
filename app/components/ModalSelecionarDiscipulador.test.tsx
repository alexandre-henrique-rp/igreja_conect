/**
 * Teste do componente <ModalSelecionarDiscipulador /> (S03-T05).
 *
 * Modal usado em `DiscipuladoPainel` para selecionar o discipulador de
 * um membro. Implementa:
 * - Filtro de busca textual.
 * - Radio group com fieldset/legend (a11y).
 * - Discipulador com count >= 12 fica `disabled` (RN-MEM-04).
 * - Lista de discipuladores passada como prop (excl. self já é filtrado
 *   no service / loader — UI apenas exibe).
 *
 * **Estratégia de teste:** renderiza com `open=true` (Dialog SSR
 * retorna inline porque `document` é undefined). Valida estrutura
 * semântica e elementos do form.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { ModalSelecionarDiscipulador } from "./ModalSelecionarDiscipulador";

type Discipulador = { id: string; nome: string; count: number };

function renderModal(
  props: {
    open: boolean;
  } & Omit<
    Parameters<typeof ModalSelecionarDiscipulador>[0],
    "open"
  >
): string {
  const Stub = createRoutesStub([
    {
      path: "/app/membros/:id",
      Component: () => <ModalSelecionarDiscipulador {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/app/membros/m1"]} />);
}

const baseProps = {
  onClose: () => {},
  membroId: "m1",
  discipuladores: [
    { id: "d1", nome: "João Silva", count: 8 },
    { id: "d2", nome: "Maria Santos", count: 12 },
    { id: "d3", nome: "Pedro Costa", count: 0 },
  ] as Discipulador[],
  mode: "vincular" as const,
};

describe("<ModalSelecionarDiscipulador />", () => {
  it("open=false: não renderiza o modal", () => {
    const html = renderModal({ ...baseProps, open: false });
    expect(html).not.toContain('role="dialog"');
  });

  it("open=true: renderiza Dialog com role='dialog'", () => {
    const html = renderModal({ ...baseProps, open: true });
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });

  it("título muda conforme mode ('Vincular' vs 'Reatribuir')", () => {
    expect(renderModal({ ...baseProps, open: true })).toContain("Vincular");
    expect(
      renderModal({ ...baseProps, open: true, mode: "reatribuir" })
    ).toContain("Reatribuir");
  });

  it("renderiza fieldset/legend do radio group", () => {
    const html = renderModal({ ...baseProps, open: true });
    expect(html).toContain("<fieldset");
    expect(html).toContain("<legend");
  });

  it("renderiza radios para cada discipulador", () => {
    const html = renderModal({ ...baseProps, open: true });
    // 3 discipuladores → 3 radios
    const radioCount = (html.match(/type="radio"/g) ?? []).length;
    expect(radioCount).toBe(3);
  });

  it("discipulador com count >= 12: radio tem disabled", () => {
    const html = renderModal({ ...baseProps, open: true });
    // Maria Santos (count=12) → radio disabled
    // O id dela é "d2" — verificamos que o input com value="d2" tem disabled
    // (a ordem dos atributos no HTML pode variar — usamos uma regex que
    // aceita disabled/value em qualquer ordem dentro do mesmo <input>).
    const pattern =
      /<input(?=[^>]*value="d2")(?=[^>]*disabled)[^>]*type="radio"[^>]*>/i;
    expect(html).toMatch(pattern);
  });

  it("discipuladores com count < 12: radio NÃO tem disabled", () => {
    const html = renderModal({ ...baseProps, open: true });
    // João (count=8) e Pedro (count=0) → não disabled
    // Lookahead negativo: o input com value="d1"/"d3" NÃO tem disabled.
    const pattern1 =
      /<input(?=[^>]*value="d1")(?![^>]*disabled)[^>]*type="radio"[^>]*>/i;
    const pattern2 =
      /<input(?=[^>]*value="d3")(?![^>]*disabled)[^>]*type="radio"[^>]*>/i;
    expect(html).toMatch(pattern1);
    expect(html).toMatch(pattern2);
  });

  it("mostra contador 'X/12' para cada discipulador", () => {
    const html = renderModal({ ...baseProps, open: true });
    expect(html).toContain("8/12");
    expect(html).toContain("12/12");
    expect(html).toContain("0/12");
  });

  it("discipulador no limite mostra badge 'Limite atingido'", () => {
    const html = renderModal({ ...baseProps, open: true });
    expect(html).toContain("Limite");
  });

  it("input hidden com membroId do discípulo", () => {
    const html = renderModal({ ...baseProps, open: true });
    expect(html).toContain('name="membroId"');
    expect(html).toContain('value="m1"');
  });

  it("input hidden com intent=assign", () => {
    const html = renderModal({ ...baseProps, open: true });
    expect(html).toContain('name="intent"');
    expect(html).toContain('value="assign"');
  });

  it("input hidden com discipuladorId (string vazia por default)", () => {
    const html = renderModal({ ...baseProps, open: true });
    expect(html).toContain('name="discipuladorId"');
  });

  it("botão 'Vincular' presente no footer", () => {
    const html = renderModal({ ...baseProps, open: true });
    expect(html).toContain("Vincular");
  });

  it("botão 'Cancelar' presente no footer", () => {
    const html = renderModal({ ...baseProps, open: true });
    expect(html).toContain("Cancelar");
  });
});
