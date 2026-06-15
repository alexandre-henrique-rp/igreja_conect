/**
 * Teste do componente <FormLogin /> (S01-T07).
 *
 * Estratégia: `createRoutesStub` do react-router v7 com a rota
 * `/login` que tem um `loader` retornando dados mockados (`motivo`,
 * `defaultEmail`) e um `action` no-op. O componente consome via
 * `useActionData`/`useNavigation` — exatamente como em produção.
 *
 * Em ambiente Node (sem DOM real), validamos o **HTML SSR** gerado
 * pelo `renderToString`. Isso prova que:
 * 1. As classes Tailwind certas estão sendo aplicadas.
 * 2. Os atributos ARIA (aria-invalid, role=alert, etc.) estão no markup.
 * 3. A estrutura semântica (label/input/button) está correta.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { FormLogin } from "./FormLogin";

/**
 * Helper: renderiza o FormLogin dentro de um Router simulado, com
 * `loaderData` mockado. Recebe o `searchParams` para simular
 * `?motivo=expirado` e `?email=...`.
 */
function renderForm(
  props: Parameters<typeof FormLogin>[0] = {},
  search = ""
): string {
  // createRoutesStub com loader que devolve `loaderData` no formato
  // que o componente consome (motivo, defaultEmail).
  const Stub = createRoutesStub([
    {
      path: "/login",
      Component: () => <FormLogin {...props} />,
    },
  ]);
  return renderToString(<Stub initialEntries={[`/login${search}`]} />);
}

describe("<FormLogin />", () => {
  it("renderiza <main id='main-content'> para o skip link da TopbarPublica", () => {
    const html = renderForm();
    expect(html).toContain("<main");
    expect(html).toContain('id="main-content"');
  });

  it("renderiza h1 'Entrar'", () => {
    const html = renderForm();
    expect(html).toContain("<h1");
    expect(html).toContain("Entrar");
  });

  it("renderiza form com method='post' action='/login'", () => {
    const html = renderForm();
    expect(html).toContain("<form");
    expect(html).toContain('action="/login"');
    expect(html).toContain('method="post"');
  });

  it("renderiza input de e-mail com type=email, autocomplete=email, required", () => {
    const html = renderForm();
    expect(html).toContain('type="email"');
    expect(html).toContain('name="email"');
    // React 19 SSR mantém autoComplete/required em camelCase
    expect(html).toContain("autoComplete=\"email\"");
    expect(html).toContain("required");
  });

  it("renderiza input de senha com type=password, autocomplete=current-password, required", () => {
    const html = renderForm();
    expect(html).toContain('type="password"');
    expect(html).toContain('name="senha"');
    expect(html).toContain("autoComplete=\"current-password\"");
  });

  it("renderiza botão 'Entrar' do tipo submit", () => {
    const html = renderForm();
    expect(html).toContain("Entrar");
    // Botão com type=submit
    expect(html).toContain('type="submit"');
  });

  it("renderiza checkbox 'Manter-me conectado'", () => {
    const html = renderForm();
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('name="manterConectado"');
    expect(html).toContain("Manter-me conectado");
  });

  it("renderiza link 'Esqueceu a senha? Procure o Admin da sua igreja.'", () => {
    const html = renderForm();
    expect(html).toContain("Procure o Admin da sua igreja");
  });

  it("renderiza footer com copyright", () => {
    const html = renderForm();
    expect(html).toContain("Igreja Conect");
    expect(html).toContain("2026");
  });

  it("sem formError: NÃO renderiza <ErrorAlert> de erro", () => {
    const html = renderForm({ formError: undefined });
    // Sem role=alert (a versão que teríamos com ErrorAlert)
    // Pode haver aria-label mas não o container com role=alert para erro
    const alertCount = (html.match(/role="alert"/g) ?? []).length;
    expect(alertCount).toBe(0);
  });

  it("com formError='E-mail ou senha incorretos.': renderiza ErrorAlert", () => {
    const html = renderForm({ formError: "E-mail ou senha incorretos." });
    expect(html).toContain("E-mail ou senha incorretos.");
    expect(html).toContain("role=\"alert\"");
  });

  it("com motivo='expirado': mostra mensagem informativa", () => {
    const html = renderForm({ motivo: "expirado" });
    expect(html).toContain("Sua sessão expirou");
    expect(html).toContain("Faça login novamente");
  });

  it("com fieldErrors.email: input email tem aria-invalid", () => {
    const html = renderForm({
      fieldErrors: { email: "E-mail inválido." },
    });
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("E-mail inválido.");
  });

  it("com fieldErrors.senha: input senha tem aria-invalid", () => {
    const html = renderForm({
      fieldErrors: { senha: "Senha obrigatória." },
    });
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("Senha obrigatória.");
  });

  it("com defaultEmail='user@igreja.local': input email tem defaultValue", () => {
    const html = renderForm({ defaultEmail: "user@igreja.local" });
    // React 19 SSR: defaultValue → value no output
    expect(html).toContain('value="user@igreja.local"');
  });

  it("botão submit tem classes primary (bg-cyan-700)", () => {
    const html = renderForm();
    expect(html).toContain("bg-cyan-700");
  });
});
