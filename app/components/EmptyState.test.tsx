/**
 * Teste do componente <EmptyState /> (S04-T10).
 *
 * Título + descrição + action opcional (Link).
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { EmptyState, type EmptyStateProps } from "./EmptyState";

function renderEmpty(props: EmptyStateProps): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <EmptyState {...props} />,
    },
    {
      path: "/app/membros/novo",
      Component: () => null,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<EmptyState />", () => {
  it("renderiza título e descrição", () => {
    const html = renderEmpty({
      title: "Nenhum resultado",
      description: "Nenhum membro encontrado.",
    });
    expect(html).toContain("Nenhum resultado");
    expect(html).toContain("Nenhum membro encontrado.");
  });

  it("quando action fornecida, renderiza Link", () => {
    const html = renderEmpty({
      title: "Nenhum resultado",
      description: "Nenhum membro encontrado.",
      action: { label: "Criar", to: "/app/membros/novo" },
    });
    expect(html).toContain("Criar");
    expect(html).toContain('href="/app/membros/novo"');
  });

  it("quando action omitida, não renderiza link", () => {
    const html = renderEmpty({
      title: "Nenhum resultado",
      description: "Nada aqui.",
    });
    expect(html).not.toContain('href="');
  });

  it("data-testid='empty-state'", () => {
    const html = renderEmpty({
      title: "Vazio",
      description: "Nada ainda.",
    });
    expect(html).toContain('data-testid="empty-state"');
  });
});
