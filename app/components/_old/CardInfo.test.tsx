/**
 * Teste do componente <CardInfo /> (S01-T09).
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { CardInfo } from "./CardInfo";

function renderCard(props: Parameters<typeof CardInfo>[0]): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <CardInfo {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<CardInfo />", () => {
  it("renderiza section com h2 do título", () => {
    const html = renderCard({
      title: "O que está disponível agora",
      items: ["Membros", "Discipulado", "Alertas"],
      tone: "available",
    });
    expect(html).toContain("<section");
    expect(html).toContain("<h2");
    expect(html).toContain("O que está disponível agora");
  });

  it("renderiza 3 <li> quando items tem 3 entradas", () => {
    const items = ["Membros", "Discipulado", "Alertas"];
    const html = renderCard({
      title: "Disponíveis",
      items,
      tone: "available",
    });
    const liCount = (html.match(/<li/g) ?? []).length;
    expect(liCount).toBe(3);
  });

  it("renderiza os textos dos items dentro de <li>", () => {
    const html = renderCard({
      title: "Disponíveis",
      items: ["Membros", "Discipulado", "Alertas"],
      tone: "available",
    });
    expect(html).toContain("Membros");
    expect(html).toContain("Discipulado");
    expect(html).toContain("Alertas");
  });

  it("tone='available' tem bullet cyan-700 (text-cyan-700)", () => {
    const html = renderCard({
      title: "Disponíveis",
      items: ["A"],
      tone: "available",
    });
    expect(html).toContain("text-cyan-700");
  });

  it("tone='planned' tem bullet slate-400 (text-slate-400)", () => {
    const html = renderCard({
      title: "Em desenvolvimento",
      items: ["A"],
      tone: "planned",
    });
    expect(html).toContain("text-slate-400");
  });

  it("description opcional é renderizada", () => {
    const html = renderCard({
      title: "Disponíveis",
      items: ["A"],
      tone: "available",
      description: "Funcionalidades ativas no MVP.",
    });
    expect(html).toContain("Funcionalidades ativas no MVP.");
  });

  it("sem description: não renderiza <p> extra (apenas o que items geram)", () => {
    const html = renderCard({
      title: "Disponíveis",
      items: ["A"],
      tone: "available",
    });
    expect(html).not.toContain("Funcionalidades ativas");
  });
});
