/**
 * Rota /login (S01-T03).
 *
 * Server-side:
 * - `loader` redireciona para `/app` se já autenticado.
 * - `action` valida (Zod) → rate limit (5/15min/IP) → verifyCredentials
 *   (bcrypt + mensagem unificada anti-enumeração) → createSession +
 *   set-cookie httpOnly + redirect (para `?next` ou `/app`).
 *
 * **LGPD:** loga apenas `userId`/`action`/`result` via `safeLog` —
 * email e senha nunca tocam o logger.
 *
 * **Mensagem unificada:** 401 com `formError: "E-mail ou senha incorretos."`
 * tanto para email inexistente quanto senha errada (SPEC §5.1,
 * RN-MEM-auth-01).
 */
import type { Route } from "./+types/login";
import { data, redirect } from "react-router";
import { verifyCredentials } from "~/lib/auth.server";
import { LoginSchema } from "~/lib/schemas/auth";
import { checkRateLimit } from "~/lib/rate-limit.server";
import { safeLog } from "~/lib/audit.server";
import { createSession, getUserFromRequest, sessionCookie } from "~/lib/session.server";

/**
 * Loader: redireciona para `/app` (ou `?next`) se o visitante já tem
 * cookie válido. Caso contrário, retorna `null` para a página renderizar.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUserFromRequest(request);
  if (user) {
    const url = new URL(request.url);
    const next = url.searchParams.get("next");
    throw redirect(safeNext(next));
  }
  return null;
}

/**
 * Action: processa POST do `<FormLogin>`.
 *
 * Fluxo (em ordem):
 * 1. Rate limit por IP (chave: "login"). Se bloqueado → 429.
 * 2. Zod `LoginSchema.safeParse(formData)`. Se falhar → 422 com
 *    `fieldErrors` (PT-BR) por campo.
 * 3. `verifyCredentials(email, senha)`. Se null → 401 com
 *    `formError: "E-mail ou senha incorretos."` (unificado).
 * 4. Sucesso: `createSession(user.id)`, `Set-Cookie __session=...` com
 *    flags estritas (httpOnly, sameSite=lax, secure em prod, path=/,
 *    maxAge=7d), redirect para `?next` (validado) ou `/app`.
 */
export async function action({ request }: Route.ActionArgs) {
  // Identifica o IP para rate limit. Em produção, atrás de proxy, o
  // `x-forwarded-for` é a fonte da verdade. Em dev local, cai para
  // "unknown" (compartilhado, sem rate limit efetivo — aceitável).
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  // 1. Rate limit
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    safeLog({
      action: "login",
      result: "rate_limited",
      ip,
      timestamp: Date.now(),
    });
    return data(
      { formError: "Muitas tentativas. Tente novamente em alguns minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
    );
  }

  // 2. Parse + Zod
  const formData = await request.formData();
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    senha: formData.get("senha"),
    manterConectado: formData.get("manterConectado") ?? undefined,
  });
  if (!parsed.success) {
    checkRateLimit(ip, "fail");
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    safeLog({
      action: "login",
      result: "invalid_payload",
      ip,
      timestamp: Date.now(),
    });
    return data({ fieldErrors }, { status: 422 });
  }

  // 3. verifyCredentials (mensagem unificada)
  const user = await verifyCredentials(parsed.data.email, parsed.data.senha);
  if (!user) {
    checkRateLimit(ip, "fail");
    safeLog({
      action: "login",
      result: "invalid_credentials",
      ip,
      timestamp: Date.now(),
    });
    return data(
      { formError: "E-mail ou senha incorretos." },
      { status: 401 }
    );
  }

  // 4. Sucesso: cria sessão, seta cookie, redireciona
  const sid = await createSession(user.id);
  checkRateLimit(ip, "success");
  safeLog({
    userId: user.id,
    action: "login",
    result: "ok",
    ip,
    timestamp: Date.now(),
  });

  // `manterConectado` por enquanto é apenas persistido (não muda TTL).
  // O TTL sliding de 7 dias já cobre o caso comum; refresh tokens
  // ficam para evolução futura (YAGNI).
  const next = new URL(request.url).searchParams.get("next");
  const target = safeNext(next);

  return redirect(target, {
    headers: { "Set-Cookie": await sessionCookie.serialize(sid) },
  });
}

/**
 * Garante que `next` é um path interno (anti-open-redirect). Aceita
 * apenas paths iniciados em `/` que **não** começam com `//` (que
 * seria uma URL absoluta). Se inválido, retorna `/app`.
 */
function safeNext(next: string | null): string {
  if (!next) return "/app";
  if (!next.startsWith("/")) return "/app";
  if (next.startsWith("//")) return "/app";
  return next;
}

/**
 * Página de login — consome o `<FormLogin />` (componente cliente).
 *
 * **O que este componente faz:**
 * 1. Lê `actionData` (resposta do action: `formError` ou `fieldErrors`).
 * 2. Lê `searchParams` para `?motivo=expirado` e `?email=...`.
 * 3. Lê `navigation` para o loading state do botão.
 * 4. Passa tudo para o `<FormLogin />` (UI pura em `app/components/`).
 *
 * **Loader e action:** continuam acima e **NÃO foram tocados** —
 * foram entregues pelo backend agent na S01-T03.
 */
import { useActionData, useNavigation, useSearchParams } from "react-router";
import { FormLogin } from "~/components/FormLogin";

/**
 * Tipo do retorno do `action`. União de erros (credenciais, rate limit,
 * validação). Usado para tipar `useActionData` e o cast abaixo.
 */
type ActionResponse =
  | { formError: string }
  | { fieldErrors: Record<string, string> }
  | undefined;

export default function LoginPage() {
  const actionData = useActionData() as ActionResponse;
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();

  // `motivo=expirado` na URL → mostra mensagem informativa.
  const motivo =
    searchParams.get("motivo") === "expirado" ? "expirado" : undefined;

  // `?email=...` → pré-preenche o campo (UX: usuário recarregou a página).
  const defaultEmail = searchParams.get("email") ?? undefined;

  // Cast seguro: actionData é união, mas como é read-only e cada chave
  // é independente, lemos `formError` e `fieldErrors` opcionais.
  const data = actionData as
    | { formError?: string; fieldErrors?: Record<string, string> }
    | undefined;

  return (
    <FormLogin
      formError={data?.formError}
      fieldErrors={data?.fieldErrors}
      motivo={motivo}
      defaultEmail={defaultEmail}
    />
  );
}
