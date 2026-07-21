/**
 * Rota /convite/:token — criação de senha via convite.
 *
 * Página pública onde o membro convidado cria sua senha.
 * Token expira em 2 horas. Uso único.
 *
 * Loader: valida token → se inválido/expirado → 404
 * Action: valida senha + confirmação → hash → atualiza membro → redirect login
 */
import type { Route } from "./+types/convite.$token";
import { data, redirect } from "react-router";
import { useState } from "react";
import { useActionData, useNavigation } from "react-router";
import { validarConvite, usarConvite } from "~/lib/convite.server";
import { SenhaConviteSchema } from "~/lib/schemas/auth";
import { FormLogin } from "~/components/FormLogin";

export function meta() {
  return [{ title: "Criar senha · Igreja Conect" }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const resultado = await validarConvite(params.token);
  if (!resultado) {
    throw new Response("Convite inválido ou expirado.", { status: 404 });
  }
  return { membroNome: resultado.membroNome, token: params.token };
}

export async function action({ request, params }: Route.ActionArgs) {
  const resultado = await validarConvite(params.token);
  if (!resultado) {
    return data(
      { formError: "Convite inválido ou expirado. Solicite um novo convite ao administrador." },
      { status: 404 }
    );
  }

  const formData = await request.formData();
  const parsed = SenhaConviteSchema.safeParse({
    senha: formData.get("senha"),
    confirmarSenha: formData.get("confirmarSenha"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return data({ fieldErrors }, { status: 422 });
  }

  try {
    await usarConvite(params.token, parsed.data.senha);
  } catch {
    return data(
      { formError: "Erro ao criar senha. Tente novamente." },
      { status: 500 }
    );
  }

  throw redirect("/login?motivo=senha-criada");
}

type ActionResponse =
  | { formError: string }
  | { fieldErrors: Record<string, string> }
  | undefined;

export default function ConvitePage({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData() as ActionResponse;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  const data = actionData as
    | { formError?: string; fieldErrors?: Record<string, string> }
    | undefined;

  const hasMaiuscula = /[A-Z]/.test(senha);
  const hasNumero = /\d/.test(senha);
  const hasEspecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(senha);
  const hasMinLength = senha.length >= 8;
  const senhasConferem = senha === confirmarSenha && confirmarSenha.length > 0;

  return (
    <div className="min-h-screen bg-[#070e1b] flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden select-none font-sans">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />

      <div className="relative mb-6 text-center z-10">
        <div className="absolute inset-0 bg-blue-500/15 blur-[25px] rounded-full scale-150 pointer-events-none" />
        <h1 className="relative text-3xl font-extrabold tracking-tight text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.25)]">
          IgrejaConnect
        </h1>
      </div>

      <main className="w-full max-w-[440px] z-10">
        <div className="bg-[#121b2c]/85 backdrop-blur-md border border-[#202f47] rounded-2xl p-8 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <header className="mb-6">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Crie sua senha
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Olá, <span className="text-white font-semibold">{loaderData.membroNome}</span>!
              Defina uma senha segura para acessar o sistema.
            </p>
          </header>

          {data?.formError && (
            <div className="mb-4 p-3.5 bg-red-950/40 border border-red-900/40 rounded-lg text-red-300 text-sm">
              {data.formError}
            </div>
          )}

          <form method="post" className="space-y-5">
            <div>
              <label htmlFor="senha" className="block text-xs font-bold text-slate-400 tracking-wider mb-1.5">
                SENHA
              </label>
              <input
                id="senha"
                name="senha"
                type="password"
                required
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full h-11 px-4 rounded-lg bg-[#0a1220] border border-[#202f47] text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="Digite sua senha"
              />
              {data?.fieldErrors?.senha && (
                <p className="mt-1 text-xs text-red-400">{data.fieldErrors.senha}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmarSenha" className="block text-xs font-bold text-slate-400 tracking-wider mb-1.5">
                CONFIRMAR SENHA
              </label>
              <input
                id="confirmarSenha"
                name="confirmarSenha"
                type="password"
                required
                autoComplete="new-password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                className="w-full h-11 px-4 rounded-lg bg-[#0a1220] border border-[#202f47] text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="Confirme sua senha"
              />
              {data?.fieldErrors?.confirmarSenha && (
                <p className="mt-1 text-xs text-red-400">{data.fieldErrors.confirmarSenha}</p>
              )}
            </div>

            {senha.length > 0 && (
              <div className="space-y-1.5 text-xs">
                <Requirement met={hasMinLength} label="Mínimo de 8 caracteres" />
                <Requirement met={hasMaiuscula} label="Pelo menos 1 letra maiúscula" />
                <Requirement met={hasNumero} label="Pelo menos 1 número" />
                <Requirement met={hasEspecial} label="Pelo menos 1 caractere especial (!@#$%...)" />
                <Requirement met={senhasConferem} label="Senhas conferem" />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || (senha.length > 0 && !(hasMaiuscula && hasNumero && hasEspecial && hasMinLength && senhasConferem))}
              className="w-full h-11 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0"
            >
              {isSubmitting ? "Criando senha..." : "Criar senha"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${met ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700/50 text-slate-500"}`}>
        {met ? "✓" : "○"}
      </span>
      <span className={met ? "text-emerald-400" : "text-slate-500"}>
        {label}
      </span>
    </div>
  );
}
