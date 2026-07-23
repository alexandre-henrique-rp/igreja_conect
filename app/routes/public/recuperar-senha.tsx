import type { Route } from "./+types/recuperar-senha";
import { data, redirect } from "react-router";
import { useState } from "react";
import { Form, Link, useActionData, useNavigation } from "react-router";
import { prisma } from "~/db/prisma.server";
import { hashPassword } from "~/lib/auth.server";
import { RecuperarSenhaStep1Schema, RecuperarSenhaStep2Schema } from "~/lib/schemas/auth";
import { Button } from "~/components/Button";
import { ErrorAlert } from "~/components/ErrorAlert";
import { Input } from "~/components/Input";

export function meta() {
  return [{ title: "Recuperar senha · Igreja Conect" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const step = formData.get("step");

  if (step === "verificar") {
    const parsed = RecuperarSenhaStep1Schema.safeParse({
      email: formData.get("email"),
      nome: formData.get("nome"),
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return data({ step: 1, fieldErrors }, { status: 422 });
    }

    const membro = await prisma.membro.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, nome: true, senhaHash: true },
    });

    if (!membro) {
      return data(
        { step: 1, formError: "E-mail ou nome incorretos." },
        { status: 401 }
      );
    }

    const nomeNormalizado = membro.nome.trim().toLowerCase();
    const inputNormalizado = parsed.data.nome.trim().toLowerCase();

    if (!nomeNormalizado.includes(inputNormalizado) && !inputNormalizado.includes(nomeNormalizado)) {
      return data(
        { step: 1, formError: "E-mail ou nome incorretos." },
        { status: 401 }
      );
    }

    return data({ step: 1, success: true, email: parsed.data.email });
  }

  if (step === "redefinir") {
    const parsed = RecuperarSenhaStep2Schema.safeParse({
      email: formData.get("email"),
      senha: formData.get("senha"),
      confirmarSenha: formData.get("confirmarSenha"),
    });

    if (!parsed.success || !parsed.data) {
      const fieldErrors: Record<string, string> = {};
      const emailRaw = String(formData.get("email") ?? "");
      for (const issue of parsed.error?.issues ?? []) {
        const key = String(issue.path[0] ?? "");
        if (key && key !== "email" && !fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      return data({ step: 2, fieldErrors, email: emailRaw }, { status: 422 });
    }

    const membro = await prisma.membro.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });

    if (!membro) {
      return data(
        { step: 2, formError: "Não foi possível redefinir a senha. Tente novamente." },
        { status: 404 }
      );
    }

    try {
      const senhaHash = await hashPassword(parsed.data.senha);
      await prisma.membro.update({
        where: { id: membro.id },
        data: { senhaHash },
      });
    } catch {
      return data(
        { step: 2, formError: "Erro ao salvar a nova senha. Tente novamente." },
        { status: 500 }
      );
    }

    throw redirect("/login?motivo=senha-redefinida");
  }

  return data({ step: 1, formError: "Requisição inválida." }, { status: 400 });
}

type ActionResponse =
  | { step: 1; formError?: string; fieldErrors?: Record<string, string>; success?: boolean; email?: string }
  | { step: 2; formError?: string; fieldErrors?: Record<string, string>; email?: string }
  | undefined;

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
      className="inline-flex items-center justify-center h-8 w-8 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors cursor-pointer"
    >
      {visible ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${met ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700/50 text-slate-500"}`}>
        {met ? "✓" : "○"}
      </span>
      <span className={met ? "text-emerald-400" : "text-slate-500"}>{label}</span>
    </div>
  );
}

export default function RecuperarSenhaPage() {
  const actionData = useActionData() as ActionResponse;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  const actionStep = actionData?.step ?? 1;
  const formError = actionData?.formError;
  const fieldErrors = actionData?.fieldErrors;

  if (actionStep === 1 && (actionData as Extract<ActionResponse, { step: 1 }>)?.success && step === 1) {
    setEmail((actionData as Extract<ActionResponse, { step: 1 }>).email ?? email);
    setStep(2);
  }

  const mailIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );

  const userIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );

  const lockIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );

  const hasMaiuscula = /[A-Z]/.test(senha);
  const hasNumero = /\d/.test(senha);
  const hasEspecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(senha);
  const hasMinLength = senha.length >= 8;
  const senhasConferem = senha === confirmarSenha && confirmarSenha.length > 0;

  return (
    <div className="min-h-screen bg-[#070e1b] flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden select-none font-sans">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-md focus:bg-blue-600 focus:text-white focus:text-sm focus:font-medium focus:shadow-lg focus:outline-none"
      >
        Pular para o conteúdo
      </a>

      <div className="relative mb-6 text-center z-10">
        <div className="absolute inset-0 bg-blue-500/15 blur-[25px] rounded-full scale-150 pointer-events-none" />
        <h1 className="relative text-3xl font-extrabold tracking-tight text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.25)]">
          IgrejaConnect
        </h1>
      </div>

      <main id="main-content" className="w-full max-w-[440px] z-10">
        <div className="bg-[#121b2c]/85 backdrop-blur-md border border-[#202f47] rounded-2xl p-8 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          {step === 1 && (
            <>
              <header className="mb-6">
                <h2 className="text-2xl font-bold text-white tracking-tight">Recuperar senha</h2>
                <p className="text-sm text-slate-400 mt-2">
                  Informe seu e-mail e nome para verificar sua identidade.
                </p>
              </header>

              {formError && (
                <div className="mb-4">
                  <ErrorAlert tone="error">{formError}</ErrorAlert>
                </div>
              )}

              <Form method="post" className="space-y-5" noValidate>
                <input type="hidden" name="step" value="verificar" />
                <Input
                  id="email"
                  label={<span className="tracking-wider font-bold text-xs">E-MAIL</span>}
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  error={fieldErrors?.email}
                  leadingIcon={mailIcon}
                  variant="dark"
                />
                <Input
                  id="nome"
                  label={<span className="tracking-wider font-bold text-xs">NOME</span>}
                  name="nome"
                  type="text"
                  required
                  autoComplete="name"
                  error={fieldErrors?.nome}
                  leadingIcon={userIcon}
                  variant="dark"
                />
                <Button type="submit" variant="blue" fullWidth loading={isSubmitting}>
                  {isSubmitting ? "Verificando..." : "Continuar"}
                </Button>
              </Form>
            </>
          )}

          {step === 2 && (
            <>
              <header className="mb-6">
                <h2 className="text-2xl font-bold text-white tracking-tight">Nova senha</h2>
                <p className="text-sm text-slate-400 mt-2">
                  Defina uma nova senha para acessar sua conta.
                </p>
              </header>

              {formError && (
                <div className="mb-4">
                  <ErrorAlert tone="error">{formError}</ErrorAlert>
                </div>
              )}

              <Form method="post" className="space-y-5" noValidate>
                <input type="hidden" name="step" value="redefinir" />
                <input type="hidden" name="email" value={email} />
                <Input
                  id="senha"
                  label={<span className="tracking-wider font-bold text-xs">NOVA SENHA</span>}
                  name="senha"
                  type="password"
                  required
                  autoComplete="new-password"
                  error={fieldErrors?.senha}
                  leadingIcon={lockIcon}
                  trailingAction={<ToggleVisibilidade inputId="senha" />}
                  variant="dark"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                <Input
                  id="confirmarSenha"
                  label={<span className="tracking-wider font-bold text-xs">CONFIRMAR SENHA</span>}
                  name="confirmarSenha"
                  type="password"
                  required
                  autoComplete="new-password"
                  error={fieldErrors?.confirmarSenha}
                  leadingIcon={lockIcon}
                  trailingAction={<ToggleVisibilidade inputId="confirmarSenha" />}
                  variant="dark"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                />

                {senha.length > 0 && (
                  <div className="space-y-1.5 text-xs">
                    <Requirement met={hasMinLength} label="Mínimo de 8 caracteres" />
                    <Requirement met={hasMaiuscula} label="Pelo menos 1 letra maiúscula" />
                    <Requirement met={hasNumero} label="Pelo menos 1 número" />
                    <Requirement met={hasEspecial} label="Pelo menos 1 caractere especial (!@#$%...)" />
                    <Requirement met={senhasConferem} label="Senhas conferem" />
                  </div>
                )}

                <Button
                  type="submit"
                  variant="blue"
                  fullWidth
                  loading={isSubmitting}
                  disabled={senha.length > 0 && !(hasMaiuscula && hasNumero && hasEspecial && hasMinLength && senhasConferem)}
                >
                  {isSubmitting ? "Salvando..." : "Salvar nova senha"}
                </Button>
              </Form>
            </>
          )}

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-xs font-semibold text-blue-500 hover:text-blue-400 transition-colors cursor-pointer focus-visible:outline-none focus-visible:underline"
            >
              Voltar para o login
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
