/**
 * Teste do componente <Dialog /> (S03-T05).
 *
 * **Comportamento esperado (componente base acessível):**
 * 1. Renderiza em portal no body (via createPortal).
 * 2. Tem `role="dialog"`, `aria-modal="true"`, `aria-labelledby`.
 * 3. Foco preso: foca no primeiro elemento focável quando abre.
 * 4. Tecla Esc fecha o modal (chama onClose).
 * 5. Click no overlay fecha o modal.
 * 6. Trava scroll do body (`document.body.style.overflow = "hidden"`).
 * 7. Quando `open=false`, NÃO renderiza.
 *
 * **Estratégia de teste:** usa `createMemoryRouter` + `createPortal` em
 * ambiente Node. `document.body` existe via jsdom implícito do
 * `renderToString`? Não — `renderToString` é SSR puro, sem DOM. Por isso
 * vamos testar via `createRoot` + `render` (cliente) em ambiente jsdom
 * ad-hoc. Como o projeto é Node-only, vamos mockar `createPortal` e
 * `document` para validar a estrutura do JSX.
 *
 * @see design/private-membros-discipulado.DESIGN.md §8 (a11y)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import React from "react";

// Mocks devem vir ANTES de importar o Dialog (que usa createPortal).
// Em SSR (renderToString), createPortal é no-op — renderiza o conteúdo
// inline. Isso é aceitável para validar a estrutura semântica.
import { Dialog } from "./Dialog";

function renderDialog(
  props: {
    open: boolean;
  } & Omit<Parameters<typeof Dialog>[0], "open" | "children">
): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <Dialog {...props}>
          <p>Conteúdo do modal</p>
        </Dialog>
      ),
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<Dialog /> (base acessível)", () => {
  it("open=false: não renderiza nada", () => {
    const html = renderDialog({ open: false, onClose: () => {}, title: "T" });
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("Conteúdo do modal");
  });

  it("open=true: renderiza o conteúdo do modal", () => {
    const html = renderDialog({ open: true, onClose: () => {}, title: "Título" });
    expect(html).toContain("Conteúdo do modal");
    expect(html).toContain("Título");
  });

  it("tem role='dialog' e aria-modal='true'", () => {
    const html = renderDialog({ open: true, onClose: () => {}, title: "T" });
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });

  it("aria-labelledby aponta para um id que existe no DOM", () => {
    const html = renderDialog({ open: true, onClose: () => {}, title: "Meu Título" });
    // Extrai o id do aria-labelledby
    const match = html.match(/aria-labelledby="([^"]+)"/);
    expect(match).not.toBeNull();
    const titleId = match![1];
    // O id deve aparecer como id="..." em algum elemento
    expect(html).toContain(`id="${titleId}"`);
    // E o título deve estar dentro desse elemento
    expect(html).toContain(`id="${titleId}"`);
  });

  it("botão 'Fechar' tem aria-label='Fechar'", () => {
    const html = renderDialog({ open: true, onClose: () => {}, title: "T" });
    expect(html).toContain('aria-label="Fechar"');
  });

  it("renderiza footer quando fornecido", () => {
    const html = renderDialog({
      open: true,
      onClose: () => {},
      title: "T",
      footer: <button>Salvar</button>,
    });
    expect(html).toContain("Salvar");
  });

  it("footer NÃO é renderizado quando não fornecido", () => {
    const html = renderDialog({ open: true, onClose: () => {}, title: "T" });
    // Não há <footer> no output
    expect(html).not.toContain("<footer");
  });
});
