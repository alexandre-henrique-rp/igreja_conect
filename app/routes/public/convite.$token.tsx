/**
 * Rota /convite/:token — criação de senha via convite.
 *
 * Página pública onde o membro convidado cria sua senha.
 * Token expira em 2 horas. Uso único.
 *
 * Loader: valida token → se inválido/expirado → 404
 * Action: valida senha + confirmação → hash → atualiza membro → redirect login
 *
 * UI: `AuthLayout` (centered) + `AuthCard` + `Input`/`Button` do Design System.
 */
import { useState } from "react";
import { data, redirect, useActionData, useNavigation } from "react-router";
import { AuthCard, AuthLayout, Button, Input } from "~/components/ds";
import { ErrorAlert } from "~/components/ErrorAlert";
import { usarConvite, validarConvite } from "~/lib/convite.server";
import { SenhaConviteSchema } from "~/lib/schemas/auth";
import type { Route } from "./+types/convite.$token";

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
      {
        formError:
          "Convite inválido ou expirado. Solicite um novo convite ao administrador.",
      },
      { status: 404 },
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
      { status: 500 },
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
  const hasEspecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(senha);
  const hasMinLength = senha.length >= 8;
  const senhasConferem = senha === confirmarSenha && confirmarSenha.length > 0;
  const senhaValida =
    hasMaiuscula && hasNumero && hasEspecial && hasMinLength && senhasConferem;

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-md focus:bg-accent focus:text-white focus:text-sm focus:font-medium focus:shadow-lg focus:outline-none"
      >
        Pular para o conteúdo
      </a>
      <AuthLayout variant="centered" id="main-content">
        <div className="w-full max-w-md">
          <div className="auth-logo-row justify-center">
            <span className="brand-mark" aria-hidden="true" />
            <span className="brand-name">Igreja Conect</span>
          </div>

          <AuthCard
            title="Crie sua senha"
            lead={
              <>
                Olá,{" "}
                <span className="font-semibold text-fg">
                  {loaderData.membroNome}
                </span>
                ! Defina uma senha segura para acessar o sistema.
              </>
            }
          >
            {data?.formError && (
              <div className="mb-4">
                <ErrorAlert tone="error">{data.formError}</ErrorAlert>
              </div>
            )}

            <form method="post" className="space-y-5" noValidate>
              <Input
                id="senha"
                name="senha"
                label="Senha"
                type="password"
                required
                autoComplete="new-password"
                placeholder="Digite sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                error={data?.fieldErrors?.senha}
              />

              <Input
                id="confirmarSenha"
                name="confirmarSenha"
                label="Confirmar senha"
                type="password"
                required
                autoComplete="new-password"
                placeholder="Confirme sua senha"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                error={data?.fieldErrors?.confirmarSenha}
              />

              {senha.length > 0 && (
                <div className="space-y-1.5 text-xs" aria-live="polite">
                  <Requirement
                    met={hasMinLength}
                    label="Mínimo de 8 caracteres"
                  />
                  <Requirement
                    met={hasMaiuscula}
                    label="Pelo menos 1 letra maiúscula"
                  />
                  <Requirement met={hasNumero} label="Pelo menos 1 número" />
                  <Requirement
                    met={hasEspecial}
                    label="Pelo menos 1 caractere especial (!@#$%...)"
                  />
                  <Requirement met={senhasConferem} label="Senhas conferem" />
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={isSubmitting}
                disabled={senha.length > 0 && !senhaValida}
              >
                {isSubmitting ? "Criando senha..." : "Criar senha"}
              </Button>
            </form>
          </AuthCard>
        </div>
      </AuthLayout>
    </>
  );
}

function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${met ? "bg-success-soft text-success" : "bg-surface-3 text-muted"}`}
      >
        {met ? "✓" : "○"}
      </span>
      <span className={met ? "text-success" : "text-muted"}>{label}</span>
    </div>
  );
}
