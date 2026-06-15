/**
 * Teste do componente <TopbarPublica /> (S01-T06).
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { TopbarPublica } from "./TopbarPublica";

function renderTopbar(props: Parameters<typeof TopbarPublica>[0]): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <TopbarPublica {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<TopbarPublica />", () => {
  it("renderiza <header> com posição sticky", () => {
    const html = renderTopbar({});
    expect(html).toContain("<header");
    expect(html).toContain("sticky");
    expect(html).toContain("top-0");
  });

  it("renderiza o logo 'Igreja Conect' com link para /", () => {
    const html = renderTopbar({});
    expect(html).toContain("Igreja Conect");
    // Link para home (href="/")
    expect(html).toContain('href="/"');
  });

  it("logo tem aria-label descritivo", () => {
    const html = renderTopbar({});
    expect(html).toContain('aria-label="Ir para a página inicial"');
  });

  it("com entrarHref='/login': renderiza link 'Entrar' apontando para /login", () => {
    const html = renderTopbar({ entrarHref: "/login" });
    expect(html).toContain("Entrar");
    expect(html).toContain('href="/login"');
  });

  it("sem entrarHref: NÃO renderiza link 'Entrar'", () => {
    const html = renderTopbar({});
    expect(html).not.toContain(">Entrar<");
  });

  it("renderiza skip link WCAG (Pular para o conteúdo)", () => {
    const html = renderTopbar({});
    expect(html).toContain("Pular para o conteúdo");
    expect(html).toContain('href="#main-content"');
  });
});
