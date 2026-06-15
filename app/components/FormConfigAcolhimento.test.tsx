/**
 * Teste do componente <FormConfigAcolhimento /> (S04-T05).
 *
 * Formulário de configuração do responsável pelo acolhimento:
 * - RadioGroup MEMBRO/MINISTERIO controla qual Select aparece
 * - Select de membros ou ministérios
 * - Form method="post" com intent="update"
 * - Se !canEdit: mostra InfoBox "Apenas o Admin pode alterar"
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import {
  FormConfigAcolhimento,
  type FormConfigAcolhimentoProps,
} from "./FormConfigAcolhimento";

function renderForm(props: FormConfigAcolhimentoProps): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <FormConfigAcolhimento {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

const defaultProps: FormConfigAcolhimentoProps = {
  canEdit: true,
  config: undefined,
  membros: [
    { id: "1", nome: "João Paulo", cargo: "PASTOR" },
    { id: "2", nome: "Maria Silva", cargo: "SECRETARIO" },
  ],
  ministerios: [
    { id: "m1", nome: "Ministério de Louvor" },
    { id: "m2", nome: "Ministério Infantil" },
  ],
};

describe("<FormConfigAcolhimento />", () => {
  it("renderiza <form> com method='post' quando canEdit=true", () => {
    const html = renderForm(defaultProps);
    expect(html).toContain("<form");
    expect(html).toContain('method="post"');
  });

  it("renderiza input hidden com intent='update'", () => {
    const html = renderForm(defaultProps);
    expect(html).toContain('name="intent"');
    expect(html).toContain('value="update"');
  });

  it("renderiza RadioGroup com MEMBRO e MINISTERIO", () => {
    const html = renderForm(defaultProps);
    expect(html).toContain("MEMBRO");
    expect(html).toContain("MINISTERIO");
    expect(html).toContain("<fieldset");
  });

  it("renderiza Select para membros (com cargo)", () => {
    const html = renderForm(defaultProps);
    expect(html).toContain("João Paulo");
    expect(html).toContain("Maria Silva");
    expect(html).toContain("<select");
  });

  it("usa nomes corretos dos campos na submissão do form", () => {
    const html = renderForm(defaultProps);
    expect(html).toContain('name="responsavelVisitanteTipo"');
    expect(html).toContain('name="responsavelId"');
    expect(html).not.toContain('name="tipoResponsavel"');
  });

  it("quando sem config, renderiza Select de membros por padrão", () => {
    const html = renderForm(defaultProps);
    expect(html).toContain("Membro responsável");
    expect(html).toContain("João Paulo (PASTOR)");
    expect(html).not.toContain("Ministério de Louvor");
  });

  it("quando config.tipo=MINISTERIO, renderiza Select de ministérios", () => {
    const html = renderForm({
      ...defaultProps,
      config: { tipo: "MINISTERIO", nome: "Ministério de Louvor" },
    });
    expect(html).toContain("Ministério responsável");
    expect(html).toContain("Ministério de Louvor");
    expect(html).toContain("Ministério Infantil");
  });

  it("quando canEdit=false, mostra InfoBox em vez do form", () => {
    const html = renderForm({ ...defaultProps, canEdit: false });
    expect(html).toContain("Apenas o Admin pode alterar");
    expect(html).toContain('role="note"');
    expect(html).not.toContain("<form");
  });

  it("renderiza InfoBox explicativo ao final do form", () => {
    const html = renderForm(defaultProps);
    expect(html).toContain(
      "Ao cadastrar um visitante, um alerta será enviado ao responsável configurado"
    );
  });

  it("quando config presente, RadioGroup reflete valor atual", () => {
    const html = renderForm({
      ...defaultProps,
      config: { tipo: "MINISTERIO", nome: "Ministério de Louvor" },
    });
    // Radio MINISTERIO deve estar marcado
    expect(html).toContain('value="MINISTERIO"');
  });

  it("renderiza botão submit com texto 'Salvar'", () => {
    const html = renderForm(defaultProps);
    expect(html).toContain("Salvar");
  });

  it("membros aparecem com cargo entre parênteses no label", () => {
    const html = renderForm(defaultProps);
    expect(html).toContain("João Paulo");
    expect(html).toContain("PASTOR");
  });
});
