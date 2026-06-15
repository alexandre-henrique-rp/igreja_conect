/**
 * Teste do componente <RadioGroup /> (S03-T09).
 *
 * Radio group acessível com `<fieldset>` + `<legend>` (WCAG 1.3.1).
 * Usado quando há 2+ opções mutuamente exclusivas a serem exibidas
 * em grupo (ex: modo do modal, tipo de filtro, etc).
 *
 * **Comportamento esperado:**
 * 1. Renderiza `<fieldset>` com `<legend>`.
 * 2. Cada option vira `<label>` + `<input type="radio">`.
 * 3. `defaultValue` marca o radio correspondente.
 * 4. `onChange` é chamado com o `value` selecionado.
 * 5. Todos compartilham o mesmo `name`.
 */
import { describe, it, expect, vi } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import React from "react";
import { RadioGroup } from "./RadioGroup";

function renderGroup(
  props: Parameters<typeof RadioGroup>[0]
): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <RadioGroup {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<RadioGroup />", () => {
  it("renderiza <fieldset> com <legend>", () => {
    const html = renderGroup({
      name: "tipo",
      legend: "Selecione o tipo",
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
    });
    expect(html).toContain("<fieldset");
    expect(html).toContain("<legend");
    expect(html).toContain("Selecione o tipo");
  });

  it("renderiza um <input type='radio'> por opção", () => {
    const html = renderGroup({
      name: "tipo",
      legend: "L",
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
        { value: "c", label: "C" },
      ],
    });
    const radios = (html.match(/type="radio"/g) ?? []).length;
    expect(radios).toBe(3);
  });

  it("todos os radios compartilham o mesmo `name`", () => {
    const html = renderGroup({
      name: "ministerio-tipo",
      legend: "L",
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
    });
    const names = (html.match(/name="ministerio-tipo"/g) ?? []).length;
    expect(names).toBe(2);
  });

  it("defaultValue marca o radio correspondente com 'checked'", () => {
    const html = renderGroup({
      name: "tipo",
      legend: "L",
      defaultValue: "b",
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
    });
    // O radio com value="b" deve ter checked (a ordem dos atributos
    // pode variar no SSR — usamos lookaheads em qualquer ordem).
    const pattern =
      /<input(?=[^>]*value="b")(?=[^>]*checked)[^>]*type="radio"[^>]*>/i;
    expect(html).toMatch(pattern);
  });

  it("sem defaultValue: nenhum radio vem marcado", () => {
    const html = renderGroup({
      name: "tipo",
      legend: "L",
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
    });
    // Nenhum radio com "checked" (a string pode aparecer em outros
    // atributos como "defaultChecked"? Não — usamos defaultChecked).
    // Vamos checar que NÃO há defaultChecked (HTML usa checked)
    const checkedCount = (html.match(/\bchecked\b/g) ?? []).length;
    expect(checkedCount).toBe(0);
  });

  it("renderiza label de cada opção", () => {
    const html = renderGroup({
      name: "tipo",
      legend: "L",
      options: [
        { value: "a", label: "Opção A" },
        { value: "b", label: "Opção B" },
      ],
    });
    expect(html).toContain("Opção A");
    expect(html).toContain("Opção B");
  });
});
