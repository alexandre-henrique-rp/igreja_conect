/**
 * Teste do componente <ModalCriarMinisterio /> (S03-T09).
 *
 * Modal de criar/editar ministério. Usado na rota
 * `/app/ministerios` para abrir o form (com `mode="criar"` ou
 * `mode="editar"`). Implementa:
 *
 * - Form com `intent=create` ou `intent=update`.
 * - Campos: nome (obrigatório) + descricao (opcional).
 * - Hidden `id` quando `mode="editar"`.
 * - Footer: Cancelar + Criar/Salvar.
 *
 * @see design/private-ministerios-list.DESIGN.md
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { ModalCriarMinisterio } from "./ModalCriarMinisterio";

function renderModal(
  props: {
    open: boolean;
  } & Omit<
    Parameters<typeof ModalCriarMinisterio>[0],
    "open"
  >
): string {
  const Stub = createRoutesStub([
    {
      path: "/app/ministerios",
      Component: () => <ModalCriarMinisterio {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/app/ministerios"]} />);
}

describe("<ModalCriarMinisterio />", () => {
  it("open=false: não renderiza", () => {
    const html = renderModal({ open: false, onClose: () => {}, mode: "criar" });
    expect(html).not.toContain('role="dialog"');
  });

  it("open=true: renderiza Dialog + form com intent=create", () => {
    const html = renderModal({ open: true, onClose: () => {}, mode: "criar" });
    expect(html).toContain('role="dialog"');
    expect(html).toContain('name="intent"');
    expect(html).toContain('value="create"');
  });

  it("mode='criar': título 'Novo ministério' + botão 'Criar'", () => {
    const html = renderModal({ open: true, onClose: () => {}, mode: "criar" });
    expect(html).toContain("Novo minist");
    expect(html).toContain("Criar");
  });

  it("mode='editar': título 'Editar ministério' + botão 'Salvar' + hidden id", () => {
    const html = renderModal({
      open: true,
      onClose: () => {},
      mode: "editar",
      defaultValues: { id: "min-1", nome: "Louvor", descricao: "Equipe" },
    });
    expect(html).toContain("Editar minist");
    expect(html).toContain("Salvar");
    expect(html).toContain('name="id"');
    expect(html).toContain('value="min-1"');
    expect(html).toContain('value="Louvor"');
  });

  it("renderiza campo 'nome' (obrigatório)", () => {
    const html = renderModal({ open: true, onClose: () => {}, mode: "criar" });
    expect(html).toContain('name="nome"');
    expect(html).toContain("Nome");
    // required
    expect(html).toContain("required");
  });

  it("renderiza campo 'descricao' (opcional, com hint)", () => {
    const html = renderModal({ open: true, onClose: () => {}, mode: "criar" });
    expect(html).toContain('name="descricao"');
    expect(html).toContain("Descri");
    // sem required
    expect(html).toContain("Opcional");
  });

  it("footer tem 'Cancelar'", () => {
    const html = renderModal({ open: true, onClose: () => {}, mode: "criar" });
    expect(html).toContain("Cancelar");
  });

  it("renderiza fieldErrors.nome quando fornecido", () => {
    const html = renderModal({
      open: true,
      onClose: () => {},
      mode: "criar",
      fieldErrors: { nome: "Nome obrigatório." },
    });
    expect(html).toContain("Nome obrigatório.");
    expect(html).toContain('aria-invalid="true"');
  });
});
