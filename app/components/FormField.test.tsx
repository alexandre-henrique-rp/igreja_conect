/**
 * Teste do componente <FormField /> (S02-T03).
 *
 * Valida wrapper de campo de formulário com label, hint, error e
 * propagação de props nativas.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { FormField } from "./FormField";

function renderField(
  props: Omit<Parameters<typeof FormField>[0], "children"> & {
    children: React.ReactNode;
  }
): string {
  const { children, ...rest } = props;
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <FormField {...rest}>{children}</FormField>,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<FormField />", () => {
  it("renderiza <label> associado via htmlFor", () => {
    const html = renderField({
      label: "Nome",
      name: "nome",
      id: "nome",
      children: <input id="nome" name="nome" />,
    });
    expect(html).toContain("<label");
    expect(html).toContain('for="nome"');
  });

  it("renderiza children (campo de input) dentro do wrapper", () => {
    const html = renderField({
      label: "Nome",
      name: "nome",
      id: "nome",
      children: <input id="nome" name="nome" />,
    });
    expect(html).toContain('id="nome"');
    expect(html).toContain('name="nome"');
  });

  it("com hint: renderiza mensagem de ajuda com id derivado", () => {
    const html = renderField({
      label: "Nome",
      name: "nome",
      id: "nome",
      hint: "Mínimo 2 caracteres.",
      children: <input id="nome" name="nome" />,
    });
    expect(html).toContain("Mínimo 2 caracteres.");
    expect(html).toContain('id="nome-hint"');
  });

  it("com error: renderiza mensagem de erro com role='alert' e id derivado", () => {
    const html = renderField({
      label: "Nome",
      name: "nome",
      id: "nome",
      error: "Nome obrigatório.",
      children: <input id="nome" name="nome" />,
    });
    expect(html).toContain("Nome obrigatório.");
    expect(html).toContain('id="nome-error"');
    expect(html).toContain('role="alert"');
  });

  it("error sobrescreve hint (não mostra hint quando há erro)", () => {
    const html = renderField({
      label: "Nome",
      name: "nome",
      id: "nome",
      hint: "Mínimo 2 caracteres.",
      error: "Nome obrigatório.",
      children: <input id="nome" name="nome" />,
    });
    expect(html).toContain("Nome obrigatório.");
    expect(html).not.toContain("Mínimo 2 caracteres.");
  });

  it("required adiciona asterisco vermelho no label", () => {
    const html = renderField({
      label: "Nome",
      name: "nome",
      id: "nome",
      required: true,
      children: <input id="nome" name="nome" />,
    });
    // Asterisco decorativo (aria-hidden)
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("text-red-700");
  });

  it("sem hint e sem error: NÃO renderiza bloco de mensagem", () => {
    const html = renderField({
      label: "Nome",
      name: "nome",
      id: "nome",
      children: <input id="nome" name="nome" />,
    });
    expect(html).not.toContain("-hint");
    expect(html).not.toContain("-error");
  });
});
