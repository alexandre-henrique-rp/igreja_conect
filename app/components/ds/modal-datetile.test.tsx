/**
 * Testes dos primitivos adicionados em T4 do plano de migração de UX:
 * <Modal /> (baseado em .movement-modal) e <DateTile /> (baseado em .date-tile).
 *
 * Estratégia: SSR via `renderToString` (padrão do projeto, sem
 * @testing-library). Em SSR os `useEffect` não disparam, mas a estrutura
 * semântica e os estados renderizados são validados.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import React from "react";
import { Modal, ModalBody, ModalFooter, DateTile } from "./index";

function render(node: React.ReactNode): string {
  const Stub = createRoutesStub([{ path: "/", Component: () => <>{node}</> }]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<Modal />", () => {
  it("open=false: não renderiza nada (estado fechado)", () => {
    const html = render(
      <Modal open={false} onClose={() => {}} title="T">
        <ModalBody>corpo</ModalBody>
      </Modal>,
    );
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("corpo");
  });

  it("open=true: renderiza título, descrição e corpo", () => {
    const html = render(
      <Modal open onClose={() => {}} title="Registrar entrada" description="Informe a quantidade.">
        <ModalBody>Campos aqui</ModalBody>
      </Modal>,
    );
    expect(html).toContain("Registrar entrada");
    expect(html).toContain("Informe a quantidade.");
    expect(html).toContain("Campos aqui");
  });

  it("tem semântica de diálogo acessível (role/aria-modal/labelledby)", () => {
    const html = render(
      <Modal open onClose={() => {}} title="Título">
        <ModalBody>x</ModalBody>
      </Modal>,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("aria-labelledby=");
    expect(html).toContain("movement-modal");
    expect(html).toContain("movement-dialog");
  });

  it("mostra botão de fechar por padrão e oculta com hideClose", () => {
    const withClose = render(
      <Modal open onClose={() => {}} title="T">
        <ModalBody>x</ModalBody>
      </Modal>,
    );
    expect(withClose).toContain('aria-label="Fechar"');

    const noClose = render(
      <Modal open onClose={() => {}} title="T" hideClose>
        <ModalBody>x</ModalBody>
      </Modal>,
    );
    expect(noClose).not.toContain('aria-label="Fechar"');
  });

  it("ModalFooter renderiza as ações", () => {
    const html = render(
      <Modal open onClose={() => {}} title="T">
        <ModalFooter>
          <button type="button">Cancelar</button>
          <button type="submit">Confirmar</button>
        </ModalFooter>
      </Modal>,
    );
    expect(html).toContain("movement-modal-foot");
    expect(html).toContain("Confirmar");
  });
});

describe("<DateTile />", () => {
  it("renderiza dia e mês", () => {
    const html = render(<DateTile day={12} month="out" />);
    expect(html).toContain("12");
    expect(html).toContain("out");
  });

  it("usa tokens semânticos accent por padrão (sem cor literal)", () => {
    const html = render(<DateTile day="04" month="out" />);
    expect(html).toMatch(/bg-accent-soft/);
    expect(html).not.toMatch(/bg-(cyan|blue|slate|red|green|amber)-[0-9]/);
  });

  it("aplica tom warning quando solicitado", () => {
    const html = render(<DateTile day={1} month="jan" tone="warning" />);
    expect(html).toContain("bg-warning-soft");
  });
});
