/**
 * Teste do componente <ContadorDiscipulos /> (S03-T05).
 *
 * **Comportamento esperado:**
 * 1. Renderiza "atual/max discípulos" (default 12).
 * 2. Cor slate-700 quando < 10.
 * 3. Cor amber-700 quando >= 10 e < 12.
 * 4. Cor amber-800 + font-bold quando === 12.
 * 5. Badge "Limite atingido" quando === 12.
 * 6. Badge "Atenção" quando 10 ou 11.
 * 7. `aria-live="polite"` no contador (anúncio para screen reader).
 *
 * @see design/private-membros-discipulado.DESIGN.md §4
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { ContadorDiscipulos } from "./ContadorDiscipulos";

function renderContador(
  props: Parameters<typeof ContadorDiscipulos>[0]
): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <ContadorDiscipulos {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<ContadorDiscipulos />", () => {
  it("renderiza 'atual/max discípulos' (atual=0, max default 12)", () => {
    const html = renderContador({ atual: 0 });
    expect(html).toContain("0");
    expect(html).toContain("12");
    expect(html).toContain("discípulos");
  });

  it("aceita max customizado", () => {
    const html = renderContador({ atual: 5, max: 20 });
    expect(html).toContain("5");
    expect(html).toContain("20");
  });

  it("atual < 10: usa cor slate-700 (normal)", () => {
    const html = renderContador({ atual: 5 });
    expect(html).toContain("text-slate-700");
  });

  it("atual === 10: usa cor amber-700 (atenção)", () => {
    const html = renderContador({ atual: 10 });
    expect(html).toContain("text-amber-700");
  });

  it("atual === 11: usa cor amber-700 (atenção)", () => {
    const html = renderContador({ atual: 11 });
    expect(html).toContain("text-amber-700");
  });

  it("atual === 12: usa cor amber-800 E font-bold (limite)", () => {
    const html = renderContador({ atual: 12 });
    expect(html).toContain("text-amber-800");
    expect(html).toContain("font-bold");
  });

  it("atual === 12: renderiza badge 'Limite atingido'", () => {
    const html = renderContador({ atual: 12 });
    expect(html).toContain("Limite atingido");
  });

  it("atual === 10 ou 11: renderiza badge 'Atenção'", () => {
    expect(renderContador({ atual: 10 })).toContain("Atenção");
    expect(renderContador({ atual: 11 })).toContain("Atenção");
  });

  it("atual < 10: NÃO renderiza badge de atenção", () => {
    const html = renderContador({ atual: 5 });
    expect(html).not.toContain("Atenção");
    expect(html).not.toContain("Limite atingido");
  });

  it("tem aria-live='polite' para anunciar mudanças (a11y)", () => {
    const html = renderContador({ atual: 5 });
    expect(html).toContain('aria-live="polite"');
  });

  it("label ARIA descritivo: 'X de 12 discípulos'", () => {
    const html = renderContador({ atual: 8 });
    expect(html).toContain("8 de 12");
  });
});
