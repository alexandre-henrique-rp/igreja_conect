/**
 * Teste do componente <TabsMembro /> (S03-T07).
 *
 * **GATE LGPD (RN-MEM-03) — defesa em 3 camadas:**
 * 1. **UI (camada 1):** `canSeeFinancials=false` → a tab Fidelidade
 *    NÃO é renderizada (nem como botão). Este teste cobre esta camada.
 * 2. **Loader (camada 2):** `tab=fidelidade` na URL sem permissão →
 *    força `tab=dados` antes de chegar aqui.
 * 3. **Service (camada 3):** `getDizimosByMembro` lança ForbiddenError.
 *
 * **Comportamento esperado:**
 * 1. Renderiza `<div role="tablist">` com abas: Dados, Discipulado, Ministérios.
 * 2. `canSeeFinancials=true`: renderiza também aba "Fidelidade".
 * 3. `canSeeFinancials=false`: NÃO renderiza aba Fidelidade.
 * 4. Aba ativa tem `aria-selected="true"`, demais `aria-selected="false"`.
 * 5. Cada aba é um link para `?tab=...` (RR7 navigation).
 * 6. Renderiza `<div role="tabpanel">` com o conteúdo da aba ativa.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { TabsMembro } from "./TabsMembro";

function renderTabs(
  props: Parameters<typeof TabsMembro>[0]
): string {
  const Stub = createRoutesStub([
    {
      path: "/app/membros/:id",
      Component: () => <TabsMembro {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/app/membros/m1?tab=dados"]} />);
}

const baseProps = {
  activeTab: "dados" as const,
  canSeeFinancials: true,
  membro: {
    id: "m1",
    nome: "Maria",
    tipo: "VISITANTE" as const,
    profissao: null,
    estadoCivil: null,
    dataConversao: null,
    dataBatismo: null,
  },
  discipulador: null,
  discipulos: [],
  ministerios: [],
  canEdit: true,
  canPromover: true,
  user: { cargo: "ADMIN" },
};

describe("<TabsMembro /> (RN-MEM-03 — Fidelidade)", () => {
  it("renderiza role='tablist'", () => {
    const html = renderTabs(baseProps);
    expect(html).toContain('role="tablist"');
  });

  it("canSeeFinancials=true: renderiza 4 abas (Dados, Discipulado, Ministérios, Fidelidade)", () => {
    const html = renderTabs(baseProps);
    expect(html).toContain("Dados");
    expect(html).toContain("Discipulado");
    expect(html).toContain("Ministérios");
    expect(html).toContain("Fidelidade");
  });

  it("canSeeFinancials=FALSE: NÃO renderiza aba Fidelidade (LGPD)", () => {
    const html = renderTabs({ ...baseProps, canSeeFinancials: false });
    expect(html).toContain("Dados");
    expect(html).toContain("Discipulado");
    expect(html).toContain("Ministérios");
    expect(html).not.toContain("Fidelidade");
  });

  it("cada aba é um link para ?tab=...", () => {
    const html = renderTabs(baseProps);
    // React Router resolve `to="?tab=..."` para URL absoluta
    // (e.g., "/app/membros/m1?tab=dados"). Testamos o final do href.
    expect(html).toMatch(/href="[^"]*\?tab=dados"/);
    expect(html).toMatch(/href="[^"]*\?tab=discipulado"/);
    expect(html).toMatch(/href="[^"]*\?tab=ministerios"/);
    expect(html).toMatch(/href="[^"]*\?tab=fidelidade"/);
  });

  it("aba ativa tem aria-selected='true', demais aria-selected='false'", () => {
    const html = renderTabs({ ...baseProps, activeTab: "discipulado" });
    // A aba discipulado tem aria-selected=true
    // (a ordem dos atributos pode variar — usamos lookaheads).
    const activePattern =
      /<a(?=[^>]*aria-selected="true")(?=[^>]*id="tab-discipulado")[^>]*>/i;
    expect(html).toMatch(activePattern);
    // As outras têm aria-selected=false
    expect(html).toContain('aria-selected="false"');
  });

  it("renderiza role='tabpanel' com conteúdo da aba ativa", () => {
    const html = renderTabs({ ...baseProps, activeTab: "dados" });
    expect(html).toContain('role="tabpanel"');
    // Tab Dados Pessoais tem 'tab-dados-pessoais' no data-testid
    expect(html).toContain("tab-dados-pessoais");
  });

  it("activeTab='discipulado': renderiza TabDiscipulado", () => {
    const html = renderTabs({ ...baseProps, activeTab: "discipulado" });
    expect(html).toContain("tab-discipulado");
  });

  it("activeTab='ministerios': renderiza TabMinisterios", () => {
    const html = renderTabs({ ...baseProps, activeTab: "ministerios" });
    expect(html).toContain("tab-ministerios");
  });

  it("activeTab='fidelidade' + canSeeFinancials=true: renderiza TabFidelidadeFinanceira", () => {
    const html = renderTabs({ ...baseProps, activeTab: "fidelidade" });
    expect(html).toContain("tab-fidelidade");
  });

  it("activeTab='fidelidade' + canSeeFinancials=FALSE: cai em default (dados)", () => {
    // Defesa em profundidade: mesmo se loader passar tab inválido,
    // a UI só renderiza Dados. (Camada 2 do loader já força tab=dados
    // antes de chegar aqui — UI é a 1ª camada que reforça.)
    const html = renderTabs({
      ...baseProps,
      activeTab: "fidelidade",
      canSeeFinancials: false,
    });
    // Tab Fidelidade NÃO renderiza
    expect(html).not.toContain("tab-fidelidade");
  });
});
