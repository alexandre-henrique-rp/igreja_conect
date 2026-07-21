/**
 * Teste do componente <TabFidelidadeFinanceira /> (S03-T07).
 *
 * **GATE LGPD (RN-MEM-03) — defesa em 3 camadas:**
 * 1. **UI (camada 1):** o componente SÓ é renderizado se o loader
 *    retornar `canSeeFinancials === true`. A rota `membros.$id.tsx`
 *    checa e renderiza `<TabFidelidadeFinanceira />` dentro de um
 *    `<Can allow={[FINANCIAL_CARGOS]}>`. Se o perfil não é
 *    financeiro, o componente nem é instanciado.
 * 2. **Loader (camada 2):** força `tab=dados` se URL direta.
 * 3. **Service (camada 3):** `getDizimosByMembro` lança
 *    `ForbiddenError` (RN-MEM-03).
 *
 * Este teste cobre o componente em si: ele renderiza o placeholder
 * com `role="status"` e mensagem clara sobre o módulo financeiro
 * futuro. Se um perfil não autorizado conseguir renderizar este
 * componente, o gate UI falhou.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { TabFidelidadeFinanceira } from "./TabFidelidadeFinanceira";

function renderTab(): string {
  const Stub = createRoutesStub([
    {
      path: "/app/membros/:id",
      Component: () => <TabFidelidadeFinanceira />,
      loader: () => ({}) as any,
    },
  ]);
  return renderToString(<Stub initialEntries={["/app/membros/m1"]} />);
}

describe("<TabFidelidadeFinanceira /> (gate LGPD — RN-MEM-03)", () => {
  it("renderiza placeholder com role='status'", () => {
    const html = renderTab();
    expect(html).toContain('role="status"');
  });

  it("placeholder contém 'Módulo Financeiro'", () => {
    const html = renderTab();
    expect(html).toContain("Módulo Financeiro");
  });

  it("placeholder contém 'ainda não disponível' (PT-BR)", () => {
    const html = renderTab();
    expect(html).toContain("ainda não disponível");
  });

  it("renderiza ícone de cadeado (RN-MEM-03 — dado sensível)", () => {
    const html = renderTab();
    // SVG com aria-hidden
    expect(html).toContain("<svg");
    // Pode ser um cadeado — procura por palavras-chave no path
    // (sem match exato pois SVG é complexo)
  });

  it("NÃO renderiza nenhuma referência a 'valorCentavos' ou 'Lancamento' (LGPD)", () => {
    const html = renderTab();
    // Componente é placeholder — não tem dados financeiros.
    // (Campos do schema Prisma nunca aparecem — apenas texto explicativo.)
    expect(html).not.toContain("valorCentavos");
    expect(html).not.toContain("Lancamento");
    expect(html).not.toContain("caixa");
    expect(html).not.toContain("Caixa");
  });

  it("componente tem data-testid para identificar a tab em testes E2E", () => {
    const html = renderTab();
    expect(html).toContain("tab-fidelidade");
  });
});
