/**
 * Teste do componente <Skeleton /> (S04-T10).
 *
 * Esqueleto de carregamento com animação pulse.
 * rows=3 default. Cada row é um bloco animate-pulse.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { Skeleton, type SkeletonProps } from "./Skeleton";

function renderSkeleton(props: SkeletonProps = {}): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <Skeleton {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<Skeleton />", () => {
  it("renderiza 3 rows por padrão", () => {
    const html = renderSkeleton();
    // Contar quantas divs com animate-pulse
    const matches = html.match(/animate-pulse/g);
    expect(matches).toHaveLength(3);
  });

  it("renderiza número customizado de rows", () => {
    const html = renderSkeleton({ rows: 5 });
    const matches = html.match(/animate-pulse/g);
    expect(matches).toHaveLength(5);
  });

  it("cada row tem h-4 e bg-slate-200 (classe de placeholder)", () => {
    const html = renderSkeleton({ rows: 2 });
    expect(html).toContain("h-4");
    expect(html).toContain("bg-slate-200");
  });

  it("data-testid='skeleton'", () => {
    const html = renderSkeleton();
    expect(html).toContain('data-testid="skeleton"');
  });

  it("renderiza larguras fixas e determinísticas por row", () => {
    const first = renderSkeleton({ rows: 3 });
    const second = renderSkeleton({ rows: 3 });
    expect(first).toBe(second);
    expect(first).toContain("width:80%");
  });
});
