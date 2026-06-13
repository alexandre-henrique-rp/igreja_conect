/**
 * Teste do componente <TopbarAutenticada /> (S02-T09).
 *
 * Valida logo, badge de alertas (com contagem), avatar com nome do
 * usuário e link para dashboard.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { TopbarAutenticada } from "./TopbarAutenticada";

function renderTopbar(
  props: Parameters<typeof TopbarAutenticada>[0]
): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <TopbarAutenticada {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<TopbarAutenticada />", () => {
  it("renderiza <header> sticky com border-b", () => {
    const html = renderTopbar({
      user: { id: "u1", nome: "Maria", cargo: "ADMIN" },
      alertasNaoLidos: 0,
    });
    expect(html).toContain("<header");
    expect(html).toContain("sticky");
    expect(html).toContain("top-0");
    expect(html).toContain("border-b");
  });

  it("renderiza logo 'Igreja Conect' como link para /app", () => {
    const html = renderTopbar({
      user: { id: "u1", nome: "Maria", cargo: "ADMIN" },
      alertasNaoLidos: 0,
    });
    expect(html).toContain("Igreja Conect");
    expect(html).toContain('href="/app"');
  });

  it("alertasNaoLidos=0: NÃO renderiza badge numérico", () => {
    const html = renderTopbar({
      user: { id: "u1", nome: "Maria", cargo: "ADMIN" },
      alertasNaoLidos: 0,
    });
    // Sem badge de número (sem bg-amber-600 com texto)
    expect(html).not.toContain("bg-amber-600");
  });

  it("alertasNaoLidos>0: renderiza badge com número", () => {
    const html = renderTopbar({
      user: { id: "u1", nome: "Maria", cargo: "ADMIN" },
      alertasNaoLidos: 3,
    });
    expect(html).toContain("bg-amber-600");
    expect(html).toContain("3");
  });

  it("ícone de alertas tem aria-label dinâmico (com/sem contagem)", () => {
    // Com contagem: label inclui "X não lidos"
    const htmlCom = renderTopbar({
      user: { id: "u1", nome: "Maria", cargo: "ADMIN" },
      alertasNaoLidos: 5,
    });
    expect(htmlCom).toContain('aria-label="Alertas (5 não lidos)"');

    // Sem contagem: label é apenas "Alertas"
    const htmlSem = renderTopbar({
      user: { id: "u1", nome: "Maria", cargo: "ADMIN" },
      alertasNaoLidos: 0,
    });
    expect(htmlSem).toContain('aria-label="Alertas"');
  });

  it("mostra nome do usuário no avatar", () => {
    const html = renderTopbar({
      user: { id: "u1", nome: "Maria de Teste", cargo: "ADMIN" },
      alertasNaoLidos: 0,
    });
    expect(html).toContain("Maria de Teste");
  });

  it("mostra cargo quando presente", () => {
    const html = renderTopbar({
      user: { id: "u1", nome: "João", cargo: "PASTOR" },
      alertasNaoLidos: 0,
    });
    expect(html).toContain("PASTOR");
  });

  it("sem cargo: mostra 'Membro' em vez do cargo", () => {
    const html = renderTopbar({
      user: { id: "u1", nome: "Visitante", cargo: null },
      alertasNaoLidos: 0,
    });
    expect(html).toContain("Membro");
  });
});
