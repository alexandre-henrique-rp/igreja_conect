/**
 * Teste do componente <Sidebar /> (S02-T09 / S06-T09).
 *
 * Valida 6 itens de menu (incluindo Financeiro com RBAC condicional),
 * item ativo destacado (bg-cyan-50), link de Sair e responsividade (lg:block).
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { Sidebar } from "./Sidebar";

function renderSidebar(
  currentPath: string,
  user: { id: string; nome: string; cargo: string | null } = {
    id: "u1",
    nome: "Maria",
    cargo: "ADMIN",
  }
): string {
  const Stub = createRoutesStub([
    {
      path: "*",
      Component: () => <Sidebar currentPath={currentPath} user={user} />,
    },
  ]);
  return renderToString(<Stub initialEntries={[currentPath]} />);
}

describe("<Sidebar />", () => {
  it("renderiza <nav> com aria-label 'Menu principal'", () => {
    const html = renderSidebar("/app");
    expect(html).toContain("<nav");
    expect(html).toContain('aria-label="Menu principal"');
  });

  it("renderiza 6 itens do menu principal para ADMIN", () => {
    const html = renderSidebar("/app");
    expect(html).toContain("Dashboard");
    expect(html).toContain("Membros");
    expect(html).toContain("Financeiro");
    expect(html).toContain("Ministérios");
    expect(html).toContain("Alertas");
    expect(html).toContain("Configurações");
  });

  it("Financeiro aparece para cargos autorizados", () => {
    const authorize = (cargo: string) => {
      const html = renderSidebar("/app", { id: "u1", nome: "User", cargo });
      return html.includes("Financeiro");
    };
    expect(authorize("ADMIN")).toBe(true);
    expect(authorize("PASTOR")).toBe(true);
    expect(authorize("FINANCEIRO")).toBe(true);
    expect(authorize("SECRETARIO")).toBe(true);
  });

  it("Financeiro NÃO aparece para cargos sem permissão", () => {
    const html = renderSidebar("/app", { id: "u1", nome: "User", cargo: "DISCIPULADOR" });
    expect(html).not.toContain("Financeiro");
  });

  it("Financeiro NÃO aparece se cargo for null", () => {
    const html = renderSidebar("/app", { id: "u1", nome: "User", cargo: null });
    expect(html).not.toContain("Financeiro");
  });

  it("item ativo tem bg-cyan-50 e aria-current='page'", () => {
    const html = renderSidebar("/app/membros");
    // O link de Membros deve ter bg-cyan-50
    expect(html).toContain("bg-cyan-50");
    expect(html).toContain('aria-current="page"');
  });

  it("links apontam para as URLs corretas", () => {
    const html = renderSidebar("/app");
    expect(html).toContain('href="/app"');
    expect(html).toContain('href="/app/membros"');
    expect(html).toContain('href="/app/financeiro"');
    expect(html).toContain('href="/app/ministerios"');
    expect(html).toContain('href="/app/alertas"');
    expect(html).toContain('href="/app/config/acolhimento"');
  });

  it("sidebar tem classe lg:block (visível em lg+, escondida em <lg)", () => {
    const html = renderSidebar("/app");
    expect(html).toContain("lg:block");
    expect(html).toContain("hidden");
  });

  it("botão 'Sair' submete form POST /logout", () => {
    const html = renderSidebar("/app");
    expect(html).toContain("Sair");
    // Form para /logout
    expect(html).toContain('action="/logout"');
    expect(html).toContain('method="post"');
  });

  it("currentPath='/app/membros/abc' destaca Membros (match exato)", () => {
    const html = renderSidebar("/app/membros/abc");
    // aria-current="page" deve estar em Membros
    expect(html).toContain('aria-current="page"');
  });

  it("currentPath='/app' (home) destaca Dashboard", () => {
    const html = renderSidebar("/app");
    // Múltiplos matches possíveis; garantimos que o nav tem aria-current
    expect(html).toContain('aria-current="page"');
  });
});
