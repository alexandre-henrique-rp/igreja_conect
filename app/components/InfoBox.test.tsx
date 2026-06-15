/**
 * Teste do componente <InfoBox /> (S03-T09).
 *
 * Caixa de informação com ícone + título + children, em 2 tons
 * (info = cyan, warning = amber). Usado para mensagens contextuais
 * em formulários e telas (ex: "Este ministério está sem coordenação").
 *
 * **Comportamento esperado:**
 * 1. Renderiza `role="note"` (semântica de anotação para screen reader).
 * 2. Tem ícone SVG com `aria-hidden`.
 * 3. Renderiza título quando fornecido.
 * 4. Renderiza children (mensagem).
 * 5. tone="info" → classes cyan.
 * 6. tone="warning" → classes amber.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { InfoBox } from "./InfoBox";

function renderBox(
  props: Partial<Parameters<typeof InfoBox>[0]> & { children: React.ReactNode }
): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <InfoBox {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<InfoBox />", () => {
  it("renderiza role='note' para screen reader", () => {
    const html = renderBox({ children: "Mensagem" });
    expect(html).toContain('role="note"');
  });

  it("renderiza ícone SVG com aria-hidden", () => {
    const html = renderBox({ children: "X" });
    expect(html).toContain("<svg");
    expect(html).toContain('aria-hidden="true"');
  });

  it("renderiza children", () => {
    const html = renderBox({ children: "Mensagem importante" });
    expect(html).toContain("Mensagem importante");
  });

  it("renderiza título quando fornecido", () => {
    const html = renderBox({ title: "Atenção", children: "Conteúdo" });
    expect(html).toContain("Atenção");
  });

  it("sem título: NÃO renderiza h3", () => {
    const html = renderBox({ children: "Apenas mensagem" });
    expect(html).not.toContain("<h3");
  });

  it("tone='info': classes cyan (default)", () => {
    const html = renderBox({ children: "X" });
    // tone default = info
    expect(html).toContain("border-cyan-200");
    expect(html).toContain("bg-cyan-50");
  });

  it("tone='warning': classes amber", () => {
    const html = renderBox({ tone: "warning", children: "X" });
    expect(html).toContain("border-amber-200");
    expect(html).toContain("bg-amber-50");
  });
});
