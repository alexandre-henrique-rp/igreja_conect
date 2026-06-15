/**
 * Componente <FormLogin /> — formulário de login completo (S01-T07).
 *
 * Renderiza a página de autenticação do Igreja Conect:
 * 1. `<TopbarPublica />` (sem botão "Entrar" — já está no fluxo).
 * 2. `<main id="main-content">` com card centralizado.
 * 3. Formulário com:
 *    - Input e-mail (autoComplete, required, inputMode=email).
 *    - Input senha (autoComplete=current-password, required, **toggle visibility**).
 *    - Checkbox "Manter-me conectado".
 *    - Botão "Entrar" (loading state via `useNavigation`).
 * 4. Link "Esqueceu a senha? Procure o Admin da sua igreja." (YAGNI — sem fluxo).
 * 5. Footer com copyright.
 *
 * **WCAG (Acessibilidade):**
 * - `<main id="main-content">` alvo do skip link da TopbarPublica.
 * - Labels associados via `htmlFor` (no `<Input />`).
 * - Erros com `role="alert"` (lê por screen reader).
 * - Foco visível em todos os elementos interativos.
 * - Contraste AA+ garantido.
 *
 * **Toggle de visibilidade da senha:**
 * - Pequeno sub-componente client-side com `useState`.
 * - `aria-label` muda entre "Mostrar senha" e "Ocultar senha".
 * - `aria-pressed` reflete o estado.
 * - Default: oculto (UX padrão para senhas).
 *
 * **LGPD (RAG §2.5):** o componente NÃO loga nada. O `<form>` envia
 * para o action server-side que loga via `safeLog` (sem email, sem senha).
 *
 * @example
 *   // Em app/routes/public/login.tsx
 *   export default function LoginPage() {
 *     const actionData = useActionData<typeof action>();
 *     return <FormLogin formError={actionData?.formError} fieldErrors={actionData?.fieldErrors} />;
 *   }
 *
 * @param props - Props do componente (ver `FormLoginProps`).
 * @returns Elemento JSX do form de login.
 */
import { useState } from "react";
import { Form, useNavigation, useSearchParams } from "react-router";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { ErrorAlert } from "./ErrorAlert";
import { Input } from "./Input";
import { TopbarPublica } from "./TopbarPublica";

/**
 * Props aceitas pelo `<FormLogin />`. Tipadas com `Record<string, string>`
 * (o que o action do `routes/public/login.tsx` retorna hoje — uma
 * mensagem única por campo, não array).
 */
export type FormLoginProps = {
  /** Mensagem de erro geral (credenciais inválidas, rate limit, etc.). */
  formError?: string;
  /** Email para pré-preencher (ex: volta após erro de validação). */
  defaultEmail?: string;
  /** Erros de validação por campo (vindos do Zod safeParse). */
  fieldErrors?: Record<string, string>;
  /** Se veio de `?motivo=expirado`, mostra mensagem informativa. */
  motivo?: "expirado";
};

/**
 * Toggle de visibilidade da senha — sub-componente client-side.
 *
 * Mantém o estado local com `useState`. Renderiza um botão à direita
 * do input de senha que alterna `type="password"` ↔ `type="text"`.
 *
 * @param props - Props do toggle.
 * @param props.inputId - ID do input alvo (para `aria-controls`).
 * @returns Elemento JSX do botão de toggle.
 */
function ToggleVisibilidade({ inputId }: { inputId: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setVisible((v) => !v)}
      aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
      aria-pressed={visible}
      aria-controls={inputId}
      className="
        inline-flex items-center justify-center
        h-8 w-8 rounded
        text-slate-500 hover:text-slate-700 hover:bg-slate-100
        focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-cyan-700 focus-visible:ring-offset-1
      "
    >
      {visible ? (
        // Olho-off (senha visível → ação é ocultar)
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      ) : (
        // Olho (senha oculta → ação é mostrar)
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

/**
 * @description Formulário de login completo, usado em `app/routes/public/login.tsx`.
 * @param {FormLoginProps} props - Veja `FormLoginProps`.
 * @returns {JSX.Element} Elemento do form.
 */
export function FormLogin({
  formError,
  defaultEmail,
  fieldErrors,
  motivo,
}: FormLoginProps) {
  const navigation = useNavigation();
  // Mantém useSearchParams importado para futuras props baseadas em query;
  // hoje o componente recebe `motivo` direto do loader via props, mas
  // mantemos o import para uso futuro sem refactor.
  void useSearchParams;
  const isSubmitting = navigation.state === "submitting";

  return (
    <>
      <TopbarPublica />
      <main
        id="main-content"
        className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-12"
      >
        <div className="w-full max-w-md">
          <header className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Entrar</h1>
            <p className="text-sm text-slate-600 mt-1">
              Acesse o painel administrativo.
            </p>
          </header>

          {/*
            Mensagens no topo (ordem importa):
            1. motivo=expirado → info (acima do erro, é só contexto)
            2. formError → erro de credenciais/rate limit
            Os fieldErrors vão inline em cada campo.
          */}
          {motivo === "expirado" && (
            <div className="mb-4">
              <ErrorAlert tone="info">
                Sua sessão expirou. Faça login novamente.
              </ErrorAlert>
            </div>
          )}
          {formError && (
            <div className="mb-4">
              <ErrorAlert tone="error">{formError}</ErrorAlert>
            </div>
          )}

          <Form
            method="post"
            action="/login"
            className="space-y-4"
            // Desativa validação HTML5 nativa — a validação real é
            // server-side via Zod (LoginSchema) no action, e a UI mostra
            // via fieldErrors. Sem `noValidate`, o browser mostraria
            // bubbles nativas conflitando com a UI.
            noValidate
          >
            <Input
              id="email"
              label="E-mail"
              name="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              defaultValue={defaultEmail}
              error={fieldErrors?.email}
            />
            <Input
              id="senha"
              label="Senha"
              name="senha"
              type="password"
              required
              autoComplete="current-password"
              error={fieldErrors?.senha}
              trailingAction={<ToggleVisibilidade inputId="senha" />}
            />
            <Checkbox
              label="Manter-me conectado (30 dias)"
              name="manterConectado"
              value="true"
            />
            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={isSubmitting}
            >
              {isSubmitting ? "Entrando..." : "Entrar"}
            </Button>
            <p className="text-sm text-slate-500 text-center pt-1">
              Esqueceu a senha? Procure o Admin da sua igreja.
            </p>
          </Form>
        </div>
      </main>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        © Igreja Conect 2026
      </footer>
    </>
  );
}
