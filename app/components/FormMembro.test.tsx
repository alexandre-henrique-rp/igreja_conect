/**
 * Teste do componente <FormMembro /> (S02-T05).
 *
 * Valida render SSR com defaultValues, estrutura de sections,
 * e botões de ação.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { FormMembro, type FormMembroDefaultValues } from "./FormMembro";

function renderForm(
  props: Partial<Parameters<typeof FormMembro>[0]> = {}
): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <FormMembro isEdit={false} {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

const baseDefaults: FormMembroDefaultValues = {
  id: "abc-123",
  nome: "Maria da Silva",
  tipo: "VISITANTE",
  email: "maria@igreja.local",
  telefone: "(11) 98765-4321",
  dataConversao: "2024-03-01",
  dataBatismo: "2024-06-15",
  profissao: "Professora",
  estadoCivil: "Casada",
  cep: "01000-000",
  logradouro: "Rua das Flores",
  numero: "123",
  bairro: "Centro",
  cidade: "São Paulo",
  estado: "SP",
};

describe("<FormMembro />", () => {
  it("renderiza <form> com method='post'", () => {
    const html = renderForm({ isEdit: false });
    expect(html).toContain("<form");
    expect(html).toContain('method="post"');
  });

  it("renderiza 4 fieldsets (Identificação, Contato, Eclesiástico, Endereço)", () => {
    const html = renderForm({ isEdit: false });
    const fieldsetCount = (html.match(/<fieldset/g) ?? []).length;
    expect(fieldsetCount).toBe(4);
    expect(html).toContain("Identificação");
    expect(html).toContain("Contato");
    expect(html).toContain("Eclesiástico");
    expect(html).toContain("Endereço");
  });

  it("renderiza campos: nome, email, telefone, cep, logradouro, etc.", () => {
    const html = renderForm({ isEdit: false });
    const names = [
      "nome", "tipo", "email", "telefone",
      "dataConversao", "dataBatismo", "profissao", "estadoCivil",
      "cep", "logradouro", "numero", "bairro", "cidade", "estado",
    ];
    for (const n of names) {
      expect(html).toContain(`name="${n}"`);
    }
  });

  it("isEdit=false: submit diz 'Cadastrar membro'", () => {
    const html = renderForm({ isEdit: false });
    expect(html).toContain("Cadastrar membro");
    expect(html).not.toContain("Salvar alterações");
  });

  it("isEdit=true com defaultValues: submit diz 'Salvar alterações'", () => {
    const html = renderForm({ isEdit: true, defaultValues: baseDefaults });
    expect(html).toContain("Salvar alterações");
    expect(html).not.toContain("Cadastrar membro");
  });

  it("isEdit=false: link 'Cancelar' aponta para /app/membros", () => {
    const html = renderForm({ isEdit: false });
    expect(html).toContain('href="/app/membros"');
    expect(html).toContain("Cancelar");
  });

  it("isEdit=true: link 'Cancelar' aponta para /app/membros/:id", () => {
    const html = renderForm({ isEdit: true, defaultValues: baseDefaults });
    expect(html).toContain('href="/app/membros/abc-123"');
  });

  it("defaultValues refletem nos campos (value=...)", () => {
    const html = renderForm({ isEdit: true, defaultValues: baseDefaults });
    expect(html).toContain('value="Maria da Silva"');
    expect(html).toContain('value="maria@igreja.local"');
    expect(html).toContain('value="Professora"');
    expect(html).toContain('value="Casada"');
    expect(html).toContain('value="Rua das Flores"');
    expect(html).toContain('value="123"');
    expect(html).toContain('value="Centro"');
    expect(html).toContain('value="São Paulo"');
  });

  it("defaultValues.tipo: option MEMBRO_ATIVO selecionada (se setada)", () => {
    const html = renderForm({
      isEdit: true,
      defaultValues: { ...baseDefaults, tipo: "MEMBRO_ATIVO" },
    });
    // selected="" na option correspondente
    expect(html).toContain('value="MEMBRO_ATIVO" selected=""');
  });

  it("formError é renderizado em ErrorAlert (role=alert)", () => {
    const html = renderForm({ isEdit: false, formError: "Erro genérico." });
    expect(html).toContain("Erro genérico.");
    expect(html).toContain('role="alert"');
  });

  it("fieldErrors.nome aparece no campo nome", () => {
    const html = renderForm({
      isEdit: false,
      fieldErrors: { nome: ["Nome é obrigatório."] },
    });
    expect(html).toContain("Nome é obrigatório.");
    // O input nome tem aria-invalid
    expect(html).toContain('aria-invalid="true"');
  });

  it("campos telefone e CEP têm inputMode correto (tel/numeric)", () => {
    const html = renderForm({ isEdit: false });
    expect(html).toContain('inputMode="tel"');
    expect(html).toContain('inputMode="numeric"');
  });
});
