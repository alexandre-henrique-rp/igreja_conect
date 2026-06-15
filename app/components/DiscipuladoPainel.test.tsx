/**
 * Teste do componente <DiscipuladoPainel /> (S03-T05).
 *
 * Orquestrador do painel de discipulado. Combina:
 * - `<ContadorDiscipulos>` (se há discipulador).
 * - `<CadeiaDiscipulado>` (se há cadeia).
 * - `<ListaDiscipulos>` (se há discípulos).
 * - `<ModalSelecionarDiscipulador>` controlado por useState.
 *
 * **Estados:**
 * 1. Sem discipulador: card "vazio" + botão "Vincular".
 * 2. Com discipulador: card com nome + Contador + botões "Reatribuir" / "Desvincular".
 * 3. Com cadeia: renderiza `<ol>` com setas.
 * 4. Com discípulos: renderiza lista.
 *
 * **Teste:** renderiza via `createRoutesStub` (componente cliente com
 * useState). Como `renderToString` é SSR, validamos a estrutura inicial
 * — modal começa fechado (Dialog retorna null).
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { DiscipuladoPainel } from "./DiscipuladoPainel";

type MembroMini = { id: string; nome: string };

function renderPainel(
  props: Parameters<typeof DiscipuladoPainel>[0]
): string {
  const Stub = createRoutesStub([
    {
      path: "/app/membros/:id",
      Component: () => <DiscipuladoPainel {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/app/membros/m1"]} />);
}

describe("<DiscipuladoPainel />", () => {
  it("sem discipulador: mostra estado vazio com botão 'Vincular'", () => {
    const html = renderPainel({
      membro: { id: "m1", nome: "Maria" } as MembroMini,
      discipuladorAtual: null,
      discipulosDoDiscipulador: [],
      cadeia: [],
      discipuladoresDisponiveis: [],
      canEdit: true,
    });
    expect(html).toContain("não possui discipulador");
    expect(html).toContain("Vincular");
  });

  it("com discipulador: renderiza nome + Contador (X/12)", () => {
    const html = renderPainel({
      membro: { id: "m1", nome: "Maria" } as MembroMini,
      discipuladorAtual: { id: "d1", nome: "João Silva" } as MembroMini,
      discipulosDoDiscipulador: [
        { id: "x1", nome: "Ana" },
        { id: "x2", nome: "Carlos" },
      ],
      cadeia: [{ id: "d1", nome: "João Silva" }],
      discipuladoresDisponiveis: [],
      canEdit: true,
    });
    expect(html).toContain("João Silva");
    // Contador: testa a presença de "2" e "12 discípulos" (que estão
    // em spans separados por questão de estilo, mas o conteúdo está lá).
    expect(html).toContain("data-testid=\"contador-discipulos\"");
    expect(html).toContain("2");
    expect(html).toContain("/12 discípulos");
  });

  it("com discipulador: renderiza botões 'Reatribuir' e 'Desvincular' (se canEdit)", () => {
    const html = renderPainel({
      membro: { id: "m1", nome: "Maria" } as MembroMini,
      discipuladorAtual: { id: "d1", nome: "João Silva" } as MembroMini,
      discipulosDoDiscipulador: [],
      cadeia: [],
      discipuladoresDisponiveis: [],
      canEdit: true,
    });
    expect(html).toContain("Reatribuir");
    expect(html).toContain("Desvincular");
  });

  it("canEdit=false: NÃO renderiza botões 'Reatribuir' e 'Desvincular'", () => {
    const html = renderPainel({
      membro: { id: "m1", nome: "Maria" } as MembroMini,
      discipuladorAtual: { id: "d1", nome: "João Silva" } as MembroMini,
      discipulosDoDiscipulador: [],
      cadeia: [],
      discipuladoresDisponiveis: [],
      canEdit: false,
    });
    // Botões de ação não aparecem
    expect(html).not.toContain("Reatribuir");
    // O form de desvincular (com intent=unassign) também não aparece
    expect(html).not.toContain('value="unassign"');
  });

  it("com discípulos: renderiza ListaDiscipulos (ul)", () => {
    const html = renderPainel({
      membro: { id: "m1", nome: "Maria" } as MembroMini,
      discipuladorAtual: { id: "d1", nome: "João Silva" } as MembroMini,
      discipulosDoDiscipulador: [
        { id: "x1", nome: "Ana" },
        { id: "x2", nome: "Carlos" },
      ],
      cadeia: [{ id: "d1", nome: "João Silva" }],
      discipuladoresDisponiveis: [],
      canEdit: true,
    });
    expect(html).toContain("<ul");
    expect(html).toContain("Ana");
    expect(html).toContain("Carlos");
  });

  it("com cadeia de 2 níveis: renderiza seta '→'", () => {
    const html = renderPainel({
      membro: { id: "m1", nome: "Maria" } as MembroMini,
      discipuladorAtual: { id: "d1", nome: "João Silva" } as MembroMini,
      discipulosDoDiscipulador: [],
      cadeia: [
        { id: "p1", nome: "Pr. Carlos" },
        { id: "d1", nome: "Disc. João" },
      ],
      discipuladoresDisponiveis: [],
      canEdit: true,
    });
    expect(html).toContain("Pr. Carlos");
    expect(html).toContain("→");
  });

  it("modal começa FECHADO (Dialog não renderiza nada no SSR)", () => {
    const html = renderPainel({
      membro: { id: "m1", nome: "Maria" } as MembroMini,
      discipuladorAtual: null,
      discipulosDoDiscipulador: [],
      cadeia: [],
      discipuladoresDisponiveis: [],
      canEdit: true,
    });
    // Modal não está aberto → Dialog retorna null → sem role="dialog"
    expect(html).not.toContain('role="dialog"');
  });

  it("renderiza nome do membro no card", () => {
    const html = renderPainel({
      membro: { id: "m1", nome: "Maria da Silva" } as MembroMini,
      discipuladorAtual: null,
      discipulosDoDiscipulador: [],
      cadeia: [],
      discipuladoresDisponiveis: [],
      canEdit: true,
    });
    expect(html).toContain("Maria da Silva");
  });
});
