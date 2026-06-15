/**
 * Teste do componente <Button> (S01-T06).
 *
 * Renderiza via `createRoutesStub` + `renderToString` do React DOM Server.
 * Esta estratégia evita dependência de @testing-library/jsdom (não instalado
 * no projeto) e ainda valida o HTML SSR — o que o usuário recebe.
 *
 * Para cada teste conferimos que o HTML gerado contém as classes
 * Tailwind e atributos ARIA esperados.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { Button } from "./Button";

/**
 * Helper: renderiza o Button dentro de uma rota stub e devolve o HTML.
 * `createRoutesStub` injeta o contexto de Router necessário para
 * `useNavigation`, `<Link>`, `<Form>`, etc. — sem ele, esses hooks
 * explodem em ambiente de teste.
 */
function renderButton(props: Partial<Parameters<typeof Button>[0]> = {}): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <Button {...props} data-testid="btn">
          Click
        </Button>
      ),
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<Button />", () => {
  it("renderiza um <button> por padrão", () => {
    const html = renderButton({});
    expect(html).toContain("<button");
    expect(html).toContain("Click");
  });

  it("variant primary tem classe bg-cyan-700", () => {
    const html = renderButton({ variant: "primary" });
    expect(html).toContain("bg-cyan-700");
  });

  it("variant secondary tem bg-slate-200", () => {
    const html = renderButton({ variant: "secondary" });
    expect(html).toContain("bg-slate-200");
  });

  it("variant ghost não tem bg-cyan-700", () => {
    const html = renderButton({ variant: "ghost" });
    expect(html).not.toContain("bg-cyan-700");
  });

  it("variant danger tem bg-red-700", () => {
    const html = renderButton({ variant: "danger" });
    expect(html).toContain("bg-red-700");
  });

  it("size sm tem h-9 (small height)", () => {
    const html = renderButton({ size: "sm" });
    expect(html).toContain("h-9");
  });

  it("size md tem h-11 (default height)", () => {
    const html = renderButton({ size: "md" });
    expect(html).toContain("h-11");
  });

  it("loading=true adiciona aria-busy='true' e spinner", () => {
    const html = renderButton({ loading: true });
    expect(html).toContain('aria-busy="true"');
    // SVG do spinner (animate-spin)
    expect(html).toContain("animate-spin");
  });

  it("loading=false não tem aria-busy", () => {
    const html = renderButton({ loading: false });
    expect(html).not.toContain('aria-busy="true"');
  });

  it("disabled fica com opacity-50 e cursor-not-allowed", () => {
    const html = renderButton({ disabled: true });
    expect(html).toContain("opacity-50");
    expect(html).toContain("cursor-not-allowed");
  });

  it("type='submit' passa o atributo para o button", () => {
    const html = renderButton({ type: "submit" });
    expect(html).toContain('type="submit"');
  });
});
