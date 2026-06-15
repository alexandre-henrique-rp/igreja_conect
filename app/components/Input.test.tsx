/**
 * Teste do componente <Input /> (S01-T06).
 *
 * Renderiza via `createRoutesStub` + `renderToString` para validar o HTML
 * SSR gerado. Sem DOM real (jsdom não instalado no projeto).
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { Input } from "./Input";

function renderInput(props: Parameters<typeof Input>[0]): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <Input {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<Input />", () => {
  it("renderiza <label> associado ao input via htmlFor", () => {
    const html = renderInput({ label: "E-mail", name: "email", id: "email" });
    expect(html).toContain("<label");
    expect(html).toContain('for="email"');
    expect(html).toContain('<input');
    expect(html).toContain('id="email"');
    expect(html).toContain('name="email"');
  });

  it("input com type='email' tem atributo type=email", () => {
    const html = renderInput({
      label: "E-mail",
      name: "email",
      type: "email",
      id: "email",
    });
    expect(html).toContain('type="email"');
  });

  it("input com type='password' tem atributo type=password", () => {
    const html = renderInput({
      label: "Senha",
      name: "senha",
      type: "password",
      id: "senha",
    });
    expect(html).toContain('type="password"');
  });

  it("required adiciona aria-required='true' e asterisco visual no label", () => {
    const html = renderInput({
      label: "E-mail",
      name: "email",
      required: true,
      id: "email",
    });
    expect(html).toContain('aria-required="true"');
    // Asterisco decorativo (aria-hidden para screen reader)
    expect(html).toContain('aria-hidden="true"');
  });

  it("error='Email inválido' adiciona aria-invalid='true' e role=alert", () => {
    const html = renderInput({
      label: "E-mail",
      name: "email",
      id: "email",
      error: "E-mail inválido. Verifique o formato.",
    });
    expect(html).toContain('aria-invalid="true"');
    // role=alert no parágrafo de erro (lê por screen reader)
    expect(html).toContain('role="alert"');
    expect(html).toContain("E-mail inválido. Verifique o formato.");
  });

  it("sem error: NÃO tem aria-invalid", () => {
    const html = renderInput({
      label: "E-mail",
      name: "email",
      id: "email",
    });
    expect(html).not.toContain('aria-invalid="true"');
  });

  it("hint='exemplo@igreja.org' é renderizado quando não há error", () => {
    const html = renderInput({
      label: "E-mail",
      name: "email",
      id: "email",
      hint: "exemplo@igreja.org",
    });
    expect(html).toContain("exemplo@igreja.org");
  });

  it("error sobrescreve hint (não mostra hint quando há erro)", () => {
    const html = renderInput({
      label: "E-mail",
      name: "email",
      id: "email",
      hint: "exemplo@igreja.org",
      error: "E-mail inválido.",
    });
    expect(html).toContain("E-mail inválido.");
    expect(html).not.toContain("exemplo@igreja.org");
  });

  it("autoComplete é passado para o input", () => {
    const html = renderInput({
      label: "E-mail",
      name: "email",
      autoComplete: "email",
      id: "email",
    });
    // React 19 SSR mantém o nome da prop em camelCase no output —
    // o browser normaliza para o atributo HTML final na hidratação.
    expect(html).toContain('autoComplete="email"');
  });

  it("inputMode='email' é passado para o input", () => {
    const html = renderInput({
      label: "E-mail",
      name: "email",
      inputMode: "email",
      id: "email",
    });
    expect(html).toContain('inputMode="email"');
  });

  it("error e hint adicionam aria-describedby apontando para o id da descrição", () => {
    const html = renderInput({
      label: "E-mail",
      name: "email",
      id: "email",
      error: "Erro",
    });
    expect(html).toContain('aria-describedby="email-desc"');
  });
});
