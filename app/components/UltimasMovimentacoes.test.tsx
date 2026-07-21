/**
 * Teste do componente <UltimasMovimentacoes /> (S06-T09).
 *
 * Valida listagem, formatação de data, cores ENTRADA/SAIDA, label de categoria,
 * visibilidade condicional de membro, e empty state.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { UltimasMovimentacoes, type UltimasMovimentacoesProps } from "./UltimasMovimentacoes";

function renderList(props: UltimasMovimentacoesProps): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <UltimasMovimentacoes {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

const itemBase = {
  id: "l1",
  tipo: "ENTRADA" as const,
  categoria: "DIZIMO",
  valorCentavos: 10000,
  dataCompetencia: new Date("2026-06-01"),
  descricao: "Dízimo mensal",
  caixa: { id: "cx-1", nome: "Caixa Principal" },
  membro: { id: "m1", nome: "João Silva" },
  attachmentUploadId: null,
  attachmentUpload: null,
};

describe("<UltimasMovimentacoes />", () => {
  it("renderiza lista de itens", () => {
    const html = renderList({ items: [itemBase], podeVerMembro: true });
    expect(html).toContain("Dízimo mensal");
  });

  it("renderiza data no formato dd/MM", () => {
    const html = renderList({ items: [itemBase], podeVerMembro: true });
    expect(html).toContain("01/06");
  });

  it("ENTRADA tem classe text-green-*", () => {
    const html = renderList({ items: [itemBase], podeVerMembro: true });
    expect(html).toContain("text-green-");
  });

  it("SAIDA tem classe text-red-*", () => {
    const html = renderList({
      items: [{ ...itemBase, tipo: "SAIDA" }],
      podeVerMembro: true,
    });
    expect(html).toContain("text-red-");
  });

  it("exibe nome do membro quando podeVerMembro e categoria DIZIMO", () => {
    const html = renderList({ items: [itemBase], podeVerMembro: true });
    expect(html).toContain("João Silva");
  });

  it("NÃO exibe nome do membro quando !podeVerMembro e categoria DIZIMO", () => {
    const html = renderList({ items: [itemBase], podeVerMembro: false });
    expect(html).toContain("Dízimo");
    expect(html).not.toContain("João Silva");
  });

  it("exibe EmptyState quando items vazio", () => {
    const html = renderList({ items: [], podeVerMembro: true });
    expect(html).toContain("Nenhuma movimentação");
  });

  it("categoria DIZIMO tem label 'Dízimo'", () => {
    const html = renderList({ items: [itemBase], podeVerMembro: true });
    expect(html).toContain("Dízimo");
  });

  it("categoria OFERTA tem label 'Oferta'", () => {
    const html = renderList({
      items: [{ ...itemBase, categoria: "OFERTA" }],
      podeVerMembro: true,
    });
    expect(html).toContain("Oferta");
  });
});
