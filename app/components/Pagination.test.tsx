/**
 * Teste do componente <Pagination /> (S02-T03).
 *
 * Valida semântica (`<nav aria-label>`, `<ol>`), preservação de searchParams
 * (exceto `page`) e render dos links Anterior/Próxima e números.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { Pagination } from "./Pagination";

function renderPagination(
  props: Omit<Parameters<typeof Pagination>[0], "searchParams"> & {
    searchParams?: URLSearchParams;
  }
): string {
  const { searchParams, ...rest } = props;
  const Stub = createRoutesStub([
    {
      path: "/app/membros",
      Component: () => (
        <Pagination
          current={rest.current}
          total={rest.total}
          basePath={rest.basePath}
          searchParams={searchParams}
        />
      ),
    },
  ]);
  return renderToString(<Stub initialEntries={["/app/membros"]} />);
}

describe("<Pagination />", () => {
  it("renderiza <nav> com aria-label 'Paginação'", () => {
    const html = renderPagination({ current: 1, total: 5, basePath: "/app/membros" });
    expect(html).toContain("<nav");
    expect(html).toContain('aria-label="Paginação"');
  });

  it("renderiza <ol> semântico", () => {
    const html = renderPagination({ current: 1, total: 5, basePath: "/app/membros" });
    expect(html).toContain("<ol");
  });

  it("mostra texto 'Página N de M'", () => {
    const html = renderPagination({ current: 2, total: 5, basePath: "/app/membros" });
    // React 19 SSR insere comentários <!-- --> entre texto e número para evitar
    // warning de hydration. Validamos as partes separadas.
    expect(html).toContain("Página");
    expect(html).toContain(" de ");
    expect(html).toContain("2");
    expect(html).toContain("5");
  });

  it("renderiza links para todas as páginas (current/total)", () => {
    const html = renderPagination({ current: 1, total: 3, basePath: "/app/membros" });
    // 3 links de página + Anterior/Próxima (em página 1, não tem Anterior)
    expect(html).toContain("?page=1");
    expect(html).toContain("?page=2");
    expect(html).toContain("?page=3");
  });

  it("preserva searchParams existentes (exceto 'page')", () => {
    const params = new URLSearchParams("tipo=VISITANTE&q=maria");
    const html = renderPagination({
      current: 1,
      total: 3,
      basePath: "/app/membros",
      searchParams: params,
    });
    expect(html).toContain("tipo=VISITANTE");
    expect(html).toContain("q=maria");
    expect(html).toContain("page=2");
  });

  it("current = 1, total > 1: NÃO renderiza link 'Anterior'", () => {
    const html = renderPagination({ current: 1, total: 3, basePath: "/app/membros" });
    expect(html).not.toContain("Anterior");
  });

  it("current < total: renderiza link 'Próxima'", () => {
    const html = renderPagination({ current: 2, total: 3, basePath: "/app/membros" });
    expect(html).toContain("Próxima");
    expect(html).toContain("page=3");
  });

  it("current = total, total > 1: NÃO renderiza link 'Próxima'", () => {
    const html = renderPagination({ current: 3, total: 3, basePath: "/app/membros" });
    expect(html).not.toContain("Próxima");
    expect(html).toContain("Anterior");
  });

  it("total <= 1: renderiza null (sem paginação)", () => {
    const html = renderPagination({ current: 1, total: 1, basePath: "/app/membros" });
    expect(html).toBe("");
  });

  it("total = 0: renderiza null", () => {
    const html = renderPagination({ current: 1, total: 0, basePath: "/app/membros" });
    expect(html).toBe("");
  });

  it("página atual tem destaque visual (font-bold text-cyan-700)", () => {
    const html = renderPagination({ current: 2, total: 3, basePath: "/app/membros" });
    // O link da página 2 deve ter font-bold text-cyan-700
    expect(html).toMatch(/font-bold[^"]*text-cyan-700/);
  });
});
