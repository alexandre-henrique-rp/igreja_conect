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
 * @returns Elemento JSX do
 */
import { useState } from "react";
import { Form, Link, useNavigation, useSearchParams } from "react-router";
import { Button, Checkbox, Input } from "~/components/ds";
import { ErrorAlert } from "./ErrorAlert";
import { useClientIP } from "~/lib/hooks/useClientIP";

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
 * Mantém o estado local com `useState`. Alterna a visibilidade alterando
 * diretamente o atributo type do elemento input correspondente no DOM.
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
      onClick={() => {
        const input = document.getElementById(inputId) as HTMLInputElement | null;
        if (input) {
          const nextType = input.type === "password" ? "text" : "password";
          input.type = nextType;
          setVisible(nextType === "text");
        }
      }}
      aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
      aria-pressed={visible}
      aria-controls={inputId}
      className="
        inline-flex items-center justify-center
        h-8 w-8 rounded-md
        text-subtle hover:text-white hover:bg-fg/50
        focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-accent focus-visible:ring-offset-0
        transition-colors cursor-pointer
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
  void useSearchParams;
  const isSubmitting = navigation.state === "submitting";
  const clientIP = useClientIP();

  // SVGs dos ícones
  const mailIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 text-subtle"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );

  const lockIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 text-subtle"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );

  const emailLabel = <span className="tracking-wider font-bold text-xs">E-MAIL</span>;

  const senhaLabel = (
    <div className="flex items-center justify-between w-full">
      <span className="tracking-wider font-bold text-xs flex items-center gap-0.5">
        SENHA
        <span aria-hidden="true" className="text-danger font-bold">*</span>
      </span>
      <Link
        to="/recuperar-senha"
        className="text-xs font-semibold text-accent hover:text-accent transition-colors cursor-pointer focus-visible:outline-none focus-visible:underline"
      >
        Esqueceu a senha?
      </Link>
    </div>
  );

  return (
    <main className="auth-page split bg-bg" data-od-id="login-page">
      {/* Lado esquerdo — visual institucional com igreja + sun */}
      <section className="auth-visual" data-od-id="login-visual">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Igreja Conect</span>
        </Link>

        <div className="auth-visual-copy">
          <span
            className="eyebrow text-xs font-bold uppercase tracking-wider"
            style={{ color: "oklch(100% 0 0 / 0.68)" }}
          >
            Bem-vindo de volta
          </span>
          <h1>Cuide da casa. Acompanhe a jornada.</h1>
          <p>
            Um espaço seguro para organizar a vida da sua igreja e liberar
            sua liderança para estar mais perto das pessoas.
          </p>
          <div className="auth-visual-art" aria-hidden="true">
            <span className="sun" />
            <span className="auth-church">
              <span className="auth-door" />
            </span>
          </div>
        </div>

        <span className="auth-visual-footer">
          Igreja Conect · gestão com propósito
        </span>
      </section>

      {/* Lado direito — form */}
      <section className="auth-form-side" data-od-id="login-form-area">
        <div className="auth-card">
          <div className="auth-logo-row">
            <span className="brand-mark" aria-hidden="true" />
            <span className="brand-name">Igreja Conect</span>
          </div>

          <h1>Acessar conta</h1>
          <p className="lead">
            Entre para continuar cuidando da sua comunidade.
          </p>

          {/* Mensagens informativas e de erro */}
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
            className="js-form"
            noValidate
          >
            <input type="hidden" name="clientIP" value={clientIP} />
            <Input
              id="email"
              label={emailLabel}
              name="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              defaultValue={defaultEmail}
              error={fieldErrors?.email}
              leadingIcon={mailIcon}
            />
            <div className="space-y-1.5">
              <Input
                id="senha"
                label={senhaLabel}
                name="senha"
                type="password"
                required
                autoComplete="current-password"
                error={fieldErrors?.senha}
                leadingIcon={lockIcon}
                trailingAction={<ToggleVisibilidade inputId="senha" />}
                hideAsterisk
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <Checkbox
                label="Lembrar de mim"
                name="manterConectado"
                value="true"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={isSubmitting}
            >
              {isSubmitting ? "Entrando..." : "Entrar"}
            </Button>
          </Form>

          <div className="auth-footnote">
            Esqueceu a senha? Procure o admin da sua igreja.
          </div>
        </div>
      </section>
    </main>
  );
}
