/**
 * Teste do componente <Checkbox /> (S01-T06).
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { Checkbox } from "./Checkbox";

function renderCheckbox(props: Parameters<typeof Checkbox>[0]): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <Checkbox {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<Checkbox />", () => {
  it("renderiza <input type='checkbox'> + texto do label", () => {
    const html = renderCheckbox({
      label: "Manter-me conectado",
      name: "manterConectado",
    });
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('name="manterConectado"');
    expect(html).toContain("Manter-me conectado");
  });

  it("label encapsula o input (label aninhado, sem htmlFor necessário)", () => {
    const html = renderCheckbox({
      label: "Manter-me conectado",
      name: "manterConectado",
    });
    // Estrutura: <label><input .../> <span>texto</span></label>
    // A associação implícita funciona por aninhamento (acessibilidade Nativa).
    expect(html).toMatch(/<label[^>]*>[\s\S]*<input[\s\S]*<\/label>/);
  });

  it("defaultChecked=true adiciona atributo checked", () => {
    const html = renderCheckbox({
      label: "Manter-me conectado",
      name: "manterConectado",
      defaultChecked: true,
    });
    expect(html).toContain("checked");
  });

  it("value='true' é passado para o input", () => {
    const html = renderCheckbox({
      label: "Manter-me conectado",
      name: "manterConectado",
      value: "true",
    });
    expect(html).toContain('value="true"');
  });

  it("label tem classes de cursor-pointer (UX)", () => {
    const html = renderCheckbox({
      label: "Manter-me conectado",
      name: "manterConectado",
    });
    expect(html).toContain("cursor-pointer");
  });
});
