/**
 * Teste da rota /app — dashboard placeholder (S02-T10).
 *
 * Valida a render do componente com `loaderData` mockado: saudação,
 * card "Dashboard em construção" e a lista do que virá em S04.
 *
 * O authGate (anônimo → 401) é testado em `_middleware.test.ts`.
 *
 * @see app/routes/app/_middleware.test.ts para o teste do middleware
 * @see app/routes/app/_index.tsx
 */
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import type { SessionUser } from "~/lib/session.types";

/** Re-import dinâmico. */
async function loadIndexRoute() {
  return await import("./_index");
}

describe("app/_index — Dashboard placeholder (S02-T10)", () => {
  function renderWithRouter(Component: any, loaderData: any) {
    const Stub = createRoutesStub([
      {
        path: "/",
        Component: () => <Component loaderData={loaderData} />,
      },
    ]);
    return renderToString(<Stub initialEntries={["/"]} />);
  }

  it("autenticado: renderiza <main id='main-content'> com saudação 'Olá, {nome}.'", async () => {
    const mod = await loadIndexRoute();
    const Component = mod.default as React.ComponentType<{
      loaderData: { user: SessionUser };
    }>;
    const html = renderWithRouter(Component, {
      user: { id: "u1", nome: "Maria de Teste", cargo: "ADMIN" },
    });
    expect(html).toContain("<main");
    expect(html).toContain('id="main-content"');
    // React 19 SSR injeta comentários <!-- --> entre texto e variável
    // para evitar warning de hydration. Validamos as partes separadas.
    expect(html).toContain("Olá,");
    expect(html).toContain("Maria de Teste");
    expect(html).toContain("ADMIN");
  });

  it("autenticado: mostra seções do dashboard principal", async () => {
    const mod = await loadIndexRoute();
    const Component = mod.default as React.ComponentType<{
      loaderData: { user: SessionUser; stats?: any };
    }>;
    const html = renderWithRouter(Component, {
      user: { id: "u1", nome: "João", cargo: "PASTOR" },
      stats: {
        membrosAtivos: 10,
        visitantesMes: 2,
        alertasNaoLidos: 0,
        saldoTotalCentavos: 12000,
        alertasEstoque: 1,
        ultimasContribuicoes: [],
        ultimosVisitantes: [],
      },
    });
    expect(html).toContain("Dashboard");
    expect(html).toContain("Saldo Financeiro");
    expect(html).toContain("Membros Ativos");
    expect(html).toContain("Últimas Contribuições");
    expect(html).toContain("Agenda &amp; Escalas");
  });

  it("usuário sem cargo (null) renderiza 'membro' em vez do cargo", async () => {
    const mod = await loadIndexRoute();
    const Component = mod.default as React.ComponentType<{
      loaderData: { user: SessionUser };
    }>;
    const html = renderWithRouter(Component, {
      user: { id: "u1", nome: "Visitante", cargo: null },
    });
    expect(html).toContain("Visitante");
    expect(html).toContain("membro");
  });

  it("componente é export default e tem assinatura de rota RR7", async () => {
    const mod = await loadIndexRoute();
    expect(typeof mod.default).toBe("function");
    expect(typeof mod.loader).toBe("function");
    expect(typeof mod.meta).toBe("function");
  });

  it("meta retorna title 'Igreja Conect'", async () => {
    const mod = await loadIndexRoute();
    const meta = (mod.meta as unknown as (a?: unknown) => Array<{ title: string }>)(undefined);
    expect(Array.isArray(meta)).toBe(true);
    expect(meta[0]?.title).toBe("Igreja Conect");
  });
});
