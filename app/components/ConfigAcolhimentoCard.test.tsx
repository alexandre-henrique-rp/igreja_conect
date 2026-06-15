/**
 * Teste do componente <ConfigAcolhimentoCard /> (S04-T05).
 *
 * Card que mostra o responsável atual pelo acolhimento (nome + tipo).
 * Se não houver config, exibe InfoBox warning "Nenhum responsável configurado".
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { ConfigAcolhimentoCard, type ConfigAcolhimentoCardProps } from "./ConfigAcolhimentoCard";

function renderCard(props: ConfigAcolhimentoCardProps): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <ConfigAcolhimentoCard {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<ConfigAcolhimentoCard />", () => {
  it("renderiza responsável com tipo MEMBRO quando config presente", () => {
    const html = renderCard({
      config: { tipo: "MEMBRO", nome: "João Paulo" },
    });
    expect(html).toContain("Responsável pelo acolhimento");
    expect(html).toContain("João Paulo");
    expect(html).toContain("MEMBRO");
  });

  it("renderiza responsável com tipo MINISTERIO quando config presente", () => {
    const html = renderCard({
      config: { tipo: "MINISTERIO", nome: "Ministério de Louvor" },
    });
    expect(html).toContain("Ministério de Louvor");
    expect(html).toContain("MINISTERIO");
  });

  it("renderiza tipo como badge estilizado", () => {
    const html = renderCard({
      config: { tipo: "MEMBRO", nome: "Maria" },
    });
    // Esperamos um badge/tag visual para o tipo
    expect(html).toContain("MEMBRO");
    // Deve ter alguma classe de estilo no elemento do tipo
    expect(html).toContain("bg-");
  });

  it("quando config é undefined, mostra InfoBox warning", () => {
    const html = renderCard({ config: undefined });
    expect(html).toContain("Nenhum responsável configurado");
    expect(html).toContain('role="note"');
  });

  it("quando config é null, mostra InfoBox warning", () => {
    const html = renderCard({ config: null as unknown as undefined });
    expect(html).toContain("Nenhum responsável configurado");
  });

  it("card usa data-testid='config-acolhimento-card'", () => {
    const html = renderCard({
      config: { tipo: "MEMBRO", nome: "João" },
    });
    expect(html).toContain('data-testid="config-acolhimento-card"');
  });
});
