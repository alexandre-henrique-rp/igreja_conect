/**
 * Teste do componente <FiltrosMembros /> (S02-T03).
 *
 * Valida form method=get com 4 inputs (q, tipo, ministerioId, discipuladorId)
 * + botões "Filtrar" e "Limpar", preservando defaultValues.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { FiltrosMembros } from "./FiltrosMembros";

function renderFiltros(
  props: Omit<Parameters<typeof FiltrosMembros>[0], "ministerios" | "discipuladores"> & {
    ministerios?: { id: string; nome: string }[];
    discipuladores?: { id: string; nome: string }[];
  }
): string {
  const Stub = createRoutesStub([
    {
      path: "/app/membros",
      Component: () => (
        <FiltrosMembros
          defaultValues={props.defaultValues}
          ministerios={props.ministerios ?? []}
          discipuladores={props.discipuladores ?? []}
        />
      ),
    },
  ]);
  return renderToString(<Stub initialEntries={["/app/membros"]} />);
}

describe("<FiltrosMembros />", () => {
  it("renderiza <form> com method='get' e action='/app/membros'", () => {
    const html = renderFiltros({ defaultValues: {} });
    expect(html).toContain("<form");
    expect(html).toContain('action="/app/membros"');
    expect(html).toContain('method="get"');
  });

  it("renderiza 4 inputs: q, tipo, ministerioId, discipuladorId", () => {
    const html = renderFiltros({ defaultValues: {} });
    expect(html).toContain('name="q"');
    expect(html).toContain('name="tipo"');
    expect(html).toContain('name="ministerioId"');
    expect(html).toContain('name="discipuladorId"');
  });

  it("input 'q' tem placeholder 'Buscar por nome...'", () => {
    const html = renderFiltros({ defaultValues: {} });
    expect(html).toContain('placeholder="Buscar por nome..."');
  });

  it("select 'tipo' tem 3 options (VISITANTE, CONGREGADO, MEMBRO_ATIVO)", () => {
    const html = renderFiltros({ defaultValues: {} });
    expect(html).toContain('value="VISITANTE"');
    expect(html).toContain('value="CONGREGADO"');
    expect(html).toContain('value="MEMBRO_ATIVO"');
  });

  it("select 'tipo' tem placeholder 'Todos os tipos'", () => {
    const html = renderFiltros({ defaultValues: {} });
    expect(html).toContain("Todos os tipos");
  });

  it("defaultValues.q é refletido no input q", () => {
    const html = renderFiltros({ defaultValues: { q: "maria" } });
    expect(html).toContain('value="maria"');
  });

  it("defaultValues.tipo='VISITANTE' é refletido no select", () => {
    const html = renderFiltros({ defaultValues: { tipo: "VISITANTE" } });
    // React 19 SSR: defaultValue em <select> vira selected="" na <option> correspondente
    expect(html).toContain('value="VISITANTE" selected=""');
  });

  it("ministerios populam o select ministerioId", () => {
    const html = renderFiltros({
      defaultValues: {},
      ministerios: [
        { id: "min-1", nome: "Louvor" },
        { id: "min-2", nome: "Mídia" },
      ],
    });
    expect(html).toContain('value="min-1"');
    expect(html).toContain("Louvor");
    expect(html).toContain('value="min-2"');
    expect(html).toContain("Mídia");
  });

  it("discipuladores populam o select discipuladorId", () => {
    const html = renderFiltros({
      defaultValues: {},
      discipuladores: [{ id: "d1", nome: "Carlos Souza" }],
    });
    expect(html).toContain('value="d1"');
    expect(html).toContain("Carlos Souza");
  });

  it("botão submit 'Filtrar' presente", () => {
    const html = renderFiltros({ defaultValues: {} });
    expect(html).toContain("Filtrar");
    expect(html).toContain('type="submit"');
  });

  it("botão 'Limpar' tem href /app/membros (limpa todos os filtros)", () => {
    const html = renderFiltros({ defaultValues: {} });
    expect(html).toContain("Limpar");
    expect(html).toContain('href="/app/membros"');
  });
});
