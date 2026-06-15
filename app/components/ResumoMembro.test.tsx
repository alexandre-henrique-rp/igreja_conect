/**
 * Teste do componente <ResumoMembro /> (S03-T07).
 *
 * Card de resumo do membro — nome (h1), tipo, contato, endereço, KPIs.
 * Renderizado no topo da página de detalhe (acima das abas).
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { ResumoMembro } from "./ResumoMembro";

function renderResumo(
  props: Parameters<typeof ResumoMembro>[0]
): string {
  const Stub = createRoutesStub([
    {
      path: "/app/membros/:id",
      Component: () => <ResumoMembro {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/app/membros/m1"]} />);
}

const baseMembro = {
  id: "m1",
  nome: "Maria da Silva",
  tipo: "MEMBRO_ATIVO" as const,
  email: "maria@igreja.local",
  telefone: "(11) 98765-4321",
  cargo: "MEMBRO",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-02-01T00:00:00.000Z",
};

describe("<ResumoMembro />", () => {
  it("renderiza nome do membro como h1", () => {
    const html = renderResumo({ membro: baseMembro });
    expect(html).toContain("<h1");
    expect(html).toContain("Maria da Silva");
  });

  it("renderiza badge de tipo", () => {
    const html = renderResumo({ membro: baseMembro });
    expect(html).toContain("Membro ativo");
  });

  it("renderiza email e telefone quando fornecidos", () => {
    const html = renderResumo({ membro: baseMembro });
    expect(html).toContain("maria@igreja.local");
    expect(html).toContain("(11) 98765-4321");
  });

  it("email null: mostra '—' (placeholder)", () => {
    const html = renderResumo({
      membro: { ...baseMembro, email: null, telefone: null },
    });
    expect(html).toContain("—");
  });

  it("renderiza endereço completo", () => {
    const html = renderResumo({
      membro: {
        ...baseMembro,
        logradouro: "Rua das Flores",
        numero: "123",
        bairro: "Centro",
        cidade: "São Paulo",
        estado: "SP",
        cep: "01000-000",
      },
    });
    expect(html).toContain("Rua das Flores");
    expect(html).toContain("Centro");
    expect(html).toContain("São Paulo");
    expect(html).toContain("SP");
    expect(html).toContain("01000-000");
  });

  it("endereço ausente: mostra 'Endereço não informado'", () => {
    const html = renderResumo({ membro: baseMembro });
    expect(html).toContain("Endereço não informado");
  });
});
