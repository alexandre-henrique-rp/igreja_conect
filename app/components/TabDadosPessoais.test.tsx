/**
 * Teste do componente <TabDadosPessoais /> (S03-T07).
 *
 * Tab que renderiza os dados pessoais do membro (campos eclesiásticos
 * + tipo atual + botão "Promover → ..." quando aplicável).
 *
 * **Comportamento esperado:**
 * 1. Renderiza todos os campos pessoais: data conversão, batismo, profissão, estado civil.
 * 2. Renderiza tipo atual com badge.
 * 3. `canPromover=true` + tipo=VISITANTE: mostra botão "Promover → CONGREGADO".
 * 4. `canPromover=true` + tipo=CONGREGADO: mostra botão "Promover → MEMBRO_ATIVO".
 * 5. `canPromover=false`: NÃO mostra botões de promoção.
 * 6. tipo=MEMBRO_ATIVO + canPromover=true: NÃO mostra botão (último nível).
 * 7. Form do botão tem `action="/app/membros/:id/tipo"` + `tipo={próximo}`
 *    (roteia para a action dedicada S03-T08, NÃO para a action do
 *    detail — DEB-MVP-1, S06+).
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { TabDadosPessoais } from "./TabDadosPessoais";

type Membro = {
  id: string;
  nome: string;
  tipo: "VISITANTE" | "CONGREGADO" | "MEMBRO_ATIVO";
  email: string | null;
  telefone: string | null;
  profissao: string | null;
  estadoCivil: string | null;
  dataConversao: string | null;
  dataBatismo: string | null;
};

function renderTab(
  props: Parameters<typeof TabDadosPessoais>[0]
): string {
  const Stub = createRoutesStub([
    {
      path: "/app/membros/:id",
      Component: () => <TabDadosPessoais {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/app/membros/m1"]} />);
}

const visitante: Membro = {
  id: "m1",
  nome: "Maria",
  tipo: "VISITANTE",
  email: null,
  telefone: null,
  profissao: "Professora",
  estadoCivil: "Casada",
  dataConversao: "2024-01-15",
  dataBatismo: null,
};

describe("<TabDadosPessoais />", () => {
  it("renderiza profissão e estado civil", () => {
    const html = renderTab({ membro: visitante, canPromover: false });
    expect(html).toContain("Professora");
    expect(html).toContain("Casada");
  });

  it("renderiza data de conversão formatada (PT-BR)", () => {
    const html = renderTab({ membro: visitante, canPromover: false });
    // NOTA: A data pode vir como 14/01/2024 ou 15/01/2024 dependendo
    // do fuso horário do ambiente de teste. O importante é que
    // esteja no formato dd/mm/aaaa.
    expect(html).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    // E o mês é 01 (janeiro) e ano 2024
    expect(html).toMatch(/\d{2}\/01\/2024/);
  });

  it("renderiza tipo atual com badge", () => {
    const html = renderTab({ membro: visitante, canPromover: false });
    expect(html).toContain("Visitante");
  });

  it("VISITANTE + canPromover=true: mostra botão 'Promover → CONGREGADO'", () => {
    const html = renderTab({ membro: visitante, canPromover: true });
    expect(html).toContain("Promover");
    expect(html).toContain("CONGREGADO");
  });

  it("VISITANTE + canPromover=true: form action=/app/membros/:id/tipo + tipo=CONGREGADO (rota dedicada S03-T08, sem intent=promover)", () => {
    const html = renderTab({ membro: visitante, canPromover: true });
    // Action dedicada (DEB-MVP-1): form aponta para a rota /tipo
    expect(html).toContain('action="/app/membros/m1/tipo"');
    // Campo tipo presente (valor = próximo tipo da hierarquia)
    expect(html).toContain('name="tipo"');
    expect(html).toContain('value="CONGREGADO"');
    // A rota dedicada lê só `tipo` (não lê `intent`) — input removido
    expect(html).not.toContain('name="intent"');
    expect(html).not.toContain('value="promover"');
  });

  it("CONGREGADO + canPromover=true: mostra botão 'Promover → MEMBRO_ATIVO'", () => {
    const html = renderTab({
      membro: { ...visitante, tipo: "CONGREGADO" },
      canPromover: true,
    });
    expect(html).toContain("MEMBRO_ATIVO");
  });

  it("MEMBRO_ATIVO + canPromover=true: NÃO mostra botão (último nível)", () => {
    const html = renderTab({
      membro: { ...visitante, tipo: "MEMBRO_ATIVO" },
      canPromover: true,
    });
    expect(html).not.toContain("Promover");
  });

  it("canPromover=false: NÃO mostra botões de promoção nem action dedicada", () => {
    const html = renderTab({ membro: visitante, canPromover: false });
    expect(html).not.toContain("Promover");
    // Sem botão = sem form = sem action=/app/membros/:id/tipo
    expect(html).not.toContain('action="/app/membros/m1/tipo"');
  });

  it("dataBatismo null: mostra '—' (placeholder)", () => {
    const html = renderTab({ membro: visitante, canPromover: false });
    // Mostra "—"
    expect(html).toContain("—");
  });
});
