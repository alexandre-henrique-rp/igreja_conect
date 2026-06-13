/**
 * Teste do componente <Select /> (S02-T03).
 *
 * Valida render SSR do <select> com label associado, options, placeholder
 * e propagação de classes via `className`.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { Select } from "./Select";

function renderSelect(props: Parameters<typeof Select>[0]): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <Select {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<Select />", () => {
  const TIPO_OPTIONS = [
    { value: "VISITANTE", label: "Visitantes" },
    { value: "CONGREGADO", label: "Congregados" },
    { value: "MEMBRO_ATIVO", label: "Membros ativos" },
  ];

  it("renderiza <label> associado via htmlFor quando label é fornecido", () => {
    const html = renderSelect({
      name: "tipo",
      label: "Tipo",
      id: "tipo",
      options: TIPO_OPTIONS,
    });
    expect(html).toContain("<label");
    expect(html).toContain('for="tipo"');
    expect(html).toContain('id="tipo"');
  });

  it("renderiza <select> com name e options", () => {
    const html = renderSelect({ name: "tipo", options: TIPO_OPTIONS });
    expect(html).toContain("<select");
    expect(html).toContain('name="tipo"');
    // 3 options
    expect((html.match(/<option/g) ?? []).length).toBe(3);
  });

  it("renderiza placeholder como primeira option com value vazio", () => {
    const html = renderSelect({
      name: "tipo",
      placeholder: "Todos os tipos",
      options: TIPO_OPTIONS,
    });
    expect(html).toContain("Todos os tipos");
    // A primeira option deve ter value=""
    const optionMatch = html.match(/<option value=""[^>]*>Todos os tipos/);
    expect(optionMatch).not.toBeNull();
  });

  it("sem placeholder: NÃO renderiza option vazia", () => {
    const html = renderSelect({ name: "tipo", options: TIPO_OPTIONS });
    expect(html).not.toContain('value=""');
  });

  it("defaultValue marca a option correspondente com selected", () => {
    const html = renderSelect({
      name: "tipo",
      defaultValue: "CONGREGADO",
      options: TIPO_OPTIONS,
    });
    // React 19 SSR: defaultValue em <select> vira selected="" na <option> correspondente
    expect(html).toContain('value="CONGREGADO" selected=""');
  });

  it("renderiza classes Tailwind base (h-11, border)", () => {
    const html = renderSelect({ name: "tipo", options: TIPO_OPTIONS });
    expect(html).toContain("h-11");
    expect(html).toContain("border");
  });

  it("className extra é mesclada", () => {
    const html = renderSelect({
      name: "tipo",
      className: "w-48",
      options: TIPO_OPTIONS,
    });
    expect(html).toContain("w-48");
  });
});
